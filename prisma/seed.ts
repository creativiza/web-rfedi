import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const raw = process.env.SEED_ADMIN_EMAILS;
  if (!raw) {
    console.warn(
      "[seed] SEED_ADMIN_EMAILS not set in env; nothing to seed. Set it in .env.local."
    );
    return;
  }

  const emails = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.warn("[seed] SEED_ADMIN_EMAILS is empty after parsing.");
    return;
  }

  for (const email of emails) {
    const user = await prisma.user.upsert({
      where: { email },
      update: { role: Role.ADMIN, emailVerified: new Date() },
      create: {
        email,
        role: Role.ADMIN,
        emailVerified: new Date(),
        name: email.split("@")[0],
      },
    });
    console.log(`[seed] ensured admin: ${user.email} (id=${user.id})`);
  }
}

main()
  .catch((e) => {
    console.error("[seed] failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
