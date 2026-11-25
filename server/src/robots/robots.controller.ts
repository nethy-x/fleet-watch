import { Controller, Get, UseGuards } from "@nestjs/common";
import { OperatorGuard } from "../auth/operator.guard";
import { RobotsService } from "./robots.service";

/** The browser's lane. `@CurrentOperator()` gives a handler the person asking. */
@Controller("robots")
@UseGuards(OperatorGuard)
export class RobotsController {
  constructor(private readonly robots: RobotsService) {}

  @Get()
  list() {
    return this.robots.list();
  }
}
