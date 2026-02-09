import { useState } from 'react'

const Toolbar = ({ editor, onImageUpload, onUploadFile, onOpenMediaLibrary, postId, sessionId }) => {
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showFontSize, setShowFontSize] = useState(false)

  if (!editor) {
    return null
  }

  const colors = [
    '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB',
    '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  ]

  const fontSizes = ['12px', '14px', '16px', '18px', '20px', '24px', '32px']

  return (
    <div className="border-b border-gray-300 bg-gray-50 p-2 flex flex-wrap items-center gap-2">
      {/* Text Formatting */}
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('bold') ? 'bg-gray-300' : ''
          }`}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('italic') ? 'bg-gray-300' : ''
          }`}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('underline') ? 'bg-gray-300' : ''
          }`}
          title="Underline"
        >
          <u>U</u>
        </button>
      </div>

      {/* Headings */}
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('heading', { level: 1 }) ? 'bg-gray-300' : ''
          }`}
          title="Heading 1"
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('heading', { level: 2 }) ? 'bg-gray-300' : ''
          }`}
          title="Heading 2"
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('heading', { level: 3 }) ? 'bg-gray-300' : ''
          }`}
          title="Heading 3"
        >
          H3
        </button>
      </div>

      {/* Lists */}
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('bulletList') ? 'bg-gray-300' : ''
          }`}
          title="Bullet List"
        >
          •
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('orderedList') ? 'bg-gray-300' : ''
          }`}
          title="Numbered List"
        >
          1.
        </button>
      </div>

      {/* Quote & Code */}
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('blockquote') ? 'bg-gray-300' : ''
          }`}
          title="Quote"
        >
          "
        </button>
        <button
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('codeBlock') ? 'bg-gray-300' : ''
          }`}
          title="Code Block"
        >
          {'</>'}
        </button>
      </div>

      {/* Color Picker */}
      <div className="relative border-r border-gray-300 pr-2">
        <button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="p-2 rounded hover:bg-gray-200"
          title="Text Color"
        >
          🎨
        </button>
        {showColorPicker && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg p-2 z-10">
            <div className="grid grid-cols-5 gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    editor.chain().focus().setColor(color).run()
                    setShowColorPicker(false)
                  }}
                  className="w-6 h-6 rounded border border-gray-300"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Font Size */}
      <div className="relative border-r border-gray-300 pr-2">
        <button
          onClick={() => setShowFontSize(!showFontSize)}
          className="p-2 rounded hover:bg-gray-200"
          title="Font Size"
        >
          Aa
        </button>
        {showFontSize && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded shadow-lg p-2 z-10">
            {fontSizes.map((size) => (
              <button
                key={size}
                onClick={() => {
                  const sizeValue = parseInt(size.replace('px', ''))
                  editor.chain().focus().setFontSize(sizeValue).run()
                  setShowFontSize(false)
                }}
                className="block w-full text-left px-2 py-1 hover:bg-gray-100 rounded text-sm"
                style={{ fontSize: size }}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Media Library - Insert Image */}
      <div>
        <button
          type="button"
          onClick={() => onOpenMediaLibrary?.()}
          className={`p-2 rounded hover:bg-gray-200 ${
            editor.isActive('image') ? 'bg-gray-300' : ''
          }`}
          title="Insert Image (Media Library)"
        >
          🖼️
        </button>
      </div>
    </div>
  )
}

export default Toolbar
