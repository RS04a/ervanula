import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { PaymentsModule } from "./presentation/routes-or-modules/payments.module";
import {
  PublicErrorFilter,
  requestContext,
} from "../../../libs/contracts/http";
export async function createPaymentsApp() {
  const app = await NestFactory.create(PaymentsModule, {
    logger: ["error", "warn"],
  });
  app.use(requestContext);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new PublicErrorFilter());
  app.enableShutdownHooks();
  SwaggerModule.setup(
    "docs",
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("ARVELUNA Payments interno")
        .setVersion("1")
        .build(),
    ),
  );
  return app;
}
if (require.main === module)
  void createPaymentsApp().then((app) =>
    app.listen(Number(process.env.PAYMENTS_PORT ?? 3001), "127.0.0.1"),
  );
