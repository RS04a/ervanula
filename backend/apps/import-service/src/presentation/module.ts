import { optionalChoice } from "../../../../libs/full-app/contract";
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
import { parse } from "csv-parse/sync";
import { requireAdmin } from "../../../../libs/full-app/contract";
import { actorFor, call } from "../../../../libs/full-app/service-http";
import { offset } from "../../../../libs/full-app/money";
import { Worker } from "../../../../libs/full-app/worker";
import { Imports } from "../application/imports";
import { headers } from "../domain/rows";
import { PrismaImports } from "../infrastructure/prisma";

async function admin(req: Request) {
  const actor = await actorFor(req, "imports");
  requireAdmin(actor);
  return actor;
}
@Controller("internal/imports")
class ImportController {
  constructor(
    @Inject(Imports) private readonly imports: Imports,
    @Inject(PrismaImports) private readonly repository: PrismaImports,
  ) {}
  @Get("health") async health() {
    await this.repository.db.$queryRaw`SELECT 1`;
    return { status: "ok" };
  }
  @Get("template") async template(@Req() req: Request) {
    await admin(req);
    return { filename: "productos.csv", content: headers.join(",") + "\n" };
  }
  @Get("jobs") async list(
    @Req() req: Request,
    @Query("offset") page?: string,
    @Query("status") filter?: string,
  ) {
    return this.imports.db.list(
      (await admin(req)).merchantId,
      offset(page),
      optionalChoice(filter, ["PREVIEW", "RUNNING", "DONE"]),
    );
  }
  @Get("jobs/:id") async get(
    @Req() req: Request,
    @Param("id") id: string,
    @Query("offset") page?: string,
  ) {
    return this.imports.db.job((await admin(req)).merchantId, id, offset(page));
  }
  @Post("jobs") async create(@Req() req: Request, @Body() input: unknown) {
    return this.imports.preview(await admin(req), input);
  }
  @Post("jobs/:id/retry") async retry(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.imports.db.retry((await admin(req)).merchantId, id);
  }
  @Post("jobs/:id/confirm") async confirm(
    @Req() req: Request,
    @Param("id") id: string,
  ) {
    return this.imports.db.confirm((await admin(req)).merchantId, id);
  }
}
@Module({
  controllers: [ImportController],
  providers: [
    { provide: PrismaImports, useFactory: () => new PrismaImports() },
    {
      provide: Imports,
      inject: [PrismaImports],
      useFactory: (db: PrismaImports) =>
        new Imports(
          db,
          (bytes) =>
            parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes), {
              bom: true,
              skip_empty_lines: true,
              relax_column_count: true,
              max_record_size: 1024,
            }) as string[][],
          async (work) => {
            await call(
              "imports",
              "inventory",
              `inventory/import/${work.merchantId}/${work.jobId}-${work.rowNumber}`,
              {
                method: "POST",
                body: { userId: work.userId, product: work.product },
              },
            );
          },
        ),
    },
    {
      provide: Worker,
      inject: [Imports],
      useFactory: (imports: Imports) =>
        new Worker("imports.apply", () => imports.step(), 250),
    },
  ],
})
export class ImportModule {}
