import { useState } from 'react'
import { BubbleMenu } from '@tiptap/react'

const SIZE_PRESETS = [
  { label: 'Original', width: null },
  { label: 'S', width: 200 },
  { label: 'M', width: 400 },
  { label: 'L', width: 600 },
  { label: 'Full', width: null },
]
const WIDTH_ONLY_PRESETS = [200, 400, 600]
const HEIGHT_ONLY_PRESETS = [200, 300, 400]

const ALIGN_OPTIONS = [
  { label: 'Left', value: 'left' },
  { label: 'Center', value: 'center' },
  { label: 'Right', value: 'right' },
]

export default function ImageBubbleMenu({
  editor,
  onReplaceClick,
  onAltTextClick,
  onCaptionClick,
}) {
  const [showAlignMenu, setShowAlignMenu] = useState(false)
  const [showSizeMenu, setShowSizeMenu] = useState(false)

  if (!editor) return null
  const currentAlign = editor.getAttributes('image').align

  const setSize = (width) => {
    if (width === null) {
      editor.chain().focus().updateAttributes('image', { width: null, height: null }).run()
    } else {
      const attrs = editor.getAttributes('image')
      let aspectRatio = 1
      if (attrs.width && attrs.height) {
        aspectRatio = attrs.height / attrs.width
      } else if (attrs.naturalWidth && attrs.naturalHeight) {
        aspectRatio = attrs.naturalHeight / attrs.naturalWidth
      }
      editor.chain().focus().updateAttributes('image', { width, height: Math.round(width * aspectRatio) }).run()
    }
    setShowSizeMenu(false)
  }

  const setWidthOnly = (width) => {
    editor.chain().focus().updateAttributes('image', { width, height: null }).run()
    setShowSizeMenu(false)
  }

  const setHeightOnly = (height) => {
    editor.chain().focus().updateAttributes('image', { width: null, height }).run()
    setShowSizeMenu(false)
  }

  const setAlign = (align) => {
    editor.chain().focus().updateAttributes('image', { align }).run()
    setShowAlignMenu(false)
  }

  const handleDelete = () => {
    // Run delete on mousedown so selection is still on the image (see Delete button below)
    let deleted = editor.chain().focus().deleteNode('image').run()
    if (!deleted && editor.isActive('image')) {
      // Fallback: find image node position from selection and delete by range
      const { state } = editor
      const { $from } = state.selection
      for (let d = $from.depth; d > 0; d--) {
        const node = $from.node(d)
        if (node.type.name === 'image') {
          const pos = $from.before(d)
          editor.chain().focus().setNodeSelection(pos).deleteSelection().run()
          break
        }
      }
    }
  }

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: ed }) => ed.isActive('image')}
      tippyOptions={{
        placement: 'top',
        duration: 100,
        interactive: true,
      }}
    >
      <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-lg shadow-lg">
        {/* Size presets */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowSizeMenu(!showSizeMenu)}
            className="px-2 py-1.5 text-sm rounded hover:bg-gray-100"
            title="Resize"
          >
            Size
          </button>
          {showSizeMenu && (
            <div className="absolute bottom-full left-0 mb-1 flex flex-col gap-1 p-1 bg-white border border-gray-200 rounded shadow-lg min-w-[120px]">
              <div className="text-xs text-gray-500 px-1 pb-0.5 border-b border-gray-100">Proportional</div>
              <div className="flex gap-1 flex-wrap">
                {SIZE_PRESETS.map(({ label, width }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSize(width)}
                    className="px-2 py-1 text-xs rounded hover:bg-gray-100"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-500 px-1 pt-1 pb-0.5 border-b border-gray-100">Width only</div>
              <div className="flex gap-1 flex-wrap">
                {WIDTH_ONLY_PRESETS.map((w) => (
                  <button
                    key={`w-${w}`}
                    type="button"
                    onClick={() => setWidthOnly(w)}
                    className="px-2 py-1 text-xs rounded hover:bg-gray-100"
                  >
                    {w}px
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-500 px-1 pt-1 pb-0.5">Height only</div>
              <div className="flex gap-1 flex-wrap">
                {HEIGHT_ONLY_PRESETS.map((h) => (
                  <button
                    key={`h-${h}`}
                    type="button"
                    onClick={() => setHeightOnly(h)}
                    className="px-2 py-1 text-xs rounded hover:bg-gray-100"
                  >
                    {h}px
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Align */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAlignMenu(!showAlignMenu)}
            className="px-2 py-1.5 text-sm rounded hover:bg-gray-100"
            title="Align"
          >
            Align
          </button>
          {showAlignMenu && (
            <div className="absolute bottom-full left-0 mb-1 flex gap-1 p-1 bg-white border border-gray-200 rounded shadow-lg">
              {ALIGN_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAlign(value)}
                  className={`px-2 py-1 text-xs rounded hover:bg-gray-100 ${currentAlign === value ? 'font-semibold bg-gray-100' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Alt text */}
        <button
          type="button"
          onClick={() => {
            onAltTextClick?.()
            setShowAlignMenu(false)
            setShowSizeMenu(false)
          }}
          className="px-2 py-1.5 text-sm rounded hover:bg-gray-100"
          title="Edit alt text"
        >
          Alt
        </button>

        {/* Caption */}
        {onCaptionClick && (
          <button
            type="button"
            onClick={() => {
              onCaptionClick?.()
              setShowAlignMenu(false)
              setShowSizeMenu(false)
            }}
            className="px-2 py-1.5 text-sm rounded hover:bg-gray-100"
            title="Edit caption"
          >
            Caption
          </button>
        )}

        {/* Replace */}
        <button
          type="button"
          onClick={() => {
            onReplaceClick?.()
            setShowAlignMenu(false)
            setShowSizeMenu(false)
          }}
          className="px-2 py-1.5 text-sm rounded hover:bg-gray-100"
          title="Replace image"
        >
          Replace
        </button>

        <div className="w-px h-5 bg-gray-200" />

        {/* Delete - use onMouseDown so selection stays on image before command runs */}
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            handleDelete()
          }}
          className="px-2 py-1.5 text-sm text-red-600 rounded hover:bg-red-50"
          title="Delete image"
        >
          Delete
        </button>
      </div>
    </BubbleMenu>
  )
}
