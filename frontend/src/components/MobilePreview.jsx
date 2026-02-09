import React from 'react'
import TipTapContentRenderer from './TipTapContentRenderer'

/**
 * Mobile preview component that displays blog post exactly as it appears in Android app
 * Matches BlogDetailScreen layout and styling
 */
export default function MobilePreview({ title, content, createdAt }) {
  // Format date to match Android format: "MMM dd, yyyy" (e.g., "Feb 08, 2026")
  const formatDate = (dateString) => {
    if (!dateString) {
      // Use current date if no date provided
      const now = new Date()
      const month = now.toLocaleDateString('en-US', { month: 'short' })
      const day = now.getDate().toString().padStart(2, '0')
      const year = now.getFullYear()
      return `${month} ${day}, ${year}`
    }

    try {
      const date = new Date(dateString)
      const month = date.toLocaleDateString('en-US', { month: 'short' })
      const day = date.getDate().toString().padStart(2, '0')
      const year = date.getFullYear()
      return `${month} ${day}, ${year}`
    } catch (e) {
      const now = new Date()
      const month = now.toLocaleDateString('en-US', { month: 'short' })
      const day = now.getDate().toString().padStart(2, '0')
      const year = now.getFullYear()
      return `${month} ${day}, ${year}`
    }
  }

  const formattedDate = formatDate(createdAt)

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Phone Frame */}
      <div className="flex-1 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden border border-gray-300">
        {/* Simulated Top App Bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
          <div className="w-6 h-6 flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Blog Post</h2>
        </div>

        {/* Scrollable Content Area - layout matches Android BlogDetailScreen (see blog layout spec) */}
        <div className="flex-1 overflow-y-auto">
          {/* Header: 16px horizontal, 24px vertical; 12px gap between title and date */}
          <div className="px-4 pt-6 pb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-3 leading-tight">
              {title || 'Untitled Post'}
            </h1>
            <p className="text-sm text-gray-600">
              {formattedDate}
            </p>
          </div>

          {/* Divider */}
          <div className="px-4">
            <hr className="border-gray-200" />
          </div>

          {/* Content: 16px horizontal only, 24px gap after divider */}
          <div className="px-4 pt-6">
            {content ? (
              <TipTapContentRenderer content={content} />
            ) : (
              <p className="text-base text-gray-500 italic">
                Start typing to see preview...
              </p>
            )}
          </div>

          {/* Bottom padding for scroll (32px) */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  )
}
