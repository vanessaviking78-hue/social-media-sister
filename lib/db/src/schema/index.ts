import { pgTable, text, serial, timestamp, integer, boolean, json, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientPresetsTable = pgTable("client_presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pageColor: text("page_color").notNull().default("#000000"),
  overlayColor: text("overlay_color").notNull().default("rgba(0,0,0,0.5)"),
  fontFamily: text("font_family").notNull().default("Inter, sans-serif"),
  subheadingFont: text("subheading_font"),
  fontSize: integer("font_size").notNull().default(52),
  contentFontSize: integer("content_font_size").notNull().default(44),
  textColor: text("text_color").notNull().default("#ffffff"),
  lineSpacing: text("line_spacing").notNull().default("0.9"),
  cornerStyle: text("corner_style").notNull().default("none"),
  cornerColor: text("corner_color").notNull().default("#d4af37"),
  textPosition: text("text_position").notNull().default("bottom"),
  logoPosition: text("logo_position").notNull().default("top-right"),
  logoSize: integer("logo_size").notNull().default(140),
  logoUrl: text("logo_url"),
  accentColor: text("accent_color").notNull().default("#d4af37"),
  ccWorkspaceId: text("cc_workspace_id"),
  metaPageAccessToken: text("meta_page_access_token"),
  metaFacebookPageId: text("meta_facebook_page_id"),
  metaInstagramAccountId: text("meta_instagram_account_id"),
  textAlign: text("text_align").notNull().default("left"),
  textBoxOutline: boolean("text_box_outline").notNull().default(false),
  textBoxOutlineColor: text("text_box_outline_color").notNull().default("#ffffff"),
  captionFootnote: text("caption_footnote").notNull().default(""),
  coverSubheading: text("cover_subheading").notNull().default(""),
  clientPortalToken: text("client_portal_token").unique(),
  defaultPostTime: text("default_post_time").notNull().default("18:00"),
  onboardingConnectedAt: timestamp("onboarding_connected_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  check("client_presets_text_position_check", sql`${table.textPosition} IN ('top', 'center', 'bottom')`),
  check("client_presets_corner_style_check", sql`${table.cornerStyle} IN ('none', 'triangle', 'arc', 'double-line', 'frame')`),
  check("client_presets_text_align_check", sql`${table.textAlign} IN ('left', 'center', 'right')`),
  check("client_presets_logo_position_check", sql`${table.logoPosition} IN ('top-right', 'top-left', 'bottom-right', 'bottom-left', 'none')`),
]);

export const TEXT_POSITIONS = ["top", "center", "bottom"] as const;
export type TextPosition = typeof TEXT_POSITIONS[number];

export const CORNER_STYLES = ["none", "triangle", "arc", "double-line", "frame"] as const;
export type CornerStyle = typeof CORNER_STYLES[number];

export const TEXT_ALIGNS = ["left", "center", "right"] as const;
export type TextAlign = typeof TEXT_ALIGNS[number];

export const LOGO_POSITIONS = ["top-right", "top-left", "bottom-right", "bottom-left", "none"] as const;
export type LogoPosition = typeof LOGO_POSITIONS[number];

export const insertPresetSchema = createInsertSchema(clientPresetsTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    textPosition: z.enum(TEXT_POSITIONS),
    cornerStyle: z.enum(CORNER_STYLES),
    textAlign: z.enum(TEXT_ALIGNS),
    logoPosition: z.enum(LOGO_POSITIONS),
  });
export type InsertPreset = z.infer<typeof insertPresetSchema>;
export type ClientPreset = typeof clientPresetsTable.$inferSelect;

export const captionsTable = pgTable("captions", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  category: text("category").notNull().default("General"),
  clientName: text("client_name").notNull().default(""),
  favourite: boolean("favourite").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCaptionSchema = createInsertSchema(captionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCaption = z.infer<typeof insertCaptionSchema>;
export type Caption = typeof captionsTable.$inferSelect;

export const CALENDAR_POST_STATUSES = ["draft", "scheduled", "posted"] as const;
export type CalendarPostStatus = typeof CALENDAR_POST_STATUSES[number];

export const CALENDAR_POST_TYPES = ["carousel", "single-image", "story"] as const;
export type CalendarPostType = typeof CALENDAR_POST_TYPES[number];

export const calendarPostsTable = pgTable("calendar_posts", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  clientName: text("client_name").notNull().default(""),
  postType: text("post_type").notNull().default("carousel"),
  title: text("title").notNull().default(""),
  caption: text("caption").notNull().default(""),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("draft"),
  color: text("color").notNull().default("#ec4899"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  check("calendar_posts_status_check", sql`${table.status} IN ('draft', 'scheduled', 'posted')`),
  check("calendar_posts_post_type_check", sql`${table.postType} IN ('carousel', 'single-image', 'story')`),
]);

export const insertCalendarPostSchema = createInsertSchema(calendarPostsTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    status: z.enum(CALENDAR_POST_STATUSES),
    postType: z.enum(CALENDAR_POST_TYPES),
  });
export type InsertCalendarPost = z.infer<typeof insertCalendarPostSchema>;
export type CalendarPost = typeof calendarPostsTable.$inferSelect;

export const ACTIVITY_LOG_POST_TYPES = ["carousel", "single-image", "story"] as const;
export type ActivityLogPostType = typeof ACTIVITY_LOG_POST_TYPES[number];

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  postType: text("post_type").notNull().default("carousel"),
  clientName: text("client_name").notNull().default(""),
  slideCount: integer("slide_count").notNull().default(0),
  postCount: integer("post_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  check("activity_log_post_type_check", sql`${table.postType} IN ('carousel', 'single-image', 'story')`),
]);

export const insertActivityLogSchema = createInsertSchema(activityLogTable)
  .omit({ id: true, createdAt: true })
  .extend({
    postType: z.enum(ACTIVITY_LOG_POST_TYPES),
  });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogTable.$inferSelect;

export const APPROVAL_BATCH_STATUSES = ["pending", "reviewed"] as const;
export type ApprovalBatchStatus = typeof APPROVAL_BATCH_STATUSES[number];

export const approvalBatchesTable = pgTable("approval_batches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  clientName: text("client_name").notNull().default(""),
  presetId: integer("preset_id"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  check("approval_batches_status_check", sql`${table.status} IN ('pending', 'reviewed')`),
]);

export const insertApprovalBatchSchema = createInsertSchema(approvalBatchesTable)
  .omit({ id: true, createdAt: true })
  .extend({
    status: z.enum(APPROVAL_BATCH_STATUSES),
  });
export type InsertApprovalBatch = z.infer<typeof insertApprovalBatchSchema>;
export type ApprovalBatch = typeof approvalBatchesTable.$inferSelect;

export const workspaceLabelsTable = pgTable("workspace_labels", {
  workspaceId: text("workspace_id").primaryKey(),
  label: text("label").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export type WorkspaceLabel = typeof workspaceLabelsTable.$inferSelect;

export const APPROVAL_IMAGE_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApprovalImageStatus = typeof APPROVAL_IMAGE_STATUSES[number];

export const approvalImagesTable = pgTable("approval_images", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull(),
  imageUrl: text("image_url").notNull(),
  status: text("status").notNull().default("pending"),
  clientNote: text("client_note").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  check("approval_images_status_check", sql`${table.status} IN ('pending', 'approved', 'rejected')`),
]);

export const insertApprovalImageSchema = createInsertSchema(approvalImagesTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    status: z.enum(APPROVAL_IMAGE_STATUSES),
  });
export type InsertApprovalImage = z.infer<typeof insertApprovalImageSchema>;
export type ApprovalImage = typeof approvalImagesTable.$inferSelect;

export const SCHEDULED_POST_STATUSES = ["pending", "processing", "published", "failed", "cancelled"] as const;
export type ScheduledPostStatus = typeof SCHEDULED_POST_STATUSES[number];

export const SCHEDULED_POST_TYPES = ["carousel", "reel"] as const;
export type ScheduledPostType = typeof SCHEDULED_POST_TYPES[number];

export const RAIL_STATUSES = ["pending", "success", "failed", "skipped"] as const;
export type RailStatus = typeof RAIL_STATUSES[number];

export const scheduledPostsTable = pgTable("scheduled_posts", {
  id: serial("id").primaryKey(),
  presetId: integer("preset_id").notNull(),
  clientName: text("client_name").notNull().default(""),
  postType: text("post_type").notNull().default("carousel"),
  content: json("content").notNull().$type<{
    imageUrls?: string[];
    videoUrl?: string;
    caption: string;
    title: string;
  }>(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("pending"),
  metaStatus: text("meta_status").notNull().default("pending"),
  metaResult: json("meta_result").$type<{ igPostId?: string; fbPostId?: string; error?: string } | null>(),
  metaPostedAt: timestamp("meta_posted_at", { withTimezone: true }),
  ccStatus: text("cc_status").notNull().default("pending"),
  ccResult: json("cc_result").$type<{ postId?: string; error?: string } | null>(),
  ccPostedAt: timestamp("cc_posted_at", { withTimezone: true }),
  isTrial: boolean("is_trial").notNull().default(false),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertScheduledPostSchema = createInsertSchema(scheduledPostsTable)
  .omit({ id: true, createdAt: true, updatedAt: true, status: true, metaStatus: true, metaResult: true, metaPostedAt: true, ccStatus: true, ccResult: true, ccPostedAt: true })
  .extend({
    postType: z.enum(SCHEDULED_POST_TYPES),
  });
export type InsertScheduledPost = z.infer<typeof insertScheduledPostSchema>;
export type ScheduledPost = typeof scheduledPostsTable.$inferSelect;

export const LIBRARY_POST_TYPES = ["carousel", "reel", "single", "story"] as const;
export type LibraryPostType = typeof LIBRARY_POST_TYPES[number];

export const contentLibraryTable = pgTable("content_library", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  postType: text("post_type").notNull().default("single"),
  caption: text("caption").notNull().default(""),
  mediaUrl: text("media_url"),
  mediaUrls: json("media_urls").$type<string[]>(),
  thumbnailUrl: text("thumbnail_url"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertContentLibrarySchema = createInsertSchema(contentLibraryTable)
  .omit({ id: true, createdAt: true });
export type InsertContentLibrary = z.infer<typeof insertContentLibrarySchema>;
export type ContentLibraryItem = typeof contentLibraryTable.$inferSelect;

export type AboutMeWord = {
  id: string;
  text: string;
  x: number;
  y: number;
  color?: string;
  fontSize?: number;
};

export type AboutMeDoodle = {
  id: string;
  shape: "heart-outline" | "arrow" | "sparkle";
  x: number;
  y: number;
  size: number;
  rotation: number;
};

export type AboutMeCanvasConfig = {
  cutoutX: number;
  cutoutY: number;
  cutoutScale: number;
  glowEnabled: boolean;
  glowColor: string;
  shadowEnabled: boolean;
  shadowOpacity: number;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  logoUrl: string;
  logoX: number;
  logoY: number;
  logoScale: number;
  logoRotation: number;
  doodles: AboutMeDoodle[];
  titleColor?: string;
  titleFontSize?: number;
  titleLetterSpacing?: number;
  subtitleColor?: string;
  subtitleFontSize?: number;
  subtitleLetterSpacing?: number;
  wordFontSize?: number;
};

export const aboutMePostsTable = pgTable("about_me_posts", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull().default(""),
  originalPhotoUrl: text("original_photo_url").notNull(),
  cutoutPhotoUrl: text("cutout_photo_url").notNull(),
  backgroundPhotoUrl: text("background_photo_url"),
  backgroundBlurAmount: integer("background_blur_amount").notNull().default(25),
  backgroundOverlayOpacity: integer("background_overlay_opacity").notNull().default(0),
  title: text("title").notNull().default("About me"),
  subtitle: text("subtitle").notNull().default(""),
  heartSize: integer("heart_size").notNull().default(20),
  words: json("words").$type<AboutMeWord[]>().notNull().default([]),
  canvasConfig: json("canvas_config").$type<AboutMeCanvasConfig>().notNull().default({} as AboutMeCanvasConfig),
  arrowStyle: text("arrow_style").notNull().default("curly"),
  accentColor: text("accent_color").notNull().default("#F5EEE3"),
  titleFont: text("title_font").notNull().default("Allura"),
  aspectRatio: text("aspect_ratio").notNull().default("1080x1350"),
  renderedImageUrl: text("rendered_image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAboutMePostSchema = createInsertSchema(aboutMePostsTable)
  .omit({ id: true, createdAt: true, updatedAt: true, renderedImageUrl: true });
export type InsertAboutMePost = z.infer<typeof insertAboutMePostSchema>;
export type AboutMePost = typeof aboutMePostsTable.$inferSelect;

export type SeamlessSlide = {
  hasText: boolean;
  title: string;
  leadIn: string;
  tagLine: string;
  doodle: string;
  position: string;
  titleColor?: string;
  titleFontSize?: number;
  titleLetterSpacing?: number;
  titleLineHeight?: number;
  leadInColor?: string;
  leadInFontSize?: number;
  leadInLetterSpacing?: number;
  leadInLineHeight?: number;
  tagLineColor?: string;
  tagLineFontSize?: number;
  tagLineLetterSpacing?: number;
  tagLineLineHeight?: number;
};

export type SeamlessLogoConfig = {
  logoUrl: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type CollageElement = {
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  hasBorder: boolean;
  isBackground: boolean;
};

export const seamlessCarouselsTable = pgTable("seamless_carousels", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull().default(""),
  slideCount: integer("slide_count").notNull().default(3),
  layoutStyle: text("layout_style").notNull().default("background_overlays"),
  uploadedImageUrls: json("uploaded_image_urls").$type<string[]>().notNull().default([]),
  collageElements: json("collage_elements").$type<CollageElement[]>().notNull().default([]),
  slides: json("slides").$type<SeamlessSlide[]>().notNull().default([]),
  scriptFont: text("script_font").notNull().default("Allura"),
  textColor: text("text_color").notNull().default("#ffffff"),
  watermark: text("watermark").notNull().default(""),
  renderedSlideUrls: json("rendered_slide_urls").$type<string[]>().notNull().default([]),
  logoConfig: json("logo_config").$type<SeamlessLogoConfig | null>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSeamlessCarouselSchema = createInsertSchema(seamlessCarouselsTable)
  .omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSeamlessCarousel = z.infer<typeof insertSeamlessCarouselSchema>;
export type SeamlessCarousel = typeof seamlessCarouselsTable.$inferSelect;

export const aiSourcePhotosTable = pgTable("ai_source_photos", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull().default(""),
  uploader: text("uploader").notNull().default(""),
  photoUrl: text("photo_url").notNull(),
  notes: text("notes").notNull().default(""),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});

export const insertAiSourcePhotoSchema = createInsertSchema(aiSourcePhotosTable)
  .omit({ id: true, uploadedAt: true });
export type InsertAiSourcePhoto = z.infer<typeof insertAiSourcePhotoSchema>;
export type AiSourcePhoto = typeof aiSourcePhotosTable.$inferSelect;

export const AI_PORTRAIT_STATUSES = ["generating", "success", "failed"] as const;
export type AiPortraitStatus = typeof AI_PORTRAIT_STATUSES[number];

export const aiGeneratedPortraitsTable = pgTable("ai_generated_portraits", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull().default(""),
  sourcePhotoId: integer("source_photo_id").notNull().references(() => aiSourcePhotosTable.id),
  scenarioId: text("scenario_id").notNull(),
  prompt: text("prompt").notNull(),
  scrubColor: text("scrub_color"),
  outfitStyle: text("outfit_style"),
  aspectRatio: text("aspect_ratio").notNull().default("1:1"),
  originalImageUrl: text("original_image_url"),
  outputImageUrl: text("output_image_url"),
  hasWatermark: boolean("has_watermark").notNull().default(true),
  status: text("status").notNull().default("generating"),
  failureReason: text("failure_reason"),
  generatedAt: timestamp("generated_at").notNull().defaultNow(),
  savedToLibrary: boolean("saved_to_library").notNull().default(false),
}, (table) => [
  check("ai_portrait_status_check", sql`${table.status} IN ('generating', 'success', 'failed')`),
]);

export const insertAiGeneratedPortraitSchema = createInsertSchema(aiGeneratedPortraitsTable)
  .omit({ id: true, generatedAt: true, sourcePhotoId: true })
  .extend({ status: z.enum(AI_PORTRAIT_STATUSES), sourcePhotoId: z.number().int() });
export type InsertAiGeneratedPortrait = z.infer<typeof insertAiGeneratedPortraitSchema>;
export type AiGeneratedPortrait = typeof aiGeneratedPortraitsTable.$inferSelect;
