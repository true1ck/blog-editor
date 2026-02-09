# Plan: Link and HTML/React Posts (Multi-Content-Type)

This document is the implementation plan for adding **link** (external URL) and **html** (stored HTML or React build) post types to the existing blog flow, **without breaking** current TipTap-only behavior. React SPAs are supported via the link type (deploy anywhere, store URL) or via the html type with a base URL for built assets.

---

## 1. Goals

- Support three content types: **tiptap** (current), **link**, **html**.
- **Link**: Store a URL; web and app open it (new tab / WebView). Supports any site, including React SPAs.
- **HTML**: Store HTML and optional base URL, or a URL to built output; app renders in WebView with correct base URL for React builds.
- Single DB and backend; no new server. Control (publish, show-in-app) stays in blog-editor dashboard and existing APIs.
- Existing TipTap posts and clients remain unchanged (backward compatible).

---

## 2. Current State Summary

| Component | Location | Relevant behavior |
|-----------|----------|-------------------|
| DB | Supabase `posts` | `content_json` (JSONB), `title`, `slug`, `status` (draft/published) |
| Blog-editor backend | `blog-editor/backend/routes/posts.js` | CRUD; GET by slug returns full row; create/update require `content_json` |
| Blog-editor frontend | Dashboard, Editor, `BlogPost.jsx` | TipTap editor only; public view at `/blog/:slug` renders TipTap |
| API-v1 | `api-v1/routes/blog-posts.route.js` | Reads `posts` from Supabase; returns `content` (from content_json), no content_type |
| Android app | `BlogApiClient.kt`, `BlogDetailScreen.kt`, `TipTapContentRenderer.kt` | Fetches from api-v1; renders only TipTap JSON |

---

## 3. Database Changes (Supabase)

**Add columns only; no data migration.**

Run once (new migration file or manual SQL on Supabase):

```sql
-- Content type: 'tiptap' (default), 'link', 'html'
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'tiptap'
    CHECK (content_type IN ('tiptap', 'link', 'html'));

-- For link: URL to open in browser/WebView (any site, including React SPAs)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS external_url TEXT NULL;

-- For html: raw HTML body, or NULL if content is served from URL
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS content_html TEXT NULL;

-- Optional: base URL for relative assets (React build, images, scripts)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS content_base_url TEXT NULL;

-- Optional: show in app (separate from published on web)
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS show_in_app BOOLEAN DEFAULT true;

-- Index for filtering by content_type if needed
CREATE INDEX IF NOT EXISTS idx_posts_content_type ON posts(content_type);
```

**Backfill (optional):**  
Existing rows will have `content_type = 'tiptap'` and NULL for new columns; no backfill required.

**Constraint note:**  
If the table already has rows, the CHECK may need to be added in a way that allows existing NULLs (e.g. `content_type` default `'tiptap'` and allow NULL during transition, or run backfill first). Prefer setting default so existing rows get `'tiptap'`.

---

## 4. Blog-Editor Backend

**File:** `blog-editor/backend/routes/posts.js`

### 4.1 SELECTs – include new columns

- **GET /** (list): Add `content_type`, `external_url`, `content_html`, `content_base_url`, `show_in_app` to the SELECT so the dashboard can show type and edit correctly.
- **GET /:id**: Uses `SELECT *`; no change needed once columns exist.
- **GET /slug/:slug**: Uses `SELECT *`; no change needed.

### 4.2 Create post – accept new fields and validate by type

- **Body:** Accept `content_type`, `external_url`, `content_html`, `content_base_url`, `show_in_app` in addition to `title`, `content_json`, `status`.
- **Validation:**
  - If `content_type === 'link'`: require `external_url` (non-empty string); allow `content_json` to be `{}` or omit.
  - If `content_type === 'html'`: require at least one of `content_html` or `external_url` (URL to built HTML); allow `content_json` to be `{}` or omit.
  - If `content_type === 'tiptap'` or not set: require `content_json` as today.
- **INSERT:** Add the new columns to the INSERT and values. For link/html, `content_json` can be `'{}'` to satisfy existing NOT NULL if applicable (or make `content_json` nullable in a separate migration if desired; this plan keeps it NOT NULL with `{}` for non-tiptap).

### 4.3 Update post – allow updating new fields

- **Body:** Allow `content_type`, `external_url`, `content_html`, `content_base_url`, `show_in_app` in addition to existing fields.
- **Logic:** Same validation as create when these fields are present. Add dynamic update clauses for the new columns (only set if provided).

### 4.4 Public GET by slug

- No auth change; keep public GET by slug as-is. Response will include new columns automatically with `SELECT *`.

---

## 5. Blog-Editor Frontend

### 5.1 Dashboard – list view

- **File:** `blog-editor/frontend/src/pages/Dashboard.jsx`
- **Change:** When rendering each post, read `content_type` (or `post.contentType` if backend camelCases). Show a small badge/label: “TipTap”, “Link”, or “HTML” (and optionally “React” for link if you want to hint that React URLs are supported).
- **Links:** “View” for published link posts could open `external_url` in a new tab instead of `/blog/:slug` if desired; or keep “View” as `/blog/:slug` and let BlogPost page handle redirect.

### 5.2 Editor – post type selector and forms

- **File:** `blog-editor/frontend/src/pages/Editor.jsx` (and any shared editor component)
- **Changes:**
  1. **Post type selector** (e.g. radio or dropdown): “TipTap” (default), “Link”, “HTML”.
  2. **When “Link” selected:**
     - Show: Title (required), URL (required), optional status.
     - On save: send `content_type: 'link'`, `external_url: <url>`, `content_json: {}`, plus title/slug/status.
  3. **When “HTML” selected:**
     - Show: Title, one of:
       - Textarea for raw HTML, and optional “Base URL” for assets (for React build), or
       - Single “URL” to built HTML (e.g. S3); then send `content_type: 'html'`, `external_url` or `content_html` (and optional `content_base_url`).
     - On save: send `content_type: 'html'`, `content_html` and/or `external_url`, `content_base_url`, `content_json: {}`.
  4. **When “TipTap” selected:** Current behavior; send `content_json` from editor state, no `content_type` or `content_type: 'tiptap'`.
- **Loading:** When editing an existing post, set the selector from `post.content_type` and prefill URL or HTML fields.

### 5.3 Public blog page – render by type

- **File:** `blog-editor/frontend/src/pages/BlogPost.jsx`
- **Changes:** After fetching post by slug:
  - If `content_type === 'link'` and `external_url`: redirect to `external_url` (or open in new tab / render in iframe). Prefer redirect so “view in browser” = same as app (one URL).
  - If `content_type === 'html'`: If `content_html` present, render with `dangerouslySetInnerHTML` inside a sandboxed container; set `<base href={content_base_url} />` in the document so relative assets (React build) resolve. If only `external_url` present, show an iframe with `src={external_url}` or a link to open it.
  - Else (tiptap or missing): current TipTap rendering from `content_json`.

---

## 6. API-v1 (Blog-Posts Routes)

**File:** `api-v1/routes/blog-posts.route.js`

### 6.1 Same table

- Ensure api-v1 uses the same Supabase `posts` table as blog-editor (same DB). No schema change in api-v1; only response mapping.

### 6.2 Extend response mapping

- In every pipeline that returns a post (list, by id, by slug, by user):
  - **Select:** Add to `.select()`: `content_type`, `external_url`, `content_html`, `content_base_url`, `show_in_app` (if you add it).
  - **Map:** Add to the returned object: `contentType`, `externalUrl`, `contentHtml`, `contentBaseUrl`, `showInApp`. Keep existing `content` (from `content_json`) so existing app versions keep working.
- **Filter by show_in_app (optional):** If you add `show_in_app`, filter list (and optionally slug/id) with `.where('show_in_app', true)` for app-facing endpoints so only “show in app” posts are returned.

---

## 7. Android App

### 7.1 Model

- **File:** `android-app/app/src/main/java/com/livingai/android/api/BlogApiClient.kt` (or wherever `BlogPost` is defined)
- **Change:** Add optional fields to `BlogPost`:
  - `contentType: String? = null` (or default `"tiptap"`)
  - `externalUrl: String? = null`
  - `contentHtml: String? = null`
  - `contentBaseUrl: String? = null`
  - `showInApp: Boolean? = null`
- Use default values or nullable so old API responses without these fields still parse.

### 7.2 Blog list screen

- **File:** e.g. `BlogsScreen.kt`
- **Change:** Optional: show a small icon or label for “Link” / “HTML” using `contentType`. No breaking change if you skip this.

### 7.3 Blog detail screen – branch by content type

- **File:** `android-app/app/src/main/java/com/livingai/android/ui/screens/BlogDetailScreen.kt`
- **Logic:**
  1. If `contentType == "link"` and `externalUrl != null`:
     - Open `externalUrl` in a **WebView** (new composable or full-screen WebView). Use `AndroidView` + `WebView` and `webView.loadUrl(externalUrl)`. This supports React SPAs and any web page.
  2. Else if `contentType == "html"`:
     - If `externalUrl != null`: load in WebView with `webView.loadUrl(externalUrl)`.
     - Else if `contentHtml != null`: use `webView.loadDataWithBaseURL(contentBaseUrl ?: "about:blank", contentHtml, "text/html", "UTF-8", null)` so relative paths (e.g. React build assets) resolve when `contentBaseUrl` points to the build root.
  3. Else (tiptap or null/empty):
     - Keep current behavior: render with **TipTapContentRenderer** using `content` (TipTap JSON).

### 7.4 WebView composable

- **New file (suggested):** e.g. `android-app/.../ui/components/BlogWebView.kt`
- **Content:** A composable that takes URL and/or HTML + base URL, and renders a WebView (with optional progress bar, back/forward if needed). Handle loading state and errors. Use same styling/layout as the rest of the detail screen (e.g. inside the same scaffold).

---

## 8. React Pages – How They Are Supported

- **Link type:** User deploys a React app (Vercel, Netlify, S3+CloudFront, etc.) and enters the app URL in the dashboard. Stored as `content_type: 'link'`, `external_url: <url>`. Web and app open that URL; React runs in the browser/WebView. No extra work.
- **HTML type with React build:** User builds the React app (`npm run build`), uploads the build (e.g. to S3) or pastes the entry HTML. Store either:
  - The URL to the built app (e.g. `https://bucket.../index.html`) in `external_url` and use link-like behavior in the app (load URL in WebView), or
  - The HTML in `content_html` and the build root in `content_base_url`; app uses `loadDataWithBaseURL(contentBaseUrl, contentHtml, "text/html", "UTF-8", null)` so scripts and assets load and the React app runs in the WebView.

No separate “React” content type is required.

---

## 9. Implementation Order

| Step | Task | Breaks existing? |
|------|------|-------------------|
| 1 | DB: Add columns (content_type, external_url, content_html, content_base_url, show_in_app) and index | No |
| 2 | Blog-editor backend: Extend SELECTs, CREATE, UPDATE with new fields and validation | No |
| 3 | API-v1: Extend select and map for all blog-posts responses | No |
| 4 | Android: Extend BlogPost model with optional new fields | No |
| 5 | Android: Add WebView composable and branch in BlogDetailScreen by contentType | No |
| 6 | Blog-editor frontend: Dashboard badge for type; Editor type selector + Link/HTML forms; BlogPost render by type | No |

Recommended: do 1 → 2 → 3 → 4 → 5 → 6. After 1–3, the API and DB support new types; after 4–5, the app can show link/html; after 6, the dashboard supports creating and viewing them.

---

## 10. Testing Checklist

- [ ] Existing TipTap post: still lists, opens, and renders in dashboard, web `/blog/:slug`, and app.
- [ ] New link post: create in dashboard with URL; appears in list; “View” on web opens URL; app opens same URL in WebView.
- [ ] New HTML post (URL): create with URL to a built React app; web and app load it; React runs in WebView.
- [ ] New HTML post (raw HTML + base URL): create with HTML and base URL; app renders with `loadDataWithBaseURL`; relative assets load.
- [ ] Edit existing TipTap post: no regression; content_type remains tiptap.
- [ ] Optional: `show_in_app = false` excludes post from api-v1 list (if you implement the filter).

---

## 11. File Reference

| Area | File(s) |
|------|--------|
| DB migration | New SQL file or Supabase SQL editor; optional `blog-editor/backend/migrations/add-content-type-columns.js` |
| Blog-editor backend | `blog-editor/backend/routes/posts.js` |
| Blog-editor frontend | `blog-editor/frontend/src/pages/Dashboard.jsx`, `Editor.jsx`, `BlogPost.jsx` |
| API-v1 | `api-v1/routes/blog-posts.route.js` |
| Android model | `android-app/.../api/BlogApiClient.kt` (BlogPost data class) |
| Android detail | `android-app/.../ui/screens/BlogDetailScreen.kt` |
| Android WebView | New: `android-app/.../ui/components/BlogWebView.kt` (or equivalent) |

---

## 12. Optional: show_in_app

- **DB:** Column `show_in_app BOOLEAN DEFAULT true` (included in schema above).
- **Blog-editor dashboard:** Add toggle “Show in app” when creating/editing a post (for all types).
- **API-v1:** For GET list (and optionally get by id/slug), add `.where('show_in_app', true)` so the app only receives posts that are allowed in-app.
- **Web:** Unchanged; public GET by slug can ignore `show_in_app` so web can still show “published but not in app” posts if desired.

This gives you: Publish = visible on web; Show in app = visible in Android app.
