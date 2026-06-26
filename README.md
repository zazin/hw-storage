# hw-storage — Object Storage Service (POC)

A Next.js full-stack proof-of-concept for an object storage service. It can:

- **Upload** images to S3-compatible storage (MinIO)
- **View** uploaded images in a gallery
- **Download** any image
- **Download** an Excel report (`.xlsx`) of randomly generated data

No authentication — the goal is to demonstrate working functionality.

## Stack

- Next.js (App Router, TypeScript) — UI + API route handlers
- MinIO via the AWS SDK v3 (`@aws-sdk/client-s3`) — object storage
- `better-sqlite3` — object metadata
- `exceljs` — Excel report generation

## Run locally

1. Configure the environment (`.env.local`), pointing at your MinIO:

   ```env
   S3_ENDPOINT=http://192.168.1.20:9000
   S3_REGION=us-east-1
   S3_ACCESS_KEY=minioadmin
   S3_SECRET_KEY=minioadmin123
   S3_BUCKET=images
   DB_PATH=./data/app.db
   ```

   The `images` bucket is created automatically on first upload.

2. Install and start:

   ```bash
   npm install
   npm run dev
   ```

3. Open http://localhost:3000.

## API

| Method | Route                       | Description                                            |
| ------ | --------------------------- | ----------------------------------------------------- |
| POST   | `/api/upload`               | Upload an image (`multipart/form-data`, field `file`) |
| GET    | `/api/images`               | List image metadata (newest first)                    |
| GET    | `/api/images/{id}`          | View an image inline                                  |
| GET    | `/api/images/{id}/download` | Download an image                                     |
| GET    | `/api/report`               | Download a random Excel report                        |

## Run the published image (GHCR)

Images are built and pushed to GHCR by GitHub Actions on every push to `main`.

```bash
docker pull ghcr.io/zazin/hw-storage:latest
docker run -p 3000:3000 \
  -e S3_ENDPOINT=http://192.168.1.20:9000 \
  -e S3_ACCESS_KEY=minioadmin \
  -e S3_SECRET_KEY=minioadmin123 \
  -e S3_BUCKET=images \
  -e DB_PATH=/app/data/app.db \
  ghcr.io/zazin/hw-storage:latest
```

Or run the full stack (MinIO + app) with `docker compose up`.

## CI/CD

`.github/workflows/ci.yml`:

- **build** — installs deps and runs `next build` on every push/PR
- **docker** — builds the image and pushes to `ghcr.io/zazin/hw-storage` on pushes to `main` (and version tags)
