import pkg from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pkg

// Support both connection string (Supabase) and individual parameters
let poolConfig
let pool = null

// Validate and prepare pool configuration
function createPoolConfig() {
  if (process.env.DATABASE_URL) {
    // Use connection string (Supabase format)
    // Validate connection string format
    try {
      const url = new URL(process.env.DATABASE_URL)
      
      // Check for placeholder passwords
      if (!url.password || url.password === '[YOUR-PASSWORD]' || url.password.includes('YOUR-PASSWORD')) {
        const error = new Error('DATABASE_URL contains placeholder password. Please replace [YOUR-PASSWORD] with your actual Supabase password.')
        error.code = 'INVALID_PASSWORD'
        throw error
      }
      
      if (url.password.length < 1) {
        console.warn('⚠️  DATABASE_URL appears to be missing password. Check your .env file.')
      }
    } catch (e) {
      if (e.code === 'INVALID_PASSWORD') {
        throw e
      }
      console.error('❌ Invalid DATABASE_URL format. Expected: postgresql://user:password@host:port/database')
      throw new Error('Invalid DATABASE_URL format')
    }
    
    poolConfig = {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Supabase requires SSL
      },
      // Connection pool settings for Supabase
      // Reduced max connections to prevent pool limit issues when running multiple apps
      max: 5, // Maximum number of clients in the pool (reduced for hot reload compatibility)
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased timeout for Supabase
      allowExitOnIdle: false,
    }
  } else {
    // Use individual parameters (local development)
    poolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'blog_editor',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 10000,
    }
  }
  
  return poolConfig
}

// Initialize pool
try {
  poolConfig = createPoolConfig()
  pool = new Pool(poolConfig)
} catch (error) {
  if (error.code === 'INVALID_PASSWORD') {
    console.error('\n❌ ' + error.message)
    console.error('💡 Please update your .env file with the correct DATABASE_URL')
    console.error('💡 Format: postgresql://postgres.xxx:YOUR_ACTUAL_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres\n')
  }
  // Create a dummy pool to prevent crashes, but it won't work
  pool = new Pool({ connectionString: 'postgresql://invalid' })
}

// Reset pool function for recovery from authentication errors
export async function resetPool() {
  if (pool) {
    try {
      await pool.end() // Wait for pool to fully close
    } catch (err) {
      // Ignore errors during pool closure
    }
    pool = null
  }
  
  // Wait a moment for Supabase circuit breaker to potentially reset
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  try {
    poolConfig = createPoolConfig()
    pool = new Pool(poolConfig)
    setupPoolHandlers()
    return true
  } catch (error) {
    console.error('❌ Failed to reset connection pool:', error.message)
    return false
  }
}

// Setup pool error handlers
function setupPoolHandlers() {
  if (pool) {
    pool.on('error', (err) => {
      console.error('❌ Unexpected error on idle database client:', err.message)
      // Don't exit on error - let the application handle it
    })
  }
}

setupPoolHandlers()

export { pool }

// Helper function to test connection and provide better error messages
export async function testConnection(retryCount = 0) {
  try {
    // If pool is null or invalid, try to recreate it
    if (!pool || pool.ended) {
      console.log('   🔄 Recreating connection pool...')
      await resetPool()
    }
    
    const client = await pool.connect()
    const result = await client.query('SELECT NOW()')
    client.release()
    return { success: true, time: result.rows[0].now }
  } catch (error) {
    // Handle authentication errors
    if (error.message.includes('password authentication failed') || 
        error.message.includes('password') && error.message.includes('failed')) {
      const err = new Error('Database authentication failed. Check your password in DATABASE_URL')
      err.code = 'AUTH_FAILED'
      throw err
    } 
    // Handle circuit breaker / too many attempts
    else if (error.message.includes('Circuit breaker') || 
             error.message.includes('too many') ||
             error.message.includes('connection attempts') ||
             error.message.includes('rate limit') ||
             error.code === '53300') { // PostgreSQL error code for too many connections
      // If this is the first retry, try resetting the pool and waiting
      if (retryCount === 0) {
        console.log('   ⏳ Circuit breaker detected. Waiting and retrying...')
        await new Promise(resolve => setTimeout(resolve, 3000)) // Wait 3 seconds
        await resetPool()
        // Retry once
        return testConnection(1)
      }
      const err = new Error('Too many failed connection attempts. Supabase connection pooler has temporarily blocked connections. Please wait 30-60 seconds and restart the server, or verify your DATABASE_URL password is correct.')
      err.code = 'CIRCUIT_BREAKER'
      throw err
    } 
    // Handle host resolution errors
    else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      const err = new Error('Cannot resolve database host. Check your DATABASE_URL hostname.')
      err.code = 'HOST_ERROR'
      throw err
    } 
    // Handle timeout errors
    else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      const err = new Error('Database connection timeout. Check if the database is accessible and your network connection.')
      err.code = 'TIMEOUT'
      throw err
    }
    // Handle invalid connection string
    else if (error.message.includes('invalid connection') || error.message.includes('connection string')) {
      const err = new Error('Invalid DATABASE_URL format. Expected: postgresql://user:password@host:port/database')
      err.code = 'INVALID_FORMAT'
      throw err
    }
    throw error
  }
}
