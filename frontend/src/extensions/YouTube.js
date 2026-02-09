import { Node } from '@tiptap/core'

/**
 * Extract YouTube video ID from URL or return the string if it looks like a video ID.
 * Supports: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
 */
export function getYouTubeVideoId(urlOrId) {
  if (!urlOrId || typeof urlOrId !== 'string') return null
  const s = urlOrId.trim()
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  try {
    const url = s.startsWith('http') ? new URL(s) : new URL(`https://${s}`)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtube.com' || host === 'youtu.be') {
      if (host === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null
      if (url.pathname === '/watch' && url.searchParams.get('v')) return url.searchParams.get('v')
      const m = url.pathname.match(/^\/embed\/([a-zA-Z0-9_-]+)/)
      if (m) return m[1]
      return url.searchParams.get('v') || null
    }
  } catch (_) {}
  return null
}

export function getYouTubeEmbedUrl(videoId) {
  if (!videoId) return ''
  return `https://www.youtube.com/embed/${videoId}`
}

export const YouTube = Node.create({
  name: 'youtube',

  group: 'block',
  atom: true,

  addAttributes() {
    return {
      videoId: {
        default: null,
        parseHTML: (el) => {
          const iframe = el.querySelector?.('iframe')
          const src = iframe?.getAttribute('src') || el.getAttribute('data-youtube-src')
          if (src) {
            const m = src.match(/(?:embed\/|v=)([a-zA-Z0-9_-]{11})/)
            return m ? m[1] : null
          }
          return el.getAttribute('data-youtube-video-id') || null
        },
        renderHTML: (attrs) => {
          if (!attrs.videoId) return {}
          return { 'data-youtube-video-id': attrs.videoId }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-youtube-video-id]',
        getAttrs: (el) => ({ videoId: el.getAttribute('data-youtube-video-id') }),
      },
      {
        tag: 'iframe[src*="youtube.com/embed/"]',
        getAttrs: (el) => {
          const src = el.getAttribute('src') || ''
          const m = src.match(/(?:embed\/)([a-zA-Z0-9_-]{11})/)
          return m ? { videoId: m[1] } : false
        },
      },
    ]
  },

  renderHTML({ node }) {
    const id = node.attrs.videoId
    if (!id) return ['div', { class: 'youtube-placeholder' }, 'YouTube video']
    const src = getYouTubeEmbedUrl(id)
    return [
      'div',
      { class: 'youtube-embed-wrapper', 'data-youtube-video-id': id },
      ['iframe', { src, class: 'youtube-embed', width: '100%', height: '315', frameborder: '0', allowfullscreen: 'true', allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture' }],
    ]
  },

  addCommands() {
    return {
      setYoutubeVideo:
        (attrs) =>
        ({ commands }) => {
          const videoId = attrs.videoId || getYouTubeVideoId(attrs.src || attrs.url)
          if (!videoId) return false
          return commands.insertContent({ type: this.name, attrs: { videoId } })
        },
    }
  },

  addNodeView() {
    return ({ node, editor }) => {
      const div = document.createElement('div')
      div.className = 'youtube-node-view'
      div.setAttribute('data-youtube-video-id', node.attrs.videoId || '')

      const videoId = node.attrs.videoId
      if (videoId) {
        const iframe = document.createElement('iframe')
        iframe.src = getYouTubeEmbedUrl(videoId)
        iframe.className = 'youtube-embed'
        iframe.setAttribute('width', '100%')
        iframe.setAttribute('height', '315')
        iframe.setAttribute('frameborder', '0')
        iframe.setAttribute('allowfullscreen', 'true')
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture')
        iframe.setAttribute('title', 'YouTube video')
        iframe.style.display = 'block'
        iframe.style.minHeight = '220px'
        div.appendChild(iframe)
      } else {
        const placeholder = document.createElement('div')
        placeholder.className = 'youtube-placeholder-inner'
        placeholder.textContent = 'YouTube video (missing ID)'
        div.appendChild(placeholder)
      }

      return { dom: div }
    }
  },
})
