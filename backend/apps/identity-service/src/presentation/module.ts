import {
  Body,
  Controller,
  Get,
  Inject,
  Module,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { Identity } from "../application/identity";
import { PrismaIdentity } from "../infrastructure/prisma";
import { NodeSecrets } from "../infrastructure/secrets";
import {
  authenticateService,
  sessionToken,
} from "../../../../libs/full-app/service-http";
import { fault } from "../../../../libs/full-app/contract";

@Controller("internal/identity")
class IdentityController {
  constructor(
    @Inject(Identity) private readonly identity: Identity,
    @Inject(PrismaIdentity) private readonly repository: PrismaIdentity,
  ) {}
  @Get("health") async health() {
    await this.repository.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
  @Post("login") login(@Req() req: Request, @Body() input: unknown) {
    authenticateService(req, ["gateway"]);
    return this.identity.login(input);
  }
  @Get("session") session(@Req() req: Request) {
    authenticateService(req, [
      "gateway",
      "merchant",
      "inventory",
      "sales",
      "cash",
      "payments",
      "imports",
      "analytics",
    ]);
    return this.identity.session(sessionToken(req));
  }
  @Post("logout") logout(@Req() req: Request) {
    authenticateService(req, ["gateway"]);
    return this.identity.logout(sessionToken(req));
  }
  @Get("users") async users(
    @Req() req: Request,
    @Query("offset") offset = "0",
  ) {
    authenticateService(req, ["gateway"]);
    if (!/^\d{1,6}$/.test(offset))
      fault(400, "INVALID_OFFSET", "Paginación inválida");
    return this.identity.list(
      await this.identity.session(sessionToken(req)),
      Number(offset),
    );
  }
  @Post("users") async add(@Req() req: Request, @Body() input: unknown) {
    authenticateService(req, ["gateway"]);
    return this.identity.add(
      await this.identity.session(sessionToken(req)),
      input,
    );
  }
  @Post("users/:id/deactivate") async deactivate(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    authenticateService(req, ["gateway"]);
    return this.identity.deactivate(
      await this.identity.session(sessionToken(req)),
      id,
    );
  }
}
@Module({
  controllers: [IdentityController],
  providers: [
    { provide: PrismaIdentity, useFactory: () => new PrismaIdentity() },
    {
      provide: Identity,
      inject: [PrismaIdentity],
      useFactory: (repository: PrismaIdentity) =>
        new Identity(repository, new NodeSecrets()),
    },
  ],
})
export class IdentityModule {}
