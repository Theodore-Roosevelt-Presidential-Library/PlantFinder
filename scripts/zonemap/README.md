# Hardiness zone map

Builds `site/data/zonemap.svg`: one SVG layer per half zone (`<g id="zone-4a" class="zone">`),
plus state lines and a pin layer. The site switches layers on per plant with CSS classes.

Source: 2023 USDA Plant Hardiness Zone Map mean annual extreme low temperature raster
(PRISM Climate Group, Oregon State University, for USDA-ARS), from USDA's Ag Data Commons
(CC BY 4.0): https://agdatacommons.nal.usda.gov/articles/dataset/25343293

The map is simplified and restyled, so the site labels it as not the official USDA map,
as the PRISM terms require, and carries no USDA or OSU logos.

```bash
cd scripts/zonemap
curl -L -o conus.tif https://ndownloader.figshare.com/files/44868940
python3 -m venv .venv && source .venv/bin/activate && pip install rasterio shapely
python3 zones.py          # classify into half zones, trace outlines -> zones.geojson
npm install && node build.mjs   # project (Albers, same layout as us-atlas) -> site/data/zonemap.svg
```

## Zone ranges per plant

`zone_ranges.py` adds `zone_range` (`min`, `max`) to each plant in `site/data/species.json`.
USDA PLANTS records only a cold limit, and nearly every plant here is hardy to the coldest
zone in the lower 48, so the cold limit alone paints the whole map. The range uses each
plant's wild U.S. records from GBIF, looked up on the 2023 temperature grid: the warm end
is the 97th percentile of those zones; the cold end is the coldest of the USDA limit, the
3rd percentile, and Medora's 4a (every plant here grows at the Library). Zones outside the
range are gray on the map.
