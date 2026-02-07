import express from 'express'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { getPresignedUploadUrl } from '../config/s3.js'
import logger from '../utils/logger.js'
import { v4 as uuid } from 'uuid'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Configure multer for local file storage (TEMPORARY - FOR TESTING ONLY)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'images')
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname)
    const filename = `${uuid()}${ext}`
    cb(null, filename)
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'), false)
    }
  }
})

// Get presigned URL for image upload
// Note: authenticateToken middleware is applied at server level
router.post('/presigned-url', async (req, res) => {
  try {
    const { filename, contentType } = req.body

    logger.transaction('GENERATE_PRESIGNED_URL', { 
      userId: req.user.id,
      filename,
      contentType
    })

    if (!filename || !contentType) {
      logger.warn('UPLOAD', 'Missing required fields', { 
        hasFilename: !!filename, 
        hasContentType: !!contentType 
      })
      return res.status(400).json({ message: 'Filename and content type are required' })
    }

    // Validate content type
    if (!contentType.startsWith('image/')) {
      logger.warn('UPLOAD', 'Invalid content type', { contentType })
      return res.status(400).json({ message: 'File must be an image' })
    }

    // Check if AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      logger.error('UPLOAD', 'AWS credentials not configured', null)
      return res.status(500).json({ 
        message: 'AWS S3 is not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in backend .env file.' 
      })
    }

    // Support both S3_BUCKET_NAME and AWS_BUCKET_NAME (for compatibility with api-v1)
    const bucketName = process.env.S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME
    if (!bucketName) {
      logger.error('UPLOAD', 'S3 bucket name not configured', null)
      return res.status(500).json({ 
        message: 'S3 bucket name is not configured. Please set S3_BUCKET_NAME or AWS_BUCKET_NAME in backend .env file.' 
      })
    }

    const startTime = Date.now()
    const { uploadUrl, imageUrl, key } = await getPresignedUploadUrl(filename, contentType)
    const duration = Date.now() - startTime

    logger.s3('PRESIGNED_URL_GENERATED', {
      userId: req.user.id,
      filename,
      key,
      duration: `${duration}ms`
    })

    logger.transaction('GENERATE_PRESIGNED_URL_SUCCESS', { 
      userId: req.user.id,
      key,
      duration: `${duration}ms`
    })

    res.json({
      uploadUrl,
      imageUrl,
    })
  } catch (error) {
    logger.error('UPLOAD', 'Error generating presigned URL', error)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to generate upload URL'
    if (error.name === 'InvalidAccessKeyId' || error.name === 'SignatureDoesNotMatch') {
      errorMessage = 'Invalid AWS credentials. Please check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.'
    } else if (error.name === 'NoSuchBucket') {
      const bucketName = process.env.S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME
      errorMessage = `S3 bucket '${bucketName}' does not exist. Please create it or update S3_BUCKET_NAME/AWS_BUCKET_NAME.`
    } else if (error.message) {
      errorMessage = error.message
    }
    
    res.status(500).json({ 
      message: errorMessage,
      error: error.name || 'Unknown error'
    })
  }
})

// TEMPORARY: Local file upload endpoint (FOR TESTING ONLY - REMOVE IN PRODUCTION)
router.post('/local', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      logger.warn('UPLOAD', 'No file uploaded', null)
      return res.status(400).json({ message: 'No image file provided' })
    }

    logger.transaction('LOCAL_IMAGE_UPLOAD', {
      userId: req.user.id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    })

    // Return the image URL (served statically)
    const imageUrl = `/api/images/${req.file.filename}`
    
    logger.transaction('LOCAL_IMAGE_UPLOAD_SUCCESS', {
      userId: req.user.id,
      filename: req.file.filename,
      imageUrl
    })

    res.json({
      imageUrl,
      filename: req.file.filename,
      size: req.file.size
    })
  } catch (error) {
    logger.error('UPLOAD', 'Error uploading local image', error)
    res.status(500).json({ 
      message: 'Failed to upload image', 
      error: error.message 
    })
  }
})

export default router
