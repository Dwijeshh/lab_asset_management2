// Input validation and sanitization

const VALID_STATUSES = ['available', 'in_use', 'maintenance', 'retired'] as const;
const VALID_CATEGORIES = [
  // Computing & IT Equipment
  'cpu',
  'monitor',
  'laptop',
  'printer',
  'projector',
  'server',
  'network_device',
  'ups',
  'keyboard_mouse',
  // Electrical & Electronics Equipment
  'oscilloscope',
  'function_generator',
  'power_supply',
  'multimeter',
  'soldering_station',
  'microcontroller_kit',
  // Mechanical & Workshop Equipment
  'three_d_printer',
  'lathe_machine',
  'milling_machine',
  'testing_machine',
  // General
  'other'
] as const;

// NOTE: values above must stay in sync with ASSET_CATEGORIES in src/lib/assets.ts

export type AssetStatus = typeof VALID_STATUSES[number];
export type AssetCategory = typeof VALID_CATEGORIES[number];

export function isValidStatus(status: string): status is AssetStatus {
  return VALID_STATUSES.includes(status as AssetStatus);
}

export function isValidCategory(category: string): category is AssetCategory {
  return VALID_CATEGORIES.includes(category as AssetCategory);
}

export interface ValidatedAssetInput {
  name: string;
  category: AssetCategory;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  location: string;
  status: AssetStatus;
  purchaseDate?: Date;
  warrantyExpiry?: Date;
  notes?: string;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function sanitizeString(input: string, maxLength: number = 255): string {
  return input.trim().slice(0, maxLength);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validates an email and returns the trimmed, lower-cased form.
export function validateEmail(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new ValidationError('Email is required');
  }
  const email = input.trim().toLowerCase();
  if (email.length > 255 || !EMAIL_PATTERN.test(email)) {
    throw new ValidationError('Invalid email address');
  }
  return email;
}

// Password policy: at least 8 characters with a letter and a digit.
export function validatePassword(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new ValidationError('Password is required');
  }
  if (input.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long');
  }
  if (!/[A-Za-z]/.test(input) || !/\d/.test(input)) {
    throw new ValidationError('Password must contain at least one letter and one number');
  }
  return input;
}

export function validateAssetInput(body: any): ValidatedAssetInput {
  // Required fields
  if (!body.name || typeof body.name !== 'string') {
    throw new ValidationError('Name is required and must be a string');
  }
  if (!body.location || typeof body.location !== 'string') {
    throw new ValidationError('Location is required and must be a string');
  }
  if (!body.category || !isValidCategory(body.category)) {
    throw new ValidationError('Invalid category');
  }

  const name = sanitizeString(body.name, 255);
  const location = sanitizeString(body.location, 255);

  if (name.length === 0) {
    throw new ValidationError('Name cannot be empty');
  }
  if (location.length === 0) {
    throw new ValidationError('Location cannot be empty');
  }

  // Status validation
  const status = body.status || 'available';
  if (!isValidStatus(status)) {
    throw new ValidationError('Invalid status');
  }

  // Optional fields validation
  const validated: ValidatedAssetInput = {
    name,
    category: body.category,
    location,
    status,
  };

  if (body.manufacturer && typeof body.manufacturer === 'string') {
    validated.manufacturer = sanitizeString(body.manufacturer, 255);
  }

  if (body.model && typeof body.model === 'string') {
    validated.model = sanitizeString(body.model, 255);
  }

  if (body.serialNumber && typeof body.serialNumber === 'string') {
    validated.serialNumber = sanitizeString(body.serialNumber, 255);
  }

  if (body.notes && typeof body.notes === 'string') {
    validated.notes = sanitizeString(body.notes, 5000);
  }

  // Date validation
  if (body.purchaseDate) {
    const purchaseDate = new Date(body.purchaseDate);
    if (isNaN(purchaseDate.getTime())) {
      throw new ValidationError('Invalid purchase date');
    }
    if (purchaseDate > new Date()) {
      throw new ValidationError('Purchase date cannot be in the future');
    }
    validated.purchaseDate = purchaseDate;
  }

  if (body.warrantyExpiry) {
    const warrantyExpiry = new Date(body.warrantyExpiry);
    if (isNaN(warrantyExpiry.getTime())) {
      throw new ValidationError('Invalid warranty expiry date');
    }
    validated.warrantyExpiry = warrantyExpiry;
  }

  // Cross-field validation
  if (validated.purchaseDate && validated.warrantyExpiry) {
    if (validated.warrantyExpiry < validated.purchaseDate) {
      throw new ValidationError('Warranty expiry cannot be before purchase date');
    }
  }

  return validated;
}

export function validateSearchParams(searchParams: URLSearchParams): {
  search?: string;
  status?: AssetStatus;
  category?: AssetCategory;
  page: number;
  limit: number;
} {
  const result: any = {
    page: 1,
    limit: 50, // Default pagination
  };

  const search = searchParams.get('search');
  if (search) {
    result.search = sanitizeString(search, 100);
  }

  const status = searchParams.get('status');
  if (status && isValidStatus(status)) {
    result.status = status;
  }

  const category = searchParams.get('category');
  if (category && isValidCategory(category)) {
    result.category = category;
  }

  const page = parseInt(searchParams.get('page') || '1', 10);
  if (page > 0 && page < 10000) {
    result.page = page;
  }

  const limit = parseInt(searchParams.get('limit') || '50', 10);
  if (limit > 0 && limit <= 100) {
    result.limit = limit;
  }

  return result;
}