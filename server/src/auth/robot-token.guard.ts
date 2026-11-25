import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Robot } from "@prisma/client";
import type { Request } from "express";
import { PrismaService } from "../prisma/prisma.service";

export type RobotRequest = Request & { robot?: Robot };

/** Admits a robot presenting its preshared token as `Authorization: Bearer <token>`. */
@Injectable()
export class RobotTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RobotRequest>();
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    if (!token) throw new UnauthorizedException("robot token required");
    const robot = await this.prisma.robot.findUnique({ where: { token } });
    if (!robot) throw new UnauthorizedException("unknown robot token");
    req.robot = robot;
    return true;
  }
}
