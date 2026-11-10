#!/usr/bin/env python3
"""Add a hardiness-zone range to each plant in site/data/species.json.

USDA PLANTS gives only a cold limit, and almost every plant here is hardy to zone 3a,
the coldest zone in the lower 48. To show where a plant does not grow well (the gray
on the map), this finds the zones it actually grows in: its wild U.S. records from GBIF,
each looked up on the 2023 USDA hardiness temperature grid.

  zone_range.min = the coldest of: the USDA cold limit, the 3rd percentile of records,
                   and Medora's zone 4a (every plant here grows at the Library)
  zone_range.max = the 97th percentile of records (trims stray and mislocated records)

Needs conus.tif (see README.md) and rasterio.  Run from scripts/zonemap:
    python3 zone_ranges.py
"""
import json
import time
import urllib.request
from pathlib import Path

import numpy as np
import rasterio

HERE = Path(__file__).resolve().parent
DATA = HERE.parent.parent / "site" / "data" / "species.json"
GBIF = "https://api.gbif.org/v1/occurrence/search"
UA = "TRPL-PlantFinder/1.0 (plantfinder.labs.trlibrary.com)"
MAX_RECORDS = 1500
MIN_RECORDS = 25  # fewer than this and the range isn't trustworthy; keep the cold limit only
LIBRARY_ZONE = "4a"  # Medora, ND
NAMES = [f"{i // 2 + 1}{'ab'[i % 2]}" for i in range(26)]


def zone_index(z):
    return (int(z[:-1]) - 1) * 2 + (1 if z.endswith("b") else 0)


def records(key):
    pts = []
    for offset in range(0, MAX_RECORDS, 300):
        url = (f"{GBIF}?taxonKey={key}&country=US&hasCoordinate=true&hasGeospatialIssue=false"
               f"&occurrenceStatus=PRESENT&limit=300&offset={offset}")
        for attempt in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                    d = json.load(r)
                break
            except Exception:  # noqa: BLE001
                time.sleep(3)
        else:
            break
        for o in d.get("results", []):
            if "decimalLongitude" in o and (o.get("coordinateUncertaintyInMeters") or 0) <= 20000:
                pts.append((o["decimalLongitude"], o["decimalLatitude"]))
        if d.get("endOfRecords"):
            break
    return pts


def main():
    species = json.loads(DATA.read_text())
    with rasterio.open(HERE / "conus.tif") as r:
        for sp in species:
            sp.pop("zone_range", None)
            if not sp.get("gbif_key"):
                continue
            pts = records(sp["gbif_key"])
            temps = [v[0] for v in r.sample(pts) if v[0] != r.nodata] if pts else []
            if len(temps) < MIN_RECORDS:
                print(f"{sp['common']}: {len(temps)} records, cold limit only")
                continue
            z = np.clip(np.floor((np.array(temps) / 100.0 + 60) / 5), 0, 25)
            lo, hi = int(np.percentile(z, 3)), int(np.percentile(z, 97))
            if sp.get("hardy_to_zone"):
                lo = min(lo, zone_index(sp["hardy_to_zone"]))
            lo = min(lo, zone_index(LIBRARY_ZONE))  # it grows at the Library, so it handles Medora's winters
            sp["zone_range"] = {"min": NAMES[lo], "max": NAMES[hi], "records": len(temps)}
            print(f"{sp['common']}: zones {NAMES[lo]} to {NAMES[hi]} ({len(temps)} records)")
    DATA.write_text(json.dumps(species, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
