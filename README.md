# Async Image Processing App

Deploy-ready Node.js + React application where users upload images, metadata is stored in PostgreSQL, and the actual resizing happens asynchronously in the background using Sharp.

## Tech stack

- **Backend**: Express.js server with a lightweight in-memory job queue
- **Database**: PostgreSQL (tested against Neon using the provided connection string)
- **Image processing**: Sharp (resizes + converts to JPEG while reporting how much the file shrank)
- **Frontend**: React UI served as static assets from the same server

## Project layout

```
server/
  package.json        # Node dependencies and scripts
  src/
    app.js            # Express app + middleware
    config.js         # Environment + storage directories
    db.js             # PostgreSQL pool + schema bootstrap
    index.js          # Server entry point
    jobs/processor.js # Background queue using Sharp
    routes/images.js  # REST API for uploads + job listings
    services/...
  sql/schema.sql      # SQL helper for manual migrations
storage/
  uploads/            # Original uploads (gitignored)
  processed/          # Resized images (gitignored)
web/
  index.html          # React entry point
  assets/             # React components + styles served statically
```

## Configuration

The server relies on the following environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8000` | HTTP port |
| `DATABASE_URL` | Provided Neon connection string | PostgreSQL connection string (SSL enabled if not localhost) |
| `MAX_IMAGE_DIMENSION` | `1024` | Target width/height for processed images |
| `MAX_UPLOAD_SIZE` | `15728640` (15 MB) | Maximum upload size accepted by Multer |

Create an `.env` (or use your hosting provider's secret manager) with the supplied `DATABASE_URL`:

```
DATABASE_URL="postgresql://neondb_owner:npg_j7ABT4nkKEVD@ep-damp-dew-a4scwi3m-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

## Database schema

Run the SQL below once (or let the server do it automatically on startup) to ensure the required table exists:

```sql
CREATE TABLE IF NOT EXISTS image_jobs (
  id UUID PRIMARY KEY,
  original_filename TEXT,
  status TEXT NOT NULL,
  original_path TEXT NOT NULL,
  processed_path TEXT,
  error TEXT,
  target_dimension INT NOT NULL DEFAULT 1024,
  original_size_bytes BIGINT,
  processed_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The server calls `initSchema()` on boot, so locally you shouldn't need to run the SQL manually.

## Running locally

```bash
cd server
npm install
DATABASE_URL="postgresql://..." npm run dev
```

Then visit `http://localhost:8000` to use the React dashboard. Uploaded files are written to `storage/uploads/` and resized versions to `storage/processed/`.

The upload form includes a "resize longest edge" slider—pull it to the left to produce smaller images, and the resulting job card will display the original vs. processed byte sizes so you can confirm the file really shrank.

## API reference

- `POST /api/images` – multipart upload endpoint (field `file`). Returns a job id immediately.
- `GET /api/images` – returns the latest 20 jobs with status, errors, and media URLs.
- `GET /api/images/:id` – fetches a single job.

All API responses include `original_url`/`processed_url` when files exist so the UI can render previews.

## Background processing

Uploads are inserted into PostgreSQL with status `pending`, then enqueued in an in-memory processor. The processor updates the job to `processing`, runs Sharp in a background tick (`setImmediate`) to resize the image, saves the output under `storage/processed/<jobId>.jpg`, and finally updates the job status to `completed` (or `failed` if something goes wrong). When the server restarts it re-enqueues any jobs stuck in `pending` or `processing` so nothing is lost.
