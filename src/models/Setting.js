import mongoose from 'mongoose';
import { model } from './shared.js';

// Small internal flags, e.g. which one-time setup steps have already run.
const SettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 100 },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

export const Setting = model('Setting', SettingSchema);

export async function getSetting(key) {
  const doc = await Setting.findOne({ key }).lean();
  return doc ? doc.value : null;
}

export async function setSetting(key, value) {
  await Setting.updateOne({ key }, { $set: { value } }, { upsert: true });
}
