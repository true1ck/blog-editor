import { pool } from '../config/database.js'
import dotenv from 'dotenv'

dotenv.config()

async function up() {
  try {
    console.log('Running add-thumbnail-and-excerpt migration...')

    await pool.query(`
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS thumbnail_url TEXT NULL;
    `)

    await pool.query(`
      ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS excerpt VARCHAR(500) NULL;
    `)

    console.log('✓ add-thumbnail-and-excerpt: thumbnail_url, excerpt added')
    process.exit(0)
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }
}

up()
