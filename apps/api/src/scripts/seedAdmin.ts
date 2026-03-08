import bcrypt from "bcryptjs";
import { prisma } from "../prisma";

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL!;
  const password = process.env.SEED_ADMIN_PASSWORD!;
  if (!email || !password) throw new Error("Missing SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD");

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", passwordHash },
    create: { email, role: "ADMIN", passwordHash },
  });

  console.log("Seeded admin:", { id: user.id, email: user.email, role: user.role });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
