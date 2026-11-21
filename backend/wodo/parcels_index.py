"""DuckDB index over the national parcel GeoParquet.

The source file is NOT sorted by id or space (every row group spans Poland), so the
build step writes an own layout:

* ``parcels`` - full rows ordered along a Morton (Z-order) curve of the bbox centre,
  with a sequential ``pk``. Row-group zone maps then prune bbox/point queries and
  pk lookups to a handful of row groups.
* ``by_id``   - narrow ``(id_key, pk)`` table sorted by upper-cased id.
* ``by_name`` - narrow ``(obreb_key, nr_key, pk)`` table sorted by lower-cased
  obręb name and parcel number.

No spatial extension and no ART indexes are needed (nothing is held in RAM beyond
DuckDB's buffer pool); exact point-in-polygon is done by the caller (Shapely) on the
few candidate rows. Coordinates stay in the file's native column order
(``geometry_bbox`` xmin/ymin/xmax/ymax and WKB exactly as stored).
"""

import os
import shutil
import threading
import time
from pathlib import Path

import duckdb

ROW_GROUP = 16384
BBOX_MARGIN = 1.0  # metres; the bbox covering is float32
COLUMNS = ("id_dzialki AS id, numer_dzialki AS number, nazwa_obrebu AS region, numer_obrebu AS region_no, "
           "nazwa_gminy AS commune, numer_jednostki AS unit, pole_ewidencyjne AS area, geometry AS wkb")


def morton_sql(cx, cy):
    """SQL expression interleaving the bits of two 16-bit integer expressions."""
    def spread(expr):
        layers = [(8, 0x00FF00FF), (4, 0x0F0F0F0F), (2, 0x33333333), (1, 0x55555555)]
        out = f"({expr})::BIGINT"
        for shift, mask in layers:
            out = f"((({out}) | (({out}) << {shift})) & {mask})"
        return out
    return f"({spread(cx)} | ({spread(cy)} << 1))"


def build(source, target, expected_columns, log=print):
    """Build ``target`` (a new duckdb file) from the parquet at ``source``. Returns summary info."""
    started = time.monotonic()
    target = Path(target)
    work = target.parent / "build-tmp"
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    target.unlink(missing_ok=True)
    con = duckdb.connect(str(target))
    try:
        con.execute(f"SET temp_directory='{work}'")
        con.execute(f"SET memory_limit='{os.environ.get('WODO_PARCELS_MEMORY', '3GB')}'")
        con.execute(f"SET threads={int(os.environ.get('WODO_PARCELS_THREADS', '4'))}")
        src = f"read_parquet('{source}')"
        columns = {row[0] for row in con.execute(f"DESCRIBE SELECT * FROM {src}").fetchall()}
        if missing := expected_columns - columns:
            raise ValueError(f"W pliku brakuje kolumn: {', '.join(sorted(missing))}.")
        rows = con.execute(f"SELECT count(*) FROM {src}").fetchone()[0]
        if rows < 1:
            raise ValueError("Plik z działkami jest pusty.")
        log(f"Plik poprawny: {rows} działek. Buduję indeks przestrzenny (kilkanaście minut dla całego kraju)...")
        cx = "least(65535, greatest(0, floor((geometry_bbox.xmin + geometry_bbox.xmax) / 32)))"
        cy = "least(65535, greatest(0, floor((geometry_bbox.ymin + geometry_bbox.ymax) / 32)))"
        con.execute(f"""CREATE TABLE parcels AS
            SELECT row_number() OVER (ORDER BY {morton_sql(cx, cy)}, id_dzialki) AS pk,
                   id_dzialki, numer_dzialki, nazwa_obrebu, numer_obrebu, nazwa_gminy, numer_jednostki,
                   pole_ewidencyjne, geometry_bbox.xmin::DOUBLE AS xmin, geometry_bbox.ymin::DOUBLE AS ymin,
                   geometry_bbox.xmax::DOUBLE AS xmax, geometry_bbox.ymax::DOUBLE AS ymax,
                   geometry::BLOB AS geometry
            FROM {src}""")
        log("Tabela działek gotowa. Buduję indeksy po identyfikatorze i nazwie obrębu...")
        con.execute("""CREATE TABLE by_id AS
            SELECT upper(id_dzialki) AS id_key, pk FROM parcels ORDER BY id_key""")
        con.execute("""CREATE TABLE by_name AS
            SELECT lower(nazwa_obrebu) AS obreb_key, lower(numer_dzialki) AS nr_key, pk FROM parcels
            ORDER BY obreb_key, nr_key""")
        stats = con.execute("""SELECT count(*), count(DISTINCT left(id_dzialki, 4)), min(xmin), max(xmax),
                                      min(ymin), max(ymax), count(*) FILTER (WHERE geometry IS NULL) FROM parcels""").fetchone()
        con.execute("CHECKPOINT")
    finally:
        con.close()
    shutil.rmtree(work, ignore_errors=True)
    return {"rows": stats[0], "teryt_counties": stats[1],
            "xmin": stats[2], "xmax": stats[3], "ymin": stats[4], "ymax": stats[5], "null_geometries": stats[6],
            "index_bytes": target.stat().st_size, "build_seconds": round(time.monotonic() - started)}


class ParcelIndex:
    """Read-only handle on one release; safe to share between threads."""

    def __init__(self, path):
        self.path = str(path)
        self.con = duckdb.connect(self.path, read_only=True)
        self.local = threading.local()

    def cursor(self):
        cursor = getattr(self.local, "cursor", None)
        if cursor is None:
            cursor = self.local.cursor = self.con.cursor()
        return cursor

    def rows(self, pks):
        cursor = self.cursor()
        found = []
        for pk in pks:
            found += cursor.execute(f"SELECT pk, {COLUMNS} FROM parcels WHERE pk = ?", [pk]).fetchall()
        names = ("pk", "id", "number", "region", "region_no", "commune", "unit", "area", "wkb")
        return [dict(zip(names, row, strict=True)) for row in found]

    def by_id(self, parcel_id, limit=60):
        pks = self.cursor().execute("SELECT pk FROM by_id WHERE id_key = upper(?) LIMIT ?",
                                    [parcel_id, limit]).fetchall()
        return self.rows([pk for (pk,) in pks])

    def by_name(self, region, number, limit=60):
        """Parcels with this number inside obręb(s) whose name starts with ``region`` (None = any)."""
        cursor = self.cursor()
        if region:
            pks = cursor.execute(
                "SELECT pk FROM by_name WHERE obreb_key >= lower(?) AND obreb_key < lower(?) || '￿' "
                "AND nr_key = lower(?) LIMIT ?", [region, region, number, limit]).fetchall()
        else:
            pks = cursor.execute("SELECT pk FROM by_name WHERE nr_key = lower(?) LIMIT ?", [number, limit]).fetchall()
        return self.rows([pk for (pk,) in pks])

    def candidates_at(self, x, y, limit=40):
        """Rows whose stored bbox contains the point (x, y given in the file's own axis order)."""
        cursor = self.cursor()
        m = BBOX_MARGIN
        pks = cursor.execute(
            "SELECT pk FROM parcels WHERE xmin <= ? AND xmax >= ? AND ymin <= ? AND ymax >= ? LIMIT ?",
            [x + m, x - m, y + m, y - m, limit]).fetchall()
        return self.rows([pk for (pk,) in pks])

    def close(self):
        self.con.close()
