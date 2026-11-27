// All 690+ Yangon pagodas, stupas, temple halls, and monasteries from OpenStreetMap
// (`public/data/pagodas.json`), rendered via ~18 InstancedMesh draw calls using the shared
// 24k Burmese gold-leaf and Pyatthat materials from `pagodas-3d.js`, plus clickable gold
// MapLibre markers & bilingual popups.
import * as THREE from 'three';
import { maplibregl } from './map.js';
import { isLatinText } from './style.js';
import { LANDMARK_MIN_ZOOM } from './config.js';
import { OCC_CLEAR } from './city-occupancy.js';
import { buildPagodaArchetypes } from './pagodas-3d.js';

let cachedPromise = null;
function loadPagodaData() {
  if (!cachedPromise) {
    cachedPromise = fetch('/data/pagodas.json')
      .then((r) => (r.ok ? r.json() : []))
      .catch((err) => {
        console.warn('Yangon pagodas data load failed', err);
        return [];
      });
  }
  return cachedPromise;
}

function hashLL(lng, lat) {
  let h = (Math.imul(Math.round(lng * 1e5), 374761393) + Math.imul(Math.round(lat * 1e5), 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * 3D extra for `addLandmarkLayer`: stamps clear zones into `occupancy` and instances
 * every Yangon pagoda across the map in a handful of draw calls.
 */
export function yangonPagodas({ map, toLocal, pagodaMats, occupancy, markShadowsDirty }) {
  const group = new THREE.Group();
  const archetypes = buildPagodaArchetypes();
  const matBySlot = {
    goldBright: pagodaMats.goldBright,
    goldDark: pagodaMats.goldDark,
    diamondOrb: pagodaMats.diamondOrb,
    courtyardTile: pagodaMats.courtyardTile,
    whiteStucco: pagodaMats.whiteStucco,
    crimsonRoof: pagodaMats.crimsonRoof,
    darkRecess: pagodaMats.darkRecess,
  };

  loadPagodaData().then((items) => {
    if (!items.length) return;

    const byKind = {
      stupa_grand: [],
      stupa_classic: [],
      temple_hall: [],
      monastery_hall: [],
    };
    for (const p of items) {
      if (byKind[p.kind]) byKind[p.kind].push(p);
      if (occupancy) {
        const [x, z] = toLocal(p.lng, p.lat);
        occupancy.stampDisc(x, z, p.r + 3.5, OCC_CLEAR);
      }
    }

    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    for (const [kind, list] of Object.entries(byKind)) {
      const slots = archetypes[kind];
      if (!slots || !list.length) continue;

      const matrices = list.map((p) => {
        const [x, z] = toLocal(p.lng, p.lat);
        const rnd = hashLL(p.lng, p.lat);
        const yaw = kind === 'temple_hall' || kind === 'monastery_hall'
          ? Math.floor(rnd * 4) * (Math.PI / 2)
          : rnd * Math.PI * 2;
        quat.setFromAxisAngle(up, yaw);
        return m.compose(pos.set(x, 0, z), quat, scale.set(p.r, p.r, p.r)).clone();
      });

      for (const [slotName, geo] of Object.entries(slots)) {
        const mat = matBySlot[slotName];
        if (!mat || !geo) continue;
        const inst = new THREE.InstancedMesh(geo, mat, matrices.length);
        inst.frustumCulled = false;
        inst.castShadow = slotName !== 'diamondOrb' && slotName !== 'courtyardTile' && kind !== 'monastery_hall';
        inst.receiveShadow = true;
        for (let i = 0; i < matrices.length; i++) inst.setMatrixAt(i, matrices[i]);
        inst.instanceMatrix.needsUpdate = true;
        group.add(inst);
      }
    }

    markShadowsDirty?.();
    map.triggerRepaint();
  });

  group.visible = map.getZoom() >= LANDMARK_MIN_ZOOM;
  if (import.meta.env.DEV) window.__yangonPagodas = group;
  return group;
}

const PAGODA_DOT_LAYERS = ['pagoda-dot-grand', 'pagoda-dot-local'];

/** Add golden pagoda pins and clickable bilingual popups across Yangon. */
export function addPagodaLabels(map) {
  const firstLabel = map.getStyle().layers.find((l) => l.type === 'symbol')?.id;
  map.addSource('yangon-pagodas', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  loadPagodaData().then((items) => {
    const src = map.getSource('yangon-pagodas');
    if (!src) return;
    src.setData({
      type: 'FeatureCollection',
      features: items.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          kind: p.kind,
          name: p.name || '',
          en: p.en || '',
          my: p.my || '',
          isGrand: p.kind === 'stupa_grand' || p.kind === 'temple_hall',
        },
      })),
    });
  });

  const sets = [
    { id: 'grand', filter: ['==', ['get', 'isGrand'], true], minzoom: 13.5, rad: [13.5, 3, 17, 5.5] },
    { id: 'local', filter: ['!=', ['get', 'isGrand'], true], minzoom: 15.2, rad: [15.2, 2.5, 18, 4.5] },
  ];

  for (const s of sets) {
    map.addLayer({
      id: `pagoda-dot-${s.id}`,
      type: 'circle',
      source: 'yangon-pagodas',
      filter: s.filter,
      minzoom: s.minzoom,
      paint: {
        'circle-color': '#d88b0c',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], ...s.rad],
        'circle-stroke-color': '#fff8e2',
        'circle-stroke-width': 1.4,
        'circle-pitch-alignment': 'viewport',
      },
    }, firstLabel);

    map.addLayer({
      id: `pagoda-label-${s.id}`,
      type: 'symbol',
      source: 'yangon-pagodas',
      filter: ['all', s.filter, ['!=', ['get', 'en'], ''], isLatinText(['get', 'en'])],
      minzoom: s.minzoom + 0.4,
      layout: {
        'text-field': ['get', 'en'],
        'text-font': ['Noto Sans Regular'],
        'text-size': s.id === 'grand' ? ['interpolate', ['linear'], ['zoom'], 14, 11, 17, 13] : 10.5,
        'text-max-width': 9,
        'text-offset': [0, 0.75],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': '#9b6406',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    }, firstLabel);
  }

  const popup = new maplibregl.Popup({ closeButton: true, offset: 8, className: 'bus-popup', maxWidth: '280px' });
  const KIND_LABEL = {
    stupa_grand: 'Pagoda / Stupa',
    stupa_classic: 'Pagoda / Zedi',
    temple_hall: 'Temple / Shrine Hall',
    monastery_hall: 'Buddhist Monastery',
  };
  map.on('click', PAGODA_DOT_LAYERS, (e) => {
    const f = e.features[0];
    const { en, my, name, kind } = f.properties;
    const primary = en || name || 'Pagoda';
    const secondary = my && my !== primary ? my : '';
    const el = document.createElement('div');
    el.innerHTML = '<p class="bus-popup__kind"></p><p class="bus-popup__name"></p><p class="bus-popup__alt"></p>';
    el.querySelector('.bus-popup__kind').textContent = KIND_LABEL[kind] || 'Pagoda';
    el.querySelector('.bus-popup__name').textContent = primary;
    el.querySelector('.bus-popup__alt').textContent = secondary;
    popup.setLngLat(f.geometry.coordinates).setDOMContent(el).addTo(map);
  });
  map.on('mouseenter', PAGODA_DOT_LAYERS, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', PAGODA_DOT_LAYERS, () => { map.getCanvas().style.cursor = ''; });
}

/** True when a click landed on a Yangon pagoda marker. */
export const clickedPagoda = (map, point) =>
  PAGODA_DOT_LAYERS.some((id) => map.getLayer(id)) && map.queryRenderedFeatures(point, { layers: PAGODA_DOT_LAYERS }).length > 0;
