/**
 * Simple logging utility for the blog editor backend
 * Provides consistent log formatting with timestamps
 */

const getTimestamp = () => {
  return new Date().toISOString()
}

const formatLog = (level, category, message, data = null) => {
  const timestamp = getTimestamp()
  const logEntry = {
    timestamp,
    level,
    category,
    message,
    ...(data && { data })
  }
  return JSON.stringify(logEntry)
}

export const logger = {
  info: (category, message, data = null) => {
    console.log(`[INFO] ${formatLog('INFO', category, message, data)}`)
  },

  error: (category, message, error = null) => {
    const errorData = error ? {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...(error.response && { response: { status: error.response.status, data: error.response.data } })
    } : null
    console.error(`[ERROR] ${formatLog('ERROR', category, message, errorData)}`)
  },

  warn: (category, message, data = null) => {
    console.warn(`[WARN] ${formatLog('WARN', category, message, data)}`)
  },

  debug: (category, message, data = null) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${formatLog('DEBUG', category, message, data)}`)
    }
  },

  // Transaction-specific logging
  transaction: (operation, details) => {
    logger.info('TRANSACTION', `${operation}`, details)
  },

  // Database-specific logging
  db: (operation, query, params = null) => {
    logger.debug('DATABASE', `${operation}`, {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      params: params ? (Array.isArray(params) ? `[${params.length} params]` : params) : null
    })
  },

  // API request/response logging
  api: (method, path, statusCode, duration = null, userId = null) => {
    logger.info('API', `${method} ${path}`, {
      statusCode,
      ...(duration && { duration: `${duration}ms` }),
      ...(userId && { userId })
    })
  },

  // S3 operation logging
  s3: (operation, details) => {
    logger.info('S3', `${operation}`, details)
  },

  // Auth operation logging
  auth: (operation, details) => {
    logger.info('AUTH', `${operation}`, details)
  }
}

export default logger
