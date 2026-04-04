import { pgTable, text, serial, timestamp, integer, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientPresetsTable = pgTable("client_presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pageColor: text("page_color").notNull().default("#000000"),
  overlayColor: text("overlay_color").notNull().default("rgba(0,0,0,0.5)"),
  fontFamily: text("font_family").notNull().default("Inter, sans-serif"),
  fontSize: integer("font_size").notNull().default(52),
  textColor: text("text_color").notNull().default("#ffffff"),
  lineSpacing: text("line_spacing").notNull().default("0.9"),
  cornerStyle: text("corner_style").notNull().default("none"),
  cornerColor: text("corner_color").notNull().default("#d4af37"),
  gradientEnabled: boolean("gradient_enabled").notNull().default(true),
  gradientStyle: text("gradient_style").notNull().default("solid"),
  gradientColor: text("gradient_color").notNull().default("#000000"),
  gradientPosition: text("gradient_position").notNull().default("left"),
  textPosition: text("text_position").notNull().default("bottom-left"),
  logoPosition: text("logo_position").notNull().default("top-right"),
  logoSize: integer("logo_size").notNull().default(140),
  logoUrl: text("logo_url"),
  accentColor: text("accent_color").notNull().default("#d4af37"),
  ccWorkspaceId: text("cc_workspace_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPresetSchema = createInsertSchema(clientPresetsTable).omit({ id: true, createdAt: true, updatedAt: true });
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
