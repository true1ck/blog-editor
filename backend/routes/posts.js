import express from 'express'
import { pool } from '../config/database.js'
import slugify from 'slugify'
import logger from '../utils/logger.js'

const router = express.Router()

const MAX_EXTERNAL_URL_LENGTH = 2048

function isValidExternalUrl(url) {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed || trimmed.length > MAX_EXTERNAL_URL_LENGTH) return false
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
}

// Get all posts for current user
// Note: authenticateToken middleware is applied at server level, so req.user is available
router.get('/', async (req, res) => {
  try {
    logger.transaction('FETCH_POSTS', { userId: req.user.id })
    const query = 'SELECT id, title, slug, status, content_type, external_url, thumbnail_url, excerpt, created_at, updated_at FROM posts WHERE user_id = $1 ORDER BY updated_at DESC'
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
    const { title, content_json, content_type, external_url, status, thumbnail_url, excerpt } = req.body

    logger.transaction('CREATE_POST', { 
      userId: req.user.id, 
      title: title?.substring(0, 50),
      status: status || 'draft',
      content_type: content_type || 'tiptap'
    })

    const isLinkPost = content_type === 'link'

    if (isLinkPost) {
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ message: 'Title is required' })
      }
      if (!external_url || !isValidExternalUrl(external_url)) {
        return res.status(400).json({ message: 'Valid external URL is required (http:// or https://, max 2048 characters)' })
      }
    } else {
      if (!title || !content_json) {
        logger.warn('POSTS', 'Missing required fields', { 
          hasTitle: !!title, 
          hasContent: !!content_json 
        })
        return res.status(400).json({ message: 'Title and content are required' })
      }
    }

    const slug = slugify(title, { lower: true, strict: true }) + '-' + Date.now()
    const postStatus = status || 'draft'
    const contentType = isLinkPost ? 'link' : (content_type || 'tiptap')
    const contentJson = isLinkPost ? {} : content_json
    const externalUrl = isLinkPost ? external_url.trim() : null

    const thumbnailUrl = thumbnail_url && typeof thumbnail_url === 'string' ? thumbnail_url.trim() || null : null
    const excerptVal = excerpt != null && typeof excerpt === 'string' ? excerpt.trim().slice(0, 500) || null : null

    if (postStatus === 'published') {
      if (!thumbnailUrl) {
        return res.status(400).json({ message: 'Thumbnail is required to publish. Add a post thumbnail first.' })
      }
      if (!excerptVal) {
        return res.status(400).json({ message: 'List description (excerpt) is required to publish.' })
      }
    }

    const query = `INSERT INTO posts (user_id, title, content_json, slug, status, content_type, external_url, thumbnail_url, excerpt)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`
    logger.db('INSERT', query, [req.user.id, title, '[content_json]', slug, postStatus, contentType, externalUrl, thumbnailUrl, excerptVal])

    const result = await pool.query(query, [
      req.user.id, 
      title, 
      JSON.stringify(contentJson), 
      slug, 
      postStatus,
      contentType,
      externalUrl,
      thumbnailUrl,
      excerptVal
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
    const { title, content_json, content_type, external_url, status, thumbnail_url, excerpt } = req.body

    logger.transaction('UPDATE_POST', { 
      postId: req.params.id, 
      userId: req.user.id,
      updates: {
        title: title !== undefined,
        content: content_json !== undefined,
        status: status !== undefined,
        content_type: content_type !== undefined,
        external_url: external_url !== undefined,
        thumbnail_url: thumbnail_url !== undefined,
        excerpt: excerpt !== undefined
      }
    })

    // Check if post exists and belongs to user (fetch thumbnail/excerpt when publishing)
    const checkQuery = status === 'published'
      ? 'SELECT id, thumbnail_url, excerpt FROM posts WHERE id = $1 AND user_id = $2'
      : 'SELECT id FROM posts WHERE id = $1 AND user_id = $2'
    logger.db('SELECT', checkQuery, [req.params.id, req.user.id])
    const existingResult = await pool.query(checkQuery, [req.params.id, req.user.id])
    const existingPost = existingResult.rows[0]

    if (!existingPost) {
      logger.warn('POSTS', 'Post not found for update', { 
        postId: req.params.id, 
        userId: req.user.id 
      })
      return res.status(404).json({ message: 'Post not found' })
    }

    const isLinkUpdate = content_type === 'link'
    if (external_url !== undefined && isLinkUpdate && !isValidExternalUrl(external_url)) {
      return res.status(400).json({ message: 'Valid external URL is required (http:// or https://, max 2048 characters)' })
    }
    if (content_type === 'link' && external_url === undefined) {
      return res.status(400).json({ message: 'external_url is required when content_type is link' })
    }

    // When publishing, require thumbnail and excerpt (use existing if not in body)
    if (status === 'published') {
      const finalThumbnail = thumbnail_url !== undefined
        ? (thumbnail_url && typeof thumbnail_url === 'string' ? thumbnail_url.trim() || null : null)
        : (existingPost.thumbnail_url ?? null)
      const finalExcerpt = excerpt !== undefined
        ? (excerpt != null && typeof excerpt === 'string' ? excerpt.trim().slice(0, 500) || null : null)
        : (existingPost.excerpt ?? null)
      if (!finalThumbnail) {
        return res.status(400).json({ message: 'Thumbnail is required to publish. Add a post thumbnail first.' })
      }
      if (!finalExcerpt) {
        return res.status(400).json({ message: 'List description (excerpt) is required to publish.' })
      }
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

    if (content_type !== undefined) {
      updates.push(`content_type = $${paramCount++}`)
      values.push(content_type)
    }

    // When content_type is set to non-link, clear external_url; when link, set URL
    if (content_type !== undefined) {
      updates.push(`external_url = $${paramCount++}`)
      values.push(content_type === 'link' && external_url !== undefined ? external_url.trim() : null)
    } else if (external_url !== undefined) {
      updates.push(`external_url = $${paramCount++}`)
      values.push(external_url.trim())
    }

    // Update slug if title changed
    if (title !== undefined) {
      const slug = slugify(title, { lower: true, strict: true }) + '-' + Date.now()
      updates.push(`slug = $${paramCount++}`)
      values.push(slug)
    }

    if (thumbnail_url !== undefined) {
      updates.push(`thumbnail_url = $${paramCount++}`)
      values.push(thumbnail_url && typeof thumbnail_url === 'string' ? thumbnail_url.trim() || null : null)
    }

    if (excerpt !== undefined) {
      updates.push(`excerpt = $${paramCount++}`)
      values.push(excerpt != null && typeof excerpt === 'string' ? excerpt.trim().slice(0, 500) || null : null)
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
