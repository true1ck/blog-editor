import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Editor from '../components/Editor'
import MobilePreview from '../components/MobilePreview'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function EditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState(null)
  const [createdAt, setCreatedAt] = useState(null)
  const [contentType, setContentType] = useState('tiptap') // 'tiptap' | 'link'
  const [externalUrl, setExternalUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const thumbnailInputRef = useRef(null)
  const [showPreview, setShowPreview] = useState(false)
  const autoSaveTimeoutRef = useRef(null)
  const isInitialLoadRef = useRef(true)
  const currentPostIdRef = useRef(id)
  const sessionIdRef = useRef(null)
  if (!id && !sessionIdRef.current) {
    sessionIdRef.current = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  useEffect(() => {
    currentPostIdRef.current = id
    if (id) {
      fetchPost()
    } else {
      setLoading(false)
    }
  }, [id])

  // Build post payload based on content type
  const buildPostData = useCallback((overrides = {}) => {
    const isLink = contentType === 'link'
    const base = {
      title: title?.trim() || 'Untitled',
      status: overrides.status ?? 'draft',
      thumbnail_url: thumbnailUrl?.trim() || null,
      excerpt: excerpt?.trim()?.slice(0, 250) || null,
    }
    if (isLink) {
      return {
        ...base,
        content_type: 'link',
        external_url: externalUrl.trim(),
        content_json: {},
        ...overrides,
      }
    }
    return {
      ...base,
      content_json: content || {},
      ...overrides,
    }
  }, [title, content, contentType, externalUrl, thumbnailUrl, excerpt])

  // Debounced auto-save function
  const handleAutoSave = useCallback(async () => {
    if (isInitialLoadRef.current) return
    const isLink = contentType === 'link'
    if (isLink) {
      if (!title?.trim() || !externalUrl?.trim()) return
    } else {
      if (!title && !content) return
    }

    try {
      setSaving(true)
      const postData = buildPostData({ status: 'draft' })

      let postId = currentPostIdRef.current
      if (postId) {
        await api.put(`/posts/${postId}`, postData)
      } else {
        const res = await api.post('/posts', postData)
        postId = res.data.id
        currentPostIdRef.current = postId
        window.history.replaceState({}, '', `/editor/${postId}`)
      }
    } catch (error) {
      console.error('Auto-save failed:', error)
    } finally {
      setSaving(false)
    }
  }, [title, content, contentType, externalUrl, buildPostData])

  // Debounced save on content change
  useEffect(() => {
    // Skip on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      return
    }

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Set new timeout for auto-save (2 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleAutoSave()
    }, 2000)

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [title, content, contentType, externalUrl, thumbnailUrl, excerpt, handleAutoSave])

  const fetchPost = async () => {
    try {
      const res = await api.get(`/posts/${id}`)
      const post = res.data
      setTitle(post.title || '')
      setContent(post.content_json || null)
      setCreatedAt(post.created_at || null)
      setContentType(post.content_type === 'link' ? 'link' : 'tiptap')
      setExternalUrl(post.external_url || '')
      setThumbnailUrl(post.thumbnail_url || '')
      setExcerpt(post.excerpt || '')
      isInitialLoadRef.current = true // Reset after loading
    } catch (error) {
      toast.error('Failed to load post')
      navigate('/dashboard')
    } finally {
      setLoading(false)
      // Allow saving after a short delay
      setTimeout(() => {
        isInitialLoadRef.current = false
      }, 500)
    }
  }

  const postIdForThumbnail = id || currentPostIdRef.current

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
      await api.put(`/posts/${postIdForThumbnail}`, buildPostData({ thumbnail_url: imageUrl }))
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
      api.put(`/posts/${postIdForThumbnail}`, { ...buildPostData(), thumbnail_url: null }).catch(() => {})
    }
  }

  const handlePublish = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }

    if (!thumbnailUrl?.trim()) {
      toast.error('Please add a post thumbnail before publishing')
      return
    }

    if (!excerpt?.trim()) {
      toast.error('Please add a list description before publishing')
      return
    }

    if (contentType === 'link') {
      const url = externalUrl.trim()
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        toast.error('Please enter a valid URL (http:// or https://)')
        return
      }
    } else {
      if (!content) {
        toast.error('Please add some content')
        return
      }
    }

    try {
      setSaving(true)
      const postData = buildPostData({ status: 'published' })

      let postId = currentPostIdRef.current || id
      if (postId) {
        await api.put(`/posts/${postId}`, postData)
      } else {
        const res = await api.post('/posts', postData)
        postId = res.data.id
      }

      toast.success('Post published!')
      navigate('/dashboard')
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
      {/* Top bar - responsive */}
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
          <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
            {/* Post type selector */}
            <div className="mb-4 flex gap-2">
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
            {/* Card-style editor block */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible">
              <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Title (required)</label>
                <input
                  type="text"
                  placeholder="Enter post title..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full text-xl sm:text-2xl font-bold p-2 border-0 border-b-2 border-transparent hover:border-gray-200 focus:outline-none focus:border-indigo-500 bg-transparent transition-colors"
                />
              </div>
              {/* Post thumbnail - below title, only when post exists */}
              <div className="px-4 sm:px-6 py-4 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Post thumbnail (required)</label>
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
              {/* Optional excerpt for list description */}
              <div className="px-4 sm:px-6 pb-4 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">List description (required)</label>
                <textarea
                  placeholder="Short description for the blog list (1–2 lines). Required for publishing."
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  rows={2}
                  maxLength={250}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm resize-none"
                />
                <p className="mt-1 text-xs text-gray-500">{excerpt.length}/250</p>
              </div>
              {contentType === 'link' ? (
                <div className="px-4 sm:px-6 pb-6">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">URL</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">The page readers will see when they open this post.</p>
                </div>
              ) : (
                <div className="px-2">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide px-2 sm:px-4 pt-4 pb-1">Content</label>
                  <Editor
                    content={content}
                    onChange={setContent}
                    postId={id || currentPostIdRef.current}
                    sessionId={!id ? sessionIdRef.current : null}
                  />
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Mobile Preview - sidebar on lg+, full-width panel on smaller screens */}
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
              {contentType === 'link' ? (
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">Link</span>
                  <p className="mt-2 font-semibold text-gray-900">{title || 'Untitled'}</p>
                  {externalUrl && (
                    <p className="mt-1 text-sm text-gray-500 break-all">Opens: {externalUrl}</p>
                  )}
                </div>
              ) : (
                <MobilePreview
                  title={title}
                  content={content}
                  createdAt={createdAt}
                />
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
