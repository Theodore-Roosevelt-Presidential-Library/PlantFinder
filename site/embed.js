// PlantFinder embeds for trlibrary.com and partner sites.
//   <script type="module" src="https://plantfinder.labs.trlibrary.com/embed.js"></script>
//   <trpl-plant-card plant="liatris-punctata"></trpl-plant-card>
//   <trpl-plant-grid area="roof-northwest" limit="8"></trpl-plant-grid>
//   <trpl-bloom-now limit="6"></trpl-bloom-now>
//   <trpl-zone-check></trpl-zone-check>
import { TYPES, MONTH_NAMES, esc, flowerColor, heroImage, bloomRibbon, bloomText, silhouette, typeIcon, zoneNum, lookupZone, journalBloom, journalHeight, renderZoneMap, growVerdict } from "./js/viz.js";

const BASE = new URL(".", import.meta.url).href;
let dataPromise;
function data() {
  dataPromise ||= Promise.all([
    fetch(BASE + "data/species.json").then((r) => r.json()),
    fetch(BASE + "data/plantings.json").then((r) => r.json()),
  ]).then(([species, areas]) => ({ species, areas }));
  return dataPromise;
}
const src = (img) => (img?.src ? BASE + img.src : img?.url);
const thumb = (img) => (img?.thumb ? BASE + img.thumb : src(img));
const link = (sp) => `${BASE}#/plant/${sp.slug}`;

const CSS = `
:host { display: block; font-family: "Source Serif 4", Georgia, serif; color: #25282A; --forest: #1B4532; }
* { box-sizing: border-box; }
a { color: inherit; text-decoration: none; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--pf-min, 190px), 1fr)); gap: 14px; }
.card { background: #fff; border: 1px solid #D9D3C4; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; transition: transform .15s ease; }
.card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(27,69,50,.14); }
.pic { aspect-ratio: 4/3; background: #ECE8DE; display: grid; place-items: center; overflow: hidden; position: relative; }
.pic img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.pic img.ill { object-fit: contain; background: #fff; padding: 6px; }
.pic.swipe { display: block; }
.pic.swipe .track { position: absolute; inset: 0; display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; -webkit-overflow-scrolling: touch; overscroll-behavior-x: contain; }
.pic.swipe .track::-webkit-scrollbar { display: none; }
.pic.swipe .track img { position: relative; inset: auto; flex: 0 0 100%; height: 100%; scroll-snap-align: start; scroll-snap-stop: always; }
.pic .dots { position: absolute; left: 0; right: 0; bottom: 7px; display: flex; justify-content: center; gap: 5px; pointer-events: none; }
.pic .dots i { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,.55); box-shadow: 0 0 2px rgba(0,0,0,.45); }
.pic .dots i.on { background: #fff; transform: scale(1.25); }
.pic .cnav { position: absolute; top: 50%; transform: translateY(-50%); width: 30px; height: 30px; border-radius: 50%; background: rgba(255,255,255,.88); color: #1B4532; display: grid; place-items: center; font-size: 20px; line-height: 1; opacity: 0; transition: opacity .15s; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
.pic .cnav.prev { left: 6px; } .pic .cnav.next { right: 6px; }
@media (hover: hover) { a:hover .pic .cnav { opacity: 1; } }
.body { padding: 10px 12px 12px; display: grid; gap: 4px; }
.name { font-family: "Dharma Gothic E", Oswald, "Arial Narrow", sans-serif; text-transform: uppercase; font-size: 1.15rem; letter-spacing: .03em; color: var(--forest); line-height: 1.05; }
.sci { font-style: italic; font-size: .85rem; color: #5D615F; }
.head { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; margin-bottom: 10px; flex-wrap: wrap; }
.head h3 { font-family: "Dharma Gothic E", Oswald, sans-serif; text-transform: uppercase; color: var(--forest); margin: 0; font-size: 1.5rem; font-weight: 600; }
.more { font-family: "Source Sans 3", sans-serif; font-size: .9rem; color: var(--forest); text-decoration: underline; }
.wide { display: grid; grid-template-columns: 220px 1fr; gap: 16px; background: #fff; border: 1px solid #D9D3C4; border-radius: 10px; overflow: hidden; }
.wide .pic { aspect-ratio: auto; height: 100%; min-height: 200px; }
.wide .body { padding: 16px; }
.facts { display: grid; grid-template-columns: minmax(0, 1fr) 160px; gap: 16px; align-items: end; }
@media (max-width: 700px) { .facts { grid-template-columns: 1fr; } }
.small { font-family: "Source Sans 3", sans-serif; font-size: .85rem; color: #5D615F; }
@media (max-width: 560px) { .wide { grid-template-columns: 1fr; } .wide .pic { min-height: 180px; } }
.zip { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
input { font: inherit; font-family: "Source Sans 3", sans-serif; width: 7.5rem; padding: 8px 10px; border: 2px solid #D9D3C4; border-radius: 8px; }
button { font-family: Oswald, sans-serif; text-transform: uppercase; letter-spacing: .06em; background: #E7805D; color: #fff; border: 0; border-radius: 999px; padding: 9px 16px; cursor: pointer; font-size: 1rem; }
.box { background: #fff; border: 1px solid #D9D3C4; border-radius: 10px; padding: 16px; }
.out { margin-top: 10px; font-family: "Source Sans 3", sans-serif; }
.paper { background: #f3ead6; border-radius: 6px; padding: 10px 12px; color: #3b2f22; font-family: "IM Fell English", serif; --ink: #3b2f22; }
.wc-blot { display: inline-block; -webkit-mask-size: contain; mask-size: contain; -webkit-mask-repeat: no-repeat; mask-repeat: no-repeat; -webkit-mask-position: center; mask-position: center; mix-blend-mode: multiply; }
.wc-months { display: grid; grid-template-columns: repeat(12, 1fr); width: 100%; max-width: 560px; gap: 2px; }
.wc-month { display: grid; justify-items: center; gap: 2px; }
.wc-month b { font-weight: normal; font-size: .9rem; color: #6d5537; }
.wc-month.now b { text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 3px; color: var(--ink); }
.wc-empty { width: 30px; height: 30px; border-radius: 50%; border: 1px dashed rgba(109, 85, 55, .32); transform: scale(.55); }
.wc-height { width: 100%; max-width: 230px; }
.wc-stage { display: flex; align-items: flex-end; justify-content: space-around; gap: .6rem; }
.wc-stage img { display: block; object-fit: contain; object-position: bottom; }
.wc-note { font-style: italic; color: #6d5537; align-self: center; }
.wc-ground { width: 100%; height: 6px; display: block; margin-top: -2px; }
.wc-scale { display: flex; justify-content: space-around; font-size: .9rem; color: #6d5537; font-style: italic; }

.zonemap { font-family: "IM Fell English", var(--serif); color: #3b2f22; }
.zm-frame { position: relative; border-radius: 4px; padding: 2% 2% 1%;
  background-color: #f3ead6;
  background-image:
    radial-gradient(ellipse at 20% 15%, rgba(255,255,255,.5), transparent 55%),
    radial-gradient(ellipse at 85% 90%, rgba(150,110,60,.12), transparent 60%),
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .35  0 0 0 0 .2  0 0 0 .09 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  box-shadow: inset 0 0 40px rgba(140,100,40,.12), 0 8px 22px -14px rgba(70,50,20,.5); }
.zonemap-svg { display: block; width: 100%; height: auto; }
.zonemap-svg .zone path { fill: var(--zc); fill-opacity: .62; stroke: var(--zc); stroke-opacity: .5; stroke-width: .6; mix-blend-mode: multiply; transition: fill .3s, fill-opacity .3s; }
.zonemap-svg .nation { fill: none; stroke: #4a3826; stroke-width: 1.3; stroke-linejoin: round; opacity: .85; }
.zonemap-svg .states { fill: none; stroke: #5b4630; stroke-width: .55; stroke-linejoin: round; opacity: .55; }
/* plant view: zones the plant survives keep their color; the rest fade to bare paper wash */
.zonemap.for-plant .zone:not(.ok) path { fill: #a9a39a; fill-opacity: .42; stroke: #8f887d; stroke-opacity: .35; }
.zonemap.for-plant .zone.ok path { fill-opacity: .78; }
.zonemap-svg .pin circle { fill: #fffdf6; stroke: #2b2118; stroke-width: 1.6; }
.zonemap-svg .pin .dot { fill: #b8492f; stroke: none; }
.zonemap-svg .pin.you .dot { fill: #1B4532; }
.zonemap-svg .pin text { font-family: "IM Fell English", Georgia, serif; font-style: italic; font-size: 20px; fill: #2b2118; paint-order: stroke; stroke: #f3ead6; stroke-width: 4px; stroke-linejoin: round; }
.zm-legend { display: flex; flex-wrap: wrap; gap: .25rem .6rem; margin: .6rem 0 .2rem; }
.zm-key { display: inline-flex; align-items: center; gap: .25rem; font-size: .95rem; opacity: .9; }
.zm-key b { font-weight: normal; }
.for-plant .zm-key:not(.ok) { opacity: .55; }
.zm-key.mine b { text-decoration: underline; text-underline-offset: 3px; }
.zm-cap { font-style: italic; margin: .4rem 0 .2rem; }
.zm-src { font-family: 'Source Sans 3', sans-serif; font-size: .74rem; color: #5D615F; margin: 0; }

.swatch { display: inline-block; width: 12px; height: 12px; border-radius: 3px; margin-right: 2px; vertical-align: middle; }
`;

function fonts() {
  if (document.getElementById("pf-fonts")) return;
  const l = document.createElement("link");
  l.id = "pf-fonts"; l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=Oswald:wght@400;600&family=Source+Sans+3:wght@400;600&family=Source+Serif+4:ital@0;1&display=swap";
  document.head.appendChild(l);
}

// Up to five photos you can swipe through (arrows on hover with a mouse).
function pics(sp, { big = false, size = 48 } = {}) {
  const imgs = sp.images || [];
  const photos = imgs.filter((i) => i.kind !== "illustration").slice(0, 5);
  const set = photos.length ? photos : imgs.slice(0, 1);
  if (!set.length) return `<div class="pic">${typeIcon(sp.type, size)}</div>`;
  const tag = (img, i) => `<img ${i || !big ? 'loading="lazy" ' : ""}alt="${i ? "" : esc(sp.common)}" src="${esc(big ? src(img) : thumb(img))}" class="${img.kind === "illustration" ? "ill" : ""}">`;
  if (set.length === 1) return `<div class="pic">${tag(set[0], 0)}</div>`;
  return `<div class="pic swipe"><div class="track">${set.map(tag).join("")}</div>
    <span class="cnav prev" data-dir="-1" role="button" aria-label="Previous photo">‹</span><span class="cnav next" data-dir="1" role="button" aria-label="Next photo">›</span>
    <span class="dots" aria-hidden="true">${set.map((_, i) => `<i${i ? "" : ' class="on"'}></i>`).join("")}</span></div>`;
}
function wireSwipes(root) {
  root.addEventListener("scroll", (e) => {
    const t = e.target;
    if (!t.classList?.contains("track")) return;
    const i = Math.round(t.scrollLeft / t.clientWidth);
    t.parentElement.querySelectorAll(".dots i").forEach((d, k) => d.classList.toggle("on", k === i));
  }, true);
  root.addEventListener("click", (e) => {
    const b = e.target.closest?.(".cnav");
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const t = b.parentElement.querySelector(".track");
    const n = t.children.length, i = Math.round(t.scrollLeft / t.clientWidth);
    t.scrollTo({ left: ((i + +b.dataset.dir + n) % n) * t.clientWidth, behavior: "smooth" });
  }, true);
}

function card(sp) {
  return `<a class="card" href="${link(sp)}" target="_top">
    ${pics(sp)}
    <div class="body"><div class="name">${esc(sp.common)}</div><div class="sci">${esc(sp.scientific)}</div>${bloomRibbon(sp, { width: 180, height: 20 })}</div></a>`;
}

class Base extends HTMLElement {
  connectedCallback() {
    fonts();
    if (!this.root) { this.root = this.attachShadow({ mode: "open" }); wireSwipes(this.root); }
    this.root.innerHTML = `<style>${CSS}</style><div class="small">Loading plants…</div>`;
    data().then((d) => this.render(d)).catch(() => { this.root.innerHTML = `<style>${CSS}</style><div class="small">Plants couldn't load.</div>`; });
  }
  set(html) { this.root.innerHTML = `<style>${CSS}</style>${html}`; }
}

// One plant, wide card with bloom ribbon and height
class PlantCard extends Base {
  render({ species, areas }) {
    const key = (this.getAttribute("plant") || "").toLowerCase();
    const sp = species.find((s) => s.slug === key || s.symbol.toLowerCase() === key || s.common.toLowerCase() === key);
    if (!sp) return this.set(`<div class="small">Plant "${esc(key)}" not found.</div>`);
    const where = sp.areas.map((a) => areas.find((x) => x.id === a.area)?.name).filter(Boolean);
    this.set(`<a class="wide" href="${link(sp)}" target="_top">
      ${pics(sp, { big: true, size: 64 })}
      <div class="body">
        <div class="name" style="font-size:1.6rem">${esc(sp.common)}</div>
        <div class="sci">${esc(sp.scientific)} · ${esc(TYPES[sp.type]?.one || "")}</div>
        <div class="facts paper"><div>${journalBloom(sp, BASE)}<div style="font-style:italic;margin-top:4px">${esc(bloomText(sp))}</div></div><div>${journalHeight(sp, BASE)}</div></div>
        ${where.length ? `<div class="small">At the Library: ${where.map(esc).join(", ")}</div>` : ""}
        <span class="more">Explore this plant</span>
      </div></a>`);
  }
}

// A grid of plants, filtered by area, type or month
class PlantGrid extends Base {
  render({ species, areas }) {
    const area = this.getAttribute("area");
    const type = this.getAttribute("type");
    const limit = +this.getAttribute("limit") || 0;
    const title = this.getAttribute("title");
    let list = species;
    const a = area && areas.find((x) => x.id === area);
    if (area) list = list.filter((s) => s.areas.some((x) => x.area === area));
    if (type) list = list.filter((s) => s.type === type);
    list = [...list].sort((x, y) => (x.images?.length ? 0 : 1) - (y.images?.length ? 0 : 1) || x.common.localeCompare(y.common));
    const shown = limit ? list.slice(0, limit) : list;
    const moreHref = area ? `${BASE}#/places/${area}` : BASE;
    this.set(`<div class="head"><h3>${esc(title || a?.name || "Native plants at the Library")}</h3><a class="more" href="${moreHref}" target="_top">See all ${list.length}</a></div>
      <div class="grid">${shown.map(card).join("")}</div>`);
  }
}

// What is usually blooming this month
class BloomNow extends Base {
  render({ species }) {
    const m = +this.getAttribute("month") || new Date().getMonth() + 1;
    const limit = +this.getAttribute("limit") || 8;
    const list = species.filter((s) => (s.bloom_months || []).includes(m) && s.traits?.flower_color)
      .sort((a, b) => (b.images?.length ? 1 : 0) - (a.images?.length ? 1 : 0) || a.common.localeCompare(b.common));
    if (!list.length) return this.set(`<div class="box"><div class="name">Winter at the Library</div><p class="small">The prairie is resting. Grasses and seed heads hold the color until spring.</p><a class="more" href="${BASE}#/bloom" target="_top">See the bloom clock</a></div>`);
    this.set(`<div class="head"><h3>Blooming in ${MONTH_NAMES[m - 1]}</h3><a class="more" href="${BASE}#/bloom/${m}" target="_top">All ${list.length} on the bloom clock</a></div>
      <div class="grid">${list.slice(0, limit).map(card).join("")}</div>`);
  }
}

// ZIP code hardiness check against the Library's plants
class ZoneCheck extends Base {
  render({ species }) {
    this.set(`<div class="box"><div class="name" style="font-size:1.4rem">Will these plants grow at your house?</div>
      <p class="small">Enter your ZIP code to find your USDA hardiness zone.</p>
      <div class="zip"><input inputmode="numeric" maxlength="5" placeholder="58645" aria-label="ZIP code"><button>Check</button></div><div class="out" aria-live="polite"></div>
      ${this.hasAttribute("no-map") ? "" : `<div class="map" style="margin-top:12px"></div>`}</div>`);
    const input = this.root.querySelector("input"), out = this.root.querySelector(".out");
    const mapEl = this.root.querySelector(".map");
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("pf-zone")); } catch {}
    if (saved?.zip) input.value = saved.zip;
    if (mapEl) renderZoneMap(mapEl, { zone: saved, base: BASE, legend: false });
    const go = async () => {
      const zip = input.value.trim();
      if (!/^\d{5}$/.test(zip)) { out.textContent = "Enter a five-digit ZIP code."; return; }
      try {
        const z = await lookupZone(zip);
        try { localStorage.setItem("pf-zone", JSON.stringify({ zip, ...z })); } catch {}
        if (mapEl) renderZoneMap(mapEl, { zone: { zip, ...z }, base: BASE, legend: false });
        const ok = species.filter((s) => growVerdict(s, z.zone).ok !== false);
        out.innerHTML = `<b>Zone ${esc(z.zone)}.</b> ${ok.length} of the Library's ${species.length} native plants grow well in your zone. <a class="more" href="${BASE}#/grow" target="_top">See which ones</a>`;
      } catch { out.textContent = "We couldn't find that ZIP code."; }
    };
    this.root.querySelector("button").addEventListener("click", go);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }
}

// The whole Plant Finder (browse, plant pages, bloom clock, map) in a self-sizing frame.
//   <trpl-plant-finder></trpl-plant-finder>
//   <trpl-plant-finder start="#/bloom"></trpl-plant-finder>
// Opens on search, filters and results; a plant opens its details with "Back to results".
class PlantFinder extends HTMLElement {
  connectedCallback() {
    if (this.frame) return;
    const start = this.getAttribute("start") || "#/";
    const f = (this.frame = document.createElement("iframe"));
    f.src = `${BASE}?embed=1${start.startsWith("#") ? start : "#" + start}`;
    f.title = this.getAttribute("title") || "Plant Finder: native plants of the Theodore Roosevelt Presidential Library";
    f.loading = "lazy";
    f.allow = "camera; clipboard-write";
    f.style.cssText = `width:100%;border:0;display:block;min-height:${this.getAttribute("min-height") || 900}px;height:1200px;`;
    this.style.display = "block";
    this.appendChild(f);
    this.onMsg = (e) => {
      if (e.source !== f.contentWindow || !e.data?.plantfinder) return;
      if (e.data.height) f.style.height = `${Math.ceil(e.data.height) + 4}px`;
      if (e.data.navigated && this.navigated) {
        // Instant, and repeated once layout settles: iOS Safari drops smooth or mid-swipe scrolls.
        const jump = () => {
          const top = this.getBoundingClientRect().top;
          if (top < 0 || top > window.innerHeight) window.scrollBy(0, top - 80);
        };
        jump(); clearTimeout(this.jumpTimer); this.jumpTimer = setTimeout(jump, 150);
      }
      if (e.data.navigated) this.navigated = true;
      if (typeof e.data.scrollTo === "number") {
        clearTimeout(this.jumpTimer);
        window.scrollTo({ top: this.getBoundingClientRect().top + window.scrollY + e.data.scrollTo - 80 });
      }
    };
    window.addEventListener("message", this.onMsg);
  }
  disconnectedCallback() { window.removeEventListener("message", this.onMsg); }
}

const define = (n, c) => customElements.get(n) || customElements.define(n, c);
define("trpl-plant-card", PlantCard);
define("trpl-plant-grid", PlantGrid);
define("trpl-bloom-now", BloomNow);
define("trpl-zone-check", ZoneCheck);
define("trpl-plant-finder", PlantFinder);
