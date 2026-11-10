#!/usr/bin/env python3
"""Download each plant's images into site/img/<slug>/ and point species.json at the local copies.

Images are served from the site itself so the offline field guide works and pages don't
depend on outside image hosts. Only public-domain and CC0 images are listed by
build_species.py, and each keeps its credit and license.
Run after build_species.py:  python3 scripts/download_images.py
"""
import hashlib
import json
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
DATA = SITE / "data" / "species.json"
UA = "TRPL-PlantFinder/1.0 (plantfinder.labs.trlibrary.com)"


def get(url, dest):
    if dest.exists() and dest.stat().st_size > 1000:
        return True
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read()
            if len(body) < 1000:
                return False
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(body)
            if "inaturalist" in url:
                time.sleep(0.5)
            return True
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                print(f"  ! {url}: {e}")
            time.sleep(2)
    return False


def main():
    species = json.loads(DATA.read_text())
    n = 0
    for sp in species:
        kept = []
        for img in sp["images"]:
            name = hashlib.sha1(img["url"].encode()).hexdigest()[:12] + ".jpg"
            dest = SITE / "img" / sp["slug"] / name
            if get(img["url"], dest):
                img["src"] = f"img/{sp['slug']}/{name}"
                kept.append(img)
                n += 1
        sp["images"] = kept
        print(f"{sp['common']}: {len(kept)} images")
    DATA.write_text(json.dumps(species, indent=1, ensure_ascii=False))
    print(f"\n{n} images saved under site/img/")


if __name__ == "__main__":
    main()
