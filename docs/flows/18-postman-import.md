# Flow 18 — Postman Collection Import

## Summary
A user imports a Postman collection from a URL or file, previews the parsed requests, and creates a project with blocks for each request.

## Actors
- Authenticated user

## Preconditions
- User is signed in
- A valid Postman Collection v2.x URL or file is available

## Steps

### Happy Path — Import from URL
1. User opens the sidebar **Import** menu.
2. User selects **Import Postman collection**.
3. `PostmanImport` modal opens with a URL input.
4. User enters the Postman collection share URL and clicks **Fetch**.
5. Collection is fetched and parsed; preview shows:
   - Collection name
   - Request count
   - Folder structure
6. User clicks **Import**.
7. A new project is created with blocks for each request.
8. Folders become block groups/tags.
9. App switches to the new project.

### Happy Path — Import from File
1. User clicks **Upload file** in the modal.
2. User selects a `.json` Postman collection file.
3. Same preview and import flow as above.

## Edge Cases
- **Invalid Postman format** → parse error alert; no import.
- **Empty collection (no requests)** → warning shown; import still allowed, creating an empty project.
- **Network error fetching URL** → error alert; retry available.
- **Folder nesting > 3 levels** → flattened to 2 levels in the block tree.

## Related Flows
- [07-project-management.md](./07-project-management.md)
- [03-openapi-import.md](./03-openapi-import.md)
