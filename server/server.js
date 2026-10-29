require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const connectDB  = require('./config/db')
const errorHandler = require('./middleware/errorHandler')

const buildingsRouter = require('./routes/buildings')
const energyRouter    = require('./routes/energy')
const aiRouter        = require('./routes/ai')

const app  = express()
const PORT = process.env.PORT || 5000

// Connect to MongoDB (non-blocking — server starts regardless)
connectDB()

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Request logger (dev)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    next()
  })
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/buildings', buildingsRouter)
app.use('/api/energy',    energyRouter)
app.use('/api/ai',        aiRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'NeuraGrid API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
  })
})

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Error handler
app.use(errorHandler)

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   NeuraGrid API Server                ║
║   http://localhost:${PORT}              ║
║   Environment: ${process.env.NODE_ENV || 'development'}          ║
╚═══════════════════════════════════════╝
  `)
})

module.exports = app
