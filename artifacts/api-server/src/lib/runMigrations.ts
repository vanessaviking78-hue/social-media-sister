import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

export async function runMigrations(): Promise<void> {
  try {
    await runNameLowerUniqueIndexMigration();
    await normalizeTextPositionValues();
    await addCoverSubheadingColumn();
    await addMetaConnectionColumns();
    await createScheduledPostsTable();
    await addSeamlessLogoConfigColumn();
    await addMusicTrackColumns();
    await addFirstCommentColumns();
    await createDmAutomationsTables();
    await createAboutMeCanvasDraftsTable();
    await addPersonalityProfileColumns();
    await addStickerConfigColumn();
    await addRenderedImageUrlsColumn();
    await backfillFirstCommentDefaults();
  } catch (err) {
    logger.error({ err }, "Migration failed");
    throw err;
  }
}

async function runNameLowerUniqueIndexMigration(): Promise<void> {
  const alreadyMigrated = await hasClientPresetsNameLowerUnique();
  if (alreadyMigrated) {
    return;
  }
  await deduplicateClientPresets();
  await addClientPresetsNameLowerUniqueIndex();
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

async function addCoverSubheadingColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE client_presets
    ADD COLUMN IF NOT EXISTS cover_subheading text NOT NULL DEFAULT ''
  `);
}

async function addMetaConnectionColumns(): Promise<void> {
  await db.execute(sql`ALTER TABLE client_presets ADD COLUMN IF NOT EXISTS meta_page_access_token text`);
  await db.execute(sql`ALTER TABLE client_presets ADD COLUMN IF NOT EXISTS meta_facebook_page_id text`);
  await db.execute(sql`ALTER TABLE client_presets ADD COLUMN IF NOT EXISTS meta_instagram_account_id text`);
}

async function createScheduledPostsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS scheduled_posts (
      id SERIAL PRIMARY KEY,
      preset_id INTEGER NOT NULL,
      client_name TEXT NOT NULL DEFAULT '',
      post_type TEXT NOT NULL DEFAULT 'carousel',
      content JSONB NOT NULL DEFAULT '{}',
      scheduled_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      meta_status TEXT NOT NULL DEFAULT 'pending',
      meta_result JSONB,
      meta_posted_at TIMESTAMPTZ,
      cc_status TEXT NOT NULL DEFAULT 'pending',
      cc_result JSONB,
      cc_posted_at TIMESTAMPTZ,
      is_trial BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function addSeamlessLogoConfigColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE seamless_carousels
    ADD COLUMN IF NOT EXISTS logo_config jsonb
  `);
}

async function addMusicTrackColumns(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE about_me_posts
    ADD COLUMN IF NOT EXISTS music_track jsonb
  `);
  await db.execute(sql`
    ALTER TABLE seamless_carousels
    ADD COLUMN IF NOT EXISTS music_track jsonb
  `);
}

async function addFirstCommentColumns(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE client_presets
    ADD COLUMN IF NOT EXISTS default_first_comment_carousel text,
    ADD COLUMN IF NOT EXISTS default_first_comment_single text,
    ADD COLUMN IF NOT EXISTS default_first_comment_reel text
  `);
  await db.execute(sql`
    ALTER TABLE about_me_posts
    ADD COLUMN IF NOT EXISTS first_comment text
  `);
  await db.execute(sql`
    ALTER TABLE seamless_carousels
    ADD COLUMN IF NOT EXISTS first_comment text
  `);
}

async function createDmAutomationsTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS dm_automations (
      id SERIAL PRIMARY KEY,
      preset_id INTEGER NOT NULL REFERENCES client_presets(id) ON DELETE CASCADE,
      keyword TEXT NOT NULL,
      reply_template TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      match_exact BOOLEAN NOT NULL DEFAULT FALSE,
      case_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS dm_interactions (
      id SERIAL PRIMARY KEY,
      automation_id INTEGER REFERENCES dm_automations(id) ON DELETE SET NULL,
      preset_id INTEGER,
      sender_id TEXT NOT NULL,
      ig_account_id TEXT NOT NULL,
      message_text TEXT NOT NULL,
      matched_keyword TEXT,
      reply_sent BOOLEAN NOT NULL DEFAULT FALSE,
      reply_text TEXT,
      error_message TEXT,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function createAboutMeCanvasDraftsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS about_me_canvas_drafts (
      id SERIAL PRIMARY KEY,
      client_name TEXT NOT NULL UNIQUE,
      state_json TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function addStickerConfigColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE scheduled_posts
    ADD COLUMN IF NOT EXISTS sticker_config jsonb
  `);
}

async function addPersonalityProfileColumns(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE client_presets
    ADD COLUMN IF NOT EXISTS target_audience text,
    ADD COLUMN IF NOT EXISTS content_pillars text,
    ADD COLUMN IF NOT EXISTS brand_notes text
  `);
}

async function addRenderedImageUrlsColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE trial_bundles
    ADD COLUMN IF NOT EXISTS rendered_image_urls jsonb
  `);
}

async function backfillFirstCommentDefaults(): Promise<void> {
  const result = await db.execute(sql`
    UPDATE client_presets
    SET
      default_first_comment_carousel = COALESCE(NULLIF(TRIM(default_first_comment_carousel), ''), 'Share this with a friend'),
      default_first_comment_single   = COALESCE(NULLIF(TRIM(default_first_comment_single),   ''), 'Save this for later'),
      default_first_comment_reel     = COALESCE(NULLIF(TRIM(default_first_comment_reel),     ''), 'Save this and share to someone who needs to know')
    WHERE
      default_first_comment_carousel IS NULL OR TRIM(default_first_comment_carousel) = ''
      OR default_first_comment_single IS NULL OR TRIM(default_first_comment_single) = ''
      OR default_first_comment_reel   IS NULL OR TRIM(default_first_comment_reel)   = ''
  `);
  const updated = (result as { rowCount?: number }).rowCount ?? 0;
  if (updated > 0) {
    logger.info({ updated }, "Backfilled default first-comment CTAs on existing client presets");
  }
}

async function normalizeTextPositionValues(): Promise<void> {
  const result = await db.execute(sql`
    UPDATE client_presets
    SET text_position = CASE
      WHEN text_position LIKE 'top-%'    THEN 'top'
      WHEN text_position LIKE 'center-%' THEN 'center'
      WHEN text_position LIKE 'bottom-%' THEN 'bottom'
      ELSE text_position
    END
    WHERE text_position LIKE '%-%'
  `);
  const updated = (result as { rowCount?: number }).rowCount ?? 0;
  if (updated > 0) {
    logger.info({ updated }, "Normalised legacy compound text_position values in client_presets");
  }
}
