import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export function hashPassword(password) {
  return bcrypt.hash(String(password), ROUNDS);
}

export function verifyPassword(password, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(String(password || ''), hash);
}

// Returns a message when the password is not acceptable, otherwise null.
export function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) return 'The password must be at least 8 characters long.';
  if (password.length > 128) return 'The password must be 128 characters or fewer.';
  if (!password.trim()) return 'The password cannot be only spaces.';
  return null;
}
