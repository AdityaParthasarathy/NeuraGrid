const router   = require('express').Router()
const Building = require('../models/Building')
const { getMockBuildings, getMockBuilding } = require('../utils/aiSimulator')

// GET /api/buildings — list all buildings
router.get('/', async (req, res, next) => {
  try {
    let buildings = await Building.find({ isActive: true }).lean()
    // Fall back to mock if DB empty
    if (!buildings.length) buildings = getMockBuildings()
    res.json({ success: true, count: buildings.length, data: buildings })
  } catch (err) {
    // DB unavailable — serve mock data
    res.json({ success: true, count: 8, data: getMockBuildings(), source: 'mock' })
  }
})

// GET /api/buildings/:id
router.get('/:id', async (req, res, next) => {
  try {
    let building = await Building.findOne({ buildingId: req.params.id }).lean()
    if (!building) building = getMockBuilding(req.params.id)
    if (!building) return res.status(404).json({ error: 'Building not found' })
    res.json({ success: true, data: building })
  } catch (err) {
    const mock = getMockBuilding(req.params.id)
    if (mock) return res.json({ success: true, data: mock, source: 'mock' })
    next(err)
  }
})

// POST /api/buildings — create
router.post('/', async (req, res, next) => {
  try {
    const building = await Building.create(req.body)
    res.status(201).json({ success: true, data: building })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/buildings/:id/telemetry — update live telemetry
router.patch('/:id/telemetry', async (req, res, next) => {
  try {
    const building = await Building.findOneAndUpdate(
      { buildingId: req.params.id },
      { $set: { 'telemetry': { ...req.body, updatedAt: new Date() } } },
      { new: true, runValidators: true }
    )
    if (!building) return res.status(404).json({ error: 'Building not found' })
    res.json({ success: true, data: building.telemetry })
  } catch (err) {
    next(err)
  }
})

module.exports = router
