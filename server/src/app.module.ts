import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { IngestModule } from "./ingest/ingest.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RobotsModule } from "./robots/robots.module";

@Module({
  imports: [PrismaModule, RobotsModule, IngestModule],
  controllers: [HealthController],
})
export class AppModule {}
