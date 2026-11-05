import mongoose from 'mongoose';
import { model } from './shared.js';

export const ENQUIRY_STATUSES = ['new', 'read', 'replied', 'closed'];

// A message sent from one of the website's enquiry or contact forms.
const EnquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, trim: true, maxlength: 40, default: '' },
    company: { type: String, trim: true, maxlength: 160, default: '' },
    subject: { type: String, trim: true, maxlength: 250, default: '' },
    message: { type: String, trim: true, maxlength: 10000, default: '' },
    formId: { type: String, trim: true, maxlength: 40, default: '' },
    formName: { type: String, trim: true, maxlength: 80, default: '' },
    page: { type: String, trim: true, maxlength: 300, default: '' },
    status: { type: String, enum: ENQUIRY_STATUSES, default: 'new' },
    notes: { type: String, trim: true, maxlength: 6000, default: '' },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true },
);
EnquirySchema.index({ createdAt: -1 });
EnquirySchema.index({ status: 1, createdAt: -1 });

export const Enquiry = model('Enquiry', EnquirySchema);
