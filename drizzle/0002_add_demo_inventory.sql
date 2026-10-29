-- Add the curated sample records to existing staging and production databases.
-- Match colleges by code, labs by college/code, users by email, and assets by
-- serial number. Never delete or overwrite an existing record.

WITH sample_labs (college_code, code, name, department, building, floor, room_number, capacity) AS (
  VALUES
    ('MIT', 'MIT-CS-101', 'Computer Science & AI Lab', 'Computer Science and Engineering', 'Academic Block 3', '1st Floor', 'AB3-101', 60),
    ('MIT', 'MIT-ECE-204', 'Embedded Systems & Robotics Lab', 'Electronics & Communication', 'Academic Block 2', '2nd Floor', 'AB2-204', 45),
    ('MIT', 'MIT-MECH-305', 'Additive Manufacturing & Prototyping Lab', 'Mechanical Engineering', 'Workshop Block', 'Ground Floor', 'WS-005', 35),
    ('KMC', 'KMC-SIM-101', 'Clinical Simulation & Tele-Health Lab', 'Medical Education & Simulation', 'Medical Sciences Block A', '3rd Floor', 'MS-301', 30),
    ('KMC', 'KMC-BMI-202', 'Bio-Medical Instrumentation Lab', 'Physiology & Diagnostics', 'Diagnostic Center', '2nd Floor', 'DC-202', 25),
    ('MCODS', 'MCODS-CAD-01', 'Digital Dentistry & Prosthetics CAD Lab', 'Prosthodontics', 'Dental Hospital Wing', '4th Floor', 'DH-401', 25),
    ('MCOPS', 'MCOPS-PCA-10', 'Pharmaceutical Computing & Analysis Lab', 'Pharmaceutical Quality Assurance', 'Pharma Block B', '1st Floor', 'PB-110', 30)
)
INSERT INTO "labs" ("college_id", "code", "name", "department", "building", "floor", "room_number", "capacity", "is_active")
SELECT c.id, v.code, v.name, v.department, v.building, v.floor, v.room_number, v.capacity, true
FROM sample_labs v
JOIN "colleges" c ON c.code = v.college_code
WHERE NOT EXISTS (
  SELECT 1 FROM "labs" existing WHERE existing.college_id = c.id AND existing.code = v.code
);--> statement-breakpoint

-- Passwords are intentionally unset. Administrators can set a distinct
-- password through User Management before signing in as a new sample user.
-- Existing accounts, including demo logins, keep their current credentials.
WITH sample_users (email, name, role, college_code, lab_code, employee_id) AS (
  VALUES
    ('admin@manipal.edu', 'Dr. Admin Kumar', 'admin', 'MIT', NULL, 'MAHE-ADM-001'),
    ('main.tech@manipal.edu', 'Rajesh Sharma (MIT Main Tech)', 'main_technician', 'MIT', 'MIT-CS-101', 'MIT-TECH-001'),
    ('tech1@manipal.edu', 'Priya Nair (MIT Tech)', 'technician', 'MIT', 'MIT-ECE-204', 'MIT-TECH-002'),
    ('kmc.tech@manipal.edu', 'Dr. Suresh Rao (KMC Main Tech)', 'main_technician', 'KMC', 'KMC-SIM-101', 'KMC-TECH-001'),
    ('mcods.tech@manipal.edu', 'Dr. Ananya Kamath (MCODS Main Tech)', 'main_technician', 'MCODS', 'MCODS-CAD-01', 'MCODS-TECH-001'),
    ('mcops.tech@manipal.edu', 'Sunil Varma (MCOPS Main Tech)', 'main_technician', 'MCOPS', 'MCOPS-PCA-10', 'MCOPS-TECH-001')
)
INSERT INTO "users" ("email", "name", "role", "college_id", "lab_id", "employee_id", "password_hash", "is_active")
SELECT v.email, v.name, v.role::user_role, c.id, l.id, v.employee_id, NULL, true
FROM sample_users v
JOIN "colleges" c ON c.code = v.college_code
LEFT JOIN LATERAL (
  SELECT id FROM "labs" WHERE college_id = c.id AND code = v.lab_code ORDER BY id LIMIT 1
) l ON true
WHERE (v.lab_code IS NULL OR l.id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM "users" existing WHERE lower(existing.email) = lower(v.email))
ON CONFLICT ("email") DO NOTHING;--> statement-breakpoint

WITH sample_assets (college_code, lab_code, name, category, manufacturer, model, serial_number, location, status, purchase_date, warranty_expiry, notes) AS (
  VALUES
    ('MIT', 'MIT-CS-101', 'Dell Precision Tower 3660 Workstation', 'cpu', 'Dell', 'Precision 3660 (Intel Core i9 13900, 64GB RAM, RTX 4080)', 'MIT-CS-WK-001', 'Row 1 - Terminal 01', 'available', '2024-01-15', '2027-01-15', 'AI model training and simulation workstation'),
    ('MIT', 'MIT-CS-101', 'Dell UltraSharp 27" 4K Monitor', 'monitor', 'Dell', 'U2723QE', 'MIT-CS-MN-014', 'Row 1 - Terminal 01', 'available', '2024-01-15', '2027-01-15', 'Paired with Terminal 01 Workstation'),
    ('MIT', 'MIT-CS-101', 'HP LaserJet Enterprise Multifunction Printer', 'printer', 'HP', 'LaserJet M635fht', 'MIT-CS-PR-001', 'Documentation Corner', 'available', '2023-08-10', '2026-08-10', 'High volume lab printing system'),
    ('MIT', 'MIT-CS-101', 'Cisco Catalyst 48-Port Managed Switch', 'network_device', 'Cisco', 'Catalyst 9300-48P', 'MIT-CS-SW-002', 'Server Rack 1 - Bay 4', 'in_use', '2023-04-12', '2028-04-12', 'Core lab networking switch'),
    ('MIT', 'MIT-CS-101', 'Dell PowerEdge R750 Rack Server', 'server', 'Dell', 'PowerEdge R750 Dual Xeon', 'MIT-CS-SRV-001', 'Server Rack 1 - Bay 1', 'in_use', '2023-06-20', '2028-06-20', 'Lab virtualization and cloud hosting node'),
    ('MIT', 'MIT-ECE-204', 'Keysight 200MHz 4-Channel Digital Storage Oscilloscope', 'oscilloscope', 'Keysight', 'DSOX1204G', 'MIT-ECE-DSO-005', 'Bench 3', 'available', '2023-09-05', '2026-09-05', 'Calibrated for signal processing experiments'),
    ('MIT', 'MIT-ECE-204', 'Rigol Arbitrary Waveform Function Generator', 'function_generator', 'Rigol', 'DG1022Z (25MHz)', 'MIT-ECE-FG-012', 'Bench 3', 'available', '2023-10-15', '2026-10-15', 'Dual channel arbitrary waveform generator'),
    ('MIT', 'MIT-ECE-204', 'Hakko Temperature Controlled Soldering Station', 'soldering_station', 'Hakko', 'FX-888D', 'MIT-ECE-SLD-008', 'Fabrication Bench 1', 'available', '2024-02-01', '2026-02-01', 'ESD safe soldering station'),
    ('MIT', 'MIT-MECH-305', 'UltiMaker S5 Dual Extrusion 3D Printer', 'three_d_printer', 'UltiMaker', 'S5 Pro Bundle', 'MIT-MECH-3DP-001', 'Prototyping Room A', 'available', '2023-11-20', '2026-11-20', 'Engineering-grade filament rapid prototyping'),
    ('MIT', 'MIT-MECH-305', 'Computerized Universal Testing Machine (100 kN)', 'testing_machine', 'Instron', 'Instron 5982', 'MIT-MECH-UTM-001', 'Heavy Machinery Bay', 'available', '2022-05-18', '2027-05-18', 'Tensile and compressive stress testing'),
    ('KMC', 'KMC-SIM-101', 'Lenovo ThinkCentre Neo 50s Desktop', 'cpu', 'Lenovo', 'Neo 50s Gen 4', 'KMC-SIM-PC-001', 'Simulation Console 1', 'available', '2023-07-10', '2026-07-10', 'Patient simulation control station'),
    ('KMC', 'KMC-SIM-101', 'Epson 4K Laser Classroom Projector', 'projector', 'Epson', 'EB-L260F', 'KMC-SIM-PRJ-002', 'Ceiling Mount - Demo Hall', 'available', '2023-12-05', '2026-12-05', 'High lumen medical imaging display'),
    ('MCODS', 'MCODS-CAD-01', 'Formlabs Form 3B+ Dental 3D Printer', 'three_d_printer', 'Formlabs', 'Form 3B+ (SLA Dental)', 'MCODS-3DP-003', '3D Printing Cleanroom', 'available', '2024-03-01', '2027-03-01', 'Biocompatible resin printing for prosthetics'),
    ('MCODS', 'MCODS-CAD-01', 'Apple Mac Studio M2 Max Workstation', 'cpu', 'Apple', 'Mac Studio (M2 Max 32GB)', 'MCODS-CAD-MAC-01', 'CAD Station 1', 'available', '2024-01-20', '2027-01-20', 'Dedicated 3D dental modeling terminal'),
    ('MCOPS', 'MCOPS-PCA-10', 'APC Smart-UPS On-Line 3kVA', 'ups', 'Schneider Electric', 'SRT3000XLI', 'MCOPS-UPS-001', 'Power Distribution Room', 'in_use', '2023-03-15', '2026-03-15', 'Continuous battery backup for lab instrumentation'),
    ('MCOPS', 'MCOPS-PCA-10', 'HP ProBook 450 G10 Laptop', 'laptop', 'HP', 'ProBook 450 G10 (Intel i7)', 'MCOPS-LP-004', 'Mobile Audit Cart', 'available', '2024-02-10', '2027-02-10', 'Portable data acquisition laptop')
)
INSERT INTO "assets" ("college_id", "lab_id", "name", "category", "manufacturer", "model", "serial_number", "location", "status", "purchase_date", "warranty_expiry", "notes")
SELECT c.id, l.id, v.name, v.category::asset_category, v.manufacturer, v.model, v.serial_number, v.location,
       v.status::asset_status, v.purchase_date::timestamp, v.warranty_expiry::timestamp,
       'Demo inventory — ' || v.notes
FROM sample_assets v
JOIN "colleges" c ON c.code = v.college_code
JOIN LATERAL (
  SELECT id FROM "labs" WHERE college_id = c.id AND code = v.lab_code ORDER BY id LIMIT 1
) l ON true
WHERE NOT EXISTS (SELECT 1 FROM "assets" existing WHERE existing.serial_number = v.serial_number);
