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
