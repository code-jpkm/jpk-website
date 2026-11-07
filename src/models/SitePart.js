import mongoose from 'mongoose';
import { model, ObjectId } from './shared.js';

// The website editor's saved changes, one document per part of the site:
//   "page:<Page>"   changes to a page of the website (texts, pictures, links, section order, search engine details)
//   "global"        header and footer
//   "custom:<id>"   a page made in the admin
//   "menus"         the main menu
//   "settings"      design (colours, fonts) and extra CSS
const SitePartSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
    kind: { type: String, required: true, enum: ['page', 'global', 'custom', 'menus', 'settings', 'seo'] },
    // the data as JSON text: its keys ("180eb9b.t0") contain dots, which MongoDB fields should not
    json: { type: String, default: '{}' },
    // pages made in the admin: for lists
    title: { type: String, trim: true, maxlength: 200 },
    path: { type: String, trim: true, maxlength: 200 },
    published: Boolean,
    updatedBy: { type: ObjectId, ref: 'User' },
    updatedByName: { type: String, trim: true, maxlength: 120, default: '' },
  },
  { timestamps: true },
);

export const SitePart = model('SitePart', SitePartSchema);

export function partData(doc) {
  if (!doc) return null;
  try { return JSON.parse(doc.json || '{}'); } catch { return {}; }
}
