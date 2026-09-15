import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/lib/config";

// Treat empty / whitespace-only values as unset so a blank env var on the
// host produces a clear configuration error instead of a cryptic driver crash.
const databaseUrl = env("DATABASE_URL");

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required. Set it to your Neon/PostgreSQL connection string in the environment."
  );
}

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
