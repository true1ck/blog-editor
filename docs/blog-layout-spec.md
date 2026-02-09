# Blog post layout spec

This document defines the shared layout and spacing for the blog post detail screen so that the **blog-editor mobile preview** and the **Android app** (BlogDetailScreen) match exactly.

## Values (single source of truth)

| Element | Web (Tailwind) | Android (Compose) | Notes |
|--------|----------------|-------------------|--------|
| Screen horizontal padding | `px-4` (16px) | `16.dp` | Gutter for title, date, divider, body |
| Header block vertical padding | `py-6` (24px) | `24.dp` | Top and bottom of header block |
| Gap between title and date | `mb-3` (12px) | `12.dp` | |
| Divider | Full width, `px-4` inset | `padding(horizontal = 16.dp)` | |
| Gap between divider and content | `pt-6` (24px) | `24.dp` | |
| Content block vertical padding | 0 top, 0 bottom | None | Only horizontal padding on content |
| Paragraph / block spacing | `mb-3` (12px) | `12.dp` | Between paragraphs and after blocks |
| Image block vertical margin | `my-2` (8px) | `8.dp` | Top and bottom of image |
| Image caption gap | `mt-1` (4px) | `4.dp` | Above caption text |
| Bottom padding (scroll) | `h-8` (32px) | `32.dp` | |
| TopAppBar | `px-4 py-3` | Material TopAppBar | Back + "Blog Post" |

## Image caption

- Only show caption when `title` is present and **not** the literal string `"null"` (case-insensitive). Both Web and Android must hide caption when title is null, blank, or `"null"` to avoid showing "null" on screen.

## Where this is used

- **blog-editor frontend**: [MobilePreview.jsx](../frontend/src/components/MobilePreview.jsx), [TipTapContentRenderer.jsx](../frontend/src/components/TipTapContentRenderer.jsx)
- **Android app**: [BlogDetailScreen.kt](../../android-app/app/src/main/java/com/livingai/android/ui/screens/BlogDetailScreen.kt), [TipTapContentRenderer.kt](../../android-app/app/src/main/java/com/livingai/android/ui/components/TipTapContentRenderer.kt)

When changing layout or spacing, update both codebases and this spec.
