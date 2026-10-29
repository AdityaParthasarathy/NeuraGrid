/**
 * NeuraGrid — Building3D
 *
 * Holographic building shell with live classrooms inside.
 *
 * Interaction model
 *   Hover shell (no room under cursor) → glass HTML tooltip: name / energy / rooms
 *   Hover classroom                    → classroom tooltip (from ClassroomsInstanced)
 *   Click building                     → onSelect(id) → parent triggers camera zoom
 *   Click outside                      → onSelect(null) → camera zoom-out
 *
 * Render layers (back → front)
 *   1. ClassroomsInstanced  coloured room cubes + floor lines + room tooltip
 *   2. Transparent box body very low opacity; rooms visible through the shell
 *   3. Neon edge lines       inner + outer glow halo, colour-shifts on select
 *   4. Top-cap plane         subtle emissive roof glow
 *   5. Text labels           short name + live energy / room count
 *   6. Building Html tooltip appears on building hover when no room is hovered
 *   7. Selection ring        pulsing base ring when building is active
 */
import { useRef, useState, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Html } from '@react-three/drei'
import * as THREE from 'three'
import ClassroomsInstanced from './ClassroomsInstanced'

// ─── Building hover tooltip (DOM, rendered via drei Html) ────────────────────
function BuildingTooltip({ building, stats }) {
  const statusHex = stats.status === 'efficient' ? '#059669'
                  : stats.status === 'moderate'  ? '#EA580C'
                  :                                '#DB2777'
  const statusLbl = stats.status === 'efficient' ? 'Efficient'
                  : stats.status === 'moderate'  ? 'Moderate'
                  : 'High Load'

  return (
    <div style={{
      background:     'rgba(255,255,255,0.98)',
      border:         `1px solid ${building.color}33`,
      borderRadius:   12,
      padding:        '12px 16px',
      fontFamily:     'Inter, system-ui, sans-serif',
      fontSize:       11,
      lineHeight:     1.5,
      whiteSpace:     'nowrap',
      pointerEvents:  'none',
      boxShadow:      `0 8px 30px rgba(0,0,0,0.12), 0 0 15px ${building.color}10`,
      backdropFilter: 'blur(12px)',
      minWidth:       180,
      color:          '#1F2937',
    }}>
      {/* Header */}
      <div style={{ fontWeight: 700, color: building.color, fontSize: 13, marginBottom: 1 }}>
        {building.name}
      </div>
      <div style={{ color: '#64748B', fontSize: 10, marginBottom: 8 }}>
        {building.subtitle}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(0,0,0,0.06)', marginBottom: 8 }} />

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 14 }}>
        <div>
          <div style={{ color: '#64748B', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
            Total Energy
          </div>
          <div style={{ fontWeight: 700, color: statusHex, fontSize: 13 }}>
            {stats.totalEnergy} <span style={{ fontWeight: 400, fontSize: 10 }}>kW</span>
          </div>
        </div>
        <div>
          <div style={{ color: '#64748B', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
            Classrooms
          </div>
          <div style={{ fontWeight: 700, color: '#111827', fontSize: 13 }}>
            {stats.activeRooms}
            <span style={{ fontWeight: 400, color: '#64748B', fontSize: 10 }}>/{stats.totalRooms}</span>
          </div>
        </div>
        <div>
          <div style={{ color: '#64748B', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
            Status
          </div>
          <div style={{ fontWeight: 700, color: statusHex, fontSize: 11 }}>
            {statusLbl}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Building3D({ building, stats, rooms, isSelected, onSelect }) {
  const bodyRef  = useRef()
  const capRef   = useRef()

  const [hovered,        setHovered]        = useState(false)
  const [anyRoomHovered, setAnyRoomHovered] = useState(false)

  const [bw, bh, bd] = building.size
  const [bx, ,  bz]  = building.position
  const halfH        = bh / 2

  // ── Edge geometries — computed once per size ───────────────────────────────
  const [innerEdges, outerEdges] = useMemo(() => {
    const iGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(bw, bh, bd))
    const oGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(bw * 1.04, bh * 1.03, bd * 1.04))
    return [iGeo, oGeo]
  }, [bw, bh, bd])

  // Timer ref to avoid THREE.Clock deprecation warnings
  const timeRef = useRef(0)

  // Explicit disposal to prevent resource leaks (stabilizes context)
  useEffect(() => {
    return () => {
      innerEdges.dispose()
      outerEdges.dispose()
    }
  }, [innerEdges, outerEdges])

  // ── Shell + cap opacity: very transparent so classrooms are clearly visible ──
  useFrame((state, delta) => {
    timeRef.current += delta
    const t = timeRef.current
    if (bodyRef.current) {
      bodyRef.current.material.opacity = isSelected
        ? 0.30 + Math.sin(t * 2.8) * 0.08
        : hovered ? 0.20 : 0.12
    }
    if (capRef.current) {
      capRef.current.material.opacity = isSelected
        ? 0.40 + Math.sin(t * 2.8) * 0.12
        : hovered ? 0.25 : 0.15
    }
  })

  const lineColor   = isSelected ? building.accentColor : building.color
  const lineOpacity = isSelected ? 1.0 : hovered ? 0.90 : 0.65

  const statusColor = stats
    ? stats.status === 'efficient' ? '#059669'
    : stats.status === 'moderate'  ? '#EA580C' : '#DB2777'
    : '#94A3B8'

  // Show building tooltip only when:  hovered  AND  no room underneath  AND  stats available
  const showBldgTooltip = hovered && !anyRoomHovered && !isSelected && !!stats

  return (
    <group
      position={[bx, halfH, bz]}
      onClick={e  => { e.stopPropagation(); onSelect(building.id) }}
      onPointerOver={e => {
        e.stopPropagation()
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
    >

      {/* ── 1. Classrooms + floor lines ───────────────────────────────────────── */}
      {rooms && rooms.length > 0 && (
        <ClassroomsInstanced
          rooms={rooms}
          building={building}
          onRoomHoverChange={setAnyRoomHovered}
        />
      )}

      {/* ── 2. Holographic shell (ghost-transparent) ──────────────────────────── */}
      <mesh ref={bodyRef}>
        <boxGeometry args={[bw, bh, bd]} />
        <meshStandardMaterial
          color={building.color}
          emissive={building.color}
          emissiveIntensity={0.25}
          transparent
          opacity={0.12}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── 3a. Inner neon edge lines ─────────────────────────────────────────── */}
      <lineSegments geometry={innerEdges}>
        <lineBasicMaterial color={lineColor} transparent opacity={lineOpacity} />
      </lineSegments>

      {/* ── 3b. Outer glow halo ───────────────────────────────────────────────── */}
      <lineSegments geometry={outerEdges}>
        <lineBasicMaterial color={lineColor} transparent opacity={lineOpacity * 0.25} />
      </lineSegments>

      {/* ── 4. Emissive top-cap plane ─────────────────────────────────────────── */}
      <mesh ref={capRef} position={[0, halfH + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[bw * 0.93, bd * 0.93]} />
        <meshBasicMaterial color={building.color} transparent opacity={0.05} depthWrite={false} />
      </mesh>

      {/* ── 5a. Short-name label ──────────────────────────────────────────────── */}
      <Text
        position={[0, halfH + 1.45, 0]}
        fontSize={0.68}
        color={building.color}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.025}
        outlineColor="#FFFFFF"
        renderOrder={10}
      >
        {building.shortName}
      </Text>

      {/* ── 5b. Live energy readout ───────────────────────────────────────────── */}
      {stats && (
        <Text
          position={[0, halfH + 0.65, 0]}
          fontSize={0.40}
          color={statusColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.015}
          outlineColor="#FFFFFF"
          renderOrder={10}
        >
          {`${stats.totalEnergy} kW  ·  ${stats.activeRooms}/${stats.totalRooms} rooms`}
        </Text>
      )}

      {/* ── 6. Building hover tooltip (HTML overlay) ─────────────────────────── */}
      {showBldgTooltip && (
        <Html
          position={[0, halfH * 0.5, 0]}
          center
          distanceFactor={14}
          zIndexRange={[150, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <BuildingTooltip building={building} stats={stats} />
        </Html>
      )}

      {/* ── 7. Selection base ring ────────────────────────────────────────────── */}
      {isSelected && (
        <mesh position={[0, -halfH + 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(bw, bd) * 0.55, Math.max(bw, bd) * 0.62, 48]} />
          <meshBasicMaterial color={building.accentColor} transparent opacity={0.70} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}
