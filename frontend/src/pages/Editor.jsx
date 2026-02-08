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
  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const autoSaveTimeoutRef = useRef(null)
  const isInitialLoadRef = useRef(true)
  const currentPostIdRef = useRef(id)

  useEffect(() => {
    currentPostIdRef.current = id
    if (id) {
      fetchPost()
    } else {
      setLoading(false)
    }
  }, [id])

  // Debounced auto-save function
  const handleAutoSave = useCallback(async () => {
    // Don't save if nothing has changed
    if (!title && !content) return
    // Don't save during initial load
    if (isInitialLoadRef.current) return

    try {
      setSaving(true)
      const postData = {
        title: title || 'Untitled',
        content_json: content || {},
        status: 'draft',
      }

      let postId = currentPostIdRef.current
      if (postId) {
        // Update existing post
        await api.put(`/posts/${postId}`, postData)
      } else {
        // Create new post
        const res = await api.post('/posts', postData)
        postId = res.data.id
        currentPostIdRef.current = postId
        // Update URL without reload
        window.history.replaceState({}, '', `/editor/${postId}`)
      }
    } catch (error) {
      console.error('Auto-save failed:', error)
      // Don't show error toast for auto-save failures to avoid annoying user
    } finally {
      setSaving(false)
    }
  }, [title, content])

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
  }, [title, content, handleAutoSave])

  const fetchPost = async () => {
    try {
      const res = await api.get(`/posts/${id}`)
      const post = res.data
      setTitle(post.title || '')
      setContent(post.content_json || null)
      setCreatedAt(post.created_at || null)
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

  const handlePublish = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }

    if (!content) {
      toast.error('Please add some content')
      return
    }

    try {
      setSaving(true)
      const postData = {
        title: title.trim(),
        content_json: content,
        status: 'published',
      }

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white shadow flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-700 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
            <div className="flex items-center space-x-4">
              {saving && (
                <span className="text-sm text-gray-500">Saving...</span>
              )}
              <button
                onClick={() => setShowPreview(!showPreview)}
                className={`p-2 rounded-md transition-colors ${
                  showPreview
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Toggle Mobile Preview"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </button>
              <button
                onClick={handlePublish}
                disabled={saving}
                className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Editor Section */}
        <div
          className={`flex-1 overflow-y-auto transition-all duration-300 ${
            showPreview ? 'mr-0' : ''
          }`}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <input
              type="text"
              placeholder="Enter post title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-3xl font-bold mb-6 p-2 border-0 border-b-2 border-gray-300 focus:outline-none focus:border-indigo-600 bg-transparent"
            />

            <Editor
              content={content}
              onChange={setContent}
            />
          </div>
        </div>

        {/* Mobile Preview Sidebar */}
        <div
          className={`bg-gray-100 border-l border-gray-300 transition-all duration-300 overflow-hidden ${
            showPreview ? 'w-[375px]' : 'w-0'
          }`}
        >
          {showPreview && (
            <div className="h-full p-4">
              <MobilePreview
                title={title}
                content={content}
                createdAt={createdAt}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
