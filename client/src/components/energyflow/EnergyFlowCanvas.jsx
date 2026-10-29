/**
 * NeuraGrid — EnergyFlowCanvas
 *
 * Canvas-based energy flow topology:
 *
 *   [GRID SOURCE]  ──bezier──  [Building node]  ──line──  [Room ●] [Room ●]
 *       (×6 buildings, 2 rooms each)
 *
 * Visual encoding
 * ───────────────
 *   Line width    → 0.8–3.8 px, proportional to load %
 *   Particle count→ 2–10 per main path, proportional to load %
 *   Particle speed→ proportional to load %
 *   Colour        → cyan (< 65 %) → amber (65–85 %) → red (≥ 85 %)
 *   Overload glow → extra wide semi-transparent stroke + faster pulse on red paths
 *
 * Architecture
 * ────────────
 *   Mount-once RAF loop; live buildings data is read from a ref every frame
 *   so prop changes (slider moves, smart actions) take effect immediately
 *   without restarting the animation loop.
 *
 * @param {Array}   buildings  Building objects from EnergyContext
 * @param {boolean} active     false → clear canvas and pause RAF
 */

import React, { useRef, useEffect } from 'react'

// ─── Canvas logical dimensions ────────────────────────────────────────────────
const LW = 900    // logical width
const LH = 260    // logical height

// Cap DPR at 2 (same strategy as AirflowCanvas)
const MAX_DPR = Math.min(
  typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1,
  2,
)

// ─── Colour helpers ───────────────────────────────────────────────────────────
function loadColor(pct) {
  if (pct >= 85) return { r: 255, g:  45, b: 120 }   // overload — muted red
  if (pct >= 65) return { r: 251, g: 191, b:  36 }   // high     — amber
  return               { r:   0, g: 200, b: 255 }    // normal   — cyan
}

/**
 * Parse a CSS hex colour (#rgb / #rrggbb / #rrggbbaa) into { r, g, b }.
 * Canvas strokeStyle does NOT accept 8-digit hex — we must use rgba().
 * Falls back to cyan if the string is malformed.
 */
function hexToRgb(hex) {
  if (!hex || hex[0] !== '#') return { r: 0, g: 200, b: 255 }
  const h = hex.slice(1)
  if (h.length === 3) {
    return {
      r: parseInt(h[0] + h[0], 16),
      g: parseInt(h[1] + h[1], 16),
      b: parseInt(h[2] + h[2], 16),
    }
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

// ─── Bezier evaluation ────────────────────────────────────────────────────────
function cubicPt(t, p0, p1, p2, p3) {
  const u = 1 - t
  return {
    x: u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
    y: u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1],
  }
}

// ─── Topology helpers ─────────────────────────────────────────────────────────
const SRC_X = 78
const SRC_Y = LH / 2   // 130

// Building node centre — evenly distributed vertically
function bldPos(i, n) {
  const margin = 32
  return [390, margin + i * ((LH - margin * 2) / Math.max(n - 1, 1))]
}

// Room node positions (2 per building, above + below)
const ROOM_X = 600
const ROOM_OFFSET = 22
function roomPos(by, slot) {
  return [ROOM_X, by + (slot === 0 ? -ROOM_OFFSET : ROOM_OFFSET)]
}

// Cubic bezier: source → building (S-curve)
function srcBez(bx, by) {
  const cx = (SRC_X + bx) / 2
  return [[SRC_X, SRC_Y], [cx, SRC_Y], [cx, by], [bx, by]]
}

// Cubic bezier: building right edge → room
function bldToRoom(bx, by, rx, ry) {
  const mx = (bx + rx) / 2
  return [[bx, by], [mx, by], [mx, ry], [rx, ry]]
}

// ─── Particle factory ─────────────────────────────────────────────────────────
function makeParticles(count, speed) {
  return Array.from({ length: count }, (_, i) => ({
    t:     i / count,
    speed: speed * (0.75 + Math.random() * 0.5),
  }))
}

// ─── Rounded-rect path helper ─────────────────────────────────────────────────
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x,     y + h, x,     y + h - r)
  ctx.lineTo(x,     y + r)
  ctx.quadraticCurveTo(x,     y,     x + r, y)
  ctx.closePath()
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function EnergyFlowCanvas({ buildings = [], active = true }) {
  const canvasRef  = useRef(null)
  const bldgsRef   = useRef(buildings)
  const activeRef  = useRef(active)

  useEffect(() => { bldgsRef.current = buildings }, [buildings])
  useEffect(() => { activeRef.current = active   }, [active])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx  = canvas.getContext('2d', { alpha: true })
    let   raf  = null
    let   tick = 0

    // Particle pools indexed by path key (avoids re-allocating each frame)
    const srcParts = []   // [buildingIdx]  → particle array
    const rmParts  = []   // [bldIdx*2+slot] → particle array

    function ensureParticles(pool, key, count, speed) {
      if (!pool[key] || pool[key].length !== count) {
        pool[key] = makeParticles(count, speed)
      }
      return pool[key]
    }

    // ── Resize ────────────────────────────────────────────────────────────────
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

    // ── RAF loop ──────────────────────────────────────────────────────────────
    function frame() {
      raf = requestAnimationFrame(frame)
      tick++

      const dpr = MAX_DPR
      const cw  = canvas.width  / dpr
      const ch  = canvas.height / dpr
      const sx  = cw / LW
      const sy  = ch / LH

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cw, ch)

      const blds = bldgsRef.current
      if (!activeRef.current || !blds?.length) return

      ctx.save()
      ctx.scale(sx, sy)

      const n = blds.length

      // ── Source node ─────────────────────────────────────────────────────────
      const pulse = 0.5 + 0.5 * Math.sin(tick * 0.045)

      // Outer glow
      const srcGrad = ctx.createRadialGradient(SRC_X, SRC_Y, 3, SRC_X, SRC_Y, 32 + pulse * 8)
      srcGrad.addColorStop(0,   'rgba(0,200,255,0.30)')
      srcGrad.addColorStop(0.5, 'rgba(0,200,255,0.10)')
      srcGrad.addColorStop(1,   'rgba(0,200,255,0)')
      ctx.beginPath()
      ctx.arc(SRC_X, SRC_Y, 32 + pulse * 8, 0, Math.PI * 2)
      ctx.fillStyle = srcGrad
      ctx.fill()

      // Circle body
      ctx.beginPath()
      ctx.arc(SRC_X, SRC_Y, 20, 0, Math.PI * 2)
      ctx.fillStyle   = 'rgba(0,14,38,0.90)'
      ctx.strokeStyle = `rgba(0,200,255,${0.55 + pulse * 0.35})`
      ctx.lineWidth   = 1.5
      ctx.fill()
      ctx.stroke()

      // Labels
      ctx.textAlign    = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle    = 'rgba(0,220,255,0.95)'
      ctx.font         = 'bold 7.5px "JetBrains Mono", monospace'
      ctx.fillText('GRID', SRC_X, SRC_Y - 3)
      ctx.fillStyle = 'rgba(0,180,220,0.55)'
      ctx.font      = '5.5px "JetBrains Mono", monospace'
      ctx.fillText('SOURCE', SRC_X, SRC_Y + 6)

      // ── Per-building paths ──────────────────────────────────────────────────
      for (let i = 0; i < n; i++) {
        const b     = blds[i]
        const [bx, by] = bldPos(i, n)
        const pct   = Math.min(100, Math.round((b.currentLoad / b.capacity) * 100))
        const intens = pct / 100
        const { r, g, b: bc } = loadColor(pct)

        const bez    = srcBez(bx - 46, by)   // connect to left edge of building rect
        const lw     = 0.8 + intens * 3.0

        // ── Main path line
        ctx.beginPath()
        ctx.moveTo(bez[0][0], bez[0][1])
        ctx.bezierCurveTo(bez[1][0], bez[1][1], bez[2][0], bez[2][1], bez[3][0], bez[3][1])
        ctx.strokeStyle = `rgba(${r},${g},${bc},${0.14 + intens * 0.22})`
        ctx.lineWidth   = lw
        ctx.stroke()

        // Overload glow — wide semi-transparent pulse around the line
        if (pct >= 85) {
          const gA = 0.06 + 0.06 * Math.sin(tick * 0.14)
          ctx.beginPath()
          ctx.moveTo(bez[0][0], bez[0][1])
          ctx.bezierCurveTo(bez[1][0], bez[1][1], bez[2][0], bez[2][1], bez[3][0], bez[3][1])
          ctx.strokeStyle = `rgba(${r},${g},${bc},${gA})`
          ctx.lineWidth   = lw * 4
          ctx.stroke()
        }

        // ── Main path particles (src → building)
        const pCount = Math.round(2 + intens * 8)   // 2–10
        const speed  = 0.0038 + intens * 0.0095
        const parts  = ensureParticles(srcParts, i, pCount, speed)

        for (const p of parts) {
          p.t = (p.t + p.speed) % 1
          const pt    = cubicPt(p.t, ...bez)
          const alpha = Math.sin(p.t * Math.PI) * (0.55 + intens * 0.40)
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 1.6 + intens * 0.9, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${r},${g},${bc},${alpha.toFixed(3)})`
          ctx.fill()
        }

        // ── Building node rect (92 × 32)
        const BW = 92, BH = 32
        const nodeX = bx - BW / 2, nodeY = by - BH / 2
        rrect(ctx, nodeX, nodeY, BW, BH, 5)
        ctx.fillStyle   = 'rgba(0,10,28,0.82)'
        ctx.fill()
        // Border colour: building accent when normal, load-colour when stressed.
        // Canvas strokeStyle does NOT support 8-digit hex — always use rgba().
        const borderAlpha = 0.38 + intens * 0.30
        if (pct >= 65) {
          ctx.strokeStyle = `rgba(${r},${g},${bc},${borderAlpha})`
        } else {
          const { r: br, g: bg, b: bb } = hexToRgb(b.color)
          ctx.strokeStyle = `rgba(${br},${bg},${bb},${borderAlpha})`
        }
        ctx.lineWidth = 1
        ctx.stroke()

        // Short name
        ctx.fillStyle    = `rgba(${r},${g},${bc},0.95)`
        ctx.font         = 'bold 7.5px "JetBrains Mono", monospace'
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(b.shortName, bx, by - 7)

        // Load % text
        ctx.fillStyle = `rgba(${r},${g},${bc},0.65)`
        ctx.font      = '5.5px "JetBrains Mono", monospace'
        ctx.fillText(`${pct}%`, bx + 30, by - 7)

        // Load bar inside node
        const barPad = 7, barH = 3
        const barTotalW = BW - barPad * 2
        const barX = nodeX + barPad, barY = by + 4
        ctx.fillStyle = 'rgba(255,255,255,0.06)'
        ctx.beginPath()
        ctx.rect(barX, barY, barTotalW, barH)
        ctx.fill()
        ctx.fillStyle = `rgba(${r},${g},${bc},0.70)`
        ctx.beginPath()
        ctx.rect(barX, barY, barTotalW * intens, barH)
        ctx.fill()

        // ── Room sub-paths (2 per building)
        for (let s = 0; s < 2; s++) {
          const [rx, ry] = roomPos(by, s)

          // Room load is a rough split of building load
          const rPct    = Math.min(100, Math.round(pct * (s === 0 ? 0.56 : 0.44)))
          const rIntens = rPct / 100
          const { r: rr, g: rg, b: rb } = loadColor(rPct)

          // Path: building right edge → room dot
          const rBez = bldToRoom(bx + BW / 2, by + (s === 0 ? -7 : 7), rx, ry)

          ctx.beginPath()
          ctx.moveTo(rBez[0][0], rBez[0][1])
          ctx.bezierCurveTo(rBez[1][0], rBez[1][1], rBez[2][0], rBez[2][1], rBez[3][0], rBez[3][1])
          ctx.strokeStyle = `rgba(${rr},${rg},${rb},${0.10 + rIntens * 0.20})`
          ctx.lineWidth   = 0.5 + rIntens * 1.4
          ctx.stroke()

          // Room particles
          const rpCount = Math.round(1 + rIntens * 4)   // 1–5
          const rSpeed  = 0.006 + rIntens * 0.012
          const rParts  = ensureParticles(rmParts, i * 2 + s, rpCount, rSpeed)

          for (const p of rParts) {
            p.t = (p.t + p.speed) % 1
            const pt    = cubicPt(p.t, ...rBez)
            const alpha = Math.sin(p.t * Math.PI) * (0.5 + rIntens * 0.35)
            ctx.beginPath()
            ctx.arc(pt.x, pt.y, 1.1 + rIntens * 0.5, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(${rr},${rg},${rb},${alpha.toFixed(3)})`
            ctx.fill()
          }

          // Room dot
          ctx.beginPath()
          ctx.arc(rx, ry, 6.5, 0, Math.PI * 2)
          ctx.fillStyle   = 'rgba(0,10,28,0.82)'
          ctx.strokeStyle = `rgba(${rr},${rg},${rb},${0.35 + rIntens * 0.30})`
          ctx.lineWidth   = 0.9
          ctx.fill()
          ctx.stroke()

          // Room label
          ctx.fillStyle    = `rgba(${rr},${rg},${rb},0.62)`
          ctx.font         = '5.5px "JetBrains Mono", monospace'
          ctx.textAlign    = 'left'
          ctx.textBaseline = 'middle'
          ctx.fillText(`R${i * 2 + s + 1}`, rx + 9, ry)
        }
      }

      ctx.restore()
    }

    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      RO.disconnect()
    }
  }, [])   // mount-once — all live values via refs

  return (
    <canvas
      ref={canvasRef}
      aria-label="Energy flow topology"
      style={{
        display: 'block',
        width:   '100%',
        height:  '100%',
      }}
    />
  )
}
