import { pgTable, serial, varchar, text, timestamp, pgEnum, integer, boolean } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['admin', 'main_technician', 'technician']);
export const assetStatusEnum = pgEnum('asset_status', ['available', 'in_use', 'maintenance', 'retired']);
export const assetCategoryEnum = pgEnum('asset_category', [
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
]);

// Colleges/Institutions table for scaling to multiple colleges
export const colleges = pgTable('colleges', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(), // e.g., "MIT", "MCODS", "MCHP"
  address: text('address'),
  contactEmail: varchar('contact_email', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Labs/Departments table
export const labs = pgTable('labs', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull(), // e.g., "ENG-LAB-001"
  department: varchar('department', { length: 255 }), // e.g., "Mechanical Engineering"
  building: varchar('building', { length: 255 }),
  floor: varchar('floor', { length: 50 }),
  roomNumber: varchar('room_number', { length: 50 }),
  collegeId: integer('college_id').references(() => colleges.id).notNull(),
  capacity: integer('capacity'), // Max students/users
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Users table with roles
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull().default('technician'),
  collegeId: integer('college_id').references(() => colleges.id).notNull(),
  labId: integer('lab_id').references(() => labs.id), // Main lab assignment (optional)
  phone: varchar('phone', { length: 50 }),
  employeeId: varchar('employee_id', { length: 100 }),
  isActive: boolean('is_active').notNull().default(true),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Updated Assets table with lab and user references
export const assets = pgTable('assets', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: assetCategoryEnum('category').notNull(),
  manufacturer: varchar('manufacturer', { length: 255 }),
  model: varchar('model', { length: 255 }),
  serialNumber: varchar('serial_number', { length: 255 }),
  labId: integer('lab_id').references(() => labs.id).notNull(),
  location: varchar('location', { length: 255 }).notNull(), // Specific location within lab
  status: assetStatusEnum('status').notNull().default('available'),
  purchaseDate: timestamp('purchase_date'),
  warrantyExpiry: timestamp('warranty_expiry'),
  notes: text('notes'),
  createdById: integer('created_by_id').references(() => users.id),
  updatedById: integer('updated_by_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Audit log for tracking changes
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(), // CREATE, UPDATE, DELETE, LOGIN, etc.
  entityType: varchar('entity_type', { length: 50 }).notNull(), // asset, lab, user
  entityId: integer('entity_id').notNull(),
  changes: text('changes'), // JSON string of changes
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export type College = typeof colleges.$inferSelect;
export type NewCollege = typeof colleges.$inferInsert;
export type Lab = typeof labs.$inferSelect;
export type NewLab = typeof labs.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
