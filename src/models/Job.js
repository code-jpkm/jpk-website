import mongoose from 'mongoose';
import { model, ObjectId } from './shared.js';

// A job opening shown on the website's Careers page.
const JobSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Please enter a job title.'], trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, unique: true },
    department: { type: String, trim: true, maxlength: 100, default: '' },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    employmentType: { type: String, trim: true, maxlength: 60, default: 'Full-time' },
    experience: { type: String, trim: true, maxlength: 60, default: '' },
    summary: { type: String, trim: true, maxlength: 600, default: '' },
    description: { type: String, default: '' },
    responsibilities: { type: [String], default: [] },
    requirements: { type: [String], default: [] },
    openings: { type: Number, min: 0, max: 999, default: 1 },
    status: { type: String, enum: ['draft', 'published', 'closed'], default: 'draft' },
    publishedAt: Date,
    closingDate: { type: Date, default: null },
    createdBy: { type: ObjectId, ref: 'User' },
    updatedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
JobSchema.index({ status: 1, publishedAt: -1 });

export const Job = model('Job', JobSchema);
