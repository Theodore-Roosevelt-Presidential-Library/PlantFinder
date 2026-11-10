#!/usr/bin/env python3
"""Fill in photos for plants that have fewer than three field photos, without a full rebuild.

Uses the same sources and license rules as build_species.py (iNaturalist CC0 first, then
CC BY 4.0 as a last resort), and the inat_name overrides for plants iNaturalist files under
a different scientific name. Then run download_images.py to fetch and size the new images.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_species as b  # noqa: E402

species = json.loads((b.OUT / "species.json").read_text())
overrides = json.loads(b.OVERRIDES.read_text())
for sp in species:
    photos = [i for i in sp["images"] if i["kind"] == "photo"]
    if len(photos) >= 3:
        continue
    name = overrides.get(sp["symbol"], {}).get("inat_name") or sp["scientific"]
    tx = b.inat_taxon(name)
    if not tx:
        print(f"{sp['common']}: no iNaturalist match for {name}")
        continue
    sp["inat_id"] = tx["id"]
    new = b.inat_cc0_photos(tx["id"])
    if len(new) < 3:
        new += b.inat_cc0_photos(tx["id"], n=4 - len(new), license="cc-by")
    have = {i["url"] for i in sp["images"]}
    added = [i for i in new if i["url"] not in have]
    ills = [i for i in sp["images"] if i["kind"] == "illustration"]
    # field photos in bloom first, then other photos, then the illustration
    sp["images"] = sorted(added, key=lambda i: 0 if i.get("in_bloom") else 1) + photos + ills
    sp["inat_nearby"] = b.inat_nearby_count(tx["id"])
    print(f"{sp['common']}: +{len(added)} photos ({', '.join(sorted({i['license'] for i in added})) or 'none'})")
(b.OUT / "species.json").write_text(json.dumps(species, indent=1, ensure_ascii=False))
