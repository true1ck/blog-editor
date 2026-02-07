# How to Run the Blog Editor Application

## Prerequisites

1. **Node.js 18+** installed
2. **PostgreSQL/Supabase** database configured
3. **Auth service** running (at `G:\LivingAi\GITTEA_RPO\auth`)
4. **AWS S3** configured (for image uploads)

## Step-by-Step Setup

### 1. Start the Auth Service (Required First)

The blog editor depends on your existing auth service. Make sure it's running:

```bash
cd G:\LivingAi\GITTEA_RPO\auth
npm install  # If not already done
npm start   # or npm run dev
```

The auth service should be running on `http://localhost:3000` (or your configured port).

### 2. Setup Backend

#### Install Dependencies
```bash
cd blog-editor/backend
npm install
```

#### Configure Environment
Make sure you have a `.env` file in `blog-editor/backend/`:
```bash
# If you haven't created it yet
cp env.example .env
# Then edit .env with your actual values
```

Your `.env` should have:
- `DATABASE_URL` - Your Supabase connection string
- `AUTH_SERVICE_URL` - URL of auth service (default: http://localhost:3000)
- AWS credentials for S3
- Other required variables

#### Run Database Migrations
```bash
npm run migrate
```

This will create the `posts` table and indexes in your Supabase database.

#### Start Backend Server
```bash
npm run dev
```

The backend will start on `http://localhost:5001` (or your configured PORT).

You should see:
```
Server running on port 5001
```

### 3. Setup Frontend

#### Install Dependencies
```bash
cd blog-editor/frontend
npm install
```

#### Configure Environment
Make sure you have a `.env` file in `blog-editor/frontend/`:
```bash
# If you haven't created it yet
cp env.example .env
# Then edit .env with your actual values
```

Your `.env` should have:
- `VITE_API_URL=http://localhost:5001` - Backend API URL
- `VITE_AUTH_API_URL=http://localhost:3000` - Auth service URL

#### Start Frontend Dev Server
```bash
npm run dev
```

The frontend will start on `http://localhost:4000`.

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:4000/
  ➜  Network: use --host to expose
```

## Running Everything Together

### Option 1: Separate Terminals (Recommended)

**Terminal 1 - Auth Service:**
```bash
cd G:\LivingAi\GITTEA_RPO\auth
npm start
```

**Terminal 2 - Blog Editor Backend:**
```bash
cd blog-editor/backend
npm run dev
```

**Terminal 3 - Blog Editor Frontend:**
```bash
cd blog-editor/frontend
npm run dev
```

### Option 2: Using npm scripts (if you create them)

You could create a root `package.json` with scripts to run everything, but separate terminals are easier for debugging.

## Verify Everything is Working

### 1. Check Auth Service
```bash
curl http://localhost:3000/health
# Should return: {"ok":true}
```

### 2. Check Backend
```bash
curl http://localhost:5000/api/health
# Should return: {"status":"ok"}
```

### 3. Check Database Connection
```bash
curl http://localhost:5000/api/test-db
# Should return database connection info
```

### 4. Open Frontend
Open your browser to the frontend URL (usually `http://localhost:5173` or `http://localhost:3000`)

## First Time Usage

1. **Open the frontend** in your browser
2. **Click Login** (or navigate to `/login`)
3. **Enter your phone number** (e.g., `+919876543210` or `9876543210`)
4. **Request OTP** - You'll receive an OTP via SMS (or console if using test numbers)
5. **Enter OTP** to verify
6. **You'll be logged in** and redirected to the dashboard
7. **Create your first post** by clicking "New Post"

## Troubleshooting

### Backend won't start
- Check if port 5001 is already in use
- Verify `.env` file exists and has correct values
- Check database connection string is correct
- Ensure auth service is running

### Frontend won't start
- Check if port is already in use (Vite will auto-select another port)
- Verify `.env` file exists with `VITE_` prefixed variables
- Check that backend is running

### Database connection errors
- Verify Supabase connection string is correct
- Check that password doesn't have special characters that need URL encoding
- Ensure Supabase database is accessible
- Check IP whitelist in Supabase settings

### Auth service connection errors
- Verify auth service is running on the correct port
- Check `AUTH_SERVICE_URL` in backend `.env`
- Check `VITE_AUTH_API_URL` in frontend `.env`

### CORS errors
- Verify `CORS_ORIGIN` in backend `.env` matches frontend URL
- Check that auth service CORS settings allow your frontend origin

## Production Build

### Build Frontend
```bash
cd blog-editor/frontend
npm run build
```

The built files will be in `blog-editor/frontend/dist/`

### Start Backend in Production
```bash
cd blog-editor/backend
NODE_ENV=production npm start
```

## Quick Commands Reference

```bash
# Backend
cd blog-editor/backend
npm install          # Install dependencies
npm run migrate      # Run database migrations
npm run dev          # Start dev server
npm start            # Start production server

# Frontend
cd blog-editor/frontend
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build
```
