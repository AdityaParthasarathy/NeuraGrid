function errorHandler(err, req, res, next) {
  const status  = err.statusCode || err.status || 500
  const message = err.message || 'Internal Server Error'

  if (process.env.NODE_ENV !== 'production') {
    console.error(`[ERROR] ${status} ${req.method} ${req.path} — ${message}`)
    if (err.stack) console.error(err.stack)
  }

  res.status(status).json({
    error:   message,
    path:    req.path,
    method:  req.method,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  })
}

module.exports = errorHandler
