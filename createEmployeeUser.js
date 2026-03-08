const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function run() {
  const employeeId = "cmm854hse0003h4v5fg6x5hxr";
  const email = "john.lvn@wezenstaffing.com".trim().toLowerCase();

  const passwordHash = crypto
    .createHash("sha256")
    .update("ChangeMe123!")
    .digest("hex");

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: "EMPLOYEE",
      employeeId,
    },
    create: {
      email,
      role: "EMPLOYEE",
      employeeId,
      passwordHash,
      mustChangePassword: true,
    },
  });

  console.log("User created/updated:", user);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
