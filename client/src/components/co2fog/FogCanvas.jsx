/**
 * NeuraGrid — FogCanvas
 *
 * Canvas-based fog / haze animation for a single building card.
 * Renders 4 large, soft-edged blobs (radial-gradient circles) that drift
 * slowly across the card, creating the illusion of misty air.
 *
 * Visual encoding
 * ───────────────
 *   Fog intensity     → blob opacity  (0 % at clear air, up to 16 % at dense)
 *   Ventilation level → blob drift speed (higher airflow pushes fog rightward)
 *   Re-entry          → blobs wrap from left after exiting right, maintaining
 *                       the illusion of continuous fog being pushed through vents
 *
 * Architecture
 * ────────────
 *   Mount-once RAF loop — co2 / ventilation / active read from refs each frame
 *   so prop changes (slider, smart action) take effect without restarting.
 *
 * @param {number}  co2         CO₂ ppm for this building
 * @param {number}  ventilation 0–100 ventilation level
 * @param {boolean} active      false → clear canvas and pause RAF
 */

import React, { useRef, useEffect } from 'react'
import { fogIntensity } from './fogUtils'

// ─── Math helpers ─────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
function lerp(a, b, t)    { return a + (b - a) * t }

// Cap DPR at 2 (same pattern as AirflowCanvas / EnergyFlowCanvas)
const MAX_DPR = Math.min(
  typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1,
  2,
)

// Blob count — enough for convincing coverage without performance cost
const BLOB_COUNT = 4

// ─── Blob factory ─────────────────────────────────────────────────────────────
/**
 * Each blob position/size is normalised (0–1) relative to canvas dimensions.
 *
 * @param {number} [x]  Optional forced x start position (for initial stagger)
 */
function makeBlob(x) {
  return {
    x:   x ?? Math.random(),              // 0–1 horizontal
    y:   0.12 + Math.random() * 0.76,     // keep blobs inside vertical bounds
    r:   0.28 + Math.random() * 0.28,     // radius as fraction of canvas height
    vx:  0.00015 + Math.random() * 0.00020, // slow rightward drift
    vy:  (Math.random() - 0.5) * 0.00008,   // tiny vertical wander
    ph:  Math.random() * Math.PI * 2,        // sine undulation phase
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FogCanvas({ co2 = 600, ventilation = 60, active = true }) {
  const canvasRef  = useRef(null)
  const co2Ref     = useRef(co2)
  const ventRef    = useRef(ventilation)
  const activeRef  = useRef(active)

  useEffect(() => { co2Ref.current    = co2        }, [co2])
  useEffect(() => { ventRef.current   = ventilation }, [ventilation])
  useEffect(() => { activeRef.current = active     }, [active])

  // Single mount effect — RAF loop + ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx  = canvas.getContext('2d', { alpha: true })
    let   raf  = null
    let   tick = 0

    // Stagger initial x positions so blobs span the full card immediately
    const blobs = Array.from({ length: BLOB_COUNT }, (_, i) =>
      makeBlob(i / BLOB_COUNT),
    )

    // ── Resize ──────────────────────────────────────────────────────────────
    function resize() {
      const rect = canvas.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      canvas.width  = Math.round(rect.width  * MAX_DPR)
      canvas.height = Math.round(rect.height * MAX_DPR)
    }

    const RO = window.ResizeObserver
      ? new ResizeObserver(resize)
      : { observe() {}, disconnect() {} }
    RO.observe(canvas)
    resize()

    // ── Animation loop ───────────────────────────────────────────────────────
    function frame() {
      raf = requestAnimationFrame(frame)
      tick++

      const dpr = MAX_DPR
      const cw  = canvas.width  / dpr
      const ch  = canvas.height / dpr

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cw, ch)

      if (!activeRef.current || cw < 10 || ch < 10) return

      const co2ppm = co2Ref.current
      const vent   = ventRef.current

      // Normalised fog intensity (0–1) — drives opacity and whether to render
      const intens = fogIntensity(co2ppm, vent)
      if (intens < 0.005) {
        // Air is clear — still advance positions so blobs are in natural spots
        // when fog rises again (no jarring jumps)
        for (const b of blobs) b.x += b.vx
        return
      }

      // Drift multiplier — ventilation "pushes" fog rightward faster
      // At vent = 0   → 1.0× (barely moving)
      // At vent = 100 → 3.4× (visibly dispersing toward the right)
      const ventMult = 1.0 + (vent / 100) * 2.4

      // Max alpha for this frame (0 → ~16 %)
      const maxAlpha = intens * 0.162

      // Fog colour: cool blue-white mist, slightly warmer tint at high CO₂
      //   Low CO₂  → (200, 218, 240)  cool blue-white
      //   High CO₂ → (215, 210, 225)  faintly purplish-gray (slightly "stale" feel)
      const co2t = clamp((co2ppm - 600) / 800, 0, 1)
      const fogR = Math.round(lerp(200, 215, co2t))
      const fogG = Math.round(lerp(218, 210, co2t))
      const fogB = Math.round(lerp(240, 225, co2t))

      for (const b of blobs) {
        // ── Physics ────────────────────────────────────────────────────────
        b.x += b.vx * ventMult
        b.y += b.vy + Math.sin(tick * 0.007 + b.ph) * 0.00025

        // Vertical clamp
        b.y = clamp(b.y, -0.05, 1.05)

        // Wrap: when pushed off right edge, re-enter from left
        if (b.x > 1.25) {
          b.x = -0.25
          b.y = 0.12 + Math.random() * 0.76
        }

        // ── Draw soft-edge blob ────────────────────────────────────────────
        const cx = b.x * cw
        const cy = b.y * ch
        const r  = b.r * ch   // radius in px

        // Slow sinusoidal flicker for a "drifting mist" feel
        const flicker = 0.70 + 0.30 * Math.sin(tick * 0.011 + b.ph)
        const alpha   = maxAlpha * flicker

        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        grad.addColorStop(0,    `rgba(${fogR},${fogG},${fogB},${(alpha).toFixed(4)})`)
        grad.addColorStop(0.40, `rgba(${fogR},${fogG},${fogB},${(alpha * 0.60).toFixed(4)})`)
        grad.addColorStop(0.75, `rgba(${fogR},${fogG},${fogB},${(alpha * 0.20).toFixed(4)})`)
        grad.addColorStop(1,    `rgba(${fogR},${fogG},${fogB},0)`)

        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      }
    }

    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      RO.disconnect()
    }
  }, [])  // mount-once — all live values via refs

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position:      'absolute',
        inset:         0,
        width:         '100%',
        height:        '100%',
        pointerEvents: 'none',
      }}
    />
  )
}
