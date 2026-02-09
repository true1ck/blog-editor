import { S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'
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

// Get AWS region (default to us-east-1 if not specified)
export const AWS_REGION = process.env.AWS_REGION || 'us-east-1'

// Only create S3 client if credentials are available
export const s3Client = isS3Configured()
  ? new S3Client({
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  : null

// Export ListObjectsV2Command for health checks (only requires s3:ListBucket permission)
export { ListObjectsV2Command }

/**
 * @param {string} filename
 * @param {string} contentType
 * @param {string} [postId] - Blog post ID for per-blog folder structure
 * @param {string} [sessionId] - Session ID for draft posts (no postId yet)
 */
export async function getPresignedUploadUrl(filename, contentType, postId, sessionId) {
  logger.s3('PRESIGNED_URL_REQUEST', { filename, contentType, postId, sessionId })

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
  // Per-blog folder: blogs/{postId}/images/ or blogs/draft/{sessionId}/images/ for new posts
  const folderPrefix = postId
    ? `blogs/${postId}/images`
    : `blogs/draft/${sessionId || 'temp'}/images`
  const key = `${folderPrefix}/${uuid()}.${ext}`

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
  // Generate S3 public URL (works for all standard AWS regions)
  const imageUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`

  logger.s3('PRESIGNED_URL_CREATED', { 
    key, 
    bucket: BUCKET_NAME,
    duration: `${duration}ms`,
    expiresIn: '3600s'
  })

  return { uploadUrl, imageUrl, key }
}

/**
 * List images in a blog's folder for Media Library
 * @param {string} postId - Blog post ID
 * @param {string} [sessionId] - Session ID for draft posts (no postId)
 * @returns {Promise<Array<{key: string, url: string, filename: string}>>}
 */
export async function listBlogImages(postId, sessionId) {
  if (!isS3Configured() || !s3Client || !BUCKET_NAME) {
    throw new Error('S3 is not configured')
  }

  const prefix = postId
    ? `blogs/${postId}/images/`
    : sessionId
      ? `blogs/draft/${sessionId}/images/`
      : null

  if (!prefix) {
    return []
  }

  const result = await s3Client.send(new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
    MaxKeys: 100,
  }))

  const baseUrl = `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`
  const items = (result.Contents || [])
    .filter((obj) => obj.Key && !obj.Key.endsWith('/'))
    .map((obj) => ({
      key: obj.Key,
      url: `${baseUrl}/${obj.Key}`,
      filename: obj.Key.split('/').pop() || obj.Key,
    }))
    .sort((a, b) => (b.key.localeCompare(a.key))) // newest first

  return items
}

/**
 * Delete a single image from S3 (Media Library "delete from storage")
 * @param {string} key - S3 object key (e.g. blogs/123/images/uuid.jpg)
 * @throws {Error} if key is not under blogs/ prefix or S3 not configured
 */
export async function deleteBlogImage(key) {
  if (!isS3Configured() || !s3Client || !BUCKET_NAME) {
    throw new Error('S3 is not configured')
  }
  if (!key || typeof key !== 'string' || !key.startsWith('blogs/')) {
    throw new Error('Invalid key: must be an S3 object key under blogs/')
  }
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  }))
  logger.s3('OBJECT_DELETED', { key, bucket: BUCKET_NAME })
}
