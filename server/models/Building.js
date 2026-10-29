const mongoose = require('mongoose')

const buildingSchema = new mongoose.Schema(
  {
    buildingId:   { type: String, required: true, unique: true },
    name:         { type: String, required: true },
    shortName:    { type: String, required: true },
    type:         { type: String, enum: ['academic', 'research', 'library', 'social', 'sports', 'admin', 'medical'], required: true },
    floors:       { type: Number, required: true },
    area:         { type: Number, required: true },         // sq ft
    capacity:     { type: Number, required: true },         // kW peak
    gridX:        { type: Number, default: 0 },
    gridY:        { type: Number, default: 0 },
    color:        { type: String, default: '#00f5ff' },
    isActive:     { type: Boolean, default: true },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    // Latest telemetry (denormalized for fast reads)
    telemetry: {
      currentLoad: { type: Number, default: 0 },
      occupancy:   { type: Number, default: 0 },
      status:      { type: String, enum: ['normal', 'warning', 'critical', 'idle'], default: 'normal' },
      temperature: { type: Number, default: 72 },
      humidity:    { type: Number, default: 45 },
      co2:         { type: Number, default: 400 },
      lighting:    { type: Number, default: 80 },
      updatedAt:   { type: Date, default: Date.now },
    },
  },
  { timestamps: true }
)

buildingSchema.index({ buildingId: 1 })
buildingSchema.index({ 'telemetry.status': 1 })

module.exports = mongoose.model('Building', buildingSchema)
