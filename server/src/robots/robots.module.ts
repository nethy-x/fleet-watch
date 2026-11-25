import { Module } from "@nestjs/common";
import { OperatorGuard } from "../auth/operator.guard";
import { RobotsController } from "./robots.controller";
import { RobotsService } from "./robots.service";

@Module({ controllers: [RobotsController], providers: [RobotsService, OperatorGuard] })
export class RobotsModule {}
