import mongoose from 'mongoose';

// Reuse a model if it was already compiled (development hot reload, seed script + app in one process).
export function model(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

// A picture stored on Cloudinary ("cloudinary"), in the database ("db") or elsewhere ("external").
export const ImageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 1000 },
    publicId: { type: String, trim: true, maxlength: 300 },
    provider: { type: String, enum: ['cloudinary', 'db', 'external'], default: 'external' },
    alt: { type: String, trim: true, maxlength: 300, default: '' },
    width: Number,
    height: Number,
  },
  { _id: false },
);

export const ObjectId = mongoose.Schema.Types.ObjectId;
