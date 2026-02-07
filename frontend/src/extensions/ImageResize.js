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
    }
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor, selected }) => {
      const dom = document.createElement('div')
      dom.className = 'image-resize-wrapper'
      if (selected) {
        dom.classList.add('selected')
      }

      const img = document.createElement('img')
      img.src = node.attrs.src
      img.alt = node.attrs.alt || ''
      img.draggable = false
      img.style.display = 'block'
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
      
      if (node.attrs.width) {
        img.style.width = `${node.attrs.width}px`
      }
      if (node.attrs.height) {
        img.style.height = `${node.attrs.height}px`
      }

      // Resize handle
      const resizeHandle = document.createElement('div')
      resizeHandle.className = 'resize-handle'
      resizeHandle.innerHTML = '↘'
      resizeHandle.style.display = selected ? 'flex' : 'none'

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

      resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true
        startX = e.clientX
        startY = e.clientY
        const rect = img.getBoundingClientRect()
        startWidth = rect.width
        startHeight = rect.height
        e.preventDefault()
        e.stopPropagation()
      })

      const handleMouseMove = (e) => {
        if (!isResizing) return
        
        const deltaX = e.clientX - startX
        const deltaY = e.clientY - startY
        const aspectRatio = startHeight / startWidth
        const newWidth = Math.max(100, Math.min(1200, startWidth + deltaX))
        const newHeight = newWidth * aspectRatio
        
        img.style.width = `${newWidth}px`
        img.style.height = `${newHeight}px`
      }

      const handleMouseUp = () => {
        if (!isResizing) return
        
        isResizing = false
        const width = parseInt(img.style.width, 10)
        const height = parseInt(img.style.height, 10)
        
        if (typeof getPos === 'function' && editor) {
          editor.chain().setImage({ width, height }).run()
        }
        
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)

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
          if (updatedNode.attrs.width !== node.attrs.width) {
            img.style.width = updatedNode.attrs.width ? `${updatedNode.attrs.width}px` : 'auto'
          }
          if (updatedNode.attrs.height !== node.attrs.height) {
            img.style.height = updatedNode.attrs.height ? `${updatedNode.attrs.height}px` : 'auto'
          }
          node = updatedNode
          return true
        },
        destroy: () => {
          editor.off('selectionUpdate', updateSelection)
          document.removeEventListener('mousemove', handleMouseMove)
          document.removeEventListener('mouseup', handleMouseUp)
        },
      }
    }
  },
}).configure({
  inline: false,
  allowBase64: false,
})
