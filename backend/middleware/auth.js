import axios from 'axios'
import logger from '../utils/logger.js'

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3000'

/**
 * Auth middleware that validates JWT tokens using the existing auth service
 * Calls /auth/validate-token endpoint to verify tokens
 */
export const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : null

    if (!token) {
      logger.auth('TOKEN_MISSING', { path: req.path, method: req.method })
      return res.status(401).json({ message: 'Access token required' })
    }

    logger.auth('TOKEN_VALIDATION_START', { 
      path: req.path, 
      method: req.method,
      tokenPrefix: token.substring(0, 10) + '...'
    })

    // Validate token with auth service
    try {
      const startTime = Date.now()
      const response = await axios.post(
        `${AUTH_SERVICE_URL}/auth/validate-token`,
        { token },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 5000, // 5 second timeout
        }
      )
      const duration = Date.now() - startTime

      if (!response.data.valid) {
        logger.auth('TOKEN_INVALID', { 
          path: req.path,
          error: response.data.error,
          duration: `${duration}ms`
        })
        return res.status(401).json({ 
          message: response.data.error || 'Invalid token' 
        })
      }

      // Extract user info from validated token payload
      // The auth service returns payload with user info
      const payload = response.data.payload || {}
      
      req.user = {
        id: payload.sub, // sub is the user ID in JWT
        phone_number: payload.phone_number,
        role: payload.role || 'user',
        user_type: payload.user_type,
        is_guest: payload.is_guest || false,
      }

      logger.auth('TOKEN_VALIDATED', { 
        userId: req.user.id,
        phone: req.user.phone_number,
        role: req.user.role,
        duration: `${duration}ms`
      })

      next()
    } catch (error) {
      // If auth service is unavailable, return error
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logger.error('AUTH', 'Auth service unavailable', error)
        return res.status(503).json({ 
          message: 'Authentication service unavailable' 
        })
      }

      // If auth service returns error, forward it
      if (error.response) {
        logger.auth('TOKEN_VALIDATION_FAILED', {
          status: error.response.status,
          error: error.response.data?.error
        })
        return res.status(error.response.status).json({
          message: error.response.data?.error || 'Token validation failed'
        })
      }

      throw error
    }
  } catch (error) {
    logger.error('AUTH', 'Auth middleware error', error)
    return res.status(500).json({ message: 'Authentication error' })
  }
}
