// پاکسازی رویدادها و خلاصه تستی
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.economicEvent.deleteMany({ where: { eventKey: { in: ["test-key-1", "test-key-2"] } } });
  await db.dailyDigest.deleteMany({});
  const remaining = await db.economicEvent.count();
  console.log("cleaned. remaining events:", remaining);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
