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
    const query = 'SELECT id, title, slug, status, content_type, external_url, thumbnail_url, excerpt, language, post_group_id, created_at, updated_at FROM posts WHERE user_id = $1 ORDER BY updated_at DESC'
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
    const { title, content_json, content_type, external_url, status, thumbnail_url, excerpt, language } = req.body

    logger.transaction('CREATE_POST', { 
      userId: req.user.id, 
      title: title?.substring(0, 50),
      status: status || 'draft',
      content_type: content_type || 'tiptap',
      language: language || 'en'
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
    const postLanguage = language || 'en'

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

    const query = `INSERT INTO posts (user_id, title, content_json, slug, status, content_type, external_url, thumbnail_url, excerpt, language)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`
    logger.db('INSERT', query, [req.user.id, title, '[content_json]', slug, postStatus, contentType, externalUrl, thumbnailUrl, excerptVal, postLanguage])

    const result = await pool.query(query, [
      req.user.id, 
      title, 
      JSON.stringify(contentJson), 
      slug, 
      postStatus,
      contentType,
      externalUrl,
      thumbnailUrl,
      excerptVal,
      postLanguage
    ])

    logger.transaction('CREATE_POST_SUCCESS', { 
      postId: result.rows[0].id, 
      userId: req.user.id,
      slug: result.rows[0].slug,
      language: postLanguage
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
    const { title, content_json, content_type, external_url, status, thumbnail_url, excerpt, language } = req.body

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
        excerpt: excerpt !== undefined,
        language: language !== undefined
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

    if (language !== undefined) {
      updates.push(`language = $${paramCount++}`)
      values.push(language || 'en')
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

// Get post group by post_group_id (returns both EN and HI versions)
router.get('/group/:post_group_id', async (req, res) => {
  try {
    logger.transaction('FETCH_POST_GROUP', { 
      postGroupId: req.params.post_group_id, 
      userId: req.user.id 
    })
    const query = 'SELECT * FROM posts WHERE post_group_id = $1 AND user_id = $2 ORDER BY language'
    logger.db('SELECT', query, [req.params.post_group_id, req.user.id])
    
    const result = await pool.query(query, [req.params.post_group_id, req.user.id])

    if (result.rows.length === 0) {
      logger.warn('POSTS', 'Post group not found', { 
        postGroupId: req.params.post_group_id, 
        userId: req.user.id 
      })
      return res.status(404).json({ message: 'Post group not found' })
    }

    // Organize by language
    const posts = {
      post_group_id: req.params.post_group_id,
      english: result.rows.find(p => p.language === 'en') || null,
      hindi: result.rows.find(p => p.language === 'hi') || null
    }

    logger.transaction('FETCH_POST_GROUP_SUCCESS', { 
      postGroupId: req.params.post_group_id, 
      userId: req.user.id 
    })
    res.json(posts)
  } catch (error) {
    logger.error('POSTS', 'Error fetching post group', error)
    res.status(500).json({ message: 'Failed to fetch post group', error: error.message })
  }
})

// Create dual-language post (creates both EN and HI posts together)
router.post('/dual-language', async (req, res) => {
  try {
    const { 
      // English fields
      title_en, excerpt_en, content_json_en, external_url_en, status_en,
      // Hindi fields  
      title_hi, excerpt_hi, content_json_hi, external_url_hi, status_hi,
      // Shared fields
      content_type, thumbnail_url, status 
    } = req.body

    // Support both old format (status) and new format (status_en/status_hi)
    const enStatus = status_en || status || 'draft'
    const hiStatus = status_hi || status || 'draft'

    logger.transaction('CREATE_DUAL_LANGUAGE_POST', { 
      userId: req.user.id, 
      status_en: enStatus,
      status_hi: hiStatus,
      content_type: content_type || 'tiptap'
    })

    const isLinkPost = content_type === 'link'

    // Validation for publishing English
    if (enStatus === 'published') {
      if (!title_en?.trim() || !excerpt_en?.trim()) {
        return res.status(400).json({ message: 'English title and excerpt required to publish' })
      }
      if (isLinkPost && !external_url_en?.trim()) {
        return res.status(400).json({ message: 'English URL required for link posts' })
      }
      if (isLinkPost && !isValidExternalUrl(external_url_en)) {
        return res.status(400).json({ message: 'Valid English external URL is required' })
      }
      if (!isLinkPost && !content_json_en) {
        return res.status(400).json({ message: 'English content required' })
      }
      if (!thumbnail_url?.trim()) {
        return res.status(400).json({ message: 'Thumbnail required to publish' })
      }
    }
    
    // Validation for publishing Hindi
    if (hiStatus === 'published') {
      if (!title_hi?.trim() || !excerpt_hi?.trim()) {
        return res.status(400).json({ message: 'Hindi title and excerpt required to publish' })
      }
      if (isLinkPost && !external_url_hi?.trim()) {
        return res.status(400).json({ message: 'Hindi URL required for link posts' })
      }
      if (isLinkPost && !isValidExternalUrl(external_url_hi)) {
        return res.status(400).json({ message: 'Valid Hindi external URL is required' })
      }
      if (!isLinkPost && !content_json_hi) {
        return res.status(400).json({ message: 'Hindi content required' })
      }
      if (!thumbnail_url?.trim()) {
        return res.status(400).json({ message: 'Thumbnail required to publish' })
      }
    }
    
    // Generate shared post_group_id using crypto
    const { randomUUID } = await import('crypto')
    const postGroupId = randomUUID()
    
    const contentType = isLinkPost ? 'link' : (content_type || 'tiptap')
    const thumbnailUrlVal = thumbnail_url && typeof thumbnail_url === 'string' ? thumbnail_url.trim() || null : null

    // Create English post
    const slugEn = slugify(title_en || 'untitled', { lower: true, strict: true }) + '-' + Date.now()
    const excerptEnVal = excerpt_en != null && typeof excerpt_en === 'string' ? excerpt_en.trim().slice(0, 500) || null : null
    const contentEnVal = isLinkPost ? {} : (content_json_en || {})
    const externalUrlEnVal = isLinkPost && external_url_en ? external_url_en.trim() : null

    const enQuery = `INSERT INTO posts (user_id, title, content_json, slug, status, content_type, external_url, thumbnail_url, excerpt, language, post_group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`
    logger.db('INSERT', enQuery, [req.user.id, title_en, '[content_json]', slugEn, enStatus, contentType, externalUrlEnVal, thumbnailUrlVal, excerptEnVal, 'en', postGroupId])

    const enResult = await pool.query(enQuery, [
      req.user.id, 
      title_en || 'Untitled', 
      JSON.stringify(contentEnVal), 
      slugEn, 
      enStatus,
      contentType,
      externalUrlEnVal,
      thumbnailUrlVal,
      excerptEnVal,
      'en',
      postGroupId
    ])
    
    // Create Hindi post
    const slugHi = slugify(title_hi || 'untitled', { lower: true, strict: true }) + '-' + Date.now() + '-hi'
    const excerptHiVal = excerpt_hi != null && typeof excerpt_hi === 'string' ? excerpt_hi.trim().slice(0, 500) || null : null
    const contentHiVal = isLinkPost ? {} : (content_json_hi || {})
    const externalUrlHiVal = isLinkPost && external_url_hi ? external_url_hi.trim() : null

    const hiQuery = `INSERT INTO posts (user_id, title, content_json, slug, status, content_type, external_url, thumbnail_url, excerpt, language, post_group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`
    logger.db('INSERT', hiQuery, [req.user.id, title_hi, '[content_json]', slugHi, hiStatus, contentType, externalUrlHiVal, thumbnailUrlVal, excerptHiVal, 'hi', postGroupId])

    const hiResult = await pool.query(hiQuery, [
      req.user.id, 
      title_hi || 'शीर्षकहीन', 
      JSON.stringify(contentHiVal), 
      slugHi, 
      hiStatus,
      contentType,
      externalUrlHiVal,
      thumbnailUrlVal,
      excerptHiVal,
      'hi',
      postGroupId
    ])
    
    logger.transaction('CREATE_DUAL_LANGUAGE_POST_SUCCESS', { 
      postGroupId: postGroupId, 
      userId: req.user.id,
      englishId: enResult.rows[0].id,
      hindiId: hiResult.rows[0].id
    })

    res.status(201).json({
      post_group_id: postGroupId,
      english: enResult.rows[0],
      hindi: hiResult.rows[0]
    })
  } catch (error) {
    logger.error('POSTS', 'Error creating dual-language post', error)
    res.status(500).json({ message: 'Failed to create posts', error: error.message })
  }
})

// Update dual-language post (updates both EN and HI posts)
router.put('/dual-language/:post_group_id', async (req, res) => {
  try {
    const { 
      // English fields
      title_en, excerpt_en, content_json_en, external_url_en, status_en,
      // Hindi fields  
      title_hi, excerpt_hi, content_json_hi, external_url_hi, status_hi,
      // Shared fields
      content_type, thumbnail_url, status 
    } = req.body

    // Support both old format (status) and new format (status_en/status_hi)
    const enStatus = status_en !== undefined ? status_en : status
    const hiStatus = status_hi !== undefined ? status_hi : status

    logger.transaction('UPDATE_DUAL_LANGUAGE_POST', { 
      postGroupId: req.params.post_group_id, 
      userId: req.user.id,
      status_en: enStatus,
      status_hi: hiStatus
    })

    // Check if posts exist and belong to user
    const checkQuery = 'SELECT id, language, thumbnail_url, excerpt, title FROM posts WHERE post_group_id = $1 AND user_id = $2'
    logger.db('SELECT', checkQuery, [req.params.post_group_id, req.user.id])
    const existingResult = await pool.query(checkQuery, [req.params.post_group_id, req.user.id])

    if (existingResult.rows.length === 0) {
      logger.warn('POSTS', 'Post group not found for update', { 
        postGroupId: req.params.post_group_id, 
        userId: req.user.id 
      })
      return res.status(404).json({ message: 'Post group not found' })
    }

    const existingEn = existingResult.rows.find(p => p.language === 'en')
    const existingHi = existingResult.rows.find(p => p.language === 'hi')

    const isLinkUpdate = content_type === 'link'

    // Validation for publishing English
    if (enStatus === 'published') {
      const finalTitleEn = title_en !== undefined ? title_en : existingEn?.title
      const finalExcerptEn = excerpt_en !== undefined ? excerpt_en : existingEn?.excerpt
      if (!finalTitleEn?.trim() || !finalExcerptEn?.trim()) {
        return res.status(400).json({ message: 'English title and excerpt required to publish' })
      }
      if (isLinkUpdate) {
        const finalUrlEn = external_url_en !== undefined ? external_url_en : null
        if (!finalUrlEn?.trim() || !isValidExternalUrl(finalUrlEn)) {
          return res.status(400).json({ message: 'Valid English URL required for link posts' })
        }
      } else if (content_json_en === undefined && !existingEn?.content_json) {
        return res.status(400).json({ message: 'English content required' })
      }
      const finalThumbnail = thumbnail_url !== undefined ? thumbnail_url : existingEn?.thumbnail_url
      if (!finalThumbnail?.trim()) {
        return res.status(400).json({ message: 'Thumbnail required to publish' })
      }
    }

    // Validation for publishing Hindi
    if (hiStatus === 'published') {
      const finalTitleHi = title_hi !== undefined ? title_hi : existingHi?.title
      const finalExcerptHi = excerpt_hi !== undefined ? excerpt_hi : existingHi?.excerpt
      if (!finalTitleHi?.trim() || !finalExcerptHi?.trim()) {
        return res.status(400).json({ message: 'Hindi title and excerpt required to publish' })
      }
      if (isLinkUpdate) {
        const finalUrlHi = external_url_hi !== undefined ? external_url_hi : null
        if (!finalUrlHi?.trim() || !isValidExternalUrl(finalUrlHi)) {
          return res.status(400).json({ message: 'Valid Hindi URL required for link posts' })
        }
      } else if (content_json_hi === undefined && !existingHi?.content_json) {
        return res.status(400).json({ message: 'Hindi content required' })
      }
      const finalThumbnail = thumbnail_url !== undefined ? thumbnail_url : existingHi?.thumbnail_url
      if (!finalThumbnail?.trim()) {
        return res.status(400).json({ message: 'Thumbnail required to publish' })
      }
    }

    // Update English post
    if (existingEn) {
      const updatesEn = []
      const valuesEn = []
      let paramCount = 1

      if (title_en !== undefined) {
        updatesEn.push(`title = $${paramCount++}`)
        valuesEn.push(title_en || 'Untitled')
        // Update slug if title changed
        const slugEn = slugify(title_en || 'untitled', { lower: true, strict: true }) + '-' + Date.now()
        updatesEn.push(`slug = $${paramCount++}`)
        valuesEn.push(slugEn)
      }

      if (content_json_en !== undefined) {
        updatesEn.push(`content_json = $${paramCount++}`)
        valuesEn.push(JSON.stringify(content_json_en))
      }

      if (enStatus !== undefined) {
        updatesEn.push(`status = $${paramCount++}`)
        valuesEn.push(enStatus)
      }

      if (content_type !== undefined) {
        updatesEn.push(`content_type = $${paramCount++}`)
        valuesEn.push(content_type)
      }

      if (external_url_en !== undefined) {
        updatesEn.push(`external_url = $${paramCount++}`)
        valuesEn.push(external_url_en?.trim() || null)
      }

      if (thumbnail_url !== undefined) {
        updatesEn.push(`thumbnail_url = $${paramCount++}`)
        valuesEn.push(thumbnail_url?.trim() || null)
      }

      if (excerpt_en !== undefined) {
        updatesEn.push(`excerpt = $${paramCount++}`)
        valuesEn.push(excerpt_en?.trim()?.slice(0, 500) || null)
      }

      if (updatesEn.length > 0) {
        updatesEn.push(`updated_at = NOW()`)
        valuesEn.push(existingEn.id)

        const updateQueryEn = `UPDATE posts SET ${updatesEn.join(', ')} WHERE id = $${paramCount} RETURNING *`
        logger.db('UPDATE', updateQueryEn, valuesEn)
        await pool.query(updateQueryEn, valuesEn)
      }
    }

    // Update Hindi post
    if (existingHi) {
      const updatesHi = []
      const valuesHi = []
      let paramCount = 1

      if (title_hi !== undefined) {
        updatesHi.push(`title = $${paramCount++}`)
        valuesHi.push(title_hi || 'शीर्षकहीन')
        // Update slug if title changed
        const slugHi = slugify(title_hi || 'untitled', { lower: true, strict: true }) + '-' + Date.now() + '-hi'
        updatesHi.push(`slug = $${paramCount++}`)
        valuesHi.push(slugHi)
      }

      if (content_json_hi !== undefined) {
        updatesHi.push(`content_json = $${paramCount++}`)
        valuesHi.push(JSON.stringify(content_json_hi))
      }

      if (hiStatus !== undefined) {
        updatesHi.push(`status = $${paramCount++}`)
        valuesHi.push(hiStatus)
      }

      if (content_type !== undefined) {
        updatesHi.push(`content_type = $${paramCount++}`)
        valuesHi.push(content_type)
      }

      if (external_url_hi !== undefined) {
        updatesHi.push(`external_url = $${paramCount++}`)
        valuesHi.push(external_url_hi?.trim() || null)
      }

      if (thumbnail_url !== undefined) {
        updatesHi.push(`thumbnail_url = $${paramCount++}`)
        valuesHi.push(thumbnail_url?.trim() || null)
      }

      if (excerpt_hi !== undefined) {
        updatesHi.push(`excerpt = $${paramCount++}`)
        valuesHi.push(excerpt_hi?.trim()?.slice(0, 500) || null)
      }

      if (updatesHi.length > 0) {
        updatesHi.push(`updated_at = NOW()`)
        valuesHi.push(existingHi.id)

        const updateQueryHi = `UPDATE posts SET ${updatesHi.join(', ')} WHERE id = $${paramCount} RETURNING *`
        logger.db('UPDATE', updateQueryHi, valuesHi)
        await pool.query(updateQueryHi, valuesHi)
      }
    }

    // Fetch updated posts
    const result = await pool.query('SELECT * FROM posts WHERE post_group_id = $1 AND user_id = $2 ORDER BY language', 
      [req.params.post_group_id, req.user.id])

    logger.transaction('UPDATE_DUAL_LANGUAGE_POST_SUCCESS', { 
      postGroupId: req.params.post_group_id, 
      userId: req.user.id 
    })

    res.json({
      post_group_id: req.params.post_group_id,
      english: result.rows.find(p => p.language === 'en') || null,
      hindi: result.rows.find(p => p.language === 'hi') || null
    })
  } catch (error) {
    logger.error('POSTS', 'Error updating dual-language post', error)
    res.status(500).json({ message: 'Failed to update posts', error: error.message })
  }
})

export default router
