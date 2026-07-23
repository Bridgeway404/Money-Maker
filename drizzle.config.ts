import { defineConfig } from 'drizzle-kit'

// Schema generation (`npm run db:generate`) works entirely offline.
// Commands that touch a database use the UNPOOLED connection string, per the
// Neon guidance that migrations must not run through the pooler. The actual
// migration entry point is `scripts/migrate.mjs`, which adds a production
// guard in front of drizzle-kit — use `npm run db:migrate`, not
// `drizzle-kit migrate` directly.
export default defineConfig({
  schema: './drizzle/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? '',
  },
  strict: true,
  verbose: true,
})
