import path from 'node:path';
import sharp from 'sharp';
import EventEmitter from 'node:events';

import settings from '../config.js';
import { getJob, updateJob } from '../services/imageService.js';

class ImageProcessor extends EventEmitter {
  constructor() {
    super();
    this.queue = [];
    this.processing = false;
  }

  enqueue(jobId) {
    this.queue.push(jobId);
    this.#processNext();
  }

  async #processNext() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    const jobId = this.queue.shift();
    this.processing = true;
    try {
      await this.#handleJob(jobId);
      this.emit('completed', jobId);
    } catch (error) {
      this.emit('failed', jobId, error);
    } finally {
      this.processing = false;
      if (this.queue.length > 0) {
        setImmediate(() => this.#processNext());
      }
    }
  }

  async #handleJob(jobId) {
    const job = await getJob(jobId);
    if (!job) {
      return;
    }
    const originalAbsolute = path.join(settings.storageRoot, job.original_path);
    const processedRelative = path.posix.join('processed', `${jobId}.jpg`);
    const processedAbsolute = path.join(settings.storageRoot, processedRelative);

    await updateJob(jobId, { status: 'processing' });

    const dimension = Number(job.target_dimension) || settings.maxImageDimension;

    const processedInfo = await sharp(originalAbsolute)
      .rotate()
      .resize({ width: dimension, height: dimension, fit: 'inside' })
      .jpeg({ quality: 72, mozjpeg: true })
      .toFile(processedAbsolute);

    await updateJob(jobId, {
      status: 'completed',
      processed_path: processedRelative,
      processed_size_bytes: processedInfo?.size,
      error: null,
    });
  }
}

const processor = new ImageProcessor();

processor.on('failed', async (jobId, error) => {
  // eslint-disable-next-line no-console
  console.error(`Job ${jobId} failed`, error);
  await updateJob(jobId, { status: 'failed', error: error.message });
});

export default processor;
