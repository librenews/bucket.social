# bucket.social CAN Service

A **Content Addressable Network (CAN) Service** built on AT Protocol that provides a simple REST API for blob storage with user-friendly key mapping and optional versioning.

## Features

- 🔗 **User-friendly Keys**: Map human-readable keys to AT Protocol blob CIDs
- 📦 **Blob Storage**: Upload, retrieve, and delete blobs via REST API
- 🔄 **Versioning**: Optional version history for blobs
- 🔐 **AT Protocol Auth**: Authenticate using AT Protocol handle and app password
- 🌐 **Domain Mapping**: Support for custom domains and CDN integration
- ⚡ **Rate Limiting**: Per-user rate limiting to prevent abuse
- 🛡️ **Security**: Helmet, CORS, and input validation

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- AT Protocol account with app password

### Installation

1. Clone the repository:
```bash
git clone https://github.com/bucket-social/can-service.git
cd can-service
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development server:
```bash
npm run dev
```

The service will start on `http://localhost:3000`

### Production Build

```bash
npm run build
npm start
```

## API Endpoints

All endpoints require Basic Authentication using your AT Protocol handle and app password.

### Upload Blob

```http
POST /blobs/:key
Content-Type: multipart/form-data
Authorization: Basic <base64(handle:appPassword)>

file: <blob data>
comment: "Optional version comment"
enableVersioning: true
```

### Get Blob

```http
GET /blobs/:key[?version=versionId]
Authorization: Basic <base64(handle:appPassword)>
```

### List Blob Versions

```http
GET /blobs/:key/versions
Authorization: Basic <base64(handle:appPassword)>
```

### Delete Blob

```http
DELETE /blobs/:key[?version=versionId]
Authorization: Basic <base64(handle:appPassword)>
```

### List All Blobs

```http
GET /blobs[?limit=50&cursor=xxx]
Authorization: Basic <base64(handle:appPassword)>
```

## Authentication

The service uses HTTP Basic Authentication where:
- **Username**: Your AT Protocol handle (e.g., `alice.bsky.social`)
- **Password**: Your AT Protocol app password

### Creating an App Password

1. Go to your AT Protocol client settings
2. Generate a new app password
3. Use this password (not your main account password) with the API

## Configuration

Environment variables can be set in `.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `ATP_SERVICE_URL` | `https://bsky.social` | AT Protocol service URL |
| `CORS_ORIGINS` | `http://localhost:3000` | Allowed CORS origins |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 mins) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `MAX_BLOB_SIZE_BYTES` | `52428800` | Max blob size (50MB) |
| `DEFAULT_VERSIONING_ENABLED` | `true` | Enable versioning by default |
| `LOG_LEVEL` | `info` | Logging level |

## Data Model

### CAN Mapping Record

Stored in your AT Protocol Personal Data Store (PDS):

```typescript
{
  key: string;                    // User-friendly key
  current: BlobInfo;              // Current blob version
  versions?: Record<string, BlobVersion>; // Version history
  createdAt: string;              // ISO datetime
  updatedAt: string;              // ISO datetime
  versioningEnabled?: boolean;    // Versioning flag
}
```

### Blob Info

```typescript
{
  cid: string;        // AT Protocol Content ID
  mimeType: string;   // MIME type
  size: number;       // Size in bytes
  uploadedAt: string; // ISO datetime
}
```

## Versioning

When versioning is enabled:

1. **First upload**: Creates the initial blob and mapping record
2. **Subsequent uploads**: Archives current version and updates current
3. **Version access**: Use `?version=<versionId>` query parameter
4. **Version listing**: Get all versions with `/blobs/:key/versions`

## Domain Mapping

The service supports custom domain mapping for CDN integration:

1. Configure your domain to point to the CAN service
2. Create domain mapping records in your AT Protocol repo
3. Access blobs via `https://your-domain.com/blobs/:key`

## Development

### Project Structure

```
src/
├── index.ts              # Main application entry
├── types/                # TypeScript type definitions
│   └── index.ts
├── services/             # Business logic services
│   └── atprotocol.ts    # AT Protocol integration
├── routes/               # API route handlers
│   └── blobs.ts         # Blob CRUD operations
├── middleware/           # Express middleware
│   └── auth.ts          # Authentication & validation
└── lexicon/             # AT Protocol lexicon definitions
    └── can.ts           # CAN service lexicon
```

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run tests (when implemented)
- `npm run clean` - Clean build directory

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## Security Considerations

- **App Passwords**: Never store user credentials. Each request authenticates independently.
- **Rate Limiting**: Implemented per-user to prevent abuse.
- **Input Validation**: All inputs are validated and sanitized.
- **HTTPS**: Use HTTPS in production.
- **CORS**: Configure CORS origins appropriately.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- 📧 Email: support@bucket.social
- 🐛 Issues: [GitHub Issues](https://github.com/bucket-social/can-service/issues)
- 📖 Documentation: [GitHub Wiki](https://github.com/bucket-social/can-service/wiki)

---

Built with ❤️ using AT Protocol and TypeScript
