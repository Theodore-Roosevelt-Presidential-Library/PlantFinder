// Shared drawing helpers for the PlantFinder site and its embeds.
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const TYPES = {
  grass: { label: "Grasses", one: "Grass" },
  sedge: { label: "Sedges", one: "Sedge" },
  wildflower: { label: "Wildflowers", one: "Wildflower" },
  shrub: { label: "Shrubs and trees", one: "Shrub or tree" },
  "cactus-yucca": { label: "Cactus and yucca", one: "Cactus or yucca" },
};

// USDA PLANTS flower colors, drawn in tones that sit with the brand palette
export const FLOWER = {
  White: "#F4F1E6", Yellow: "#F9D635", Purple: "#8E5FA8", Blue: "#5B7FC4", Red: "#D2433F",
  Orange: "#FC924E", Green: "#87BB41", Brown: "#8C6A4A", Pink: "#F36079",
};
export const flowerColor = (sp) => FLOWER[sp?.traits?.flower_color] || "#C9C2AF";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function heroImage(sp) {
  return (sp.images || [])[0] || null;
}
export const imgSrc = (img, base = "") => (img?.src ? base + img.src : img?.url);

// 12-cell bloom ribbon. Filled months take the flower color; the current month is outlined.
export function bloomRibbon(sp, { width = 240, height = 26, labels = true } = {}) {
  const months = new Set(sp.bloom_months || []);
  const col = flowerColor(sp);
  const cw = width / 12;
  const now = new Date().getMonth() + 1;
  const h = labels ? height - 12 : height;
  let s = `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="${esc(bloomText(sp))}">`;
  for (let m = 1; m <= 12; m++) {
    const x = (m - 1) * cw;
    const on = months.has(m);
    s += `<rect x="${x + 1}" y="0" width="${cw - 2}" height="${h}" rx="3" fill="${on ? col : "#ECE8DE"}" stroke="${on ? "rgba(37,40,42,.35)" : "none"}" stroke-width=".6"/>`;
    if (m === now) s += `<rect x="${x + .5}" y="-.5" width="${cw - 1}" height="${h + 1}" rx="3.5" fill="none" stroke="#25282A" stroke-width="1.4"/>`;
    if (labels) s += `<text x="${x + cw / 2}" y="${height - 1}" text-anchor="middle" font-size="9" font-family="Source Sans 3, sans-serif" fill="#5D615F">${MONTHS[m - 1][0]}</text>`;
  }
  return s + "</svg>";
}

export function bloomText(sp) {
  const m = sp.bloom_months || [];
  if (!m.length) return sp.type === "grass" || sp.type === "sedge" ? "Grass or sedge; flowers are small" : "Bloom time not recorded";
  // compress consecutive runs
  const runs = [];
  let start = m[0], prev = m[0];
  for (const x of m.slice(1).concat([null])) {
    if (x === prev + 1) { prev = x; continue; }
    runs.push(start === prev ? MONTH_NAMES[start - 1] : `${MONTH_NAMES[start - 1]} to ${MONTH_NAMES[prev - 1]}`);
    start = prev = x;
  }
  return "Blooms " + runs.join(", ");
}

// Height silhouette next to a 6-foot person.
export function silhouette(sp, { size = 150 } = {}) {
  const ft = sp?.traits?.height_ft;
  const H = size, base = H - 8, scale = (H - 20) / Math.max(6.5, ft || 0);
  const ph = 6 * scale, px = 26;
  const plantH = Math.max(4, (ft || 0) * scale);
  const col = flowerColor(sp);
  const green = "#3E7D4F";
  const cx = 95;
  let plant = "";
  const t = sp.type;
  if (!ft) {
    plant = `<text x="${cx}" y="${base - 10}" text-anchor="middle" font-size="11" font-family="Source Sans 3, sans-serif" fill="#5D615F">height not recorded</text>`;
  } else if (t === "grass" || t === "sedge") {
    for (let i = -5; i <= 5; i++) {
      const tipX = cx + i * 4 + i * plantH * 0.06;
      plant += `<path d="M${cx + i * 1.5} ${base} Q${cx + i * 2.5} ${base - plantH * .6} ${tipX} ${base - plantH * (0.75 + 0.25 * Math.cos(i / 3))}" stroke="${green}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    }
  } else if (t === "shrub") {
    const w = Math.min(70, plantH * 1.1 + 14);
    plant = `<path d="M${cx - w / 2} ${base} C${cx - w / 2} ${base - plantH * 1.1}, ${cx + w / 2} ${base - plantH * 1.1}, ${cx + w / 2} ${base} Z" fill="${green}" opacity=".85"/>` +
      `<line x1="${cx}" y1="${base}" x2="${cx}" y2="${base - plantH * .3}" stroke="#6B4F35" stroke-width="3"/>`;
  } else if (t === "cactus-yucca") {
    if (sp.scientific?.startsWith("Yucca")) {
      for (let i = -6; i <= 6; i++) plant += `<line x1="${cx}" y1="${base}" x2="${cx + i * plantH * .09}" y2="${base - plantH * (1 - Math.abs(i) / 14)}" stroke="${green}" stroke-width="2" stroke-linecap="round"/>`;
    } else {
      plant = `<ellipse cx="${cx}" cy="${base - plantH / 2}" rx="${Math.max(7, plantH * .45)}" ry="${plantH / 2}" fill="${green}"/>` +
        `<circle cx="${cx}" cy="${base - plantH}" r="4" fill="${col}"/>`;
    }
  } else {
    plant = `<path d="M${cx} ${base} L${cx} ${base - plantH}" stroke="${green}" stroke-width="2"/>` +
      `<path d="M${cx} ${base - plantH * .4} q -10 -6 -14 -2 M${cx} ${base - plantH * .6} q 10 -6 14 -2" stroke="${green}" stroke-width="2" fill="none"/>` +
      `<circle cx="${cx}" cy="${base - plantH}" r="${Math.max(4, Math.min(9, plantH * .12))}" fill="${col}" stroke="rgba(37,40,42,.4)" stroke-width=".8"/>`;
  }
  const hx = px, top = base - ph;
  const person = `<g fill="#99ADC5"><circle cx="${hx}" cy="${top + ph * .07}" r="${ph * .07}"/>` +
    `<rect x="${hx - ph * .085}" y="${top + ph * .15}" width="${ph * .17}" height="${ph * .4}" rx="${ph * .05}"/>` +
    `<rect x="${hx - ph * .08}" y="${top + ph * .52}" width="${ph * .07}" height="${ph * .48}" rx="${ph * .03}"/>` +
    `<rect x="${hx + ph * .01}" y="${top + ph * .52}" width="${ph * .07}" height="${ph * .48}" rx="${ph * .03}"/></g>`;
  const label = ft ? `${fmtFeet(ft)}` : "";
  return `<svg viewBox="0 0 150 ${H}" width="100%" role="img" aria-label="Grows about ${esc(label)} tall, shown next to a 6-foot person">` +
    `<line x1="4" y1="${base}" x2="146" y2="${base}" stroke="#8C7E64" stroke-width="1.5"/>` + person + plant +
    `<text x="${px}" y="${H}" text-anchor="middle" font-size="9" font-family="Source Sans 3, sans-serif" fill="#5D615F">6 ft</text>` +
    (ft ? `<text x="${cx}" y="${H}" text-anchor="middle" font-size="9" font-family="Source Sans 3, sans-serif" fill="#5D615F">${esc(label)}</text>` : "") +
    `</svg>`;
}

export function fmtFeet(ft) {
  if (ft == null) return "";
  if (ft < 1) return `${Math.round(ft * 12)} in`;
  return `${(+ft).toFixed(ft % 1 ? 1 : 0)} ft`;
}

// Light comes from the Library's own planting plans, which record sun or shade for each
// planting area. (USDA PLANTS shade-tolerance values proved unreliable for these species.)
export function sunText(sp) {
  const ids = (sp?.areas || []).map((a) => a.area);
  if (ids.includes("shade-rock-garden")) return ["Sun or shade", "Planted in the Library's shade garden as well as in sun"];
  if (ids.includes("berm-faces") || ids.includes("living-fire-lane")) return ["Sun to part shade", "Planted where it gets some shade during the day"];
  return ["Full sun", "Planted in open sun, like the prairie around it"];
}
export function sunArt(sp) {
  const [label] = sunText(sp);
  return label === "Sun or shade" ? "shade" : label === "Sun to part shade" ? "partsun" : "sun";
}
export function waterText(sp) {
  const d = (sp?.traits?.drought_tolerance || "").toLowerCase();
  if (d === "high") return ["Dry", "Very drought tolerant once established"];
  if (d === "medium") return ["Average", "Moderate water; tolerates some drought"];
  if (d === "low" || d === "none") return ["Moist", "Prefers steady moisture"];
  return ["Dry to average", "Typical of the mixed-grass prairie"];
}

export const sunIcon = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="#F9D635"/><g stroke="#E7805D" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g></svg>`;
export const dropIcon = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 2.5C9 7 5.5 10.6 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10.6 15 7 12 2.5z" fill="#99ADC5" stroke="#092A4D" stroke-width="1.2"/></svg>`;
export const snowIcon = `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g stroke="#092A4D" stroke-width="1.8" stroke-linecap="round"><path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10"/></g></svg>`;

export function typeIcon(t, size = 28) {
  const g = "#1B4532";
  const icons = {
    grass: `<path d="M12 22c0-6-1-11-5-16M12 22c0-7 1-12 5-17M12 22V4" stroke="${g}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    sedge: `<path d="M12 22L12 6M12 22L6 9M12 22l6-13" stroke="${g}" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M12 6l-1.5-3h3z" fill="${g}"/>`,
    wildflower: `<path d="M12 22v-9" stroke="${g}" stroke-width="1.8"/><circle cx="12" cy="8" r="2.4" fill="#F9D635"/><g fill="#E7805D"><circle cx="12" cy="4" r="2.2"/><circle cx="16" cy="8" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="8" cy="8" r="2.2"/></g>`,
    shrub: `<path d="M4 18c0-7 4-11 8-11s8 4 8 11z" fill="${g}"/><path d="M12 18v4" stroke="#6B4F35" stroke-width="2.4"/>`,
    "cactus-yucca": `<path d="M12 22V5a2 2 0 0 1 4 0v17M8 14V9a2 2 0 0 1 4 0M16 12h2a2 2 0 0 0 2-2V8" stroke="${g}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  };
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${icons[t] || icons.wildflower}</svg>`;
}

// Zones as numbers for comparison: "4a" -> 4.0, "4b" -> 4.5
export const zoneNum = (z) => (z ? parseInt(z, 10) + (/b$/.test(z) ? 0.5 : 0) : null);

// Zone range a plant grows well in: cold end from USDA and wild records, warm end from
// where it grows wild (scripts/zonemap/zone_ranges.py). Null ends mean "not known".
export function plantRange(sp) {
  const r = sp?.zone_range;
  return { min: r?.min || sp?.hardy_to_zone || null, max: r?.max || null };
}
export function rangeText(sp) {
  const { min, max } = plantRange(sp);
  if (min && max) return `Zones ${min} to ${max}`;
  if (min) return `Zone ${min} and warmer`;
  return null;
}

export async function lookupZone(zip) {
  const r = await fetch(`https://phzmapi.org/${encodeURIComponent(zip)}.json`);
  if (!r.ok) throw new Error("ZIP code not found");
  return r.json(); // {zone, temperature_range, coordinates:{lat,lon}}
}

export function growVerdict(sp, zone) {
  const { min, max } = plantRange(sp);
  const have = zoneNum(zone);
  if (!min) return { ok: null, text: `Your zone is ${zone}. USDA PLANTS doesn't record a cold limit for this plant; it grows wild in western North Dakota (zone 4a at the Library).` };
  const range = max ? `zones ${min} to ${max}` : `zone ${min} and warmer`;
  if (have < zoneNum(min)) return { ok: false, text: `Probably not. Your zone is ${zone}, colder than this plant's range (${range}).` };
  if (max && have > zoneNum(max)) return { ok: false, text: `It may struggle. Your zone is ${zone}, warmer than where this plant grows wild (${range}).` };
  return { ok: true, text: `Yes. Your zone is ${zone}, inside this plant's range (${range}).` };
}

// ---------- Field journal: watercolor at-a-glance notes ----------
// Art in site/art/ is hand-painted-style watercolor (generated for the Library), transparent PNG.
const FORM_ART = { grass: "grass", sedge: "sedge", wildflower: "wildflower", shrub: "shrub", "cactus-yucca": "cactus" };
function formArt(sp) {
  if (sp.scientific?.startsWith("Yucca")) return "yucca";
  if (sp.type === "shrub" && (sp.traits?.height_ft || 0) >= 9) return "tree";
  return FORM_ART[sp.type] || "wildflower";
}

// A watercolor blot tinted to any color (the blot art is used as a mask).
export function blot(color, size = 34, base = "", extra = "") {
  const u = `url(${base}art/blot.webp)`;
  if (color === FLOWER.White) {  // white wash: no texture (it would read as gray), faint ink edge instead
    return `<span class="wc-blot white" style="width:${size}px;height:${size}px;background:#fffdf6;-webkit-mask-image:${u};mask-image:${u};${extra}"></span>`;
  }
  return `<span class="wc-blot" style="width:${size}px;height:${size}px;background:${u} center/contain no-repeat, ${color};background-blend-mode:multiply;-webkit-mask-image:${u};mask-image:${u};${extra}"></span>`;
}

export function journalBloom(sp, base = "") {
  const months = new Set(sp.bloom_months || []);
  const col = flowerColor(sp);
  const now = new Date().getMonth() + 1;
  return `<div class="wc-months" role="img" aria-label="${esc(bloomText(sp))}">${MONTHS.map((m, i) => {
    const on = months.has(i + 1);
    return `<span class="wc-month${i + 1 === now ? " now" : ""}">${on ? blot(col, 30, base, `opacity:${0.78 + (i % 3) * 0.07}`) : `<span class="wc-empty"></span>`}<b>${m[0]}</b></span>`;
  }).join("")}</div>`;
}

export function journalHeight(sp, base = "") {
  const ft = sp?.traits?.height_ft;
  const H = 150; // px for the taller of person (6 ft) and plant
  const scale = H / Math.max(6, ft || 0);
  const personH = 6 * scale;
  const plantH = ft ? Math.max(14, ft * scale) : 0;
  const art = formArt(sp);
  const plantW = ["shrub", "cactus", "grass"].includes(art) ? plantH * 1.35 : plantH * 0.62;
  return `<div class="wc-height" role="img" aria-label="${ft ? `Grows about ${esc(fmtFeet(ft))} tall, shown beside a 6-foot person` : "Height not recorded"}">
    <div class="wc-stage" style="height:${H + 6}px">
      <img src="${base}art/person.webp" alt="" style="height:${personH}px">
      ${ft ? `<img src="${base}art/${art}.webp" alt="" style="height:${plantH}px;max-width:${Math.max(plantW, 30)}px">` : `<span class="wc-note">not recorded</span>`}
    </div>
    <svg class="wc-ground" viewBox="0 0 200 6" preserveAspectRatio="none" aria-hidden="true"><path d="M2 3 C 40 1.5, 80 4.5, 120 2.8 S 180 2, 198 3.4" stroke="#5b4630" stroke-width="1.3" fill="none" stroke-linecap="round"/></svg>
    <div class="wc-scale"><span>6 ft</span>${ft ? `<span>${esc(fmtFeet(ft))}</span>` : ""}</div>
  </div>`;
}

export function journalGlance(sp, base = "") {
  const t = sp.traits || {};
  const [sun, sunD] = sunText(sp);
  const [water, waterD] = waterText(sp);
  const drought = (t.drought_tolerance || "").toLowerCase();
  const drops = drought === "high" ? 1 : drought === "medium" ? 2 : (drought === "low" || drought === "none") ? 3 : 1;
  const dropsHtml = [1, 2, 3].map((i) => `<img src="${base}art/drop.webp" alt="" class="${i <= drops ? "" : "faint"}">`).join("");
  return `<section class="journal" aria-label="At a glance">
    <div class="journal-head"><span class="jh-title">Field notes</span><span class="jh-sci">${esc(sp.scientific)}</span></div>
    <div class="jn jn-bloom"><span class="jl">In bloom</span>${journalBloom(sp, base)}<span class="jd">${esc(bloomText(sp))}</span></div>
    <div class="jn jn-height"><span class="jl">Height</span>${journalHeight(sp, base)}</div>
    <div class="jn"><span class="jl">Light</span><img class="jart" src="${base}art/${sunArt(sp)}.webp" alt=""><span class="jv">${esc(sun)}</span><span class="jd">${esc(sunD)}</span></div>
    <div class="jn"><span class="jl">Water</span><span class="jdrops">${dropsHtml}</span><span class="jv">${esc(water)}</span><span class="jd">${esc(waterD)}</span></div>
    <div class="jn"><span class="jl">Zones</span><img class="jart" src="${base}art/snow.webp" alt=""><span class="jv">${esc(rangeText(sp) || "Very hardy")}</span><span class="jd">${t.min_temp_f != null ? `Survives about ${t.min_temp_f}°F` : "Grows wild in western North Dakota"}</span></div>
    ${t.flower_color ? `<div class="jn"><span class="jl">Flower</span>${blot(flowerColor(sp), 64, base)}<span class="jv">${esc(t.flower_color)}</span></div>` : ""}
  </section>`;
}

// ---------- Watercolor hardiness-zone map ----------
// data/zonemap.svg holds one layer per half zone (<g id="zone-4a" class="zone">), drawn from
// the 2023 USDA PHZM temperature grid. Layers are switched on per plant with CSS classes.
const R = Math.PI / 180;
export function albersUsa(lon, lat) {  // matches d3.geoAlbers().scale(1300).translate([487.5, 305])
  const y0 = 29.5 * R, y1 = 45.5 * R, sy0 = Math.sin(y0), n = (sy0 + Math.sin(y1)) / 2;
  const c = 1 + sy0 * (2 * n - sy0), r0 = Math.sqrt(c) / n;
  const raw = (x, y) => { const r = Math.sqrt(c - 2 * n * Math.sin(y)) / n; x *= n; return [r * Math.sin(x), r0 - r * Math.cos(x)]; };
  const k = 1300, [cx, cy] = raw(-0.6 * R, 38.7 * R), [x, y] = raw((lon + 96) * R, lat * R);
  return [487.5 + k * (x - cx), 305 - k * (y - cy)];
}
const LOWER48 = (lat, lon) => lat > 24 && lat < 50 && lon > -125.5 && lon < -66;

const svgCache = {};
function loadZoneSvg(base) {
  svgCache[base] ||= fetch(`${base}data/zonemap.svg`).then((r) => r.text());
  return svgCache[base];
}

// opts: { plant, zone: {zone, zip, coordinates:{lat, lon}}, base, legend: true }
export async function renderZoneMap(el, { plant = null, zone = null, base = "", legend = true } = {}) {
  const svg = await loadZoneSvg(base);
  const rng = plant ? plantRange(plant) : { min: null, max: null };
  const lo = zoneNum(rng.min), hi = zoneNum(rng.max);
  el.classList.add("zonemap");
  el.classList.toggle("for-plant", !!plant);
  el.innerHTML = `<div class="zm-frame">${svg}</div>`;
  const layers = [...el.querySelectorAll(".zone")];
  for (const g of layers) {
    const z = g.dataset.zone;
    const zn = zoneNum(z);
    g.classList.toggle("ok", !plant || ((lo == null || zn >= lo) && (hi == null || zn <= hi)));
    g.classList.toggle("mine", !!zone && z === zone.zone);
  }
  const pins = el.querySelector(".pins");
  const pin = (lon, lat, label, cls) => {
    const [x, y] = albersUsa(lon, lat);
    pins.insertAdjacentHTML("beforeend", `<g class="pin ${cls}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="8"/><circle r="2.8" class="dot"/><text x="13" y="6">${esc(label)}</text></g>`);
  };
  pin(-103.5244, 46.9139, "Medora", "medora");
  const c = zone?.coordinates;
  if (c && LOWER48(+c.lat, +c.lon)) pin(+c.lon, +c.lat, `You (${zone.zone})`, "you");
  if (legend) {
    const zs = layers.map((g) => g.dataset.zone);
    el.insertAdjacentHTML("beforeend", `<div class="zm-legend" aria-hidden="true">${layers.map((g) =>
      `<span class="zm-key${g.classList.contains("ok") ? " ok" : ""}${g.classList.contains("mine") ? " mine" : ""}">${blot(plant && !g.classList.contains("ok") ? "#b9b4aa" : g.style.getPropertyValue("--zc"), 22, base)}<b>${g.dataset.zone}</b></span>`).join("")}</div>`);
    void zs;
  }
  const caption = plant
    ? (rng.min && rng.max
      ? `Painted zones (${rng.min} to ${rng.max}) are where ${plant.common.toLowerCase()} grows well, from its cold limit and where it grows wild across the U.S. Gray zones are too cold or too warm.`
      : rng.min
        ? `Painted zones are where ${plant.common.toLowerCase()} should survive the winter: zone ${rng.min} and warmer. Gray zones are too cold.`
        : `Cold limit not recorded for this plant. It grows wild in western North Dakota (Medora is zone 4a).`)
    : `Hardiness zones of the lower 48 states. Each zone is 10°F of average winter low; a and b split it in half.`;
  el.insertAdjacentHTML("beforeend", `<p class="zm-cap">${esc(caption)}${c && !LOWER48(+c.lat, +c.lon) ? " Your ZIP code is outside the lower 48, so it isn't pinned." : ""}</p>
    <p class="zm-src">Drawn from the 2023 USDA Plant Hardiness Zone Map temperature data (PRISM Climate Group, Oregon State University; USDA-ARS), simplified and painted for this guide. This is not the official USDA Plant Hardiness Zone Map; see <a href="https://planthardiness.ars.usda.gov/" target="_blank" rel="noopener">planthardiness.ars.usda.gov</a>.</p>`);
}
