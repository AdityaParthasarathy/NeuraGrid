/**
 * NeuraGrid — CampusScene3D
 *
 * Full React-Three-Fiber scene for the 3D campus digital twin.
 *
 * Interactivity handled here
 *   CameraController  smooth zoom-in on building click, zoom-out on deselect
 *   EnergyFlowParticles  arcing coloured particles from each building → campus centre
 *
 * Props
 *   selectedId  string | null   currently selected building id (controlled)
 *   onSelect    (id) => void    called on building click / background click
 */
import { Suspense, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Stars } from '@react-three/drei'
import * as THREE from 'three'

import Building3D   from './Building3D'
import { BUILDINGS_3D, useCampusData3D } from './useCampusData3D'

// ─── Module-level scratch objects for EnergyFlowParticles ────────────────────
const _fp    = new THREE.Object3D()   // flow particle dummy
const _fc    = new THREE.Color()      // flow particle colour scratch

// ─── Camera overview defaults ─────────────────────────────────────────────────
// Campus now spans X ≈ –23 to +24 (47 units) and Z ≈ –16 to +23 (39 units).
// Pull back enough to frame both clusters with comfortable margin.
const CAM_OVERVIEW_POS = [1, 44, 52]
const CAM_OVERVIEW_TGT = [1,  3,  2]

// ─── CameraController ─────────────────────────────────────────────────────────
/**
 * Uses OrbitControls + useFrame lerp for smooth camera zoom animation.
 * No external camera-controls library needed — zero crash risk.
 *
 *   building selected → lerp camera to building.camPosition / camTarget
 *   null              → lerp back to full campus overview
 */
function CameraController({ selectedId }) {
  const controlsRef  = useRef()
  const { camera }   = useThree()

  // Animation state stored in refs so useFrame always sees latest values
  const destPos    = useRef(new THREE.Vector3(...CAM_OVERVIEW_POS))
  const destTarget = useRef(new THREE.Vector3(...CAM_OVERVIEW_TGT))
  const animating  = useRef(false)

  // React to building selection / deselection
  useEffect(() => {
    if (selectedId) {
      const b = BUILDINGS_3D.find(b => b.id === selectedId)
      if (!b) return
      destPos.current.set(b.camPosition[0], b.camPosition[1], b.camPosition[2])
      destTarget.current.set(b.camTarget[0], b.camTarget[1], b.camTarget[2])
    } else {
      destPos.current.set(...CAM_OVERVIEW_POS)
      destTarget.current.set(...CAM_OVERVIEW_TGT)
    }
    animating.current = true
    // Disable user interaction while the camera flies
    if (controlsRef.current) controlsRef.current.enabled = false
  }, [selectedId])

  // Lerp camera every frame until it reaches the destination
  useFrame(() => {
    const ctrl = controlsRef.current
    if (!ctrl || !animating.current) return

    camera.position.lerp(destPos.current, 0.07)
    ctrl.target.lerp(destTarget.current, 0.07)
    ctrl.update()

    const posErr = camera.position.distanceTo(destPos.current)
    const tgtErr = ctrl.target.distanceTo(destTarget.current)

    if (posErr < 0.05 && tgtErr < 0.05) {
      // Snap exactly to destination and hand control back to the user
      camera.position.copy(destPos.current)
      ctrl.target.copy(destTarget.current)
      ctrl.update()
      animating.current = false
      ctrl.enabled = true
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan
      enableZoom
      enableRotate
      minDistance={6}
      maxDistance={110}
      maxPolarAngle={Math.PI / 2.05}
      dampingFactor={0.06}
      enableDamping
      panSpeed={0.8}
      rotateSpeed={0.6}
      zoomSpeed={0.9}
    />
  )
}

// ─── EnergyFlowParticles ──────────────────────────────────────────────────────
/**
 * Animated sphere instances arcing from each building's base toward
 * the campus centre (0, 0, 0).
 *
 * Each building emits PARTICLES_PER_BLDG particles, staggered in phase so
 * they travel as a continuous stream.  Colour matches the building colour.
 * Size fades in/out with a sin envelope so they appear to materialise and
 * dissolve at the end of the arc.
 */
const PARTICLES_PER_BLDG = 5
const FLOW_SPEED         = 0.32   // arc cycles per second
const ARC_HEIGHT         = 2.2    // max Y of the arcing path
const MAX_SCALE          = 0.18   // particle radius at mid-arc

function EnergyFlowParticles() {
  const meshRef = useRef()
  const timeRef = useRef(0)
  const total   = BUILDINGS_3D.length * PARTICLES_PER_BLDG   // 30

  // Set per-building particle colours once on mount
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    BUILDINGS_3D.forEach((b, bi) => {
      _fc.set(b.color)
      for (let p = 0; p < PARTICLES_PER_BLDG; p++) {
        mesh.setColorAt(bi * PARTICLES_PER_BLDG + p, _fc)
      }
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [])

  // Animate positions every frame
  useFrame((state, delta) => {
    timeRef.current += delta
    const mesh = meshRef.current
    if (!mesh) return
    const t = timeRef.current

    BUILDINGS_3D.forEach((b, bi) => {
      const [bx, , bz] = b.position
      for (let p = 0; p < PARTICLES_PER_BLDG; p++) {
        const idx   = bi * PARTICLES_PER_BLDG + p
        // 0 → 1 phase for this particle (staggered evenly within the building slot)
        const phase = ((t * FLOW_SPEED + p / PARTICLES_PER_BLDG + bi * 0.17) % 1)

        // Lerp from building position → campus centre (1, -, 2)
        const x = bx  * (1 - phase) + 1 * phase
        const z = bz  * (1 - phase) + 2 * phase
        const y = Math.sin(phase * Math.PI) * ARC_HEIGHT + 0.3

        // Scale envelope: 0 at start/end, MAX_SCALE at midpoint
        const s = Math.sin(phase * Math.PI) * MAX_SCALE

        _fp.position.set(x, y, z)
        _fp.scale.setScalar(Math.max(0.001, s))  // avoid zero-scale warning
        _fp.updateMatrix()
        mesh.setMatrixAt(idx, _fp.matrix)
      }
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, total]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial transparent opacity={0.82} toneMapped={false} />
    </instancedMesh>
  )
}

// ─── Decorative campus ring ───────────────────────────────────────────────────
function CampusRing({ radius = 9.5, color = '#0284C7' }) {
  const ref = useRef()
  const timeRef = useRef(0)
  useFrame((state, delta) => {
    timeRef.current += delta
    if (ref.current)
      ref.current.material.opacity = 0.28 + Math.sin(timeRef.current * 1.4) * 0.14
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <ringGeometry args={[radius, radius + 0.35, 72]} />
      <meshBasicMaterial color={color} transparent opacity={0.28} depthWrite={false} />
    </mesh>
  )
}

// ─── Slowly-spinning orbit ring ───────────────────────────────────────────────
function OrbitRing({ radius = 22, color = '#7C3AED' }) {
  const ref = useRef()
  const timeRef = useRef(0)
  useFrame((state, delta) => {
    timeRef.current += delta
    if (ref.current) ref.current.rotation.y = timeRef.current * 0.08
  })
  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius, radius + 0.18, 128]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ─── Inner scene — must live inside <Canvas> for hooks to work ───────────────
function SceneContent({ selectedId, onSelect }) {
  const { buildingStats, rooms } = useCampusData3D()

  return (
    <>
      {/* ── Lighting ───────────────────────────────────────────────────────── */}
      <ambientLight intensity={0.65} color="#ffffff" />
      <directionalLight position={[10, 40, 10]} intensity={0.5} color="#ffffff" />
      <pointLight position={[0,   28,  0 ]} intensity={0.8} color="#0284C7" distance={80} />
      <pointLight position={[-22, 18, -18]} intensity={0.6} color="#7C3AED" distance={60} />
      <pointLight position={[ 20, 18,  12]} intensity={0.6} color="#059669" distance={60} />
      <pointLight position={[ 15,  8, -5 ]} intensity={0.5} color="#EA580C" distance={40} />

      {/* ── Ground grid ────────────────────────────────────────────────────── */}
      <Grid
        position={[1, 0, 2]}
        args={[100, 100]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#E2E8F0"
        sectionSize={10}
        sectionThickness={1.0}
        sectionColor="#CBD5E1"
        fadeDistance={90}
        fadeStrength={1.2}
      />

      {/* ── Decorative rings (centred on campus midpoint x=1, z=2) ──────────── */}
      <group position={[1, 0, 2]}>
        <CampusRing radius={6}  color="#0284C7" />
        <CampusRing radius={3}  color="#7C3AED" />
        <OrbitRing  radius={36} color="#7C3AED" />
        <OrbitRing  radius={42} color="#059669" />
      </group>

      {/* ── Starfield ──────────────────────────────────────────────────────── */}
      <Stars radius={130} depth={50} count={2200} factor={3} fade speed={0.4} />

      {/* ── Energy-flow particles (arcs building → campus centre) ──────────── */}
      <EnergyFlowParticles />

      {/* ── Buildings with live classrooms ─────────────────────────────────── */}
      {BUILDINGS_3D.map(b => (
        <Building3D
          key={b.id}
          building={b}
          stats={buildingStats[b.id]}
          rooms={rooms[b.id] ?? null}
          isSelected={selectedId === b.id}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

// ─── Public canvas component ──────────────────────────────────────────────────
export default function CampusScene3D({ selectedId, onSelect }) {
  return (
    <Canvas
      camera={{ position: CAM_OVERVIEW_POS, fov: 48, near: 0.1, far: 260 }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
      }}
      dpr={[1, 1.5]}
      onPointerMissed={() => onSelect(null)}
      onCreated={({ gl }) => {
        // Monitor context loss for stability diagnostics
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault()
          console.warn('[NeuraGrid] WebGL Context Lost. Attempting stability recovery...')
        }, false)
        gl.domElement.addEventListener('webglcontextrestored', () => {
          console.info('[NeuraGrid] WebGL Context Restored. Resuming simulation.')
        }, false)
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#F8FAFC']} />
      <fog   attach="fog"        args={['#F8FAFC', 75, 130]} />

      <Suspense fallback={null}>
        <SceneContent selectedId={selectedId} onSelect={onSelect} />
      </Suspense>

      {/* CameraController replaces OrbitControls — handles smooth zoom in/out */}
      <CameraController selectedId={selectedId} />
    </Canvas>
  )
}
