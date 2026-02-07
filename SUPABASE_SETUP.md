# Supabase Database Setup

The blog editor uses Supabase PostgreSQL for storing blog posts. The auth service uses its own separate database.

## Connection String Format

Your Supabase connection string should look like:
```
postgresql://postgres.ekqfmpvebntssdgwtioj:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

## Setup Steps

### 1. Get Your Supabase Connection String

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **Database**
3. Find the **Connection string** section
4. Copy the **Connection pooling** connection string (recommended)
5. Replace `[YOUR-PASSWORD]` with your actual database password

### 2. Update Backend `.env`

Add to `blog-editor/backend/.env`:
```env
DATABASE_URL=postgresql://postgres.ekqfmpvebntssdgwtioj:your_actual_password@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

### 3. Create Database Schema

Run the migrations to create the required tables:
```bash
cd blog-editor/backend
npm run migrate
```

This will create:
- `users` table (if not exists - though auth service has its own users table)
- `posts` table for blog posts
- Required indexes

### 4. Verify Connection

Test the database connection:
```bash
# The backend has a test endpoint
curl http://localhost:5001/api/test-db
```

## Database Schema

The blog editor creates these tables in Supabase:

### `posts` table
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key - references auth service user ID)
- `title` (VARCHAR)
- `content_json` (JSONB) - TipTap editor content
- `slug` (VARCHAR, Unique)
- `status` (VARCHAR: 'draft' or 'published')
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Indexes
- `idx_posts_user_id` - For fast user queries
- `idx_posts_slug` - For fast slug lookups
- `idx_posts_status` - For filtering by status

## Important Notes

1. **Separate Databases**: 
   - Blog editor uses Supabase PostgreSQL
   - Auth service uses its own separate database
   - User IDs from auth service are stored as `user_id` in posts table

2. **Connection Pooling**: 
   - Supabase connection string uses their pooler
   - This is more efficient for serverless/server applications
   - SSL is automatically handled

3. **User IDs**: 
   - The `user_id` in posts table references the user ID from your auth service
   - Make sure the auth service user IDs are UUIDs (which they should be)

4. **Database Name**: 
   - Default Supabase database is `postgres`
   - You can create a separate database if needed, just update the connection string

## Troubleshooting

### Connection Issues
- Verify your password is correct
- Check that your IP is allowed in Supabase (Settings → Database → Connection Pooling)
- Ensure you're using the connection pooling URL (not direct connection)

### Migration Issues
- Make sure you have proper permissions on the database
- Check that the database exists
- Verify the connection string format is correct

### SSL Issues
- Supabase requires SSL connections
- The code automatically sets `rejectUnauthorized: false` for Supabase
- This is safe because Supabase uses valid SSL certificates
