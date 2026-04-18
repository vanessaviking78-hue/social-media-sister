import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

export async function runMigrations(): Promise<void> {
  try {
    const alreadyMigrated = await hasClientPresetsNameLowerUnique();
    if (alreadyMigrated) {
      return;
    }

    await deduplicateClientPresets();
    await addClientPresetsNameLowerUniqueIndex();
  } catch (err) {
    logger.error({ err }, "Migration failed");
    throw err;
  }
}

async function hasClientPresetsNameLowerUnique(): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'client_presets'
      AND indexname = 'client_presets_name_lower_unique'
  `);
  return ((result as { rows?: unknown[] }).rows?.length ?? 0) > 0;
}

async function deduplicateClientPresets(): Promise<void> {
  const result = await db.execute(sql`
    DELETE FROM client_presets
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY LOWER(name)
                 ORDER BY
                   CASE WHEN cc_workspace_id IS NOT NULL THEN 0 ELSE 1 END ASC,
                   id ASC
               ) AS rn
        FROM client_presets
      ) ranked
      WHERE rn > 1
    )
  `);
  const deleted = (result as { rowCount?: number }).rowCount ?? 0;
  if (deleted > 0) {
    logger.info({ deleted }, "Removed duplicate client_presets rows");
  }
}

async function addClientPresetsNameLowerUniqueIndex(): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS client_presets_name_lower_unique
    ON client_presets (LOWER(name))
  `);
  logger.info("Created unique index client_presets_name_lower_unique");
}
