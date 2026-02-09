import { pool } from '../config/database.js'
import dotenv from 'dotenv'

dotenv.config()

async function up() {
  try {
    console.log('Running add-link-post-columns migration...')

    await pool.query(`
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'tiptap'
      CHECK (content_type IN ('tiptap', 'link'));
    `)

    await pool.query(`
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS external_url TEXT NULL;
    `)

    console.log('✓ add-link-post-columns: content_type, external_url added')
    process.exit(0)
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }
}

up()
