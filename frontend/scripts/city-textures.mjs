// Generate clean, high-detail architectural PBR diffuse + bump/roughness relief maps for 3D
// city tiles (public/models/city/tex/*.jpg & *_bump.jpg) using sharp (SVG -> JPEG).
// Run: node scripts/city-textures.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT } from './lib.mjs';

const OUT = path.join(ROOT, 'public', 'models', 'city', 'tex');
fs.mkdirSync(OUT, { recursive: true });

function makeSeeded(seed = 17) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Rasterize SVG to clean JPEG with subtle micro-grain (no blurry smears). */
async function renderSvgToJpg(svg, outPath, { size = 1024, grain = 3, quality = 92, grayscale = false } = {}) {
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(size, size)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (grain > 0) {
    const rand = makeSeeded(size + outPath.length * 37);
    for (let i = 0; i < data.length; i += 4) {
      const n = ((rand() - 0.5) * 2 * grain) | 0;
      const r = Math.max(0, Math.min(255, data[i] + n));
      if (grayscale) {
        data[i] = data[i + 1] = data[i + 2] = r;
      } else {
        data[i] = r;
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
      }
    }
  }

  let out = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  if (grayscale) out = out.grayscale();
  await out.jpeg({ quality, mozjpeg: true }).toFile(outPath);
}

// -----------------------------------------------------------------------------
// 1. APARTMENT (Diffuse + Bump): Modern Yangon apartment/condo bay (1 bay x 1 storey)
// Bump semantics: bright = raised concrete/plaster/mullions (matte); dark = deeply recessed smooth glass!
// -----------------------------------------------------------------------------
const apartmentSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ECEBE5"/>
      <stop offset="8%" stop-color="#F7F6F1"/>
      <stop offset="92%" stop-color="#F1EFE9"/>
      <stop offset="100%" stop-color="#E5E2D9"/>
    </linearGradient>
    <linearGradient id="slabShadow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="glassSky" x1="0" y1="0" x2="0.18" y2="1">
      <stop offset="0%" stop-color="#87BCE2"/>
      <stop offset="48%" stop-color="#5687AC"/>
      <stop offset="100%" stop-color="#355873"/>
    </linearGradient>
    <linearGradient id="glint" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.38"/>
      <stop offset="48%" stop-color="#FFFFFF" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="balcGlass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#B8DBF2" stop-opacity="0.72"/>
      <stop offset="100%" stop-color="#6F9ABA" stop-opacity="0.78"/>
    </linearGradient>
  </defs>

  <rect width="1024" height="1024" fill="url(#wall)"/>
  <!-- Floor slab cornice & overhang ambient shadow -->
  <rect x="0" y="0" width="1024" height="58" fill="#E1DED5"/>
  <rect x="0" y="56" width="1024" height="8" fill="#C7C2B7"/>
  <rect x="0" y="64" width="1024" height="62" fill="url(#slabShadow)"/>

  <!-- Corner architectural pilasters -->
  <rect x="0" y="64" width="48" height="960" fill="#ECEAE2" opacity="0.8"/>
  <rect x="976" y="64" width="48" height="960" fill="#ECEAE2" opacity="0.8"/>

  <!-- Recessed charcoal window bay frame -->
  <rect x="160" y="168" width="704" height="580" rx="10" fill="#D0CCC3"/>
  <rect x="176" y="182" width="672" height="552" rx="6" fill="#2E353D"/>

  <!-- Glass panes (rich contrast + sky glint + subtle warm curtain interior) -->
  <rect x="196" y="202" width="198" height="512" fill="url(#glassSky)"/>
  <rect x="414" y="202" width="196" height="512" fill="url(#glassSky)"/>
  <rect x="630" y="202" width="198" height="512" fill="url(#glassSky)"/>

  <rect x="196" y="202" width="78" height="512" fill="#FFECC8" opacity="0.22"/>
  <rect x="750" y="202" width="78" height="512" fill="#FFECC8" opacity="0.22"/>
  <rect x="414" y="202" width="196" height="140" fill="#FFF4DE" opacity="0.16"/>

  <polygon points="196,202 350,202 196,490" fill="url(#glint)"/>
  <polygon points="414,202 580,202 414,500" fill="url(#glint)"/>
  <polygon points="630,202 790,202 630,490" fill="url(#glint)"/>
  <rect x="176" y="370" width="672" height="16" fill="#3B434B"/>

  <!-- Crisp concrete sill & drop shadow -->
  <rect x="144" y="734" width="736" height="30" rx="4" fill="#DDD9CF"/>
  <rect x="144" y="764" width="736" height="18" fill="#000000" opacity="0.13"/>

  <!-- Modern balcony tinted glass railing + crisp dark steel stanchions -->
  <rect x="146" y="798" width="732" height="148" fill="url(#balcGlass)"/>
  <rect x="136" y="786" width="752" height="18" rx="4" fill="#3C434B"/>
  <rect x="146" y="798" width="16" height="148" fill="#3C434B"/>
  <rect x="504" y="798" width="16" height="148" fill="#3C434B"/>
  <rect x="862" y="798" width="16" height="148" fill="#3C434B"/>
  <rect x="136" y="944" width="752" height="24" fill="#CFCAC0"/>

  <!-- Slim modern AC unit with neat dark fan grille -->
  <rect x="876" y="458" width="104" height="76" rx="6" fill="#E8E7E2" stroke="#C0BDB3" stroke-width="4"/>
  <circle cx="916" cy="496" r="24" fill="#464D54"/>
  <circle cx="916" cy="496" r="10" fill="#717A82"/>
  <rect x="948" y="474" width="22" height="44" rx="2" fill="#C9C5BC"/>
</svg>`;

const apartmentBumpSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#DADADA"/>
  <rect x="0" y="0" width="1024" height="60" fill="#F6F6F6"/>
  <rect x="0" y="64" width="48" height="960" fill="#ECECEC"/>
  <rect x="976" y="64" width="48" height="960" fill="#ECECEC"/>
  <rect x="160" y="168" width="704" height="580" rx="10" fill="#9A9A9A"/>
  <rect x="176" y="182" width="672" height="552" rx="6" fill="#B2B2B2"/>
  <!-- Deep smooth recessed glass (dark -> smooth in shader roughness modulation + recessed normal) -->
  <rect x="196" y="202" width="198" height="512" fill="#141414"/>
  <rect x="414" y="202" width="196" height="512" fill="#141414"/>
  <rect x="630" y="202" width="198" height="512" fill="#141414"/>
  <rect x="176" y="370" width="672" height="16" fill="#C8C8C8"/>
  <rect x="144" y="734" width="736" height="30" rx="4" fill="#FFFFFF"/>
  <!-- Balcony glass & raised railing -->
  <rect x="146" y="798" width="732" height="148" fill="#2A2A2A"/>
  <rect x="136" y="786" width="752" height="18" rx="4" fill="#F2F2F2"/>
  <rect x="146" y="798" width="16" height="148" fill="#E8E8E8"/>
  <rect x="504" y="798" width="16" height="148" fill="#E8E8E8"/>
  <rect x="862" y="798" width="16" height="148" fill="#E8E8E8"/>
  <rect x="136" y="944" width="752" height="24" fill="#F8F8F8"/>
  <rect x="876" y="458" width="104" height="76" rx="6" fill="#FAFAFA"/>
  <circle cx="916" cy="496" r="24" fill="#686868"/>
</svg>`;

// -----------------------------------------------------------------------------
// 2. HOUSE (Diffuse + Bump): Tropical modern villa / heritage-styled Yangon house
// -----------------------------------------------------------------------------
const houseSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="hWall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ECE8DE"/>
      <stop offset="12%" stop-color="#FAF7F1"/>
      <stop offset="86%" stop-color="#F3EFE6"/>
      <stop offset="100%" stop-color="#E2DDD1"/>
    </linearGradient>
    <linearGradient id="eaveShadow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.20"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="hGlass" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="#92C2E2"/>
      <stop offset="52%" stop-color="#5E8CAE"/>
      <stop offset="100%" stop-color="#3E617D"/>
    </linearGradient>
  </defs>

  <rect width="1024" height="1024" fill="url(#hWall)"/>
  <rect x="0" y="0" width="1024" height="74" fill="url(#eaveShadow)"/>
  <rect x="0" y="882" width="1024" height="142" fill="#DAD4C7"/>
  <rect x="0" y="874" width="1024" height="10" fill="#C4BEB0"/>

  <!-- Warm Burmese teak shutters -->
  <rect x="192" y="236" width="116" height="464" rx="4" fill="#926643"/>
  <rect x="716" y="236" width="116" height="464" rx="4" fill="#926643"/>
  <g stroke="#6E492D" stroke-width="5">
    ${Array.from({ length: 12 }, (_, i) => {
      const y = 264 + i * 34;
      return `<line x1="208" y1="${y}" x2="292" y2="${y}"/><line x1="732" y1="${y}" x2="816" y2="${y}"/>`;
    }).join('')}
  </g>

  <!-- Crisp casement window frame & sky-reflecting glass -->
  <rect x="308" y="228" width="408" height="480" rx="6" fill="#F2EFE8" stroke="#C6C0B2" stroke-width="6"/>
  <rect x="328" y="248" width="176" height="440" fill="url(#hGlass)"/>
  <rect x="520" y="248" width="176" height="440" fill="url(#hGlass)"/>
  <rect x="328" y="248" width="54" height="440" fill="#FFF2DC" opacity="0.26"/>
  <rect x="642" y="248" width="54" height="440" fill="#FFF2DC" opacity="0.26"/>
  <polygon points="328,248 460,248 328,490" fill="#FFFFFF" opacity="0.28"/>
  <polygon points="520,248 652,248 520,490" fill="#FFFFFF" opacity="0.28"/>
  <rect x="328" y="458" width="368" height="14" fill="#F2EFE8"/>

  <!-- Stone sill -->
  <rect x="280" y="704" width="464" height="30" rx="4" fill="#DBD5C8"/>
  <rect x="280" y="734" width="464" height="14" fill="#000000" opacity="0.11"/>
</svg>`;

const houseBumpSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#D2D2D2"/>
  <rect x="0" y="874" width="1024" height="150" fill="#E6E6E6"/>
  <rect x="192" y="236" width="116" height="464" rx="4" fill="#ECECEC"/>
  <rect x="716" y="236" width="116" height="464" rx="4" fill="#ECECEC"/>
  <g stroke="#B8B8B8" stroke-width="5">
    ${Array.from({ length: 12 }, (_, i) => {
      const y = 264 + i * 34;
      return `<line x1="208" y1="${y}" x2="292" y2="${y}"/><line x1="732" y1="${y}" x2="816" y2="${y}"/>`;
    }).join('')}
  </g>
  <rect x="308" y="228" width="408" height="480" rx="6" fill="#F0F0F0"/>
  <rect x="328" y="248" width="176" height="440" fill="#161616"/>
  <rect x="520" y="248" width="176" height="440" fill="#161616"/>
  <rect x="328" y="458" width="368" height="14" fill="#ECECEC"/>
  <rect x="280" y="704" width="464" height="30" rx="4" fill="#FFFFFF"/>
</svg>`;

// -----------------------------------------------------------------------------
// 3. SHOP (Diffuse + Bump): Boutique / cafe ground floor shophouse bay
// -----------------------------------------------------------------------------
const shopSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="sWall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#EEEAE2"/>
      <stop offset="100%" stop-color="#E5E0D5"/>
    </linearGradient>
    <linearGradient id="sGlass" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0%" stop-color="#A6CEEA"/>
      <stop offset="55%" stop-color="#6A96B6"/>
      <stop offset="100%" stop-color="#405A6E"/>
    </linearGradient>
    <linearGradient id="warmShop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFE0A6" stop-opacity="0.62"/>
      <stop offset="100%" stop-color="#E8B064" stop-opacity="0.28"/>
    </linearGradient>
  </defs>

  <rect width="1024" height="1024" fill="url(#sWall)"/>
  <rect x="0" y="0" width="1024" height="170" fill="#32373F"/>
  <rect x="54" y="34" width="916" height="96" rx="8" fill="#434A54"/>
  <rect x="110" y="72" width="420" height="22" rx="11" fill="#EBA93E" opacity="0.95"/>

  <rect x="0" y="170" width="1024" height="108" fill="#C44E36"/>
  <g fill="#F6EFE2">
    ${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 128 + 32}" y="170" width="64" height="108"/>`).join('')}
  </g>
  <rect x="0" y="278" width="1024" height="28" fill="#000000" opacity="0.22"/>

  <rect x="52" y="316" width="920" height="708" fill="#2A2F36"/>
  <rect x="74" y="338" width="540" height="534" fill="url(#sGlass)"/>
  <rect x="74" y="338" width="540" height="534" fill="url(#warmShop)"/>
  <circle cx="220" cy="450" r="72" fill="#FFF3D2" opacity="0.5"/>
  <circle cx="460" cy="450" r="72" fill="#FFF3D2" opacity="0.5"/>
  <rect x="110" y="680" width="468" height="192" fill="#3E352D" opacity="0.58"/>
  <rect x="110" y="672" width="468" height="14" fill="#DDA965" opacity="0.85"/>

  <rect x="642" y="338" width="308" height="686" fill="url(#sGlass)"/>
  <rect x="642" y="338" width="308" height="686" fill="url(#warmShop)"/>
  <rect x="792" y="338" width="10" height="686" fill="#2A2F36"/>
  <rect x="768" y="640" width="10" height="86" rx="4" fill="#EBA93E"/>
  <rect x="814" y="640" width="10" height="86" rx="4" fill="#EBA93E"/>

  <polygon points="74,338 380,338 74,760" fill="#FFFFFF" opacity="0.24"/>
  <polygon points="642,338 890,338 642,720" fill="#FFFFFF" opacity="0.24"/>
  <rect x="74" y="872" width="540" height="152" fill="#D9D3C7"/>
</svg>`;

const shopBumpSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#D8D8D8"/>
  <rect x="0" y="0" width="1024" height="170" fill="#E8E8E8"/>
  <rect x="54" y="34" width="916" height="96" rx="8" fill="#B8B8B8"/>
  <rect x="0" y="170" width="1024" height="108" fill="#FFFFFF"/>
  <g fill="#E6E6E6">
    ${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 128 + 32}" y="170" width="64" height="108"/>`).join('')}
  </g>
  <rect x="52" y="316" width="920" height="708" fill="#CCCCCC"/>
  <rect x="74" y="338" width="540" height="534" fill="#161616"/>
  <rect x="642" y="338" width="308" height="686" fill="#161616"/>
  <rect x="792" y="338" width="10" height="686" fill="#DCDCDC"/>
  <rect x="74" y="872" width="540" height="152" fill="#EAEAEA"/>
</svg>`;

// -----------------------------------------------------------------------------
// 4. GLASS (Diffuse + Bump): Deep sapphire architectural curtain-wall tower glazing
// -----------------------------------------------------------------------------
const glassSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="curtain" x1="0" y1="0" x2="0.12" y2="1">
      <stop offset="0%" stop-color="#87BAE0"/>
      <stop offset="35%" stop-color="#4B80AA"/>
      <stop offset="78%" stop-color="#2E5B80"/>
      <stop offset="100%" stop-color="#224563"/>
    </linearGradient>
    <linearGradient id="spandrel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#485B6E"/>
      <stop offset="50%" stop-color="#334352"/>
      <stop offset="100%" stop-color="#253340"/>
    </linearGradient>
  </defs>

  <rect width="1024" height="1024" fill="url(#curtain)"/>
  <!-- Subtle office interior ceiling strip light & vertical blinds contrast -->
  <rect x="30" y="135" width="460" height="110" fill="#DFF1FF" opacity="0.26"/>
  <rect x="534" y="135" width="460" height="110" fill="#FFECC8" opacity="0.20"/>
  <rect x="0" y="640" width="1024" height="384" fill="#152B3F" opacity="0.28"/>

  <!--Crisp diagonal sky reflection sweep across panes -->
  <polygon points="0,120 430,120 140,1024 0,1024" fill="#FFFFFF" opacity="0.16"/>
  <polygon points="520,120 880,120 620,1024 520,1024" fill="#FFFFFF" opacity="0.12"/>

  <!-- Metallic spandrel floor slab band -->
  <rect x="0" y="0" width="1024" height="122" fill="url(#spandrel)"/>
  <rect x="0" y="118" width="1024" height="12" fill="#8EA2B5"/>

  <!-- Sleek dark/silver anodized aluminum mullions (4 sub-panes across bay) -->
  <rect x="0" y="0" width="22" height="1024" fill="#9AAAB9"/>
  <rect x="501" y="0" width="22" height="1024" fill="#9AAAB9"/>
  <rect x="1002" y="0" width="22" height="1024" fill="#9AAAB9"/>
  <rect x="252" y="122" width="10" height="902" fill="#5D7082"/>
  <rect x="762" y="122" width="10" height="902" fill="#5D7082"/>
  <rect x="0" y="560" width="1024" height="14" fill="#7D90A3"/>
</svg>`;

const glassBumpSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <!-- Ultra dark glass panes (0.10) = high gloss mirror reflectivity; bright frames = matte metal mullions -->
  <rect width="1024" height="1024" fill="#121212"/>
  <rect x="0" y="0" width="1024" height="122" fill="#C4C4C4"/>
  <rect x="0" y="118" width="1024" height="12" fill="#EAEAEA"/>
  <rect x="0" y="0" width="22" height="1024" fill="#F2F2F2"/>
  <rect x="501" y="0" width="22" height="1024" fill="#F2F2F2"/>
  <rect x="1002" y="0" width="22" height="1024" fill="#F2F2F2"/>
  <rect x="252" y="122" width="10" height="902" fill="#D4D4D4"/>
  <rect x="762" y="122" width="10" height="902" fill="#D4D4D4"/>
  <rect x="0" y="560" width="1024" height="14" fill="#D8D8D8"/>
</svg>`;

// -----------------------------------------------------------------------------
// 5. ROOF FLAT (Diffuse + Bump): Clean architectural concrete terrace slabs
// -----------------------------------------------------------------------------
const roofFlatSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#EAE7E0"/>
  <g stroke="#DCD8CE" stroke-width="2">
    <line x1="128" y1="0" x2="128" y2="512"/>
    <line x1="256" y1="0" x2="256" y2="512"/>
    <line x1="384" y1="0" x2="384" y2="512"/>
    <line x1="0" y1="128" x2="512" y2="128"/>
    <line x1="0" y1="256" x2="512" y2="256"/>
    <line x1="0" y1="384" x2="512" y2="384"/>
  </g>
  <rect x="0" y="0" width="128" height="128" fill="#E3DFD6" opacity="0.34"/>
  <rect x="256" y="128" width="128" height="128" fill="#E3DFD6" opacity="0.34"/>
  <rect x="128" y="256" width="128" height="128" fill="#E3DFD6" opacity="0.34"/>
  <rect x="384" y="384" width="128" height="128" fill="#E3DFD6" opacity="0.34"/>
  <rect x="4" y="4" width="120" height="120" fill="none" stroke="#F4F2EC" stroke-width="1.5" opacity="0.65"/>
  <rect x="260" y="132" width="120" height="120" fill="none" stroke="#F4F2EC" stroke-width="1.5" opacity="0.65"/>
  <rect x="132" y="260" width="120" height="120" fill="none" stroke="#F4F2EC" stroke-width="1.5" opacity="0.65"/>
  <rect x="388" y="388" width="120" height="120" fill="none" stroke="#F4F2EC" stroke-width="1.5" opacity="0.65"/>
</svg>`;

const roofFlatBumpSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#D8D8D8"/>
  <g stroke="#909090" stroke-width="3">
    <line x1="128" y1="0" x2="128" y2="512"/>
    <line x1="256" y1="0" x2="256" y2="512"/>
    <line x1="384" y1="0" x2="384" y2="512"/>
    <line x1="0" y1="128" x2="512" y2="128"/>
    <line x1="0" y1="256" x2="512" y2="256"/>
    <line x1="0" y1="384" x2="512" y2="384"/>
  </g>
</svg>`;

// -----------------------------------------------------------------------------
// 6. ROOF ZINC (Diffuse + Bump): Standing-seam corrugated roof sheets
// -----------------------------------------------------------------------------
const roofZincSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="seam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#D2D7DE"/>
      <stop offset="18%" stop-color="#EFF2F5"/>
      <stop offset="78%" stop-color="#E4E8ED"/>
      <stop offset="100%" stop-color="#C5CCD4"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#E5E9EE"/>
  ${Array.from({ length: 16 }, (_, i) => {
    const x = i * 32;
    return `<rect x="${x}" y="0" width="32" height="512" fill="url(#seam)"/>
            <rect x="${x}" y="0" width="3" height="512" fill="#B8C0C9"/>`;
  }).join('')}
  <line x1="0" y1="256" x2="512" y2="256" stroke="#C5CCD4" stroke-width="2" opacity="0.7"/>
</svg>`;

const roofZincBumpSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="rib" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="15%" stop-color="#DCDCDC"/>
      <stop offset="50%" stop-color="#606060"/>
      <stop offset="85%" stop-color="#DCDCDC"/>
      <stop offset="100%" stop-color="#FFFFFF"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="#808080"/>
  ${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 32}" y="0" width="32" height="512" fill="url(#rib)"/>`).join('')}
</svg>`;

// -----------------------------------------------------------------------------
// 7. FACTORY & 8. PARKING (Diffuse + Bump)
// -----------------------------------------------------------------------------
const factorySvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#E4E8EC"/>
  ${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 32}" y="0" width="10" height="512" fill="#D1D7DE"/>`).join('')}
  <rect x="0" y="42" width="512" height="78" fill="#7CA7C4"/>
  <rect x="0" y="42" width="512" height="28" fill="#BBD8EB" opacity="0.6"/>
  ${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 64}" y="42" width="6" height="78" fill="#525E68"/>`).join('')}
  <rect x="0" y="476" width="512" height="36" fill="#C4C8CC"/>
</svg>`;

const factoryBumpSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#B8B8B8"/>
  ${Array.from({ length: 16 }, (_, i) => `<rect x="${i * 32}" y="0" width="10" height="512" fill="#EAEAEA"/>`).join('')}
  <rect x="0" y="42" width="512" height="78" fill="#181818"/>
  ${Array.from({ length: 8 }, (_, i) => `<rect x="${i * 64}" y="42" width="6" height="78" fill="#E0E0E0"/>`).join('')}
</svg>`;

const parkingSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#5E646B"/>
  <rect x="0" y="8" width="8" height="304" fill="#F2F1EC"/>
  <rect x="252" y="8" width="8" height="304" fill="#F2F1EC"/>
  <rect x="0" y="157" width="512" height="6" fill="#F2F1EC"/>
  <rect x="0" y="316" width="512" height="7" fill="#E8C96A"/>
</svg>`;

const parkingBumpSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#C8C8C8"/>
</svg>`;

await Promise.all([
  renderSvgToJpg(apartmentSvg, path.join(OUT, 'apartment.jpg'), { size: 1024, grain: 3, quality: 92 }),
  renderSvgToJpg(apartmentBumpSvg, path.join(OUT, 'apartment_bump.jpg'), { size: 512, grain: 2, quality: 88, grayscale: true }),
  renderSvgToJpg(houseSvg, path.join(OUT, 'house.jpg'), { size: 1024, grain: 3, quality: 92 }),
  renderSvgToJpg(houseBumpSvg, path.join(OUT, 'house_bump.jpg'), { size: 512, grain: 2, quality: 88, grayscale: true }),
  renderSvgToJpg(shopSvg, path.join(OUT, 'shop.jpg'), { size: 1024, grain: 3, quality: 92 }),
  renderSvgToJpg(shopBumpSvg, path.join(OUT, 'shop_bump.jpg'), { size: 512, grain: 2, quality: 88, grayscale: true }),
  renderSvgToJpg(glassSvg, path.join(OUT, 'glass.jpg'), { size: 1024, grain: 1, quality: 92 }),
  renderSvgToJpg(glassBumpSvg, path.join(OUT, 'glass_bump.jpg'), { size: 512, grain: 0, quality: 88, grayscale: true }),
  renderSvgToJpg(roofFlatSvg, path.join(OUT, 'roof_flat.jpg'), { size: 512, grain: 3, quality: 90 }),
  renderSvgToJpg(roofFlatBumpSvg, path.join(OUT, 'roof_flat_bump.jpg'), { size: 512, grain: 4, quality: 86, grayscale: true }),
  renderSvgToJpg(roofZincSvg, path.join(OUT, 'roof_zinc.jpg'), { size: 512, grain: 2, quality: 90 }),
  renderSvgToJpg(roofZincBumpSvg, path.join(OUT, 'roof_zinc_bump.jpg'), { size: 512, grain: 0, quality: 86, grayscale: true }),
  renderSvgToJpg(factorySvg, path.join(OUT, 'factory.jpg'), { size: 512, grain: 2, quality: 90 }),
  renderSvgToJpg(factoryBumpSvg, path.join(OUT, 'factory_bump.jpg'), { size: 512, grain: 2, quality: 86, grayscale: true }),
  renderSvgToJpg(parkingSvg, path.join(OUT, 'parking.jpg'), { size: 512, grain: 5, quality: 90 }),
  renderSvgToJpg(parkingBumpSvg, path.join(OUT, 'parking_bump.jpg'), { size: 256, grain: 14, quality: 84, grayscale: true }),
]);

console.log('Regenerated all 8 diffuse + 8 bump/roughness textures in', path.relative(ROOT, OUT));
