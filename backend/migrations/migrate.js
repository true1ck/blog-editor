import { pool } from '../config/database.js'
import dotenv from 'dotenv'

dotenv.config()

async function migrate() {
  try {
    console.log('Running migrations...')

    // Note: Users table is managed by the auth service in a separate database
    // We only store user_id (UUID) references here, no foreign key constraint

    // Create posts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        title VARCHAR(500) NOT NULL,
        content_json JSONB NOT NULL,
        slug VARCHAR(500) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ Posts table created')
    console.log('  Note: user_id references users from auth service (separate database)')

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug)
    `)
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)
    `)
    console.log('✓ Indexes created')

    // Create function to update updated_at timestamp
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `)

    // Create trigger
    await pool.query(`
      DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
      CREATE TRIGGER update_posts_updated_at
      BEFORE UPDATE ON posts
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `)
    console.log('✓ Triggers created')

    console.log('Migration completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

migrate()
