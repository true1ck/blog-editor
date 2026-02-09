import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'

const POPOVER_STYLE = 'absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-30'

const HEX_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/

const Toolbar = ({ editor, onImageUpload, onUploadFile, onOpenMediaLibrary, postId, sessionId }) => {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showFontSize, setShowFontSize] = useState(false)
  const [showYoutubeInput, setShowYoutubeInput] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [showLinkPopover, setShowLinkPopover] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [customHex, setCustomHex] = useState('')
  const customColorInputRef = useRef(null)
  const toolbarRef = useRef(null)

  if (!editor) {
    return null
  }

  const openColorPicker = () => {
    setShowFontSize(false)
    setShowYoutubeInput(false)
    setShowColorPicker((v) => !v)
  }
  const openFontSize = () => {
    setShowColorPicker(false)
    setShowYoutubeInput(false)
    setShowFontSize((v) => !v)
  }
  const openYoutubeInput = () => {
    setShowColorPicker(false)
    setShowFontSize(false)
    setShowLinkPopover(false)
    setShowYoutubeInput((v) => !v)
  }
  const openLinkPopover = () => {
    setShowColorPicker(false)
    setShowFontSize(false)
    setShowYoutubeInput(false)
    const prev = editor.getAttributes('link')?.href || ''
    setLinkUrl(prev)
    setShowLinkPopover((v) => !v)
  }
  const closeAllMenus = () => {
    setShowColorPicker(false)
    setShowFontSize(false)
    setShowYoutubeInput(false)
    setShowLinkPopover(false)
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        closeAllMenus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') closeAllMenus()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const presetColors = [
    '#000000', '#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#f3f4f6', '#ffffff',
    '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
    '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
  ]

  const applyColor = (color) => {
    let hex = color.startsWith('#') ? color : `#${color}`
    if (HEX_REGEX.test(hex)) {
      if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
      }
      editor.chain().focus().setColor(hex).run()
      setShowColorPicker(false)
      setCustomHex('')
    }
  }

  const openNativePicker = () => {
    customColorInputRef.current?.click()
  }

  const fontSizes = ['12px', '14px', '16px', '18px', '20px', '24px', '32px']

  return (
    <div
      ref={toolbarRef}
      className="sticky top-0 z-20 border-b border-gray-300 bg-gray-50 p-3 flex items-center gap-2 flex-wrap min-h-[72px]"
    >
      {/* Text Formatting */}
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2.5 rounded hover:bg-gray-200 ${
            editor.isActive('bold') ? 'bg-gray-300' : ''
          }`}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2.5 rounded hover:bg-gray-200 ${
            editor.isActive('italic') ? 'bg-gray-300' : ''
          }`}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2.5 rounded hover:bg-gray-200 ${
            editor.isActive('underline') ? 'bg-gray-300' : ''
          }`}
          title="Underline"
        >
          <u>U</u>
        </button>
        <button
          type="button"
          onClick={openLinkPopover}
          className={`p-2.5 rounded hover:bg-gray-200 ${
            editor.isActive('link') ? 'bg-gray-300' : ''
          }`}
          title="Insert link"
        >
          <span className="text-sm font-medium">Link</span>
        </button>
      </div>

      {/* Link popover */}
      {showLinkPopover && (
        <div className={`${POPOVER_STYLE} min-w-[280px] right-0 left-auto`}>
          <p className="text-sm font-medium text-gray-800 mb-2">Insert link</p>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
            autoFocus
          />
          <div className="flex gap-2 justify-end flex-wrap">
            {editor.isActive('link') && (
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().unsetLink().run()
                  setShowLinkPopover(false)
                  setLinkUrl('')
                  toast.success('Link removed')
                }}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-100"
              >
                Remove link
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (linkUrl.trim()) {
                  editor.chain().focus().setLink({ href: linkUrl.trim() }).run()
                  setShowLinkPopover(false)
                  setLinkUrl('')
                  toast.success('Link added')
                } else {
                  toast.error('Enter a URL')
                }
              }}
              className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Set link
            </button>
          </div>
        </div>
      )}

      {/* Headings */}
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2.5 rounded hover:bg-gray-200 ${
            editor.isActive('heading', { level: 1 }) ? 'bg-gray-300' : ''
          }`}
          title="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2.5 rounded hover:bg-gray-200 ${
            editor.isActive('heading', { level: 2 }) ? 'bg-gray-300' : ''
          }`}
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2.5 rounded hover:bg-gray-200 ${
            editor.isActive('heading', { level: 3 }) ? 'bg-gray-300' : ''
          }`}
          title="Heading 3"
        >
          H3
        </button>
      </div>

      {/* Lists */}
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2.5 rounded hover:bg-gray-200 ${
            editor.isActive('bulletList') ? 'bg-gray-300' : ''
          }`}
          title="Bullet List"
        >
          •
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2.5 rounded hover:bg-gray-200 ${
            editor.isActive('orderedList') ? 'bg-gray-300' : ''
          }`}
          title="Numbered List"
        >
          1.
        </button>
      </div>

      {/* Quote & Code */}
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2.5 rounded hover:bg-gray-200 ${
            editor.isActive('blockquote') ? 'bg-gray-300' : ''
          }`}
          title="Quote"
        >
          "
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2.5 rounded hover:bg-gray-200 ${
            editor.isActive('codeBlock') ? 'bg-gray-300' : ''
          }`}
          title="Code Block"
        >
          {'</>'}
        </button>
      </div>

      {/* Color Picker */}
      <div className="relative border-r border-gray-300 pr-2 flex-shrink-0">
        <button
          type="button"
          onClick={openColorPicker}
          className="p-2.5 rounded hover:bg-gray-200"
          title="Text Color"
        >
          🎨
        </button>
        {showColorPicker && (
          <div className={`${POPOVER_STYLE} min-w-[220px]`}>
            <p className="text-xs font-medium text-gray-700 mb-2">Text color</p>
            <div className="grid grid-cols-9 gap-1 mb-3">
              {presetColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => applyColor(color)}
                  className="w-6 h-6 rounded border border-gray-300 hover:ring-2 hover:ring-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                ref={customColorInputRef}
                type="color"
                className="sr-only w-0 h-0"
                tabIndex={-1}
                onChange={(e) => applyColor(e.target.value)}
              />
              <input
                type="text"
                value={customHex}
                onChange={(e) => setCustomHex(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyColor(customHex)}
                placeholder="#000000"
                className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                maxLength={7}
              />
              <button
                type="button"
                onClick={() => applyColor(customHex)}
                className="px-2 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
              >
                Apply
              </button>
            </div>
            <button
              type="button"
              onClick={openNativePicker}
              className="mt-2 w-full px-2 py-1.5 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Choose custom color…
            </button>
          </div>
        )}
      </div>

      {/* Font Size */}
      <div className="relative border-r border-gray-300 pr-2 flex-shrink-0">
        <button
          type="button"
          onClick={openFontSize}
          className="p-2.5 rounded hover:bg-gray-200"
          title="Font Size"
        >
          Aa
        </button>
        {showFontSize && (
          <div className={POPOVER_STYLE}>
            <p className="text-xs font-medium text-gray-600 mb-2">Font size</p>
            {fontSizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  const sizeValue = parseInt(size.replace('px', ''))
                  editor.chain().focus().setFontSize(sizeValue).run()
                  setShowFontSize(false)
                }}
                className="block w-full text-left px-2 py-1.5 hover:bg-gray-100 rounded text-sm"
                style={{ fontSize: size }}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Media Library - Insert Image */}
      <div className="flex-shrink-0">
        <button
          type="button"
          onClick={() => onOpenMediaLibrary?.()}
          className={`p-2.5 rounded hover:bg-gray-200 ${
            editor.isActive('image') ? 'bg-gray-300' : ''
          }`}
          title="Insert Image (Media Library)"
        >
          🖼️
        </button>
      </div>

      {/* YouTube */}
      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={openYoutubeInput}
          className={`p-2.5 rounded hover:bg-gray-200 ${
            editor.isActive('youtube') ? 'bg-gray-300' : ''
          }`}
          title="Insert YouTube video"
        >
          ▶️
        </button>
        {showYoutubeInput && (
          <div className={`${POPOVER_STYLE} min-w-[300px] right-0 left-auto`}>
            <p className="text-sm font-medium text-gray-800 mb-2">Insert YouTube video</p>
            <label htmlFor="toolbar-youtube-url" className="sr-only">
              YouTube URL or video ID
            </label>
            <input
              id="toolbar-youtube-url"
              type="url"
              inputMode="url"
              autoComplete="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=... or video ID"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-2"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const ok = editor.chain().focus().setYoutubeVideo({ src: youtubeUrl }).run()
                  if (ok) {
                    setShowYoutubeInput(false)
                    setYoutubeUrl('')
                    toast.success('YouTube video inserted')
                  } else {
                    toast.error('Invalid YouTube URL or video ID')
                  }
                }
              }}
            />
            <p className="text-xs text-gray-500 mb-3">
              Supports youtube.com/watch, youtu.be/..., or 11-character video ID
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowYoutubeInput(false); setYoutubeUrl('') }}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const ok = editor.chain().focus().setYoutubeVideo({ src: youtubeUrl }).run()
                  if (ok) {
                    setShowYoutubeInput(false)
                    setYoutubeUrl('')
                    toast.success('YouTube video inserted')
                  } else {
                    toast.error('Invalid YouTube URL or video ID')
                  }
                }}
                className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700"
              >
                Insert
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Toolbar
