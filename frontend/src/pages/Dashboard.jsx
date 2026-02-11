import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      const res = await api.get('/posts')
      // Group posts by post_group_id
      const grouped = {}
      res.data.forEach(post => {
        const groupId = post.post_group_id || post.id
        if (!grouped[groupId]) {
          grouped[groupId] = { en: null, hi: null, groupId }
        }
        if (post.language === 'en') grouped[groupId].en = post
        if (post.language === 'hi') grouped[groupId].hi = post
      })
      setPosts(Object.values(grouped))
    } catch (error) {
      toast.error('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (groupId, enId, hiId) => {
    if (!window.confirm('Are you sure you want to delete both language versions of this post?')) return

    try {
      // Delete both English and Hindi versions
      if (enId) await api.delete(`/posts/${enId}`)
      if (hiId) await api.delete(`/posts/${hiId}`)
      toast.success('Posts deleted')
      fetchPosts()
    } catch (error) {
      toast.error('Failed to delete posts')
    }
  }

  const handlePublish = async (postGroup) => {
    const post = postGroup.en || postGroup.hi
    if (!post) return

    const newStatus = post.status === 'published' ? 'draft' : 'published'
    
    try {
      // Update both posts via dual-language endpoint if they exist
      if (postGroup.en && postGroup.hi) {
        await api.put(`/posts/dual-language/${postGroup.groupId}`, {
          title_en: postGroup.en.title,
          title_hi: postGroup.hi.title,
          excerpt_en: postGroup.en.excerpt,
          excerpt_hi: postGroup.hi.excerpt,
          content_json_en: postGroup.en.content_json,
          content_json_hi: postGroup.hi.content_json,
          external_url_en: postGroup.en.external_url,
          external_url_hi: postGroup.hi.external_url,
          content_type: post.content_type,
          thumbnail_url: post.thumbnail_url,
          status: newStatus
        })
      } else {
        // Fallback for single language posts (legacy)
        const singlePost = postGroup.en || postGroup.hi
        await api.put(`/posts/${singlePost.id}`, {
          ...singlePost,
          status: newStatus
        })
      }
      toast.success(`Post ${newStatus === 'published' ? 'published' : 'unpublished'}`)
      fetchPosts()
    } catch (error) {
      toast.error('Failed to update post')
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 py-3 sm:py-0 sm:h-16 sm:flex-nowrap">
            <div className="flex items-center min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Blog Editor</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className="text-sm sm:text-base text-gray-700 truncate max-w-[140px] sm:max-w-none" title={user?.phone_number || 'Guest'}>
                {user?.phone_number || 'Guest'}
              </span>
              <Link
                to="/editor"
                className="bg-indigo-600 text-white px-3 py-2 sm:px-4 rounded-md hover:bg-indigo-700 text-sm font-medium whitespace-nowrap"
              >
                New Post
              </Link>
              <button
                onClick={logout}
                className="text-gray-700 hover:text-gray-900 text-sm sm:text-base px-2 py-1 rounded hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">Your Posts</h2>

        {posts.length === 0 ? (
          <div className="text-center py-8 sm:py-12 px-4">
            <p className="text-gray-500 mb-4 text-sm sm:text-base">No posts yet. Create your first post!</p>
            <Link
              to="/editor"
              className="inline-block bg-indigo-600 text-white px-5 py-2.5 sm:px-6 sm:py-3 rounded-md hover:bg-indigo-700 text-sm sm:text-base"
            >
              Create Post
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
            {posts.map((postGroup) => {
              const post = postGroup.en || postGroup.hi
              if (!post) return null
              
              return (
                <div key={postGroup.groupId} className="bg-white rounded-lg shadow p-4 sm:p-6 flex flex-col min-w-0">
                  {/* Display both language titles */}
                  <div className="mb-3 space-y-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={`px-2 py-1 text-xs rounded font-medium flex-shrink-0 ${
                        postGroup.en?.status === 'published' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        EN
                      </span>
                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 flex-1 min-w-0 break-words">
                        {postGroup.en?.title || 'No English version'}
                      </h3>
                    </div>
                    <div className="flex items-start gap-2 min-w-0">
                      <span className={`px-2 py-1 text-xs rounded font-medium flex-shrink-0 ${
                        postGroup.hi?.status === 'published' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        HI
                      </span>
                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-1 flex-1 min-w-0 break-words">
                        {postGroup.hi?.title || 'No Hindi version'}
                      </h3>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="space-y-2 mb-4">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      {post.content_type === 'link' && (
                        <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800 font-medium flex-shrink-0">
                          Link
                        </span>
                      )}
                      
                      {/* Show publish status for each language */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {postGroup.en && (
                          <span
                            className={`px-2 py-1 text-xs rounded font-medium whitespace-nowrap ${
                              postGroup.en.status === 'published'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                            title={`English: ${postGroup.en.status}`}
                          >
                            EN: {postGroup.en.status === 'published' ? '✓' : '○'}
                          </span>
                        )}
                        {postGroup.hi && (
                          <span
                            className={`px-2 py-1 text-xs rounded font-medium whitespace-nowrap ${
                              postGroup.hi.status === 'published'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                            title={`Hindi: ${postGroup.hi.status}`}
                          >
                            HI: {postGroup.hi.status === 'published' ? '✓' : '○'}
                          </span>
                        )}
                      </div>
                      
                      <span className="text-xs text-gray-500 ml-auto flex-shrink-0">
                        {new Date(post.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    
                    {/* Summary status message */}
                    <div className="text-xs font-medium min-w-0">
                      {(() => {
                        const enPublished = postGroup.en?.status === 'published'
                        const hiPublished = postGroup.hi?.status === 'published'
                        
                        if (enPublished && hiPublished) {
                          return <span className="text-green-700 inline-flex items-center gap-1"><span>📱</span><span className="truncate">Published in: <strong>Both Languages</strong></span></span>
                        } else if (enPublished) {
                          return <span className="text-indigo-700 inline-flex items-center gap-1"><span>📱</span><span className="truncate">Published in: <strong>English Only</strong></span></span>
                        } else if (hiPublished) {
                          return <span className="text-amber-700 inline-flex items-center gap-1"><span>📱</span><span className="truncate">Published in: <strong>Hindi Only</strong></span></span>
                        } else {
                          return <span className="text-gray-600 inline-flex items-center gap-1"><span>📝</span><span className="truncate">Draft - Not Published</span></span>
                        }
                      })()}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="space-y-2">
                    {/* Row 1: Edit button (full width) */}
                    <Link
                      to={`/editor/${postGroup.groupId}`}
                      className="block w-full text-center bg-indigo-600 text-white px-3 py-2 rounded-md hover:bg-indigo-700 text-sm font-medium"
                    >
                      Edit
                    </Link>
                    
                    {/* Row 2: View buttons (side by side if both exist) */}
                    {(postGroup.en?.status === 'published' || postGroup.hi?.status === 'published') && (
                      <div className="grid grid-cols-2 gap-2">
                        {/* View EN button - only show if English is published */}
                        {postGroup.en?.status === 'published' && (
                          post.content_type === 'link' && postGroup.en.external_url ? (
                            <a
                              href={postGroup.en.external_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-center bg-indigo-100 text-indigo-700 px-3 py-2 rounded-md hover:bg-indigo-200 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis ${
                                !postGroup.hi || postGroup.hi.status !== 'published' ? 'col-span-2' : ''
                              }`}
                            >
                              View EN
                            </a>
                          ) : (
                            <Link
                              to={`/blog/${postGroup.en.slug}`}
                              target="_blank"
                              className={`text-center bg-indigo-100 text-indigo-700 px-3 py-2 rounded-md hover:bg-indigo-200 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis ${
                                !postGroup.hi || postGroup.hi.status !== 'published' ? 'col-span-2' : ''
                              }`}
                            >
                              View EN
                            </Link>
                          )
                        )}
                        
                        {/* View HI button - only show if Hindi is published */}
                        {postGroup.hi?.status === 'published' && (
                          post.content_type === 'link' && postGroup.hi.external_url ? (
                            <a
                              href={postGroup.hi.external_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`text-center bg-green-100 text-green-700 px-3 py-2 rounded-md hover:bg-green-200 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis ${
                                !postGroup.en || postGroup.en.status !== 'published' ? 'col-span-2' : ''
                              }`}
                            >
                              View HI
                            </a>
                          ) : (
                            <Link
                              to={`/blog/${postGroup.hi.slug}`}
                              target="_blank"
                              className={`text-center bg-green-100 text-green-700 px-3 py-2 rounded-md hover:bg-green-200 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis ${
                                !postGroup.en || postGroup.en.status !== 'published' ? 'col-span-2' : ''
                              }`}
                            >
                              View HI
                            </Link>
                          )
                        )}
                      </div>
                    )}
                    
                    {/* Row 3: Publish and Delete buttons (side by side) */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handlePublish(postGroup)}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis"
                      >
                        {post.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => handleDelete(postGroup.groupId, postGroup.en?.id, postGroup.hi?.id)}
                        className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
