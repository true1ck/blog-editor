# Blog Editor Backend

Express.js API server for the blog editor application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (see `.env.example`)

3. Create PostgreSQL database:
```bash
createdb blog_editor
```

4. Run migrations:
```bash
npm run migrate
```

5. Start server:
```bash
npm run dev
```

## API Documentation

See main README.md for API endpoints.

## Database

PostgreSQL database with two main tables:
- `users` - User accounts
- `posts` - Blog posts

Run migrations to set up the schema.
