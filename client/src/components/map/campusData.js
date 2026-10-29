/**
 * NeuraGrid — 2D Campus Map Data  (Leaflet geometry layer)
 *
 * Building metadata is imported from the single source of truth:
 *   src/data/buildings.js
 *
 * This file adds ONLY the Leaflet-specific geometry (bounds + centre) so
 * the DigitalTwin 2-D map can render each building as a coloured rectangle.
 *
 * Layout (mirrors the 3-D scene left / right split):
 *
 *   WEST (left)                  EAST (right)
 *   ┌──────────────┐             ┌──────────────┐
 *   │  Green Bldg  │   ROAD      │   A-Block    │  ← North row
 *   └──────────────┘             └──────────────┘
 *   ┌─────────────────────────┐  ┌──────────────────────────────┐
 *   │   B-Block  (very wide)  │  │   C-Block    (widest/tallest) │  ← Middle row
 *   └─────────────────────────┘  └──────────────────────────────┘
 *   ┌───────────────────────┐    ┌──────────────────┐
 *   │  Steve Jobs Aud.      │    │  Mech & Civil    │  ← South row
 *   └───────────────────────┘    └──────────────────┘
 */

import { BUILDINGS } from '../../data/buildings'

// ─── Grid constants ───────────────────────────────────────────────────────────
const H      = 0.00095   // standard building height in latitude (~106 m)

// Row latitudes (south → north)
const ROW_S  = 37.86900  // South row  : Steve Jobs / Mech & Civil
const ROW_M  = 37.87155  // Middle row : B-Block    / C-Block
const ROW_N  = 37.87410  // North row  : Green Bldg / A-Block

// Left cluster west edge
const L_WEST = -122.27820

// Left-cluster building widths (longitude degrees)
const GREEN_W  = 0.00145  // standard
const BBLK_W   = 0.00295  // VERY WIDE (mirrors 3-D size 18)
const SJ_W     = 0.00245  // WIDE-LOW  (mirrors 3-D size 16)

// Road gap between clusters (≈ 175 m)
const ROAD     = 0.00200

// Right cluster west edge
const R_WEST   = L_WEST + BBLK_W + ROAD   // –122.27325

// Right-cluster building widths
const ABLK_W   = 0.00145  // standard
const CBLK_W   = 0.00335  // WIDEST (mirrors 3-D size 20)
const MECH_W   = 0.00185  // CHUNKY square

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mkBounds(lat, lng, latH, lngW) {
  return [[lat, lng], [lat + latH, lng + lngW]]
}
function mkCenter(lat, lng, latH, lngW) {
  return [lat + latH / 2, lng + lngW / 2]
}

// ─── Leaflet geometry per building ID ─────────────────────────────────────────
// Keyed by building id (matches data/buildings.js)
const GEOM_2D = {
  green:     { bounds: mkBounds(ROW_N, L_WEST, H, GREEN_W), center: mkCenter(ROW_N, L_WEST, H, GREEN_W) },
  bblock:    { bounds: mkBounds(ROW_M, L_WEST, H, BBLK_W),  center: mkCenter(ROW_M, L_WEST, H, BBLK_W)  },
  stevejobs: { bounds: mkBounds(ROW_S, L_WEST, H, SJ_W),    center: mkCenter(ROW_S, L_WEST, H, SJ_W)    },
  ablock:    { bounds: mkBounds(ROW_N, R_WEST, H, ABLK_W),  center: mkCenter(ROW_N, R_WEST, H, ABLK_W)  },
  cblock:    { bounds: mkBounds(ROW_M, R_WEST, H, CBLK_W),  center: mkCenter(ROW_M, R_WEST, H, CBLK_W)  },
  mechlabs:  { bounds: mkBounds(ROW_S, R_WEST, H, MECH_W),  center: mkCenter(ROW_S, R_WEST, H, MECH_W)  },
}

// ─── Campus overview ──────────────────────────────────────────────────────────
export const CAMPUS_CENTER = [
  (ROW_S + ROW_N + H) / 2,
  (L_WEST + R_WEST + CBLK_W) / 2,
]
export const CAMPUS_ZOOM = 17

// ─── Final export: buildings enriched with Leaflet geometry ──────────────────
// IDs match BUILDINGS in data/buildings.js — energy data is sourced from
// useCampusData3D hook (same building IDs) at runtime.
export const CAMPUS_BUILDINGS_2D = BUILDINGS.map(b => ({
  ...b,
  ...GEOM_2D[b.id],
}))
