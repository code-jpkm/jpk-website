'use client';

// Calls to the admin API from the browser, with clear error messages.

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(url, { method = 'GET', body, signal } = {}) {
  const opts = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin', signal, cache: 'no-store' };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiError('Could not reach the server. Please check your internet connection and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith('/api/auth/login')) {
    window.location.assign('/login?expired=1');
    throw new ApiError(data.error || 'Your session has ended. Please sign in again.', 401, data);
  }
  if (!res.ok) throw new ApiError(data.error || `The server answered with an error (${res.status}). Please try again.`, res.status, data);
  return data;
}

// Upload a picture with progress (0–100). Resolves to { url, publicId, provider, width, height, alt }.
export function uploadImage(file, { folder = 'misc', onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload');
    xhr.responseType = 'json';
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const data = xhr.response || {};
      if (xhr.status === 401) {
        window.location.assign('/login?expired=1');
        reject(new ApiError('Your session has ended. Please sign in again.', 401));
      } else if (xhr.status >= 200 && xhr.status < 300 && data.image) resolve(data.image);
      else reject(new ApiError(data.error || `The picture could not be uploaded (${xhr.status}).`, xhr.status, data));
    };
    xhr.onerror = () => reject(new ApiError('The upload failed. Please check your internet connection and try again.', 0));
    const fd = new FormData();
    fd.append('file', file);
    fd.append('folder', folder);
    xhr.send(fd);
  });
}

export function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}
