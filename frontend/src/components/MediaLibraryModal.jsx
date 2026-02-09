import { useState, useEffect, useCallback } from 'react'
import MediaUploadZone from './MediaUploadZone'
import MediaLibraryGrid from './MediaLibraryGrid'
import api from '../utils/api'
import toast from 'react-hot-toast'

const TABS = { UPLOAD: 'upload', LIBRARY: 'library' }

export default function MediaLibraryModal({
  isOpen,
  onClose,
  onInsertImage,
  postId,
  sessionId,
  onUploadFiles,
  mode = 'insert',
}) {
  const [activeTab, setActiveTab] = useState(TABS.UPLOAD)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const fetchMedia = useCallback(async () => {
    if (!postId && !sessionId) {
      setItems([])
      return
    }
    setLoading(true)
    try {
      const params = postId ? { postId } : { sessionId }
      const res = await api.get('/upload/media', { params })
      setItems(res.data.items || [])
    } catch (err) {
      console.error('Failed to fetch media:', err)
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [postId, sessionId])

  useEffect(() => {
    if (isOpen) {
      fetchMedia()
      setActiveTab(items.length > 0 ? TABS.LIBRARY : TABS.UPLOAD)
    }
  }, [isOpen, postId, sessionId])

  const handleUpload = async (files) => {
    if (!onUploadFiles || files.length === 0) return
    setUploading(true)
    try {
      for (const file of files) {
        await onUploadFiles(file) // called per file
      }
      toast.success(
        files.length === 1 ? 'Image uploaded!' : `${files.length} images uploaded!`
      )
      await fetchMedia()
      // Stay on Upload tab so user can add more files
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSelect = (item) => {
    onInsertImage?.(item.url, item.filename)
    onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-library-title"
      onKeyDown={handleKeyDown}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-[600px] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 id="media-library-title" className="text-lg font-semibold">
            Media Library
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-100 text-gray-600"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              type="button"
              onClick={() => setActiveTab(TABS.UPLOAD)}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === TABS.UPLOAD
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Upload
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(TABS.LIBRARY)}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === TABS.LIBRARY
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Library
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {mode === 'replace' && activeTab === TABS.LIBRARY && (
            <p className="px-4 py-2 text-sm text-indigo-700 bg-indigo-50 border-b border-indigo-100">
              Choose an image to replace the current one.
            </p>
          )}
          {activeTab === TABS.UPLOAD && (
            <div className="p-4">
              <MediaUploadZone
                onFilesSelected={handleUpload}
                uploading={uploading}
                disabled={!postId && !sessionId}
              />
              {!postId && !sessionId && (
                <p className="text-sm text-amber-600 mt-2">
                  Save your post first to upload images, or add content and wait for auto-save.
                </p>
              )}
            </div>
          )}
          {activeTab === TABS.LIBRARY && (
            <MediaLibraryGrid
              items={items}
              onSelect={handleSelect}
              loading={loading}
              onDeleted={fetchMedia}
            />
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
          Images are saved to this blog&apos;s folder.
        </div>
      </div>
    </div>
  )
}
