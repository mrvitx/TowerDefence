// src/maps.js
// Advanced map storage and editing logic for Kaffekatten TD
// All maps (default and custom) are stored in localStorage as JSON

var MAPS_KEY = 'td-maps-v1';

// Default maps (can be restored if user deletes all)
var DEFAULT_MAPS = [
  {
    id: 'ring',
    name: 'Outer Ring',
    points: [], // Will be generated on demand
    type: 'default',
    description: 'Standard ringbana',
    created: Date.now(),
    modified: Date.now(),
  },
  {
    id: 'maze',
    name: 'Maze',
    points: [],
    type: 'default',
    description: 'Klassisk labyrint',
    created: Date.now(),
    modified: Date.now(),
  },
  // ...lägg till fler standardkartor här om du vill
];

// Load all maps from localStorage (or fall back to defaults)
function loadMaps() {
  try {
    var raw = localStorage.getItem(MAPS_KEY);
    if (!raw) return DEFAULT_MAPS.slice();
    var arr = JSON.parse(raw);
    if (!Array.isArray(arr) || !arr.length) return DEFAULT_MAPS.slice();
    return arr;
  } catch (e) {
    return DEFAULT_MAPS.slice();
  }
}

// Save all maps to localStorage
function saveMaps(maps) {
  try {
    localStorage.setItem(MAPS_KEY, JSON.stringify(maps));
    return true;
  } catch (e) {
    return false;
  }
}

// Add or update a map (by id)
function upsertMap(map) {
  var maps = loadMaps();
  var idx = maps.findIndex(function(m) { return m.id === map.id; });
  if (idx >= 0) {
    maps[idx] = Object.assign({}, maps[idx], map, { modified: Date.now() });
  } else {
    maps.push(Object.assign({}, map, { created: Date.now(), modified: Date.now() }));
  }
  saveMaps(maps);
}

// Delete a map by id
function deleteMap(id) {
  var maps = loadMaps().filter(function(m) { return m.id !== id; });
  saveMaps(maps);
}

// Get a map by id
function getMap(id) {
  var found = loadMaps().find(function(m) { return m.id === id; });
  return found || null;
}

// Restore all default maps (danger: overwrites custom)
function restoreDefaults() {
  saveMaps(DEFAULT_MAPS.slice());
}

// Utility: generate a unique id
function generateMapId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random()*1e6);
}

// Utility: create a new empty map
function createEmptyMap(name) {
  if (!name) name = 'Ny karta';
  return {
    id: generateMapId(name),
    name: name,
    points: [],
    type: 'custom',
    description: '',
    created: Date.now(),
    modified: Date.now(),
  };
}

// Expose as global for file:// compatibility
window.Maps = {
  DEFAULT_MAPS: DEFAULT_MAPS,
  loadMaps: loadMaps,
  saveMaps: saveMaps,
  upsertMap: upsertMap,
  deleteMap: deleteMap,
  getMap: getMap,
  restoreDefaults: restoreDefaults,
  generateMapId: generateMapId,
  createEmptyMap: createEmptyMap
};

// Expose as global for file:// compatibility
window.Maps = {
  DEFAULT_MAPS,
  loadMaps,
  saveMaps,
  upsertMap,
  deleteMap,
  getMap,
  restoreDefaults,
  generateMapId,
  createEmptyMap
};
