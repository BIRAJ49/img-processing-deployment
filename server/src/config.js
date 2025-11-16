import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const PROJECT_ROOT = path.resolve(currentDir, '..', '..');
const STORAGE_ROOT = path.join(PROJECT_ROOT, 'storage');
const UPLOAD_DIR = path.join(STORAGE_ROOT, 'uploads');
const PROCESSED_DIR = path.join(STORAGE_ROOT, 'processed');
const WEB_ROOT = path.join(PROJECT_ROOT, 'web');

function ensureDirectories() {
  [UPLOAD_DIR, PROCESSED_DIR].forEach((dir) => {
    fs.mkdirSync(dir, { recursive: true });
  });
}

ensureDirectories();

const DEFAULT_DATABASE_URL =
  'postgresql://neondb_owner:npg_j7ABT4nkKEVD@ep-damp-dew-a4scwi3m-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
const forceDatabaseSsl = process.env.DATABASE_SSL;
const databaseSsl =
  forceDatabaseSsl !== undefined
    ? ['1', 'true', 'yes'].includes(forceDatabaseSsl.toLowerCase())
    : !/localhost|127\.0\.0\.1|@db\b/i.test(databaseUrl);

const settings = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 8000),
  databaseUrl,
  databaseSsl,
  maxImageDimension: Number(process.env.MAX_IMAGE_DIMENSION || 1024),
  projectRoot: PROJECT_ROOT,
  storageRoot: STORAGE_ROOT,
  uploadDir: UPLOAD_DIR,
  processedDir: PROCESSED_DIR,
  webRoot: WEB_ROOT,
};

export default settings;
