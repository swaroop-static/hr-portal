import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const users = [
    { email: 'admin@company.com',       password: 'admin123',       name: 'System Admin',  role: 'ADMIN' },
    { email: 'manager@company.com',     password: 'manager123',     name: 'Rajesh Kumar',  role: 'MANAGER' },
    { email: 'hr@company.com',          password: 'hr123',          name: 'Priya Sharma',  role: 'HR' },
    { email: 'interviewer@company.com', password: 'interviewer123', name: 'Amit Verma',    role: 'INTERVIEWER' },
  ];

  const created = {};
  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, password: hashed, name: u.name, role: u.role }
    });
    created[u.role] = user;
  }

  await prisma.jobPosition.upsert({
    where: { id: 'pos-001' },
    update: {},
    create: {
      id: 'pos-001',
      title: 'Senior Frontend Developer',
      description: 'Looking for experienced React developer with 3+ years experience.',
      department: 'Engineering',
      vacancies: 2,
      managerId: created['MANAGER'].id,
      status: 'OPEN'
    }
  });

  await prisma.jobPosition.upsert({
    where: { id: 'pos-002' },
    update: {},
    create: {
      id: 'pos-002',
      title: 'HR Business Partner',
      description: 'Experienced HR professional to manage talent acquisition.',
      department: 'Human Resources',
      vacancies: 1,
      managerId: created['MANAGER'].id,
      status: 'OPEN'
    }
  });

  console.log('\n✅ Database seeded!\n');
  console.log('Login credentials:');
  console.log('  Admin:       admin@company.com / admin123');
  console.log('  Manager:     manager@company.com / manager123');
  console.log('  HR:          hr@company.com / hr123');
  console.log('  Interviewer: interviewer@company.com / interviewer123');
  console.log('\n  Candidates are created by HR when adding candidates.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
