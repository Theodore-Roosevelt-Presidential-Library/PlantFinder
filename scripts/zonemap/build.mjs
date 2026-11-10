import fs from "fs";
import { geoAlbers, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";
const proj = geoAlbers().scale(1300).translate([487.5, 305]);  // same layout as us-atlas *-albers files
const path = geoPath(proj).digits(1);
const zones = JSON.parse(fs.readFileSync(new URL("zones.geojson", import.meta.url)));
const us = JSON.parse(fs.readFileSync(new URL("node_modules/us-atlas/", import.meta.url).pathname + "states-albers-10m.json"));
const nat = JSON.parse(fs.readFileSync(new URL("node_modules/us-atlas/", import.meta.url).pathname + "nation-albers-10m.json"));
const ident = geoPath().digits(1);  // albers files are already projected
const lower48 = { type: "FeatureCollection", features: feature(us, us.objects.states).features.filter((f) => !["02", "15", "72"].includes(f.id)) };
const lower48ids = new Set(lower48.features.map((f) => f.id));
const stateLines = ident(mesh(us, us.objects.states, (a, b) => a !== b && lower48ids.has(a.id) && lower48ids.has(b.id)));
const outline = ident({ type: "FeatureCollection", features: lower48.features });
// Watercolor ramp, cold to warm, drawn from the brand palette
const ramp = ["#3f5f8f","#4f74a6","#6488b8","#7c9cc4","#93b1c9","#9fc3bf","#a9cfa7","#8fc895","#a7c96a","#87bb41","#c3cf4e","#e9d34a","#f9d635","#f8bf47","#fca55a","#fc924e","#ee8458","#e7805d","#ef7068","#f36079","#e45577","#cf4c78","#b84778","#a04277","#883c73","#70366c"];
const idx = (z) => (parseInt(z) - 1) * 2 + (z.endsWith("b") ? 1 : 0);
let g = "";
for (const f of zones.features) {
  const z = f.properties.zone;
  g += `<g id="zone-${z}" class="zone" data-zone="${z}" data-min="${f.properties.min_f}" style="--zc:${ramp[idx(z)]}"><title>Zone ${z}: ${f.properties.min_f} to ${f.properties.max_f}°F</title><path d="${path(f)}"/></g>\n`;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 975 610" class="zonemap-svg" role="img" aria-labelledby="zm-title">
<title id="zm-title">Plant hardiness zones of the lower 48 states, painted in watercolor</title>
<defs>
  <filter id="wc-bleed" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="7" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="0.6" result="b"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="grain"/>
    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.15" result="grainA"/>
    <feComposite in="b" in2="grainA" operator="in"/>
  </filter>
  <filter id="wc-ink" x="-2%" y="-2%" width="104%" height="104%">
    <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="11" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</defs>
<g class="zones" filter="url(#wc-bleed)">
${g}</g>
<path class="nation" d="${outline}" filter="url(#wc-ink)"/>
<path class="states" d="${stateLines}" filter="url(#wc-ink)"/>
<g class="pins"></g>
</svg>`;
fs.writeFileSync(new URL("../../site/data/zonemap.svg", import.meta.url), svg);
// reference points to check the browser projection against
const pts = [[-103.5244, 46.9139], [-96.8, 32.78], [-122.33, 47.6], [-80.19, 25.76], [-70.25, 43.66]];
console.log(JSON.stringify(pts.map((p) => proj(p).map((v) => +v.toFixed(2)))));
