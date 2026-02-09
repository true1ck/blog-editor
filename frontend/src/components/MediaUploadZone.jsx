import { useCallback } from 'react'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

function validateFile(file) {
  if (!file.type.startsWith('image/') || !ACCEPTED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Please select a valid image (JPEG, PNG, GIF, or WebP)' }
  }
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'Image must be less than 10MB' }
  }
  return { valid: true }
}

export default function MediaUploadZone({ onFilesSelected, uploading, disabled }) {
  const handleFiles = useCallback(
    (files) => {
      const fileList = Array.from(files || []).filter((f) => f.type.startsWith('image/'))
      const validFiles = []
      const errors = []
      fileList.forEach((file) => {
        const { valid, error } = validateFile(file)
        if (valid) validFiles.push(file)
        else if (error) errors.push(`${file.name}: ${error}`)
      })
      if (errors.length) {
        console.warn('Media upload validation:', errors)
      }
      if (validFiles.length) {
        onFilesSelected(validFiles)
      }
    },
    [onFilesSelected]
  )

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled || uploading) return
    handleFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleChange = (e) => {
    handleFiles(e.target.files)
    e.target.value = ''
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className={`
        border-2 border-dashed rounded-lg p-8 text-center transition-colors
        ${disabled || uploading ? 'bg-gray-50 border-gray-200 cursor-not-allowed' : 'border-gray-300 hover:border-indigo-500 hover:bg-indigo-50/50 cursor-pointer'}
      `}
    >
      <input
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleChange}
        disabled={disabled || uploading}
        multiple
        className="hidden"
        id="media-upload-input"
      />
      <label
        htmlFor="media-upload-input"
        className={`block cursor-pointer ${disabled || uploading ? 'cursor-not-allowed pointer-events-none' : ''}`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600">Uploading...</span>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-2">📤</div>
            <p className="text-gray-700 font-medium">Drag images here or click to browse</p>
            <p className="text-sm text-gray-500 mt-1">JPEG, PNG, GIF, WebP — max 10MB each</p>
          </>
        )}
      </label>
    </div>
  )
}
