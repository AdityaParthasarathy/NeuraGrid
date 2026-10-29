const router  = require('express').Router()
const Alert   = require('../models/Alert')
const {
  generateInsights,
  runSimulation,
  predictLoad,
} = require('../utils/aiSimulator')

// GET /api/ai/insights — all AI-generated insights
router.get('/insights', async (req, res, next) => {
  try {
    const { severity, type, buildingId, limit = 20 } = req.query
    let alerts = []

    try {
      const query = { resolved: false }
      if (severity)   query.severity   = severity
      if (type)       query.type       = type
      if (buildingId) query.buildingId = buildingId

      alerts = await Alert.find(query).sort({ createdAt: -1 }).limit(Number(limit)).lean()
    } catch { /* DB unavailable */ }

    if (!alerts.length) alerts = generateInsights()

    res.json({ success: true, count: alerts.length, data: alerts })
  } catch (err) {
    next(err)
  }
})

// POST /api/ai/predict — load prediction for a building
router.post('/predict', (req, res, next) => {
  try {
    const { buildingId, hour, params } = req.body
    if (!buildingId) return res.status(400).json({ error: 'buildingId is required' })
    const prediction = predictLoad(buildingId, hour ?? new Date().getHours(), params ?? {})
    res.json({ success: true, data: prediction })
  } catch (err) {
    next(err)
  }
})

// POST /api/ai/simulate — run what-if simulation
router.post('/simulate', (req, res, next) => {
  try {
    const { occupancy, outdoorTemp, solarPct, hvacAdjust, lightingAdjust } = req.body
    const results = runSimulation({ occupancy, outdoorTemp, solarPct, hvacAdjust, lightingAdjust })
    res.json({ success: true, data: results })
  } catch (err) {
    next(err)
  }
})

// POST /api/ai/alerts — create alert
router.post('/alerts', async (req, res, next) => {
  try {
    const alert = await Alert.create(req.body)
    res.status(201).json({ success: true, data: alert })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/ai/alerts/:id/resolve
router.patch('/alerts/:id/resolve', async (req, res, next) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { resolved: true, resolvedAt: new Date(), resolvedBy: req.body.resolvedBy ?? 'system' },
      { new: true }
    )
    if (!alert) return res.status(404).json({ error: 'Alert not found' })
    res.json({ success: true, data: alert })
  } catch (err) {
    next(err)
  }
})

module.exports = router
