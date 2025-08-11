# Test the CAN Service API

## Start the service:
```bash
npm run dev
```

## Test endpoints:

### 1. Health Check
```bash
curl http://localhost:3000/health
```

### 2. API Documentation
```bash
curl http://localhost:3000/
```

### 3. Upload a blob (requires AT Protocol credentials)
```bash
# Replace with your actual AT Protocol handle and app password
curl -X POST \
  -H "Authorization: Basic $(echo -n 'your.handle:your-app-password' | base64)" \
  -F "file=@/path/to/your/file.txt" \
  -F "comment=Test upload" \
  -F "enableVersioning=true" \
  http://localhost:3000/blobs/test-file

```

### 4. Retrieve a blob
```bash
curl -H "Authorization: Basic $(echo -n 'your.handle:your-app-password' | base64)" \
  http://localhost:3000/blobs/test-file
```

### 5. List all blobs
```bash
curl -H "Authorization: Basic $(echo -n 'your.handle:your-app-password' | base64)" \
  http://localhost:3000/blobs
```

### 6. List blob versions
```bash
curl -H "Authorization: Basic $(echo -n 'your.handle:your-app-password' | base64)" \
  http://localhost:3000/blobs/test-file/versions
```

## Notes:
- Replace `your.handle` with your AT Protocol handle (e.g., `alice.bsky.social`)
- Replace `your-app-password` with your AT Protocol app password
- The service stores mapping records in your AT Protocol PDS
- Blobs are stored as AT Protocol blobs and referenced by CID
