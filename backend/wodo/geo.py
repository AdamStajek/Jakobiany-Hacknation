import os
import re

from pyproj import Transformer
from shapely import from_wkb, from_wkt, get_srid, make_valid, transform
from shapely.errors import GEOSException
from shapely.geometry import Point, box, mapping, shape

from wodo import parcels_data
from wodo.store import ULDK, SourceError, cached, fetch

PL = box(13.98, 48.98, 24.3, 55.1)
TO_PL = Transformer.from_crs(4326, 2180, always_xy=True).transform
TO_GPS = Transformer.from_crs(2180, 4326, always_xy=True).transform
PARCEL_ID = re.compile(r"\d{6}_[1-9]\.\d{4}\.(?:AR_\d+\.)?\d+(?:/\d+)?\.?", re.IGNORECASE)
PARCEL_NAME = re.compile(r"(?:\d{1,8}(?:/\d{1,8})?|[\wĄĆĘŁŃÓŚŹŻąćęłńóśźż -]{2,65}[\s.]\d{1,8}(?:/\d{1,8})?)")


def validate_geometry(geom):
    if not isinstance(geom, dict) or geom.get("type") not in ("Polygon", "MultiPolygon"):
        raise ValueError("Wybierz GeoJSON typu Polygon lub MultiPolygon.")
    try:
        polygon = shape(geom)
    except (ValueError, TypeError, IndexError, KeyError, GEOSException) as error:
        raise ValueError("Układ współrzędnych lub pierścieni jest niepoprawny.") from error
    if (not polygon.is_valid or polygon.is_empty or polygon.has_z or not PL.covers(polygon)
            or sum(len(p.exterior.coords) + sum(map(len, p.interiors))
                   for p in (polygon.geoms if polygon.geom_type == "MultiPolygon" else [polygon])) > 20_000):
        raise ValueError("Granica jest niepoprawna lub leży poza zasięgiem Polski.")
    local = transform(polygon, TO_PL, interleaved=False)
    if not 1 <= local.area <= 20_000_000 or any(
        hi - lo > 12_000 for lo, hi in zip(local.bounds[:2], local.bounds[2:], strict=True)
    ):
        raise ValueError("Analiza przyjmuje działki od 1 m² do 2000 ha o rozpiętości do 12 km.")
    center = polygon.centroid
    point = polygon.representative_point()
    return {"geometry": mapping(polygon), "bbox": polygon.bounds, "centroid": [center.x, center.y],
            "sample_point": [point.x, point.y], "area_ha": round(local.area / 10000, 5)}


def imported(geojson):
    if geojson.get("crs"):
        raise ValueError("GeoJSON musi używać współrzędnych WGS 84 (długość, szerokość).")
    geom = geojson.get("geometry") if geojson.get("type") == "Feature" else geojson
    return {**validate_geometry(geom), "id": "Działka z GeoJSON", "source": "Import użytkownika",
            "commune": None, "region": None, "land_use_declared": True}


def parse_row(row):
    parcel_id, encoded, *labels = row.split("|")
    try:
        if encoded.startswith("SRID="):
            srid, encoded = encoded.split(";", 1)
            epsg = int(srid[5:])
            geom = from_wkt(encoded)
        elif re.fullmatch(r"[0-9a-fA-F]+", encoded):
            geom = from_wkb(bytes.fromhex(encoded))
            epsg = get_srid(geom) or 4326
        else:
            epsg, geom = 4326, from_wkt(encoded)
        if epsg == 2180:
            geom = transform(geom, TO_GPS, interleaved=False)
        elif epsg != 4326:
            raise ValueError("Nieobsługiwany układ współrzędnych.")
        parcel = validate_geometry(mapping(geom))
    except (ValueError, TypeError, RuntimeError, GEOSException) as error:
        raise SourceError("ULDK zwrócił niepoprawną lub nieobsługiwaną geometrię.") from error
    commune, region = (labels + [None, None])[:2]
    return {**parcel, "id": parcel_id, "source": "GUGiK / ULDK", "commune": commune, "region": region}


def parse_reply(raw):
    rows = raw.decode("utf-8-sig", errors="replace").strip().splitlines()
    if not rows:
        raise SourceError("ULDK zwrócił pustą odpowiedź.")
    if rows[0].startswith("-1"):
        if any(word in rows[0].lower() for word in ("not found", "no parcel", "nie znaleziono", "brak", "0 wynik")):
            return []
        raise SourceError("ULDK nie mógł pobrać geometrii od dostawcy ewidencji.")
    if not re.fullmatch(r"\d+", rows[0]):
        raise SourceError("ULDK zwrócił nieoczekiwany format.")
    parcels = []
    for row in rows[1:61]:
        if "|" not in row:
            continue
        try:
            parcels.append(parse_row(row))
        except SourceError:
            continue
    if not parcels and len(rows) > 1:
        raise SourceError("ULDK nie zwrócił prawidłowej geometrii.")
    return parcels


# Measured on the real file (docs/DATA_LIMITATIONS.md): although the CRS metadata declares the
# EPSG:2180 axis order northing/easting, the stored ordinates are (easting, northing) - e.g.
# 301103_2.0001.121 has x=336317, y=475037. pyproj with always_xy expects (easting, northing).
FILE_NORTHING_FIRST = False
TRAILING_NUMBER = re.compile(r"\s*[\s.]\s*(\d{1,8}(?:/\d{1,8})?)$|^(\d{1,8}(?:/\d{1,8})?)$")


def file_to_gps(first, second):
    easting, northing = (second, first) if FILE_NORTHING_FIRST else (first, second)
    return TO_GPS(easting, northing)


def gps_to_file(lon, lat):
    easting, northing = TO_PL(lon, lat)
    return (northing, easting) if FILE_NORTHING_FIRST else (easting, northing)


def source_mode():
    return os.environ.get("WODO_PARCEL_SOURCE", "parquet").strip().lower()


def lookup(query):
    query = query.strip()
    if PARCEL_ID.fullmatch(query):
        operation = "GetParcelById"
    elif PARCEL_NAME.fullmatch(query):
        operation = "GetParcelByIdOrNr"
    else:
        raise ValueError("Podaj identyfikator, np. 141201_1.0001.6509, lub nazwę obrębu i numer.")
    if source_mode() == "uldk":
        return uldk(operation, {"id": query})
    index, meta = parcels_data.open_index()
    if operation == "GetParcelById":
        rows = index.by_id(query)
    else:
        found = TRAILING_NUMBER.search(query)
        region = query[:found.start()].strip(" .") if found.group(1) else ""
        rows = index.by_name(region or None, found.group(1) or found.group(2))
    return from_rows(rows, meta)


def by_point(lon, lat):
    if not PL.covers(Point(lon, lat)):
        raise ValueError("Wskaż punkt na terenie Polski.")
    if source_mode() == "uldk":
        x, y = TO_PL(lon, lat)
        return uldk("GetParcelByXY", {"xy": f"{x:.2f},{y:.2f}"})
    index, meta = parcels_data.open_index()
    first, second = gps_to_file(lon, lat)
    point = Point(first, second)
    hits = [row for row in index.candidates_at(first, second) if from_wkb(row["wkb"]).covers(point)]
    return from_rows(hits[:1], meta)


def from_rows(rows, meta):
    """Convert index rows (EPSG:2180, file axes) to the API parcel shape in WGS 84."""
    parcels, error = [], None
    for row in rows:
        try:
            geom = from_wkb(row["wkb"])
            if not geom.is_valid:
                geom = make_valid(geom)
            if geom.geom_type == "GeometryCollection":
                polygons = [g for g in geom.geoms if g.geom_type in ("Polygon", "MultiPolygon")]
                geom = max(polygons, key=lambda g: g.area)
            geom = transform(geom, file_to_gps, interleaved=False)
            parcel = validate_geometry(mapping(geom))
        except (ValueError, TypeError, GEOSException) as problem:
            error = error or problem
            continue
        parcels.append({**parcel, "id": row["id"], "source": meta["source"], "commune": row["commune"],
                        "region": row["region"], "retrieved_at": meta["downloaded_at"],
                        "source_url": meta["source_url"]})
    if rows and not parcels:
        raise ValueError(str(error) if error else "Geometria działki jest niepoprawna.")
    return parcels


def uldk(operation, filters):
    params = {"request": operation, "result": "id,geom_wkt,commune,region", "srid": 4326, **filters}

    def download():
        raw = fetch(ULDK, params, timeout=6, limit=2_000_000)
        return {"parcels": parse_reply(raw)}

    result = cached("uldk", params, 7, download)
    return [{**parcel, "retrieved_at": result["retrieved_at"], "source_url": ULDK} for parcel in result["parcels"]]
