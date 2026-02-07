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
      setPosts(res.data)
    } catch (error) {
      toast.error('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return

    try {
      await api.delete(`/posts/${id}`)
      toast.success('Post deleted')
      fetchPosts()
    } catch (error) {
      toast.error('Failed to delete post')
    }
  }

  const handlePublish = async (post) => {
    try {
      await api.put(`/posts/${post.id}`, {
        ...post,
        status: post.status === 'published' ? 'draft' : 'published'
      })
      toast.success(`Post ${post.status === 'published' ? 'unpublished' : 'published'}`)
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Blog Editor</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">{user?.phone_number || 'Guest'}</span>
              <Link
                to="/editor"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
              >
                New Post
              </Link>
              <button
                onClick={logout}
                className="text-gray-700 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Posts</h2>

        {posts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No posts yet. Create your first post!</p>
            <Link
              to="/editor"
              className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700"
            >
              Create Post
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {post.title || 'Untitled'}
                  </h3>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      post.status === 'published'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {post.status}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  {new Date(post.updated_at).toLocaleDateString()}
                </p>
                <div className="flex space-x-2">
                  <Link
                    to={`/editor/${post.id}`}
                    className="flex-1 text-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 text-sm"
                  >
                    Edit
                  </Link>
                  {post.status === 'published' && (
                    <Link
                      to={`/blog/${post.slug}`}
                      target="_blank"
                      className="flex-1 text-center bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300 text-sm"
                    >
                      View
                    </Link>
                  )}
                  <button
                    onClick={() => handlePublish(post)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                  >
                    {post.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                  <button
                    onClick={() => handleDelete(post.id)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
