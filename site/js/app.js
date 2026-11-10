import {
  MONTHS, MONTH_NAMES, TYPES, FLOWER, esc, flowerColor, heroImage, imgSrc, bloomRibbon, bloomText,
  silhouette, fmtFeet, sunText, waterText, sunIcon, dropIcon, snowIcon, typeIcon, zoneNum, lookupZone, growVerdict, journalGlance, renderZoneMap, blot,
} from "./viz.js";

const params = new URLSearchParams(location.search);
const EMBED = params.has("embed");
if (EMBED) document.body.classList.add("embed-mode");
function tellParent(msg) {
  if (EMBED && window.parent !== window) window.parent.postMessage({ plantfinder: true, ...msg }, "*");
}
if (EMBED && "ResizeObserver" in window) {
  new ResizeObserver(() => tellParent({ height: document.documentElement.scrollHeight })).observe(document.body);
}

const state = { species: [], bySlug: {}, bySym: {}, areas: [], areaById: {}, filters: loadFilters(), zone: loadZone() };
const $main = document.getElementById("main");
const MEDORA = { lat: 46.9139, lon: -103.5244 };

// --- persistence (per viewer, light conveniences only) ---
function loadFilters() {
  try { return JSON.parse(sessionStorage.getItem("pf-filters")) || {}; } catch { return {}; }
}
function saveFilters() {
  try { sessionStorage.setItem("pf-filters", JSON.stringify(state.filters)); } catch {}
}
function loadZone() {
  try { return JSON.parse(localStorage.getItem("pf-zone")); } catch { return null; }
}
function saveZone(z) {
  state.zone = z;
  try { localStorage.setItem("pf-zone", JSON.stringify(z)); } catch {}
}

async function load() {
  const [sp, ar] = await Promise.all([
    fetch("data/species.json").then((r) => r.json()),
    fetch("data/plantings.json").then((r) => r.json()),
  ]);
  state.species = sp;
  sp.forEach((s) => { state.bySlug[s.slug] = s; state.bySym[s.symbol] = s; });
  state.areas = ar;
  ar.forEach((a) => { state.areaById[a.id] = a; });
  window.addEventListener("hashchange", route);
  route();
}

function setNav(name) {
  document.querySelectorAll("nav.tabs a").forEach((a) => { if (a.dataset.nav === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
}

if ("scrollRestoration" in history) history.scrollRestoration = "manual";
let restoring = false;
// iOS Safari ignores a scroll made during momentum scrolling or before the new view
// has laid out, so jump to the top now and again after the next frames.
function toTop() {
  const go = () => { if (restoring) return; window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; };
  go();
  requestAnimationFrame(() => requestAnimationFrame(go));
  setTimeout(go, 120);
  setTimeout(go, 350);
}

let lastView = null;
function route() {
  const [, view, arg] = (location.hash || "#/").split("/");
  const v = view || "";
  const prev = lastView;
  lastView = v;
  restoring = false;
  tellParent({ navigated: location.hash || "#/" });
  // Changing months on the bloom clock: go to that month's list, not the top of the page.
  if (v === "bloom" && prev === "bloom") {
    viewBloom(arg);
    return showBloomResults();
  }
  toTop();
  if (v === "plant" && state.bySlug[arg]) {
    try { sessionStorage.setItem("pf-last", arg); } catch {}
    return viewPlant(state.bySlug[arg]);
  }
  if (v === "places" && arg && state.areaById[arg]) return viewPlace(state.areaById[arg]);
  if (v === "places") return viewPlaces();
  if (v === "bloom") return viewBloom(arg);
  if (v === "grow") return viewGrow();
  if (v === "identify") return viewIdentify();
  if (v === "about") return viewAbout();
  return viewBrowse();
}

// ---------- cards ----------
// Card photos: swipe (or use the arrows on desktop) through up to five photos.
function cardPics(sp) {
  const imgs = sp.images || [];
  const photos = imgs.filter((i) => i.kind !== "illustration").slice(0, 5);
  const set = photos.length ? photos : imgs.slice(0, 1);
  if (!set.length) return `<div class="pic"><div class="noimg">${typeIcon(sp.type, 54)}</div></div>`;
  const tag = (img, i) => `<img ${i ? 'loading="lazy" ' : ""}src="${esc(img.thumb || imgSrc(img))}" alt="${i ? "" : esc(sp.common)}" class="${img.kind === "illustration" ? "ill" : ""}">`;
  if (set.length === 1) return `<div class="pic">${tag(set[0], 0)}</div>`;
  return `<div class="pic swipe"><div class="track" tabindex="-1">${set.map(tag).join("")}</div>
    <span class="cnav prev" data-dir="-1" role="button" aria-label="Previous photo">‹</span><span class="cnav next" data-dir="1" role="button" aria-label="Next photo">›</span>
    <span class="dots" aria-hidden="true">${set.map((_, i) => `<i${i ? "" : ' class="on"'}></i>`).join("")}</span></div>`;
}
document.addEventListener("scroll", (e) => {
  const t = e.target;
  if (!(t instanceof Element) || !t.classList.contains("track")) return;
  const i = Math.round(t.scrollLeft / t.clientWidth);
  t.parentElement.querySelectorAll(".dots i").forEach((d, k) => d.classList.toggle("on", k === i));
}, true);
document.addEventListener("click", (e) => {
  const b = e.target.closest?.(".cnav");
  if (!b) return;
  e.preventDefault(); e.stopPropagation();
  const t = b.parentElement.querySelector(".track");
  const n = t.children.length, i = Math.round(t.scrollLeft / t.clientWidth);
  t.scrollTo({ left: ((i + +b.dataset.dir + n) % n) * t.clientWidth, behavior: "smooth" });
}, true);

function card(sp) {
  return `<a class="card" href="#/plant/${sp.slug}">
    ${cardPics(sp)}
    <div class="body">
      <div class="name">${esc(sp.common)}</div>
      <div class="sci">${esc(sp.scientific)}</div>
      ${bloomRibbon(sp, { width: 180, height: 20 })}
      <div class="meta"><span class="tag">${esc(TYPES[sp.type]?.one || "")}</span>${sp.in_park ? `<span class="tag park" title="Recorded in Theodore Roosevelt National Park">In the park</span>` : ""}</div>
    </div></a>`;
}

// ---------- browse ----------
function matches(sp, f) {
  if (f.q) {
    const hay = [sp.common, sp.scientific, ...(sp.other_common || []), ...(sp.spec_labels || []), sp.family, sp.family_common].join(" ").toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  if (f.types?.length && !f.types.includes(sp.type)) return false;
  if (f.colors?.length && !f.colors.includes(sp.traits?.flower_color)) return false;
  if (f.month && !(sp.bloom_months || []).includes(+f.month)) return false;
  if (f.area && !sp.areas.some((a) => a.area === f.area)) return false;
  if (f.park && !sp.in_park) return false;
  if (f.zone && state.zone && growVerdict(sp, state.zone.zone).ok === false) return false;
  return true;
}

function sorter(key) {
  if (key === "scientific") return (a, b) => a.scientific.localeCompare(b.scientific);
  if (key === "bloom") return (a, b) => (a.bloom_months?.[0] || 99) - (b.bloom_months?.[0] || 99) || a.common.localeCompare(b.common);
  if (key === "height") return (a, b) => (b.traits?.height_ft || 0) - (a.traits?.height_ft || 0);
  if (key === "planted") return (a, b) => b.areas.length - a.areas.length || a.common.localeCompare(b.common);
  return (a, b) => a.common.localeCompare(b.common);
}

function viewBrowse() {
  setNav("browse");
  document.title = "Plant Finder | Theodore Roosevelt Presidential Library";
  const f = state.filters;
  const colors = [...new Set(state.species.map((s) => s.traits?.flower_color).filter(Boolean))].sort();
  const parkCount = state.species.filter((s) => s.in_park).length;
  const nowM = new Date().getMonth() + 1;
  const blooming = state.species.filter((s) => (s.bloom_months || []).includes(nowM)).length;
  $main.innerHTML = `
  <section class="intro">
    <div>
      <h1>The native plants of the Library</h1>
      <p class="lede">Every grass, wildflower and shrub growing on the Library's grounds and green roofs is a plant of the northern Great Plains. Find one you saw on your visit, learn where it grows on campus, and see whether it will grow at your house.</p>
      <div class="stats">
        <div class="stat"><b>${state.species.length}</b><span>Native species</span></div>
        <div class="stat"><b>${state.areas.length}</b><span>Planting areas</span></div>
        <div class="stat"><b>${parkCount}</b><span>Also in the national park</span></div>
      </div>
    </div>
    <img class="vignette" src="art/prairie.webp" alt="Watercolor sketch of Badlands prairie with blazing star, coneflowers, yarrow and globemallow in front of banded buttes" width="1344" height="576">
  </section>
  <section class="filters ${window.innerWidth < 760 ? "collapsed" : ""}" aria-label="Filter plants">
    <div class="row">
      <label class="search"><span class="sr-only">Search plants</span><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="7" stroke="#5D615F" stroke-width="2" fill="none"/><path d="M15 15l6 6" stroke="#5D615F" stroke-width="2"/></svg>
        <input id="q" type="search" placeholder="Search by name: goldenrod, Liatris, prairie rose…" value="${esc(f.q || "")}"></label>
      <button class="chip collapse-toggle" id="more">More filters</button>
    </div>
    <div class="row more"><span class="lbl">Type</span>${Object.entries(TYPES).map(([k, t]) => `<button class="chip" data-type="${k}" aria-pressed="${(f.types || []).includes(k)}">${typeIcon(k, 16)}${t.label}</button>`).join("")}</div>
    <div class="row more"><span class="lbl">Flower</span>${colors.map((c) => `<button class="chip" data-color="${c}" aria-pressed="${(f.colors || []).includes(c)}"><span class="dot" style="background:${FLOWER[c] || "#ccc"}"></span>${c}</button>`).join("")}</div>
    <div class="row more">
      <span class="lbl">Show</span>
      <select class="sel" id="month" aria-label="Blooming in"><option value="">Any bloom time</option>${MONTH_NAMES.map((m, i) => `<option value="${i + 1}" ${+f.month === i + 1 ? "selected" : ""}>Blooming in ${m}</option>`).join("")}</select>
      <select class="sel" id="area" aria-label="Where on campus"><option value="">Anywhere on campus</option>${state.areas.map((a) => `<option value="${a.id}" ${f.area === a.id ? "selected" : ""}>${esc(a.name)}</option>`).join("")}</select>
      <button class="chip" id="park" aria-pressed="${!!f.park}">Also in the national park</button>
      ${state.zone ? `<button class="chip" id="zone" aria-pressed="${!!f.zone}">Grows in my zone (${esc(state.zone.zone)})</button>` : `<a class="chip" href="#/grow">Check your growing zone</a>`}
      <select class="sel" id="sort" aria-label="Sort"><option value="common">A to Z</option><option value="scientific" ${f.sort === "scientific" ? "selected" : ""}>Scientific name</option><option value="bloom" ${f.sort === "bloom" ? "selected" : ""}>Bloom time</option><option value="height" ${f.sort === "height" ? "selected" : ""}>Tallest first</option><option value="planted" ${f.sort === "planted" ? "selected" : ""}>Most widely planted</option></select>
      <button class="chip" id="reset">Clear</button>
    </div>
  </section>
  <div class="count" id="count" aria-live="polite"></div>
  <div class="grid" id="grid"></div>
  ${blooming ? `<p class="small">${blooming} of these plants usually bloom in ${MONTH_NAMES[nowM - 1]}. <a href="#/bloom/${nowM}">See the bloom clock</a>.</p>` : ""}`;

  const draw = () => {
    const list = state.species.filter((s) => matches(s, f)).sort(sorter(f.sort));
    document.getElementById("grid").innerHTML = list.map(card).join("") || `<div class="empty">No plants match. Try clearing a filter.</div>`;
    document.getElementById("count").textContent = `${list.length} ${list.length === 1 ? "plant" : "plants"}`;
    saveFilters();
  };
  const toggleIn = (key, val) => {
    const arr = new Set(f[key] || []);
    arr.has(val) ? arr.delete(val) : arr.add(val);
    f[key] = [...arr];
  };
  $main.querySelector("#q").addEventListener("input", (e) => { f.q = e.target.value; draw(); });
  $main.querySelectorAll("[data-type]").forEach((b) => b.addEventListener("click", () => { toggleIn("types", b.dataset.type); b.setAttribute("aria-pressed", (f.types || []).includes(b.dataset.type)); draw(); }));
  $main.querySelectorAll("[data-color]").forEach((b) => b.addEventListener("click", () => { toggleIn("colors", b.dataset.color); b.setAttribute("aria-pressed", (f.colors || []).includes(b.dataset.color)); draw(); }));
  $main.querySelector("#month").addEventListener("change", (e) => { f.month = e.target.value; draw(); });
  $main.querySelector("#area").addEventListener("change", (e) => { f.area = e.target.value; draw(); });
  $main.querySelector("#sort").addEventListener("change", (e) => { f.sort = e.target.value; draw(); });
  $main.querySelector("#park").addEventListener("click", (e) => { f.park = !f.park; e.currentTarget.setAttribute("aria-pressed", f.park); draw(); });
  $main.querySelector("#zone")?.addEventListener("click", (e) => { f.zone = !f.zone; e.currentTarget.setAttribute("aria-pressed", f.zone); draw(); });
  $main.querySelector("#reset").addEventListener("click", () => { state.filters = {}; saveFilters(); viewBrowse(); });
  $main.querySelector("#more").addEventListener("click", () => $main.querySelector(".filters").classList.toggle("collapsed"));
  draw();
  // Coming back from a plant: return to that plant's card in the results
  let last = null;
  try { last = sessionStorage.getItem("pf-last"); sessionStorage.removeItem("pf-last"); } catch {}
  const el = last && document.querySelector(`#grid a[href="#/plant/${last}"]`);
  if (el) {
    restoring = true;
    const y = el.getBoundingClientRect().top + window.scrollY - 20;
    if (EMBED) setTimeout(() => tellParent({ scrollTo: y }), 50);
    else window.scrollTo(0, y);
    el.focus({ preventScroll: true });
  }
}

// ---------- plant page ----------
function gbifMap(sp) {
  if (!sp.gbif_key) return "";
  // 2x2 tiles at zoom 3 cover most of North America; pin marks Medora.
  const tiles = [[1, 2], [2, 2], [1, 3], [2, 3]];
  const z = 3, n = 2 ** z;
  const xOf = (lon) => ((lon + 180) / 360) * n;
  const yOf = (lat) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n; };
  const px = ((xOf(MEDORA.lon) - 1) / 2) * 100, py = ((yOf(MEDORA.lat) - 2) / 2) * 100;
  const imgs = tiles.map(([x, y], i) => {
    const pos = `left:${(i % 2) * 50}%;top:${Math.floor(i / 2) * 50}%`;
    return `<img alt="" loading="lazy" style="${pos}" src="https://tile.gbif.org/3857/omt/${z}/${x}/${y}@1x.png?style=gbif-light">` +
      `<img alt="" loading="lazy" style="${pos}" src="https://api.gbif.org/v2/map/occurrence/density/${z}/${x}/${y}@1x.png?taxonKey=${sp.gbif_key}&style=orangeHeat.point">`;
  }).join("");
  return `<div class="map" role="img" aria-label="Map of recorded sightings of ${esc(sp.common)} across North America">${imgs}<span class="pin" style="left:${px}%;top:${py}%" title="Medora, North Dakota"></span></div>
  <p class="credit">Recorded sightings from <a href="https://www.gbif.org/species/${sp.gbif_key}" target="_blank" rel="noopener">GBIF</a>. The orange pin marks Medora.</p>`;
}

function credit(img) {
  if (!img) return "";
  const lic = /CC0|public domain/i.test(img.credit) ? "" : (img.license === "CC0" ? " CC0." : " Public domain.");
  const src = img.source_url ? `<a href="${esc(img.source_url)}" target="_blank" rel="noopener">${esc(img.source)}</a>` : esc(img.source);
  return `${esc(img.credit)}.${lic} ${src}.`;
}

const BLOOM_SRC = {
  inat: "from flowering sightings within about 250 miles of Medora",
  "inat-region": "from flowering sightings across the northern plains",
  "inat-us": "from flowering sightings across the U.S.",
  usda: "from the USDA PLANTS bloom period",
};

function viewPlant(sp) {
  setNav("browse");
  document.title = `${sp.common} | Plant Finder`;
  const imgs = sp.images || [];
  const first = imgs[0];
  const [sun, sunD] = sunText(sp);
  const [water, waterD] = waterText(sp);
  const t = sp.traits || {};
  const nearby = sp.inat_nearby || 0;
  const areas = sp.areas.map((a) => {
    const ar = state.areaById[a.area];
    return `<a class="area-chip" href="#/places/${a.area}"><span><b>${esc(ar.name)}</b><br><span class="small">${esc(ar.summary)}</span></span>${a.qty ? `<span class="tag">${a.qty} planted</span>` : ""}</a>`;
  }).join("");
  const soils = [t.soil_coarse === "Yes" && "sandy or gravelly", t.soil_medium === "Yes" && "loamy", t.soil_fine === "Yes" && "clay"].filter(Boolean);
  const labels = (sp.spec_labels || []).filter((l) => l.toLowerCase() !== sp.common.toLowerCase());
  const others = (sp.other_common || []).filter((l) => l.toLowerCase() !== sp.common.toLowerCase());

  $main.innerHTML = `
  <a class="back" href="#/">&larr; ${EMBED ? "Back to results" : "All plants"}</a>
  <article>
  <div class="plant-hero">
    <figure class="hero-figure">
      <div class="frame">${first ? `<img id="heroimg" src="${esc(imgSrc(first))}" alt="${esc(sp.common)}${first.kind === "illustration" ? ", botanical illustration" : ""}" class="${first.kind === "illustration" ? "ill" : ""}">` : typeIcon(sp.type, 120)}</div>
      ${first ? `<figcaption id="herocap">${credit(first)}</figcaption>` : `<figcaption>Photos of this plant at the Library are coming.</figcaption>`}
      ${imgs.length > 1 ? `<div class="thumbs" role="list">${imgs.map((im, i) => `<button role="listitem" data-i="${i}" aria-current="${i === 0}" aria-label="Show image ${i + 1}"><img src="${esc(im.thumb || imgSrc(im))}" alt="" loading="lazy" class="${im.kind === "illustration" ? "ill" : ""}"></button>`).join("")}</div>` : ""}
    </figure>
    <div>
      <div class="names">
        <h1 class="common">${esc(sp.common)}</h1>
        <p class="sci">${esc(sp.scientific)}</p>
        <p class="family">${esc(sp.family_common || "")}${sp.family ? ` (${esc(sp.family)})` : ""}</p>
      </div>
      <div class="badges">
        <span class="badge">${typeIcon(sp.type, 16)} ${esc(TYPES[sp.type]?.one)}</span>
        ${sp.duration?.length ? `<span class="badge">${esc(sp.duration.join(", "))}</span>` : ""}
        <span class="badge forest">Native to North Dakota's prairie</span>
        ${sp.in_park ? `<span class="badge night">Recorded in Theodore Roosevelt National Park</span>` : ""}
      </div>
      ${journalGlance(sp)}
      ${BLOOM_SRC[sp.bloom_source] ? `<p class="credit">Bloom months ${BLOOM_SRC[sp.bloom_source]}.</p>` : ""}
    </div>
  </div>

  <h2>Find it at the Library</h2>
  <div class="area-list">${areas || `<p>Listed in the Library's planting plans.</p>`}</div>

  <h2>Will it grow at your house?</h2>
  <div class="grow-layout">
    <div id="zonemap"></div>
    <section class="panel">
      <h3>Check your ZIP code</h3>
      <div class="zip"><label for="zip" class="small">Your ZIP code</label><input id="zip" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" value="${esc(state.zone?.zip || "")}" placeholder="58645"><button class="btn" id="zipgo">Check</button></div>
      <div id="verdict" aria-live="polite"></div>
      <dl class="facts" style="margin-top:.9rem">
        ${sp.spacing_in ? `<dt>Spacing</dt><dd>${sp.spacing_in} inches apart in the Library's plans</dd>` : ""}
        ${soils.length ? `<dt>Soil</dt><dd>Grows in ${soils.join(", ")} soil</dd>` : ""}
        ${t.precip_min_in ? `<dt>Rainfall</dt><dd>${t.precip_min_in} to ${t.precip_max_in} inches a year</dd>` : ""}
        ${t.growth_rate ? `<dt>Growth</dt><dd>${esc(t.growth_rate)}</dd>` : ""}
        ${t.commercial_availability ? `<dt>Nurseries</dt><dd>${esc(t.commercial_availability)}</dd>` : ""}
      </dl>
      ${sp.plant_guide ? `<p class="small"><a href="${esc(sp.plant_guide)}" target="_blank" rel="noopener">USDA plant guide (PDF)</a>${sp.fact_sheet ? ` · <a href="${esc(sp.fact_sheet)}" target="_blank" rel="noopener">Fact sheet</a>` : ""}</p>` : ""}
    </section>
  </div>
  <div style="margin-top:1rem">
    <section class="panel">
      <h3>In the wild</h3>
      <dl class="facts">
        <dt>National park</dt><dd>${sp.in_park ? "Recorded in Theodore Roosevelt National Park (NPSpecies)" : "Not on the park's plant list"}</dd>
        ${nearby ? `<dt>Nearby</dt><dd><a href="https://www.inaturalist.org/observations?taxon_id=${sp.inat_id}&lat=${MEDORA.lat}&lng=${MEDORA.lon}&radius=150" target="_blank" rel="noopener">${nearby.toLocaleString()} sightings</a> on iNaturalist within about 90 miles of Medora</dd>` : ""}
        ${t.graze_palatable && t.graze_palatable !== "None" ? `<dt>Grazers</dt><dd>${esc(t.graze_palatable)} value as forage for grazing animals</dd>` : ""}
        ${t.nitrogen_fixation && t.nitrogen_fixation !== "None" ? `<dt>Soil builder</dt><dd>Fixes nitrogen in the soil (${esc(t.nitrogen_fixation.toLowerCase())})</dd>` : ""}
        ${t.fire_tolerance ? `<dt>Fire</dt><dd>${esc(t.fire_tolerance)} tolerance for prairie fire</dd>` : ""}
      </dl>
      ${gbifMap(sp)}
    </section>
  </div>

  ${sp.story ? `<h2>The story</h2><div class="panel">${sp.story}</div>` : ""}

  ${imgs.length ? `<h2>Images</h2><div class="gallery">${imgs.map((im) => `<figure><img loading="lazy" src="${esc(im.thumb || imgSrc(im))}" alt="${esc(sp.common)}" class="${im.kind === "illustration" ? "ill" : ""}"><figcaption>${credit(im)}</figcaption></figure>`).join("")}</div>
  <p class="small">The Library is photographing these plants on its grounds; those photos will replace these as they are added.</p>` : ""}

  <h2>Names</h2>
  <div class="panel">
    <dl class="facts">
      <dt>Scientific name</dt><dd><span class="sci">${esc(sp.scientific)}</span> <span class="small">${esc(sp.scientific_full.replace(sp.scientific, "").trim())}</span></dd>
      ${others.length ? `<dt>Also called</dt><dd>${others.map(esc).join(", ")}</dd>` : ""}
      ${labels.length ? `<dt>In the Library's plans</dt><dd>${labels.map(esc).join(", ")}</dd>` : ""}
      <dt>USDA symbol</dt><dd><a href="${esc(sp.usda_url)}" target="_blank" rel="noopener">${esc(sp.symbol)}</a></dd>
    </dl>
    ${(sp.name_notes || []).map((n) => `<p class="note">${esc(n)}</p>`).join("")}
  </div>
  </article>`;

  // image switcher
  $main.querySelectorAll(".thumbs button").forEach((b) => b.addEventListener("click", () => {
    const im = imgs[+b.dataset.i];
    const h = document.getElementById("heroimg");
    h.src = imgSrc(im);
    h.className = im.kind === "illustration" ? "ill" : "";
    document.getElementById("herocap").innerHTML = credit(im);
    $main.querySelectorAll(".thumbs button").forEach((x) => x.setAttribute("aria-current", x === b));
  }));
  const showVerdict = (z) => {
    const v = growVerdict(sp, z.zone);
    document.getElementById("verdict").innerHTML = `<div class="verdict ${v.ok === false ? "warn" : "ok"}">${esc(v.text)}</div>`;
  };
  const drawMap = () => renderZoneMap(document.getElementById("zonemap"), { plant: sp, zone: state.zone });
  drawMap();
  if (state.zone) showVerdict(state.zone);
  const go = async () => {
    const zip = document.getElementById("zip").value.trim();
    if (!/^\d{5}$/.test(zip)) { document.getElementById("verdict").innerHTML = `<div class="verdict warn">Enter a five-digit ZIP code.</div>`; return; }
    try { const z = await lookupZone(zip); saveZone({ zip, ...z }); showVerdict(state.zone); drawMap(); }
    catch { document.getElementById("verdict").innerHTML = `<div class="verdict warn">We couldn't find that ZIP code.</div>`; }
  };
  document.getElementById("zipgo").addEventListener("click", go);
  document.getElementById("zip").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
}

// ---------- places ----------
const KIND = { schedule: "Garden planting", plug: "Planted from plugs", seed: "Seeded prairie" };
function areaSpecies(a) { return a.members.map((m) => state.bySym[m.symbol]).filter(Boolean); }

function viewPlaces() {
  setNav("places");
  document.title = "Where they grow | Plant Finder";
  $main.innerHTML = `<h1>Where they grow</h1>
  <p class="lede">The Library's landscape is designed as working prairie. Some areas were seeded, some planted by hand from small plugs, and some are gardens. Each one was built for a job: catching storm water, holding a slope, covering a roof.</p>
  <div class="place-grid">${state.areas.map((a) => {
    const sp = areaSpecies(a);
    return `<a class="place" href="#/places/${a.id}">
      <span class="kind">${KIND[a.kind] || ""}</span>
      <h3>${esc(a.name)}</h3>
      <span>${esc(a.summary)}</span>
      <div class="swatches" aria-hidden="true">${sp.map((s) => `<span style="background:${flowerColor(s)}" title="${esc(s.common)}"></span>`).join("")}</div>
      <span class="small">${sp.length} species</span></a>`;
  }).join("")}</div>`;
}

function viewPlace(a) {
  setNav("places");
  document.title = `${a.name} | Plant Finder`;
  const sp = areaSpecies(a).sort((x, y) => x.common.localeCompare(y.common));
  const facts = [
    ["Sun", a.sun], ["Moisture", a.moisture], ["Designed outcome", a.outcome], ["How it's cared for", a.management], ["Modeled on", a.template],
  ].filter(([, v]) => v);
  $main.innerHTML = `<a class="back" href="#/places">&larr; Where they grow</a>
  <span class="small" style="display:block;margin-top:.8rem">${KIND[a.kind] || ""}</span>
  <h1>${esc(a.name)}</h1>
  <p class="lede">${esc(a.summary)}</p>
  ${facts.length || a.facts ? `<div class="panel"><dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}${(a.facts || []).map((x) => `<dt>Site</dt><dd>${esc(x)}</dd>`).join("")}</dl></div>` : ""}
  <h2>${sp.length} plants in this area</h2>
  ${a.complete === false ? `<p class="note">This list is still being completed from the planting plans.</p>` : ""}
  <div class="grid">${sp.map(card).join("")}</div>
  <p class="credit" style="margin-top:1rem">From the Library's landscape plans: ${esc(a.source)}.</p>`;
}

// ---------- bloom clock ----------
function wheel(selected) {
  const R = 270, cx = 280, cy = 280, inner = 70;
  let s = `<svg class="wheel" viewBox="0 0 560 560" width="100%" role="img" aria-label="Bloom clock: which plants bloom in each month">`;
  for (let m = 1; m <= 12; m++) {
    const a0 = ((m - 1) / 12) * 2 * Math.PI - Math.PI / 2, a1 = (m / 12) * 2 * Math.PI - Math.PI / 2;
    const p = (r, a) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
    const path = `M${p(inner, a0)} L${p(R, a0)} A${R} ${R} 0 0 1 ${p(R, a1)} L${p(inner, a1)} A${inner} ${inner} 0 0 0 ${p(inner, a0)} Z`;
    const list = state.species.filter((s) => (s.bloom_months || []).includes(m)).sort((a, b) => (a.traits?.flower_color || "").localeCompare(b.traits?.flower_color || ""));
    s += `<g class="wedge ${m === +selected ? "sel" : ""}" data-m="${m}"><path class="bg" d="${path}" fill="${m % 2 ? "#F3F0E8" : "#ECE8DE"}" stroke="#fff" stroke-width="2"/>`;
    // dots fill the wedge in rings
    const am = (a0 + a1) / 2;
    let i = 0;
    for (let r = inner + 14; r < R - 26 && i < list.length; r += 13) {
      const span = (a1 - a0) * r;
      const n = Math.max(1, Math.floor(span / 13));
      for (let k = 0; k < n && i < list.length; k++, i++) {
        const a = a0 + ((k + 0.5) / n) * (a1 - a0);
        const sp = list[i];
        s += `<a href="#/plant/${sp.slug}"><circle class="sp" cx="${cx + r * Math.cos(a)}" cy="${cy + r * Math.sin(a)}" r="5.2" fill="${flowerColor(sp)}"><title>${esc(sp.common)}</title></circle></a>`;
      }
    }
    s += `<text x="${cx + (R - 12) * Math.cos(am)}" y="${cy + (R - 12) * Math.sin(am) + 5}" text-anchor="middle" font-size="15" fill="#1B4532">${MONTHS[m - 1]}</text></g>`;
  }
  const now = new Date().getMonth() + 1;
  return s + `<circle cx="${cx}" cy="${cy}" r="${inner - 6}" fill="#1B4532"/><text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="20" fill="#fff">Bloom</text><text x="${cx}" y="${cy + 18}" text-anchor="middle" font-size="20" fill="#8FC895">clock</text></svg>`;
}

function viewBloom(arg) {
  setNav("bloom");
  document.title = "Bloom clock | Plant Finder";
  const m = +arg || new Date().getMonth() + 1;
  const list = state.species.filter((s) => (s.bloom_months || []).includes(m)).sort((a, b) => a.common.localeCompare(b.common));
  $main.innerHTML = `<h1>Bloom clock</h1>
  <p class="lede">The Library's landscape is planned so something is always in flower from spring into fall; the green roofs alone are designed to bloom from May through October. Each dot is a plant, in the color of its flower. Pick a month to see what's blooming.</p>
  <div class="bloom-layout">
    <div>${wheel(m)}</div>
    <div>
      <div class="month-tabs">${MONTHS.map((x, i) => `<a class="chip" href="#/bloom/${i + 1}" aria-pressed="${i + 1 === m}">${x}</a>`).join("")}</div>
      <h2 class="bloom-results" style="margin-top:0;scroll-margin-top:12px">${MONTH_NAMES[m - 1]}: ${list.length} plants</h2>
      <div class="grid">${list.map(card).join("") || `<div class="empty">Winter rest. The grasses and seed heads carry the prairie's color now.</div>`}</div>
    </div>
  </div>
  <p class="credit">Bloom months come from iNaturalist sightings marked "flowering" within about 250 miles of Medora where there are enough of them, and from USDA PLANTS bloom periods otherwise.</p>`;
  $main.querySelectorAll(".wedge").forEach((w) => w.addEventListener("click", (e) => { if (!e.target.closest("a")) location.hash = `#/bloom/${w.dataset.m}`; }));
}

function showBloomResults() {
  const h = $main.querySelector(".bloom-results");
  if (!h) return;
  restoring = true;
  const place = () => {
    const r = h.getBoundingClientRect();
    if (EMBED) { tellParent({ scrollTo: r.top + window.scrollY - 10 }); return; }
    // Only move when the list heading is off screen (phones, where the list sits under the wheel).
    if (r.top < 0 || r.top > window.innerHeight * 0.6) window.scrollTo(0, r.top + window.scrollY - 12);
  };
  requestAnimationFrame(() => requestAnimationFrame(place));
  setTimeout(place, 200);
}

// ---------- grow ----------
function viewGrow() {
  setNav("grow");
  document.title = "Grow them at home | Plant Finder";
  $main.innerHTML = `<h1>Grow them at home</h1>
  <p class="lede">These are tough plants, built for wind, drought and North Dakota winters. Enter your ZIP code to find your USDA hardiness zone and see which of the Library's plants grow well where you live.</p>
  <div class="grow-layout">
    <div id="zonemap"></div>
    <div class="panel"><div class="zip"><label for="zip">ZIP code</label><input id="zip" inputmode="numeric" maxlength="5" value="${esc(state.zone?.zip || "")}" placeholder="58645"><button class="btn" id="go">Check my zone</button></div><div id="out" aria-live="polite"></div></div>
  </div>
  <div id="list"></div>
  <p class="credit">Zones from the 2023 USDA Plant Hardiness Zone Map via phzmapi.org. Each plant’s range combines its USDA PLANTS cold limit with the zones where it grows wild in the U.S. (GBIF records). Medora is zone 4a.</p>`;
  const show = (z) => {
    const ok = state.species.filter((s) => growVerdict(s, z.zone).ok !== false);
    const no = state.species.filter((s) => !ok.includes(s));
    document.getElementById("out").innerHTML = `<div class="verdict ok"><b>ZIP ${esc(z.zip)} is zone ${esc(z.zone)}</b> (winter lows of ${esc(z.temperature_range)}°F). ${ok.length} of the ${state.species.length} plants grow well in your zone.</div>`;
    document.getElementById("list").innerHTML = `<h2>Good fits for zone ${esc(z.zone)}</h2><div class="grid">${ok.sort((a, b) => a.common.localeCompare(b.common)).map(card).join("")}</div>` +
      (no.length ? `<h2>Outside their range in zone ${esc(z.zone)}</h2><p class="small">These grow wild in colder or warmer places than yours. They may survive with extra care.</p><div class="grid">${no.map(card).join("")}</div>` : "");
  };
  const drawMap = () => renderZoneMap(document.getElementById("zonemap"), { zone: state.zone });
  drawMap();
  if (state.zone) show(state.zone);
  const go = async () => {
    const zip = document.getElementById("zip").value.trim();
    if (!/^\d{5}$/.test(zip)) return (document.getElementById("out").innerHTML = `<div class="verdict warn">Enter a five-digit ZIP code.</div>`);
    try { const z = await lookupZone(zip); saveZone({ zip, ...z }); show(state.zone); drawMap(); }
    catch { document.getElementById("out").innerHTML = `<div class="verdict warn">We couldn't find that ZIP code.</div>`; }
  };
  document.getElementById("go").addEventListener("click", go);
  document.getElementById("zip").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
}

// ---------- identify ----------
// Photo identification needs a small server to hold API keys (Pl@ntNet, Gemini).
// Set window.PLANTFINDER_ID_ENDPOINT in config.js once it exists; until then the
// visual key below works entirely in the browser.
function viewIdentify() {
  setNav("identify");
  document.title = "What is this plant? | Plant Finder";
  const endpoint = window.PLANTFINDER_ID_ENDPOINT;
  const k = { type: "", color: "", height: "", month: "" };
  const colors = [...new Set(state.species.map((s) => s.traits?.flower_color).filter(Boolean))].sort();
  const hRange = { ankle: [0, 0.8], knee: [0.6, 2], waist: [1.5, 4], tall: [4, 100] };
  const ART = { grass: "grass", sedge: "sedge", wildflower: "wildflower", shrub: "shrub", "cactus-yucca": "cactus" };
  const steps = [
    { key: "type", q: "What kind of plant is it?", opts: Object.entries(TYPES).map(([v, t]) => ({ v, label: t.one, art: `<img src="art/${ART[v]}.webp" alt="">` })) },
    { key: "color", q: "What color are the flowers?", opts: colors.map((c) => ({ v: c, label: c, art: blot(FLOWER[c], 54) })).concat([{ v: "none", label: "No flowers", art: `<span class="id-none">–</span>` }]) },
    { key: "height", q: "About how tall is it?", opts: [["ankle", "Ankle high", 0.12], ["knee", "Knee high", 0.3], ["waist", "Waist high", 0.55], ["tall", "Taller than me", 1.05]].map(([v, label, h]) => ({ v, label, art: `<span class="id-ht"><img src="art/person.webp" alt=""><i style="bottom:${Math.min(h, 1) * 100}%"></i></span>` })) },
    { key: "month", q: "When did you see it?", opts: MONTHS.map((m, i) => ({ v: String(i + 1), label: m, small: true })) },
  ];
  let step = 0;

  $main.innerHTML = `<div class="id-wrap">
    <section class="id-card" aria-label="Identify a plant">
      <div class="id-top">
        <h1>What is this plant?</h1>
        ${endpoint ? `<label class="btn ghost id-cam"><input type="file" accept="image/*" capture="environment" id="photo" class="sr-only">Use a photo</label>` : ""}
      </div>
      <ol class="id-steps" aria-label="Questions"></ol>
      <div class="id-body" aria-live="polite"></div>
      <div class="id-foot"><button class="chip" id="id-back">Back</button><button class="chip" id="id-skip">Skip</button><button class="chip" id="id-reset">Start over</button></div>
      <div id="photo-out" class="small"></div>
    </section>
    <section class="id-results"><div class="id-count" id="k-count"></div><div id="k-out" class="grid"></div></section>
  </div>`;

  const label = (s) => {
    const val = k[s.key];
    if (!val) return "";
    return s.opts.find((o) => o.v === val)?.label || "";
  };
  const drawSteps = () => {
    document.querySelector(".id-steps").innerHTML = steps.map((s, i) =>
      `<li><button class="id-step-btn${i === step ? " on" : ""}${k[s.key] ? " done" : ""}" data-i="${i}"><b>${i + 1}</b><span>${["Kind", "Color", "Height", "Month"][i]}</span><em>${esc(label(s))}</em></button></li>`).join("");
    document.querySelectorAll(".id-step-btn").forEach((b) => b.addEventListener("click", () => { step = +b.dataset.i; render(); }));
  };
  const drawBody = () => {
    const s = steps[step];
    document.querySelector(".id-body").innerHTML = `<h2 class="id-q">${s.q}</h2>
      <div class="id-opts${s.opts[0].small ? " small" : s.opts.length === 4 ? " four" : ""}">${s.opts.map((o) =>
        `<button class="id-opt" data-v="${o.v}" aria-pressed="${k[s.key] === o.v}">${o.art || ""}<span>${esc(o.label)}</span></button>`).join("")}</div>`;
    document.querySelectorAll(".id-opt").forEach((b) => b.addEventListener("click", () => {
      k[s.key] = k[s.key] === b.dataset.v ? "" : b.dataset.v;
      if (k[s.key] && step < steps.length - 1) step++;
      render();
    }));
    document.getElementById("id-back").disabled = step === 0;
    document.getElementById("id-skip").textContent = step === steps.length - 1 ? "Done" : "Skip";
  };
  const drawResults = () => {
    const picked = !!(k.type || k.color || k.height || k.month);
    const scored = state.species.map((s) => {
      let sc = 0;
      if (k.type) sc += s.type === k.type || (k.type === "grass" && s.type === "sedge") ? 3 : -4;
      if (k.color === "none") sc += s.traits?.flower_color ? 0 : 1;
      else if (k.color) sc += s.traits?.flower_color === k.color ? 3 : -3;
      if (k.month && k.color !== "none") sc += (s.bloom_months || []).includes(+k.month) ? 2 : -2;
      if (k.height && s.traits?.height_ft != null) {
        const [lo, hi] = hRange[k.height];
        sc += s.traits.height_ft >= lo && s.traits.height_ft <= hi ? 2 : -1;
      }
      return [sc, s];
    }).filter(([sc]) => sc > 0).sort((a, b) => b[0] - a[0] || a[1].common.localeCompare(b[1].common));
    document.getElementById("k-count").innerHTML = picked
      ? `<b>${scored.length}</b> ${scored.length === 1 ? "plant matches" : "plants match"}${scored.length > 12 ? "; the best 12 are shown" : ""}`
      : `Answer a question or two and the matches appear here.`;
    document.getElementById("k-out").innerHTML = picked ? (scored.slice(0, 12).map(([, s]) => card(s)).join("") || `<div class="empty">No plants match. Try changing an answer.</div>`) : "";
  };
  const render = () => { drawSteps(); drawBody(); drawResults(); };
  document.getElementById("id-back").addEventListener("click", () => { if (step > 0) { step--; render(); } });
  document.getElementById("id-skip").addEventListener("click", () => {
    if (step < steps.length - 1) { step++; render(); }
    else document.querySelector(".id-results").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("id-reset").addEventListener("click", () => { Object.assign(k, { type: "", color: "", height: "", month: "" }); step = 0; render(); });
  document.getElementById("photo")?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const out = document.getElementById("photo-out");
    out.innerHTML = `<p>Identifying your photo…</p>`;
    try {
      const fd = new FormData(); fd.append("image", file);
      const res = await (await fetch(endpoint, { method: "POST", body: fd })).json();
      const hits = (res.matches || []).map((h) => [h.score, state.bySym[h.symbol]]).filter(([, s]) => s);
      document.getElementById("k-count").innerHTML = hits.length ? `Best matches for your photo. Compare closely; a photo ID is a best guess.` : `That doesn't look like one of the Library's plants.${res.outside ? ` It may be ${esc(res.outside)}.` : ""}`;
      document.getElementById("k-out").innerHTML = hits.map(([sc, s]) => card(s).replace('<div class="meta">', `<div class="meta"><span class="tag">${Math.round(sc * 100)}% match</span>`)).join("");
      out.innerHTML = "";
    } catch { out.innerHTML = `<p>Photo identification isn't available right now.</p>`; }
  });
  render();
}

// ---------- about ----------
function viewAbout() {
  setNav("about");
  document.title = "About | Plant Finder";
  const ill = state.species.filter((s) => s.images?.[0]?.kind === "illustration").length;
  $main.innerHTML = `<h1>About the Plant Finder</h1>
  <div class="panel">
  <p>Every plant here comes from the Library's landscape plans: the native seed mixes, plug mixes and planting schedules for the gardens, green roofs, stormwater basins and restored prairie. Plant facts come from public sources and are shown with their source.</p>
  <dl class="facts">
    <dt>Plant facts</dt><dd><a href="https://plants.usda.gov" target="_blank" rel="noopener">USDA-NRCS PLANTS Database</a>: names, families, height, cold limit, drought and shade tolerance, bloom period</dd>
    <dt>Bloom months</dt><dd><a href="https://www.inaturalist.org" target="_blank" rel="noopener">iNaturalist</a> sightings marked flowering within about 250 miles of Medora</dd>
    <dt>National park</dt><dd><a href="https://irma.nps.gov/NPSpecies/" target="_blank" rel="noopener">NPSpecies</a> list for Theodore Roosevelt National Park</dd>
    <dt>Maps</dt><dd><a href="https://www.gbif.org" target="_blank" rel="noopener">GBIF</a> occurrence records</dd>
    <dt>Hardiness zones</dt><dd>2023 USDA Plant Hardiness Zone Map, via <a href="https://phzmapi.org" target="_blank" rel="noopener">phzmapi.org</a></dd>
    <dt>Images</dt><dd>Public-domain images from USDA PLANTS, including ${ill} botanical illustrations from Britton and Brown's <i>Illustrated Flora of the Northern United States, Canada and the British Possessions</i> (1913), and photos that iNaturalist observers released with no rights reserved (CC0). Each image is credited where it appears.</dd>
  </dl>
  </div>
  <p class="small" style="margin-top:1rem">Built by the Theodore Roosevelt Presidential Library. <a href="https://github.com/Theodore-Roosevelt-Presidential-Library/PlantFinder" target="_blank" rel="noopener">Source on GitHub</a> · <a href="embed.html">Embed these tools</a></p>`;
}

load().catch((e) => { $main.innerHTML = `<div class="empty">The plant list couldn't load. ${esc(e.message)}</div>`; });

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js");
