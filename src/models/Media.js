import mongoose from 'mongoose';
import { model, ObjectId } from './shared.js';

// Every picture uploaded in the admin, for the picture library of the website editor (choose a picture once
// uploaded again anywhere on the site).
const MediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 1000 },
    publicId: { type: String, trim: true, maxlength: 300 },
    provider: { type: String, enum: ['cloudinary', 'db', 'external'], default: 'external' },
    width: Number,
    height: Number,
    name: { type: String, trim: true, maxlength: 200, default: '' },
    folder: { type: String, trim: true, maxlength: 40, default: 'misc' },
    alt: { type: String, trim: true, maxlength: 300, default: '' },
    uploadedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
MediaSchema.index({ createdAt: -1 });
MediaSchema.index({ url: 1 });

export const Media = model('Media', MediaSchema);
