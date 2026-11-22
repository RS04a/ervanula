import { ANALYTICS_PAGE_SIZE } from "../../../../libs/full-app/contract";
import { Broker, Outbox } from "../../../../libs/full-app/broker";
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
import {
  actorFor,
  authenticateService,
} from "../../../../libs/full-app/service-http";
import {
  Actor,
  fault,
  field,
  object,
} from "../../../../libs/full-app/contract";
import { offset } from "../../../../libs/full-app/money";
import { Inventory } from "../application/inventory";
import { PrismaInventory } from "../infrastructure/prisma";

@Controller("internal/inventory")
class InventoryController {
  constructor(
    @Inject(Inventory) private readonly inventory: Inventory,
    @Inject(PrismaInventory) private readonly repository: PrismaInventory,
  ) {}
  @Get("health") async health() {
    await this.repository.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
  @Get("products") async products(
    @Req() req: Request,
    @Query("offset") page?: string,
    @Query("search") search = "",
  ) {
    return this.inventory.db.list(
      (await actorFor(req, "inventory")).merchantId,
      offset(page),
      String(search).slice(0, 120),
    );
  }
  @Get("movements") async movements(
    @Req() req: Request,
    @Query("offset") page?: string,
    @Query("productId") id?: string,
  ) {
    return this.inventory.db.movements(
      (await actorFor(req, "inventory")).merchantId,
      offset(page),
      id,
    );
  }
  @Post("products") async create(@Req() req: Request, @Body() body: unknown) {
    return this.inventory.create(await actorFor(req, "inventory"), body);
  }
  @Post("products/:id/edit") async edit(
    @Req() req: Request,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.inventory.edit(await actorFor(req, "inventory"), id, body);
  }
  @Post("products/:id/deactivate") async deactivate(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.inventory.edit(await actorFor(req, "inventory"), id, null);
  }
  @Post("movements") async move(@Req() req: Request, @Body() body: unknown) {
    return this.inventory.move(await actorFor(req, "inventory"), body);
  }
  @Get("catalog/:merchantId/:productId") async catalog(
    @Req() req: Request,
    @Param("merchantId") merchantId: string,
    @Param("productId") id: string,
  ) {
    authenticateService(req, ["sales"]);
    const product = await this.inventory.db.product(merchantId, id);
    if (!product?.active) fault(404, "NOT_FOUND", "Producto no disponible");
    return product;
  }
  @Post("reservations/:merchantId/:saleId") reserve(
    @Req() req: Request,
    @Param("merchantId") merchantId: string,
    @Param("saleId") saleId: string,
    @Body() body: unknown,
  ) {
    authenticateService(req, ["sales"]);
    return this.inventory.reserve(merchantId, saleId, object(body).items);
  }
  @Post("reservations/:merchantId/:saleId/:action") settle(
    @Req() req: Request,
    @Param("merchantId") merchantId: string,
    @Param("saleId") saleId: string,
    @Param("action") action: string,
    @Body() body: unknown,
  ) {
    authenticateService(req, ["sales"]);
    if (action !== "consume" && action !== "release")
      fault(400, "INVALID_ACTION", "Operación inválida");
    const actor: Actor = {
      merchantId,
      userId: field(object(body).userId, "usuario"),
      role: "CASHIER",
    };
    return this.inventory.db.settle(actor, saleId, action);
  }
  @Post("import/:merchantId/:reference") apply(
    @Req() req: Request,
    @Param("merchantId") merchantId: string,
    @Param("reference") reference: string,
    @Body() value: unknown,
  ) {
    authenticateService(req, ["imports"]);
    const body = object(value);
    return this.inventory.import(
      { merchantId, role: "ADMIN", userId: field(body.userId, "usuario") },
      reference,
      body.product,
    );
  }
  @Get("read/:merchantId/products") readProducts(
    @Req() req: Request,
    @Param("merchantId") merchantId: string,
    @Query("offset") page?: string,
  ) {
    authenticateService(req, ["analytics"]);
    return this.inventory.db.list(
      merchantId,
      offset(page),
      "",
      ANALYTICS_PAGE_SIZE,
    );
  }
  @Get("read/:merchantId/movements") readMovements(
    @Req() req: Request,
    @Param("merchantId") merchantId: string,
    @Query("offset") page?: string,
  ) {
    authenticateService(req, ["analytics"]);
    return this.inventory.db.movements(
      merchantId,
      offset(page),
      undefined,
      ANALYTICS_PAGE_SIZE,
    );
  }
}
@Module({
  controllers: [InventoryController],
  providers: [
    { provide: PrismaInventory, useFactory: () => new PrismaInventory() },
    {
      provide: Broker,
      inject: [PrismaInventory],
      useFactory: (db: PrismaInventory) =>
        new Broker("inventory", new Outbox(db.db)),
    },
    {
      provide: Inventory,
      inject: [PrismaInventory],
      useFactory: (db: PrismaInventory) => new Inventory(db),
    },
  ],
})
export class InventoryModule {}
