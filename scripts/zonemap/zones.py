import json, numpy as np, rasterio
from rasterio.enums import Resampling
from rasterio.features import shapes
from shapely.geometry import shape, mapping, MultiPolygon
from shapely.ops import unary_union
F = 3  # ~2.5 km cells: plenty for a page-sized map, keeps the file small
with rasterio.open('conus.tif') as r:
    a = r.read(1, out_shape=(r.height // F, r.width // F), resampling=Resampling.average, masked=True)
    t = r.transform * r.transform.scale(r.width / a.shape[1], r.height / a.shape[0])
temp = a.astype('float32') / 100.0
cls = np.floor((temp + 60) / 5).astype('int16')          # 0 = 1a (-60 to -55 F) ... 25 = 13b
cls = np.where(a.mask, -1, np.clip(cls, 0, 25)).astype('int16')
names = [f"{i//2+1}{'ab'[i%2]}" for i in range(26)]
feats = []
for i in [int(x) for x in sorted(set(np.unique(cls).tolist()) - {-1})]:
    geoms = [shape(g) for g, v in shapes(cls, mask=(cls == i), transform=t) if v == i]
    u = unary_union(geoms).buffer(0.02).buffer(-0.02).simplify(0.04, preserve_topology=True)
    polys = [p for p in (u.geoms if hasattr(u, 'geoms') else [u]) if p.area > 0.03]
    if not polys: continue
    m = MultiPolygon([p for p in polys if p.geom_type == 'Polygon'] + [q for p in polys if p.geom_type == 'MultiPolygon' for q in p.geoms])
    feats.append({"type": "Feature", "properties": {"zone": names[i], "min_f": -60 + 5 * i, "max_f": -55 + 5 * i}, "geometry": mapping(m)})
    print(names[i], len(m.geoms))
json.dump({"type": "FeatureCollection", "features": feats}, open('zones.geojson', 'w'))
