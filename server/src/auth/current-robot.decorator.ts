import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { Robot } from "@prisma/client";
import type { RobotRequest } from "./robot-token.guard";

/** The robot `RobotTokenGuard` resolved for this request. */
export const CurrentRobot = createParamDecorator((_: unknown, context: ExecutionContext): Robot => {
  const robot = context.switchToHttp().getRequest<RobotRequest>().robot;
  if (!robot) throw new UnauthorizedException("robot token required");
  return robot;
});
