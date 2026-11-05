import mongoose from 'mongoose';
import { model, ObjectId } from './shared.js';

export const APPLICATION_STATUSES = ['new', 'reviewing', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'];

// A job application sent from the Careers page. The CV is kept privately in the database.
const ApplicationSchema = new mongoose.Schema(
  {
    job: { type: ObjectId, ref: 'Job', default: null },
    jobTitle: { type: String, trim: true, maxlength: 160, default: 'General application' },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    experience: { type: String, trim: true, maxlength: 60, default: '' },
    currentCompany: { type: String, trim: true, maxlength: 160, default: '' },
    linkedin: { type: String, trim: true, maxlength: 300, default: '' },
    coverLetter: { type: String, trim: true, maxlength: 6000, default: '' },
    resume: {
      fileId: { type: ObjectId, default: null },
      filename: { type: String, default: '' },
      size: { type: Number, default: 0 },
      mimeType: { type: String, default: '' },
    },
    consent: { type: Boolean, default: false },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'new' },
    notes: { type: String, trim: true, maxlength: 6000, default: '' },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true },
);
ApplicationSchema.index({ createdAt: -1 });
ApplicationSchema.index({ status: 1, createdAt: -1 });

export const Application = model('Application', ApplicationSchema);
