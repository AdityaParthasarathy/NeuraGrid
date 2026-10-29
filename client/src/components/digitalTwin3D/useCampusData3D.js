/**
 * NeuraGrid — 3-D Campus Data Hook
 *
 * Building configuration is imported from the single source of truth:
 *   src/data/buildings.js
 *
 * This file adds room-level telemetry generation and a live-tick hook so
 * the 3-D Digital Twin can render per-room energy heatmaps.
 *
 * Campus Layout
 * ─────────────────────────────────────────────────────────────
 *   LEFT SIDE  (negative X)        RIGHT SIDE (positive X)
 *   ┌──────────┐                   ┌──────────┐
 *   │  GREEN   │    boulevard      │  A-BLK   │   ← North row
 *   └──────────┘                   └──────────┘
 *   ┌──────────────────────┐       ┌─────────────────────────┐
 *   │    B-BLK (wide)      │       │     C-BLK (widest)      │   ← Middle row
 *   └──────────────────────┘       └─────────────────────────┘
 *   ┌────────────────────┐         ┌──────────────────┐
 *   │  SJ-AUD (wide-low) │         │  MECH (chunky)   │   ← South row
 *   └────────────────────┘         └──────────────────┘
 */
import { useState, useEffect, useMemo } from 'react'
import { BUILDINGS } from '../../data/buildings'

// ─── Re-export so any legacy import of BUILDINGS_3D still works ───────────────
export const BUILDINGS_3D = BUILDINGS

// ─── Room generation ──────────────────────────────────────────────────────────
function generateRooms(building) {
  const roomsPerFloor = Math.ceil(building.classroomCount / building.floors)
  return Array.from({ length: building.classroomCount }, (_, i) => {
    const floor   = Math.floor(i / roomsPerFloor) + 1
    const roomNum = (i % roomsPerFloor) + 1
    const energy  = 8 + Math.random() * 85
    return {
      id:        `${building.id}-room-${i}`,
      index:     i,
      name:      `${building.shortName} Room ${floor}${String(roomNum).padStart(2, '0')}`,
      floor,
      roomNum,
      energy:    parseFloat(energy.toFixed(1)),
      occupancy: Math.round(15 + Math.random() * 80),
      status:    energy < 35 ? 'efficient' : energy < 65 ? 'moderate' : 'high',
    }
  })
}

function tickRoom(room) {
  const delta  = (Math.random() - 0.5) * 7
  const energy = Math.max(5, Math.min(95, room.energy + delta))
  return {
    ...room,
    energy:    parseFloat(energy.toFixed(1)),
    occupancy: Math.max(0, Math.min(100, room.occupancy + Math.round((Math.random() - 0.5) * 8))),
    status:    energy < 35 ? 'efficient' : energy < 65 ? 'moderate' : 'high',
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useCampusData3D() {
  const [rooms, setRooms] = useState(() => {
    const all = {}
    BUILDINGS_3D.forEach(b => { all[b.id] = generateRooms(b) })
    return all
  })

  // Live tick every 5 seconds
  useEffect(() => {
    const iv = setInterval(() => {
      setRooms(prev => {
        const next = {}
        Object.entries(prev).forEach(([id, rs]) => { next[id] = rs.map(tickRoom) })
        return next
      })
    }, 5000)
    return () => clearInterval(iv)
  }, [])

  // Per-building aggregate stats — used by BOTH 3-D scene and 2-D map
  const buildingStats = useMemo(() => {
    const stats = {}
    BUILDINGS_3D.forEach(b => {
      const rs           = rooms[b.id] ?? []
      const totalEnergy  = rs.reduce((s, r) => s + r.energy, 0)
      const activeRooms  = rs.filter(r => r.occupancy > 10).length
      const avgEnergy    = rs.length ? totalEnergy / rs.length : 0
      const avgOccupancy = rs.length
        ? Math.round(rs.reduce((s, r) => s + r.occupancy, 0) / rs.length)
        : 0
      stats[b.id] = {
        totalEnergy:   parseFloat(totalEnergy.toFixed(0)),
        avgEnergy:     parseFloat(avgEnergy.toFixed(1)),
        avgOccupancy,
        activeRooms,
        totalRooms:    rs.length,
        status:        avgEnergy < 35 ? 'efficient' : avgEnergy < 65 ? 'moderate' : 'high',
      }
    })
    return stats
  }, [rooms])

  return { rooms, buildingStats }
}
