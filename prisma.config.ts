import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Read lazily rather than with env(): `prisma generate` runs on install,
    // where no database is configured yet.
    url: process.env.DATABASE_URL,
    // Only the embedded `npm run db:dev` server needs this; a real Postgres
    // server lets Prisma create its own temporary shadow database.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || undefined,
  },
});
