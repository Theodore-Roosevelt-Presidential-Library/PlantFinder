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
