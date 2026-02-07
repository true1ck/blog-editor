import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Underline from '@tiptap/extension-underline'
import { FontSize } from '../extensions/FontSize'
import api from '../utils/api'

export default function BlogPost() {
  const { slug } = useParams()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      TextStyle,
      Color,
      Underline,
      FontSize,
    ],
    content: null,
    editable: false,
    editorProps: {
      attributes: {
        class: 'ProseMirror',
      },
    },
  })

  useEffect(() => {
    fetchPost()
  }, [slug])

  useEffect(() => {
    if (post && editor) {
      editor.commands.setContent(post.content_json || {})
    }
  }, [post, editor])

  const fetchPost = async () => {
    try {
      const res = await api.get(`/posts/slug/${slug}`)
      setPost(res.data)
    } catch (error) {
      console.error('Failed to load post:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!post) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Post not found</h1>
          <p className="text-gray-600">The post you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{post.title}</h1>
          <div className="text-sm text-gray-500">
            Published on {new Date(post.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </header>

        <div className="bg-white rounded-lg shadow-sm p-8">
          {editor && <EditorContent editor={editor} />}
        </div>
      </article>
    </div>
  )
}
