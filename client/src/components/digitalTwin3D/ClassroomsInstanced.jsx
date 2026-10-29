/**
 * NeuraGrid — ClassroomsInstanced
 *
 * One InstancedMesh draw call renders all classrooms in a building.
 * Three.js instance colors encode live energy status:
 *   green  #00ff88 — efficient  < 35 kW
 *   yellow #fbbf24 — moderate  35–65 kW
 *   red    #ff2d78 — high       > 65 kW   (pulsing via useFrame)
 *
 * Features
 *   • Hover any room  → Html tooltip (name · kW · occupancy · status)
 *   • High-energy rooms pulse between dim and bright red every frame
 *   • Floor separator wireframe lines for visual floor structure
 *   • Notifies parent when any room is hovered (suppresses building tooltip)
 *
 * Props
 *   rooms              Room[]           live room data from useCampusData3D
 *   building           BuildingConfig   static config from BUILDINGS_3D
 *   onRoomHoverChange  (bool) => void   called when hover state changes
 */
import { useRef, useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

// ─── Module-level scratch objects (single-threaded RAF, safe to reuse) ────────
const _c     = new THREE.Color()
const _dummy = new THREE.Object3D()

// Pre-built Color objects for the high-energy pulse lerp
const PULSE_DIM    = new THREE.Color('#9D174D') // pink-800
const PULSE_BRIGHT = new THREE.Color('#DB2777') // accent-pink

// ─── Status look-up tables ────────────────────────────────────────────────────
const STATUS_HEX = { efficient: '#059669', moderate: '#EA580C', high: '#DB2777' }
const STATUS_LBL = { efficient: 'Efficient', moderate: 'Moderate', high: 'High Load' }

function toColor(status) { return _c.set(STATUS_HEX[status] ?? '#6B7280') }

// ─── Layout computation (pure, called once per building) ──────────────────────
function computeLayout(building, count) {
  const [bw, bh, bd] = building.size
  const { floors, type, id } = building
  const rpf    = Math.ceil(count / floors)      // rooms per floor
  const aspect = bw / bd

  // Aspect-ratio-aware column count
  const cols  = Math.max(1, Math.round(Math.sqrt(rpf * aspect)))
  const rowsF = Math.ceil(rpf / cols)

  const margin = 0.13
  const availW = bw * (1 - margin * 2)
  const availD = bd * (1 - margin * 2)
  const floorH = bh / floors

  // Fill factor: fraction of each grid cell that the room box occupies
  const fill = id === 'mechlabs'       ? 0.87
             : type === 'auditorium'   ? 0.81
             : 0.74

  const cellW = availW / cols
  const cellD = availD / rowsF
  const cellH = floorH * 0.50

  const dims      = [cellW * fill, cellH, cellD * fill]
  const positions = new Float32Array(count * 3)

  for (let i = 0; i < count; i++) {
    const fi  = Math.floor(i / rpf)      // floor index (0-based)
    const pi  = i % rpf                  // position within floor
    const col = pi % cols
    const row = Math.floor(pi / cols)

    // Local coords: y=0 is the Building3D group centre (= bh/2 above ground)
    positions[i * 3]     = -availW / 2 + cellW * 0.5 + col * cellW
    positions[i * 3 + 1] = -bh    / 2 + floorH * fi  + floorH * 0.22 + cellH / 2
    positions[i * 3 + 2] = -availD / 2 + cellD * 0.5 + row * cellD
  }

  return { positions, dims, floorH, floors, availW, availD, cellH }
}

// ─── Floor-separator wireframe lines ─────────────────────────────────────────
function FloorSeparators({ building, floorH, floors, availW, availD }) {
  const lineGeo = useMemo(() => {
    const w = availW * 0.95
    const d = availD * 0.95
    return new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-w / 2, 0, -d / 2),
      new THREE.Vector3( w / 2, 0, -d / 2),
      new THREE.Vector3( w / 2, 0,  d / 2),
      new THREE.Vector3(-w / 2, 0,  d / 2),
      new THREE.Vector3(-w / 2, 0, -d / 2),  // close
    ])
  }, [availW, availD])

  const bh = building.size[1]
  return (
    <>
      {Array.from({ length: floors - 1 }, (_, i) => (
        <line key={i} geometry={lineGeo}
          position={[0, -bh / 2 + floorH * (i + 1), 0]}>
          <lineBasicMaterial color={building.color} transparent opacity={0.3} />
        </line>
      ))}
    </>
  )
}

// ─── Tooltip card — pure DOM component ───────────────────────────────────────
function RoomTooltip({ room, building }) {
  const hex = STATUS_HEX[room.status] ?? '#6B7280'
  return (
    <div style={{
      background:    'rgba(255,255,255,0.98)',
      border:        `1px solid ${hex}33`,
      borderRadius:  8,
      padding:       '9px 12px',
      fontFamily:    'Inter, system-ui, sans-serif',
      fontSize:      11,
      lineHeight:    1.65,
      whiteSpace:    'nowrap',
      pointerEvents: 'none',
      boxShadow:     `0 4px 20px rgba(0,0,0,0.08), 0 0 10px ${hex}10`,
      backdropFilter:'blur(8px)',
      minWidth:      150,
      color:         '#1F2937',
    }}>
      {/* Room name */}
      <div style={{ fontWeight: 700, color: building.color, fontSize: 12, marginBottom: 5 }}>
        {room.name}
      </div>
      {/* Stats */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#64748B' }}>
        <span>⚡ <b style={{ color: '#111827' }}>{room.energy} kW</b></span>
        <span>👥 <b style={{ color: '#111827' }}>{room.occupancy}%</b> occupied</span>
        <span style={{ color: hex, fontWeight: 600 }}>
          ● {STATUS_LBL[room.status] ?? room.status}
        </span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ClassroomsInstanced({ rooms, building, onRoomHoverChange }) {
  const meshRef        = useRef()
  const highIdxRef     = useRef([])          // indices of 'high' rooms, updated on tick
  const hideTimerRef   = useRef(null)        // debounce hover-out flicker

  const [hoveredId, setHoveredId] = useState(null)
  const timeRef = useRef(0)
  const count = rooms.length

  // Layout: computed once per building (geometry never changes)
  const layout = useMemo(
    () => computeLayout(building, count),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [building.id],
  )
  const { positions, dims, floorH, floors, availW, availD, cellH } = layout

  // ── Set instance transform matrices once (positions are static) ──────────────
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < count; i++) {
      _dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      _dummy.scale.setScalar(1)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [positions, count])

  // ── Refresh colors on every 5 s energy tick ──────────────────────────────────
  // High-energy rooms are intentionally SKIPPED here — useFrame handles their pulse
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const highs = []
    rooms.forEach((room, i) => {
      if (room.status === 'high') {
        highs.push(i)
      } else {
        mesh.setColorAt(i, toColor(room.status))
        // Also reset scale in case it was pulsing before
        _dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
        _dummy.scale.setScalar(1)
        _dummy.updateMatrix()
        mesh.setMatrixAt(i, _dummy.matrix)
      }
    })
    highIdxRef.current = highs
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [rooms, positions])

  // ── Notify parent when classroom hover state changes ─────────────────────────
  useEffect(() => {
    onRoomHoverChange?.(hoveredId !== null)
  }, [hoveredId, onRoomHoverChange])

  // ── useFrame: pulse scale+colour for high-energy rooms ───────────────────────
  useFrame((state, delta) => {
    timeRef.current += delta
    const mesh  = meshRef.current
    const highs = highIdxRef.current
    if (!mesh || highs.length === 0) return

    const t = timeRef.current
    let dirty = false

    highs.forEach(i => {
      // Staggered phase per room so they don't all pulse in sync
      const p = 0.5 + 0.5 * Math.sin(t * 2.6 + i * 0.55)

      // Scale pulse: 1.0 → 1.09
      const s = 1.0 + 0.09 * p
      _dummy.position.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
      _dummy.scale.setScalar(s)
      _dummy.updateMatrix()
      mesh.setMatrixAt(i, _dummy.matrix)

      // Color pulse: dim → bright red
      _c.copy(PULSE_DIM).lerp(PULSE_BRIGHT, p)
      mesh.setColorAt(i, _c)
      dirty = true
    })

    if (dirty) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })

  // ─── Hover handlers ──────────────────────────────────────────────────────────
  const handlePointerMove = (e) => {
    e.stopPropagation()
    clearTimeout(hideTimerRef.current)
    if (e.instanceId !== undefined && e.instanceId !== hoveredId) {
      setHoveredId(e.instanceId)
      document.body.style.cursor = 'pointer'
    }
  }

  const handlePointerOut = () => {
    // Short debounce to prevent flickering when crossing the narrow gap between cubes
    hideTimerRef.current = setTimeout(() => {
      setHoveredId(null)
      document.body.style.cursor = 'auto'
    }, 60)
  }

  // ─── Cleanup timer on unmount ────────────────────────────────────────────────
  useEffect(() => () => clearTimeout(hideTimerRef.current), [])

  const hoveredRoom = hoveredId !== null ? rooms[hoveredId] ?? null : null

  return (
    <group>

      {/* ── Room cubes: single InstancedMesh draw call ────────────────────── */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        frustumCulled={false}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={dims} />
        {/*
          MeshBasicMaterial: zero lighting cost.
          Instance colors become the full emitted colour.
          toneMapped=false keeps neon values saturated & vivid.
        */}
        <meshBasicMaterial transparent opacity={0.92} toneMapped={false} />
      </instancedMesh>

      {/* ── Classroom hover tooltip ───────────────────────────────────────── */}
      {hoveredRoom && (
        <Html
          position={[
            positions[hoveredId * 3],
            positions[hoveredId * 3 + 1] + cellH * 0.65,
            positions[hoveredId * 3 + 2],
          ]}
          center
          distanceFactor={9}
          zIndexRange={[200, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <RoomTooltip room={hoveredRoom} building={building} />
        </Html>
      )}

      {/* ── Floor separator lines ─────────────────────────────────────────── */}
      <FloorSeparators
        building={building}
        floorH={floorH}
        floors={floors}
        availW={availW}
        availD={availD}
      />
    </group>
  )
}
