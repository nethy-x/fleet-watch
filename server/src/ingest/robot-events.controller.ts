import { Body, Controller, NotImplementedException, Post, UseGuards } from "@nestjs/common";
import type { Robot } from "@prisma/client";
import { CurrentRobot } from "../auth/current-robot.decorator";
import { RobotTokenGuard } from "../auth/robot-token.guard";

/** The robots' lane. The wire format is in the README (§ Robot wire format). */
@Controller("robot/events")
@UseGuards(RobotTokenGuard)
export class RobotEventsController {
  @Post()
  ingest(@CurrentRobot() _robot: Robot, @Body() _body: unknown) {
    throw new NotImplementedException("event ingest is not implemented yet");
  }
}
