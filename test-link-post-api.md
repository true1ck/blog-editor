# Testing Link Post Flow

## Quick verification checklist

### 1. Check post status in dashboard
- Open: http://localhost:4000/dashboard
- Find "Cow" post
- Status should show "published" (green badge)
- Should also show "Link" badge (blue)
- If status is "draft", click "Publish"

### 2. Test API-v1 is returning the new fields

Run this in a terminal (with a valid JWT token from the app):

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3200/blog-posts
```

Expected response should include for the Cow post:
```json
{
  "id": "52d09d04-1b01-459b-bb54-4f59c303912a",
  "title": "Cow",
  "contentType": "link",  // NEW FIELD
  "externalUrl": "https://yourfamilyfarmer.com/blog/...",  // NEW FIELD
  "status": "published",
  ...
}
```

If `contentType` and `externalUrl` are **missing**, api-v1 wasn't restarted after the code changes.

### 3. Android app checklist

For the Android app to show the link post:

- [ ] Post status is **published** (not draft)
- [ ] api-v1 is running with the updated code (returns contentType, externalUrl)
- [ ] Android app was **rebuilt** after the BlogPost model was changed (added contentType, externalUrl fields)
- [ ] Android app opened the "Blogs" tab

### 4. If still not working

Check logcat from Android Studio:
```
adb logcat | grep -i "blog"
```

Look for:
- "Successfully fetched N blog posts"
- Any deserialization errors (would mean the model doesn't match the API response)
- "Blog post not found" or 404 errors

### 5. Quick debug: Check what the API returns

Without auth, check if the post exists:
```bash
# From blog-editor backend (may need auth token):
curl http://localhost:5001/api/posts/slug/cow-1770673121207

# From api-v1 (needs auth):
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3200/blog-posts/slug/cow-1770673121207
```

Should return the full post with `content_type: "link"` and `external_url: "https://..."`.
