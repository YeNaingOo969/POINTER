// Map settings in one place: tile source, start view, limits and performance knobs.

// OpenFreeMap: free OpenStreetMap vector tiles (OpenMapTiles schema), no API key.
// To move to MapTiler / Stadia later, change these two URLs (key goes in .env).
export const TILE_SOURCE_URL = 'https://tiles.openfreemap.org/planet';
export const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';

// Start view: downtown Yangon between Shwedagon and Sule, tilted a little for depth.
export const START_VIEW = {
  center: [96.1555, 16.7845],
  zoom: 14.2,
  pitch: 52,
  bearing: -17,
};

// Keep the camera around greater Yangon (west, south, east, north).
export const MAX_BOUNDS = [[95.95, 16.65], [96.35, 17.05]];
export const MIN_ZOOM = 11;
export const MAX_ZOOM = 18.5;
export const MAX_PITCH = 65;

// 3D buildings appear from this zoom (fewer polygons to extrude when zoomed out).
export const BUILDINGS_3D_MIN_ZOOM = 14;

// Hero landmark models (built by `npm run build:landmarks`), shown from LANDMARK_MIN_ZOOM so they
// stand out even before the city models appear. `rotation` in degrees clockwise; OSM buildings
// within `clear` metres are skipped so they don't poke through the landmark; no filler buildings
// within `grounds` metres. `credit` is shown in the map attribution (CC-BY models must be credited).
export const LANDMARK_MIN_ZOOM = 13;
export const LANDMARKS = [
  // Our own model of the hill, terrace, stairways and stupa (scripts/blender/landmarks/shwedagon.py).
  { id: 'shwedagon', file: '/models/landmarks/shwedagon.glb', lng: 96.14959, lat: 16.79834, rotation: 0, clear: 45, grounds: 140 },
  { id: 'sule', file: '/models/landmarks/sule.glb', lng: 96.158764, lat: 16.774401, rotation: 0, clear: 30, grounds: 35 },
  { id: 'botataung', file: '/models/landmarks/botataung.glb', lng: 96.17184, lat: 16.76783, rotation: 0, clear: 40, grounds: 40 },
  // Centre of the OSM line (scripts/blender/landmarks/thanlyin_bridge.py prints it).
  { id: 'thanlyin_bridge', file: '/models/landmarks/thanlyin_bridge.glb', lng: 96.233576, lat: 16.789622, rotation: 0, clear: 0, grounds: 0, noLift: true },
  // Every other road flyover and bridge in the city, one model placed at the START_VIEW centre.
  { id: 'flyovers', file: '/models/landmarks/flyovers.glb', lng: 96.1555, lat: 16.7845, rotation: 0, clear: 0, grounds: 0, noLift: true },
  // Origin = middle of the bridge's straight river segment (see scripts/blender/landmarks/dala_bridge.py).
  { id: 'dala_bridge', file: '/models/landmarks/dala_bridge.glb', lng: 96.143736, lat: 16.768731, rotation: 0, clear: 1, grounds: 0 },
  { id: 'city_hall', file: '/models/landmarks/city_hall.glb', lng: 96.159692, lat: 16.775067, rotation: 0, clear: 62, grounds: 66 },
  { id: 'karaweik', file: '/models/landmarks/karaweik.glb', lng: 96.167973, lat: 16.795227, rotation: 10, clear: 48, grounds: 50 },
  { id: 'bogyoke_market', file: '/models/landmarks/bogyoke_market.glb', lng: 96.155589, lat: 16.780340, rotation: 0, clear: 90, grounds: 105 },
  { id: 'strand_hotel', file: '/models/landmarks/strand_hotel.glb', lng: 96.162598, lat: 16.769591, rotation: 0, clear: 22, grounds: 36 },
  { id: 'secretariat', file: '/models/landmarks/secretariat.glb', lng: 96.165815, lat: 16.775337, rotation: 0, clear: 80, grounds: 100 },
  // Towers, malls and hotels built by scripts/blender/landmarks/modern.py (lng/lat = footprint centroid).
  { id: 'm_tower', file: '/models/landmarks/m_tower.glb', lng: 96.130500, lat: 16.825960, rotation: 0, clear: 20, grounds: 38 },
  { id: 'sakura_tower', file: '/models/landmarks/sakura_tower.glb', lng: 96.159378, lat: 16.779045, rotation: 0, clear: 15, grounds: 26 },
  { id: 'junction_city', file: '/models/landmarks/junction_city.glb', lng: 96.154227, lat: 16.778980, rotation: 0, clear: 45, grounds: 95 },
  { id: 'junction_square', file: '/models/landmarks/junction_square.glb', lng: 96.130994, lat: 16.817448, rotation: 0, clear: 50, grounds: 72 },
  { id: 'myanmar_plaza', file: '/models/landmarks/myanmar_plaza.glb', lng: 96.155273, lat: 16.827779, rotation: 0, clear: 70, grounds: 88 },
  { id: 'melia', file: '/models/landmarks/melia.glb', lng: 96.154969, lat: 16.826686, rotation: 0, clear: 45, grounds: 66 },
  { id: 'lotte', file: '/models/landmarks/lotte.glb', lng: 96.137206, lat: 16.844515, rotation: 0, clear: 60, grounds: 160 },
  { id: 'diamond_inya', file: '/models/landmarks/diamond_inya.glb', lng: 96.151272, lat: 16.849925, rotation: 0, clear: 50, grounds: 76 },
  { id: 'novotel_max', file: '/models/landmarks/novotel_max.glb', lng: 96.131668, lat: 16.819813, rotation: 0, clear: 45, grounds: 74 },
  { id: 'chatrium', file: '/models/landmarks/chatrium.glb', lng: 96.168799, lat: 16.800450, rotation: 0, clear: 30, grounds: 54 },
  { id: 'sule_shangri_la', file: '/models/landmarks/sule_shangri_la.glb', lng: 96.158472, lat: 16.778676, rotation: 0, clear: 15, grounds: 64 },
  { id: 'airport', file: '/models/landmarks/airport.glb', lng: 96.133754, lat: 16.900692, rotation: 0, clear: 60, grounds: 130 },
];

// Radeon 610M budget: cap the pixel ratio so a 4K / retina screen doesn't quadruple the work.
export const MAX_PIXEL_RATIO = 1.5;
