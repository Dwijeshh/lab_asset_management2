import { pgTable, serial, varchar, text, timestamp, pgEnum, integer, boolean, index, unique, jsonb } from 'drizzle-orm/pg-core';

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
export const assetModificationRequestStatusEnum = pgEnum('asset_modification_request_status', [
  'pending',
  'approved',
  'rejected',
]);
export const customFieldTypeEnum = pgEnum('custom_field_type', ['text', 'number', 'date', 'boolean', 'select']);
export const reportDeliveryStatusEnum = pgEnum('report_delivery_status', ['pending', 'sending', 'sent', 'failed']);

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
  passwordHash: varchar('password_hash', { length: 255 }), // null for SSO-provisioned accounts
  keycloakSub: varchar('keycloak_sub', { length: 255 }).unique(), // Keycloak subject id (SSO link)
  sessionVersion: integer('session_version').notNull().default(0), // bumped to revoke all sessions
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

export const assetTypes = pgTable('asset_types', {
  id: serial('id').primaryKey(),
  collegeId: integer('college_id').references(() => colleges.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  legacyCategory: assetCategoryEnum('legacy_category'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [unique('asset_types_college_name_unique').on(table.collegeId, table.name)]);

export const assetTypeFields = pgTable('asset_type_fields', {
  id: serial('id').primaryKey(),
  assetTypeId: integer('asset_type_id').references(() => assetTypes.id, { onDelete: 'cascade' }).notNull(),
  fieldKey: varchar('field_key', { length: 80 }).notNull(),
  label: varchar('label', { length: 255 }).notNull(),
  type: customFieldTypeEnum('type').notNull(),
  required: boolean('required').notNull().default(false),
  displayOrder: integer('display_order').notNull().default(0),
  options: jsonb('options').$type<string[]>().notNull().default([]),
}, (table) => [unique('asset_type_fields_type_key_unique').on(table.assetTypeId, table.fieldKey), index('atf_type_idx').on(table.assetTypeId)]);

// Updated Assets table with lab and user references
export const assets = pgTable('assets', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: assetCategoryEnum('category').notNull(),
  manufacturer: varchar('manufacturer', { length: 255 }),
  model: varchar('model', { length: 255 }),
  serialNumber: varchar('serial_number', { length: 255 }),
  collegeId: integer('college_id').references(() => colleges.id),
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
  removedAt: timestamp('removed_at'),
  removedById: integer('removed_by_id').references(() => users.id),
  removalReason: text('removal_reason'),
  assetTypeId: integer('asset_type_id').references(() => assetTypes.id),
  customFields: jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({}),
}, (table) => [
  index('assets_removed_idx').on(table.removedAt),
  index('assets_type_idx').on(table.assetTypeId),
  index('assets_lab_removed_idx').on(table.labId, table.removedAt),
]);

// Technician-proposed edits to an existing asset. The asset FK is nullable so
// request history survives asset deletion; assetName preserves its label.
export const assetModificationRequests = pgTable('asset_modification_requests', {
  id: serial('id').primaryKey(),
  collegeId: integer('college_id').references(() => colleges.id).notNull(),
  assetId: integer('asset_id').references(() => assets.id, { onDelete: 'set null' }),
  assetTypeId: integer('asset_type_id').references(() => assetTypes.id, { onDelete: 'set null' }),
  assetName: varchar('asset_name', { length: 255 }).notNull(),
  labId: integer('lab_id').references(() => labs.id).notNull(),
  requestedById: integer('requested_by_id').references(() => users.id).notNull(),
  proposedChanges: jsonb('proposed_changes').$type<Record<string, unknown>>().notNull(),
  originalValues: jsonb('original_values').$type<Record<string, unknown>>().notNull(),
  reason: text('reason').notNull(),
  status: assetModificationRequestStatusEnum('status').notNull().default('pending'),
  reviewedById: integer('reviewed_by_id').references(() => users.id),
  reviewNote: text('review_note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  reviewedAt: timestamp('reviewed_at'),
}, (table) => [
  index('amr_status_idx').on(table.status),
  index('amr_asset_idx').on(table.assetId),
  index('amr_type_idx').on(table.assetTypeId),
  index('amr_lab_idx').on(table.labId),
  index('amr_requester_idx').on(table.requestedById),
  index('amr_college_idx').on(table.collegeId),
]);

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
export type AssetModificationRequest = typeof assetModificationRequests.$inferSelect;
export type NewAssetModificationRequest = typeof assetModificationRequests.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// ─── Borrowing / Request System ──────────────────────────────────────────────

export const requestStatusEnum = pgEnum('request_status', ['pending', 'approved', 'rejected']);
export const loanTypeEnum = pgEnum('loan_type', ['temporary', 'permanent']);
export const loanStatusEnum = pgEnum('loan_status', ['active', 'returned']);
export const notificationTypeEnum = pgEnum('notification_type', [
  'request_received',
  'request_approved',
  'request_rejected',
  'loan_returned',
  'asset_created',
  'asset_updated',
  'asset_deleted',
  'asset_imported',
]);

// Tracks a technician's request to borrow/transfer an asset
export const assetRequests = pgTable('asset_requests', {
  id: serial('id').primaryKey(),
  assetId: integer('asset_id').references(() => assets.id).notNull(),
  requesterId: integer('requester_id').references(() => users.id).notNull(),
  requesterLabId: integer('requester_lab_id').references(() => labs.id).notNull(),
  requesterCollegeId: integer('requester_college_id').references(() => colleges.id).notNull(),
  ownerCollegeId: integer('owner_college_id').references(() => colleges.id).notNull(),
  loanType: loanTypeEnum('loan_type').notNull().default('temporary'),
  status: requestStatusEnum('status').notNull().default('pending'),
  notes: text('notes'),
  expectedReturnDate: timestamp('expected_return_date'), // borrower's proposed date (temporary loans)
  reviewedById: integer('reviewed_by_id').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('ar_asset_idx').on(table.assetId),
  index('ar_requester_idx').on(table.requesterId),
  index('ar_status_idx').on(table.status),
]);

// Active and historical loans (created when a request is approved)
export const assetLoans = pgTable('asset_loans', {
  id: serial('id').primaryKey(),
  requestId: integer('request_id').references(() => assetRequests.id).notNull(),
  assetId: integer('asset_id').references(() => assets.id).notNull(),
  borrowerId: integer('borrower_id').references(() => users.id).notNull(),
  borrowerLabId: integer('borrower_lab_id').references(() => labs.id).notNull(),
  approverId: integer('approver_id').references(() => users.id).notNull(),
  loanType: loanTypeEnum('loan_type').notNull().default('temporary'),
  loanDate: timestamp('loan_date').notNull().defaultNow(),
  expectedReturnDate: timestamp('expected_return_date'), // null for permanent transfers
  actualReturnDate: timestamp('actual_return_date'),
  status: loanStatusEnum('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('al_asset_idx').on(table.assetId),
  index('al_borrower_idx').on(table.borrowerId),
  index('al_status_idx').on(table.status),
]);

// Per-user in-app notification feed
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').notNull().default(false),
  relatedRequestId: integer('related_request_id').references(() => assetRequests.id),
  relatedLoanId: integer('related_loan_id').references(() => assetLoans.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  index('notif_user_idx').on(table.userId),
  index('notif_read_idx').on(table.isRead),
]);

export type AssetRequest = typeof assetRequests.$inferSelect;
export type NewAssetRequest = typeof assetRequests.$inferInsert;
export type AssetLoan = typeof assetLoans.$inferSelect;
export type NewAssetLoan = typeof assetLoans.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

// Join table for head technician lab assignments (role main_technician)
export const labAssignments = pgTable('lab_assignments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  labId: integer('lab_id').references(() => labs.id).notNull(),
  assignedById: integer('assigned_by_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  unique('lab_assignments_user_lab_unique').on(table.userId, table.labId),
  index('la_user_idx').on(table.userId),
  index('la_lab_idx').on(table.labId),
]);

export type LabAssignment = typeof labAssignments.$inferSelect;
export type NewLabAssignment = typeof labAssignments.$inferInsert;

export const reportSettings = pgTable('report_settings', {
  collegeId: integer('college_id').primaryKey().references(() => colleges.id),
  enabled: boolean('enabled').notNull().default(false),
  timezone: varchar('timezone', { length: 100 }).notNull().default('Asia/Kolkata'),
  updatedById: integer('updated_by_id').references(() => users.id),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const reportRecipients = pgTable('report_recipients', {
  id: serial('id').primaryKey(),
  collegeId: integer('college_id').references(() => colleges.id).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  labIds: jsonb('lab_ids').$type<number[]>().notNull(),
  active: boolean('active').notNull().default(true),
  createdById: integer('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [index('rr_college_idx').on(table.collegeId), index('rr_active_idx').on(table.active)]);

export const reportDeliveries = pgTable('report_deliveries', {
  id: serial('id').primaryKey(),
  recipientId: integer('recipient_id').references(() => reportRecipients.id).notNull(),
  period: varchar('period', { length: 7 }).notNull(),
  status: reportDeliveryStatusEnum('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [unique('report_deliveries_recipient_period_unique').on(table.recipientId, table.period), index('rd_status_idx').on(table.status)]);

export const importBatches = pgTable('import_batches', {
  id: serial('id').primaryKey(),
  token: varchar('token', { length: 128 }).notNull().unique(),
  userId: integer('user_id').references(() => users.id).notNull(),
  collegeId: integer('college_id').references(() => colleges.id).notNull(),
  labId: integer('lab_id').references(() => labs.id).notNull(),
  assetTypeId: integer('asset_type_id').references(() => assetTypes.id),
  rows: jsonb('rows').$type<Record<string, unknown>[]>().notNull(),
  status: varchar('status', { length: 20 }).notNull().default('preview'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [index('ib_user_idx').on(table.userId), index('ib_expiry_idx').on(table.expiresAt)]);

export type AssetType = typeof assetTypes.$inferSelect;
export type AssetTypeField = typeof assetTypeFields.$inferSelect;
export type ReportRecipient = typeof reportRecipients.$inferSelect;
