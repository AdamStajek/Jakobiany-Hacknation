"""Parcel statistics from a DEM, with optional basin-wide D8 routing."""

import base64
import heapq
from math import sqrt

import numpy as np
from rasterio.features import shapes
from rasterio.io import MemoryFile
from shapely.geometry import MultiPolygon, shape
from shapely.ops import unary_union

# ESRI D8 codes clockwise from east.
NEIGHBORS = ((0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1), (-1, 0), (-1, 1))


def cog_uri(values, affine):
    with MemoryFile() as file:
        with file.open(driver="COG", height=values.shape[0], width=values.shape[1], count=1,
                       dtype=values.dtype, crs="EPSG:2180", transform=affine, compress="DEFLATE") as dst:
            dst.write(values, 1)
        return "data:image/tiff;base64," + base64.b64encode(file.read()).decode("ascii")


def hydro(z, affine, inside, parcel, *, basin=False):
    height, width = z.shape
    valid = np.isfinite(z)
    seen = ~valid
    levels = z.copy()
    parent = np.full(z.shape, -1, dtype=np.int32)
    queue = []
    order = []
    padded = np.pad(valid, 1)
    interior = valid.copy()
    for dy, dx in NEIGHBORS:
        interior &= padded[1 + dy:1 + dy + height, 1 + dx:1 + dx + width]
    for y, x in zip(*np.where(valid & ~interior), strict=True):
        seen[y, x] = True
        queue.append((z[y, x], y * width + x))
    heapq.heapify(queue)
    while queue:
        level, index = heapq.heappop(queue)
        order.append(index)
        y, x = divmod(index, width)
        for dy, dx in NEIGHBORS:
            yy, xx = y + dy, x + dx
            if 0 <= yy < height and 0 <= xx < width and not seen[yy, xx]:
                seen[yy, xx] = True
                levels[yy, xx] = max(level, z[yy, xx])
                parent[yy, xx] = index
                heapq.heappush(queue, (levels[yy, xx], yy * width + xx))

    depth = levels - z
    wet = (depth >= .25) & inside & valid
    polygons = [shape(g).intersection(parcel) for g, _ in shapes(wet.astype("uint8"), mask=wet, transform=affine)]
    merged = unary_union(polygons)
    cell_area = abs(affine.a * affine.e)
    volume = float(depth[wet].sum() * cell_area)
    # Correct partially covered edge cells so area and volume refer to the same footprint.
    if polygons:
        from rasterio.features import geometry_mask
        from shapely.geometry import box

        edge = geometry_mask([parcel.boundary], z.shape, affine, all_touched=True, invert=True)
        for y, x in zip(*np.where(edge & wet), strict=True):
            left, top = affine * (x, y)
            right, bottom = affine * (x + 1, y + 1)
            fraction_area = parcel.intersection(box(left, bottom, right, top)).area
            volume -= depth[y, x] * (cell_area - fraction_area)
    result = {"potential_depression_area_m2": merged.area,
              "potential_depression_volume_m3": max(0., float(volume)),
              "potential_depression_geometry": MultiPolygon(
                  [merged] if merged.geom_type == "Polygon" else [g for g in merged.geoms if g.geom_type == "Polygon"]
              ).wkt}
    if basin:
        codes = np.zeros(z.shape, dtype=np.uint8)
        accumulation = valid.astype(np.uint32)
        for index in reversed(order):
            y, x = divmod(index, width)
            target = parent[y, x]
            steepest = 0.
            direction = None
            for k, (dy, dx) in enumerate(NEIGHBORS):
                yy, xx = y + dy, x + dx
                if 0 <= yy < height and 0 <= xx < width and valid[yy, xx]:
                    slope = (levels[y, x] - levels[yy, xx]) / (sqrt(2) if dy and dx else 1)
                    if slope > steepest:
                        steepest, target, direction = slope, yy * width + xx, k
            if target >= 0:
                yy, xx = divmod(target, width)
                if direction is None:
                    direction = NEIGHBORS.index((yy - y, xx - x))
                codes[y, x] = 1 << direction
                accumulation[yy, xx] += accumulation[y, x]
        ys, xs = np.where(inside)
        sy, sx = slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1)
        sub_transform = affine * affine.translation(sx.start, sy.start)
        for key, data in (("flow_direction_raster_uri", codes), ("flow_accumulation_raster_uri", accumulation)):
            result[key] = cog_uri(data[sy, sx], sub_transform)
    return result
