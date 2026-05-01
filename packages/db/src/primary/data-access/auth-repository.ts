import type { Selectable } from 'kysely';
import type { PrimaryDatabase, PrimaryDbClient } from '../client.js';

export interface User {
  id: string;
  googleId: string;
  email: string;
  createdAt: string;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: string;
}

export interface UserRepository {
  getByGoogleId(googleId: string): Promise<User | null>;
  create(input: { googleId: string; email: string }): Promise<User>;
  getById(id: string): Promise<User | null>;
}

export interface SessionRepository {
  create(userId: string, expiresAt: Date): Promise<Session>;
  getById(id: string): Promise<Session | null>;
  delete(id: string): Promise<void>;
}

type UserRow = Selectable<PrimaryDatabase['users']>;
type SessionRow = Selectable<PrimaryDatabase['sessions']>;

const mapUserRow = (row: UserRow): User => ({
  id: row.id,
  googleId: row.google_id,
  email: row.email,
  createdAt: row.created_at,
});

const mapSessionRow = (row: SessionRow): Session => ({
  id: row.id,
  userId: row.user_id,
  expiresAt: row.expires_at,
});

export const createUserRepository = (db: PrimaryDbClient): UserRepository => ({
  async getByGoogleId(googleId) {
    const row = await db
      .selectFrom('users')
      .selectAll()
      .where('google_id', '=', googleId)
      .executeTakeFirst();
    return row ? mapUserRow(row) : null;
  },

  async create(input) {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await db
      .insertInto('users')
      .values({
        id,
        google_id: input.googleId,
        email: input.email,
        created_at: createdAt,
      })
      .executeTakeFirst();

    return { id, ...input, createdAt };
  },

  async getById(id) {
    const row = await db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? mapUserRow(row) : null;
  },
});

export const createSessionRepository = (db: PrimaryDbClient): SessionRepository => ({
  async create(userId, expiresAt) {
    const id = crypto.randomUUID();
    const expiresAtIso = expiresAt.toISOString();
    await db
      .insertInto('sessions')
      .values({
        id,
        user_id: userId,
        expires_at: expiresAtIso,
      })
      .executeTakeFirst();

    return { id, userId, expiresAt: expiresAtIso };
  },

  async getById(id) {
    const row = await db.selectFrom('sessions').selectAll().where('id', '=', id).executeTakeFirst();
    return row ? mapSessionRow(row) : null;
  },

  async delete(id) {
    await db.deleteFrom('sessions').where('id', '=', id).execute();
  },
});
