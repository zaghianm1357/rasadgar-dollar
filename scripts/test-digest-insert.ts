// تست مسیر تولید خلاصه روزانه: درج دو رویداد موقت برای امروز
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const now = new Date();
const plus2h = new Date(now.getTime() + 2 * 3600 * 1000);
const plus5h = new Date(now.getTime() + 5 * 3600 * 1000);

async function main() {
  await db.economicEvent.deleteMany({ where: { eventKey: { in: ["test-key-1", "test-key-2"] } } });

  await db.economicEvent.createMany({
    data: [
      {
        eventKey: "test-key-1",
        title: "Test Fed Interest Rate Decision",
        country: "USD",
        date: plus2h,
        allDay: false,
        impact: "High",
        forecast: "5.50%",
        previous: "5.25%",
      },
      {
        eventKey: "test-key-2",
        title: "Test Unemployment Claims",
        country: "USD",
        date: plus5h,
        allDay: false,
        impact: "Medium",
        forecast: "220K",
        previous: "210K",
      },
    ],
  });
  console.log("test events inserted");
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
