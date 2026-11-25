import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { configureApp } from "./common/configure-app";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = Number(process.env.PORT ?? 3100);
  await app.listen(port);
  console.log(`fleet-watch server on http://localhost:${port}/api`);
}

void bootstrap();
