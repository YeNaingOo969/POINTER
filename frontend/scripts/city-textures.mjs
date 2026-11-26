// Generate clean, architectural PBR-ready diffuse textures for the 3D city tiles
// (public/models/city/tex/*.jpg) using sharp (SVG -> crisp antialiased JPEG).
// Run: node scripts/city-textures.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT } from './lib.mjs';

const OUT = path.join(ROOT, 'public', 'models', 'city', 'tex');
fs.mkdirSync(OUT, { recursive: true });

// Deterministic PRNG for subtle natural plaster/stone micro-grain
function makeSeeded(seed = 17) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Add subtle, fine micro-grain directly to RGBA buffer (keeps architectural lines razor crisp). */
async function renderSvgToJpg(svg, outPath, { size = 1024, grain = 3, quality = 90 } = {}) {
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(size, size)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (grain > 0) {
    const rand = makeSeeded(size + outPath.length * 31);
    for (let i = 0; i < data.length; i += 4) {
      const n = ((rand() - 0.5) * 2 * grain) | 0;
      data[i] = Math.max(0, Math.min(255, data[i] + n));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
  }

  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .jpeg({ quality, mozjpeg: true })
    .toFile(outPath);
}

// 1. apartment.jpg — 1 bay × 1 storey (clean modern Yangon walk-up / condo bay)
const apartmentSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ECEBE6"/>
      <stop offset="8%" stop-color="#F7F6F2"/>
      <stop offset="92%" stop-color="#F3F1EC"/>
      <stop offset="100%" stop-color="#E7E4DC"/>
    </linearGradient>
    <linearGradient id="slabShadow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="glassSky" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#9AC6E6"/>
      <stop offset="52%" stop-color="#6B98BA"/>
      <stop offset="100%" stop-color="#4A6B86"/>
    </linearGradient>
    <linearGradient id="glint" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.34"/>
      <stop offset="45%" stop-color="#FFFFFF" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="balcGlass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#B9D9EE" stop-opacity="0.65"/>
      <stop offset="100%" stop-color="#7EA6C2" stop-opacity="0.72"/>
    </linearGradient>
  </defs>

  <!-- Clean plaster wall -->
  <rect width="1024" height="1024" fill="url(#wall)"/>

  <!-- Top architectural floor-slab cornice & soft drop shadow -->
  <rect x="0" y="0" width="1024" height="58" fill="#E3E0D8"/>
  <rect x="0" y="56" width="1024" height="6" fill="#CFCBC1"/>
  <rect x="0" y="62" width="1024" height="54" fill="url(#slabShadow)"/>

  <!-- Subtle architectural vertical pier pilasters at bay edges -->
  <rect x="0" y="62" width="44" height="962" fill="#EEECE6" opacity="0.7"/>
  <rect x="980" y="62" width="44" height="962" fill="#EEECE6" opacity="0.7"/>

  <!-- Recessed modern double-window + balcony door bay -->
  <rect x="168" y="176" width="688" height="568" rx="10" fill="#D5D2CA"/>
  <rect x="182" y="190" width="660" height="540" rx="6" fill="#3B4249"/>

  <!-- Window glass panes (3 clean architectural sashes) -->
  <rect x="200" y="208" width="194" height="504" fill="url(#glassSky)"/>
  <rect x="414" y="208" width="196" height="504" fill="url(#glassSky)"/>
  <rect x="630" y="208" width="194" height="504" fill="url(#glassSky)"/>

  <!-- Soft warm interior curtain / blind depth on left & right panes -->
  <rect x="200" y="208" width="84" height="504" fill="#FFF2DC" opacity="0.24"/>
  <rect x="740" y="208" width="84" height="504" fill="#FFF2DC" opacity="0.24"/>
  <rect x="414" y="208" width="196" height="150" fill="#FFF6E6" opacity="0.16"/>

  <!-- Diagonal architectural sky reflections across panes -->
  <polygon points="200,208 350,208 200,480" fill="url(#glint)"/>
  <polygon points="414,208 580,208 414,500" fill="url(#glint)"/>
  <polygon points="630,208 790,208 630,490" fill="url(#glint)"/>

  <!-- Sleek horizontal transom bar -->
  <rect x="182" y="370" width="660" height="16" fill="#464E56"/>

  <!-- Crisp window sill -->
  <rect x="150" y="732" width="724" height="28" rx="4" fill="#DFDCD4"/>
  <rect x="150" y="760" width="724" height="16" fill="#000000" opacity="0.1"/>

  <!-- Clean modern balcony balustrade across bottom of bay -->
  <rect x="150" y="796" width="724" height="148" fill="url(#balcGlass)"/>
  <rect x="142" y="786" width="740" height="16" rx="4" fill="#4A525B"/>
  <rect x="150" y="796" width="14" height="148" fill="#4A525B"/>
  <rect x="505" y="796" width="14" height="148" fill="#4A525B"/>
  <rect x="860" y="796" width="14" height="148" fill="#4A525B"/>
  <rect x="142" y="942" width="740" height="22" fill="#D4D0C7"/>

  <!-- Neat modern compact AC condenser on right side with clean louvers -->
  <rect x="876" y="458" width="106" height="76" rx="6" fill="#E8E7E2" stroke="#C6C3BA" stroke-width="4"/>
  <circle cx="916" cy="496" r="24" fill="#5D646B"/>
  <circle cx="916" cy="496" r="10" fill="#7D858D"/>
  <rect x="948" y="474" width="24" height="44" rx="2" fill="#CFCBC2"/>
</svg>`;

// 2. house.jpg — Warm clean tropical-modern residential facade
const houseSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="hWall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#EDEAE2"/>
      <stop offset="12%" stop-color="#FAF8F3"/>
      <stop offset="86%" stop-color="#F4F1EA"/>
      <stop offset="100%" stop-color="#E4DFD4"/>
    </linearGradient>
    <linearGradient id="eaveShadow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="hGlass" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#A7D0EB"/>
      <stop offset="55%" stop-color="#76A1C0"/>
      <stop offset="100%" stop-color="#4F718D"/>
    </linearGradient>
  </defs>

  <rect width="1024" height="1024" fill="url(#hWall)"/>
  <!-- Roof eaves shadow -->
  <rect x="0" y="0" width="1024" height="68" fill="url(#eaveShadow)"/>

  <!-- Clean architectural plinth base -->
  <rect x="0" y="886" width="1024" height="138" fill="#DED9CE"/>
  <rect x="0" y="880" width="1024" height="10" fill="#CBC5B8"/>

  <!-- Wooden architectural shutters (warm teak tone, crisp louver lines) -->
  <rect x="196" y="242" width="112" height="456" rx="4" fill="#9A704E"/>
  <rect x="716" y="242" width="112" height="456" rx="4" fill="#9A704E"/>
  <g stroke="#7B563A" stroke-width="5">
    ${Array.from({ length: 12 }, (_, i) => {
      const y = 268 + i * 34;
      return `<line x1="210" y1="${y}" x2="294" y2="${y}"/><line x1="730" y1="${y}" x2="814" y2="${y}"/>`;
    }).join('')}
  </g>

  <!-- Crisp casement window frame & sky-reflecting glass -->
  <rect x="308" y="232" width="408" height="476" rx="6" fill="#F2EFE8" stroke="#CFC9BC" stroke-width="6"/>
  <rect x="328" y="252" width="176" height="436" fill="url(#hGlass)"/>
  <rect x="520" y="252" width="176" height="436" fill="url(#hGlass)"/>
  <!-- Warm interior curtains -->
  <rect x="328" y="252" width="54" height="436" fill="#FFF4DF" opacity="0.30"/>
  <rect x="642" y="252" width="54" height="436" fill="#FFF4DF" opacity="0.30"/>
  <!-- Diagonal glass glint & mullions -->
  <polygon points="328,252 460,252 328,490" fill="#FFFFFF" opacity="0.25"/>
  <polygon points="520,252 652,252 520,490" fill="#FFFFFF" opacity="0.25"/>
  <rect x="328" y="458" width="368" height="14" fill="#F2EFE8"/>

  <!-- Clean stone sill -->
  <rect x="284" y="704" width="456" height="28" rx="4" fill="#DDD7CB"/>
  <rect x="284" y="732" width="456" height="14" fill="#000000" opacity="0.09"/>
</svg>`;

// 3. shop.jpg — Stylish boutique / cafe ground-floor storefront
const shopSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="sWall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#EFECE4"/>
      <stop offset="100%" stop-color="#E7E3D9"/>
    </linearGradient>
    <linearGradient id="sGlass" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0%" stop-color="#B0D4EC"/>
      <stop offset="55%" stop-color="#7EA6C2"/>
      <stop offset="100%" stop-color="#536E82"/>
    </linearGradient>
    <linearGradient id="warmShop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFE2AE" stop-opacity="0.58"/>
      <stop offset="100%" stop-color="#E8B46E" stop-opacity="0.25"/>
    </linearGradient>
  </defs>

  <rect width="1024" height="1024" fill="url(#sWall)"/>

  <!-- Top architectural fascia band -->
  <rect x="0" y="0" width="1024" height="170" fill="#3B4048"/>
  <rect x="54" y="34" width="916" height="96" rx="8" fill="#4B525C"/>
  <!-- Minimalist warm gold sign accent bar (no illegible text) -->
  <rect x="110" y="72" width="380" height="20" rx="10" fill="#E8B04A" opacity="0.9"/>

  <!-- Striped modern boutique awning -->
  <rect x="0" y="170" width="1024" height="108" fill="#C8553D"/>
  <g fill="#F6EFE2">
    ${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 128 + 32}" y="170" width="64" height="108"/>`).join('')}
  </g>
  <rect x="0" y="278" width="1024" height="26" fill="#000000" opacity="0.2"/>

  <!-- Tall boutique plate-glass display window & doorway -->
  <rect x="52" y="316" width="920" height="708" fill="#32373E"/>
  <!-- Left & right display windows -->
  <rect x="74" y="338" width="540" height="534" fill="url(#sGlass)"/>
  <rect x="74" y="338" width="540" height="534" fill="url(#warmShop)"/>
  <!-- Warm pendant glow circles inside boutique -->
  <circle cx="220" cy="450" r="68" fill="#FFF3D2" opacity="0.45"/>
  <circle cx="460" cy="450" r="68" fill="#FFF3D2" opacity="0.45"/>
  <!-- Clean counter & display shelf silhouette -->
  <rect x="110" y="680" width="468" height="192" fill="#463C34" opacity="0.55"/>
  <rect x="110" y="672" width="468" height="14" fill="#D9B684" opacity="0.8"/>

  <!-- Framed glass entrance door on right -->
  <rect x="642" y="338" width="308" height="686" fill="url(#sGlass)"/>
  <rect x="642" y="338" width="308" height="686" fill="url(#warmShop)"/>
  <rect x="792" y="338" width="10" height="686" fill="#32373E"/>
  <rect x="768" y="640" width="10" height="86" rx="4" fill="#E8B04A"/>
  <rect x="814" y="640" width="10" height="86" rx="4" fill="#E8B04A"/>

  <!-- Diagonal glass sky reflection -->
  <polygon points="74,338 380,338 74,760" fill="#FFFFFF" opacity="0.22"/>
  <polygon points="642,338 890,338 642,720" fill="#FFFFFF" opacity="0.22"/>

  <!-- Clean stone stall riser below display window -->
  <rect x="74" y="872" width="540" height="152" fill="#DDD7CB"/>
</svg>`;

// 4. glass.jpg — Sleek commercial curtain-wall glazing (malls, hotels, towers)
const glassSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="curtain" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0%" stop-color="#D4ECFC"/>
      <stop offset="40%" stop-color="#9BC5E3"/>
      <stop offset="85%" stop-color="#6B98BA"/>
      <stop offset="100%" stop-color="#587F9E"/>
    </linearGradient>
    <linearGradient id="spandrel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#E4E9EE"/>
      <stop offset="100%" stop-color="#CBD3DC"/>
    </linearGradient>
  </defs>

  <rect width="1024" height="1024" fill="url(#curtain)"/>
  <!-- Subtle interior floor depth shading -->
  <rect x="0" y="640" width="1024" height="384" fill="#2A445C" opacity="0.18"/>
  <!-- Architectural diagonal sunlight reflection across panes -->
  <polygon points="0,104 420,104 160,1024 0,1024" fill="#FFFFFF" opacity="0.18"/>
  <polygon points="512,104 860,104 620,1024 512,1024" fill="#FFFFFF" opacity="0.13"/>

  <!-- Spandrel floor slab band -->
  <rect x="0" y="0" width="1024" height="104" fill="url(#spandrel)"/>
  <rect x="0" y="102" width="1024" height="10" fill="#8C99A6"/>

  <!-- Crisp aluminum vertical & horizontal mullions (2 panes per bay) -->
  <rect x="0" y="0" width="20" height="1024" fill="#E3E8EE"/>
  <rect x="502" y="0" width="22" height="1024" fill="#E3E8EE"/>
  <rect x="1004" y="0" width="20" height="1024" fill="#E3E8EE"/>
  <rect x="0" y="540" width="1024" height="12" fill="#DCE2E8" opacity="0.75"/>
</svg>`;

// 5. roof_flat.jpg — Clean architectural concrete terrace roof (NO muddy circular spots!)
const roofFlatSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#ECEAE3"/>
  <!-- Subtle crisp paving/expansion joint grid (tiles cleanly every 24m) -->
  <g stroke="#DFDCD3" stroke-width="2">
    <line x1="128" y1="0" x2="128" y2="512"/>
    <line x1="256" y1="0" x2="256" y2="512"/>
    <line x1="384" y1="0" x2="384" y2="512"/>
    <line x1="0" y1="128" x2="512" y2="128"/>
    <line x1="0" y1="256" x2="512" y2="256"/>
    <line x1="0" y1="384" x2="512" y2="384"/>
  </g>
  <!-- Subtle tonal checkerboard variation across concrete slabs (ultra-light, clean) -->
  <rect x="0" y="0" width="128" height="128" fill="#E7E4DC" opacity="0.28"/>
  <rect x="256" y="128" width="128" height="128" fill="#E7E4DC" opacity="0.28"/>
  <rect x="128" y="256" width="128" height="128" fill="#E7E4DC" opacity="0.28"/>
  <rect x="384" y="384" width="128" height="128" fill="#E7E4DC" opacity="0.28"/>
  <!-- Subtle crisp inner tile bevels so roofs look clean at every scale without slicing props -->
  <rect x="4" y="4" width="120" height="120" fill="none" stroke="#F4F2EC" stroke-width="1.5" opacity="0.65"/>
  <rect x="260" y="132" width="120" height="120" fill="none" stroke="#F4F2EC" stroke-width="1.5" opacity="0.65"/>
  <rect x="132" y="260" width="120" height="120" fill="none" stroke="#F4F2EC" stroke-width="1.5" opacity="0.65"/>
  <rect x="388" y="388" width="120" height="120" fill="none" stroke="#F4F2EC" stroke-width="1.5" opacity="0.65"/>
</svg>`;

// 6. roof_zinc.jpg — Clean architectural standing-seam corrugated metal roof (NO brown polka dots!)
const roofZincSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="seam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#D4D9DF"/>
      <stop offset="18%" stop-color="#EFF2F5"/>
      <stop offset="78%" stop-color="#E4E8ED"/>
      <stop offset="100%" stop-color="#C8CFD6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#E5E9EE"/>
  ${Array.from({ length: 16 }, (_, i) => {
    const x = i * 32;
    return `<rect x="${x}" y="0" width="32" height="512" fill="url(#seam)"/>
            <rect x="${x}" y="0" width="3" height="512" fill="#BDC5CE"/>`;
  }).join('')}
  <!-- Subtle horizontal sheet overlap seams -->
  <line x1="0" y1="256" x2="512" y2="256" stroke="#C5CCD4" stroke-width="2" opacity="0.7"/>
</svg>`;

// 7. factory.jpg — Clean ribbed architectural cladding with high clerestory glass strip
const factorySvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#E4E8EC"/>
  ${Array.from({ length: 16 }, (_, i) => {
    const x = i * 32;
    return `<rect x="${x}" y="0" width="10" height="512" fill="#D1D7DE"/>`;
  }).join('')}
  <rect x="0" y="42" width="512" height="78" fill="#8DB3CC"/>
  <rect x="0" y="42" width="512" height="28" fill="#BBD8EB" opacity="0.6"/>
  ${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 64}" y="42" width="6" height="78" fill="#5F6B76"/>`).join('')}
  <rect x="0" y="476" width="512" height="36" fill="#C4C8CC"/>
</svg>`;

// 8. parking.jpg — Crisp dark-slate asphalt with clean parking markings
const parkingSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#636970"/>
  <rect x="0" y="8" width="8" height="304" fill="#F2F1EC"/>
  <rect x="252" y="8" width="8" height="304" fill="#F2F1EC"/>
  <rect x="0" y="157" width="512" height="6" fill="#F2F1EC"/>
  <rect x="0" y="316" width="512" height="7" fill="#E8C96A"/>
</svg>`;

await Promise.all([
  renderSvgToJpg(apartmentSvg, path.join(OUT, 'apartment.jpg'), { size: 1024, grain: 3, quality: 92 }),
  renderSvgToJpg(houseSvg, path.join(OUT, 'house.jpg'), { size: 1024, grain: 3, quality: 92 }),
  renderSvgToJpg(shopSvg, path.join(OUT, 'shop.jpg'), { size: 1024, grain: 3, quality: 92 }),
  renderSvgToJpg(glassSvg, path.join(OUT, 'glass.jpg'), { size: 1024, grain: 1, quality: 92 }),
  renderSvgToJpg(roofFlatSvg, path.join(OUT, 'roof_flat.jpg'), { size: 512, grain: 3, quality: 90 }),
  renderSvgToJpg(roofZincSvg, path.join(OUT, 'roof_zinc.jpg'), { size: 512, grain: 2, quality: 90 }),
  renderSvgToJpg(factorySvg, path.join(OUT, 'factory.jpg'), { size: 512, grain: 2, quality: 90 }),
  renderSvgToJpg(parkingSvg, path.join(OUT, 'parking.jpg'), { size: 512, grain: 5, quality: 90 }),
]);

console.log('Regenerated all 8 architectural city textures in', path.relative(ROOT, OUT));
