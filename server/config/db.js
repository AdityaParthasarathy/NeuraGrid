const mongoose = require('mongoose')

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/neuragrid'
  try {
    await mongoose.connect(uri)
    console.log(`[DB] Connected to MongoDB: ${uri}`)
  } catch (err) {
    console.warn(`[DB] MongoDB connection failed — running without persistence: ${err.message}`)
    // Non-fatal: the app works with mock data even without Mongo
  }
}

module.exports = connectDB
