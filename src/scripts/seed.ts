import 'dotenv/config';
import { db } from '../db';
import { colleges, labs, users } from '../db/schema';
import { hashPassword } from '../lib/auth-jwt';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // Create MAHE colleges
    console.log('Creating colleges...');
    const collegeData = await db.insert(colleges).values([
      {
        name: 'Manipal Institute of Technology (MIT)',
        code: 'MIT',
        address: 'Manipal, Karnataka 576104',
        contactEmail: 'info@manipal.edu',
        contactPhone: '+91-820-2925100',
        isActive: true,
      },
      {
        name: 'Kasturba Medical College (KMC)',
        code: 'KMC',
        address: 'Manipal, Karnataka 576104',
        contactEmail: 'kmc@manipal.edu',
        contactPhone: '+91-820-2922519',
        isActive: true,
      },
      {
        name: 'Manipal College of Dental Sciences (MCODS)',
        code: 'MCODS',
        address: 'Manipal, Karnataka 576104',
        contactEmail: 'mcods@manipal.edu',
        contactPhone: '+91-820-2571201',
        isActive: true,
      },
    ]).returning();

    console.log(`✅ Created ${collegeData.length} colleges`);

    // Create sample labs for MIT (Engineering)
    console.log('Creating labs for MIT...');
    const mitCollege = collegeData.find(c => c.code === 'MIT');
    
    if (!mitCollege) {
      throw new Error('MIT college not found');
    }

    const labData = await db.insert(labs).values([
      {
        name: 'Advanced Materials Lab',
        code: 'MIT-LAB-001',
        department: 'Mechanical Engineering',
        building: 'Academic Block A',
        floor: '2nd Floor',
        roomNumber: '201',
        collegeId: mitCollege.id,
        capacity: 30,
        isActive: true,
      },
      {
        name: 'Electronics & Communication Lab',
        code: 'MIT-LAB-002',
        department: 'Electronics & Communication',
        building: 'Academic Block B',
        floor: '3rd Floor',
        roomNumber: '302',
        collegeId: mitCollege.id,
        capacity: 40,
        isActive: true,
      },
      {
        name: 'Computer Science Lab',
        code: 'MIT-LAB-003',
        department: 'Computer Science',
        building: 'IT Block',
        floor: '1st Floor',
        roomNumber: '105',
        collegeId: mitCollege.id,
        capacity: 50,
        isActive: true,
      },
      {
        name: 'Chemical Engineering Lab',
        code: 'MIT-LAB-004',
        department: 'Chemical Engineering',
        building: 'Science Block',
        floor: '2nd Floor',
        roomNumber: '210',
        collegeId: mitCollege.id,
        capacity: 25,
        isActive: true,
      },
    ]).returning();

    console.log(`✅ Created ${labData.length} labs`);

    // Create sample users with different roles
    console.log('Creating users...');
    
    const hashedPassword = await hashPassword('password123'); // Change in production!

    const userData = await db.insert(users).values([
      {
        email: 'admin@manipal.edu',
        passwordHash: hashedPassword,
        name: 'Dr. Admin Kumar',
        role: 'admin',
        collegeId: mitCollege.id,
        labId: null, // Admin has access to all labs
        phone: '+91-9876543210',
        employeeId: 'MIT-ADMIN-001',
        isActive: true,
      },
      {
        email: 'main.tech@manipal.edu',
        passwordHash: hashedPassword,
        name: 'Rajesh Sharma',
        role: 'main_technician',
        collegeId: mitCollege.id,
        labId: labData[0].id, // Materials Lab
        phone: '+91-9876543211',
        employeeId: 'MIT-TECH-001',
        isActive: true,
      },
      {
        email: 'tech1@manipal.edu',
        passwordHash: hashedPassword,
        name: 'Priya Nair',
        role: 'technician',
        collegeId: mitCollege.id,
        labId: labData[1].id, // Electronics Lab
        phone: '+91-9876543212',
        employeeId: 'MIT-TECH-002',
        isActive: true,
      },
      {
        email: 'tech2@manipal.edu',
        passwordHash: hashedPassword,
        name: 'Amit Patel',
        role: 'technician',
        collegeId: mitCollege.id,
        labId: labData[2].id, // CS Lab
        phone: '+91-9876543213',
        employeeId: 'MIT-TECH-003',
        isActive: true,
      },
    ]).returning();

    console.log(`✅ Created ${userData.length} users`);

    console.log('\n🎉 Seeding completed successfully!\n');
    console.log('📝 Sample Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Role: Admin');
    console.log('Email: admin@manipal.edu');
    console.log('Password: password123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Role: Main Technician');
    console.log('Email: main.tech@manipal.edu');
    console.log('Password: password123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Role: Technician');
    console.log('Email: tech1@manipal.edu (or tech2@manipal.edu)');
    console.log('Password: password123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

seed();