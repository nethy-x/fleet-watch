import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type RobotRow = {
  id: string;
  name: string;
  type: "G1" | "GO2";
  organization: { id: string; name: string };
};

@Injectable()
export class RobotsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<RobotRow[]> {
    const robots = await this.prisma.robot.findMany({
      orderBy: { name: "asc" },
      include: { organization: true },
    });
    return robots.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      organization: { id: r.organization.id, name: r.organization.name },
    }));
  }
}
