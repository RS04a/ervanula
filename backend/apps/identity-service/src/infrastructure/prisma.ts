import { PrismaClient, Prisma } from "@arveluna/identity-db";
import { Actor, fault } from "../../../../libs/full-app/contract";
import { IdentityRepository } from "../application/identity";
import { User } from "../domain/identity";

const fields = {
  id: true,
  merchantId: true,
  email: true,
  displayName: true,
  role: true,
  active: true,
} as const;
function user({
  id,
  merchantId,
  email,
  displayName,
  role,
  active,
}: Omit<User, "userId"> & { id: string }): User {
  return { userId: id, merchantId, email, displayName, role, active };
}
export class PrismaIdentity implements IdentityRepository {
  constructor(readonly db = new PrismaClient()) {}
  async onModuleDestroy() {
    await this.db.$disconnect();
  }
  async credentials(email: string) {
    const entry = await this.db.user.findUnique({
      where: { email },
      select: { ...fields, passwordHash: true },
    });
    return entry ? { ...user(entry), passwordHash: entry.passwordHash } : null;
  }
  async create(data: Omit<User, "userId" | "active">, passwordHash: string) {
    try {
      return user(
        await this.db.user.create({
          data: { ...data, passwordHash },
          select: fields,
        }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        fault(409, "EMAIL_UNAVAILABLE", "El correo ya está registrado");
      throw error;
    }
  }
  async list(merchantId: string, skip: number) {
    return (
      await this.db.user.findMany({
        where: { merchantId },
        orderBy: { id: "asc" },
        skip,
        take: 25,
        select: fields,
      })
    ).map(user);
  }
  async deactivate(actor: Actor, id: string) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM User WHERE merchantId = ${actor.merchantId} ORDER BY id FOR UPDATE`;
        const current = await tx.user.findFirst({
          where: {
            id: actor.userId,
            merchantId: actor.merchantId,
            role: "ADMIN",
            active: true,
          },
        });
        if (!current)
          fault(403, "FORBIDDEN", "Se requiere un administrador activo");
        const result = await tx.user.updateMany({
          where: { id, merchantId: actor.merchantId },
          data: { active: false },
        });
        if (result.count)
          await tx.session.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        return result.count > 0;
      },
      { isolationLevel: "ReadCommitted" },
    );
  }
  async saveSession(userId: string, tokenDigest: string, expiresAt: Date) {
    await this.db.session.create({ data: { userId, tokenDigest, expiresAt } });
  }
  async findSession(tokenDigest: string) {
    const session = await this.db.session.findFirst({
      where: { tokenDigest, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { user: { select: fields } },
    });
    return session ? user(session.user) : null;
  }
  async revoke(tokenDigest: string) {
    await this.db.session.updateMany({
      where: { tokenDigest, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
