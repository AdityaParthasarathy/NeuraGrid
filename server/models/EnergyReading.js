const mongoose = require('mongoose')

const energyReadingSchema = new mongoose.Schema(
  {
    buildingId:  { type: String, required: true, index: true },
    timestamp:   { type: Date, default: Date.now, index: true },
    consumption: { type: Number, required: true },   // kW at this moment
    hvacLoad:    { type: Number, default: 0 },
    lightingLoad:{ type: Number, default: 0 },
    equipLoad:   { type: Number, default: 0 },
    solar:       { type: Number, default: 0 },       // kW solar generation
    gridDraw:    { type: Number, default: 0 },       // kW from grid
    temperature: { type: Number },
    humidity:    { type: Number },
    co2:         { type: Number },
    occupancy:   { type: Number },
    predicted:   { type: Number },                   // AI-predicted load
    anomaly:     { type: Boolean, default: false },
    anomalyScore:{ type: Number, default: 0 },
  },
  { timestamps: false }
)

energyReadingSchema.index({ buildingId: 1, timestamp: -1 })
// TTL: keep raw readings for 90 days
energyReadingSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 })

module.exports = mongoose.model('EnergyReading', energyReadingSchema)
