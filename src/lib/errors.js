// An error with an HTTP status and a message that is safe to show to the person using the admin.
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (details) this.details = details;
  }
}

// Thrown when a required setting (environment variable) is missing.
export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
    this.code = 'CONFIG';
  }
}

const DB_DOWN = new Set([
  'MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNetworkError',
  'MongoNetworkTimeoutError', 'MongoNotConnectedError', 'MongoTopologyClosedError',
]);

export function isDbDown(err) {
  if (!err) return false;
  if (DB_DOWN.has(err.name)) return true;
  const msg = String(err.message || '');
  return /ECONNREFUSED|ENOTFOUND|buffering timed out|Server selection timed out|getaddrinfo/i.test(msg);
}
