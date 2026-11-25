import { INestApplication, ValidationPipe } from "@nestjs/common";

/** The request pipeline, shared by `main.ts` and the test app so both behave the same. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix("api");
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
