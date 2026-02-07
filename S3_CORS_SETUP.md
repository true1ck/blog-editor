# S3 CORS Configuration Guide

## Problem
If you're getting "Failed to fetch" error when uploading images, it's likely a CORS (Cross-Origin Resource Sharing) issue with your S3 bucket.

## Solution: Configure S3 Bucket CORS

### Step 1: Go to AWS S3 Console
1. Log in to AWS Console
2. Navigate to S3
3. Click on your bucket (e.g., `livingai-media-bucket`)

### Step 2: Configure CORS
1. Click on the **Permissions** tab
2. Scroll down to **Cross-origin resource sharing (CORS)**
3. Click **Edit**

### Step 3: Add CORS Configuration
Paste this CORS configuration:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:4000",
            "http://localhost:3000",
            "http://localhost:5173",
            "https://your-production-domain.com"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

**Important:** 
- Replace `https://your-production-domain.com` with your actual production domain
- Add any other origins you need (e.g., staging domains)

### Step 4: Save Configuration
1. Click **Save changes**
2. Wait a few seconds for the changes to propagate

### Step 5: Test Again
Try uploading an image again. The CORS error should be resolved.

## Alternative: Bucket Policy (if CORS doesn't work)

If CORS still doesn't work, you may also need to configure the bucket policy:

1. Go to **Permissions** tab
2. Click **Bucket policy**
3. Add this policy (replace `YOUR-BUCKET-NAME` and `YOUR-ACCOUNT-ID`):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
        },
        {
            "Sid": "AllowPutObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:PutObject",
            "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
        }
    ]
}
```

**Note:** This makes your bucket publicly writable. For production, use IAM roles or signed URLs (which you're already using).

## Verify CORS is Working

After configuring CORS, check the browser console. You should see:
- No CORS errors
- Successful PUT request to S3
- Image uploads working

## Common Issues

### Issue 1: CORS still not working
- **Solution:** Clear browser cache and try again
- **Solution:** Make sure the origin in CORS matches exactly (including http vs https, port numbers)

### Issue 2: "Access Denied" error
- **Solution:** Check IAM permissions for your AWS credentials
- **Solution:** Ensure your AWS user has `s3:PutObject` permission

### Issue 3: Presigned URL expires
- **Solution:** The presigned URL expires in 3600 seconds (1 hour). If you wait too long, generate a new one.

## Testing CORS Configuration

You can test if CORS is configured correctly using curl:

```bash
curl -X OPTIONS \
  -H "Origin: http://localhost:4000" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://YOUR-BUCKET-NAME.s3.REGION.amazonaws.com/images/test.jpg \
  -v
```

You should see `Access-Control-Allow-Origin` in the response headers.
