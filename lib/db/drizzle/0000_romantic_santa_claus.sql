CREATE TABLE "about_me_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_name" text DEFAULT '' NOT NULL,
	"original_photo_url" text NOT NULL,
	"cutout_photo_url" text NOT NULL,
	"background_photo_url" text,
	"background_blur_amount" integer DEFAULT 25 NOT NULL,
	"background_overlay_opacity" integer DEFAULT 0 NOT NULL,
	"title" text DEFAULT 'About me' NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"heart_size" integer DEFAULT 20 NOT NULL,
	"words" json DEFAULT '[]'::json NOT NULL,
	"canvas_config" json DEFAULT '{}'::json NOT NULL,
	"arrow_style" text DEFAULT 'curly' NOT NULL,
	"accent_color" text DEFAULT '#F5EEE3' NOT NULL,
	"title_font" text DEFAULT 'Allura' NOT NULL,
	"aspect_ratio" text DEFAULT '1080x1350' NOT NULL,
	"music_track" json,
	"first_comment" text,
	"rendered_image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"post_type" text DEFAULT 'carousel' NOT NULL,
	"client_name" text DEFAULT '' NOT NULL,
	"slide_count" integer DEFAULT 0 NOT NULL,
	"post_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "activity_log_post_type_check" CHECK ("activity_log"."post_type" IN ('carousel', 'single-image', 'story'))
);
--> statement-breakpoint
CREATE TABLE "ai_generated_portraits" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_name" text DEFAULT '' NOT NULL,
	"source_photo_id" integer NOT NULL,
	"scenario_id" text NOT NULL,
	"prompt" text NOT NULL,
	"scrub_color" text,
	"outfit_style" text,
	"aspect_ratio" text DEFAULT '1:1' NOT NULL,
	"original_image_url" text,
	"output_image_url" text,
	"has_watermark" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'generating' NOT NULL,
	"failure_reason" text,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"saved_to_library" boolean DEFAULT false NOT NULL,
	CONSTRAINT "ai_portrait_status_check" CHECK ("ai_generated_portraits"."status" IN ('generating', 'success', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "ai_source_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_name" text DEFAULT '' NOT NULL,
	"uploader" text DEFAULT '' NOT NULL,
	"photo_url" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"client_name" text DEFAULT '' NOT NULL,
	"preset_id" integer,
	"token" text NOT NULL,
	"expires_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "approval_batches_token_unique" UNIQUE("token"),
	CONSTRAINT "approval_batches_status_check" CHECK ("approval_batches"."status" IN ('pending', 'reviewed'))
);
--> statement-breakpoint
CREATE TABLE "approval_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"batch_id" integer NOT NULL,
	"image_url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"client_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "approval_images_status_check" CHECK ("approval_images"."status" IN ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "calendar_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"client_name" text DEFAULT '' NOT NULL,
	"post_type" text DEFAULT 'carousel' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"color" text DEFAULT '#ec4899' NOT NULL,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_posts_status_check" CHECK ("calendar_posts"."status" IN ('draft', 'scheduled', 'posted')),
	CONSTRAINT "calendar_posts_post_type_check" CHECK ("calendar_posts"."post_type" IN ('carousel', 'single-image', 'story'))
);
--> statement-breakpoint
CREATE TABLE "captions" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"category" text DEFAULT 'General' NOT NULL,
	"client_name" text DEFAULT '' NOT NULL,
	"favourite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_presets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"page_color" text DEFAULT '#000000' NOT NULL,
	"overlay_color" text DEFAULT 'rgba(0,0,0,0.5)' NOT NULL,
	"font_family" text DEFAULT 'Inter, sans-serif' NOT NULL,
	"subheading_font" text,
	"font_size" integer DEFAULT 52 NOT NULL,
	"content_font_size" integer DEFAULT 44 NOT NULL,
	"text_color" text DEFAULT '#ffffff' NOT NULL,
	"line_spacing" text DEFAULT '0.9' NOT NULL,
	"corner_style" text DEFAULT 'none' NOT NULL,
	"corner_color" text DEFAULT '#d4af37' NOT NULL,
	"text_position" text DEFAULT 'bottom' NOT NULL,
	"logo_position" text DEFAULT 'top-right' NOT NULL,
	"logo_size" integer DEFAULT 140 NOT NULL,
	"logo_url" text,
	"accent_color" text DEFAULT '#d4af37' NOT NULL,
	"cc_workspace_id" text,
	"meta_page_access_token" text,
	"meta_facebook_page_id" text,
	"meta_instagram_account_id" text,
	"text_align" text DEFAULT 'left' NOT NULL,
	"text_box_outline" boolean DEFAULT false NOT NULL,
	"text_box_outline_color" text DEFAULT '#ffffff' NOT NULL,
	"caption_footnote" text DEFAULT '' NOT NULL,
	"cover_subheading" text DEFAULT '' NOT NULL,
	"client_portal_token" text,
	"default_post_time" text DEFAULT '18:00' NOT NULL,
	"default_first_comment_carousel" text,
	"default_first_comment_single" text,
	"default_first_comment_reel" text,
	"onboarding_connected_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "client_presets_client_portal_token_unique" UNIQUE("client_portal_token"),
	CONSTRAINT "client_presets_text_position_check" CHECK ("client_presets"."text_position" IN ('top', 'center', 'bottom')),
	CONSTRAINT "client_presets_corner_style_check" CHECK ("client_presets"."corner_style" IN ('none', 'triangle', 'arc', 'double-line', 'frame')),
	CONSTRAINT "client_presets_text_align_check" CHECK ("client_presets"."text_align" IN ('left', 'center', 'right')),
	CONSTRAINT "client_presets_logo_position_check" CHECK ("client_presets"."logo_position" IN ('top-right', 'top-left', 'bottom-right', 'bottom-left', 'none'))
);
--> statement-breakpoint
CREATE TABLE "content_library" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_name" text NOT NULL,
	"post_type" text DEFAULT 'single' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"media_url" text,
	"media_urls" json,
	"thumbnail_url" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_automations" (
	"id" serial PRIMARY KEY NOT NULL,
	"preset_id" integer NOT NULL,
	"keyword" text NOT NULL,
	"reply_template" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"match_exact" boolean DEFAULT false NOT NULL,
	"case_sensitive" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dm_interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"automation_id" integer,
	"preset_id" integer,
	"sender_id" text NOT NULL,
	"ig_account_id" text NOT NULL,
	"message_text" text NOT NULL,
	"matched_keyword" text,
	"reply_sent" boolean DEFAULT false NOT NULL,
	"reply_text" text,
	"error_message" text,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_name" text DEFAULT '' NOT NULL,
	"preset_id" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"form_data_json" json,
	"generated_count" integer DEFAULT 0 NOT NULL,
	"total_count" integer DEFAULT 0 NOT NULL,
	"content_mix" json,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"preset_id" integer NOT NULL,
	"client_name" text DEFAULT '' NOT NULL,
	"post_type" text DEFAULT 'carousel' NOT NULL,
	"content" json NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"meta_status" text DEFAULT 'pending' NOT NULL,
	"meta_result" json,
	"meta_posted_at" timestamp with time zone,
	"cc_status" text DEFAULT 'pending' NOT NULL,
	"cc_result" json,
	"cc_posted_at" timestamp with time zone,
	"is_trial" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seamless_carousels" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_name" text DEFAULT '' NOT NULL,
	"slide_count" integer DEFAULT 3 NOT NULL,
	"layout_style" text DEFAULT 'background_overlays' NOT NULL,
	"uploaded_image_urls" json DEFAULT '[]'::json NOT NULL,
	"collage_elements" json DEFAULT '[]'::json NOT NULL,
	"slides" json DEFAULT '[]'::json NOT NULL,
	"script_font" text DEFAULT 'Allura' NOT NULL,
	"text_color" text DEFAULT '#ffffff' NOT NULL,
	"watermark" text DEFAULT '' NOT NULL,
	"rendered_slide_urls" json DEFAULT '[]'::json NOT NULL,
	"logo_config" json,
	"music_track" json,
	"first_comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_labels" (
	"workspace_id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_generated_portraits" ADD CONSTRAINT "ai_generated_portraits_source_photo_id_ai_source_photos_id_fk" FOREIGN KEY ("source_photo_id") REFERENCES "public"."ai_source_photos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_automations" ADD CONSTRAINT "dm_automations_preset_id_client_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."client_presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dm_interactions" ADD CONSTRAINT "dm_interactions_automation_id_dm_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."dm_automations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_batches" ADD CONSTRAINT "intake_batches_preset_id_client_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."client_presets"("id") ON DELETE set null ON UPDATE no action;