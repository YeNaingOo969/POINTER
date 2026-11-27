// Catalog every Buddhist pagoda, stupa, temple shrine, and monastery across Greater Yangon
// from OpenStreetMap (assets/raw/osm/yangon-pagodas.json) into public/data/pagodas.json.
//
//   node scripts/build-pagodas.mjs
//
// Excludes Shwedagon, Sule, and Botataung footprints (which already have hand-sculpted monuments
// in src/map/pagodas-3d.js) as well as non-Buddhist sites and unrelated tagged shops/streets.
// Outputs compact entries: { lng, lat, r, kind, name, en, my }
// where kind is one of: 'stupa_grand' | 'stupa_classic' | 'temple_hall' | 'monastery_hall'.
// Data © OpenStreetMap contributors (ODbL).
import fs from 'node:fs';
import path from 'node:path';
import { RAW, PUBLIC, rel, formatBytes } from './lib.mjs';

const IN = path.join(RAW, 'osm', 'yangon-pagodas.json');
const OUT = path.join(PUBLIC, 'data', 'pagodas.json');

const R_EARTH = 6378137;
const COS_168 = Math.cos((16.8 * Math.PI) / 180);
const distM = (lngA, latA, lngB, latB) =>
  Math.hypot((lngA - lngB) * (Math.PI / 180) * R_EARTH * COS_168, (latA - latB) * (Math.PI / 180) * R_EARTH);

// Hand-sculpted hero pagodas already built in pagodas-3d.js -> keep clear radius
const HERO_SCULPTED = [
  { lng: 96.14959, lat: 16.79834, r: 165 }, // Shwedagon
  { lng: 96.158764, lat: 16.774401, r: 52 }, // Sule
  { lng: 96.17184, lat: 16.76783, r: 52 }, // Botataung
];

const NON_BUDDHIST_RE = /\b(church|cathedral|chapel|baptist|catholic|methodist|anglican|presbyterian|mosque|masjid|surau|jamia|hindu|kovil|kali|mariamman|gurdwara|sikh|synagogue|bahai|baha'i|chinese temple|guanyin|kheng hock|joss)\b|ဟိန္ဒ|ဟိႏၵ|ဗလီ|ခရစ်|ကက်သလစ်|နှစ်ခြင်း|အစ္စလာမ်|မွတ်စလင်|ချာ့ချ်|တရုတ်ဘုံ/i;
const COMMERCE_RE = /\b(company|studio|design house|charcoal|store|mart|restaurant|cafe|bakery|hotel|motel|guest ?house|bank|clinic|office|pharmacy|salon)\b|\(shop\)/i;
const MONASTERY_RE = /\b(monastery|kyau?ng|vihara|dhammayone|dhamma ?hall|meditation|nunnery|retreat|ordination)\b|ကျောင်း|ေက်ာင္|ကြောငျ|ေကျာင္|ဓမ္မာရုံ|ရိပ်သာ|စာသင်တိုက်/i;
const STUPA_NAME_RE = /\b(pagoda|stupa|zedi|paya|hpaya|ceti|shrine|buddha|htat ?gyi|htut ?gyi|kyaik|kyite|shwe|swe taw|kaba aye|wizaya|meilamu)\b|စေတီ|ဘုရား|ပုထိုး|ကျိုက်|မြတ်စွာ|ထပ်ကြီး/i;
const HALL_NAME_RE = /\b(reclining|buddha temple|chaukhtat|chauk htat|ngahtat|nga htat|ko ?htat|koe ?htat|koe ?htut|tazaung|thein|cave|ordination hall)\b|လျောင်းတော်မူ|ထပ်ကြီး|တန်ဆောင်း|သိမ်|လှိုင်ဂူ/i;
const GRAND_RE = /\b(maha ?wizaya|mahawizaya|kaba ?aye|swe ?taw|kyauk ?taw|chaukhtat|ngahtat|meilamu|kyaik ?khauk|kyaik ?kalo|kyitewaing|kyaik ?waing|shwe ?phone ?pwint|moe ?kaung|pyi ?lone ?chan|kyaikkasan|ko ?htat|koe ?htut)\b/i;

const CURATED_NAMES = new Map([
  ['relation/2409874', { en: 'Maha Wizaya Pagoda', my: 'မဟာဝိဇယ စေတီတော်', kind: 'stupa_grand' }],
  ['way/186911800', { en: 'Kaba Aye Pagoda', my: 'ကမ္ဘာအေး စေတီတော်', kind: 'stupa_grand' }],
  ['way/342925229', { en: 'Kyaikkasan Pagoda', my: 'ကျိုက္ကဆံ စေတီတော်', kind: 'stupa_grand' }],
  ['way/448654971', { en: 'Kyaik Kalei Pagoda', my: 'ကျိုက္ကလဲ့ စေတီတော်', kind: 'stupa_grand' }],
  ['way/399545334', { en: 'Meilamu Pagoda', my: 'မယ်လမု ဘုရား', kind: 'stupa_grand' }],
  ['way/1549540346', { en: 'Bargayar Monastery', my: 'ဗားကရာ ကျောင်းတိုက်', kind: 'monastery_hall' }],
]);

const raw = JSON.parse(fs.readFileSync(IN, 'utf8'));
const candidates = [];

for (const el of raw.elements) {
  const t = el.tags || {};
  if (t.highway || t.railway || t.shop || t.office || t.public_transport || t.bus || t.craft) continue;
  if (t.amenity && !['place_of_worship', 'monastery'].includes(t.amenity)) continue;
  if (t.tourism && !['attraction', 'viewpoint', 'yes'].includes(t.tourism)) continue;
  if (t.religion && t.religion !== 'buddhist') continue;

  const lat = el.lat ?? (el.bounds ? (el.bounds.minlat + el.bounds.maxlat) / 2 : el.center?.lat);
  const lng = el.lon ?? (el.bounds ? (el.bounds.minlon + el.bounds.maxlon) / 2 : el.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

  const enRaw = (t['name:en'] || t['name:latin'] || '').trim();
  const myRaw = (t['name:my'] || t.name || '').trim();
  const displayRaw = (enRaw || myRaw).trim();
  const hay = `${displayRaw} ${myRaw} ${t.alt_name || ''} ${t['alt_name:en'] || ''}`.trim();

  if (NON_BUDDHIST_RE.test(hay) || COMMERCE_RE.test(hay)) continue;

  const isExplicitBuddhist =
    t.religion === 'buddhist' ||
    ['pagoda', 'stupa', 'temple', 'shrine'].includes(t.building) ||
    t.man_made === 'stupa' ||
    ['pagoda', 'temple', 'stupa'].includes(t.historic) ||
    t.building === 'religious';
  const isNamedBuddhist = STUPA_NAME_RE.test(hay) || MONASTERY_RE.test(hay);
  if (!isExplicitBuddhist && !isNamedBuddhist) continue;

  // Skip inside already hand-sculpted Shwedagon / Sule / Botataung grounds
  if (HERO_SCULPTED.some((h) => distM(lng, lat, h.lng, h.lat) < h.r)) continue;

  const w = el.bounds ? (el.bounds.maxlon - el.bounds.minlon) * (Math.PI / 180) * R_EARTH * COS_168 : 0;
  const d = el.bounds ? (el.bounds.maxlat - el.bounds.minlat) * (Math.PI / 180) * R_EARTH : 0;
  const span = Math.max(w, d);
  const key = `${el.type}/${el.id}`;
  const curated = CURATED_NAMES.get(key);
  const isCompoundWrapper = !curated && !GRAND_RE.test(hay) && (t.landuse === 'religious' || (el.type !== 'node' && !t.building && !t.man_made && span > 95));

  let kind;
  if (curated?.kind) {
    kind = curated.kind;
  } else if (
    (MONASTERY_RE.test(hay) || t.amenity === 'monastery') &&
    !/\b(pagoda|stupa|zedi)\b|စေတီ|ပုထိုး|ကျိုက်/i.test(hay) &&
    !['pagoda', 'stupa'].includes(t.building) &&
    t.man_made !== 'stupa'
  ) {
    kind = 'monastery_hall';
  } else if (HALL_NAME_RE.test(hay) && !GRAND_RE.test(hay)) {
    kind = 'temple_hall';
  } else if (GRAND_RE.test(hay)) {
    kind = HALL_NAME_RE.test(hay) && !/kyauk ?taw/i.test(hay) ? 'temple_hall' : 'stupa_grand';
  } else if (t.building === 'temple' && w > 28 && d > 28) {
    kind = 'temple_hall';
  } else if ((t.building === 'pagoda' || t.man_made === 'stupa' || STUPA_NAME_RE.test(hay)) && span >= 48) {
    kind = 'stupa_grand';
  } else {
    kind = 'stupa_classic';
  }

  let r = 10.5;
  if (kind === 'stupa_grand') r = Math.min(34, Math.max(18, Math.round((span ? span * 0.38 : 22) * 10) / 10));
  else if (kind === 'temple_hall') r = Math.min(34, Math.max(16, Math.round((span ? span * 0.42 : 20) * 10) / 10));
  else if (kind === 'monastery_hall') r = Math.min(20, Math.max(11, Math.round((span ? Math.min(span * 0.32, 20) : 13) * 10) / 10));
  else r = Math.min(16.5, Math.max(8.5, Math.round((span ? Math.min(span * 0.42, 16.5) : 10.5) * 10) / 10));

  const en = curated?.en || enRaw || (STUPA_NAME_RE.test(myRaw) ? '' : '');
  const my = curated?.my || myRaw;
  const name = curated?.en || displayRaw || (kind === 'monastery_hall' ? 'Buddhist Monastery' : 'Pagoda');

  candidates.push({
    key,
    lng: +lng.toFixed(6),
    lat: +lat.toFixed(6),
    r,
    kind,
    name,
    en: curated?.en || enRaw,
    my,
    isCompoundWrapper,
    bounds: el.bounds || null,
    priority: (curated ? 40 : 0) + (kind === 'stupa_grand' ? 20 : kind === 'temple_hall' ? 16 : kind === 'stupa_classic' ? 12 : 4) + (el.type !== 'node' ? 6 : 0) + (displayRaw ? 3 : 0),
  });
}

// Drop large landuse=religious / campus wrappers if specific buildings exist inside them
const specificPts = candidates.filter((c) => !c.isCompoundWrapper);
const usable = candidates.filter((c) => {
  if (!c.isCompoundWrapper || !c.bounds) return true;
  const hasInner = specificPts.some((p) =>
    p.lng >= c.bounds.minlon && p.lng <= c.bounds.maxlon &&
    p.lat >= c.bounds.minlat && p.lat <= c.bounds.maxlat &&
    p.key !== c.key);
  return !hasInner;
});

// Highest priority wins when merging nearby duplicate OSM node+way entries (22m, or 55m if named alike)
usable.sort((a, b) => b.priority - a.priority || b.r - a.r);
const finalList = [];
for (const c of usable) {
  const dup = finalList.find((o) => {
    const d = distM(o.lng, o.lat, c.lng, c.lat);
    if (d < 22) return true;
    if (d < 65 && o.name && c.name && o.name.toLowerCase() === c.name.toLowerCase()) return true;
    return false;
  });
  if (dup) {
    if (!dup.en && c.en) dup.en = c.en;
    if (!dup.my && c.my) dup.my = c.my;
    if ((dup.name === 'Pagoda' || dup.name === 'Buddhist Monastery') && c.name !== 'Pagoda') dup.name = c.name;
    continue;
  }
  finalList.push({
    lng: c.lng,
    lat: c.lat,
    r: c.r,
    kind: c.kind,
    name: c.name,
    ...(c.en ? { en: c.en } : {}),
    ...(c.my && c.my !== c.en ? { my: c.my } : {}),
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(finalList));

const counts = finalList.reduce((m, x) => { m[x.kind] = (m[x.kind] || 0) + 1; return m; }, {});
console.log(`${finalList.length} Yangon pagodas & temples → ${rel(OUT)} (${formatBytes(fs.statSync(OUT).size)})`, counts);
