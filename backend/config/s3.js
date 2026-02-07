import { S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { v4 as uuid } from 'uuid'
import dotenv from 'dotenv'
import logger from '../utils/logger.js'

dotenv.config()

// Check if S3 is configured (support both S3_BUCKET_NAME and AWS_BUCKET_NAME for compatibility)
export const isS3Configured = () => {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    (process.env.S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME)
  )
}

// Get bucket name (support both env var names)
export const BUCKET_NAME = process.env.S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME

// Only create S3 client if credentials are available
export const s3Client = isS3Configured()
  ? new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  : null

// Export HeadBucketCommand for health checks
export { HeadBucketCommand }

export async function getPresignedUploadUrl(filename, contentType) {
  logger.s3('PRESIGNED_URL_REQUEST', { filename, contentType })

  if (!isS3Configured()) {
    logger.error('S3', 'S3 not configured', null)
    throw new Error('AWS S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME (or AWS_BUCKET_NAME) in .env file.')
  }

  if (!s3Client) {
    logger.error('S3', 'S3 client not initialized', null)
    throw new Error('S3 client is not initialized. Check your AWS credentials.')
  }

  if (!BUCKET_NAME) {
    logger.error('S3', 'Bucket name not configured', null)
    throw new Error('S3 bucket name is not configured. Please set S3_BUCKET_NAME or AWS_BUCKET_NAME in .env file.')
  }

  // Extract file extension from filename or content type
  const ext = filename.split('.').pop() || contentType.split('/')[1] || 'jpg'
  // Use UUID for unique file names (matching api-v1 pattern)
  const key = `images/${uuid()}.${ext}`

  logger.s3('GENERATING_PRESIGNED_URL', { 
    bucket: BUCKET_NAME, 
    key, 
    contentType 
  })

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  })

  const startTime = Date.now()
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
  const duration = Date.now() - startTime
  const imageUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`

  logger.s3('PRESIGNED_URL_CREATED', { 
    key, 
    bucket: BUCKET_NAME,
    duration: `${duration}ms`,
    expiresIn: '3600s'
  })

  return { uploadUrl, imageUrl, key }
}
