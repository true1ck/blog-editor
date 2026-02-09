import { Extension } from '@tiptap/core'
import { Image } from '@tiptap/extension-image'

export const ImageResize = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute('width')
          return width ? parseInt(width, 10) : null
        },
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {}
          }
          return {
            width: attributes.width,
          }
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const height = element.getAttribute('height')
          return height ? parseInt(height, 10) : null
        },
        renderHTML: (attributes) => {
          if (!attributes.height) {
            return {}
          }
          return {
            height: attributes.height,
          }
        },
      },
      align: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-align') || null,
        renderHTML: (attributes) => {
          if (!attributes.align) return {}
          return { 'data-align': attributes.align }
        },
      },
      naturalWidth: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
      naturalHeight: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
    }
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor, selected }) => {
      const dom = document.createElement('div')
      dom.className = 'image-resize-wrapper'
      if (node.attrs.align) {
        dom.classList.add(`align-${node.attrs.align}`)
      }
      if (selected) {
        dom.classList.add('selected')
      }

      const placeholder = document.createElement('div')
      placeholder.className = 'image-resize-placeholder'
      placeholder.setAttribute('aria-hidden', 'true')
      const minHeight = node.attrs.height || node.attrs.naturalHeight || 120
      placeholder.style.minHeight = `${minHeight}px`

      const img = document.createElement('img')
      img.src = node.attrs.src
      img.alt = node.attrs.alt || ''
      img.draggable = false
      img.style.display = 'block'
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
      img.classList.add('image-resize-img')
      img.style.opacity = '0'
      img.style.transition = 'opacity 0.15s ease-out'

      const hidePlaceholder = () => {
        img.style.opacity = '1'
        if (placeholder.parentNode) placeholder.remove()
      }

      img.onload = () => {
        hidePlaceholder()
        if (typeof getPos !== 'function' || !editor) return
        const pos = getPos()
        if (pos == null) return
        const n = editor.state.doc.nodeAt(pos)
        if (!n || n.type.name !== 'image') return
        if (n.attrs.naturalWidth === img.naturalWidth && n.attrs.naturalHeight === img.naturalHeight) return
        editor.chain().focus().setNodeSelection(pos).updateAttributes('image', { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }).run()
      }
      img.onerror = hidePlaceholder
      if (img.complete) hidePlaceholder()

      if (node.attrs.width != null && node.attrs.height != null) {
        img.style.width = `${node.attrs.width}px`
        img.style.height = `${node.attrs.height}px`
      } else if (node.attrs.width != null) {
        img.style.width = `${node.attrs.width}px`
        img.style.height = 'auto'
      } else if (node.attrs.height != null) {
        img.style.width = 'auto'
        img.style.height = `${node.attrs.height}px`
      }

      // Resize handle - larger for easier use
      const resizeHandle = document.createElement('div')
      resizeHandle.className = 'resize-handle'
      resizeHandle.innerHTML = '↘'
      resizeHandle.style.display = selected ? 'flex' : 'none'
      resizeHandle.setAttribute('role', 'button')
      resizeHandle.setAttribute('aria-label', 'Resize image')

      let isResizing = false
      let startX = 0
      let startY = 0
      let startWidth = 0
      let startHeight = 0

      const updateResizeHandle = () => {
        if (selected && !dom.contains(resizeHandle)) {
          dom.appendChild(resizeHandle)
          resizeHandle.style.display = 'flex'
        } else if (!selected && dom.contains(resizeHandle)) {
          resizeHandle.style.display = 'none'
        }
        if (selected) {
          dom.classList.add('selected')
        } else {
          dom.classList.remove('selected')
        }
      }

      const startResize = (clientX, clientY) => {
        isResizing = true
        startX = clientX
        startY = clientY
        const rect = img.getBoundingClientRect()
        startWidth = rect.width
        startHeight = rect.height
      }

      const doResize = (clientX, clientY) => {
        if (!isResizing) return
        const deltaX = clientX - startX
        const aspectRatio = startHeight / startWidth
        const newWidth = Math.max(100, Math.min(1200, startWidth + deltaX))
        const newHeight = newWidth * aspectRatio
        img.style.width = `${newWidth}px`
        img.style.height = `${newHeight}px`
      }

      const endResize = () => {
        if (!isResizing) return
        isResizing = false
        const width = parseInt(img.style.width, 10)
        const height = parseInt(img.style.height, 10)
        if (typeof getPos === 'function' && editor) {
          editor.chain().focus().updateAttributes('image', { width, height }).run()
        }
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.removeEventListener('touchmove', handleTouchMove)
        document.removeEventListener('touchend', handleTouchEnd)
      }

      const handleMouseMove = (e) => doResize(e.clientX, e.clientY)
      const handleMouseUp = endResize
      const handleTouchMove = (e) => {
        if (e.touches.length) doResize(e.touches[0].clientX, e.touches[0].clientY)
      }
      const handleTouchEnd = endResize

      resizeHandle.addEventListener('mousedown', (e) => {
        startResize(e.clientX, e.clientY)
        e.preventDefault()
        e.stopPropagation()
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
      })
      resizeHandle.addEventListener('touchstart', (e) => {
        if (e.touches.length) {
          startResize(e.touches[0].clientX, e.touches[0].clientY)
          e.preventDefault()
          document.addEventListener('touchmove', handleTouchMove, { passive: false })
          document.addEventListener('touchend', handleTouchEnd)
        }
      }, { passive: false })

      dom.appendChild(placeholder)
      dom.appendChild(img)
      updateResizeHandle()

      // Update on selection change
      const updateSelection = () => {
        const { selection } = editor.state
        const pos = typeof getPos === 'function' ? getPos() : null
        if (pos !== null && pos !== undefined) {
          const isSelected = selection.from <= pos && selection.to >= pos + node.nodeSize
          if (isSelected !== selected) {
            if (isSelected) {
              dom.classList.add('selected')
              if (!dom.contains(resizeHandle)) {
                dom.appendChild(resizeHandle)
              }
              resizeHandle.style.display = 'flex'
            } else {
              dom.classList.remove('selected')
              resizeHandle.style.display = 'none'
            }
          }
        }
      }

      editor.on('selectionUpdate', updateSelection)

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'image') return false
          if (updatedNode.attrs.src !== node.attrs.src) {
            img.src = updatedNode.attrs.src
          }
          if (updatedNode.attrs.width !== node.attrs.width || updatedNode.attrs.height !== node.attrs.height) {
            if (updatedNode.attrs.width != null && updatedNode.attrs.height != null) {
              img.style.width = `${updatedNode.attrs.width}px`
              img.style.height = `${updatedNode.attrs.height}px`
            } else if (updatedNode.attrs.width != null) {
              img.style.width = `${updatedNode.attrs.width}px`
              img.style.height = 'auto'
            } else if (updatedNode.attrs.height != null) {
              img.style.width = 'auto'
              img.style.height = `${updatedNode.attrs.height}px`
            } else {
              img.style.width = ''
              img.style.height = 'auto'
            }
          }
          dom.classList.remove('align-left', 'align-center', 'align-right')
          if (updatedNode.attrs.align) {
            dom.classList.add(`align-${updatedNode.attrs.align}`)
          }
          node = updatedNode
          return true
        },
        destroy: () => {
          editor.off('selectionUpdate', updateSelection)
          document.removeEventListener('mousemove', handleMouseMove)
          document.removeEventListener('mouseup', handleMouseUp)
          document.removeEventListener('touchmove', handleTouchMove)
          document.removeEventListener('touchend', handleTouchEnd)
        },
      }
    }
  },
}).configure({
  inline: false,
  allowBase64: false,
})
