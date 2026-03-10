"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("../prisma");
async function main() {
    const email = process.env.SEED_ADMIN_EMAIL;
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!email || !password)
        throw new Error("Missing SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD");
    const passwordHash = await bcryptjs_1.default.hash(password, 10);
    const user = await prisma_1.prisma.user.upsert({
        where: { email },
        update: { role: "SUPER_ADMIN", passwordHash },
        create: { email, role: "SUPER_ADMIN", passwordHash },
    });
    console.log("Seeded admin:", { id: user.id, email: user.email, role: user.role });
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => prisma_1.prisma.$disconnect());
