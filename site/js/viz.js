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

export function sunText(sp) {
  const s = (sp?.traits?.shade_tolerance || "").toLowerCase();
  if (s === "intolerant") return ["Full sun", "Needs open sun all day"];
  if (s === "intermediate") return ["Sun to part shade", "Handles some afternoon shade"];
  if (s === "tolerant" || s === "high") return ["Sun or shade", "Grows in sun or shade"];
  return ["Sun", "Sun-loving prairie plant"];
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

export async function lookupZone(zip) {
  const r = await fetch(`https://phzmapi.org/${encodeURIComponent(zip)}.json`);
  if (!r.ok) throw new Error("ZIP code not found");
  return r.json(); // {zone, temperature_range, coordinates:{lat,lon}}
}

export function growVerdict(sp, zone) {
  const need = zoneNum(sp.hardy_to_zone);
  const have = zoneNum(zone);
  if (need == null) return { ok: null, text: `Your zone is ${zone}. USDA PLANTS doesn't record a cold limit for this plant; it grows wild in western North Dakota (zone 4a at the Library).` };
  if (have >= need) return { ok: true, text: `Yes. Your zone is ${zone}, and this plant is hardy to zone ${sp.hardy_to_zone}.` };
  return { ok: false, text: `Maybe not. Your zone is ${zone}, colder than this plant's zone ${sp.hardy_to_zone} limit.` };
}
