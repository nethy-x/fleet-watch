import { Module } from "@nestjs/common";
import { RobotTokenGuard } from "../auth/robot-token.guard";
import { RobotEventsController } from "./robot-events.controller";

@Module({ controllers: [RobotEventsController], providers: [RobotTokenGuard] })
export class IngestModule {}
