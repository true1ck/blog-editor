import { useEditor, EditorContent } from '@tiptap/react'
import { useRef, useEffect, useCallback, useState } from 'react'
import StarterKit from '@tiptap/starter-kit'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Underline from '@tiptap/extension-underline'
import { FontSize } from '../extensions/FontSize'
import { ImageResize } from '../extensions/ImageResize'
import Toolbar from './Toolbar'
import ImageBubbleMenu from './ImageBubbleMenu'
import MediaLibraryModal from './MediaLibraryModal'
import AltTextModal from './AltTextModal'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function Editor({ content, onChange, onImageUpload, postId, sessionId }) {
  const editorRef = useRef(null)
  const [showMediaModal, setShowMediaModal] = useState(false)
  const [mediaModalMode, setMediaModalMode] = useState('insert')
  const [showAltModal, setShowAltModal] = useState(false)
  const [showCaptionModal, setShowCaptionModal] = useState(false)

  const performUpload = useCallback(async (file, options = {}) => {
    const { insert = true } = options
    const editor = editorRef.current
    if (insert && !editor) {
      throw new Error('Editor not ready')
    }
    if (!file.type.startsWith('image/')) {
      throw new Error('Please select an image file')
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Image size must be less than 10MB')
    }

    const response = await api.post('/upload/presigned-url', {
      filename: file.name,
      contentType: file.type,
      postId: postId || undefined,
      sessionId: sessionId || undefined,
    })
    const data = response.data

    const uploadResponse = await fetch(data.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    })
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => 'Unknown error')
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`)
    }

    const imageUrl = data.imageUrl
    if (insert && editor) {
      editor.chain().focus().setImage({ src: imageUrl, alt: file.name }).run()
      if (onImageUpload) onImageUpload(imageUrl)
    }
    return imageUrl
  }, [postId, sessionId, onImageUpload])

  const handleImageUpload = useCallback(async (file) => {
    try {
      toast.loading('Uploading image...', { id: 'image-upload' })
      await performUpload(file, { insert: true })
      toast.success('Image uploaded successfully!', { id: 'image-upload' })
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'Failed to upload image.'
      toast.error(msg, { id: 'image-upload', duration: 5000 })
      throw error
    }
  }, [performUpload])

  const uploadFileOnly = useCallback(async (file) => {
    return performUpload(file, { insert: false })
  }, [performUpload])

  const insertImage = useCallback((url, alt = '') => {
    const editor = editorRef.current
    if (editor) {
      editor.chain().focus().setImage({ src: url, alt }).run()
    }
  }, [])

  const replaceImage = useCallback((url, alt = '') => {
    const editor = editorRef.current
    if (editor && editor.isActive('image')) {
      editor.chain().focus().updateAttributes('image', { src: url, alt }).run()
    }
  }, [])

  const handleMediaSelect = useCallback((url, alt) => {
    if (mediaModalMode === 'replace') {
      replaceImage(url, alt)
      toast.success('Image replaced')
    } else {
      insertImage(url, alt)
    }
    setShowMediaModal(false)
  }, [mediaModalMode, replaceImage, insertImage])

  const handleAltTextSave = useCallback((alt) => {
    const editor = editorRef.current
    if (editor && editor.isActive('image')) {
      editor.chain().focus().updateAttributes('image', { alt }).run()
      toast.success('Alt text updated')
    }
    setShowAltModal(false)
  }, [])

  const getCurrentAlt = useCallback(() => {
    const editor = editorRef.current
    return editor?.isActive('image') ? editor.getAttributes('image').alt || '' : ''
  }, [])

  const handleCaptionSave = useCallback((title) => {
    const editor = editorRef.current
    if (editor && editor.isActive('image')) {
      editor.chain().focus().updateAttributes('image', { title: title || null }).run()
      toast.success('Caption updated')
    }
    setShowCaptionModal(false)
  }, [])

  const getCurrentTitle = useCallback(() => {
    const editor = editorRef.current
    return editor?.isActive('image') ? editor.getAttributes('image').title || '' : ''
  }, [])

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

  // Update editor content when content prop changes
  useEffect(() => {
    if (editor && content !== undefined) {
      const currentContent = editor.getJSON()
      // Only update if content is actually different to avoid infinite loops
      if (JSON.stringify(currentContent) !== JSON.stringify(content)) {
        editor.commands.setContent(content || '')
      }
    }
  }, [content, editor])

  if (!editor) {
    return null
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <Toolbar
        editor={editor}
        onImageUpload={handleImageUpload}
        onUploadFile={uploadFileOnly}
        onOpenMediaLibrary={() => {
          setMediaModalMode('insert')
          setShowMediaModal(true)
        }}
        postId={postId}
        sessionId={sessionId}
      />
      <EditorContent editor={editor} className="min-h-[400px] bg-white" />
      <ImageBubbleMenu
        editor={editor}
        onReplaceClick={() => {
          setMediaModalMode('replace')
          setShowMediaModal(true)
        }}
        onAltTextClick={() => setShowAltModal(true)}
        onCaptionClick={() => setShowCaptionModal(true)}
      />
      <MediaLibraryModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onInsertImage={handleMediaSelect}
        postId={postId}
        sessionId={sessionId}
        onUploadFiles={uploadFileOnly}
        mode={mediaModalMode}
      />
      <AltTextModal
        isOpen={showAltModal}
        initialValue={getCurrentAlt()}
        onSave={handleAltTextSave}
        onClose={() => setShowAltModal(false)}
      />
      <AltTextModal
        isOpen={showCaptionModal}
        initialValue={getCurrentTitle()}
        onSave={handleCaptionSave}
        onClose={() => setShowCaptionModal(false)}
        title="Edit caption"
        placeholder="Caption (shown below image)"
      />
    </div>
  )
}
