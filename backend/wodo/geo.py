import re

from pyproj import Transformer
from shapely import from_wkb, from_wkt, get_srid, transform
from shapely.errors import GEOSException
from shapely.geometry import Point, box, mapping, shape

from wodo.store import ULDK, SourceError, cached, fetch

PL = box(13.98, 48.98, 24.3, 55.1)
TO_PL = Transformer.from_crs(4326, 2180, always_xy=True).transform
TO_GPS = Transformer.from_crs(2180, 4326, always_xy=True).transform
PARCEL_ID = re.compile(r"\d{6}_[1-9]\.\d{4}\.(?:AR_\d+\.)?\d+(?:/\d+)?", re.IGNORECASE)
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


def lookup(query):
    query = query.strip()
    if PARCEL_ID.fullmatch(query):
        operation = "GetParcelById"
    elif PARCEL_NAME.fullmatch(query):
        operation = "GetParcelByIdOrNr"
    else:
        raise ValueError("Podaj identyfikator, np. 141201_1.0001.6509, lub nazwę obrębu i numer.")
    return uldk(operation, {"id": query})


def by_point(lon, lat):
    if not PL.covers(Point(lon, lat)):
        raise ValueError("Wskaż punkt na terenie Polski.")
    x, y = TO_PL(lon, lat)
    return uldk("GetParcelByXY", {"xy": f"{x:.2f},{y:.2f}"})


def uldk(operation, filters):
    params = {"request": operation, "result": "id,geom_wkt,commune,region", "srid": 4326, **filters}

    def download():
        raw = fetch(ULDK, params, timeout=6, limit=2_000_000)
        return {"parcels": parse_reply(raw)}

    result = cached("uldk", params, 7, download)
    return [{**parcel, "retrieved_at": result["retrieved_at"], "source_url": ULDK} for parcel in result["parcels"]]
