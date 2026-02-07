# Blog Editor - Full Stack Application

A full-stack blog editor built with TipTap, React, Node.js, PostgreSQL, and AWS S3.

## Features

- ✨ Rich text editor with TipTap
- 📝 Auto-save drafts every 10 seconds
- 🖼️ Image upload to AWS S3 with presigned URLs
- 🔐 Phone/OTP authentication (integrated with existing auth service)
- 📱 Mobile responsive UI
- 🎨 Rich formatting options (Bold, Italic, Underline, Headings, Lists, Quotes, Code blocks, Colors, Font sizes)
- 📄 Public blog pages
- 🎯 Dashboard for managing posts

## Tech Stack

### Frontend
- React 18
- Vite
- TipTap Editor
- Tailwind CSS
- React Router
- Axios

### Backend
- Node.js
- Express
- PostgreSQL
- JWT + bcrypt
- AWS S3 SDK

## Project Structure

```
blog-editor/
├── frontend/          # React + Vite application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/    # Page components
│   │   ├── contexts/ # React contexts
│   │   ├── utils/    # Utility functions
│   │   └── extensions/ # TipTap extensions
│   └── package.json
├── backend/          # Express API
│   ├── config/       # Database and S3 config
│   ├── routes/       # API routes
│   ├── middleware/   # Auth middleware
│   ├── migrations/   # Database migrations
│   └── package.json
└── README.md
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- AWS Account with S3 bucket
- AWS Access Key and Secret Key

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=blog_editor
DB_USER=postgres
DB_PASSWORD=your_password
AUTH_SERVICE_URL=http://localhost:3000
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=blog-editor-images
CORS_ORIGIN=http://localhost:4000
```

**Note:** The blog editor uses the existing auth service at `G:\LivingAi\GITTEA_RPO\auth`. Make sure:
- The auth service is running on port 3000 (or update `AUTH_SERVICE_URL`)
- **Auth service uses its own separate database** (not Supabase)
- Blog editor uses Supabase for storing posts

5. Configure Supabase database:
   - Add your Supabase connection string to `.env` as `DATABASE_URL`
   - Format: `postgresql://postgres.ekqfmpvebntssdgwtioj:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres`
   - Replace `[YOUR-PASSWORD]` with your actual Supabase password

6. Run migrations:
```bash
npm run migrate
```

7. Start the server:
```bash
npm run dev
```

The backend will run on `http://localhost:5001`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update `.env`:
```env
VITE_API_URL=http://localhost:5001
VITE_AUTH_API_URL=http://localhost:3000
```

**Note:** `VITE_AUTH_API_URL` should point to your existing auth service.

5. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:4000`

## AWS S3 Setup

1. Create an S3 bucket in your AWS account
2. Configure CORS for the bucket:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": ["http://localhost:4000"],
    "ExposeHeaders": []
  }
]
```

3. Create an IAM user with S3 permissions:
   - `s3:PutObject` on your bucket
   - `s3:GetObject` on your bucket

4. Add the Access Key ID and Secret Access Key to your backend `.env` file

## Database Schema

**Note:** Users are managed by the auth service in a separate database. The blog editor only stores `user_id` references.

### Posts Table
- `id` (UUID, Primary Key)
- `user_id` (UUID) - References user ID from auth service (no foreign key constraint)
- `title` (VARCHAR)
- `content_json` (JSONB) - TipTap editor content stored as JSON
- `slug` (VARCHAR, Unique) - URL-friendly post identifier
- `status` (VARCHAR: 'draft' or 'published')
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP) - Auto-updated via trigger

## API Endpoints

### Authentication (Handled by Existing Auth Service)
The blog editor uses the existing auth service at `G:\LivingAi\GITTEA_RPO\auth`:
- `POST /auth/request-otp` - Request OTP for phone number
- `POST /auth/verify-otp` - Verify OTP and get tokens
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user
- `POST /auth/validate-token` - Validate JWT token (used by blog editor backend)

### Posts
- `GET /api/posts` - Get all posts for current user (protected)
- `GET /api/posts/:id` - Get single post (protected)
- `GET /api/posts/slug/:slug` - Get post by slug (public)
- `POST /api/posts` - Create new post (protected)
- `PUT /api/posts/:id` - Update post (protected)
- `DELETE /api/posts/:id` - Delete post (protected)

### Upload
- `POST /api/upload/presigned-url` - Get presigned URL for image upload (protected)

## Pages

- `/login` - Login page (Phone/OTP authentication)
- `/dashboard` - User dashboard (protected)
- `/editor` - Create new post (protected)
- `/editor/:id` - Edit existing post (protected)
- `/blog/:slug` - Public blog post view

## Deployment

### Backend (AWS EC2)

1. Set up EC2 instance
2. Install Node.js and PostgreSQL
3. Clone repository
4. Set environment variables
5. Run migrations
6. Use PM2 or similar to run the server:
```bash
pm2 start server.js --name blog-editor-api
```

### Frontend (AWS Amplify or Vercel)

#### AWS Amplify:
1. Connect your repository
2. Set build settings:
   - Build command: `npm run build`
   - Output directory: `dist`
3. Add environment variable: `VITE_API_URL`

#### Vercel:
1. Import your repository
2. Set build command: `npm run build`
3. Add environment variable: `VITE_API_URL`

## Environment Variables

### Backend
- `PORT` - Server port (default: 5000)
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `AUTH_SERVICE_URL` - URL of existing auth service (default: http://localhost:3000)
- `AWS_REGION` - AWS region
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `S3_BUCKET_NAME` - S3 bucket name
- `CORS_ORIGIN` - CORS allowed origin

### Frontend
- `VITE_API_URL` - Blog editor backend API URL
- `VITE_AUTH_API_URL` - Auth service API URL (default: http://localhost:3000)

## License

MIT
