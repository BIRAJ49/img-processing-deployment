import { query } from '../db.js';

export async function createJob(job) {
  const { id, originalFilename, originalPath, targetDimension, originalSizeBytes } = job;
  const result = await query(
    `INSERT INTO image_jobs (id, original_filename, status, original_path, target_dimension, original_size_bytes)
     VALUES ($1, $2, 'pending', $3, $4, $5)
     RETURNING *`,
    [id, originalFilename, originalPath, targetDimension, originalSizeBytes],
  );
  return result.rows[0];
}

export async function updateJob(id, fields) {
  const columns = Object.keys(fields);
  if (!columns.length) {
    return getJob(id);
  }
  const assignments = columns.map((column, index) => `${column} = $${index + 1}`).join(', ');
  const values = Object.values(fields);
  values.push(id);
  const placeholder = `$${columns.length + 1}`;
  const sql = `UPDATE image_jobs SET ${assignments}, updated_at = NOW() WHERE id = ${placeholder} RETURNING *`;
  const result = await query(sql, values);
  return result.rows[0];
}

export async function getJob(id) {
  const result = await query('SELECT * FROM image_jobs WHERE id = $1', [id]);
  return result.rows[0];
}

export async function listJobs(limit = 20) {
  const result = await query('SELECT * FROM image_jobs ORDER BY created_at DESC LIMIT $1', [limit]);
  return result.rows;
}

export async function findRequeueCandidates() {
  const result = await query(
    `SELECT id FROM image_jobs
     WHERE status IN ('pending', 'processing')
     ORDER BY updated_at ASC;`,
  );
  return result.rows.map((row) => row.id);
}
