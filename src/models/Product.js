import mongoose from 'mongoose';
import { model, ImageSchema, ObjectId } from './shared.js';

const SpecSchema = new mongoose.Schema(
  { label: { type: String, trim: true, maxlength: 120 }, value: { type: String, trim: true, maxlength: 500 } },
  { _id: false },
);

// A product with its photo gallery, specifications and an optional size/load table.
const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Please enter a product name.'], trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, unique: true },
    code: { type: String, trim: true, maxlength: 60, default: '' },
    category: { type: ObjectId, ref: 'ProductCategory', default: null },
    summary: { type: String, trim: true, maxlength: 600, default: '' },
    description: { type: String, default: '' },
    images: { type: [ImageSchema], default: [] },
    specs: { type: [SpecSchema], default: [] },
    // rows are kept as { cells: [...] } so every MongoDB-compatible database can store them
    specTable: {
      columns: { type: [String], default: [] },
      rows: { type: [new mongoose.Schema({ cells: { type: [String], default: [] } }, { _id: false })], default: [] },
    },
    features: { type: [String], default: [] },
    options: { type: [String], default: [] },
    applications: { type: [String], default: [] },
    standards: { type: [String], default: [] },
    // shown on the product's card on the website (src/lib/products/website.js)
    loadClass: { type: String, trim: true, maxlength: 40, default: '' },
    material: { type: String, trim: true, maxlength: 200, default: '' },
    // the group of cards on the category's website page (a tab or titled block, e.g. "Single Seal · Urban");
    // empty or unknown: the page's first group
    group: { type: String, trim: true, maxlength: 20, default: '' },
    // products brought over from the website's own pages: the card they came from and what it showed then
    // (fp: fingerprint of the card's content, img: its photo), so an unchanged product keeps the original card
    builtIn: {
      card: { type: String, trim: true, maxlength: 20 },
      fp: { type: String, trim: true, maxlength: 40 },
      img: { type: String, trim: true, maxlength: 1000 },
    },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    seoTitle: { type: String, trim: true, maxlength: 120, default: '' },
    seoDescription: { type: String, trim: true, maxlength: 300, default: '' },
    createdBy: { type: ObjectId, ref: 'User' },
    updatedBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
ProductSchema.index({ status: 1, category: 1, order: 1 });
ProductSchema.index({ 'builtIn.card': 1 }, { sparse: true });

export const Product = model('Product', ProductSchema);
