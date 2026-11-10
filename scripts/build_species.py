#!/usr/bin/env python3
"""Build site/data/species.json and site/data/plantings.json from data/source/plantings.json.

Every species listed in the landscape specs and planting schedules is resolved to its
accepted USDA PLANTS name, then enriched from public sources:

  USDA PLANTS (plantsservices.sc.egov.usda.gov)   taxonomy, traits, public-domain images
  iNaturalist (api.inaturalist.org)                CC0 photos, flowering months near Medora
  NPSpecies (irmaservices.nps.gov)                 presence in Theodore Roosevelt National Park
  GBIF (api.gbif.org)                              taxon key for occurrence maps

Standard library only. Responses are cached in .cache/ so reruns are fast and polite.
Run:  python3 scripts/build_species.py
"""
import hashlib
import html
import json
import math
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "source" / "plantings.json"
OVERRIDES = ROOT / "data" / "source" / "overrides.json"
OUT = ROOT / "site" / "data"
CACHE = ROOT / ".cache"
USDA = "https://plantsservices.sc.egov.usda.gov/api"
USDA_WEB = "https://plants.usda.gov"
INAT = "https://api.inaturalist.org/v1"
MEDORA = (46.9139, -103.5244)
UA = "TRPL-PlantFinder/1.0 (plantfinder.labs.trlibrary.com)"

_last_inat = 0.0


def fetch(url, kind="json", inat=False):
    CACHE.mkdir(exist_ok=True)
    key = CACHE / (hashlib.sha1(url.encode()).hexdigest() + "." + kind)
    if key.exists():
        text = key.read_text()
    else:
        global _last_inat
        if inat:  # iNaturalist asks for about one request per second
            wait = 1.05 - (time.time() - _last_inat)
            if wait > 0:
                time.sleep(wait)
            _last_inat = time.time()
        for attempt in range(4):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=60) as r:
                    text = r.read().decode("utf-8")
                break
            except Exception as e:  # noqa: BLE001
                if attempt == 3:
                    print(f"  ! {url}: {e}", file=sys.stderr)
                    return None
                time.sleep(2 * (attempt + 1))
        key.write_text(text)
    if kind == "json":
        try:
            return json.loads(text) if text.strip() else None
        except json.JSONDecodeError:
            return None
    return text


def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def title_case(name):
    small = {"and", "of", "the", "or"}
    out = []
    for i, w in enumerate(name.split(" ")):
        parts = w.split("-")
        parts = [p.lower() if (p.lower() in small and (i or j)) else (p[:1].upper() + p[1:]) for j, p in enumerate(parts)]
        out.append("-".join(parts))
    return " ".join(out)


# ---------- USDA PLANTS ----------

def usda_resolve(name):
    """Return (accepted profile, characteristics, images, note) for a scientific name."""
    q = urllib.parse.quote(name)
    hits = fetch(f"{USDA}/PlantSearch?searchText={q}") or []
    target = None
    for h in hits:
        p = h.get("Plant") or {}
        sci = strip_tags(p.get("ScientificName"))
        if sci.lower().startswith(name.lower() + " ") or sci.lower() == name.lower():
            if p.get("Rank") == "Species":
                target = p
                break
            target = target or p
    if not target and hits:
        target = hits[0].get("Plant")
    if not target:
        return None, [], [], f"No USDA PLANTS match for {name}"
    # PlantProfile redirects a synonym to its accepted name.
    prof = fetch(f"{USDA}/PlantProfile?symbol={target['Symbol']}")
    if not prof:
        return None, [], [], f"USDA profile missing for {name}"
    note = None
    if prof["Symbol"] != target["Symbol"]:
        note = (f"Listed in the spec as {name}; USDA PLANTS accepts "
                f"{strip_tags(prof['ScientificName'])}")
    # Show plants at species level: roll a subspecies or variety up to its species.
    if prof.get("Rank") in ("Subspecies", "Variety"):
        binomial = " ".join(strip_tags(prof["ScientificName"]).split()[:2])
        for h in fetch(f"{USDA}/PlantSearch?searchText={urllib.parse.quote(binomial)}") or []:
            p = h.get("Plant") or {}
            if p.get("Rank") == "Species" and strip_tags(p.get("ScientificName")).startswith(binomial + " "):
                sp = fetch(f"{USDA}/PlantProfile?symbol={p['Symbol']}")
                if sp:
                    prof = sp
                break
    chars = fetch(f"{USDA}/PlantCharacteristics/{prof['Id']}") or []
    imgs = fetch(f"{USDA}/PlantImages?plantId={prof['Id']}") or []
    return prof, chars, imgs, note


def family_of(prof):
    for a in prof.get("Ancestors") or []:
        if a.get("Rank") == "Family":
            return strip_tags(a["ScientificName"]).split()[0], a.get("CommonName")
    return None, None


TRAIT_KEYS = {
    "Flower Color": "flower_color",
    "Flower Conspicuous": "flower_showy",
    "Bloom Period": "bloom_period",
    "Height, Mature (feet)": "height_ft",
    "Drought Tolerance": "drought_tolerance",
    "Shade Tolerance": "shade_tolerance",
    "Moisture Use": "moisture_use",
    "Temperature, Minimum (°F)": "min_temp_f",
    "Growth Rate": "growth_rate",
    "Growth Form": "growth_form",
    "Lifespan": "lifespan",
    "Foliage Color": "foliage_color",
    "Fall Conspicuous": "fall_color",
    "Fruit/Seed Color": "fruit_color",
    "Fruit/Seed Conspicuous": "fruit_showy",
    "Fire Tolerance": "fire_tolerance",
    "Salinity Tolerance": "salinity_tolerance",
    "Adapted to Coarse Textured Soils": "soil_coarse",
    "Adapted to Medium Textured Soils": "soil_medium",
    "Adapted to Fine Textured Soils": "soil_fine",
    "Precipitation, Minimum": "precip_min_in",
    "Precipitation, Maximum": "precip_max_in",
    "Palatable Browse Animal": "browse_palatable",
    "Palatable Graze Animal": "graze_palatable",
    "Nitrogen Fixation": "nitrogen_fixation",
    "Toxicity": "toxicity",
    "Commercial Availability": "commercial_availability",
    "Berry/Nut/Seed Product": "berry_product",
    "Palatable Human": "palatable_human",
}


def traits_of(chars):
    t = {}
    for c in chars:
        if c.get("CultivarName"):
            continue
        k = TRAIT_KEYS.get(c["PlantCharacteristicName"])
        if k and k not in t:
            v = c["PlantCharacteristicValue"]
            if k in ("height_ft", "min_temp_f", "precip_min_in", "precip_max_in"):
                try:
                    v = float(v)
                except ValueError:
                    continue
                if k == "min_temp_f" and v > 20:  # not a winter cold limit; USDA data error
                    continue
            t[k] = v
    return t


def zone_for_temp(f):
    """USDA hardiness zone for an average annual extreme minimum temperature (F)."""
    if f is None:
        return None
    z = math.floor((f + 60) / 10) + 1
    half = "a" if ((f + 60) % 10) < 5 else "b"
    z = max(1, min(13, z))
    return f"{z}{half}"


def usda_images(imgs):
    """Public-domain USDA images only (Copyright == false)."""
    out = []
    for i in imgs:
        if i.get("Copyright"):
            continue
        lit = i.get("LiteratureTitle")
        is_ill = bool(lit) or (i.get("StandardSizeImageLibraryPath") or "").endswith("d.jpg")
        credit = i.get("CommonName") or "USDA-NRCS PLANTS Database"
        if lit:
            credit = f"{credit}. {lit}. {i.get('LiteratureYear') or ''}".strip()
        best = i.get("OriginalSizeImageLibraryPath") or i.get("LargeSizeImageLibraryPath") or i["StandardSizeImageLibraryPath"]
        out.append({
            "kind": "illustration" if is_ill else "photo",
            "url": USDA_WEB + best,
            "fallback": USDA_WEB + (i.get("LargeSizeImageLibraryPath") or i["StandardSizeImageLibraryPath"]),
            "credit": credit.rstrip(". "),
            "provider": i.get("ProvidedBy") or i.get("InstitutionName"),
            "license": "Public domain",
            "source": "USDA-NRCS PLANTS Database",
            "location": i.get("ImageLocation"),
        })
    return out


# ---------- iNaturalist ----------

def inat_taxon(name):
    q = urllib.parse.quote(name)
    d = fetch(f"{INAT}/taxa?q={q}&rank=species,variety,subspecies&per_page=5", inat=True)
    for r in (d or {}).get("results", []):
        if r["name"].lower() == name.lower():
            return r
    d = fetch(f"{INAT}/taxa?q={q}&per_page=5", inat=True)
    for r in (d or {}).get("results", []):
        if r["name"].lower().startswith(name.lower()):
            return r
    return None


def inat_flowering(taxon_id, radius=400):
    """Observations annotated 'Flowering' by month, within `radius` km of Medora (None = anywhere)."""
    lat, lng = MEDORA
    where = f"&lat={lat}&lng={lng}&radius={radius}" if radius else "&place_id=1"
    url = (f"{INAT}/observations/histogram?taxon_id={taxon_id}&interval=month_of_year"
           f"&term_id=12&term_value_id=13{where}&verifiable=true")
    d = fetch(url, inat=True)
    hist = ((d or {}).get("results") or {}).get("month_of_year") or {}
    counts = [int(hist.get(str(m), 0)) for m in range(1, 13)]
    return counts


def inat_nearby_count(taxon_id):
    lat, lng = MEDORA
    d = fetch(f"{INAT}/observations?taxon_id={taxon_id}&lat={lat}&lng={lng}&radius=150"
              f"&verifiable=true&per_page=0", inat=True)
    return (d or {}).get("total_results", 0)


LICENSES = {
    "cc0": ("CC0", "no rights reserved (CC0)", "https://creativecommons.org/publicdomain/zero/1.0/"),
    # iNaturalist's CC BY licenses are version 4.0; the Library allows CC BY 4.0 only as a
    # fallback, with the license linked in the caption.
    "cc-by": ("CC BY 4.0", "CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"),
}


def inat_cc0_photos(taxon_id, n=6, license="cc0"):
    """Research-grade photos under one license, flowering ones first, nearest to Medora first."""
    lat, lng = MEDORA
    photos, seen = [], set()
    flowering = "&term_id=12&term_value_id=13"
    passes = [
        (flowering + f"&lat={lat}&lng={lng}&radius=900", True),
        (flowering, True),
        (f"&lat={lat}&lng={lng}&radius=900", False),
        ("", False),
    ]
    for extra, in_bloom in passes:
        d = fetch(f"{INAT}/observations?taxon_id={taxon_id}&photo_license={license}&quality_grade=research"
                  f"&order_by=votes&per_page=20{extra}", inat=True)
        for o in (d or {}).get("results", []):
            for p in o.get("photos", [])[:1]:  # first photo of an observation is usually the best
                if p.get("license_code") != license or p["id"] in seen:
                    continue
                dims = p.get("original_dimensions") or {}
                if dims and min(dims.get("width", 0), dims.get("height", 0)) < 700:
                    continue
                seen.add(p["id"])
                user = o.get("user") or {}
                who = user.get("name") or user.get("login") or "iNaturalist observer"
                photos.append({
                    "kind": "photo",
                    "in_bloom": in_bloom,
                    "url": p["url"].replace("square", "original"),
                    "fallback": p["url"].replace("square", "large"),
                    "credit": f"{who}, {LICENSES[license][1]}",
                    "license": LICENSES[license][0],
                    "license_url": LICENSES[license][2],
                    "source": "iNaturalist",
                    "source_url": f"https://www.inaturalist.org/observations/{o['id']}",
                    "location": o.get("place_guess"),
                })
                if len(photos) >= n:
                    return photos
    return photos


# ---------- NPS and GBIF ----------

def thro_names():
    xml = fetch("https://irmaservices.nps.gov/v3/rest/npspecies/checklist/THRO/Vascular%20Plant", kind="xml") or ""
    names = set()
    for m in re.finditer(r"<ScientificName>([^<]+)</ScientificName>", xml):
        parts = m.group(1).split()
        if len(parts) >= 2:
            names.add(" ".join(parts[:2]).lower())
    for m in re.finditer(r"<Synonyms>([^<]*)</Synonyms>", xml):
        for s in m.group(1).split(","):
            parts = s.strip().split()
            if len(parts) >= 2:
                names.add(" ".join(parts[:2]).lower())
    return names


def gbif_key(name):
    d = fetch(f"https://api.gbif.org/v1/species/match?name={urllib.parse.quote(name)}&kingdom=Plantae")
    if d and d.get("matchType") in ("EXACT", "FUZZY") and d.get("rank") in ("SPECIES", "VARIETY", "SUBSPECIES"):
        return d.get("acceptedUsageKey") or d.get("usageKey")
    return None


# ---------- classification ----------

def plant_type(fam, habits, sci):
    habits = [h.lower() for h in habits or []]
    if fam == "Poaceae" or (sci.split()[0] in ("Hesperostipa", "Nassella", "Piptatheropsis")):
        return "grass"
    if fam in ("Cyperaceae", "Juncaceae"):
        return "sedge"
    if fam == "Cactaceae" or sci.startswith("Yucca"):
        return "cactus-yucca"
    if "graminoid" in habits:
        return "grass"
    if "forb/herb" in habits:
        return "wildflower"  # some forbs are also listed as subshrubs; show them as wildflowers
    if any("tree" in h or "shrub" in h for h in habits):
        return "shrub"
    return "wildflower"


def months_from_hist(h):
    peak = max(h)
    return [i + 1 for i, c in enumerate(h) if c >= max(1, peak * 0.15)]


def bloom_months(period, flowering, wider=None, national=None):
    if sum(flowering) >= 8:
        return months_from_hist(flowering), "inat"
    if wider and sum(wider) >= 8:
        return months_from_hist(wider), "inat-region"
    table = {
        "early spring": [3, 4], "mid spring": [4, 5], "late spring": [5, 6],
        "spring": [4, 5, 6], "early summer": [6], "mid summer": [7], "late summer": [8],
        "summer": [6, 7, 8], "fall": [9], "late fall": [10], "winter": [], "indeterminate": [],
    }
    months = table.get((period or "").lower())
    if months:
        if len(months) == 1:  # USDA names a single period; widen by a month either side
            m = months[0]
            months = [x for x in (m - 1, m, m + 1) if 1 <= x <= 12]
        return months, "usda"
    if national and sum(national) >= 8:
        return months_from_hist(national), "inat-us"
    return [], None


def main():
    src = json.loads(SRC.read_text())
    overrides = json.loads(OVERRIDES.read_text()) if OVERRIDES.exists() else {}
    park = thro_names()
    species = {}
    by_source_name = {}
    names = []
    for area in src["areas"]:
        for s in area["species"]:
            if s["name"] not in names:
                names.append(s["name"])

    for n, name in enumerate(names, 1):
        print(f"[{n}/{len(names)}] {name}")
        prof, chars, imgs, note = usda_resolve(name)
        if not prof:
            print(f"  ! {note}")
            continue
        sym = prof["Symbol"]
        by_source_name[name] = sym
        if sym in species:
            if note:
                species[sym]["name_notes"].append(note)
            continue
        sci_full = strip_tags(prof["ScientificName"])
        parts = sci_full.split()
        sci = " ".join(parts[:2]) if len(parts) > 1 else sci_full
        if len(parts) > 3 and parts[2] in ("var.", "ssp."):
            sci = " ".join(parts[:4])
        fam, fam_common = family_of(prof)
        t = traits_of(chars)
        inat_name = overrides.get(sym, {}).get("inat_name")  # where iNaturalist uses a different name
        tx = (inat_name and inat_taxon(inat_name)) or inat_taxon(sci) or inat_taxon(name)
        flowering = inat_flowering(tx["id"]) if tx else [0] * 12
        wider = national = None
        if tx and sum(flowering) < 8:
            wider = inat_flowering(tx["id"], radius=900)
            if sum(wider) < 8 and not t.get("bloom_period"):
                national = inat_flowering(tx["id"], radius=None)
        months, msrc = bloom_months(t.get("bloom_period"), flowering, wider, national)
        images = usda_images(imgs)
        if tx:
            cc0 = inat_cc0_photos(tx["id"])
            images += cc0
            if len(cc0) < 3:  # last resort: CC BY 4.0, credited with a linked license
                images += inat_cc0_photos(tx["id"], n=4 - len(cc0), license="cc-by")
        common = title_case(prof.get("CommonName") or sci)
        rec = {
            "slug": slugify(sci),
            "symbol": sym,
            "scientific": sci,
            "scientific_full": sci_full,
            "common": common,
            "other_common": [title_case(c) for c in (prof.get("OtherCommonNames") or [])],
            "family": fam,
            "family_common": fam_common,
            "group": prof.get("Group"),
            "duration": prof.get("Durations") or [],
            "growth_habit": prof.get("GrowthHabits") or [],
            "type": plant_type(fam, prof.get("GrowthHabits"), sci),
            "native": [f"{x['Region']}" for x in prof.get("NativeStatuses") or [] if x.get("Status") == "N"],
            "traits": t,
            "hardy_to_zone": zone_for_temp(t.get("min_temp_f")),
            "bloom_months": months,
            "bloom_source": msrc,
            "flowering_obs": flowering,
            "in_park": sci.lower() in park or name.lower() in park,
            "inat_id": tx["id"] if tx else None,
            "inat_nearby": inat_nearby_count(tx["id"]) if tx else 0,
            "gbif_key": gbif_key(sci),
            "usda_url": f"{USDA_WEB}/plant-profile/{sym}",
            "plant_guide": (USDA_WEB + prof["PlantGuideUrls"][0]) if prof.get("PlantGuideUrls") else None,
            "fact_sheet": (USDA_WEB + prof["FactSheetUrls"][0]) if prof.get("FactSheetUrls") else None,
            "images": images,
            "name_notes": [note] if note else [],
            "spec_labels": [],
            "areas": [],
        }
        species[sym] = rec

    # Planting membership, labels used by the team, schedule quantities
    areas_out = []
    for area in src["areas"]:
        members = []
        for s in area["species"]:
            sym = by_source_name.get(s["name"])
            if not sym:
                continue
            rec = species[sym]
            if s["label"] and s["label"].lower() not in [x.lower() for x in rec["spec_labels"]]:
                rec["spec_labels"].append(s["label"])
            entry = {"area": area["id"]}
            if s.get("qty"):
                entry["qty"] = s["qty"]
            if s.get("spacing_in"):
                entry["spacing_in"] = s["spacing_in"]
                rec.setdefault("spacing_in", s["spacing_in"])
            rec["areas"].append(entry)
            members.append({"symbol": sym, "qty": s.get("qty")})
        a = {k: v for k, v in area.items() if k != "species"}
        a["members"] = members
        areas_out.append(a)

    # Show the name the Library's plans use (schedules first); USDA's name becomes "also called".
    for rec in species.values():
        if rec["spec_labels"]:
            usda = rec["common"]
            rec["common"] = title_case(rec["spec_labels"][0].replace("'S", "'s"))
            if usda.lower() != rec["common"].lower() and usda not in rec["other_common"]:
                rec["other_common"].insert(0, usda)

    # Team overrides (common name choices, notes) win over anything pulled in
    for sym, ov in overrides.items():
        if sym in species:
            species[sym].update(ov)

    # Order images: field photos in bloom first, then other field photos, then the
    # botanical illustration, then USDA seed and specimen close-ups.
    for rec in species.values():
        def rank(i):
            specimen = "Systematic Botany" in (i.get("provider") or "") or "Hurst" in i["credit"]
            if i["kind"] == "illustration":
                return 3
            if specimen:
                return 4
            if i.get("in_bloom"):
                return 0
            return 1 if i["source"] == "iNaturalist" else 2
        imgs = sorted(rec["images"], key=rank)
        ills = [i for i in imgs if i["kind"] == "illustration"][:1]
        photos = [i for i in imgs if i["kind"] == "photo"][:6]
        rec["images"] = sorted(photos + ills, key=rank)

    OUT.mkdir(parents=True, exist_ok=True)
    out = sorted(species.values(), key=lambda r: r["common"])
    (OUT / "species.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    (OUT / "plantings.json").write_text(json.dumps(areas_out, indent=1, ensure_ascii=False))
    print(f"\n{len(out)} species, {len(areas_out)} planting areas -> {OUT}")


if __name__ == "__main__":
    main()
