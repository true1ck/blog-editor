import express from 'express'
import { getPresignedUploadUrl, listBlogImages, deleteBlogImage } from '../config/s3.js'
import logger from '../utils/logger.js'

const router = express.Router()

// List media for a blog (Media Library)
// GET /upload/media?postId=xxx or ?sessionId=xxx
router.get('/media', async (req, res) => {
  try {
    const { postId, sessionId } = req.query
    if (!postId && !sessionId) {
      return res.status(400).json({ message: 'postId or sessionId is required' })
    }
    const items = await listBlogImages(postId || null, sessionId || null)
    res.json({ items })
  } catch (error) {
    logger.error('UPLOAD', 'Error listing media', error)
    res.status(500).json({ message: error.message || 'Failed to list media' })
  }
})

// Get presigned URL for image upload
// Note: authenticateToken middleware is applied at server level
router.post('/presigned-url', async (req, res) => {
  try {
    const { filename, contentType, postId, sessionId } = req.body

    logger.transaction('GENERATE_PRESIGNED_URL', { 
      userId: req.user.id,
      filename,
      contentType,
      postId,
      sessionId
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
    const { uploadUrl, imageUrl, key } = await getPresignedUploadUrl(filename, contentType, postId, sessionId)
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

// Delete image from S3 (Media Library)
// DELETE /upload/media with body { key: "blogs/123/images/uuid.jpg" }
router.delete('/media', async (req, res) => {
  try {
    const { key } = req.body
    if (!key) {
      return res.status(400).json({ message: 'key is required' })
    }
    await deleteBlogImage(key)
    res.status(204).end()
  } catch (error) {
    logger.error('UPLOAD', 'Error deleting media', error)
    res.status(500).json({ message: error.message || 'Failed to delete from storage' })
  }
})

export default router
