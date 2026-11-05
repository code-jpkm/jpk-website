import mongoose from 'mongoose';
import { model, ImageSchema, ObjectId } from './shared.js';

// A JPK Updates post (blog article) shown on jpkm.in/jpk-updates/.
const BlogSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Please enter a title.'], trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, unique: true },
    excerpt: { type: String, trim: true, maxlength: 600, default: '' },
    content: { type: String, default: '' },
    coverImage: { type: ImageSchema, default: null },
    category: { type: String, trim: true, maxlength: 80, default: 'JPK Updates' },
    tags: { type: [String], default: [] },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: Date,
    authorName: { type: String, trim: true, maxlength: 120, default: 'JPK Metallics' },
    seoTitle: { type: String, trim: true, maxlength: 120, default: '' },
    seoDescription: { type: String, trim: true, maxlength: 300, default: '' },
    source: { type: String, default: 'admin' },
    createdBy: { type: ObjectId, ref: 'User' },
    updatedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
BlogSchema.index({ status: 1, publishedAt: -1 });

export const Blog = model('Blog', BlogSchema);
