# Troubleshooting Guide

## "Failed to fetch" Error When Uploading Images

This error means the frontend cannot connect to the backend API. Check the following:

### 1. Check Backend is Running

Make sure your backend server is running:
```bash
cd blog-editor/backend
npm run dev
```

You should see:
```
✅ Blog Editor Backend is running!
   🌐 Server: http://localhost:5001
```

### 2. Check Frontend API URL

In `blog-editor/frontend/.env`, make sure:
```env
VITE_API_URL=http://localhost:5001
```

**Important:** The port must match your backend port (check your backend terminal output).

### 3. Check Browser Console

Open browser DevTools (F12) → Console tab and look for:
- Network errors
- CORS errors
- 404 errors
- Connection refused errors

### 4. Test Backend Manually

Open in browser or use curl:
```bash
# Health check
curl http://localhost:5001/api/health

# Should return: {"status":"ok"}
```

### 5. Check CORS Configuration

In `blog-editor/backend/.env`:
```env
CORS_ORIGIN=http://localhost:4000
```

Make sure this matches your frontend URL.

### 6. Check AWS S3 Configuration

If you see "AWS S3 is not configured" error:

In `blog-editor/backend/.env`, add:
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=blog-editor-images
```

**Note:** Image uploads won't work without AWS S3 configured. You can:
- Set up AWS S3 (recommended for production)
- Or temporarily disable image uploads for testing

### 7. Check Authentication Token

Make sure you're logged in. The upload endpoint requires authentication.

Check browser console → Application → Local Storage:
- Should have `access_token`
- Should have `refresh_token`

### 8. Common Issues

**Issue:** Backend on different port
- **Fix:** Update `VITE_API_URL` in frontend `.env` to match backend port

**Issue:** CORS blocking requests
- **Fix:** Update `CORS_ORIGIN` in backend `.env` to match frontend URL

**Issue:** Backend not running
- **Fix:** Start backend: `cd blog-editor/backend && npm run dev`

**Issue:** Network error
- **Fix:** Check firewall, VPN, or proxy settings

### 9. Test Upload Endpoint Directly

```bash
# Get your access token from browser localStorage
# Then test:
curl -X POST http://localhost:5001/api/upload/presigned-url \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","contentType":"image/jpeg"}'
```

### 10. Enable Detailed Logging

Check backend terminal for error messages when you try to upload.

## Quick Fix Checklist

- [ ] Backend is running (check terminal)
- [ ] Frontend `.env` has correct `VITE_API_URL`
- [ ] Backend `.env` has correct `CORS_ORIGIN`
- [ ] You're logged in (check localStorage for tokens)
- [ ] Browser console shows no CORS errors
- [ ] AWS S3 is configured (if using image uploads)
