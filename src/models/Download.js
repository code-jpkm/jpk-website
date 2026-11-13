import mongoose from 'mongoose';
import { model, ObjectId } from './shared.js';

export const DOWNLOAD_CATEGORIES = ['catalogue', 'certificate', 'brochure', 'datasheet', 'other'];

// A PDF the website offers for download (Website › Downloads): product catalogues, certificates, data sheets.
// The file itself is kept in the database (GridFS bucket "downloads") and served by /api/public/downloads/<id>.
const DownloadSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Please give the file a title.'], trim: true, maxlength: 160 },
    category: { type: String, enum: DOWNLOAD_CATEGORIES, default: 'catalogue' },
    description: { type: String, trim: true, maxlength: 400, default: '' },
    fileId: { type: ObjectId, required: true },
    fileName: { type: String, trim: true, maxlength: 160, default: '' },
    size: { type: Number, default: 0 },
    published: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    createdBy: { type: ObjectId, ref: 'User' },
    updatedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
DownloadSchema.index({ published: 1, category: 1, order: 1 });

export const Download = model('Download', DownloadSchema);
