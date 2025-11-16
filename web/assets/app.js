const { useState, useEffect, useRef, useCallback } = React;

const statusStyles = {
  pending: { label: 'Pending', accent: '#fbbf24' },
  processing: { label: 'Processing', accent: '#38bdf8' },
  completed: { label: 'Completed', accent: '#34d399' },
  failed: { label: 'Failed', accent: '#f87171' },
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return null;
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let value = bytes;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const decimals = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

function StatusPill({ status }) {
  const normalized = (status || 'pending').toLowerCase();
  const config = statusStyles[normalized] || statusStyles.pending;
  return React.createElement(
    'span',
    { className: 'status-pill', style: { backgroundColor: `${config.accent}22`, color: config.accent } },
    config.label,
  );
}

function JobCard({ job, highlighted }) {
  const className = highlighted ? 'job-card job-card--highlighted' : 'job-card';
  const originalSizeLabel = formatBytes(job.original_size_bytes);
  const processedSizeLabel = formatBytes(job.processed_size_bytes);
  const hasValidSizes =
    Number.isFinite(job.original_size_bytes) && Number.isFinite(job.processed_size_bytes) && job.original_size_bytes > 0;
  const savingsPercent = hasValidSizes
    ? Math.max(0, Math.round((1 - job.processed_size_bytes / job.original_size_bytes) * 100))
    : null;
  const metaEntries = [];
  if (job.target_dimension) {
    metaEntries.push(
      React.createElement('span', { key: 'dimension', className: 'job-card__hint' }, `Max edge ${job.target_dimension}px`),
    );
  }
  if (originalSizeLabel) {
    metaEntries.push(
      React.createElement('span', { key: 'original', className: 'job-card__hint' }, `Original ${originalSizeLabel}`),
    );
  }
  if (processedSizeLabel) {
    const label = savingsPercent !== null
      ? `Processed ${processedSizeLabel} • Saved ${savingsPercent}%`
      : `Processed ${processedSizeLabel}`;
    metaEntries.push(
      React.createElement(
        'span',
        { key: 'processed', className: savingsPercent !== null ? 'job-card__hint job-card__hint--positive' : 'job-card__hint' },
        label,
      ),
    );
  }
  return React.createElement(
    'article',
    { className },
    React.createElement(
      'header',
      { className: 'job-card__header' },
      React.createElement(
        'div',
        null,
        React.createElement('h3', null, job.filename || 'Untitled upload'),
        React.createElement('small', null, new Date(job.created_at).toLocaleString()),
      ),
      React.createElement(StatusPill, { status: job.status }),
    ),
    job.processed_url
      ? React.createElement('img', { src: job.processed_url, alt: `Processed version of ${job.filename}`, className: 'job-card__image' })
      : React.createElement('div', { className: 'job-card__placeholder' }, job.status === 'failed' ? 'Processing failed' : 'Processing…'),
    metaEntries.length ? React.createElement('div', { className: 'job-card__meta' }, metaEntries) : null,
    job.error ? React.createElement('p', { className: 'job-card__error' }, job.error) : null,
    job.original_url
      ? React.createElement('a', { className: 'job-card__link', href: job.original_url, target: '_blank', rel: 'noreferrer' }, 'View original')
      : null,
  );
}

function App() {
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [selectedSize, setSelectedSize] = useState(1024);
  const fileInputRef = useRef(null);

  const loadJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/images');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      const data = await response.json();
      setJobs(data);
    } catch (error) {
      console.error(error);
      setMessage('Unable to load jobs right now.');
    }
  }, []);

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const input = fileInputRef.current;
    if (!input || !input.files || !input.files[0]) {
      setMessage('Please choose an image to upload.');
      return;
    }
    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('size', selectedSize);
    setUploading(true);
    setMessage('Uploading…');

    try {
      const response = await fetch('/api/images', { method: 'POST', body: formData });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || 'Upload failed');
      }
      setMessage(payload.detail);
      setHighlightId(payload.id);
      if (input) {
        input.value = '';
      }
      await loadJobs();
      setTimeout(() => setHighlightId(null), 4000);
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  };

  return React.createElement(
    'div',
    { className: 'page' },
    React.createElement('section', { className: 'hero' }, React.createElement('p', null, 'Upload photos and let the backend resize them asynchronously.')),
    React.createElement(
      'section',
      { className: 'panel upload-panel' },
      React.createElement('h2', null, 'Upload new image'),
      React.createElement(
        'form',
        { className: 'upload-form', onSubmit: handleSubmit },
        React.createElement('input', { type: 'file', accept: 'image/*', ref: fileInputRef, disabled: uploading }),
        React.createElement(
          'label',
          { className: 'upload-form__label' },
          React.createElement(
            'div',
            { className: 'upload-form__label-row' },
            React.createElement('span', null, 'Resize longest edge'),
            React.createElement('strong', { className: 'upload-form__label-value' }, `${selectedSize}px`),
          ),
          React.createElement('input', {
            type: 'range',
            min: 320,
            max: 2048,
            step: 64,
            value: selectedSize,
            onChange: (event) => setSelectedSize(Number(event.target.value)),
            disabled: uploading,
            className: 'upload-form__range',
          }),
          React.createElement(
            'p',
            { className: 'upload-form__hint' },
            'Smaller values shrink the output image further so its download size is reduced.',
          ),
        ),
        React.createElement('button', { type: 'submit', disabled: uploading }, uploading ? 'Uploading…' : 'Upload'),
      ),
      message ? React.createElement('p', { className: 'upload-message' }, message) : null,
    ),
    React.createElement(
      'section',
      { className: 'panel jobs-panel' },
      React.createElement(
        'header',
        { className: 'jobs-panel__header' },
        React.createElement('div', null, React.createElement('h2', null, 'Recent jobs'), React.createElement('p', null, 'Latest 20 uploads update live.')),
        React.createElement('button', { className: 'ghost-btn', type: 'button', onClick: loadJobs }, 'Refresh'),
      ),
      jobs.length === 0
        ? React.createElement('p', { className: 'empty-state' }, 'No jobs yet. Upload an image to get started.')
        : React.createElement(
            'div',
            { className: 'job-grid' },
            jobs.map((job) => React.createElement(JobCard, { key: job.id, job, highlighted: job.id === highlightId })),
          ),
    ),
  );
}

const container = document.getElementById('root');
if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(React.createElement(App));
}
