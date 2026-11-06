import mongoose from 'mongoose';
import { model, ObjectId } from './shared.js';

const actions = { type: [String], default: [] };

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Please enter a name.'], trim: true, maxlength: 120 },
    email: { type: String, required: [true, 'Please enter an email address.'], trim: true, lowercase: true, maxlength: 200, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'staff'], default: 'staff' },
    permissions: { blogs: actions, products: actions, jobs: actions, applications: actions, enquiries: actions, website: actions },
    active: { type: Boolean, default: true },
    // raised when the password changes or the account is switched off, which signs the user out everywhere
    tokenVersion: { type: Number, default: 0 },
    isSeed: { type: Boolean, default: false },
    passwordChangedAt: Date,
    lastLoginAt: Date,
    createdBy: { type: ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const User = model('User', UserSchema);
