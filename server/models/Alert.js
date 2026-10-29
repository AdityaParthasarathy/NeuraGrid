const mongoose = require('mongoose')

const alertSchema = new mongoose.Schema(
  {
    buildingId:  { type: String, required: true, index: true },
    type:        { type: String, enum: ['anomaly', 'prediction', 'optimization', 'system'], required: true },
    severity:    { type: String, enum: ['critical', 'warning', 'info', 'success'], required: true },
    title:       { type: String, required: true },
    description: { type: String },
    confidence:  { type: Number, min: 0, max: 100 },
    impact:      { type: String },
    action:      { type: String },
    resolved:    { type: Boolean, default: false },
    resolvedAt:  { type: Date },
    resolvedBy:  { type: String },
    metadata:    { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
)

alertSchema.index({ buildingId: 1, resolved: 1, createdAt: -1 })
alertSchema.index({ severity: 1, resolved: 1 })

module.exports = mongoose.model('Alert', alertSchema)
