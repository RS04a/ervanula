import {
  Actor,
  Role,
  fault,
  field,
  object,
  requireAdmin,
} from "../../../../libs/full-app/contract";
import { User, email, password } from "../domain/identity";

export interface IdentityRepository {
  credentials(email: string): Promise<(User & { passwordHash: string }) | null>;
  create(
    user: Omit<User, "userId" | "active">,
    passwordHash: string,
  ): Promise<User>;
  list(merchantId: string, offset: number): Promise<User[]>;
  deactivate(actor: Actor, id: string): Promise<boolean>;
  saveSession(userId: string, digest: string, expiresAt: Date): Promise<void>;
  findSession(digest: string): Promise<User | null>;
  revoke(digest: string): Promise<void>;
}
export interface Secrets {
  hash(password: string): Promise<string>;
  compare(password: string, hash?: string): Promise<boolean>;
  issue(): string;
  digest(token: string): string;
}
export const SESSION_MS = 8 * 60 * 60 * 1000;

export class Identity {
  constructor(
    private readonly db: IdentityRepository,
    private readonly secrets: Secrets,
  ) {}
  async login(input: unknown) {
    const body = object(input);
    const secret = password(body.password);
    const user = await this.db.credentials(email(body.email));
    const matches = await this.secrets.compare(secret, user?.passwordHash);
    if (!user?.active || !matches)
      fault(401, "INVALID_CREDENTIALS", "Credenciales inválidas");
    const token = this.secrets.issue();
    await this.db.saveSession(
      user.userId,
      this.secrets.digest(token),
      new Date(Date.now() + SESSION_MS),
    );
    return { token };
  }
  async session(token: string) {
    const user = await this.db.findSession(this.secrets.digest(token));
    if (!user?.active)
      fault(401, "UNAUTHENTICATED", "Sesión inválida o vencida");
    return user;
  }
  async logout(token: string) {
    await this.db.revoke(this.secrets.digest(token));
    return { success: true };
  }
  list(actor: Actor, offset: number) {
    requireAdmin(actor);
    return this.db.list(actor.merchantId, offset);
  }
  add(actor: Actor, input: unknown) {
    requireAdmin(actor);
    const body = object(input);
    if (body.role !== "ADMIN" && body.role !== "CASHIER")
      fault(400, "INVALID_ROLE", "Rol inválido");
    return this.create(actor.merchantId, body, body.role);
  }
  async create(merchantId: string, body: Record<string, unknown>, role: Role) {
    const userEmail = email(body.email);
    const displayName = field(body.displayName, "nombre");
    const digest = await this.secrets.hash(password(body.password));
    return this.db.create(
      { merchantId, email: userEmail, displayName, role },
      digest,
    );
  }
  async deactivate(actor: Actor, id: string) {
    requireAdmin(actor);
    if (id === actor.userId)
      fault(
        409,
        "SELF_DEACTIVATION",
        "La sesión actual debe conservar su usuario",
      );
    if (!(await this.db.deactivate(actor, id)))
      fault(404, "NOT_FOUND", "Usuario inexistente");
    return { success: true };
  }
}
