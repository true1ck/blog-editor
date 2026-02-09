import { useState, useEffect } from 'react'

export default function AltTextModal({
  isOpen,
  initialValue,
  onSave,
  onClose,
  title = 'Edit alt text',
  placeholder = 'Describe the image for accessibility',
}) {
  const [value, setValue] = useState(initialValue || '')

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue || '')
    }
  }, [isOpen, initialValue])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(value.trim())
    onClose()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alt-text-title"
      onKeyDown={handleKeyDown}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="alt-text-title" className="text-lg font-semibold mb-3">
          {title}
        </h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 rounded-lg hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
