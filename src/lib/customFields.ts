import type { AssetTypeField } from '@/db/schema';
import { ValidationError } from '@/lib/validation';

export type FieldDefinitionInput = {
  fieldKey: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  required?: boolean;
  displayOrder?: number;
  options?: string[];
};

export function validateFieldDefinitions(input: unknown): FieldDefinitionInput[] {
  if (!Array.isArray(input)) throw new ValidationError('fields must be an array');
  const keys = new Set<string>();
  return input.map((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError(`Invalid field definition at position ${index + 1}`);
    const field = raw as Record<string, unknown>;
    if (typeof field.fieldKey !== 'string' || !/^[a-z][a-z0-9_]{0,79}$/.test(field.fieldKey)) throw new ValidationError('Field keys must use lowercase letters, numbers and underscores');
    if (keys.has(field.fieldKey)) throw new ValidationError(`Duplicate field key: ${field.fieldKey}`);
    keys.add(field.fieldKey);
    if (typeof field.label !== 'string' || !field.label.trim() || field.label.length > 255) throw new ValidationError(`A label is required for ${field.fieldKey}`);
    if (!['text', 'number', 'date', 'boolean', 'select'].includes(String(field.type))) throw new ValidationError(`Invalid type for ${field.fieldKey}`);
    const type = field.type as FieldDefinitionInput['type'];
    const options = field.options === undefined ? [] : field.options;
    if (!Array.isArray(options) || options.some((option) => typeof option !== 'string' || !option.trim())) throw new ValidationError(`Options for ${field.fieldKey} must be non-empty strings`);
    if (type === 'select' && options.length === 0) throw new ValidationError(`Select field ${field.fieldKey} requires options`);
    if (type !== 'select' && options.length > 0) throw new ValidationError(`Only select fields may have options (${field.fieldKey})`);
    if (field.required !== undefined && typeof field.required !== 'boolean') throw new ValidationError(`required must be boolean for ${field.fieldKey}`);
    return { fieldKey: field.fieldKey, label: field.label.trim(), type, required: field.required === true, displayOrder: Number.isInteger(field.displayOrder) ? Number(field.displayOrder) : index, options: (options as string[]).map((item) => item.trim()) };
  });
}

export function validateCustomFieldValues(fields: AssetTypeField[], input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('customFields must be an object');
  const values = input as Record<string, unknown>;
  const byKey = new Map(fields.map((field) => [field.fieldKey, field]));
  for (const key of Object.keys(values)) if (!byKey.has(key)) throw new ValidationError(`Unknown custom field: ${key}`);
  const output: Record<string, unknown> = {};
  for (const field of fields) {
    const value = values[field.fieldKey];
    const empty = value === undefined || value === null || value === '';
    if (empty) {
      if (field.required) throw new ValidationError(`${field.label} is required`);
      continue;
    }
    switch (field.type) {
      case 'text':
        if (typeof value !== 'string') throw new ValidationError(`${field.label} must be text`);
        output[field.fieldKey] = value.trim().slice(0, 2000);
        break;
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new ValidationError(`${field.label} must be a number`);
        output[field.fieldKey] = value;
        break;
      case 'date': {
        const date = value instanceof Date ? value : new Date(String(value));
        if (Number.isNaN(date.getTime())) throw new ValidationError(`${field.label} must be a valid date`);
        output[field.fieldKey] = date.toISOString().slice(0, 10);
        break;
      }
      case 'boolean':
        if (typeof value !== 'boolean') throw new ValidationError(`${field.label} must be true or false`);
        output[field.fieldKey] = value;
        break;
      case 'select':
        if (typeof value !== 'string' || !(field.options as string[]).includes(value)) throw new ValidationError(`Select a valid ${field.label}`);
        output[field.fieldKey] = value;
        break;
    }
  }
  return output;
}
