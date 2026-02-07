# Quick Start Guide

## Prerequisites Check

- [ ] Node.js 18+ installed
- [ ] PostgreSQL installed and running
- [ ] AWS account with S3 bucket created
- [ ] AWS IAM user with S3 permissions

## 5-Minute Setup

### 1. Backend Setup (2 minutes)

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your database and AWS credentials
createdb blog_editor  # or use psql to create database
npm run migrate
npm run dev
```

### 2. Frontend Setup (2 minutes)

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:5001
npm run dev
```

### 3. Test the Application (1 minute)

1. Open http://localhost:4000
2. Register a new account
3. Create a new post
4. Add some content with formatting
5. Upload an image
6. Publish the post

## Common Issues

### Database Connection Error
- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `.env`
- Ensure database exists: `psql -l | grep blog_editor`

### S3 Upload Fails
- Verify AWS credentials in `.env`
- Check S3 bucket name is correct
- Ensure bucket CORS is configured
- Verify IAM user has PutObject permission

### CORS Error
- Check `CORS_ORIGIN` in backend `.env` matches frontend URL
- Default: `http://localhost:4000`

## Next Steps

- Customize the editor styling
- Add more TipTap extensions
- Configure production environment variables
- Set up CI/CD pipeline
- Deploy to AWS
