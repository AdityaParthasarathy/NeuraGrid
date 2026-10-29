/**
 * NeuraGrid — Digital Twin page
 *
 * Hosts both the 2D Leaflet campus map and the 3D React-Three-Fiber scene.
 *
 * Data architecture
 * ─────────────────
 * useCampusData3D()  → single energy source used by BOTH views.
 *   buildingStats[id].totalEnergy   → currentLoad shown in 2D map
 *   buildingStats[id].status        → efficient / moderate / high
 *
 * Per-building ambient state (devices / occupancy / temperature) ticks
 * independently in this component via a lightweight interval — these are
 * 2D-display-only values not visible in the 3D scene.
 *
 * Building IDs are identical in useCampusData3D.js and campusData.js so
 * selecting a building in either view references the same data.
 */
import React, {
  useState, useEffect, useCallback, useRef,
  Suspense, lazy, useMemo,
} from 'react'
import { MapContainer, TileLayer, Rectangle, Marker, Tooltip, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Wifi, WifiOff, Layers, Activity, Zap, Leaf,
  AlertTriangle, CheckCircle, Building2, Filter,
  RefreshCw, Maximize2, Box, Map,
} from 'lucide-react'
import { format } from 'date-fns'
import clsx from 'clsx'

import { CAMPUS_CENTER, CAMPUS_ZOOM, CAMPUS_BUILDINGS_2D } from '../components/map/campusData'
import BuildingPanel, { getStatusStyle } from '../components/map/BuildingPanel'
import { BUILDINGS_3D, useCampusData3D } from '../components/digitalTwin3D/useCampusData3D'
import { useEnergy } from '../context/EnergyContext'

// Lazy-load the heavy Three.js scene so Leaflet bundle stays small
const CampusScene3D = lazy(() => import('../components/digitalTwin3D/CampusScene3D'))

// ─── Helpers ─────────────────────────────────────────────────────────────────
function clamp(val, lo, hi) { return Math.max(lo, Math.min(hi, val)) }

/** Per-building ambient tick state (devices / occupancy / temperature).
 *  Energy is NOT tracked here — it comes from useCampusData3D. */
function initAmbient() {
  const s = {}
  CAMPUS_BUILDINGS_2D.forEach(b => {
    s[b.id] = {
      devices:     b.baseDevices,
      occupancy:   b.baseOccupancy,
      temperature: b.baseTemp,
    }
  })
  return s
}

function initHistory() {
  const h = {}
  CAMPUS_BUILDINGS_2D.forEach(b => {
    h[b.id] = Array.from({ length: 22 }, (_, i) => ({
      load: Math.round(b.baseLoad * (0.88 + Math.random() * 0.22)),
      idx:  i,
    }))
  })
  return h
}

// ─── Color legend ─────────────────────────────────────────────────────────────
const LEGEND = [
  { color: '#059669', label: 'Efficient',  sub: '< 60% capacity' },
  { color: '#EA580C', label: 'Moderate',   sub: '60–80% capacity' },
  { color: '#DB2777', label: 'High Load',  sub: '> 80% capacity' },
]

const FILTERS = ['All', 'Academic', 'Lab', 'Auditorium']

// ─── Mini campus layout diagram ───────────────────────────────────────────────
/**
 * SVG schematic of the campus split (left / right clusters).
 * Proportional to the 3D building widths so it mirrors the real layout.
 * Clickable — selecting a building here zooms the 3D scene.
 */
const MINI_MAP_BLDGS = [
  // LEFT cluster (proportional to 3D sizes)
  { id: 'green',     x:  2, y:  4, w: 34, h: 20, label: 'GREEN', color: '#059669' },
  { id: 'bblock',    x:  2, y: 28, w: 68, h: 20, label: 'B-BLK', color: '#7C3AED' },
  { id: 'stevejobs', x:  2, y: 52, w: 58, h: 20, label: 'SJ-AUD',color: '#EA580C' },
  // RIGHT cluster
  { id: 'ablock',    x: 84, y:  4, w: 40, h: 20, label: 'A-BLK', color: '#0284C7' },
  { id: 'cblock',    x: 84, y: 28, w: 76, h: 20, label: 'C-BLK', color: '#EA580C' },
  { id: 'mechlabs',  x: 84, y: 52, w: 46, h: 20, label: 'MECH',  color: '#DB2777' },
]

function CampusMiniMap({ selectedId, onSelect, buildingStats }) {
  return (
    <div className="glass rounded-xl border border-base-border p-2" style={{ background: 'rgba(255,255,255,0.98)' }}>
      <p className="text-text-dim text-xxs uppercase tracking-widest mb-1.5 px-1">Campus Layout</p>
      <svg
        width="166"
        height="78"
        viewBox="0 0 166 78"
        style={{ display: 'block' }}
      >
        {/* Road separator */}
        <line x1="74" y1="0" x2="74" y2="78" stroke="#9CA3AF" strokeWidth={1} strokeDasharray="3 2" />
        <text x="74" y="40" textAnchor="middle" fontSize={5.5}
          fill="#9CA3AF" fontFamily="monospace" transform="rotate(-90 74 40)">
          BOULEVARD
        </text>

        {/* North / South labels */}
        <text x="38" y="2.5"  textAnchor="middle" fontSize={4.5} fill="#9CA3AF" fontFamily="monospace">◀ WEST</text>
        <text x="122" y="2.5" textAnchor="middle" fontSize={4.5} fill="#9CA3AF" fontFamily="monospace">EAST ▶</text>

        {MINI_MAP_BLDGS.map(b => {
          const stats    = buildingStats?.[b.id]
          const isActive = selectedId === b.id
          const dotColor = stats?.status === 'efficient' ? '#059669'
                         : stats?.status === 'moderate'  ? '#EA580C' : '#DB2777'
          return (
            <g
              key={b.id}
              onClick={() => onSelect(b.id)}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x={b.x} y={b.y} width={b.w} height={b.h}
                fill={isActive ? b.color + '44' : b.color + '18'}
                stroke={b.color}
                strokeWidth={isActive ? 1.8 : 0.8}
                rx={2}
              />
              {/* Building label */}
              <text
                x={b.x + b.w / 2}
                y={b.y + b.h / 2 + 2.5}
                textAnchor="middle"
                fontSize={6}
                fill={b.color}
                fontFamily="monospace"
                fontWeight={isActive ? 'bold' : 'normal'}
              >
                {b.label}
              </text>
              {/* Live status dot */}
              {stats && (
                <circle
                  cx={b.x + b.w - 4}
                  cy={b.y + 4}
                  r={2.5}
                  fill={dotColor}
                  opacity={0.9}
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Map event catcher ────────────────────────────────────────────────────────
function MapClickHandler({ onDeselect }) {
  useMapEvents({ click: onDeselect })
  return null
}

// ─── Building rectangle + label marker ───────────────────────────────────────
function BuildingOverlay({ building, isSelected, onSelect }) {
  const loadPct = building.currentLoad / building.capacity
  const status  = getStatusStyle(loadPct)
  const color   = status.color

  const icon = L.divIcon({
    html: `<div class="ng-bld-label" style="
      border-color: ${color};
      box-shadow: 0 0 ${loadPct > 0.8 ? '12px' : '6px'} ${color}55;
      animation: ${loadPct > 0.8 ? 'ngPulseRed 1.4s ease-in-out infinite' : loadPct > 0.6 ? 'ngPulseYellow 2s ease-in-out infinite' : 'none'};
    ">
      <div class="ng-bld-short" style="color:${color}">${building.shortName}</div>
      <div class="ng-bld-load">${Math.round(building.currentLoad)} kW</div>
      <div class="ng-bld-pct">
        <div style="width:${Math.round(loadPct * 100)}%;height:100%;border-radius:2px;background:${color};"></div>
      </div>
    </div>`,
    className: '',
    iconSize:   [72, 42],
    iconAnchor: [36, 21],
  })

  return (
    <>
      <Rectangle
        bounds={building.bounds}
        pathOptions={{
          color,
          fillColor:   color,
          fillOpacity: isSelected ? 0.42 : 0.12,
          weight:      isSelected ? 2.5  : 1.5,
          dashArray:   isSelected ? undefined : '6 3',
        }}
        eventHandlers={{
          click:     e => { L.DomEvent.stopPropagation(e); onSelect(building.id) },
          mouseover: e => { e.target.setStyle({ fillOpacity: 0.32, weight: 2 }) },
          mouseout:  e => { e.target.setStyle({ fillOpacity: isSelected ? 0.42 : 0.12, weight: isSelected ? 2.5 : 1.5 }) },
        }}
      >
        <Tooltip direction="top" offset={[0, -8]} opacity={1} className="ng-map-tooltip">
          <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 148 }}>
            <div style={{ fontWeight: 700, color: '#fff', fontSize: 12, marginBottom: 4 }}>
              {building.icon} {building.name}
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#94A3B8' }}>
              <span><span style={{ color }}>{Math.round(building.currentLoad)} kW</span> load</span>
              <span>{building.occupancy}% occ.</span>
              <span>{building.temperature}°F</span>
            </div>
          </div>
        </Tooltip>
      </Rectangle>

      <Marker
        position={building.center}
        icon={icon}
        eventHandlers={{
          click: e => { L.DomEvent.stopPropagation(e); onSelect(building.id) },
        }}
      />
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DigitalTwin() {
  // ── Shared energy data — EnergyContext is the single source of truth ─────
  // useCampusData3D is kept only for room-level 3D heatmap data (floor/room
  // breakdown).  All building-level energy values come from EnergyContext so
  // the Digital Twin always shows the same numbers as the main Dashboard.
  const { buildingStats: rawBuildingStats, rooms } = useCampusData3D()
  const { buildings: energyBuildings, metrics, lastUpdated } = useEnergy()

  // Merge: energy from EnergyContext, room counts from useCampusData3D
  const buildingStats = useMemo(() => {
    const stats = {}
    energyBuildings.forEach(eb => {
      const raw = rawBuildingStats[eb.id] ?? {}
      const pct = eb.currentLoad / (eb.capacity || 1)
      stats[eb.id] = {
        totalEnergy:  eb.currentLoad,
        avgEnergy:    raw.avgEnergy,
        avgOccupancy: eb.occupancy ?? raw.avgOccupancy ?? 0,
        activeRooms:  raw.activeRooms ?? 0,
        totalRooms:   raw.totalRooms  ?? 0,
        status:       pct < 0.6 ? 'efficient' : pct < 0.8 ? 'moderate' : 'high',
      }
    })
    return stats
  }, [energyBuildings, rawBuildingStats])

  // ── Ambient 2D-only state (devices / occupancy / temperature) ─────────────
  const [ambient,   setAmbient]  = useState(initAmbient)
  const [history,   setHistory]  = useState(initHistory)
  const [liveMode,  setLiveMode] = useState(true)
  const [lastTick,  setLastTick] = useState(new Date())

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selectedId,  setSelectedId]  = useState(null)
  const [typeFilter,  setTypeFilter]  = useState('All')
  const [viewMode,    setViewMode]    = useState('2d')  // '2d' | '3d'
  const [view3dId,    setView3dId]    = useState(null)

  // ── Merge static 2D building config + live energy from EnergyContext ───────
  const buildings = useMemo(() => CAMPUS_BUILDINGS_2D.map(b => {
    const energyB = energyBuildings.find(eb => eb.id === b.id)
    const amb     = ambient[b.id] ?? {}
    return {
      ...b,
      currentLoad: energyB?.currentLoad ?? b.baseLoad,
      ...amb,
    }
  }), [energyBuildings, ambient])

  // ── Ambient tick (devices / occupancy / temp only — energy is from hook) ───
  useEffect(() => {
    if (!liveMode) return
    const iv = setInterval(() => {
      setAmbient(prev => {
        const next = {}
        CAMPUS_BUILDINGS_2D.forEach(b => {
          const p = prev[b.id] ?? {}
          next[b.id] = {
            devices:     Math.max(1, (p.devices ?? b.baseDevices) + Math.round((Math.random() - 0.5) * 2)),
            occupancy:   clamp(Math.round((p.occupancy   ?? b.baseOccupancy) + (Math.random() - 0.5) * 4), 0, 100),
            temperature: +clamp((p.temperature ?? b.baseTemp) + (Math.random() - 0.5) * 0.6, 60, 85).toFixed(1),
          }
        })
        return next
      })
      setLastTick(new Date())
    }, 5000)
    return () => clearInterval(iv)
  }, [liveMode])

  // ── Append energy history whenever buildingStats updates (every 5 s) ───────
  useEffect(() => {
    setHistory(ph => {
      const next = {}
      CAMPUS_BUILDINGS_2D.forEach(b => {
        const load = buildingStats[b.id]?.totalEnergy ?? b.baseLoad
        const arr  = ph[b.id] ?? []
        next[b.id] = [...arr.slice(-24), { load: Math.round(load), idx: arr.length }]
      })
      return next
    })
  }, [buildingStats])

  // ── Computed campus-wide stats — all derived from EnergyContext ──────────────
  const totalLoad     = metrics.totalConsumption
  const totalCapacity = useMemo(() => CAMPUS_BUILDINGS_2D.reduce((s, b) => s + b.capacity, 0), [])
  const greenCount    = useMemo(() => Object.values(buildingStats).filter(b => b.status === 'efficient').length, [buildingStats])
  const yellowCount   = useMemo(() => Object.values(buildingStats).filter(b => b.status === 'moderate').length,  [buildingStats])
  const redCount      = useMemo(() => Object.values(buildingStats).filter(b => b.status === 'high').length,      [buildingStats])

  const displayed = typeFilter === 'All'
    ? buildings
    : buildings.filter(b => b.type === typeFilter)

  const selected           = buildings.find(b => b.id === selectedId) ?? null
  const selected3dBuilding = BUILDINGS_3D.find(b => b.id === view3dId) ?? null

  const handleSelect   = useCallback(id => setSelectedId(id), [])
  const handleDeselect = useCallback(() => setSelectedId(null), [])

  return (
    <div className="flex flex-col gap-4 animate-fade-in" style={{ height: 'calc(100vh - 7rem)' }}>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Digital Twin — Campus Map</h1>
          <p className="text-text-dim text-sm mt-0.5">
            {buildings.length} buildings · Live energy · Left/Right campus split
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 2D / 3D toggle */}
          <div className="flex rounded-lg overflow-hidden border border-base-border">
            <button
              onClick={() => setViewMode('2d')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all',
                viewMode === '2d'
                  ? 'bg-accent-blue/15 text-accent-blue'
                  : 'bg-base-elevated text-text-dim hover:text-gray-900',
              )}
            >
              <Map size={12} /> 2D MAP
            </button>
            <button
              onClick={() => setViewMode('3d')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all border-l border-base-border',
                viewMode === '3d'
                  ? 'bg-accent-blue/15 text-accent-blue'
                  : 'bg-base-elevated text-text-dim hover:text-gray-900',
              )}
            >
              <Box size={12} /> 3D VIEW
            </button>
          </div>

          {/* Live toggle */}
          {viewMode === '2d' && (
            <button
              onClick={() => setLiveMode(m => !m)}
              className={clsx(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                liveMode
                  ? 'border-accent-green/30 bg-accent-green/10 text-accent-green'
                  : 'border-base-border bg-base-elevated text-text-dim hover:text-gray-900',
              )}
            >
              {liveMode
                ? <><Wifi size={12} className="animate-pulse-slow" /> LIVE</>
                : <><WifiOff size={12} /> PAUSED</>}
            </button>
          )}

          {/* Type filter */}
          {viewMode === '2d' && (
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="glass text-xs text-text-main border border-base-border rounded-lg px-3 py-1.5 bg-base-elevated focus:outline-none focus:border-accent-blue/40"
            >
              {FILTERS.map(f => <option key={f} value={f}>{f === 'All' ? 'All Types' : f}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── Campus stats strip ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 flex-shrink-0">
        {[
          { label: 'Current Load',   value: `${Math.round(totalLoad).toLocaleString()} kW`,        color: '#0284C7', icon: Zap           },
          { label: 'Utilization',  value: `${Math.round((totalLoad / totalCapacity) * 100)}%`,   color: '#7C3AED', icon: Activity      },
          { label: 'Efficient',    value: `${greenCount} bldgs`,                                  color: '#059669', icon: CheckCircle   },
          { label: 'Moderate',     value: `${yellowCount} bldgs`,                                 color: '#EA580C', icon: Layers        },
          { label: 'High Load',    value: `${redCount} bldgs`,                                    color: '#DB2777', icon: AlertTriangle },
          { label: 'Last Updated', value: format(lastUpdated, 'HH:mm:ss'),                        color: '#64748B', icon: RefreshCw     },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="glass rounded-xl border border-base-border px-3 py-2.5 flex items-center gap-2">
            <Icon size={13} style={{ color }} className="flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-text-dim text-xxs truncate">{label}</p>
              <p className="text-gray-900 text-xs font-bold font-mono truncate" style={{ color }}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── View container ─────────────────────────────────────────────────── */}
      <div className="relative flex-1 rounded-2xl overflow-hidden border border-base-border min-h-0">

        {/* ════════════════════════════════════════════════════
            2D — Leaflet map
        ════════════════════════════════════════════════════ */}
        {viewMode === '2d' && (
          <>
            <MapContainer
              center={CAMPUS_CENTER}
              zoom={CAMPUS_ZOOM}
              scrollWheelZoom
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                subdomains="abcd"
                maxZoom={20}
              />
              <MapClickHandler onDeselect={handleDeselect} />
              {displayed.map(b => (
                <BuildingOverlay
                  key={b.id}
                  building={b}
                  isSelected={selectedId === b.id}
                  onSelect={handleSelect}
                />
              ))}
            </MapContainer>

            {/* Top-left campus badge */}
            <div className="absolute top-3 left-3 z-[500] pointer-events-none">
              <div className="glass rounded-lg px-3 py-1.5 border border-border-subtle flex items-center gap-2">
                <Building2 size={12} className="text-accent-blue" />
                <span className="text-text-dim text-xxs font-mono uppercase tracking-widest">Neura Campus · 2026</span>
                {liveMode && <span className="w-1.5 h-1.5 rounded-full bg-accent-green ml-1" />}
              </div>
            </div>

            {/* Bottom-left: legend + cluster labels */}
            <div className="absolute bottom-6 left-3 z-[500] pointer-events-none space-y-2">
              {/* Cluster legend */}
              <div className="glass rounded-xl border border-base-border px-3 py-2 flex gap-6">
                <div className="text-center">
                  <div className="text-xxs font-bold text-text-dim uppercase tracking-widest mb-1">◀ WEST</div>
                  {['green','bblock','stevejobs'].map(id => {
                    const b = CAMPUS_BUILDINGS_2D.find(x => x.id === id)
                    return (
                      <div key={id} className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: b.color }} />
                        <span className="text-xxs text-gray-900 font-mono">{b.shortName}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="w-px bg-base-border" />
                <div className="text-center">
                  <div className="text-xxs font-bold text-text-dim uppercase tracking-widest mb-1">EAST ▶</div>
                  {['ablock','cblock','mechlabs'].map(id => {
                    const b = CAMPUS_BUILDINGS_2D.find(x => x.id === id)
                    return (
                      <div key={id} className="flex items-center gap-1.5 mb-0.5">
                        <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: b.color }} />
                        <span className="text-xxs text-gray-900 font-mono">{b.shortName}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Energy legend */}
              <div className="glass rounded-xl border border-base-border p-3 space-y-2 min-w-[160px]">
                <p className="text-text-dim text-xxs uppercase tracking-widest mb-1">Energy Status</p>
                {LEGEND.map(({ color, label, sub }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}88` }} />
                    <div>
                      <p className="text-gray-900 text-xxs font-semibold leading-none">{label}</p>
                      <p className="text-text-dim text-xxs">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom-right: building count */}
            <div className="absolute bottom-6 right-3 z-[500] pointer-events-none">
              <div className="glass rounded-xl border border-base-border px-3 py-2 text-right">
                <p className="text-text-dim text-xxs">Showing</p>
                <p className="text-gray-900 text-sm font-bold font-mono">
                  {displayed.length}
                  <span className="text-text-dim text-xxs font-normal"> / {buildings.length} buildings</span>
                </p>
              </div>
            </div>

            {/* Top-right: building panel */}
            {selected && (
              <BuildingPanel
                building={selected}
                history={history[selected.id] ?? []}
                onClose={handleDeselect}
              />
            )}

            {/* Centre click hint */}
            {!selected && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[400] pointer-events-none">
                <div className="glass rounded-2xl px-5 py-3 border border-base-border text-center animate-fade-in" style={{ background: 'rgba(255,255,255,0.97)' }}>
                  <p className="text-gray-900 text-sm font-medium">Click any building to inspect</p>
                  <p className="text-text-dim text-xs mt-0.5">Real-time energy · devices · occupancy</p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════
            3D — React Three Fiber scene
        ════════════════════════════════════════════════════ */}
        {viewMode === '3d' && (
          <>
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center bg-[#F8FAFC]">
                  <div className="text-center">
                    <div className="w-10 h-10 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-text-dim text-sm">Loading 3D scene…</p>
                  </div>
                </div>
              }
            >
              {/* Pass the shared buildingStats so the 3D scene can use same data */}
              <CampusScene3D selectedId={view3dId} onSelect={setView3dId} />
            </Suspense>

            {/* Top-left: campus badge */}
            <div className="absolute top-3 left-3 z-10 pointer-events-none">
              <div className="glass rounded-lg px-3 py-1.5 border border-base-border flex items-center gap-2">
                <Box size={12} className="text-accent-blue" />
                <span className="text-text-dim text-xxs font-mono uppercase tracking-widest">Neura Campus · 3D View</span>
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-slow" />
              </div>
            </div>

            {/* Bottom-left: controls + mini campus map */}
            <div className="absolute bottom-4 left-3 z-10 space-y-2">
              {/* Interactive mini-map */}
              <div className="pointer-events-auto">
                <CampusMiniMap
                  selectedId={view3dId}
                  onSelect={setView3dId}
                  buildingStats={buildingStats}
                />
              </div>

              {/* Controls legend */}
              <div className="glass rounded-xl border border-dark-border px-3 py-2.5 space-y-1 min-w-[180px] pointer-events-none">
                <p className="text-text-dim text-xxs uppercase tracking-widest mb-1.5">Controls</p>
                {[
                  ['Left drag',  'Rotate'],
                  ['Right drag', 'Pan'],
                  ['Scroll',     'Zoom'],
                  ['Click bldg', 'Inspect'],
                ].map(([key, val]) => (
                  <div key={key} className="flex justify-between gap-4">
                    <span className="text-text-dim text-xxs">{key}</span>
                    <span className="text-gray-900 text-xxs font-semibold">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom-right: campus count */}
            <div className="absolute bottom-4 right-3 z-10 pointer-events-none">
              <div className="glass rounded-xl border border-base-border px-3 py-2 text-right">
                <p className="text-text-dim text-xxs">Campus</p>
                <p className="text-gray-900 text-sm font-bold font-mono">
                  {BUILDINGS_3D.length}
                  <span className="text-text-dim text-xxs font-normal"> buildings · live</span>
                </p>
              </div>
            </div>

            {/* Top-right: selected building info panel */}
            {selected3dBuilding && (() => {
              const stats = buildingStats[selected3dBuilding.id]
              const statusColor = stats?.status === 'efficient' ? '#059669'
                                : stats?.status === 'moderate'  ? '#EA580C' : '#DB2777'
              const statusLabel = stats?.status === 'efficient' ? 'Efficient'
                                : stats?.status === 'moderate'  ? 'Moderate'  : 'High Load'
              return (
                <div className="absolute top-3 right-3 z-10 w-68">
                  <div
                    className="glass rounded-2xl border p-4 animate-fade-in"
                    style={{
                      background:    'rgba(255,255,255,0.98)',
                      backdropFilter:'blur(18px)',
                      borderColor:   selected3dBuilding.color + '44',
                      boxShadow:     `0 0 32px ${selected3dBuilding.color}18`,
                      width:          272,
                    }}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-xs font-bold font-mono tracking-wider mb-0.5" style={{ color: selected3dBuilding.color }}>
                          {selected3dBuilding.shortName}
                        </div>
                        <div className="text-gray-900 text-sm font-semibold leading-tight">{selected3dBuilding.name}</div>
                        <div className="text-text-dim text-xxs mt-0.5">{selected3dBuilding.subtitle}</div>
                      </div>
                      <button
                        onClick={() => setView3dId(null)}
                        className="text-text-dim hover:text-gray-900 text-lg leading-none ml-2 pointer-events-auto flex-shrink-0"
                      >×</button>
                    </div>

                    {/* Live energy badge */}
                    {stats && (
                      <div
                        className="flex items-center justify-between rounded-xl px-3 py-2 mb-3"
                        style={{ background: statusColor + '14', border: `1px solid ${statusColor}33` }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-xxs font-bold" style={{ color: statusColor }}>● {statusLabel}</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-bold font-mono" style={{ color: statusColor }}>
                            {Math.round(stats.totalEnergy).toLocaleString()}
                          </span>
                          <span className="text-xxs text-text-dim">kW</span>
                        </div>
                      </div>
                    )}

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: 'Classrooms', value: selected3dBuilding.classroomCount, color: selected3dBuilding.color },
                        { label: 'Floors',     value: selected3dBuilding.floors,          color: selected3dBuilding.accentColor },
                        { label: 'Occupancy',  value: `${stats?.avgOccupancy ?? '--'}%`,  color: '#64748B' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-slate-100 rounded-lg px-2 py-2 text-center">
                          <p className="text-xxs text-text-dim mb-0.5">{label}</p>
                          <p className="text-sm font-bold font-mono" style={{ color }}>{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Type badge */}
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="px-2 py-0.5 rounded-full text-xxs font-semibold capitalize"
                        style={{
                          background: `${selected3dBuilding.color}22`,
                          color:       selected3dBuilding.color,
                          border:     `1px solid ${selected3dBuilding.color}44`,
                        }}
                      >
                        {selected3dBuilding.type}
                      </div>
                      {/* Active room count */}
                      {stats && (
                        <div className="text-xxs text-text-dim">
                          {stats.activeRooms}/{stats.totalRooms} rooms active
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-text-dim text-xxs leading-relaxed">{selected3dBuilding.description}</p>
                  </div>
                </div>
              )
            })()}

            {/* Centre click hint when nothing selected */}
            {!selected3dBuilding && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                <div className="glass rounded-2xl px-5 py-3 border border-base-border text-center animate-fade-in" style={{ background: 'rgba(255,255,255,0.98)' }}>
                  <p className="text-gray-900 text-sm font-medium">Click any building to inspect</p>
                  <p className="text-text-dim text-xs mt-0.5">Drag to orbit · scroll to zoom</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
