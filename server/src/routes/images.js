import crypto from 'node:crypto';
import path from 'node:path';
import express from 'express';
import multer from 'multer';

import settings from '../config.js';
import processor from '../jobs/processor.js';
import { createJob, getJob, listJobs } from '../services/imageService.js';

const router = express.Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const storage = multer.diskStorage({
  destination: settings.uploadDir,
  filename: (req, file, cb) => {
    if (!req.jobId) {
      req.jobId = crypto.randomUUID();
    }
    const ext = path.extname(file.originalname) || '.png';
    const filename = `${req.jobId}${ext}`;
    req.savedFilename = filename;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_SIZE || 15 * 1024 * 1024) },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype?.startsWith('image/')) {
      return cb(new Error('Only image uploads are allowed'));
    }
    return cb(null, true);
  },
});

function assignJobId(req, res, next) {
  req.jobId = crypto.randomUUID();
  next();
}

router.post('/', assignJobId, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ detail: 'File is required' });
    }
    const requestedSize = Number(req.body?.size);
    const minAllowed = 256;
    const maxAllowed = 4096;
    const targetDimension =
      Number.isFinite(requestedSize) && requestedSize >= minAllowed && requestedSize <= maxAllowed
        ? Math.round(requestedSize)
        : settings.maxImageDimension;
    const relativePath = path.posix.join('uploads', req.savedFilename || req.file.filename);
    const job = await createJob({
      id: req.jobId,
      originalFilename: req.file.originalname || req.savedFilename,
      originalPath: relativePath,
      targetDimension,
      originalSizeBytes: req.file.size,
    });
    processor.enqueue(job.id);
    return res.status(201).json({
      id: job.id,
      status: job.status,
      target_dimension: job.target_dimension,
      detail: 'Image accepted. Processing will continue in the background.',
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const jobs = await listJobs();
    return res.json(jobs.map(serializeJob));
  } catch (error) {
    return next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ detail: 'Invalid job id' });
    }
    const job = await getJob(id);
    if (!job) {
      return res.status(404).json({ detail: 'Job not found' });
    }
    return res.json(serializeJob(job));
  } catch (error) {
    return next(error);
  }
});

function serializeJob(job) {
  const media = (relativePath) => (relativePath ? `/media/${relativePath}` : null);
  return {
    id: job.id,
    filename: job.original_filename,
    status: job.status,
    target_dimension: job.target_dimension,
    original_size_bytes: job.original_size_bytes,
    processed_size_bytes: job.processed_size_bytes,
    original_url: media(job.original_path),
    processed_url: media(job.processed_path),
    error: job.error,
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
}

export default router;
