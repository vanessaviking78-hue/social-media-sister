import { useState } from "react";
import { Link } from "wouter";
import { Download, ChevronDown, ChevronRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL;

const SCHEMAS = [
  {
    file: "carousels.csv",
    postType: "Carousel",
    color: "#E91976",
    columns: ["caption", "music_track", "text_style", "slide_1_lead_in", "slide_1_hero_word", "slide_1_text", "slide_1_image", "slide_2_text", "slide_2_image", "slide_3_text", "slide_3_image", "slide_4_text", "slide_4_image", "slide_5_text", "slide_5_image", "scheduled_date", "scheduled_time"],
    notes: "slide_1_image through slide_5_image are the media filenames. Only filled slides are uploaded. text_style='hero' unlocks slide_1_lead_in and slide_1_hero_word.",
  },
  {
    file: "singles.csv",
    postType: "Single Image",
    color: "#3b82f6",
    columns: ["caption", "music_track", "image_filename", "text_style", "overlay_text", "hero_lead_in", "hero_word", "hero_color", "leadin_color", "scheduled_date", "scheduled_time"],
    notes: "image_filename is the media file. text_style='hero' enables the hero overlay fields.",
  },
  {
    file: "about_mes.csv",
    postType: "About Me",
    color: "#8b5cf6",
    columns: ["caption", "music_track", "title", "subtitle", "subject_image", "background_image", "words", "accent_color", "arrow_style", "scheduled_date", "scheduled_time"],
    notes: "words is pipe-separated (e.g. Honest|Caring|Clinical). subject_image and background_image are media filenames.",
  },
  {
    file: "seamless.csv",
    postType: "Seamless Carousel",
    color: "#10b981",
    columns: ["caption", "music_track", "slide_count", "layout_style", "images", "text_slide_1", "text_slide_2", "text_slide_3", "text_slide_4", "text_slide_5", "watermark", "scheduled_date", "scheduled_time"],
    notes: "images is pipe-separated (e.g. img1.jpg|img2.jpg|img3.jpg). layout_style: landscape or portrait. watermark: yes or no.",
  },
  {
    file: "reels.csv",
    postType: "Reel",
    color: "#f59e0b",
    columns: ["caption", "music_track", "video_filename", "cover_image", "cover_text", "typewriter_text", "scheduled_date", "scheduled_time"],
    notes: "video_filename is the video file. cover_image is the thumbnail. Both are matched from the zip.",
  },
  {
    file: "trial_reels.csv",
    postType: "Trial Reel",
    color: "#6b7280",
    columns: ["caption", "music_track", "video_filename", "cover_image", "cover_text", "typewriter_text", "scheduled_date", "scheduled_time"],
    notes: "Same columns as reels.csv. Trial reels are created with graduation_strategy: MANUAL — they stay private until manually approved.",
  },
];

export default function BulkImportTemplates() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div style={{ background: "#000", minHeight: "100vh", color: "#fff", fontFamily: "'League Spartan', sans-serif" }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <img src="/sms-logo.png" alt="Social Media Sister" style={{ height: 32, width: "auto", objectFit: "contain" }} />
            <span style={{ fontFamily: "'League Spartan', sans-serif", fontSize: 22, color: "#E91976", letterSpacing: 1 }}>The CyberSuite</span>
          </div>
          <Link href="/hub" style={{ color: "#aaa", fontSize: 13, textDecoration: "none", borderBottom: "1px solid #333", paddingBottom: 1 }}>
            Back to The CyberSuite
          </Link>
        </div>

        <h1 style={{ fontFamily: "'League Spartan', sans-serif", fontSize: 52, color: "#E91976", letterSpacing: 2, marginBottom: 8, lineHeight: 1 }}>
          Bulk Import Templates
        </h1>
        <p style={{ color: "#888", fontSize: 15, marginBottom: 40, lineHeight: 1.7 }}>
          Drop one zip containing up to 6 CSV files plus all your media into the Bulk Import tab on the Content Library. Each CSV filename tells the system which post type to create.
        </p>

        <a
          href={`${BASE}api/library/bulk-import-templates.zip`}
          download
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#E91976",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 15,
            marginBottom: 48,
          }}
        >
          <Download size={16} />
          Download example zip
        </a>

        <div style={{ marginBottom: 16, color: "#666", fontSize: 13 }}>
          Expected volume per client per month: 12 carousels, 4 about mes, 4 seamless, 5 singles, 5 reels, 10 trial reels = 40 entries
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {SCHEMAS.map((schema) => (
            <div key={schema.file} style={{ border: "1px solid #222", borderRadius: 12, overflow: "hidden" }}>
              <button
                onClick={() => setOpen(open === schema.file ? null : schema.file)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                  background: "#0a0a0a",
                  border: "none",
                  cursor: "pointer",
                  color: "#fff",
                  textAlign: "left",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    fontFamily: "'League Spartan', sans-serif",
                    fontSize: 13,
                    color: schema.color,
                    background: `${schema.color}22`,
                    padding: "2px 10px",
                    borderRadius: 6,
                    letterSpacing: 1,
                  }}>{schema.postType}</span>
                  <code style={{ fontSize: 13, color: "#aaa" }}>{schema.file}</code>
                </div>
                {open === schema.file ? <ChevronDown size={16} color="#666" /> : <ChevronRight size={16} color="#666" />}
              </button>

              {open === schema.file && (
                <div style={{ padding: "20px", background: "#050505", borderTop: "1px solid #1a1a1a" }}>
                  <div style={{ marginBottom: 16, overflowX: "auto" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {schema.columns.map((col) => (
                        <code key={col} style={{
                          fontSize: 12,
                          background: "#111",
                          color: "#ccc",
                          padding: "3px 8px",
                          borderRadius: 5,
                          border: "1px solid #222",
                        }}>{col}</code>
                      ))}
                    </div>
                  </div>
                  <p style={{ color: "#777", fontSize: 13, lineHeight: 1.6 }}>{schema.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 48, borderTop: "1px solid #111", paddingTop: 32, fontSize: 13, color: "#444", lineHeight: 1.7 }}>
          <p>Media file matching is case-insensitive. Files can be anywhere in the zip (nested directories are fine — only the basename is matched).</p>
          <p style={{ marginTop: 8 }}>If a referenced media file is missing from the zip, that row is skipped and logged as an error. The rest of the import continues.</p>
          <p style={{ marginTop: 8 }}>scheduled_date format: YYYY-MM-DD. scheduled_time format: HH:MM (24-hour). Leave blank to import without scheduling.</p>
        </div>

        <div style={{ borderTop: "1px solid #111", paddingTop: 24, marginTop: 40, display: "flex", gap: 24, fontSize: 12, color: "#444" }}>
          <Link href="/privacy" style={{ color: "#444", textDecoration: "none" }}>Privacy</Link>
          <Link href="/terms" style={{ color: "#444", textDecoration: "none" }}>Terms</Link>
          <Link href="/data-deletion" style={{ color: "#444", textDecoration: "none" }}>Data Deletion</Link>
        </div>
      </div>
    </div>
  );
}
