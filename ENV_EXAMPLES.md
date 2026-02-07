# Environment Variables Examples

## Backend Environment Variables

Create a `.env` file in `blog-editor/backend/` with the following:

```env
# =====================================================
# SERVER CONFIGURATION
# =====================================================
PORT=5000
NODE_ENV=development

# =====================================================
# DATABASE CONFIGURATION (PostgreSQL - Supabase)
# =====================================================
# Option 1: Use Supabase connection string (recommended)
# Format: postgresql://user:password@host:port/database
DATABASE_URL=postgresql://postgres.ekqfmpvebntssdgwtioj:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres

# Option 2: Use individual parameters (for local development)
# Uncomment and use these if not using DATABASE_URL
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=blog_editor
# DB_USER=postgres
# DB_PASSWORD=your_database_password_here

# =====================================================
# AUTH SERVICE INTEGRATION
# =====================================================
# URL of your existing auth service
# The blog editor validates JWT tokens via this service
AUTH_SERVICE_URL=http://localhost:3000

# =====================================================
# AWS S3 CONFIGURATION (for image uploads)
# =====================================================
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
S3_BUCKET_NAME=blog-editor-images

# =====================================================
# CORS CONFIGURATION
# =====================================================
# Frontend URL that will make requests to this backend
CORS_ORIGIN=http://localhost:4000

# Production example:
# CORS_ORIGIN=https://your-frontend-domain.com
```

## Frontend Environment Variables

Create a `.env` file in `blog-editor/frontend/` with the following:

```env
# =====================================================
# BLOG EDITOR BACKEND API URL
# =====================================================
# URL of the blog editor backend API
# This is where posts, uploads, etc. are handled
VITE_API_URL=http://localhost:5001

# Production example:
# VITE_API_URL=https://api.yourdomain.com

# =====================================================
# AUTH SERVICE API URL
# =====================================================
# URL of your existing auth service
# This is where authentication (login, OTP, etc.) is handled
VITE_AUTH_API_URL=http://localhost:3000

# Production example:
# VITE_AUTH_API_URL=https://auth.yourdomain.com
```

## Quick Setup

### Backend
```bash
cd blog-editor/backend
cp env.example .env
# Edit .env with your actual values
```

### Frontend
```bash
cd blog-editor/frontend
cp env.example .env
# Edit .env with your actual values
```

## Required Values to Update

### Backend `.env`
- `DATABASE_URL` - **Supabase connection string** (replace `[YOUR-PASSWORD]` with actual password)
  - Format: `postgresql://postgres.ekqfmpvebntssdgwtioj:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`
  - Or use individual DB_* parameters for local development
- `AUTH_SERVICE_URL` - URL where your auth service is running (default: http://localhost:3000)
  - **Note:** Auth service uses its own separate database
- `AWS_ACCESS_KEY_ID` - Your AWS access key
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret key
- `S3_BUCKET_NAME` - Your S3 bucket name
- `CORS_ORIGIN` - Your frontend URL (default: http://localhost:4000)

### Frontend `.env`
- `VITE_API_URL` - Your blog editor backend URL (default: http://localhost:5001)
- `VITE_AUTH_API_URL` - Your auth service URL (default: http://localhost:3000)

## Notes

1. **VITE_ prefix**: Frontend environment variables must start with `VITE_` to be accessible in the code
2. **Database (Supabase)**:
   - Replace `[YOUR-PASSWORD]` in `DATABASE_URL` with your actual Supabase password
   - Supabase automatically handles SSL connections
   - The connection string uses Supabase's connection pooler
   - Make sure the database exists in Supabase (or use default `postgres` database)
3. **Auth Service**: 
   - Ensure your auth service is running on the port specified in `AUTH_SERVICE_URL`
   - **Important:** Auth service uses its own separate database (not Supabase)
4. **AWS S3**: 
   - Create an S3 bucket
   - Configure CORS to allow PUT requests from your frontend
   - Create IAM user with `s3:PutObject` and `s3:GetObject` permissions
