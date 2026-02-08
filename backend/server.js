import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import axios from 'axios'
import { pool, testConnection, resetPool } from './config/database.js'
import { authenticateToken } from './middleware/auth.js'
import { s3Client, BUCKET_NAME, ListObjectsV2Command, isS3Configured } from './config/s3.js'
import postRoutes from './routes/posts.js'
import uploadRoutes from './routes/upload.js'
import logger from './utils/logger.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5001

// Startup logging
console.log('\n🚀 Starting Blog Editor Backend...\n')
console.log('📋 Configuration:')
console.log(`   Port: ${PORT}`)
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
console.log(`   CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:4000'}`)

// Middleware - CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true)
    }

    const allowedOrigins = [
      'http://localhost:4000',
      'http://localhost:3000',
      'http://localhost:5173',
      process.env.CORS_ORIGIN
    ].filter(Boolean) // Remove undefined values

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      console.warn(`⚠️  CORS: Blocked origin: ${origin}`)
      console.warn(`   Allowed origins: ${allowedOrigins.join(', ')}`)
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}

app.use(cors(corsOptions))

// Handle CORS errors
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      error: 'Origin not allowed by CORS',
      message: `Origin ${req.headers.origin} is not allowed. Allowed origins: http://localhost:4000, http://localhost:3000, http://localhost:5173`
    })
  }
  next(err)
})
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now()
  const originalSend = res.send

  res.send = function (body) {
    const duration = Date.now() - startTime
    const userId = req.user?.id || 'anonymous'
    logger.api(req.method, req.path, res.statusCode, duration, userId)
    return originalSend.call(this, body)
  }

  logger.debug('REQUEST', `${req.method} ${req.path}`, {
    query: req.query,
    body: req.method === 'POST' || req.method === 'PUT' ? '***' : undefined,
    ip: req.ip,
    userAgent: req.get('user-agent')
  })

  next()
})

// Routes - Auth is handled by existing auth service
// Blog editor backend validates tokens via auth service
app.use('/api/posts', authenticateToken, postRoutes)
app.use('/api/upload', authenticateToken, uploadRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    logger.db('SELECT', 'SELECT NOW()', [])
    const result = await pool.query('SELECT NOW()')
    logger.info('DATABASE', 'Test query successful', { time: result.rows[0].now })
    res.json({ message: 'Database connected', time: result.rows[0].now })
  } catch (error) {
    logger.error('DATABASE', 'Test query failed', error)
    res.status(500).json({ error: 'Database connection failed', message: error.message })
  }
})

// General error handling middleware (after CORS error handler)
app.use((err, req, res, next) => {
  // Skip if already handled by CORS error handler
  if (err && err.message === 'Not allowed by CORS') {
    return next(err) // This should have been handled above, but just in case
  }
  logger.error('SERVER', 'Unhandled error', err)
  console.error(err.stack)
  res.status(500).json({ message: 'Something went wrong!', error: err.message })
})

// Startup health checks
async function performStartupChecks() {
  console.log('\n🔍 Performing startup health checks...\n')

  // 1. Check Database Connection
  console.log('📊 Checking Database Connection...')
  try {
    // Use improved connection test with better error messages
    const connectionTest = await testConnection()
    logger.db('SELECT', 'SELECT NOW(), version()', [])
    const dbResult = await pool.query('SELECT NOW(), version()')
    const dbTime = dbResult.rows[0].now
    const dbVersion = dbResult.rows[0].version.split(' ')[0] + ' ' + dbResult.rows[0].version.split(' ')[1]
    logger.info('DATABASE', 'Database connection successful', { time: dbTime, version: dbVersion })
    console.log(`   ✅ Database connected successfully`)
    console.log(`   📅 Database time: ${dbTime}`)
    console.log(`   🗄️  Database version: ${dbVersion}`)
    
    // Check if posts table exists
    logger.db('SELECT', 'Check posts table exists', [])
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'posts'
      )
    `)
    if (tableCheck.rows[0].exists) {
      logger.info('DATABASE', 'Posts table exists', null)
      console.log(`   ✅ Posts table exists`)
    } else {
      logger.warn('DATABASE', 'Posts table not found', null)
      console.log(`   ⚠️  Posts table not found - run 'npm run migrate'`)
    }
  } catch (error) {
    logger.error('DATABASE', 'Database connection failed', error)
    console.error(`   ❌ Database connection failed: ${error.message}`)
    
    // Provide specific guidance based on error code
    if (error.code === 'INVALID_PASSWORD' || error.message.includes('[YOUR-PASSWORD]')) {
      console.error(`   🔑 Placeholder password detected in DATABASE_URL`)
      console.error(`   💡 Replace [YOUR-PASSWORD] with your actual Supabase password`)
      console.error(`   💡 Format: postgresql://postgres.xxx:YOUR_ACTUAL_PASSWORD@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`)
    } else if (error.code === 'AUTH_FAILED' || error.message.includes('password authentication failed') || error.message.includes('password')) {
      console.error(`   🔑 Authentication failed - Check your password in DATABASE_URL`)
      console.error(`   💡 Format: postgresql://user:password@host:port/database`)
      console.error(`   💡 Verify your Supabase password is correct`)
    } else if (error.code === 'CIRCUIT_BREAKER' || error.message.includes('Circuit breaker') || error.message.includes('too many')) {
      console.error(`   🔄 Too many failed attempts detected`)
      console.error(`   💡 ${error.message}`)
      console.error(`   💡 The testConnection function will automatically retry after a delay`)
      console.error(`   💡 If this persists, wait 30-60 seconds and restart the server`)
      console.error(`   💡 Verify your DATABASE_URL password is correct in .env`)
    } else if (error.code === 'HOST_ERROR' || error.message.includes('host') || error.message.includes('ENOTFOUND')) {
      console.error(`   🌐 Cannot reach database host - Check your DATABASE_URL hostname`)
      console.error(`   💡 Verify the hostname in your connection string is correct`)
    } else if (error.code === 'TIMEOUT' || error.message.includes('timeout')) {
      console.error(`   ⏱️  Database connection timeout`)
      console.error(`   💡 Check your network connection and database accessibility`)
    } else if (error.code === 'INVALID_FORMAT') {
      console.error(`   📝 Invalid DATABASE_URL format`)
      console.error(`   💡 Expected: postgresql://user:password@host:port/database`)
    } else {
      console.error(`   💡 Check your DATABASE_URL in .env file`)
      console.error(`   💡 Format: postgresql://postgres.xxx:[PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`)
    }
    return false
  }

  // 2. Check AWS S3 Configuration
  console.log('\n☁️  Checking AWS S3 Configuration...')
  try {
    if (!isS3Configured()) {
      console.log(`   ⚠️  AWS S3 not configured`)
      console.log(`   💡 Image uploads will not work without AWS S3`)
      console.log(`   💡 To enable: Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME in .env`)
    } else {
      console.log(`   ✅ AWS credentials configured`)
      console.log(`   🪣 S3 Bucket: ${BUCKET_NAME}`)
      console.log(`   🌍 AWS Region: ${process.env.AWS_REGION || 'us-east-1'}`)
      console.log(`   💡 Using bucket: ${BUCKET_NAME} in region: ${process.env.AWS_REGION || 'us-east-1'}`)
      
      // Try to check bucket access using ListObjectsV2 (only requires s3:ListBucket permission)
      // This is more compatible with minimal IAM policies
      if (s3Client) {
        try {
          // Use ListObjectsV2 with MaxKeys=0 to just check access without listing objects
          // This only requires s3:ListBucket permission (which matches your IAM policy)
          await s3Client.send(new ListObjectsV2Command({ 
            Bucket: BUCKET_NAME,
            MaxKeys: 0  // Don't actually list objects, just check access
          }))
          console.log(`   ✅ S3 bucket is accessible`)
        } catch (s3Error) {
          if (s3Error.name === 'NotFound' || s3Error.$metadata?.httpStatusCode === 404) {
            console.log(`   ⚠️  S3 bucket '${BUCKET_NAME}' not found`)
            console.log(`   💡 Create the bucket in AWS S3 or check the bucket name`)
          } else if (s3Error.name === 'Forbidden' || s3Error.$metadata?.httpStatusCode === 403) {
            console.log(`   ⚠️  S3 bucket access denied`)
            console.log(`   💡 Check IAM permissions for bucket: ${BUCKET_NAME}`)
            console.log(`   💡 Required permissions: s3:ListBucket, s3:PutObject, s3:GetObject`)
            console.log(`   💡 Common issues:`)
            console.log(`      - Credentials in .env don't match IAM user with policy`)
            console.log(`      - Policy not propagated yet (wait 2-3 minutes)`)
            console.log(`      - Wrong region in AWS_REGION`)
            console.log(`   💡 See TROUBLESHOOT_S3_ACCESS.md for detailed troubleshooting`)
          } else {
            console.log(`   ⚠️  S3 bucket check failed: ${s3Error.message}`)
          }
        }
      }
    }
  } catch (error) {
    console.error(`   ❌ AWS S3 check failed: ${error.message}`)
  }

  // 3. Check Auth Service Connection
  console.log('\n🔐 Checking Auth Service Connection...')
  const authServiceUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:3000'
  try {
    logger.auth('HEALTH_CHECK', { url: authServiceUrl })
    const startTime = Date.now()
    const healthResponse = await axios.get(`${authServiceUrl}/health`, {
      timeout: 5000,
    })
    const duration = Date.now() - startTime
    if (healthResponse.data?.ok || healthResponse.status === 200) {
      logger.auth('HEALTH_CHECK_SUCCESS', { url: authServiceUrl, duration: `${duration}ms` })
      console.log(`   ✅ Auth service is reachable`)
      console.log(`   🔗 Auth service URL: ${authServiceUrl}`)
    } else {
      console.log(`   ⚠️  Auth service responded but status unclear`)
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error(`   ❌ Auth service connection refused`)
      console.error(`   💡 Make sure auth service is running on ${authServiceUrl}`)
      console.error(`   💡 Start it with: cd ../auth && npm start`)
    } else if (error.code === 'ETIMEDOUT') {
      console.error(`   ❌ Auth service connection timeout`)
      console.error(`   💡 Check if auth service is running and accessible`)
    } else {
      console.error(`   ⚠️  Auth service check failed: ${error.message}`)
      console.error(`   💡 Auth service might not be running or URL is incorrect`)
    }
  }

  // 4. Environment Variables Check
  console.log('\n📝 Checking Environment Variables...')
  const requiredVars = ['DATABASE_URL']
  const optionalVars = ['AUTH_SERVICE_URL', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME']
  
  let missingRequired = []
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingRequired.push(varName)
    }
  })
  
  if (missingRequired.length > 0) {
    console.error(`   ❌ Missing required variables: ${missingRequired.join(', ')}`)
    console.error(`   💡 Check your .env file`)
    return false
  } else {
    console.log(`   ✅ All required environment variables are set`)
  }
  
  const missingOptional = optionalVars.filter(varName => !process.env[varName])
  if (missingOptional.length > 0) {
    console.log(`   ⚠️  Optional variables not set: ${missingOptional.join(', ')}`)
    console.log(`   💡 Some features may not work without these`)
  }

  console.log('\n✅ Startup checks completed!\n')
  return true
}

// Start server with health checks
async function startServer() {
  const checksPassed = await performStartupChecks()
  
  if (!checksPassed) {
    console.error('\n❌ Startup checks failed. Please fix the issues above.\n')
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`✅ Blog Editor Backend is running!`)
    console.log(`   🌐 Server: http://localhost:${PORT}`)
    console.log(`   💚 Health: http://localhost:${PORT}/api/health`)
    console.log(`   🗄️  DB Test: http://localhost:${PORT}/api/test-db`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  })
}

startServer().catch((error) => {
  console.error('❌ Failed to start server:', error)
  process.exit(1)
})

// Graceful shutdown - important for hot reload to prevent connection pool exhaustion
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server and database connections')
  try {
    await pool.end()
    console.log('✅ Database connections closed')
  } catch (error) {
    console.error('❌ Error closing database connections:', error.message)
  }
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server and database connections')
  try {
    await pool.end()
    console.log('✅ Database connections closed')
  } catch (error) {
    console.error('❌ Error closing database connections:', error.message)
  }
  process.exit(0)
})

// Warning about running multiple apps with hot reload
if (process.env.NODE_ENV !== 'production') {
  console.log('\n⚠️  Running in development mode with hot reload')
  console.log('   💡 If running both blog-editor and api-v1, connection pools are reduced to prevent Supabase limits')
  console.log('   💡 Consider running only one in hot reload mode if you hit connection limits\n')
}
