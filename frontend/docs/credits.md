# Credits and licences

Every third-party asset used in YangonGo is listed here. Add a row when an asset is downloaded
(originals live in `assets/raw/`). Assets under CC-BY must also be credited in the site footer.

| Asset | Used for | Source | Author | Licence | Added |
|---|---|---|---|---|---|
| OpenStreetMap data | Map tiles and place coordinates | https://www.openstreetmap.org | OpenStreetMap contributors | ODbL (attribution shown on the map) | 2026-11-02 |
| Google Fonts: Fraunces, Onest, Noto Sans Myanmar | Typography | https://fonts.google.com | Undercase Type, Onest project, Google | SIL Open Font License 1.1 | 2026-10-31 |
| City Kit (Commercial) — 12 buildings in `assets/raw/models/kit/commercial` | 3D map buildings | https://kenney.nl/assets/city-kit-commercial | Kenney (www.kenney.nl) | CC0 1.0 | 2026-11-02 |
| City Kit (Suburban) — 8 houses in `assets/raw/models/kit/suburban` | 3D map houses | https://kenney.nl/assets/city-kit-suburban | Kenney (www.kenney.nl) | CC0 1.0 | 2026-11-02 |
| Nature Kit — 7 trees/bushes in `assets/raw/models/kit/nature` | 3D map trees in parks | https://kenney.nl/assets/nature-kit | Kenney (www.kenney.nl) | CC0 1.0 | 2026-11-02 |
| ShweDagon Pagoda by Kyaw Lin Htet — `assets/raw/models/shwedagon/` | 3D Shwedagon landmark on the map. **Changed:** "Made by…" text removed, simplified from 1.8M to ~67k triangles, textures replaced by flat gold (`npm run build:landmarks`) | https://sketchfab.com/3d-models/shwedagon-pagoda-by-kyaw-lin-htet-ffca3e0400144a48aad10cd314364fd5 | Kyaw Lin Htet (uploaded by kaungkaung159) | CC BY 4.0 — credited in the map attribution | 2026-11-02 |
| OSM footprints/tags of landmark buildings — `assets/raw/osm/landmarks-nominatim.json`, Dala Bridge route — `assets/raw/osm/dala-bridge-nominatim.json` | Shapes, heights and routes for our low-poly landmark models | https://nominatim.openstreetmap.org | OpenStreetMap contributors | ODbL (attribution shown on the map) | 2026-11-02 |
| POINTER logo — `assets/raw/images/brand/pointer-logo-team.png` | Site logo, favicons. **Changed:** traced to SVG by `npm run build:logo` (shapes kept, gold gradient re-applied, tagline set as text) | Group 1 (our own team) | Group 1 members | Our own work | 2026-11-04 |

## Our own / generated

| Asset | Made with | Notes |
|---|---|---|
| Landing v2 map image | Our own explore map (MapLibre, pastel style) on OpenFreeMap / OpenStreetMap tiles, screenshot | `assets/raw/images/landing-v2/map-downtown.png`; attribution shown under the map on the page |
| Metro IT & Japanese Language Centre logo (landing footer, credits our school) | https://metro-myanmar.com/mic/images/logo.png — the school's own logo, used only to name the school in this school project (downloaded with the project lead's OK, 2026-11-13) | `assets/raw/images/school/metro-logo.png` → `public/images/school/metro-logo.webp` (lossless) |
| Low-poly landmarks (Sule, City Hall, Karaweik, Dala Bridge, Bogyoke Market, Strand Hotel, Secretariat, towers, malls, hotels, airport) | Blender scripts in `scripts/blender/landmarks/` | Modelled from public facts (Wikipedia/Skyscraper Center heights, OSM footprints, Wikimedia Commons photos viewed for reference only); no third-party model or image is shipped |
