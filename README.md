# PlantFinder

A field guide to the native plants and seed mixes at the Theodore Roosevelt Presidential Library.
Live at **https://plantfinder.labs.trlibrary.com**.

- **Plants:** browse and filter every species in the Library's landscape plans by type, flower color, bloom month, planting area, park presence and growing zone.
- **Plant pages:** illustration or photos, bloom ribbon, height next to a 6-foot person, sun, water, cold hardiness, where it grows on campus, a grow-at-home ZIP check, park presence, nearby sightings and a range map.
- **Where they grow:** one page per planting area (gardens, green roofs, stormwater prairie, restored prairie), with its design intent from the spec.
- **Bloom clock:** a 12-month wheel of what flowers when.
- **What is this?** A visual key (type, color, height, month) that runs in the browser. Photo identification turns on when `site/config.js` points to an identification service.
- **Embeds:** web components and iframe views for trlibrary.com. See `site/embed.html` (live at `/embed.html`).
- **Offline:** installable as an app; plant data and viewed images are cached for the field.

## Data

`data/source/plantings.json` is the hand-transcribed source: every planting area from the
landscape spec (section 32 9300 Native Plants) and the planting schedules, with the names
as the plans list them, plus schedule quantities and spacing.

`data/source/overrides.json` (optional) lets the team override any field for a species,
keyed by USDA symbol, for example a preferred common name or a `story` (HTML) that has
been through review:

```json
{ "LIPU": { "common": "Dotted Blazing Star", "story": "<p>…</p>" } }
```

Build the published data, then fetch images:

```bash
python3 -m venv .venv && source .venv/bin/activate   # no packages needed; standard library only
python3 scripts/build_species.py     # writes site/data/species.json and plantings.json
python3 scripts/download_images.py   # saves images to site/img/ and points the data at them
```

Sources: USDA-NRCS PLANTS (names, traits, public-domain images including Britton & Brown 1913
illustrations), iNaturalist (CC0 photos; flowering months from sightings within ~400 km of
Medora), NPSpecies (Theodore Roosevelt National Park checklist), GBIF (range maps),
2023 USDA Plant Hardiness Zone Map via phzmapi.org.

**Image rights:** only public-domain and CC0 images are used. Each image carries its credit,
license and source, shown wherever it appears. Library photos from the Acquia DAM replace
these as they are taken.

## Content rules

- Plant facts come from the sources above, shown with their source.
- Any history or Theodore Roosevelt content goes through HistorianPanel before it is added as a `story`.
- Indigenous plant knowledge is added only through partnership with knowledge holders and the Library's human reviewers.

## Run locally

```bash
cd site && python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy

`.github/workflows/pages.yml` publishes `site/` to GitHub Pages on every push to `main`.
`site/CNAME` sets the custom domain; add a CNAME record for `plantfinder.labs` pointing to
`theodore-roosevelt-presidential-library.github.io`, and set Pages to deploy from GitHub Actions.
