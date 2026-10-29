const router        = require('express').Router()
const EnergyReading = require('../models/EnergyReading')
const { generateMockReadings, generateMockSummary } = require('../utils/aiSimulator')

// GET /api/energy/summary — campus-wide summary
router.get('/summary', async (req, res, next) => {
  try {
    const summary = generateMockSummary()
    res.json({ success: true, data: summary })
  } catch (err) {
    next(err)
  }
})

// GET /api/energy/readings/:buildingId — time-series readings
router.get('/readings/:buildingId', async (req, res, next) => {
  try {
    const { buildingId } = req.params
    const { hours = 24, limit = 288 } = req.query

    const since = new Date(Date.now() - Number(hours) * 3600 * 1000)
    let readings = await EnergyReading.find({ buildingId, timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .limit(Number(limit))
      .lean()

    if (!readings.length) readings = generateMockReadings(buildingId, Number(hours))

    res.json({ success: true, count: readings.length, data: readings })
  } catch (err) {
    // Fallback to mock on DB error
    const { buildingId } = req.params
    res.json({ success: true, data: generateMockReadings(buildingId, 24), source: 'mock' })
  }
})

// POST /api/energy/readings — ingest new reading
router.post('/readings', async (req, res, next) => {
  try {
    const reading = await EnergyReading.create(req.body)
    res.status(201).json({ success: true, data: reading })
  } catch (err) {
    next(err)
  }
})

// GET /api/energy/aggregate — daily/weekly/monthly aggregates
router.get('/aggregate', async (req, res, next) => {
  try {
    const { period = 'day', buildingId } = req.query
    const periodMs = { day: 86400000, week: 604800000, month: 2592000000 }
    const since = new Date(Date.now() - (periodMs[period] || periodMs.day))

    const match = { timestamp: { $gte: since } }
    if (buildingId) match.buildingId = buildingId

    const agg = await EnergyReading.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$buildingId',
          totalKwh:    { $sum: '$consumption' },
          avgLoad:     { $avg: '$consumption' },
          maxLoad:     { $max: '$consumption' },
          totalSolar:  { $sum: '$solar' },
          readingCount:{ $sum: 1 },
        },
      },
      { $sort: { totalKwh: -1 } },
    ])

    res.json({ success: true, period, data: agg })
  } catch (err) {
    next(err)
  }
})

module.exports = router
