# Update Your .env File

Your backend is running but showing old port values. Update your `.env` file in `blog-editor/backend/`:

## Required Changes

Change these values in your `.env` file:

```env
# Change from 3200 (or whatever you have) to:
PORT=5001

# Change from http://localhost:3000 to:
CORS_ORIGIN=http://localhost:4000

# Keep auth service URL as is (it's correct):
AUTH_SERVICE_URL=http://localhost:3000
```

## Complete .env Example

```env
PORT=5001
NODE_ENV=development

DATABASE_URL=postgresql://postgres.ekqfmpvebntssdgwtioj:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres

AUTH_SERVICE_URL=http://localhost:3000

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
S3_BUCKET_NAME=blog-editor-images

CORS_ORIGIN=http://localhost:4000
```

After updating, restart your backend server.
