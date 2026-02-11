import { pool } from '../config/database.js'
import dotenv from 'dotenv'

dotenv.config()

async function up() {
  try {
    console.log('Running add-language-column migration...')

    // Add language column
    await pool.query(`
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en' NOT NULL;
    `)
    console.log('✓ Added language column')

    // Add post_group_id to link English and Hindi versions
    await pool.query(`
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS post_group_id UUID NULL;
    `)
    console.log('✓ Added post_group_id column')

    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_language ON posts(language);
    `)
    console.log('✓ Created language index')

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_posts_group_id ON posts(post_group_id);
    `)
    console.log('✓ Created post_group_id index')

    // Backfill existing posts to English
    await pool.query(`
      UPDATE posts SET language = 'en' WHERE language IS NULL;
    `)
    console.log('✓ Backfilled existing posts with language=en')

    console.log('✓ add-language-column migration completed successfully')
    process.exit(0)
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }
}

up()
