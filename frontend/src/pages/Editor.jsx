import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Editor from '../components/Editor'
import MobilePreview from '../components/MobilePreview'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function EditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  // Publish mode - what to publish when user clicks publish
  const [publishMode, setPublishMode] = useState('both') // 'en', 'hi', or 'both'
  
  // Dual-language state
  const [titleEn, setTitleEn] = useState('')
  const [titleHi, setTitleHi] = useState('')
  const [excerptEn, setExcerptEn] = useState('')
  const [excerptHi, setExcerptHi] = useState('')
  const [contentEn, setContentEn] = useState(null)
  const [contentHi, setContentHi] = useState(null)
  const [externalUrlEn, setExternalUrlEn] = useState('')
  const [externalUrlHi, setExternalUrlHi] = useState('')
  const [postGroupId, setPostGroupId] = useState(null)
  const [singlePostId, setSinglePostId] = useState(null) // For single-language posts
  
  // Shared state
  const [contentType, setContentType] = useState('tiptap') // 'tiptap' | 'link'
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [createdAt, setCreatedAt] = useState(null)
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const thumbnailInputRef = useRef(null)
  const [showPreview, setShowPreview] = useState(false)
  const autoSaveTimeoutRef = useRef(null)
  const isInitialLoadRef = useRef(true)
  const currentPostGroupIdRef = useRef(id)
  const sessionIdRef = useRef(null)
  
  if (!id && !sessionIdRef.current) {
    sessionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  useEffect(() => {
    currentPostGroupIdRef.current = id
    if (id) {
      fetchPost()
    } else {
      setLoading(false)
    }
  }, [id])

  // Build dual-language post payload
  const buildDualLanguageData = useCallback((options = {}) => {
    const { status_en, status_hi, ...overrides } = options
    const isLink = contentType === 'link'
    const data = {
      title_en: titleEn?.trim() || 'Untitled',
      title_hi: titleHi?.trim() || 'शीर्षकहीन',
      excerpt_en: excerptEn?.trim() || null,
      excerpt_hi: excerptHi?.trim() || null,
      content_json_en: isLink ? {} : (contentEn || {}),
      content_json_hi: isLink ? {} : (contentHi || {}),
      external_url_en: isLink ? externalUrlEn?.trim() : null,
      external_url_hi: isLink ? externalUrlHi?.trim() : null,
      content_type: contentType,
      thumbnail_url: thumbnailUrl?.trim() || null,
      ...overrides
    }
    // Only include status fields if explicitly provided
    if (status_en !== undefined) data.status_en = status_en
    if (status_hi !== undefined) data.status_hi = status_hi
    return data
  }, [titleEn, titleHi, excerptEn, excerptHi, contentEn, contentHi, 
      externalUrlEn, externalUrlHi, contentType, thumbnailUrl])

  // Fetch post (handles both single-language and dual-language)
  const fetchPost = async () => {
    try {
      // First try to fetch as post group (dual-language)
      let isGroupPost = false
      let data = null
      
      try {
        const res = await api.get(`/posts/group/${id}`)
        data = res.data
        isGroupPost = true
      } catch (groupError) {
        // Not a group post, will try single post
        isGroupPost = false
      }
      
      if (isGroupPost && data) {
        // Dual-language post
        setPostGroupId(data.post_group_id)
        
        // Load English version
        if (data.english) {
          setTitleEn(data.english.title || '')
          setExcerptEn(data.english.excerpt || '')
          setContentEn(data.english.content_json || null)
          setExternalUrlEn(data.english.external_url || '')
          setCreatedAt(data.english.created_at || null)
        }
        
        // Load Hindi version
        if (data.hindi) {
          setTitleHi(data.hindi.title || '')
          setExcerptHi(data.hindi.excerpt || '')
          setContentHi(data.hindi.content_json || null)
          setExternalUrlHi(data.hindi.external_url || '')
        }
        
        // Load shared fields
        const post = data.english || data.hindi
        if (post) {
          setContentType(post.content_type === 'link' ? 'link' : 'tiptap')
          setThumbnailUrl(post.thumbnail_url || '')
        }
        
        // Set publish mode based on which language(s) are PUBLISHED
        const enPublished = data.english?.status === 'published'
        const hiPublished = data.hindi?.status === 'published'
        
        if (enPublished && hiPublished) {
          setPublishMode('both')
        } else if (enPublished) {
          setPublishMode('en')
        } else if (hiPublished) {
          setPublishMode('hi')
        } else {
          // Neither published, default based on what data exists
          if (data.english && data.hindi) {
            setPublishMode('both')
          } else if (data.english) {
            setPublishMode('en')
          } else {
            setPublishMode('hi')
          }
        }
      } else {
        // Single-language post - try fetching by post ID
        const res = await api.get(`/posts/${id}`)
        const post = res.data
        
        setSinglePostId(post.id)
        
        const lang = post.language || 'en'
        
        // Load into appropriate language state
        if (lang === 'en') {
          setTitleEn(post.title || '')
          setExcerptEn(post.excerpt || '')
          setContentEn(post.content_json || null)
          setExternalUrlEn(post.external_url || '')
          setPublishMode('en')
        } else {
          setTitleHi(post.title || '')
          setExcerptHi(post.excerpt || '')
          setContentHi(post.content_json || null)
          setExternalUrlHi(post.external_url || '')
          setPublishMode('hi')
        }
        
        setContentType(post.content_type === 'link' ? 'link' : 'tiptap')
        setThumbnailUrl(post.thumbnail_url || '')
        setCreatedAt(post.created_at || null)
      }
      
      isInitialLoadRef.current = true
    } catch (error) {
      console.error('Error loading post:', error)
      toast.error('Failed to load post: ' + (error.response?.data?.message || error.message))
      navigate('/dashboard')
    } finally {
      setLoading(false)
      setTimeout(() => {
        isInitialLoadRef.current = false
      }, 500)
    }
  }


  // Debounced auto-save function - always saves all available data
  const handleAutoSave = useCallback(async () => {
    if (isInitialLoadRef.current) return
    
    const hasEnglishData = titleEn?.trim() || excerptEn?.trim() || 
      (contentType === 'link' ? externalUrlEn?.trim() : contentEn)
    const hasHindiData = titleHi?.trim() || excerptHi?.trim() || 
      (contentType === 'link' ? externalUrlHi?.trim() : contentHi)
    
    if (!hasEnglishData && !hasHindiData) return

    try {
      setSaving(true)
      
      // If we have data for both languages, use dual-language endpoint
      if (hasEnglishData && hasHindiData) {
        const postData = buildDualLanguageData({ status_en: 'draft', status_hi: 'draft' })
        let groupId = currentPostGroupIdRef.current || postGroupId
        
        if (groupId) {
          await api.put(`/posts/dual-language/${groupId}`, postData)
        } else {
          const res = await api.post('/posts/dual-language', postData)
          groupId = res.data.post_group_id
          currentPostGroupIdRef.current = groupId
          setPostGroupId(groupId)
          window.history.replaceState({}, '', `/editor/${groupId}`)
        }
      } else {
        // Only one language has data, use single-language endpoint
        const lang = hasEnglishData ? 'en' : 'hi'
        const postData = {
          title: lang === 'en' ? (titleEn?.trim() || 'Untitled') : (titleHi?.trim() || 'शीर्षकहीन'),
          excerpt: lang === 'en' ? (excerptEn?.trim() || null) : (excerptHi?.trim() || null),
          content_json: contentType === 'link' ? {} : (lang === 'en' ? (contentEn || {}) : (contentHi || {})),
          external_url: contentType === 'link' ? (lang === 'en' ? externalUrlEn?.trim() : externalUrlHi?.trim()) : null,
          content_type: contentType,
          thumbnail_url: thumbnailUrl?.trim() || null,
          language: lang,
          status: 'draft'
        }
        
        if (singlePostId) {
          await api.put(`/posts/${singlePostId}`, postData)
        } else {
          const res = await api.post('/posts', postData)
          setSinglePostId(res.data.id)
          window.history.replaceState({}, '', `/editor/${res.data.id}`)
        }
      }
    } catch (error) {
      console.error('Auto-save failed:', error)
    } finally {
      setSaving(false)
    }
  }, [titleEn, titleHi, excerptEn, excerptHi, contentEn, contentHi, 
      externalUrlEn, externalUrlHi, contentType, thumbnailUrl, postGroupId, singlePostId,
      buildDualLanguageData])

  // Debounced save on content change
  useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      return
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSave()
    }, 2000)

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [titleEn, titleHi, excerptEn, excerptHi, contentEn, contentHi, 
      externalUrlEn, externalUrlHi, contentType, thumbnailUrl, handleAutoSave])

  const postIdForThumbnail = singlePostId || id || currentPostGroupIdRef.current || postGroupId

  const handleThumbnailUpload = async (file) => {
    if (!file?.type?.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }
    if (!postIdForThumbnail) {
      toast.error('Save draft first to add a thumbnail')
      return
    }
    try {
      setUploadingThumbnail(true)
      toast.loading('Uploading thumbnail...', { id: 'thumbnail' })
      const res = await api.post('/upload/presigned-url', {
        filename: file.name,
        contentType: file.type,
        postId: postIdForThumbnail,
        purpose: 'thumbnail',
      })
      const { uploadUrl, imageUrl } = res.data
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!putRes.ok) {
        throw new Error('Upload failed')
      }
      setThumbnailUrl(imageUrl)
      
      // Update posts with new thumbnail
      if (postIdForThumbnail) {
        // Determine which endpoint to use based on what exists
        if (postGroupId) {
          const postData = buildDualLanguageData({ thumbnail_url: imageUrl })
          await api.put(`/posts/dual-language/${postGroupId}`, postData)
        } else if (singlePostId) {
          // Check if we have both languages now
          const hasEnglishData = titleEn?.trim() || excerptEn?.trim()
          const hasHindiData = titleHi?.trim() || excerptHi?.trim()
          
          if (hasEnglishData && hasHindiData) {
            const postData = buildDualLanguageData({ thumbnail_url: imageUrl, status_en: 'draft', status_hi: 'draft' })
            const res = await api.post('/posts/dual-language', postData)
            setPostGroupId(res.data.post_group_id)
            setSinglePostId(null)
          } else {
            const lang = hasEnglishData ? 'en' : 'hi'
            const postData = {
              title: lang === 'en' ? titleEn?.trim() : titleHi?.trim(),
              excerpt: lang === 'en' ? excerptEn?.trim() : excerptHi?.trim(),
              content_json: contentType === 'link' ? {} : (lang === 'en' ? (contentEn || {}) : (contentHi || {})),
              external_url: contentType === 'link' ? (lang === 'en' ? externalUrlEn?.trim() : externalUrlHi?.trim()) : null,
              content_type: contentType,
              thumbnail_url: imageUrl,
              language: lang
            }
            await api.put(`/posts/${singlePostId}`, postData)
          }
        }
      }
      
      toast.success('Thumbnail saved', { id: 'thumbnail' })
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to upload thumbnail', { id: 'thumbnail' })
    } finally {
      setUploadingThumbnail(false)
    }
  }

  const handleRemoveThumbnail = () => {
    setThumbnailUrl('')
    if (postIdForThumbnail) {
      if (postGroupId) {
        const postData = buildDualLanguageData({ thumbnail_url: null })
        api.put(`/posts/dual-language/${postGroupId}`, postData).catch(() => {})
      } else if (singlePostId) {
        const hasEnglishData = titleEn?.trim() || excerptEn?.trim()
        const hasHindiData = titleHi?.trim() || excerptHi?.trim()
        
        if (hasEnglishData && hasHindiData) {
          const postData = buildDualLanguageData({ thumbnail_url: null })
          api.put(`/posts/dual-language/${postGroupId}`, postData).catch(() => {})
        } else {
          const lang = hasEnglishData ? 'en' : 'hi'
          const postData = {
            title: lang === 'en' ? titleEn?.trim() : titleHi?.trim(),
            excerpt: lang === 'en' ? excerptEn?.trim() : excerptHi?.trim(),
            content_json: contentType === 'link' ? {} : (lang === 'en' ? (contentEn || {}) : (contentHi || {})),
            external_url: contentType === 'link' ? (lang === 'en' ? externalUrlEn?.trim() : externalUrlHi?.trim()) : null,
            content_type: contentType,
            thumbnail_url: null,
            language: lang
          }
          api.put(`/posts/${singlePostId}`, postData).catch(() => {})
        }
      }
    }
  }

  const handlePublish = async () => {
    if (!thumbnailUrl.trim()) {
      toast.error('Thumbnail is required to publish')
      return
    }

    // Validate based on publish mode
    if (publishMode === 'en' || publishMode === 'both') {
      // Validate English
      if (!titleEn.trim()) {
        toast.error('English title is required')
        return
      }
      if (!excerptEn.trim()) {
        toast.error('English excerpt is required')
        return
      }
      if (contentType === 'link' && !externalUrlEn.trim()) {
        toast.error('English URL is required for link posts')
        return
      }
      if (contentType === 'link') {
        const url = externalUrlEn.trim()
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          toast.error('English URL must start with http:// or https://')
          return
        }
      }
      if (contentType !== 'link' && !contentEn) {
        toast.error('English content is required')
        return
      }
    }
    
    if (publishMode === 'hi' || publishMode === 'both') {
      // Validate Hindi
      if (!titleHi.trim()) {
        toast.error('Hindi title is required')
        return
      }
      if (!excerptHi.trim()) {
        toast.error('Hindi excerpt is required')
        return
      }
      if (contentType === 'link' && !externalUrlHi.trim()) {
        toast.error('Hindi URL is required for link posts')
        return
      }
      if (contentType === 'link') {
        const url = externalUrlHi.trim()
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          toast.error('Hindi URL must start with http:// or https://')
          return
        }
      }
      if (contentType !== 'link' && !contentHi) {
        toast.error('Hindi content is required')
        return
      }
    }

    try {
      setSaving(true)
      
      // Check if we have content in both languages
      const hasEnglish = titleEn?.trim() || excerptEn?.trim() || contentEn || externalUrlEn?.trim()
      const hasHindi = titleHi?.trim() || excerptHi?.trim() || contentHi || externalUrlHi?.trim()
      
      // If we have both languages OR already have a postGroupId, use dual-language endpoint
      if ((hasEnglish && hasHindi) || postGroupId) {
        // Determine status for each language based on publishMode
        let enStatus = 'draft'
        let hiStatus = 'draft'
        
        if (publishMode === 'both') {
          enStatus = 'published'
          hiStatus = 'published'
        } else if (publishMode === 'en') {
          enStatus = 'published'
          hiStatus = 'draft'
        } else if (publishMode === 'hi') {
          enStatus = 'draft'
          hiStatus = 'published'
        }
        
        // Build data with appropriate statuses
        const postData = buildDualLanguageData({ status_en: enStatus, status_hi: hiStatus })
        
        // Only use PUT if we have a REAL post_group_id (not a single post ID)
        // The postGroupId state is only set when we have actual linked posts
        const actualGroupId = postGroupId || currentPostGroupIdRef.current
        
        if (actualGroupId && !singlePostId) {
          // We have a real post group ID - update it
          await api.put(`/posts/dual-language/${actualGroupId}`, postData)
        } else {
          // Creating new dual-language post or converting from single-language
          const res = await api.post('/posts/dual-language', postData)
          const newGroupId = res.data.post_group_id
          setPostGroupId(newGroupId)
          currentPostGroupIdRef.current = newGroupId
          setSinglePostId(null) // Clear single post ID since we now have a group
          window.history.replaceState({}, '', `/editor/${newGroupId}`)
        }
        
        if (publishMode === 'both') {
          toast.success('Posts published in both languages!')
        } else {
          toast.success(`${publishMode === 'en' ? 'English' : 'Hindi'} published! Other language saved as draft.`)
        }
      } else {
        // Single language only, no dual-language post exists
        const lang = publishMode
        const postData = {
          title: lang === 'en' ? titleEn?.trim() : titleHi?.trim(),
          excerpt: lang === 'en' ? excerptEn?.trim() : excerptHi?.trim(),
          content_json: contentType === 'link' ? {} : (lang === 'en' ? (contentEn || {}) : (contentHi || {})),
          external_url: contentType === 'link' ? (lang === 'en' ? externalUrlEn?.trim() : externalUrlHi?.trim()) : null,
          content_type: contentType,
          thumbnail_url: thumbnailUrl?.trim() || null,
          language: lang,
          status: 'published'
        }
        
        if (singlePostId) {
          await api.put(`/posts/${singlePostId}`, postData)
        } else {
          const res = await api.post('/posts', postData)
          setSinglePostId(res.data.id)
        }
        
        toast.success(`Post published in ${lang === 'en' ? 'English' : 'Hindi'}!`)
      }
      
      // Don't navigate immediately - let user see the success message
      setTimeout(() => navigate('/dashboard'), 1000)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to publish post')
    } finally {
      setSaving(false)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-2 min-h-14 py-2 sm:py-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-600 hover:text-gray-900 font-medium text-sm sm:text-base order-1"
            >
              <span className="hidden sm:inline">← Back to Dashboard</span>
              <span className="sm:hidden">← Back</span>
            </button>
            <div className="flex items-center gap-2 sm:gap-4 order-2 flex-shrink-0">
              {saving && (
                <span className="text-xs sm:text-sm text-amber-600 font-medium whitespace-nowrap">Saving...</span>
              )}
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  showPreview
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Toggle Mobile Preview"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Preview
              </button>
              <button
                onClick={handlePublish}
                disabled={saving}
                className="bg-indigo-600 text-white px-3 py-1.5 sm:px-5 sm:py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Main Editor Section */}
        <main className={`flex-1 overflow-y-auto transition-all duration-300 min-h-0 ${showPreview ? 'lg:border-r lg:border-gray-200' : ''}`}>
          <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
            {/* Publish mode selector and Post type selector */}
            <div className="mb-4 flex flex-wrap gap-2 items-center">
              {/* Publish Mode - What to publish */}
              <div className="flex items-center gap-2 mr-4">
                <label className="text-sm font-medium text-gray-700">Publish:</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPublishMode('en')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${
                      publishMode === 'en'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    English Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishMode('hi')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${
                      publishMode === 'hi'
                        ? 'bg-green-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Hindi Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setPublishMode('both')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${
                      publishMode === 'both'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Both Languages
                  </button>
                </div>
              </div>
              
              {/* Post type selector */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setContentType('tiptap')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    contentType === 'tiptap'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Article
                </button>
                <button
                  type="button"
                  onClick={() => setContentType('link')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    contentType === 'link'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Link
                </button>
              </div>
            </div>

            {/* Shared thumbnail section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Post thumbnail (required - shared by both languages)
              </label>
              {!postIdForThumbnail ? (
                <p className="text-sm text-gray-500 py-2">Save draft first to add a thumbnail. Required for publishing.</p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {thumbnailUrl ? (
                    <div className="relative flex-shrink-0">
                      <img src={thumbnailUrl} alt="Thumbnail" className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded-lg border border-gray-200" />
                      <button
                        type="button"
                        onClick={handleRemoveThumbnail}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                        aria-label="Remove thumbnail"
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleThumbnailUpload(f)
                        e.target.value = ''
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingThumbnail}
                      onClick={() => thumbnailInputRef.current?.click()}
                      className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {uploadingThumbnail ? 'Uploading…' : thumbnailUrl ? 'Change thumbnail' : 'Choose image'}
                    </button>
                    <p className="text-xs text-gray-500">Square image recommended. Required for publishing.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Conditional language layout based on publish mode */}
            <div className={`grid gap-4 ${publishMode === 'both' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
              {/* English Section - only show if publishMode is 'en' or 'both' */}
              {(publishMode === 'en' || publishMode === 'both') && (
              <div className={`bg-white rounded-xl shadow-sm border-2 overflow-visible ${
                publishMode === 'en' || publishMode === 'both' 
                  ? 'border-indigo-500 ring-2 ring-indigo-200' 
                  : 'border-gray-200 opacity-75'
              }`}>
                <div className={`px-4 py-3 border-b ${
                  publishMode === 'en' || publishMode === 'both'
                    ? 'bg-indigo-50 border-indigo-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-bold ${
                      publishMode === 'en' || publishMode === 'both'
                        ? 'text-indigo-700'
                        : 'text-gray-500'
                    }`}>
                      English
                    </h3>
                    {(publishMode === 'en' || publishMode === 'both') && (
                      <span className="text-xs bg-indigo-600 text-white px-2 py-1 rounded">
                        Will Publish
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Title (required)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter English title..."
                    value={titleEn}
                    onChange={(e) => setTitleEn(e.target.value)}
                    className="w-full text-xl font-bold p-2 border-0 border-b-2 border-transparent hover:border-gray-200 focus:outline-none focus:border-indigo-500 bg-transparent transition-colors mb-4"
                  />
                  
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    List description (required)
                  </label>
                  <textarea
                    placeholder="Short English description for blog list (1-2 lines)..."
                    value={excerptEn}
                    onChange={(e) => setExcerptEn(e.target.value)}
                    rows={2}
                    maxLength={250}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none mb-2"
                  />
                  <p className="text-xs text-gray-500 mb-4">{excerptEn.length}/250</p>
                  
                  {contentType === 'link' ? (
                    <>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        English URL (required)
                      </label>
                      <input
                        type="url"
                        placeholder="https://example.com/english-article"
                        value={externalUrlEn}
                        onChange={(e) => setExternalUrlEn(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <p className="mt-1 text-xs text-gray-500">English readers will see this URL.</p>
                    </>
                  ) : (
                    <>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Content (required)
                      </label>
                      <Editor
                        content={contentEn}
                        onChange={setContentEn}
                        postId={id || currentPostGroupIdRef.current}
                        sessionId={!id ? sessionIdRef.current + '-en' : null}
                      />
                    </>
                  )}
                </div>
              </div>
              )}
              
              {/* Hindi Section - only show if publishMode is 'hi' or 'both' */}
              {(publishMode === 'hi' || publishMode === 'both') && (
              <div className={`bg-white rounded-xl shadow-sm border-2 overflow-visible ${
                publishMode === 'hi' || publishMode === 'both'
                  ? 'border-green-500 ring-2 ring-green-200'
                  : 'border-gray-200 opacity-75'
              }`}>
                <div className={`px-4 py-3 border-b ${
                  publishMode === 'hi' || publishMode === 'both'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-bold ${
                      publishMode === 'hi' || publishMode === 'both'
                        ? 'text-green-700'
                        : 'text-gray-500'
                    }`}>
                      हिंदी (Hindi)
                    </h3>
                    {(publishMode === 'hi' || publishMode === 'both') && (
                      <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
                        Will Publish
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    शीर्षक / Title (required)
                  </label>
                  <input
                    type="text"
                    placeholder="हिंदी शीर्षक दर्ज करें..."
                    value={titleHi}
                    onChange={(e) => setTitleHi(e.target.value)}
                    className="w-full text-xl font-bold p-2 border-0 border-b-2 border-transparent hover:border-gray-200 focus:outline-none focus:border-green-500 bg-transparent transition-colors mb-4"
                  />
                  
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    विवरण / Description (required)
                  </label>
                  <textarea
                    placeholder="ब्लॉग सूची के लिए संक्षिप्त हिंदी विवरण (1-2 पंक्तियाँ)..."
                    value={excerptHi}
                    onChange={(e) => setExcerptHi(e.target.value)}
                    rows={2}
                    maxLength={250}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm resize-none mb-2"
                  />
                  <p className="text-xs text-gray-500 mb-4">{excerptHi.length}/250</p>
                  
                  {contentType === 'link' ? (
                    <>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Hindi URL (required)
                      </label>
                      <input
                        type="url"
                        placeholder="https://example.com/hindi-article"
                        value={externalUrlHi}
                        onChange={(e) => setExternalUrlHi(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                      <p className="mt-1 text-xs text-gray-500">Hindi readers will see this URL.</p>
                    </>
                  ) : (
                    <>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        सामग्री / Content (required)
                      </label>
                      <Editor
                        content={contentHi}
                        onChange={setContentHi}
                        postId={id || currentPostGroupIdRef.current}
                        sessionId={!id ? sessionIdRef.current + '-hi' : null}
                      />
                    </>
                  )}
                </div>
              </div>
              )}
            </div>
          </div>
        </main>

        {/* Mobile Preview */}
        {showPreview && (
          <aside className="bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-200 flex-shrink-0 w-full lg:w-[380px] flex flex-col lg:min-h-0 lg:max-h-full overflow-hidden">
            <div className="p-3 sm:p-4 overflow-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Mobile Preview</span>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="lg:hidden text-gray-500 hover:text-gray-700 p-1 rounded"
                  aria-label="Close preview"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Preview based on publish mode */}
              {publishMode === 'en' ? (
                /* English only preview */
                <div>
                  <div className="text-xs font-medium text-indigo-600 mb-2 flex items-center gap-2">
                    ENGLISH PREVIEW
                    <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded">Will Publish</span>
                  </div>
                  {contentType === 'link' ? (
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                      <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Link</span>
                      <p className="mt-2 font-semibold text-gray-900">{titleEn || 'Untitled'}</p>
                      {externalUrlEn && (
                        <p className="mt-1 text-sm text-gray-500 break-all">Opens: {externalUrlEn}</p>
                      )}
                    </div>
                  ) : (
                    <MobilePreview
                      title={titleEn}
                      content={contentEn}
                      createdAt={createdAt}
                    />
                  )}
                </div>
              ) : publishMode === 'hi' ? (
                /* Hindi only preview */
                <div>
                  <div className="text-xs font-medium text-green-600 mb-2 flex items-center gap-2">
                    HINDI PREVIEW
                    <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">Will Publish</span>
                  </div>
                  {contentType === 'link' ? (
                    <div className="rounded-lg border border-gray-200 bg-white p-4">
                      <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Link</span>
                      <p className="mt-2 font-semibold text-gray-900">{titleHi || 'शीर्षकहीन'}</p>
                      {externalUrlHi && (
                        <p className="mt-1 text-sm text-gray-500 break-all">Opens: {externalUrlHi}</p>
                      )}
                    </div>
                  ) : (
                    <MobilePreview
                      title={titleHi}
                      content={contentHi}
                      createdAt={createdAt}
                    />
                  )}
                </div>
              ) : (
                /* Both languages preview */
                <>
                  {/* Preview English version */}
                  <div className="mb-4">
                    <div className="text-xs font-medium text-indigo-600 mb-2 flex items-center gap-2">
                      ENGLISH PREVIEW
                      <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded">Will Publish</span>
                    </div>
                    {contentType === 'link' ? (
                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Link</span>
                        <p className="mt-2 font-semibold text-gray-900">{titleEn || 'Untitled'}</p>
                        {externalUrlEn && (
                          <p className="mt-1 text-sm text-gray-500 break-all">Opens: {externalUrlEn}</p>
                        )}
                      </div>
                    ) : (
                      <MobilePreview
                        title={titleEn}
                        content={contentEn}
                        createdAt={createdAt}
                      />
                    )}
                  </div>

                  {/* Preview Hindi version */}
                  <div>
                    <div className="text-xs font-medium text-green-600 mb-2 flex items-center gap-2">
                      HINDI PREVIEW
                      <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">Will Publish</span>
                    </div>
                    {contentType === 'link' ? (
                      <div className="rounded-lg border border-gray-200 bg-white p-4">
                        <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Link</span>
                        <p className="mt-2 font-semibold text-gray-900">{titleHi || 'शीर्षकहीन'}</p>
                        {externalUrlHi && (
                          <p className="mt-1 text-sm text-gray-500 break-all">Opens: {externalUrlHi}</p>
                        )}
                      </div>
                    ) : (
                      <MobilePreview
                        title={titleHi}
                        content={contentHi}
                        createdAt={createdAt}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
