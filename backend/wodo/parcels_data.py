"""Download, verify and publish the national parcel GeoParquet (GUGiK / EGiB).

Layout of ``WODO_PARCELS_DIR``::

    current -> releases/<id>/        atomically swapped symlink (what the API reads)
    releases/<id>/parcels.duckdb     query index built from the parquet
    releases/<id>/meta.json          ETag, Last-Modified, row count, dates
    tmp/                             downloads in progress (``*.part`` + state)
    .lock                            flock - one downloader/builder at a time

The multi-GB download uses several parallel ``Range`` connections (the source
throttles every connection to ~0.7 MB/s) and resumes after interruptions.
"""

import fcntl
import json
import logging
import os
import shutil
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import UTC, datetime
from pathlib import Path

import httpx

from wodo import parcels_index
from wodo.store import SourceError

log = logging.getLogger("wodo.parcels")

SOURCE_URL = "https://opendata.geoportal.gov.pl/InneDane/latest_exports/eziudp_wfs/PARQUET/0_dzialki.parquet"
SOURCE_NAME = "GUGiK / EGiB (GeoParquet)"
CHUNK = 16 * 1024 * 1024
EXPECTED_COLUMNS = {"id_dzialki", "numer_dzialki", "numer_obrebu", "nazwa_obrebu", "nazwa_gminy",
                    "numer_jednostki", "pole_ewidencyjne", "geometry", "geometry_bbox"}


def root():
    return Path(os.environ.get("WODO_PARCELS_DIR", "data/parcels"))


def source_url():
    return os.environ.get("WODO_PARCELS_URL", SOURCE_URL)


def now():
    return datetime.now(UTC).isoformat(timespec="seconds")


class DownloadError(Exception):
    pass


@contextmanager
def lock(base):
    base.mkdir(parents=True, exist_ok=True)
    with open(base / ".lock", "w") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as error:
            raise DownloadError("Inna instancja już pobiera lub buduje indeks działek.") from error
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


# ---------------------------------------------------------------- state

def current_release(base=None):
    """Directory of the active release, or None when nothing was published yet."""
    link = (base or root()) / "current"
    if not link.is_symlink() and not link.exists():
        return None
    target = link.resolve()
    return target if (target / "parcels.duckdb").is_file() and (target / "meta.json").is_file() else None


def read_meta(release):
    try:
        return json.loads((release / "meta.json").read_text())
    except (OSError, ValueError):
        return None


def progress_info(base=None):
    """Download progress reported by the updater (for /api/health)."""
    try:
        return json.loads(((base or root()) / "tmp" / "progress.json").read_text())
    except (OSError, ValueError):
        return None


def write_json(path, data):
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False))
    os.replace(temp, path)


# ---------------------------------------------------------------- remote

def client():
    return httpx.Client(follow_redirects=False, headers={"User-Agent": "PoleWidzenia/1.0 (parcel updater)"},
                        timeout=httpx.Timeout(60, connect=20),
                        limits=httpx.Limits(max_connections=64, max_keepalive_connections=0))


def head(http, url):
    last = None
    for attempt in range(5):
        try:
            response = http.head(url)
            if response.status_code != 200:
                raise DownloadError(f"Serwer danych zwrócił HTTP {response.status_code} (oczekiwano 200).")
            size = int(response.headers.get("content-length", "0"))
            if size < 1024:
                raise DownloadError("Serwer nie podał rozsądnego rozmiaru pliku.")
            return {"size": size, "etag": response.headers.get("etag"),
                    "last_modified": response.headers.get("last-modified"),
                    "ranges": response.headers.get("accept-ranges", "").lower() == "bytes"}
        except (httpx.TransportError, ValueError) as error:
            last = error
            time.sleep(2 * (attempt + 1))
    raise DownloadError(f"Brak połączenia z serwerem danych: {last}")


def remote_changed(remote, meta):
    if meta is None:
        return True
    if remote["etag"] and meta.get("etag"):
        return remote["etag"] != meta["etag"]
    return remote["last_modified"] != meta.get("last_modified")


# ---------------------------------------------------------------- download

def download(url, remote, directory, connections):
    """Parallel resumable download into ``directory/<name>.part``; returns the final path."""
    name = Path(httpx.URL(url).path).name or "dzialki.parquet"
    part, state_file = directory / (name + ".part"), directory / (name + ".state")
    size = remote["size"]
    total_chunks = -(-size // CHUNK)
    done = set()
    if part.exists() and state_file.exists():
        try:
            state = json.loads(state_file.read_text())
            if state.get("etag") == remote["etag"] and state.get("size") == size and part.stat().st_size == size:
                done = set(state["done"])
                log.info("Wznawiam pobieranie: gotowe %d z %d fragmentów.", len(done), total_chunks)
        except (OSError, ValueError, KeyError):
            done = set()
    if not done:
        with open(part, "wb") as handle:
            handle.truncate(size)
    todo = [i for i in range(total_chunks) if i not in done]
    mutex, started, counter = threading.Lock(), time.monotonic(), {"bytes": len(done) * CHUNK}
    base_bytes = counter["bytes"]
    fail = threading.Event()

    def save_state():
        write_json(state_file, {"etag": remote["etag"], "size": size, "done": sorted(done)})

    def fetch_chunk(index):
        start = index * CHUNK
        end = min(start + CHUNK, size) - 1
        headers = {"Range": f"bytes={start}-{end}"}
        if remote["etag"]:
            headers["If-Range"] = remote["etag"]
        with client() as http:
            for attempt in range(8):
                if fail.is_set():
                    return
                received = 0
                try:
                    with http.stream("GET", url, headers=headers) as response:
                        if response.status_code != 206:
                            raise DownloadError(f"Oczekiwano HTTP 206, serwer zwrócił {response.status_code} "
                                                "(plik mógł się zmienić w trakcie pobierania).")
                        received, offset = 0, start
                        with open(part, "r+b") as out:
                            for data in response.iter_bytes(1 << 20):
                                out.seek(offset)
                                out.write(data)
                                offset += len(data)
                                received += len(data)
                                with mutex:
                                    counter["bytes"] += len(data)
                    if received != end - start + 1:
                        raise httpx.ReadError("Za krótki fragment.")
                    with mutex:
                        done.add(index)
                        if len(done) % 8 == 0:
                            save_state()
                    return
                except DownloadError:
                    raise
                except (httpx.TransportError, httpx.HTTPStatusError, OSError) as error:
                    with mutex:
                        counter["bytes"] -= received
                    log.warning("Fragment %d: %s - ponawiam (%d/8).", index, error, attempt + 1)
                    time.sleep(min(30, 2 ** attempt))
        raise DownloadError(f"Nie udało się pobrać fragmentu {index} po 8 próbach.")

    def report():
        while not fail.is_set() and len(done) < total_chunks:
            time.sleep(10)
            with mutex:
                got = counter["bytes"]
            speed = (got - base_bytes) / max(time.monotonic() - started, 1)
            eta = (size - got) / speed if speed else 0
            log.info("Pobrano %.2f / %.2f GB (%.1f%%), %.1f MB/s, pozostało ok. %d min.",
                     got / 1e9, size / 1e9, 100 * got / size, speed / 1e6, eta / 60)
            write_json(directory / "progress.json", {"phase": "download", "bytes": got, "total": size,
                                                      "speed_mbps": round(speed / 1e6, 2), "updated_at": now()})

    threading.Thread(target=report, daemon=True).start()
    try:
        with ThreadPoolExecutor(max_workers=connections) as pool:
            for future in [pool.submit(fetch_chunk, i) for i in todo]:
                try:
                    future.result()
                except Exception:
                    fail.set()
                    raise
    finally:
        fail.set() if len(done) < total_chunks else None
        save_state()
    if len(done) != total_chunks:
        raise DownloadError("Pobieranie nie zostało ukończone.")
    final = directory / name
    os.replace(part, final)
    state_file.unlink(missing_ok=True)
    return final


def verify_file(path, size):
    if path.stat().st_size != size:
        raise DownloadError(f"Rozmiar pliku {path.stat().st_size} B różni się od Content-Length {size} B.")
    with open(path, "rb") as handle:
        head_magic = handle.read(4)
        handle.seek(-4, os.SEEK_END)
        tail_magic = handle.read(4)
    if head_magic != b"PAR1" or tail_magic != b"PAR1":
        raise DownloadError("Plik nie jest poprawnym plikiem Parquet (brak sygnatury PAR1).")


# ---------------------------------------------------------------- refresh

def refresh(force=False, base=None, connections=None):
    """Check upstream and, when changed (or ``force``), download, index and publish. Returns a status string."""
    base = base or root()
    connections = connections or int(os.environ.get("WODO_PARCELS_CONNECTIONS", "12"))
    url = source_url()
    with lock(base):
        (base / "releases").mkdir(exist_ok=True)
        tmp = base / "tmp"
        tmp.mkdir(exist_ok=True)
        active = current_release(base)
        meta = read_meta(active) if active else None
        with client() as http:
            remote = head(http, url)
        if not force and not remote_changed(remote, meta):
            log.info("Dane działek są aktualne (ETag %s) - pomijam pobieranie.", remote["etag"])
            return "current"
        if not remote["ranges"]:
            connections = 1
        log.info("Pobieram dane działek: %.2f GB z %s (%d połączeń).", remote["size"] / 1e9, url, connections)
        started = time.monotonic()
        path = tmp / (Path(httpx.URL(url).path).name or "dzialki.parquet")
        marker = path.with_name(path.name + ".etag")
        if path.is_file() and marker.is_file() and marker.read_text() == str(remote["etag"]):
            log.info("Znaleziono kompletny, pobrany wcześniej plik - pomijam pobieranie.")
        else:
            path = download(url, remote, tmp, connections)
            marker.write_text(str(remote["etag"]))
        verify_file(path, remote["size"])
        log.info("Pobrano i sprawdzono rozmiar oraz sygnaturę PAR1 (%.0f s).", time.monotonic() - started)
        release_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
        release = base / "releases" / release_id
        release.mkdir(parents=True)
        try:
            write_json(tmp / "progress.json", {"phase": "index", "updated_at": now()})
            info = parcels_index.build(path, release / "parcels.duckdb", EXPECTED_COLUMNS, log.info)
            write_json(release / "meta.json", {
                **info, "source": SOURCE_NAME, "source_url": url, "etag": remote["etag"],
                "last_modified": remote["last_modified"], "size_bytes": remote["size"],
                "downloaded_at": now(), "built_at": now(), "release": release_id})
        except BaseException:
            shutil.rmtree(release, ignore_errors=True)
            raise
        publish(base, release)
        path.unlink(missing_ok=True)
        marker.unlink(missing_ok=True)
        shutil.rmtree(tmp / "build", ignore_errors=True)
        (tmp / "progress.json").unlink(missing_ok=True)
        cleanup(base, keep=2)
        log.info("Opublikowano nowy indeks działek: %s.", release_id)
        return "updated"


def publish(base, release):
    """Atomically point ``current`` at ``release`` (rename over a temp symlink)."""
    link, temp = base / "current", base / ".current.new"
    temp.unlink(missing_ok=True)
    temp.symlink_to(Path("releases") / release.name)
    os.replace(temp, link)


def cleanup(base, keep=2):
    """Remove old releases, keeping the active one and the most recent others."""
    active = current_release(base)
    releases = sorted((p for p in (base / "releases").iterdir() if p.is_dir()), reverse=True)
    keepers = {active} if active else set()
    keepers |= set(releases[:keep])
    for old in releases:
        if old.resolve() not in {k.resolve() for k in keepers}:
            shutil.rmtree(old, ignore_errors=True)


# ---------------------------------------------------------------- API side

class DataNotReadyError(SourceError):
    pass


_open = {"path": None, "index": None, "meta": None}
_open_lock = threading.Lock()


def open_index():
    """(ParcelIndex, meta) for the active release; reopens transparently after an atomic swap."""
    release = current_release()
    if release is None:
        info = progress_info()
        if info and info.get("phase") == "download" and info.get("total"):
            raise DataNotReadyError(f"Dane działek są w trakcie pobierania ({100 * info['bytes'] // info['total']}%). "
                               "Spróbuj ponownie za kilka minut.")
        raise DataNotReadyError("Dane działek są w trakcie pobierania i budowania indeksu. Spróbuj ponownie za kilka minut.")
    with _open_lock:
        if _open["path"] != release:
            meta = read_meta(release)
            if meta is None:
                raise DataNotReadyError("Dane działek są w trakcie pobierania. Spróbuj ponownie za kilka minut.")
            _open.update(path=release, index=parcels_index.ParcelIndex(release / "parcels.duckdb"), meta=meta)
        return _open["index"], _open["meta"]


def health_info():
    """Summary for /api/health; never raises."""
    release = current_release()
    if release is None:
        return {"ready": False, "progress": progress_info()}
    meta = read_meta(release) or {}
    downloaded = meta.get("downloaded_at")
    age = None
    if downloaded:
        age = round((datetime.now(UTC) - datetime.fromisoformat(downloaded)).total_seconds() / 3600, 1)
    return {"ready": True, "rows": meta.get("rows"), "etag": meta.get("etag"), "last_modified": meta.get("last_modified"),
            "downloaded_at": downloaded, "age_hours": age, "release": meta.get("release")}


# ---------------------------------------------------------------- CLI

def loop(hours):
    while True:
        try:
            refresh()
        except Exception:
            log.exception("Odświeżanie danych działek nie powiodło się - zostają dotychczasowe dane.")
        (root() / "tmp").mkdir(parents=True, exist_ok=True)
        (root() / "tmp" / "last_check").write_text(now())
        log.info("Następne sprawdzenie za %s h.", hours)
        time.sleep(hours * 3600)


def healthy():
    """Healthcheck: a release exists, or a refresh loop is making progress/was recently started."""
    if current_release():
        return True
    info = progress_info()
    limit = 4 * 3600 if info and info.get("phase") == "index" else 600
    return bool(info and (datetime.now(UTC) - datetime.fromisoformat(info["updated_at"])).total_seconds() < limit)


def main(argv=None):
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)
    command = (argv or sys.argv[1:] or ["loop"])[0]
    hours = float(os.environ.get("WODO_PARCELS_REFRESH_HOURS", "24"))
    if command == "loop":
        loop(hours)
    elif command in ("refresh", "force"):
        print(refresh(force=command == "force"))
    elif command == "healthcheck":
        sys.exit(0 if healthy() else 1)
    elif command == "status":
        release = current_release()
        print(json.dumps({"release": release and release.name, "meta": release and read_meta(release),
                          "progress": progress_info()}, ensure_ascii=False, indent=2))
    else:
        sys.exit("Użycie: python -m wodo.parcels_data [loop|refresh|force|status|healthcheck]")


if __name__ == "__main__":
    main()
