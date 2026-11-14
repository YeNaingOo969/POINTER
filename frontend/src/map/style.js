// POINTER pastel map style, built for the OpenMapTiles schema served by OpenFreeMap.
// Written from scratch (not a recoloured third-party style) so every layer is ours and the
// layer count stays small for the 610M GPU. Colours follow the approved palette.
import { TILE_SOURCE_URL, GLYPHS_URL } from './config.js';

// Colourful pastel (2026-11-04, for a livelier map): greener parks, brighter
// water, tinted land use, gold main roads, coral motorways, buildings in a mix of pastels.
export const MAP_COLORS = {
  land: '#fbf4e4',
  residential: '#f8ebd6',
  commercial: '#fde1dc', // shops and offices: soft pink
  industrial: '#ebe4f7', // soft lilac
  park: '#a8e29b',
  wood: '#8ed68a',
  grass: '#c0eaa9',
  pitch: '#9edc8e',
  institution: '#f2e2f5', // schools, hospitals, cemeteries: light lilac
  water: '#7fcdf5',
  roadMajor: '#ffffff',
  roadMinor: '#fffdf8',
  roadCasing: '#ead2b2',
  primary: '#ffe7a8', // main roads: Shwedagon-gold tint
  primaryCasing: '#f1c56e',
  motorway: '#ffc9a8', // brand coral
  motorwayCasing: '#ef9b78',
  rail: '#c6b4e6',
  aeroway: '#e5def2',
  label: '#5a5148',
  labelHalo: '#ffffff',
  waterLabel: '#2f7fb0',
};

// Building colours, picked per building so streets look varied (peach, butter, mint, sky,
// lavender, rose). The 3D city layer uses the same family of tints for its models.
export const BUILDING_TINTS = ['#ffc9ad', '#ffe08f', '#b4e8c6', '#bdd6ff', '#dcc8fb', '#ffc3d7'];

const C = MAP_COLORS;
const SOURCE = 'omt';

// Same pick for the same building in every tile: feature id, mixed with its height.
const buildingTint = ['match',
  ['%', ['+', ['to-number', ['id'], 0], ['round', ['*', ['coalesce', ['get', 'render_height'], 6], 3]]], BUILDING_TINTS.length],
  ...BUILDING_TINTS.slice(0, -1).flatMap((c, i) => [i, c]),
  BUILDING_TINTS.at(-1)];


// Line width that grows with zoom (exponential, like real road widths on screen).
const width = (pairs) => ['interpolate', ['exponential', 1.6], ['zoom'], ...pairs.flat()];

// English first; the OSM name as a fallback. (Burmese map labels are left to our own HTML
// markers: the WebGL text renderer can't shape Myanmar script correctly.)
const NAME = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];

const isLine = ['match', ['geometry-type'], ['LineString', 'MultiLineString'], true, false];
const notBrunnel = ['match', ['get', 'brunnel'], ['tunnel'], false, true];

function road(id, classes, color, casing, widths, casingExtra = 1.6) {
  const filter = ['all', isLine, notBrunnel, ['match', ['get', 'class'], classes, true, false]];
  return [
    {
      id: `${id}-casing`, type: 'line', source: SOURCE, 'source-layer': 'transportation', filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': casing, 'line-width': width(widths.map(([z, w]) => [z, w + casingExtra])) },
    },
    {
      id, type: 'line', source: SOURCE, 'source-layer': 'transportation', filter,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': color, 'line-width': width(widths) },
    },
  ];
}

// Every road bridge in OpenStreetMap (brunnel = bridge): flyovers across the city and the river
// bridges (Thanlyin, Bago River, Dala…). Each is drawn on top of the flat map as a raised deck:
// a soft shadow dropped below it, a sandstone edge, the road surface and a white railing on both
// sides (line-gap-width). Real positions from the tiles, four line layers, no 3D models.
const BRIDGE_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'];
const bridgeFilter = ['all', isLine, ['==', ['get', 'brunnel'], 'bridge'], ['match', ['get', 'class'], BRIDGE_CLASSES, true, false]];

/** Deck width per road class at each zoom stop (zoom must be the outer interpolate). */
const deckWidth = (extra = 0) => ['interpolate', ['exponential', 1.6], ['zoom'],
  ...[[11, [1.2, 1, 0.8]], [14, [8, 7, 5]], [16, [16, 14, 9]], [18, [34, 30, 18]]].flatMap(([z, [big, mid, small]]) => [z,
    ['+', extra, ['match', ['get', 'class'], ['motorway', 'trunk'], big, ['primary', 'secondary'], mid, small]]])];

/** Colour of the road surface, matching the road layers below. */
const deckColor = ['match', ['get', 'class'],
  'motorway', C.motorway, ['trunk', 'primary'], C.primary, ['secondary', 'tertiary'], C.roadMajor, C.roadMinor];

function bridges() {
  const base = { type: 'line', source: SOURCE, 'source-layer': 'transportation', filter: bridgeFilter, minzoom: 11 };
  const round = { 'line-cap': 'butt', 'line-join': 'round' };
  return [
    {
      ...base, id: 'bridge-shadow', layout: round,
      paint: {
        'line-color': 'rgba(70, 40, 15, 0.42)', 'line-width': deckWidth(3), 'line-blur': 4,
        // The shadow falls further from the deck as you zoom in, so the bridge seems to rise.
        'line-translate': ['interpolate', ['linear'], ['zoom'], 12, ['literal', [1.5, 3]], 16, ['literal', [7, 14]], 18, ['literal', [14, 26]]],
      },
    },
    { ...base, id: 'bridge-edge', layout: round, paint: { 'line-color': '#c98a4b', 'line-width': deckWidth(4) } },
    { ...base, id: 'bridge-deck', layout: round, paint: { 'line-color': deckColor, 'line-width': deckWidth() } },
    {
      ...base, id: 'bridge-rail', minzoom: 14, layout: round,
      paint: { 'line-color': '#fff3dc', 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.8, 18, 2.4], 'line-gap-width': deckWidth(1) },
    },
  ];
}

export function buildMapStyle() {
  return {
    version: 8,
    name: 'POINTER Colourful Pastel',
    glyphs: GLYPHS_URL,
    sources: {
      [SOURCE]: { type: 'vector', url: TILE_SOURCE_URL },
    },
    light: { anchor: 'viewport', color: '#fff6e8', intensity: 0.32, position: [1.15, 210, 30] },
    layers: [
      { id: 'land', type: 'background', paint: { 'background-color': C.land } },

      // ---- Ground ----
      {
        id: 'residential', type: 'fill', source: SOURCE, 'source-layer': 'landuse',
        filter: ['==', ['get', 'class'], 'residential'],
        paint: { 'fill-color': C.residential },
      },
      {
        id: 'commercial', type: 'fill', source: SOURCE, 'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['commercial', 'retail'], true, false],
        paint: { 'fill-color': C.commercial },
      },
      {
        id: 'industrial', type: 'fill', source: SOURCE, 'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['industrial', 'railway'], true, false],
        paint: { 'fill-color': C.industrial },
      },
      {
        id: 'institution', type: 'fill', source: SOURCE, 'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['school', 'university', 'college', 'hospital', 'cemetery'], true, false],
        paint: { 'fill-color': C.institution },
      },
      {
        id: 'wood', type: 'fill', source: SOURCE, 'source-layer': 'landcover',
        filter: ['==', ['get', 'class'], 'wood'],
        paint: { 'fill-color': C.wood },
      },
      {
        id: 'grass', type: 'fill', source: SOURCE, 'source-layer': 'landcover',
        filter: ['match', ['get', 'class'], ['grass', 'farmland', 'wetland'], true, false],
        paint: { 'fill-color': C.grass, 'fill-opacity': 0.85 },
      },
      {
        id: 'park', type: 'fill', source: SOURCE, 'source-layer': 'park',
        paint: { 'fill-color': C.park },
      },
      {
        id: 'pitch', type: 'fill', source: SOURCE, 'source-layer': 'landuse',
        filter: ['match', ['get', 'class'], ['pitch', 'stadium', 'playground', 'zoo'], true, false],
        paint: { 'fill-color': ['match', ['get', 'class'], 'zoo', C.grass, C.pitch] },
      },

      // ---- Water ----
      {
        id: 'water', type: 'fill', source: SOURCE, 'source-layer': 'water',
        filter: ['!=', ['get', 'brunnel'], 'tunnel'],
        paint: { 'fill-color': C.water },
      },
      {
        id: 'river', type: 'line', source: SOURCE, 'source-layer': 'waterway',
        filter: ['all', isLine, notBrunnel],
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': C.water, 'line-width': width([[10, 0.6], [14, 2], [18, 8]]) },
      },

      // ---- Airport: aprons and runways (Yangon International) ----
      {
        id: 'aeroway-area', type: 'fill', source: SOURCE, 'source-layer': 'aeroway',
        filter: ['all', ['!', isLine], ['match', ['get', 'class'], ['apron', 'runway', 'taxiway'], true, false]],
        paint: { 'fill-color': C.aeroway },
      },
      {
        id: 'aeroway-line', type: 'line', source: SOURCE, 'source-layer': 'aeroway',
        filter: ['all', isLine, ['match', ['get', 'class'], ['runway', 'taxiway'], true, false]],
        paint: {
          'line-color': C.aeroway,
          // Zoom must be the outer interpolate; runway vs taxiway is chosen at each stop.
          'line-width': ['interpolate', ['exponential', 1.6], ['zoom'],
            11, ['match', ['get', 'class'], 'runway', 2, 0.5],
            14, ['match', ['get', 'class'], 'runway', 12, 3],
            17, ['match', ['get', 'class'], 'runway', 90, 24]],
        },
      },

      // ---- Roads (soft casing + white fill, thick and rounded for a friendly look) ----
      {
        id: 'path', type: 'line', source: SOURCE, 'source-layer': 'transportation',
        filter: ['all', isLine, notBrunnel, ['match', ['get', 'class'], ['path', 'pedestrian'], true, false]],
        minzoom: 15,
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': C.roadMinor, 'line-width': width([[15, 1], [18, 3]]), 'line-dasharray': [1.5, 1] },
      },
      ...road('road-minor', ['minor', 'service', 'track'], C.roadMinor, C.roadCasing,
        [[13, 0.6], [15, 3], [18, 14]], 1.2),
      ...road('road-secondary', ['secondary', 'tertiary'], C.roadMajor, C.roadCasing,
        [[11, 0.8], [14, 4.5], [18, 22]]),
      ...road('road-primary', ['primary', 'trunk'], C.primary, C.primaryCasing,
        [[10, 1], [14, 6], [18, 28]], 2),
      ...road('road-motorway', ['motorway'], C.motorway, C.motorwayCasing,
        [[9, 1], [14, 7], [18, 30]], 2),
      {
        id: 'rail', type: 'line', source: SOURCE, 'source-layer': 'transportation',
        filter: ['all', isLine, notBrunnel, ['match', ['get', 'class'], ['rail', 'transit'], true, false]],
        paint: { 'line-color': C.rail, 'line-width': width([[12, 0.8], [16, 2.5]]), 'line-dasharray': [3, 2] },
      },

      // ---- Buildings: flat pastel blocks (no 3D since 2026-11-12; landmarks are illustrated markers) ----
      {
        id: 'building-flat', type: 'fill', source: SOURCE, 'source-layer': 'building',
        paint: { 'fill-color': buildingTint, 'fill-opacity': 0.85 },
      },

      // ---- Bridges and flyovers: drawn again above the buildings as raised decks ----
      ...bridges(),

      // ---- Labels (English; quiet, so our place bubbles stay the stars) ----
      {
        id: 'water-label', type: 'symbol', source: SOURCE, 'source-layer': 'water_name',
        layout: { 'text-field': NAME, 'text-font': ['Noto Sans Italic'], 'text-size': 13, 'text-max-width': 8 },
        paint: { 'text-color': C.waterLabel, 'text-halo-color': C.labelHalo, 'text-halo-width': 1.4 },
      },
      {
        id: 'road-label', type: 'symbol', source: SOURCE, 'source-layer': 'transportation_name',
        minzoom: 14,
        filter: ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary', 'trunk'], true, false],
        layout: {
          'symbol-placement': 'line', 'text-field': NAME, 'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 14, 10.5, 18, 14], 'text-letter-spacing': 0.02,
        },
        paint: { 'text-color': C.label, 'text-halo-color': C.labelHalo, 'text-halo-width': 1.6 },
      },
      // Townships (suburbs) only — Yangon's numbered wards ("No (10) Ward") everywhere is noise.
      {
        id: 'area-label', type: 'symbol', source: SOURCE, 'source-layer': 'place',
        filter: ['==', ['get', 'class'], 'suburb'],
        minzoom: 12,
        maxzoom: 16,
        layout: {
          'text-field': NAME, 'text-font': ['Noto Sans Bold'], 'text-transform': 'uppercase',
          'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 12], 'text-letter-spacing': 0.14,
          'text-max-width': 7, 'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
        },
        paint: { 'text-color': '#a39686', 'text-halo-color': C.labelHalo, 'text-halo-width': 1.4 },
      },
      {
        id: 'city-label', type: 'symbol', source: SOURCE, 'source-layer': 'place',
        filter: ['match', ['get', 'class'], ['city', 'town'], true, false],
        maxzoom: 13,
        layout: { 'text-field': NAME, 'text-font': ['Noto Sans Bold'], 'text-size': 16 },
        paint: { 'text-color': C.label, 'text-halo-color': C.labelHalo, 'text-halo-width': 2 },
      },
    ],
  };
}
