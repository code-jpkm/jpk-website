import mongoose from 'mongoose';
import { ConfigError } from './errors.js';

// One shared MongoDB connection per server process (also survives hot reloads in development).
const cache = globalThis.__jpkDb || (globalThis.__jpkDb = { promise: null });

export function mongoUri() {
  return String(process.env.MONGODB_URI || process.env.MONGO_URI || '').trim().replace(/^["']|["']$/g, '');
}

export function dbConfigured() {
  return Boolean(mongoUri());
}

// Use the database named in the address (mongodb+srv://host/jpk?...), MONGODB_DB, or "jpk_admin".
function dbNameFor(uri) {
  if (process.env.MONGODB_DB) return process.env.MONGODB_DB.trim();
  const m = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/);
  return m && m[1] ? undefined : 'jpk_admin';
}

export async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose;
  const uri = mongoUri();
  if (!uri) throw new ConfigError('The database is not set up yet: add MONGODB_URI to the environment settings.');
  if (!cache.promise) {
    mongoose.set('strictQuery', true);
    cache.promise = mongoose
      .connect(uri, { dbName: dbNameFor(uri), serverSelectionTimeoutMS: 15000, maxPoolSize: 10 })
      .catch(err => {
        cache.promise = null;
        throw err;
      });
  }
  await cache.promise;
  return mongoose;
}

export async function disconnectDB() {
  cache.promise = null;
  await mongoose.disconnect();
}
