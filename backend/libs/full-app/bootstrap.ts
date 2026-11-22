import "reflect-metadata";
import { Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { PublicErrorFilter, requestContext } from "../contracts/http";
import { Service } from "./contract";
import { port, serviceKey } from "./service-http";

export async function bootstrap(service: Service, module: Type<unknown>) {
  serviceKey(service);
  const app = await NestFactory.create(module, { logger: ["warn", "error"] });
  app.use(requestContext);
  app.useGlobalFilters(new PublicErrorFilter());
  app.enableShutdownHooks();
  SwaggerModule.setup(
    "docs",
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle(`ARVELUNA ${service}`)
        .setVersion("2")
        .build(),
    ),
  );
  return app.listen(port(service), "127.0.0.1");
}
