import { useState } from 'react'
import api from '../utils/api'
import toast from 'react-hot-toast'

export default function MediaLibraryGrid({ items, onSelect, loading, onDeleted }) {
  const [deletingKey, setDeletingKey] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const handleDeleteClick = (e, item) => {
    e.stopPropagation()
    setConfirmDelete(item)
  }

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return
    const key = confirmDelete.key
    setConfirmDelete(null)
    setDeletingKey(key)
    try {
      await api.delete('/upload/media', { data: { key } })
      toast.success('Removed from storage')
      onDeleted?.()
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete')
    } finally {
      setDeletingKey(null)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-4 p-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="aspect-square bg-gray-200 rounded-lg animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <div className="text-4xl mb-2">🖼️</div>
        <p>No images yet.</p>
        <p className="text-sm">Upload in the Upload tab.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-4 gap-4 p-4 max-h-[320px] overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.key}
            className="group relative aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-indigo-500 focus-within:border-indigo-500 transition-colors"
          >
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="absolute inset-0 w-full h-full flex items-center justify-center"
              title="Click to insert"
            >
              <img
                src={item.url}
                alt={item.filename}
                className="w-full h-full object-cover block pointer-events-none"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
            </button>
            <button
              type="button"
              onClick={(e) => handleDeleteClick(e, item)}
              disabled={deletingKey === item.key}
              className="absolute top-1 right-1 p-1.5 rounded bg-red-500/90 hover:bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none disabled:opacity-50"
              title="Delete from storage"
              aria-label="Delete from storage"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      {confirmDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-medium text-gray-900">Remove from S3?</p>
            <p className="text-sm text-gray-600 mt-1">This cannot be undone.</p>
            <p className="text-sm text-amber-700 mt-2">This won&apos;t remove the image from the post content.</p>
            <div className="flex gap-2 mt-4 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
