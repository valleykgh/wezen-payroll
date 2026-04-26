import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from './auth.js';
const connectionString = process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/wezen_staffing';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
async function main() {
    const passwordHash = await hashPassword('Password123!');
    const emails = [
        'facility1@wezen.com',
        'facility1@wezenstaffing.com',
        'worker1@wezen.com',
        'worker1@wezenstaffing.com',
    ];
    for (const email of emails) {
        const updated = await prisma.user.updateMany({
            where: { email },
            data: { passwordHash },
        });
        console.log(`${email}: updated ${updated.count}`);
    }
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
});
