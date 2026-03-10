import { prisma } from "../src/prisma";

async function main() {
  await prisma.user.update({
    where: { email: "admin@wezenstaffing.com" },
    data: {
      role: "SUPER_ADMIN",
      active: true,
      mustChangePassword: true,
    },
  });

  console.log("Admin promoted to SUPER_ADMIN");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
