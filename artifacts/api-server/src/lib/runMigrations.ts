// deploy: ensure before_after_submissions table 134246
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
    await backfillPersonalityProfileDefaults();
    await createBeforeAfterSubmissionsTable();
    await createClientChecklistTable();
    await createResourceLibraryTable();
    await createRevenueIdeasTable();
    await createClientBackgroundsTable();
    await createPortalPushSubscriptionsTable();
    await addRevenueIdeasIdeaIndexColumn();
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
            ORDER BY id ASC
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
      default_first_comment_single = COALESCE(NULLIF(TRIM(default_first_comment_single), ''), 'Save this for later'),
      default_first_comment_reel = COALESCE(NULLIF(TRIM(default_first_comment_reel), ''), 'Save this and share to someone who needs to know')
    WHERE
      default_first_comment_carousel IS NULL OR TRIM(default_first_comment_carousel) = ''
      OR default_first_comment_single IS NULL OR TRIM(default_first_comment_single) = ''
      OR default_first_comment_reel IS NULL OR TRIM(default_first_comment_reel) = ''
  `);
  const updated = (result as { rowCount?: number }).rowCount ?? 0;
  if (updated > 0) {
    logger.info({ updated }, "Backfilled default first-comment CTAs on existing client presets");
  }
}

async function backfillPersonalityProfileDefaults(): Promise<void> {
  const DEFAULT_TARGET_AUDIENCE = "Women over 35, perimenopause, women in the local area, who want to feel good in themselves";
  const DEFAULT_CONTENT_PILLARS = "Set by Vanessa's spreadsheets";
  const DEFAULT_BRAND_NOTES = "Warm, affable, friendly, personality over professionalism. Affable.";

  const result = await db.execute(sql`
    UPDATE client_presets
    SET
      target_audience = COALESCE(NULLIF(TRIM(target_audience), ''), ${DEFAULT_TARGET_AUDIENCE}),
      content_pillars = COALESCE(NULLIF(TRIM(content_pillars), ''), ${DEFAULT_CONTENT_PILLARS}),
      brand_notes = COALESCE(NULLIF(TRIM(brand_notes), ''), ${DEFAULT_BRAND_NOTES})
    WHERE
      target_audience IS NULL OR TRIM(target_audience) = ''
      OR content_pillars IS NULL OR TRIM(content_pillars) = ''
      OR brand_notes IS NULL OR TRIM(brand_notes) = ''
  `);
  const updated = (result as { rowCount?: number }).rowCount ?? 0;
  logger.info({ updated }, "Backfilled default personality profile fields on existing client presets");
}

async function normalizeTextPositionValues(): Promise<void> {
  const result = await db.execute(sql`
    UPDATE client_presets
    SET text_position = CASE
      WHEN text_position LIKE 'top-%' THEN 'top'
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

async function createBeforeAfterSubmissionsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS before_after_submissions (
      id SERIAL PRIMARY KEY,
      preset_id INTEGER,
      client_name TEXT NOT NULL DEFAULT '',
      before_url TEXT NOT NULL DEFAULT '',
      after_url TEXT NOT NULL DEFAULT '',
      treatment TEXT NOT NULL DEFAULT '',
      story TEXT NOT NULL DEFAULT '',
      submitter_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function createClientChecklistTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS client_checklist (
      id SERIAL PRIMARY KEY,
      preset_id INTEGER NOT NULL UNIQUE REFERENCES client_presets(id) ON DELETE CASCADE,
      hex_colours BOOLEAN NOT NULL DEFAULT FALSE,
      images BOOLEAN NOT NULL DEFAULT FALSE,
      bulk_carousels BOOLEAN NOT NULL DEFAULT FALSE,
      seamless_carousels BOOLEAN NOT NULL DEFAULT FALSE,
      quotes BOOLEAN NOT NULL DEFAULT FALSE,
      before_afters BOOLEAN NOT NULL DEFAULT FALSE,
      footnote_logo BOOLEAN NOT NULL DEFAULT FALSE,
      connected_accounts BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function createResourceLibraryTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS resource_library (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      file_key TEXT NOT NULL,
      file_name TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// Weekly revenue-idea drafts. Vanessa reviews and edits each draft before it's
// approved and shown on that client's portal.
async function createRevenueIdeasTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS revenue_ideas (
      id SERIAL PRIMARY KEY,
      preset_id INTEGER NOT NULL REFERENCES client_presets(id) ON DELETE CASCADE,
      client_name TEXT NOT NULL DEFAULT '',
      week_of DATE NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      instructions TEXT NOT NULL DEFAULT '',
      draft_content TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS revenue_ideas_preset_week_unique
    ON revenue_ideas (preset_id, week_of)
  `);
}

// Preloaded background images per client for the Seamless Caro Builder.
// anchor_x/anchor_y/anchor_w are stored as fractions (0-1) of a single panel,
// marking where the cut-out person is placed, bottom-anchored, so the same
// registration point repeats identically across every slide once the wide
// composite is sliced.
async function createClientBackgroundsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS client_backgrounds (
      id SERIAL PRIMARY KEY,
      preset_id INTEGER NOT NULL REFERENCES client_presets(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      slide_count INTEGER NOT NULL DEFAULT 3,
      anchor_x DOUBLE PRECISION NOT NULL DEFAULT 0.32,
      anchor_y DOUBLE PRECISION NOT NULL DEFAULT 0.95,
      anchor_w DOUBLE PRECISION NOT NULL DEFAULT 0.34,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// One row per device a client has subscribed to push notifications on, tied to
// their existing portal token rather than any new login. A client can have
// several rows (phone + desktop etc.) — each is a separate push endpoint.
async function createPortalPushSubscriptionsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS portal_push_subscriptions (
      id SERIAL PRIMARY KEY,
      client_portal_token TEXT NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS portal_push_subscriptions_token_idx
    ON portal_push_subscriptions (client_portal_token)
  `);
}

// Moves revenue_ideas from one-idea-per-client-per-week to three, by adding
// an idea_index (1-3) and widening the unique index to include it. Existing
// rows default to idea_index 1, which keeps them intact under the new index.
async function addRevenueIdeasIdeaIndexColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE revenue_ideas
    ADD COLUMN IF NOT EXISTS idea_index INTEGER NOT NULL DEFAULT 1
  `);
  await db.execute(sql`
    DROP INDEX IF EXISTS revenue_ideas_preset_week_unique
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS revenue_ideas_preset_week_index_unique
    ON revenue_ideas (preset_id, week_of, idea_index)
  `);
}
