import path from 'node:path';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import multer from 'multer';

import settings from './config.js';
import imageRoutes from './routes/images.js';
import { query } from './db.js';

const app = express();
const WEB_ROOT = settings.webRoot;

app.use(cors());
app.use(express.json());
app.use(morgan(settings.env === 'production' ? 'combined' : 'dev'));
app.use('/media', express.static(settings.storageRoot));
app.use(express.static(WEB_ROOT));
app.use('/assets', express.static(path.join(WEB_ROOT, 'assets')));

app.use('/api/images', imageRoutes);

app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    if (settings.env !== 'production') {
      // eslint-disable-next-line no-console
      console.error('Health check failed', error);
    }
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(WEB_ROOT, 'index.html'));
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  if (err instanceof multer.MulterError || err.message === 'Only image uploads are allowed') {
    status = 400;
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413;
    message = 'File is too large';
  }
  if (settings.env !== 'production') {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json({ detail: message });
});

export default app;
