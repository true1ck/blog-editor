import React from 'react'

/**
 * Renders TipTap JSON content as HTML matching Android styling
 */
export default function TipTapContentRenderer({ content }) {
  if (!content) return null

  const contentArray = content.content || (Array.isArray(content) ? content : [])

  return (
    <div>
      {contentArray.map((node, index) => (
        <RenderNode key={index} node={node} />
      ))}
    </div>
  )
}

function RenderNode({ node }) {
  if (!node || !node.type) return null

  const { type, attrs = {}, content = [], marks = [] } = node

  switch (type) {
    case 'paragraph':
      return (
        <ParagraphNode
          content={content}
          marks={marks}
          attrs={attrs}
        />
      )

    case 'heading':
      return (
        <HeadingNode
          level={attrs.level || 1}
          content={content}
          marks={marks}
        />
      )

    case 'bulletList':
      return (
        <BulletListNode content={content} />
      )

    case 'orderedList':
      return (
        <OrderedListNode content={content} />
      )

    case 'listItem':
      return (
        <ListItemNode content={content} marks={marks} />
      )

    case 'image':
      return (
        <ImageNode attrs={attrs} />
      )

    case 'blockquote':
      return (
        <BlockquoteNode content={content} marks={marks} />
      )

    case 'codeBlock':
      return (
        <CodeBlockNode content={content} />
      )

    case 'horizontalRule':
      return (
        <HorizontalRuleNode />
      )

    case 'hardBreak':
      return <br />

    case 'text':
      return (
        <TextNode text={node.text} marks={marks || []} />
      )

    default:
      // For unknown types, try to render content if available
      if (content && content.length > 0) {
        return (
          <div className="space-y-3">
            {content.map((childNode, index) => (
              <RenderNode key={index} node={childNode} />
            ))}
          </div>
        )
      }
      return null
  }
}

function ParagraphNode({ content, marks, attrs }) {
  const textAlign = attrs.textAlign || 'left'
  const textContent = extractTextFromNodes(content, marks)

  if (!textContent.trim()) return null

  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify'
  }[textAlign] || 'text-left'

  return (
    <p className={`${alignClass} mb-3 text-base leading-relaxed text-gray-900`}>
      {renderContent(content, marks)}
    </p>
  )
}

function HeadingNode({ level, content, marks }) {
  const textContent = extractTextFromNodes(content, marks)
  if (!textContent.trim()) return null

  const headingClasses = {
    1: 'text-3xl font-bold mb-4 mt-6',
    2: 'text-2xl font-bold mb-4 mt-6',
    3: 'text-xl font-bold mb-3 mt-5',
    4: 'text-lg font-bold mb-3 mt-4',
    5: 'text-base font-bold mb-2 mt-3',
    6: 'text-sm font-bold mb-2 mt-3'
  }

  const Tag = `h${level}`

  return (
    <Tag className={`${headingClasses[level] || headingClasses[3]} text-gray-900`}>
      {renderContent(content, marks)}
    </Tag>
  )
}

function BulletListNode({ content }) {
  return (
    <ul className="list-disc list-inside mb-3 space-y-1 ml-4">
      {content.map((item, index) => {
        if (item.type === 'listItem') {
          return (
            <li key={index} className="text-base text-gray-900">
              {renderContent(item.content || [], item.marks || [])}
            </li>
          )
        }
        return null
      })}
    </ul>
  )
}

function OrderedListNode({ content }) {
  return (
    <ol className="list-decimal list-inside mb-3 space-y-1 ml-4">
      {content.map((item, index) => {
        if (item.type === 'listItem') {
          return (
            <li key={index} className="text-base text-gray-900">
              {renderContent(item.content || [], item.marks || [])}
            </li>
          )
        }
        return null
      })}
    </ol>
  )
}

function ListItemNode({ content, marks }) {
  return (
    <div className="mb-1">
      {renderContent(content, marks)}
    </div>
  )
}

function ImageNode({ attrs }) {
  const { src, alt = '', title = null } = attrs

  if (!src) return null

  return (
    <div className="mb-4">
      <img
        src={src}
        alt={alt}
        className="w-full rounded-lg"
      />
      {title && (
        <p className="text-sm text-gray-500 text-center mt-2">
          {title}
        </p>
      )}
    </div>
  )
}

function BlockquoteNode({ content, marks }) {
  return (
    <blockquote className="border-l-4 border-indigo-500 pl-4 py-2 my-3 italic text-gray-700 bg-gray-50 rounded-r">
      {renderContent(content, marks)}
    </blockquote>
  )
}

function CodeBlockNode({ content }) {
  const code = extractTextFromNodes(content, [])
  
  return (
    <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-3">
      <code className="text-sm font-mono text-gray-800">
        {code}
      </code>
    </pre>
  )
}

function HorizontalRuleNode() {
  return (
    <hr className="my-4 border-gray-200 opacity-30" />
  )
}

function TextNode({ text, marks = [] }) {
  if (!text) return null

  let element = <span>{text}</span>

  // Apply marks in reverse order (inner to outer)
  const sortedMarks = [...marks].reverse()

  sortedMarks.forEach(mark => {
    if (!mark || !mark.type) return

    switch (mark.type) {
      case 'bold':
        element = <strong>{element}</strong>
        break
      case 'italic':
        element = <em>{element}</em>
        break
      case 'underline':
        element = <u>{element}</u>
        break
      case 'textStyle':
        const color = mark.attrs?.color
        const fontSize = mark.attrs?.fontSize
        const style = {}
        if (color) style.color = color
        if (fontSize) style.fontSize = fontSize
        element = <span style={style}>{element}</span>
        break
      case 'code':
        element = <code className="bg-gray-100 px-1 rounded text-sm font-mono">{element}</code>
        break
      default:
        break
    }
  })

  return element
}

function renderContent(content, parentMarks = []) {
  if (!content || !Array.isArray(content)) return null

  return (
    <>
      {content.map((node, index) => {
        if (node.type === 'text') {
          return <TextNode key={index} text={node.text} marks={node.marks || parentMarks} />
        } else {
          return <RenderNode key={index} node={node} />
        }
      })}
    </>
  )
}

function extractTextFromNodes(content, marks = []) {
  if (!content || !Array.isArray(content)) return ''

  return content.map(node => {
    if (node.type === 'text') {
      return node.text || ''
    } else if (node.content) {
      return extractTextFromNodes(node.content, node.marks || marks)
    }
    return ''
  }).join('')
}
