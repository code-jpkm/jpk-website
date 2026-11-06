import mongoose from 'mongoose';
import { model, ObjectId } from './shared.js';

// Earlier versions of a part of the website (kept on every save, the newest 30 per part), so a change can be undone.
const SiteRevisionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 120, index: true },
    json: { type: String, default: '{}' },
    savedBy: { type: ObjectId, ref: 'User' },
    savedByName: { type: String, trim: true, maxlength: 120, default: '' },
    savedAt: { type: Date, default: Date.now },
  },
  {},
);
SiteRevisionSchema.index({ key: 1, savedAt: -1 });

export const SiteRevision = model('SiteRevision', SiteRevisionSchema);
