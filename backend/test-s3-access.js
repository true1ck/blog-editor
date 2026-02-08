import { S3Client, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import dotenv from 'dotenv'

dotenv.config()

const bucketName = process.env.S3_BUCKET_NAME || process.env.AWS_BUCKET_NAME
const region = process.env.AWS_REGION || 'ap-south-1'
const accessKeyId = process.env.AWS_ACCESS_KEY_ID
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

console.log('\n🔍 S3 Access Diagnostic Test\n')
console.log('Configuration:')
console.log(`  Bucket: ${bucketName || 'NOT SET'}`)
console.log(`  Region: ${region}`)
console.log(`  Access Key ID: ${accessKeyId ? accessKeyId.substring(0, 8) + '...' : 'NOT SET'}`)
console.log(`  Secret Key: ${secretAccessKey ? '***SET***' : 'NOT SET'}\n`)

if (!bucketName) {
  console.error('❌ Bucket name not configured!')
  console.error('   Set S3_BUCKET_NAME or AWS_BUCKET_NAME in .env')
  process.exit(1)
}

if (!accessKeyId || !secretAccessKey) {
  console.error('❌ AWS credentials not configured!')
  console.error('   Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env')
  process.exit(1)
}

const client = new S3Client({
  region: region,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
})

console.log('Testing S3 access...\n')

// Test 1: ListBucket (s3:ListBucket permission)
console.log('1️⃣  Testing ListBucket (s3:ListBucket permission)...')
try {
  const listCommand = new ListObjectsV2Command({ 
    Bucket: bucketName,
    MaxKeys: 0  // Just check access, don't list objects
  })
  await client.send(listCommand)
  console.log('   ✅ SUCCESS - ListBucket works!')
} catch (error) {
  console.error(`   ❌ FAILED - ${error.name}`)
  console.error(`   Message: ${error.message}`)
  if (error.name === 'Forbidden' || error.$metadata?.httpStatusCode === 403) {
    console.error('\n   💡 This means:')
    console.error('      - Your IAM user does NOT have s3:ListBucket permission')
    console.error('      - OR credentials don\'t match the IAM user with the policy')
    console.error('      - OR policy is not attached to the IAM user')
  } else if (error.name === 'NotFound') {
    console.error('\n   💡 Bucket not found - check bucket name and region')
  }
  process.exit(1)
}

// Test 2: Generate Presigned URL (s3:PutObject permission)
console.log('\n2️⃣  Testing Presigned URL generation (s3:PutObject permission)...')
try {
  const putCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: 'test/test-file.txt',
    ContentType: 'text/plain'
  })
  const presignedUrl = await getSignedUrl(client, putCommand, { expiresIn: 60 })
  console.log('   ✅ SUCCESS - Presigned URL generated!')
  console.log(`   URL: ${presignedUrl.substring(0, 80)}...`)
} catch (error) {
  console.error(`   ❌ FAILED - ${error.name}`)
  console.error(`   Message: ${error.message}`)
  if (error.name === 'Forbidden' || error.$metadata?.httpStatusCode === 403) {
    console.error('\n   💡 This means:')
    console.error('      - Your IAM user does NOT have s3:PutObject permission')
    console.error('      - OR credentials don\'t match the IAM user with the policy')
  }
  process.exit(1)
}

console.log('\n✅ All tests passed! Your S3 configuration is working correctly.')
console.log('\n💡 If the backend still shows "access denied", try:')
console.log('   1. Restart the backend server')
console.log('   2. Wait 1-2 minutes for IAM changes to propagate')
console.log('   3. Verify credentials in .env match the IAM user with your policy\n')
