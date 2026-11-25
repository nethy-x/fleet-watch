// Seeds the organizations and robots of ../fleet.seed.json — the same file the
// simulator reads its robot tokens from. Idempotent.
import { PrismaClient, RobotType } from "@prisma/client";
import fleet from "../../fleet.seed.json";

const prisma = new PrismaClient();

export async function seedFleet(db: PrismaClient): Promise<void> {
  for (const org of fleet.organizations) {
    await db.organization.upsert({
      where: { id: org.id },
      update: { name: org.name },
      create: { id: org.id, name: org.name },
    });
  }
  const orgIdByName = new Map(fleet.organizations.map((o) => [o.name, o.id]));
  for (const robot of fleet.robots) {
    const organizationId = orgIdByName.get(robot.organization);
    if (!organizationId) throw new Error(`unknown organization ${robot.organization}`);
    const row = {
      name: robot.name,
      type: robot.type as RobotType,
      token: robot.token,
      organizationId,
    };
    await db.robot.upsert({
      where: { id: robot.id },
      update: row,
      create: { id: robot.id, ...row },
    });
  }
}

if (require.main === module) {
  seedFleet(prisma)
    .then(() => console.log(`seeded ${fleet.robots.length} robots`))
    .finally(() => prisma.$disconnect());
}
