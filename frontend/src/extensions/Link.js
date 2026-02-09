/**
 * Minimal Link mark for TipTap when @tiptap/extension-link is not installed.
 * Run: cd blog-editor/frontend && npm install
 * to use the full official extension instead.
 */
import { Mark, mergeAttributes } from '@tiptap/core'

function isAllowedUri(uri) {
  if (!uri || typeof uri !== 'string') return false
  const trimmed = uri.trim()
  return /^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)
}

export const Link = Mark.create({
  name: 'link',

  addOptions() {
    return {
      openOnClick: true,
      HTMLAttributes: {
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
      },
    }
  },

  addAttributes() {
    return {
      href: {
        default: null,
        parseHTML: (element) => element.getAttribute('href'),
        renderHTML: (attrs) => (attrs.href ? { href: attrs.href } : {}),
      },
      target: {
        default: this.options.HTMLAttributes?.target ?? '_blank',
      },
      rel: {
        default: this.options.HTMLAttributes?.rel ?? 'noopener noreferrer nofollow',
      },
      title: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'a[href]',
        getAttrs: (dom) => {
          const href = dom.getAttribute('href')
          if (!href || !isAllowedUri(href)) return false
          return null
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const href = HTMLAttributes.href
    if (!href || !isAllowedUri(href)) {
      return ['a', mergeAttributes(this.options.HTMLAttributes || {}, { ...HTMLAttributes, href: '' }), 0]
    }
    return ['a', mergeAttributes(this.options.HTMLAttributes || {}, HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setLink:
        (attributes) =>
        ({ chain }) => {
          const { href } = attributes || {}
          if (!href || !isAllowedUri(href)) return false
          return chain().setMark(this.name, attributes).run()
        },
      toggleLink:
        (attributes) =>
        ({ chain }) => {
          const href = attributes?.href
          if (href && !isAllowedUri(href)) return false
          return chain().toggleMark(this.name, attributes, { extendEmptyMarkRange: true }).run()
        },
      unsetLink:
        () =>
        ({ chain }) => {
          return chain().unsetMark(this.name, { extendEmptyMarkRange: true }).run()
        },
    }
  },
})
