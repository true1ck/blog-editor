import express from 'express'
import { pool } from '../config/database.js'
import slugify from 'slugify'
import logger from '../utils/logger.js'

const router = express.Router()

// Get all posts for current user
// Note: authenticateToken middleware is applied at server level, so req.user is available
router.get('/', async (req, res) => {
  try {
    logger.transaction('FETCH_POSTS', { userId: req.user.id })
    const query = 'SELECT id, title, slug, status, created_at, updated_at FROM posts WHERE user_id = $1 ORDER BY updated_at DESC'
    logger.db('SELECT', query, [req.user.id])
    
    const result = await pool.query(query, [req.user.id])
    
    logger.transaction('FETCH_POSTS_SUCCESS', { 
      userId: req.user.id, 
      count: result.rows.length 
    })
    res.json(result.rows)
  } catch (error) {
    logger.error('POSTS', 'Error fetching posts', error)
    res.status(500).json({ message: 'Failed to fetch posts', error: error.message })
  }
})

// Get single post by ID
router.get('/:id', async (req, res) => {
  try {
    logger.transaction('FETCH_POST_BY_ID', { 
      postId: req.params.id, 
      userId: req.user.id 
    })
    const query = 'SELECT * FROM posts WHERE id = $1 AND user_id = $2'
    logger.db('SELECT', query, [req.params.id, req.user.id])
    
    const result = await pool.query(query, [req.params.id, req.user.id])

    if (result.rows.length === 0) {
      logger.warn('POSTS', 'Post not found', { 
        postId: req.params.id, 
        userId: req.user.id 
      })
      return res.status(404).json({ message: 'Post not found' })
    }

    logger.transaction('FETCH_POST_BY_ID_SUCCESS', { 
      postId: req.params.id, 
      userId: req.user.id 
    })
    res.json(result.rows[0])
  } catch (error) {
    logger.error('POSTS', 'Error fetching post', error)
    res.status(500).json({ message: 'Failed to fetch post', error: error.message })
  }
})

// Get post by slug (public)
router.get('/slug/:slug', async (req, res) => {
  try {
    logger.transaction('FETCH_POST_BY_SLUG', { slug: req.params.slug })
    const query = 'SELECT * FROM posts WHERE slug = $1 AND status = $2'
    logger.db('SELECT', query, [req.params.slug, 'published'])
    
    const result = await pool.query(query, [req.params.slug, 'published'])

    if (result.rows.length === 0) {
      logger.warn('POSTS', 'Post not found by slug', { slug: req.params.slug })
      return res.status(404).json({ message: 'Post not found' })
    }

    logger.transaction('FETCH_POST_BY_SLUG_SUCCESS', { 
      slug: req.params.slug,
      postId: result.rows[0].id
    })
    res.json(result.rows[0])
  } catch (error) {
    logger.error('POSTS', 'Error fetching post by slug', error)
    res.status(500).json({ message: 'Failed to fetch post', error: error.message })
  }
})

// Create post
router.post('/', async (req, res) => {
  try {
    const { title, content_json, status } = req.body

    logger.transaction('CREATE_POST', { 
      userId: req.user.id, 
      title: title?.substring(0, 50),
      status: status || 'draft'
    })

    if (!title || !content_json) {
      logger.warn('POSTS', 'Missing required fields', { 
        hasTitle: !!title, 
        hasContent: !!content_json 
      })
      return res.status(400).json({ message: 'Title and content are required' })
    }

    const slug = slugify(title, { lower: true, strict: true }) + '-' + Date.now()
    const postStatus = status || 'draft'

    const query = `INSERT INTO posts (user_id, title, content_json, slug, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`
    logger.db('INSERT', query, [req.user.id, title, '[content_json]', slug, postStatus])

    const result = await pool.query(query, [
      req.user.id, 
      title, 
      JSON.stringify(content_json), 
      slug, 
      postStatus
    ])

    logger.transaction('CREATE_POST_SUCCESS', { 
      postId: result.rows[0].id, 
      userId: req.user.id,
      slug: result.rows[0].slug
    })
    res.status(201).json(result.rows[0])
  } catch (error) {
    logger.error('POSTS', 'Error creating post', error)
    res.status(500).json({ message: 'Failed to create post', error: error.message })
  }
})

// Update post
router.put('/:id', async (req, res) => {
  try {
    const { title, content_json, status } = req.body

    logger.transaction('UPDATE_POST', { 
      postId: req.params.id, 
      userId: req.user.id,
      updates: {
        title: title !== undefined,
        content: content_json !== undefined,
        status: status !== undefined
      }
    })

    // Check if post exists and belongs to user
    const checkQuery = 'SELECT id FROM posts WHERE id = $1 AND user_id = $2'
    logger.db('SELECT', checkQuery, [req.params.id, req.user.id])
    
    const existingPost = await pool.query(checkQuery, [req.params.id, req.user.id])

    if (existingPost.rows.length === 0) {
      logger.warn('POSTS', 'Post not found for update', { 
        postId: req.params.id, 
        userId: req.user.id 
      })
      return res.status(404).json({ message: 'Post not found' })
    }

    // Build update query dynamically
    const updates = []
    const values = []
    let paramCount = 1

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`)
      values.push(title)
    }

    if (content_json !== undefined) {
      updates.push(`content_json = $${paramCount++}`)
      values.push(JSON.stringify(content_json))
    }

    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`)
      values.push(status)
    }

    // Update slug if title changed
    if (title !== undefined) {
      const slug = slugify(title, { lower: true, strict: true }) + '-' + Date.now()
      updates.push(`slug = $${paramCount++}`)
      values.push(slug)
    }

    updates.push(`updated_at = NOW()`)
    values.push(req.params.id, req.user.id)

    const updateQuery = `UPDATE posts SET ${updates.join(', ')} WHERE id = $${paramCount} AND user_id = $${paramCount + 1} RETURNING *`
    logger.db('UPDATE', updateQuery, values)

    const result = await pool.query(updateQuery, values)

    logger.transaction('UPDATE_POST_SUCCESS', { 
      postId: req.params.id, 
      userId: req.user.id 
    })
    res.json(result.rows[0])
  } catch (error) {
    logger.error('POSTS', 'Error updating post', error)
    res.status(500).json({ message: 'Failed to update post', error: error.message })
  }
})

// Delete post
router.delete('/:id', async (req, res) => {
  try {
    logger.transaction('DELETE_POST', { 
      postId: req.params.id, 
      userId: req.user.id 
    })
    
    const query = 'DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING id'
    logger.db('DELETE', query, [req.params.id, req.user.id])
    
    const result = await pool.query(query, [req.params.id, req.user.id])

    if (result.rows.length === 0) {
      logger.warn('POSTS', 'Post not found for deletion', { 
        postId: req.params.id, 
        userId: req.user.id 
      })
      return res.status(404).json({ message: 'Post not found' })
    }

    logger.transaction('DELETE_POST_SUCCESS', { 
      postId: req.params.id, 
      userId: req.user.id 
    })
    res.json({ message: 'Post deleted successfully' })
  } catch (error) {
    logger.error('POSTS', 'Error deleting post', error)
    res.status(500).json({ message: 'Failed to delete post', error: error.message })
  }
})

export default router
