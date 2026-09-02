import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Portal@2024';

const users = [
  // Candidates
  { email: 'swaroopkandukuri2002@gmail.com', name: 'Swaroop Kandukuri', role: 'CANDIDATE' },
  { email: 'premagale72@gmail.com',           name: 'Prem Agale',        role: 'CANDIDATE' },
  { email: 'parthmishra43@gmail.com',         name: 'Parth Mishra',      role: 'CANDIDATE' },

  // Managers
  { email: 'parth.mishra@recykal.com',        name: 'Parth Mishra',      role: 'MANAGER' },
  { email: 'swaroop.kandukuri@recykal.com',   name: 'Swaroop Kandukuri', role: 'MANAGER' },
  { email: 'prem.agale@recykal.com',          name: 'Prem Agale',        role: 'MANAGER' },

  // Interviewer
  { email: 'harshvardhan.sahu@recykal.com',   name: 'Harshvardhan Sahu', role: 'INTERVIEWER' },

  // Admin
  { email: 'josna.theresa@recykal.com',       name: 'Josna Theresa',     role: 'ADMIN' },
];

async function main() {
  console.log('Seeding real users...');
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { email: u.email, password: hashed, name: u.name, role: u.role },
    });
    console.log(`✓ ${u.role.padEnd(12)} ${u.email}`);
  }

  console.log(`\nAll users created. Default password: ${DEFAULT_PASSWORD}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
