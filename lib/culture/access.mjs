import { ReviewError } from './domain.mjs';
export const STAFF_ROLES = ['admin', 'executive'];
// Used by every Partner Hub culture action (server actions are public endpoints, so each one re-checks).
export function assertStaff(user) {
  if (!user || user.status !== 'active' || !STAFF_ROLES.includes(user.role)) throw new ReviewError('forbidden', 'Staff access is required.');
  return user;
}
