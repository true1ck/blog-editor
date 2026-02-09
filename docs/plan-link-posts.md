# Product & Implementation Plan: Link Posts (Already-Hosted Webpage)

**Document type:** Product / Implementation Plan  
**Feature:** Link-only posts (external URL to already-hosted webpage)  
**Scope:** Single content type extension; no HTML storage, no new servers.  
**Status:** Complete  
**Last updated:** 2025-02-10  

---

## 1. Document control

| Version | Date       | Author | Changes |
|---------|------------|--------|---------|
| 0.1     | 2025-02-10 | —      | Initial full plan (link-only) |
| 0.2     | 2025-02-10 | —      | Complete: decisions, implementation details, request/response examples, migration script, manual test script, Definition of Done, exact file paths |

**Stakeholders:** Product, Engineering (backend, frontend, mobile).  
**Success owner:** Delivery of “publish link post in dashboard → viewable on web and in Android app” with zero regression on existing TipTap posts.

---

## 2. Executive summary

We are adding a second post type, **Link**, so authors can add a post that is only a **title + URL** pointing to an already-hosted webpage (any site: static HTML, React SPA, etc.). No content is stored beyond the URL. When a user publishes a link post:

- **Web:** Viewing the post (dashboard “View” or public `/blog/:slug`) sends the user to that URL (redirect or new tab).
- **Android app:** Opening the post shows the same URL inside an in-app WebView.

Existing **TipTap** posts (rich editor content stored in the DB) remain unchanged and fully supported. This plan defines scope, data model, APIs, UI/UX, implementation phases, testing, and rollout.

---

## 3. Problem & opportunity

**Problem:** Authors can only create posts by writing content in the TipTap editor. They cannot “add a post” that is simply a link to an external page they already host (e.g. a React app on Vercel, a landing page, a doc site).

**Opportunity:** One unified blog surface (dashboard + app) where some entries are rich editor content and others are links to external pages. Same publish/unpublish and listing; different rendering (TipTap vs WebView/redirect). No new infrastructure.

---

## 4. Goals and success criteria

| Goal | Success criteria |
|------|------------------|
| Support link posts | Author can create a post with only title + URL; it appears in dashboard and (when published) in app and on web. |
| Parity web ↔ app | If the URL is viewable in a browser, it is viewable in the Android app via WebView. |
| No regression | All existing TipTap posts continue to list, edit, and display correctly on web and in app. |
| Single source of control | Same backend and DB (blog-editor + Supabase); no new server or new app. |

**Out of scope for this plan:** Stored HTML, file uploads, “show in app” toggle, multiple blogs. Those can be separate follow-up plans.

---

## 5. Scope

### 5.1 In scope

- Database: Add `content_type` and `external_url` to `posts` (additive only).
- Blog-editor backend: Accept and return new fields; validate link posts (title + URL required).
- Blog-editor frontend: Post type selector (TipTap vs Link); Link form (title + URL); dashboard badge; public view redirect for link posts.
- API-v1: Return `contentType` and `externalUrl` in blog-posts responses.
- Android app: Extend model; for link posts, open URL in WebView instead of TipTap renderer.

### 5.2 Out of scope

- Stored HTML or raw HTML content.
- Uploading or hosting React/HTML builds; only storing a URL to an already-hosted page.
- “Show in app” vs “public only” (single visibility: published = web + app).
- New server or new deployment target; everything uses existing blog-editor backend and api-v1.

---

## 6. User personas and user stories

**Persona:** Blog author (uses dashboard at e.g. `http://localhost:4000/dashboard` and expects content to appear in the Android app.)

| ID | User story | Acceptance criteria |
|----|------------|---------------------|
| US-1 | As an author, I can create a “link” post with a title and URL so that I don’t have to copy-paste content. | Create flow has “Link” option; form has Title + URL; save creates post with `content_type: 'link'` and `external_url` set. |
| US-2 | As an author, I can see which posts are links vs rich content in the dashboard. | List shows a “Link” badge (or similar) for link posts. |
| US-3 | As an author, I can edit or delete a link post like any other post. | Edit opens Link form with URL; Update/Delete work via existing API. |
| US-4 | As a reader on the web, when I open a published link post I am taken to the external page. | Public `/blog/:slug` for a link post redirects to `external_url` (or opens in new tab). |
| US-5 | As a reader in the Android app, when I open a published link post I see the external page inside the app. | Detail screen opens the URL in a WebView for link posts; TipTap posts still use TipTap renderer. |
| US-6 | As an author, my existing TipTap posts still work. | No change in list, edit, or view for posts without `content_type: 'link'` (or with `content_type: 'tiptap'`). |

---

## 7. Current state (as-is)

| Layer | Component | Behavior |
|-------|-----------|----------|
| DB | Supabase `posts` | Columns: `id`, `user_id`, `title`, `content_json` (JSONB), `slug`, `status` (draft/published), `created_at`, `updated_at`. All posts are editor content. |
| Backend | blog-editor `routes/posts.js` | GET list returns selected columns (no content_type). Create requires `title` + `content_json`. Update accepts title, content_json, status. GET by slug returns full row (public). |
| Frontend | Dashboard, Editor, BlogPost | Single editor type; create/update always send `content_json`. Public `/blog/:slug` renders TipTap from `content_json`. |
| API-v1 | `blog-posts.route.js` | Reads `posts` from Supabase; returns `content` (from content_json), no content_type or external_url. |
| Android | BlogApiClient, BlogDetailScreen | Fetches post; always renders body with `TipTapContentRenderer(content)`. |

---

## 8. Target state (to-be)

| Layer | Change |
|-------|--------|
| DB | `posts` has `content_type` (default `'tiptap'`), `external_url` (nullable). Existing rows default to tiptap. |
| Backend | List returns content_type, external_url. Create/update accept content_type and external_url; for link, require external_url and allow minimal/empty content_json. |
| Frontend | Editor: type selector (TipTap / Link). Link = title + URL only. Dashboard: badge for Link. Public: link post → redirect to external_url. |
| API-v1 | All blog-posts responses include `contentType`, `externalUrl`. |
| Android | Model has contentType, externalUrl. Detail: if link → WebView(externalUrl); else → TipTapContentRenderer. |

---

## 9. Data model and schema

### 9.1 New columns (Supabase `posts`)

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `content_type` | VARCHAR(20) | `'tiptap'` | No | Allowed: `'tiptap'`, `'link'`. |
| `external_url` | TEXT | — | Yes | For link posts: the URL to open. |

### 9.2 Migration SQL

Run once (Supabase SQL editor or migration script):

```sql
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'tiptap'
  CHECK (content_type IN ('tiptap', 'link'));

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS external_url TEXT NULL;
```

- Existing rows: `content_type = 'tiptap'`, `external_url = NULL`.
- New link post: `content_type = 'link'`, `external_url = 'https://...'`. Keep `content_json` as `'{}'` if the column is NOT NULL.

### 9.3 Validation rules

- **Link post:** `content_type = 'link'` ⇒ `external_url` must be non-empty and should be a valid URL (scheme http/https). Backend may normalize (trim, add https if missing) per product choice.
- **TipTap post:** `content_type = 'tiptap'` or omitted ⇒ `content_json` required as today.

---

## 10. API contract

### 10.1 Blog-editor backend (existing routes)

**GET /api/posts** (list, authenticated)

- **Response (per post):** Include `content_type`, `external_url` in each object (in addition to existing fields).

**GET /api/posts/:id** (single, authenticated)

- **Response:** Full row; will include `content_type`, `external_url` once columns exist (e.g. via `SELECT *`).

**GET /api/posts/slug/:slug** (public)

- **Response:** Full row; same as above.

**POST /api/posts** (create, authenticated)

- **Request body (link):** `{ "title": "...", "content_type": "link", "external_url": "https://...", "status": "draft" }`. `content_json` may be omitted or `{}`.
- **Request body (tiptap):** Unchanged; `title` and `content_json` required; `content_type` optional or `'tiptap'`.
- **Response:** Created row including `content_type`, `external_url`.

**PUT /api/posts/:id** (update, authenticated)

- **Request body:** May include `content_type`, `external_url`. Same validation as create when present.
- **Response:** Updated row including new columns.

### 10.2 API-v1 (blog-posts)

**GET /blog-posts**, **GET /blog-posts/:id**, **GET /blog-posts/slug/:slug**, **GET /blog-posts/user/:userId**

- **Response mapping (add):** `contentType: post.content_type`, `externalUrl: post.external_url`. Keep existing `content` (from content_json) for backward compatibility.

---

## 11. UI/UX flows

### 11.1 Dashboard (list)

- **Display:** Each card shows title, status, date. For link posts, show a **“Link”** badge (or icon) so authors can distinguish from TipTap.
- **Actions:** Edit, (Un)Publish, Delete, View (for published). For link posts, “View” can open `external_url` in a new tab, or open `/blog/:slug` (which then redirects); both are acceptable; document choice.

### 11.2 Editor (create / edit)

- **Entry:** “New Post” or “Edit” opens editor. First or prominent choice: **Post type** — “TipTap” (default) or “Link”.
- **If TipTap:** Current UI (title + TipTap editor). Save sends `content_json`; optional `content_type: 'tiptap'`.
- **If Link:** Show only **Title** (required) and **URL** (required). Optional: slug override, status. No rich editor. Save sends `content_type: 'link'`, `external_url: <trimmed URL>`, `content_json: {}`. Publish button same as today (sets status to published).
- **Edit existing:** On load, if `content_type === 'link'`, show Link form and prefill URL; otherwise show TipTap editor.

### 11.3 Public blog page (web)

- **Route:** `/blog/:slug` (unchanged).
- **Behavior:** After fetching post by slug: if `content_type === 'link'` and `external_url` present ⇒ **redirect** to `external_url` (e.g. `window.location.href = post.external_url`). Else ⇒ render TipTap content as today.

### 11.4 Android app (detail)

- **Entry:** User taps a post in the blog list.
- **Behavior:** If `contentType == "link"` and `externalUrl != null` ⇒ open **WebView** with `externalUrl` (same URL as web). Else ⇒ render with **TipTapContentRenderer** using `content` (unchanged). Top bar (back, title) remains; content area is either WebView or TipTap.

---

## 12. Implementation phases

### Phase 1: Data and backend (no UI change)

| Task ID | Task | Owner | Acceptance criteria | Dependency |
|---------|------|--------|---------------------|------------|
| 1.1 | Run DB migration: add `content_type`, `external_url` | Backend | Columns exist; existing rows have default tiptap, NULL url | — |
| 1.2 | Blog-editor backend: extend GET list to return `content_type`, `external_url` | Backend | List response includes new fields | 1.1 |
| 1.3 | Blog-editor backend: create post — accept `content_type`, `external_url`; for link require URL, allow empty/minimal content_json | Backend | Create link post via API succeeds; tiptap create unchanged | 1.1 |
| 1.4 | Blog-editor backend: update post — accept and persist `content_type`, `external_url` | Backend | Update link post via API succeeds | 1.1 |
| 1.5 | API-v1: add `content_type`, `external_url` to select and response map (all blog-posts endpoints) | Backend | App can receive contentType, externalUrl | 1.1 |

**Phase 1 exit:** Backend and DB support link posts; existing clients ignore new fields; no regression.

---

### Phase 2: Android app (consume link posts)

| Task ID | Task | Owner | Acceptance criteria | Dependency |
|---------|------|--------|---------------------|------------|
| 2.1 | Android: add `contentType`, `externalUrl` to BlogPost model (nullable) | Mobile | Old API response still parses | Phase 1 |
| 2.2 | Android: add WebView composable (e.g. BlogWebView) that takes URL and loads in WebView | Mobile | Composable loads URL and shows loading state | — |
| 2.3 | Android: BlogDetailScreen — if link post, show WebView with externalUrl; else TipTapContentRenderer | Mobile | Link post opens in WebView; tiptap post unchanged | 2.1, 2.2 |

**Phase 2 exit:** Published link posts open in WebView in app; TipTap posts unchanged.

---

### Phase 3: Blog-editor frontend (create and view link posts)

| Task ID | Task | Owner | Acceptance criteria | Dependency |
|---------|------|--------|---------------------|------------|
| 3.1 | Dashboard: show “Link” badge (or icon) for posts where content_type === 'link' | Frontend | Author can see which posts are links | Phase 1 |
| 3.2 | Editor: add post type selector (TipTap / Link); when Link, show Title + URL form only; save with content_type and external_url | Frontend | Author can create and save link post from UI | Phase 1 |
| 3.3 | Editor: on load existing post, if link type show Link form and prefill URL | Frontend | Author can edit link post | 3.2 |
| 3.4 | BlogPost.jsx: if post is link and has external_url, redirect to external_url | Frontend | Public view of link post goes to external page | Phase 1 |
| 3.5 | Dashboard: “View” for link post — open external_url in new tab (or keep View as /blog/:slug; ensure 3.4 is in place) | Frontend | Consistent with product choice (new tab vs redirect) | 3.1 |

**Phase 3 exit:** Full flow: author creates link post in dashboard → publishes → sees it on web (redirect) and in app (WebView); existing TipTap flow unchanged.

### 12.4 Definition of Done (per phase)

| Phase | Done when |
|-------|-----------|
| Phase 1 | Migration applied; blog-editor and api-v1 return `content_type` and `external_url`; link post can be created/updated via API (e.g. cURL/Postman); existing tiptap create/update still works. |
| Phase 2 | App builds; link post opens in WebView; tiptap post still uses TipTapContentRenderer; no crash when `contentType` is null or missing. |
| Phase 3 | Author can select “Link” in editor, enter URL, save and publish; dashboard shows Link badge; opening published link post on web redirects to URL; “View” for link in dashboard opens URL (per decision below). |

---

## 13. Testing strategy

| Type | Scope | Key cases |
|------|--------|-----------|
| **Regression** | TipTap posts | List, create, edit, delete, publish, view on web, view in app. No behavior change. |
| **Link post – API** | Backend + api-v1 | Create link (title + URL); GET list/id/slug return contentType, externalUrl; update link URL; link post has empty/minimal content_json. |
| **Link post – Web** | Blog-editor frontend | Create link post; dashboard shows badge; edit link post; public /blog/:slug redirects to URL. |
| **Link post – App** | Android | List shows link post; open link post → WebView loads URL; back and TipTap post still render with TipTap. |
| **Edge cases** | All | Invalid URL (backend validation); missing external_url for link type (400); old app version (ignores new fields, no crash). |

No new server or environment; use existing local/Supabase and api-v1.

---

## 14. Rollout and release

| Step | Action |
|------|--------|
| 1 | Deploy DB migration (add columns). |
| 2 | Deploy blog-editor backend and api-v1 (backward compatible). |
| 3 | Deploy Android app (new model fields + WebView branch). |
| 4 | Deploy blog-editor frontend (type selector, Link form, redirect, badge). |
| 5 | Smoke: create one link post, publish, view on web and in app; verify one TipTap post still works. |

**Rollback:** Remove new columns only if no link posts exist (or add a follow-up migration to clear link posts). Backend/frontend/app can be reverted to previous versions; default content_type and nullable external_url prevent breakage for existing rows.

---

## 15. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Existing posts break if content_type default wrong | Default `'tiptap'` and nullable external_url; no backfill required. |
| App crashes on unknown content_type | App treats only `"link"` as WebView; everything else (null, tiptap, future) uses TipTap. |
| Invalid or malicious URL stored | Backend: validate scheme (http/https), length, and optionally allowlist domains if needed. |
| WebView security (Android) | Use standard WebView; consider certificate pinning or safe-browsing only if required later. |

---

## 16. Decisions (resolved)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| URL validation | **Moderate:** Non-empty string, must start with `http://` or `https://`. Trim whitespace. Max length 2048. | Balances safety and flexibility; no allowlist so any already-hosted page works. |
| Dashboard “View” for link post | **Open `external_url` in new tab** (target="_blank"). | Author expects to see the live page; redirect from /blog/:slug is for shared/public links; dashboard is author-facing. |
| Public `/blog/:slug` for link post | **Redirect** (window.location.href = external_url). | Shared link behavior matches “one URL”; app and web both end on the same external page. |
| content_json for link posts | **Store `{}`** (empty JSON object). | Keeps `content_json` NOT NULL without schema change; backend sends `'{}'` when creating/updating link post. |
| Serialization (API-v1 / Android) | **camelCase** in JSON: `contentType`, `externalUrl`. | Matches existing api-v1 style (e.g. createdAt, updatedAt). |

**Future work (out of scope):** Stored HTML, “show in app” toggle, multiple blogs — separate PRDs/plans.

---

## 17. Appendix

### 17.1 File reference (exact paths)

| Area | File(s) |
|------|--------|
| DB migration | `blog-editor/backend/migrations/add-link-post-columns.js` (new; see §20) or Supabase SQL editor |
| Blog-editor backend | `blog-editor/backend/routes/posts.js` |
| Blog-editor frontend | `blog-editor/frontend/src/pages/Dashboard.jsx`, `blog-editor/frontend/src/pages/Editor.jsx`, `blog-editor/frontend/src/pages/BlogPost.jsx` |
| API-v1 | `api-v1/routes/blog-posts.route.js` |
| Android model | `android-app/app/src/main/java/com/livingai/android/api/BlogApiClient.kt` (BlogPost data class) |
| Android detail | `android-app/app/src/main/java/com/livingai/android/ui/screens/BlogDetailScreen.kt` |
| Android WebView | New: `android-app/app/src/main/java/com/livingai/android/ui/components/BlogWebView.kt` |

### 17.2 Glossary

| Term | Meaning |
|------|--------|
| Link post | Post with `content_type: 'link'` and `external_url` set; no rich body stored. |
| TipTap post | Post with rich content in `content_json`, rendered by TipTap (web) and TipTapContentRenderer (app). |
| Already-hosted | The URL points to a page the author hosts elsewhere (Vercel, S3, etc.); we do not host the page. |

---

## 18. Implementation details (per file)

### 18.1 Blog-editor backend (`blog-editor/backend/routes/posts.js`)

- **GET /** (list): Change SELECT to include new columns:
  - From: `SELECT id, title, slug, status, created_at, updated_at`
  - To: `SELECT id, title, slug, status, content_type, external_url, created_at, updated_at`
- **POST /** (create):
  - Read `content_type`, `external_url` from `req.body`.
  - If `content_type === 'link'`: require `title` and non-empty `external_url`; validate URL (starts with http:// or https://, length ≤ 2048, trim); set `content_json = '{}'` for INSERT. Return 400 if URL missing or invalid.
  - Else (tiptap or omitted): require `title` and `content_json` as today.
  - INSERT: add `content_type` and `external_url` to column list and values (e.g. `$6`, `$7`). Use default `'tiptap'` and NULL when not link.
- **PUT /:id** (update):
  - Read `content_type`, `external_url` from `req.body`.
  - If `content_type === 'link'` (or external_url provided): validate URL as above; add to dynamic updates: `content_type = $n`, `external_url = $n+1`.
  - Append these to the existing dynamic update logic; ensure slug/title/content_json/status logic is unchanged.
- **GET /:id** and **GET /slug/:slug**: Use `SELECT *` (or add `content_type`, `external_url` to SELECT). No change if already `SELECT *`.

### 18.2 API-v1 (`api-v1/routes/blog-posts.route.js`)

- In **every** blog-posts endpoint (GET list, GET :id, GET slug/:slug, GET user/:userId):
  - **build/select:** Add `content_type`, `external_url` to the `.select()` list (e.g. `.select('id', 'title', 'slug', 'content_json', 'status', 'created_at', 'updated_at', 'user_id', 'content_type', 'external_url')`). If using `.first()` without explicit select, ensure the table has the columns and the returned row includes them.
  - **map:** Add to the returned object: `contentType: post.content_type`, `externalUrl: post.external_url`. Use optional chaining or default so missing columns don’t break (e.g. `contentType: post.content_type ?? 'tiptap'`, `externalUrl: post.external_url ?? null`).

### 18.3 Android app

- **BlogPost model** (`BlogApiClient.kt`): Add to `BlogPost` data class:
  - `val contentType: String? = null`
  - `val externalUrl: String? = null`
  - Use `@SerialName("contentType")` and `@SerialName("externalUrl")` if the serializer is strict about naming.
- **BlogDetailScreen.kt:** In `BlogPostContent` (or the composable that chooses content): accept `post: BlogPost`. If `post.contentType == "link"` and `post.externalUrl != null`, render a full-screen WebView (or new composable `BlogWebView(post.externalUrl)`). Else, keep existing `TipTapContentRenderer(content = post.content, ...)`.
- **BlogWebView.kt** (new): Composable that takes `url: String`, uses `AndroidView` + `WebView`, calls `webView.loadUrl(url)`, enables JavaScript, optionally shows a loading indicator until `onPageFinished`. Use `Modifier.fillMaxSize()` inside the content slot of the existing scaffold.

### 18.4 Blog-editor frontend

- **Dashboard.jsx:** When mapping over `posts`, for each post if `post.content_type === 'link'` (or `post.contentType` if backend camelCases) render a small badge “Link” next to the status. For “View” button when post is link, use `<a href={post.external_url} target="_blank" rel="noopener noreferrer">View</a>` (or equivalent) so it opens in new tab.
- **Editor.jsx:** Add state: `contentType: 'tiptap' | 'link'` (default `'tiptap'`), `externalUrl: string` (default `''`). On mount when editing (`id` present), after `fetchPost` set `contentType` from `res.data.content_type` and `externalUrl` from `res.data.external_url`. Add a type selector at the top (e.g. two buttons or radio: “Article” / “Link”). When “Link” is selected: show Title input + URL input (type="url" or type="text"); hide the TipTap Editor component. On save (auto-save and Publish): if `contentType === 'link'` send `content_type: 'link'`, `external_url: externalUrl.trim()`, `content_json: {}`; else send current payload. For link, require `title` and `externalUrl` before save/publish.
- **BlogPost.jsx:** After `setPost(res.data)` (or in a useEffect that runs when `post` is set), if `post.content_type === 'link'` and `post.external_url` then `window.location.href = post.external_url` (redirect). Else keep existing TipTap rendering (editor and setContent).

**Note:** If the public slug endpoint requires authentication, the blog-editor frontend may need to call a different endpoint for unauthenticated public view (e.g. api-v1 GET blog-posts/slug/:slug with no auth, or blog-editor backend may expose an unauthenticated slug route). Resolve per current auth setup.

---

## 19. Request/response examples

### 19.1 Create link post (blog-editor backend)

**Request:** `POST /api/posts` (with Authorization header)

```json
{
  "title": "Our React Demo",
  "content_type": "link",
  "external_url": "https://my-app.vercel.app",
  "status": "draft"
}
```

**Response:** `201 Created`

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "title": "Our React Demo",
  "content_json": {},
  "slug": "our-react-demo-1234567890",
  "status": "draft",
  "content_type": "link",
  "external_url": "https://my-app.vercel.app",
  "created_at": "...",
  "updated_at": "..."
}
```

### 19.2 Create TipTap post (unchanged)

**Request:** `POST /api/posts`

```json
{
  "title": "My Article",
  "content_json": { "type": "doc", "content": [...] },
  "status": "draft"
}
```

### 19.3 API-v1 response (single post) with link fields

**Response:** `GET /blog-posts/:id` or `GET /blog-posts/slug/:slug`

```json
{
  "id": "uuid",
  "title": "Our React Demo",
  "slug": "our-react-demo-1234567890",
  "content": {},
  "status": "published",
  "createdAt": "...",
  "updatedAt": "...",
  "userId": "uuid",
  "contentType": "link",
  "externalUrl": "https://my-app.vercel.app"
}
```

---

## 20. Migration script

Create `blog-editor/backend/migrations/add-link-post-columns.js` and run from `blog-editor/backend`: `node migrations/add-link-post-columns.js`. Ensure `.env` is loaded (same as existing `migrate.js`).

```javascript
import { pool } from '../config/database.js'
import dotenv from 'dotenv'

dotenv.config()

async function up() {
  await pool.query(`
    ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS content_type VARCHAR(20) DEFAULT 'tiptap'
    CHECK (content_type IN ('tiptap', 'link'));
  `)
  await pool.query(`
    ALTER TABLE posts
    ADD COLUMN IF NOT EXISTS external_url TEXT NULL;
  `)
  console.log('✓ add-link-post-columns: content_type, external_url added')
  process.exit(0)
}

up().catch(err => {
  console.error(err)
  process.exit(1)
})
```

Alternatively run the SQL in §9.2 directly in the Supabase SQL editor.

---

## 21. Manual test script

Use this after each phase to verify behavior.

### Phase 1 (backend only)

1. Run migration; verify columns exist in Supabase.
2. **Create link post (API):** `curl -X POST http://localhost:5001/api/posts -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d '{"title":"Test Link","content_type":"link","external_url":"https://example.com","status":"draft"}'`. Expect 201 and response with `content_type`, `external_url`.
3. **List posts:** GET /api/posts; response includes `content_type`, `external_url` for each.
4. **Create TipTap post (API):** Same as before (title + content_json); expect 201. No regression.
5. **API-v1:** With auth, GET /blog-posts; each post has `contentType`, `externalUrl` in response.

### Phase 2 (Android)

1. Install app; open Blogs list; tap a **TipTap** post → content renders as before.
2. Publish one **link** post (via API or Phase 3 UI). In app, tap that post → WebView opens with the URL; back returns to list.
3. Tap TipTap post again → still TipTap renderer. No crash.

### Phase 3 (frontend)

1. **Dashboard:** Create new post; select “Link”; enter title and URL; save. Card shows “Link” badge. “View” opens URL in new tab.
2. **Editor:** Edit the link post; URL is prefilled; change URL and save; confirm update.
3. **Public view:** Open `/blog/:slug` for the link post (in incognito or different browser if slug is public) → redirects to external_url.
4. **TipTap:** Create/edit a normal post; list, edit, view unchanged.
5. **App:** Same as Phase 2; link post in WebView, TipTap in renderer.

### Regression checklist

- [ ] Existing TipTap post lists in dashboard and in app.
- [ ] Existing TipTap post opens in editor with content; save works.
- [ ] Existing TipTap post view on web shows content; in app shows TipTap renderer.
- [ ] Publish / Unpublish / Delete work for both link and TipTap posts.

---

*End of plan.*
