import mongoose from 'mongoose';
import { model, ImageSchema, ObjectId } from './shared.js';

// Product groups, nested like the website menu (Sanitary Castings > Ductile Iron > Solid Top).
const ProductCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Please enter a category name.'], trim: true, maxlength: 120 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, unique: true },
    parent: { type: ObjectId, ref: 'ProductCategory', default: null },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    image: { type: ImageSchema, default: null },
    order: { type: Number, default: 0 },
    websitePath: { type: String, trim: true, maxlength: 200, default: '' },
  },
  { timestamps: true },
);
ProductCategorySchema.index({ parent: 1, order: 1 });

export const ProductCategory = model('ProductCategory', ProductCategorySchema);
