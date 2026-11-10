#!/usr/bin/env python3
"""Download each plant's images into site/img/<slug>/ and point species.json at the local copies.

Fetches the full-size original, falls back to the large size, resizes to at most 1600 px
on the long edge (with a 520 px thumbnail for cards), and drops anything too small to look sharp (under 600 px on its short
side). Images are served from the site itself so the offline field guide works.
Only public-domain and CC0 images are listed by build_species.py; each keeps its credit.
Needs Pillow:  python3 -m pip install pillow
Run after build_species.py:  python3 scripts/download_images.py
"""
import hashlib
import io
import json
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
DATA = SITE / "data" / "species.json"
UA = "TRPL-PlantFinder/1.0 (plantfinder.labs.trlibrary.com)"
MAX_EDGE = 1400
THUMB_EDGE = 520
MIN_SHORT = 600


def fetch(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if attempt == 2:
                print(f"  ! {url}: {e}")
            time.sleep(2)
    return None


def save(img_rec, dest):
    """Returns (width, height) of the saved file, or None if unusable."""
    if dest.exists():
        with Image.open(dest) as im:
            if max(im.size) > MAX_EDGE:  # shrink files saved at an earlier, larger size
                im = im.convert("RGB")
                im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
                im.save(dest, "JPEG", quality=80, optimize=True, progressive=True)
            return im.size
    for url in (img_rec["url"], img_rec.get("fallback")):
        if not url:
            continue
        body = fetch(url)
        if not body:
            continue
        try:
            im = Image.open(io.BytesIO(body))
            im.load()
        except Exception:  # noqa: BLE001
            continue
        if min(im.size) < MIN_SHORT:
            continue
        im = im.convert("RGB")
        im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, "JPEG", quality=80, optimize=True, progressive=True)
        if "inaturalist" in url:
            time.sleep(0.5)
        return im.size
    return None


def main():
    species = json.loads(DATA.read_text())
    n = dropped = 0
    for sp in species:
        kept = []
        for img in sp["images"]:
            name = hashlib.sha1(img["url"].encode()).hexdigest()[:12] + ".jpg"
            size = save(img, SITE / "img" / sp["slug"] / name)
            if size:
                thumb = SITE / "img" / sp["slug"] / name.replace(".jpg", "-t.jpg")
                if not thumb.exists():
                    with Image.open(SITE / "img" / sp["slug"] / name) as im:
                        im = im.convert("RGB")
                        im.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.LANCZOS)
                        im.save(thumb, "JPEG", quality=78, optimize=True, progressive=True)
                img["thumb"] = f"img/{sp['slug']}/{thumb.name}"
                img["src"] = f"img/{sp['slug']}/{name}"
                img["w"], img["h"] = size
                kept.append(img)
                n += 1
            else:
                dropped += 1
        sp["images"] = kept
        print(f"{sp['common']}: {len(kept)} images")
    DATA.write_text(json.dumps(species, indent=1, ensure_ascii=False))
    print(f"\n{n} images saved under site/img/; {dropped} skipped as too small or unavailable")


if __name__ == "__main__":
    main()
