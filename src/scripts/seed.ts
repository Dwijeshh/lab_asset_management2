import 'dotenv/config';
import { db } from '../db';
import { colleges, labs, users, assets } from '../db/schema';
import { hashPassword } from '../lib/auth-jwt';

async function seed() {
  console.log('🌱 Seeding multi-institution database...');

  try {
    // Clear existing data cleanly in foreign-key order
    await db.delete(assets);
    await db.delete(users);
    await db.delete(labs);
    await db.delete(colleges);

    // 1. Create MAHE colleges
    console.log('Creating MAHE Institutions...');
    const collegeData = await db.insert(colleges).values([
      {
        name: 'Manipal Institute of Technology (MIT)',
        code: 'MIT',
        address: 'Academic Block, Manipal, Karnataka 576104',
        contactEmail: 'mit@manipal.edu',
        contactPhone: '+91-820-2925100',
        isActive: true,
      },
      {
        name: 'Kasturba Medical College (KMC)',
        code: 'KMC',
        address: 'Madhav Nagar, Manipal, Karnataka 576104',
        contactEmail: 'kmc@manipal.edu',
        contactPhone: '+91-820-2922519',
        isActive: true,
      },
      {
        name: 'Manipal College of Dental Sciences (MCODS)',
        code: 'MCODS',
        address: 'Light House Hill Road, Manipal, Karnataka 576104',
        contactEmail: 'mcods@manipal.edu',
        contactPhone: '+91-820-2571201',
        isActive: true,
      },
      {
        name: 'Manipal College of Pharmaceutical Sciences (MCOPS)',
        code: 'MCOPS',
        address: 'Health Sciences Campus, Manipal, Karnataka 576104',
        contactEmail: 'mcops@manipal.edu',
        contactPhone: '+91-820-2922482',
        isActive: true,
      },
    ]).returning();

    console.log(`✅ Created ${collegeData.length} colleges`);

    const mit = collegeData.find(c => c.code === 'MIT')!;
    const kmc = collegeData.find(c => c.code === 'KMC')!;
    const mcods = collegeData.find(c => c.code === 'MCODS')!;
    const mcops = collegeData.find(c => c.code === 'MCOPS')!;

    // 2. Create labs for each institution
    console.log('Creating labs across institutions...');
    const allLabs = await db.insert(labs).values([
      // MIT Labs
      {
        name: 'Computer Science & AI Lab',
        code: 'MIT-CS-101',
        department: 'Computer Science and Engineering',
        building: 'Academic Block 3',
        floor: '1st Floor',
        roomNumber: 'AB3-101',
        collegeId: mit.id,
        capacity: 60,
        isActive: true,
      },
      {
        name: 'Embedded Systems & Robotics Lab',
        code: 'MIT-ECE-204',
        department: 'Electronics & Communication',
        building: 'Academic Block 2',
        floor: '2nd Floor',
        roomNumber: 'AB2-204',
        collegeId: mit.id,
        capacity: 45,
        isActive: true,
      },
      {
        name: 'Additive Manufacturing & Prototyping Lab',
        code: 'MIT-MECH-305',
        department: 'Mechanical Engineering',
        building: 'Workshop Block',
        floor: 'Ground Floor',
        roomNumber: 'WS-005',
        collegeId: mit.id,
        capacity: 35,
        isActive: true,
      },

      // KMC Labs
      {
        name: 'Clinical Simulation & Tele-Health Lab',
        code: 'KMC-SIM-101',
        department: 'Medical Education & Simulation',
        building: 'Medical Sciences Block A',
        floor: '3rd Floor',
        roomNumber: 'MS-301',
        collegeId: kmc.id,
        capacity: 30,
        isActive: true,
      },
      {
        name: 'Bio-Medical Instrumentation Lab',
        code: 'KMC-BMI-202',
        department: 'Physiology & Diagnostics',
        building: 'Diagnostic Center',
        floor: '2nd Floor',
        roomNumber: 'DC-202',
        collegeId: kmc.id,
        capacity: 25,
        isActive: true,
      },

      // MCODS Labs
      {
        name: 'Digital Dentistry & Prosthetics CAD Lab',
        code: 'MCODS-CAD-01',
        department: 'Prosthodontics',
        building: 'Dental Hospital Wing',
        floor: '4th Floor',
        roomNumber: 'DH-401',
        collegeId: mcods.id,
        capacity: 25,
        isActive: true,
      },

      // MCOPS Labs
      {
        name: 'Pharmaceutical Computing & Analysis Lab',
        code: 'MCOPS-PCA-10',
        department: 'Pharmaceutical Quality Assurance',
        building: 'Pharma Block B',
        floor: '1st Floor',
        roomNumber: 'PB-110',
        collegeId: mcops.id,
        capacity: 30,
        isActive: true,
      },
    ]).returning();

    console.log(`✅ Created ${allLabs.length} labs across 4 colleges`);

    const mitCsLab = allLabs.find(l => l.code === 'MIT-CS-101')!;
    const mitEceLab = allLabs.find(l => l.code === 'MIT-ECE-204')!;
    const mitMechLab = allLabs.find(l => l.code === 'MIT-MECH-305')!;
    const kmcSimLab = allLabs.find(l => l.code === 'KMC-SIM-101')!;
    const mcodsCadLab = allLabs.find(l => l.code === 'MCODS-CAD-01')!;
    const mcopsPcaLab = allLabs.find(l => l.code === 'MCOPS-PCA-10')!;

    // 3. Create users with institutional isolation
    console.log('Creating users across institutions...');
    const hashedPassword = await hashPassword('password123');

    const userData = await db.insert(users).values([
      // Global Admin
      {
        email: 'admin@manipal.edu',
        passwordHash: hashedPassword,
        name: 'Dr. Admin Kumar',
        role: 'admin',
        collegeId: mit.id,
        labId: null,
        phone: '+91-9876543210',
        employeeId: 'MAHE-ADM-001',
        isActive: true,
      },

      // MIT Users
      {
        email: 'main.tech@manipal.edu',
        passwordHash: hashedPassword,
        name: 'Rajesh Sharma (MIT Main Tech)',
        role: 'main_technician',
        collegeId: mit.id,
        labId: mitCsLab.id,
        phone: '+91-9876543211',
        employeeId: 'MIT-TECH-001',
        isActive: true,
      },
      {
        email: 'tech1@manipal.edu',
        passwordHash: hashedPassword,
        name: 'Priya Nair (MIT Tech)',
        role: 'technician',
        collegeId: mit.id,
        labId: mitEceLab.id,
        phone: '+91-9876543212',
        employeeId: 'MIT-TECH-002',
        isActive: true,
      },

      // KMC Users
      {
        email: 'kmc.tech@manipal.edu',
        passwordHash: hashedPassword,
        name: 'Dr. Suresh Rao (KMC Main Tech)',
        role: 'main_technician',
        collegeId: kmc.id,
        labId: kmcSimLab.id,
        phone: '+91-9876543220',
        employeeId: 'KMC-TECH-001',
        isActive: true,
      },

      // MCODS Users
      {
        email: 'mcods.tech@manipal.edu',
        passwordHash: hashedPassword,
        name: 'Dr. Ananya Kamath (MCODS Main Tech)',
        role: 'main_technician',
        collegeId: mcods.id,
        labId: mcodsCadLab.id,
        phone: '+91-9876543230',
        employeeId: 'MCODS-TECH-001',
        isActive: true,
      },

      // MCOPS Users
      {
        email: 'mcops.tech@manipal.edu',
        passwordHash: hashedPassword,
        name: 'Sunil Varma (MCOPS Main Tech)',
        role: 'main_technician',
        collegeId: mcops.id,
        labId: mcopsPcaLab.id,
        phone: '+91-9876543240',
        employeeId: 'MCOPS-TECH-001',
        isActive: true,
      },
    ]).returning();

    console.log(`✅ Created ${userData.length} users`);

    const adminUser = userData.find(u => u.email === 'admin@manipal.edu')!;

    // 4. Seed Engineering Assets for each institution
    console.log('Seeding engineering assets across institutions...');
    await db.insert(assets).values([
      // MIT - CS Lab Assets
      {
        name: 'Dell Precision Tower 3660 Workstation',
        category: 'cpu',
        manufacturer: 'Dell',
        model: 'Precision 3660 (Intel Core i9 13900, 64GB RAM, RTX 4080)',
        serialNumber: 'MIT-CS-WK-001',
        collegeId: mit.id,
        labId: mitCsLab.id,
        location: 'Row 1 - Terminal 01',
        status: 'available',
        purchaseDate: new Date('2024-01-15'),
        warrantyExpiry: new Date('2027-01-15'),
        notes: 'AI model training and simulation workstation',
        createdById: adminUser.id,
      },
      {
        name: 'Dell UltraSharp 27" 4K Monitor',
        category: 'monitor',
        manufacturer: 'Dell',
        model: 'U2723QE',
        serialNumber: 'MIT-CS-MN-014',
        collegeId: mit.id,
        labId: mitCsLab.id,
        location: 'Row 1 - Terminal 01',
        status: 'available',
        purchaseDate: new Date('2024-01-15'),
        warrantyExpiry: new Date('2027-01-15'),
        notes: 'Paired with Terminal 01 Workstation',
        createdById: adminUser.id,
      },
      {
        name: 'HP LaserJet Enterprise Multifunction Printer',
        category: 'printer',
        manufacturer: 'HP',
        model: 'LaserJet M635fht',
        serialNumber: 'MIT-CS-PR-001',
        collegeId: mit.id,
        labId: mitCsLab.id,
        location: 'Documentation Corner',
        status: 'available',
        purchaseDate: new Date('2023-08-10'),
        warrantyExpiry: new Date('2026-08-10'),
        notes: 'High volume lab printing system',
        createdById: adminUser.id,
      },
      {
        name: 'Cisco Catalyst 48-Port Managed Switch',
        category: 'network_device',
        manufacturer: 'Cisco',
        model: 'Catalyst 9300-48P',
        serialNumber: 'MIT-CS-SW-002',
        collegeId: mit.id,
        labId: mitCsLab.id,
        location: 'Server Rack 1 - Bay 4',
        status: 'in_use',
        purchaseDate: new Date('2023-04-12'),
        warrantyExpiry: new Date('2028-04-12'),
        notes: 'Core lab networking switch',
        createdById: adminUser.id,
      },
      {
        name: 'Dell PowerEdge R750 Rack Server',
        category: 'server',
        manufacturer: 'Dell',
        model: 'PowerEdge R750 Dual Xeon',
        serialNumber: 'MIT-CS-SRV-001',
        collegeId: mit.id,
        labId: mitCsLab.id,
        location: 'Server Rack 1 - Bay 1',
        status: 'in_use',
        purchaseDate: new Date('2023-06-20'),
        warrantyExpiry: new Date('2028-06-20'),
        notes: 'Lab virtualization and cloud hosting node',
        createdById: adminUser.id,
      },

      // MIT - Electronics Lab Assets
      {
        name: 'Keysight 200MHz 4-Channel Digital Storage Oscilloscope',
        category: 'oscilloscope',
        manufacturer: 'Keysight',
        model: 'DSOX1204G',
        serialNumber: 'MIT-ECE-DSO-005',
        collegeId: mit.id,
        labId: mitEceLab.id,
        location: 'Bench 3',
        status: 'available',
        purchaseDate: new Date('2023-09-05'),
        warrantyExpiry: new Date('2026-09-05'),
        notes: 'Calibrated for signal processing experiments',
        createdById: adminUser.id,
      },
      {
        name: 'Rigol Arbitrary Waveform Function Generator',
        category: 'function_generator',
        manufacturer: 'Rigol',
        model: 'DG1022Z (25MHz)',
        serialNumber: 'MIT-ECE-FG-012',
        collegeId: mit.id,
        labId: mitEceLab.id,
        location: 'Bench 3',
        status: 'available',
        purchaseDate: new Date('2023-10-15'),
        warrantyExpiry: new Date('2026-10-15'),
        notes: 'Dual channel arbitrary waveform generator',
        createdById: adminUser.id,
      },
      {
        name: 'Hakko Temperature Controlled Soldering Station',
        category: 'soldering_station',
        manufacturer: 'Hakko',
        model: 'FX-888D',
        serialNumber: 'MIT-ECE-SLD-008',
        collegeId: mit.id,
        labId: mitEceLab.id,
        location: 'Fabrication Bench 1',
        status: 'available',
        purchaseDate: new Date('2024-02-01'),
        warrantyExpiry: new Date('2026-02-01'),
        notes: 'ESD safe soldering station',
        createdById: adminUser.id,
      },

      // MIT - Mechanical Workshop Assets
      {
        name: 'UltiMaker S5 Dual Extrusion 3D Printer',
        category: 'three_d_printer',
        manufacturer: 'UltiMaker',
        model: 'S5 Pro Bundle',
        serialNumber: 'MIT-MECH-3DP-001',
        collegeId: mit.id,
        labId: mitMechLab.id,
        location: 'Prototyping Room A',
        status: 'available',
        purchaseDate: new Date('2023-11-20'),
        warrantyExpiry: new Date('2026-11-20'),
        notes: 'Engineering-grade filament rapid prototyping',
        createdById: adminUser.id,
      },
      {
        name: 'Computerized Universal Testing Machine (100 kN)',
        category: 'testing_machine',
        manufacturer: 'Instron',
        model: 'Instron 5982',
        serialNumber: 'MIT-MECH-UTM-001',
        collegeId: mit.id,
        labId: mitMechLab.id,
        location: 'Heavy Machinery Bay',
        status: 'available',
        purchaseDate: new Date('2022-05-18'),
        warrantyExpiry: new Date('2027-05-18'),
        notes: 'Tensile and compressive stress testing',
        createdById: adminUser.id,
      },

      // KMC Simulation Lab Assets
      {
        name: 'Lenovo ThinkCentre Neo 50s Desktop',
        category: 'cpu',
        manufacturer: 'Lenovo',
        model: 'Neo 50s Gen 4',
        serialNumber: 'KMC-SIM-PC-001',
        collegeId: kmc.id,
        labId: kmcSimLab.id,
        location: 'Simulation Console 1',
        status: 'available',
        purchaseDate: new Date('2023-07-10'),
        warrantyExpiry: new Date('2026-07-10'),
        notes: 'Patient simulation control station',
        createdById: adminUser.id,
      },
      {
        name: 'Epson 4K Laser Classroom Projector',
        category: 'projector',
        manufacturer: 'Epson',
        model: 'EB-L260F',
        serialNumber: 'KMC-SIM-PRJ-002',
        collegeId: kmc.id,
        labId: kmcSimLab.id,
        location: 'Ceiling Mount - Demo Hall',
        status: 'available',
        purchaseDate: new Date('2023-12-05'),
        warrantyExpiry: new Date('2026-12-05'),
        notes: 'High lumen medical imaging display',
        createdById: adminUser.id,
      },

      // MCODS Dental CAD Lab Assets
      {
        name: 'Formlabs Form 3B+ Dental 3D Printer',
        category: 'three_d_printer',
        manufacturer: 'Formlabs',
        model: 'Form 3B+ (SLA Dental)',
        serialNumber: 'MCODS-3DP-003',
        collegeId: mcods.id,
        labId: mcodsCadLab.id,
        location: '3D Printing Cleanroom',
        status: 'available',
        purchaseDate: new Date('2024-03-01'),
        warrantyExpiry: new Date('2027-03-01'),
        notes: 'Biocompatible resin printing for prosthetics',
        createdById: adminUser.id,
      },
      {
        name: 'Apple Mac Studio M2 Max Workstation',
        category: 'cpu',
        manufacturer: 'Apple',
        model: 'Mac Studio (M2 Max 32GB)',
        serialNumber: 'MCODS-CAD-MAC-01',
        collegeId: mcods.id,
        labId: mcodsCadLab.id,
        location: 'CAD Station 1',
        status: 'available',
        purchaseDate: new Date('2024-01-20'),
        warrantyExpiry: new Date('2027-01-20'),
        notes: 'Dedicated 3D dental modeling terminal',
        createdById: adminUser.id,
      },

      // MCOPS Computing Lab Assets
      {
        name: 'APC Smart-UPS On-Line 3kVA',
        category: 'ups',
        manufacturer: 'Schneider Electric',
        model: 'SRT3000XLI',
        serialNumber: 'MCOPS-UPS-001',
        collegeId: mcops.id,
        labId: mcopsPcaLab.id,
        location: 'Power Distribution Room',
        status: 'in_use',
        purchaseDate: new Date('2023-03-15'),
        warrantyExpiry: new Date('2026-03-15'),
        notes: 'Continuous battery backup for lab instrumentation',
        createdById: adminUser.id,
      },
      {
        name: 'HP ProBook 450 G10 Laptop',
        category: 'laptop',
        manufacturer: 'HP',
        model: 'ProBook 450 G10 (Intel i7)',
        serialNumber: 'MCOPS-LP-004',
        collegeId: mcops.id,
        labId: mcopsPcaLab.id,
        location: 'Mobile Audit Cart',
        status: 'available',
        purchaseDate: new Date('2024-02-10'),
        warrantyExpiry: new Date('2027-02-10'),
        notes: 'Portable data acquisition laptop',
        createdById: adminUser.id,
      },
    ]);

    console.log('✅ Created initial engineering assets across all colleges');

    console.log('\n🎉 Multi-Institution Seeding completed successfully!\n');
    console.log('📝 Available Test Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👑 Admin (Can Switch Between ALL Colleges):');
    console.log('   Email:    admin@manipal.edu');
    console.log('   Password: password123');
    console.log('─────────────────────────────────────────────────────────');
    console.log('🏛️  MIT Main Tech (Locked to MIT):');
    console.log('   Email:    main.tech@manipal.edu');
    console.log('   Password: password123');
    console.log('─────────────────────────────────────────────────────────');
    console.log('🏛️  MIT Technician (Locked to MIT):');
    console.log('   Email:    tech1@manipal.edu');
    console.log('   Password: password123');
    console.log('─────────────────────────────────────────────────────────');
    console.log('🏥 KMC Main Tech (Locked to KMC):');
    console.log('   Email:    kmc.tech@manipal.edu');
    console.log('   Password: password123');
    console.log('─────────────────────────────────────────────────────────');
    console.log('🦷 MCODS Main Tech (Locked to MCODS):');
    console.log('   Email:    mcods.tech@manipal.edu');
    console.log('   Password: password123');
    console.log('─────────────────────────────────────────────────────────');
    console.log('💊 MCOPS Main Tech (Locked to MCOPS):');
    console.log('   Email:    mcops.tech@manipal.edu');
    console.log('   Password: password123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

seed();