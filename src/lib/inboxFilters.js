import { searchFilter, isObjectId } from './validate.js';
import { APPLICATION_STATUSES } from '../models/Application.js';
import { ENQUIRY_STATUSES } from '../models/Enquiry.js';

// Filters shared by the lists and the CSV exports.

export function applicationFilter(sp, q) {
  const filter = { ...searchFilter(q, ['name', 'email', 'phone', 'jobTitle', 'location', 'currentCompany']) };
  const status = sp.get('status');
  if (APPLICATION_STATUSES.includes(status)) filter.status = status;
  const job = sp.get('job');
  if (job === 'general') filter.job = null;
  else if (isObjectId(job)) filter.job = job;
  return filter;
}

export function enquiryFilter(sp, q) {
  const filter = { ...searchFilter(q, ['name', 'email', 'phone', 'company', 'subject', 'message']) };
  const status = sp.get('status');
  if (ENQUIRY_STATUSES.includes(status)) filter.status = status;
  const form = sp.get('form');
  if (form) filter.formId = String(form).slice(0, 40);
  return filter;
}
