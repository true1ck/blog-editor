import { useEditor, EditorContent } from '@tiptap/react'
import { useRef, useEffect } from 'react'
import StarterKit from '@tiptap/starter-kit'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Underline from '@tiptap/extension-underline'
import { FontSize } from '../extensions/FontSize'
import { ImageResize } from '../extensions/ImageResize'
import Toolbar from './Toolbar'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function Editor({ content, onChange, onImageUpload }) {
  const editorRef = useRef(null)

  const handleImageUpload = async (file) => {
    const editor = editorRef.current
    if (!editor) {
      toast.error('Editor not ready')
      return
    }

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file')
        return
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image size must be less than 10MB')
        return
      }

      toast.loading('Uploading image...', { id: 'image-upload' })

      // TEMPORARY: Use local upload for testing (REMOVE IN PRODUCTION)
      // TODO: Remove this and use S3 upload instead
      let imageUrl
      try {
        const formData = new FormData()
        formData.append('image', file)

        console.log('Uploading image locally (TEMPORARY):', {
          filename: file.name,
          size: file.size,
          type: file.type
        })

        const response = await api.post('/upload/local', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        })

        // Get full URL (backend serves images at /api/images/)
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001'
        imageUrl = `${baseUrl}${response.data.imageUrl}`

        console.log('Local upload successful:', {
          imageUrl,
          filename: response.data.filename
        })
      } catch (error) {
        console.error('Local upload failed:', error)
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          throw new Error('Cannot connect to server. Make sure the backend is running.')
        }
        if (error.response?.status === 401) {
          throw new Error('Authentication failed. Please login again.')
        }
        throw new Error(error.response?.data?.message || error.message || 'Failed to upload image')
      }

      /* ORIGINAL S3 UPLOAD CODE (COMMENTED OUT FOR TESTING)
      // Get presigned URL
      let data
      try {
        const response = await api.post('/upload/presigned-url', {
          filename: file.name,
          contentType: file.type,
        })
        data = response.data
      } catch (error) {
        console.error('Presigned URL request failed:', error)
        if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
          throw new Error('Cannot connect to server. Make sure the backend is running.')
        }
        if (error.response?.status === 401) {
          throw new Error('Authentication failed. Please login again.')
        }
        if (error.response?.status === 500) {
          throw new Error('Server error. Check if AWS S3 is configured correctly.')
        }
        throw error
      }

      // Upload to S3
      console.log('Uploading to S3:', {
        uploadUrl: data.uploadUrl.substring(0, 100) + '...',
        imageUrl: data.imageUrl,
        fileSize: file.size,
        contentType: file.type
      })

      let uploadResponse
      try {
        uploadResponse = await fetch(data.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          },
        })
      } catch (fetchError) {
        console.error('S3 upload fetch error:', fetchError)
        if (fetchError.message === 'Failed to fetch' || fetchError.name === 'TypeError') {
          throw new Error('Failed to connect to S3. This might be a CORS issue. Check your S3 bucket CORS configuration.')
        }
        throw fetchError
      }

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text().catch(() => 'Unknown error')
        console.error('S3 upload failed:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          error: errorText
        })
        throw new Error(`S3 upload failed: ${uploadResponse.status} ${uploadResponse.statusText}. ${errorText}`)
      }

      console.log('S3 upload successful:', {
        status: uploadResponse.status,
        imageUrl: data.imageUrl
      })

      // Insert image in editor
      const imageUrl = data.imageUrl
      */
      editor.chain().focus().setImage({ 
        src: imageUrl,
        alt: file.name,
      }).run()
      toast.success('Image uploaded successfully!', { id: 'image-upload' })

      if (onImageUpload) {
        onImageUpload(imageUrl)
      }
    } catch (error) {
      console.error('Image upload failed:', error)
      const errorMessage = error.response?.data?.message || 
                           error.message || 
                           'Failed to upload image. Please try again.'
      
      toast.error(errorMessage, { 
        id: 'image-upload',
        duration: 5000,
      })
      
      // Log detailed error for debugging
      if (error.response) {
        console.error('Error response:', error.response.data)
        console.error('Error status:', error.response.status)
      }
      if (error.request) {
        console.error('Request made but no response:', error.request)
      }
    }
  }

  const editor = useEditor({
    extensions: [
      StarterKit,
      ImageResize,
      TextStyle,
      Color,
      Underline,
      FontSize,
    ],
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
    },
    editorProps: {
      attributes: {
        class: 'ProseMirror',
      },
      handleDrop: (view, event, slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
          const file = event.dataTransfer.files[0]
          if (file.type.startsWith('image/')) {
            event.preventDefault()
            handleImageUpload(file)
            return true
          }
        }
        return false
      },
      handlePaste: (view, event, slice) => {
        const items = Array.from(event.clipboardData?.items || [])
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (file) {
              handleImageUpload(file)
            }
            return true
          }
        }
        return false
      },
    },
  })

  // Store editor reference
  useEffect(() => {
    if (editor) {
      editorRef.current = editor
    }
  }, [editor])

  if (!editor) {
    return null
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <Toolbar editor={editor} onImageUpload={handleImageUpload} />
      <EditorContent editor={editor} className="min-h-[400px] bg-white" />
    </div>
  )
}
