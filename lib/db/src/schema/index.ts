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
  textAlign: text("text_align").notNull().default("left"),
  textBoxOutline: boolean("text_box_outline").notNull().default(false),
  textBoxOutlineColor: text("text_box_outline_color").notNull().default("#ffffff"),
  captionFootnote: text("caption_footnote").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  check("client_presets_text_position_check", sql`${table.textPosition} IN ('top', 'center', 'bottom')`),
]);

export const TEXT_POSITIONS = ["top", "center", "bottom"] as const;
export type TextPosition = typeof TEXT_POSITIONS[number];

export const insertPresetSchema = createInsertSchema(clientPresetsTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({ textPosition: z.enum(TEXT_POSITIONS) });
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
});

export const insertCalendarPostSchema = createInsertSchema(calendarPostsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCalendarPost = z.infer<typeof insertCalendarPostSchema>;
export type CalendarPost = typeof calendarPostsTable.$inferSelect;

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  postType: text("post_type").notNull().default("carousel"),
  clientName: text("client_name").notNull().default(""),
  slideCount: integer("slide_count").notNull().default(0),
  postCount: integer("post_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogTable).omit({ id: true, createdAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogTable.$inferSelect;

export const approvalBatchesTable = pgTable("approval_batches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  clientName: text("client_name").notNull().default(""),
  presetId: integer("preset_id"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertApprovalBatchSchema = createInsertSchema(approvalBatchesTable).omit({ id: true, createdAt: true });
export type InsertApprovalBatch = z.infer<typeof insertApprovalBatchSchema>;
export type ApprovalBatch = typeof approvalBatchesTable.$inferSelect;

export const approvalImagesTable = pgTable("approval_images", {
  id: serial("id").primaryKey(),
  batchId: integer("batch_id").notNull(),
  imageUrl: text("image_url").notNull(),
  status: text("status").notNull().default("pending"),
  clientNote: text("client_note").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertApprovalImageSchema = createInsertSchema(approvalImagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertApprovalImage = z.infer<typeof insertApprovalImageSchema>;
export type ApprovalImage = typeof approvalImagesTable.$inferSelect;
