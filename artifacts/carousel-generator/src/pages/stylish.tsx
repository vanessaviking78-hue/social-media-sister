import { useState, useCallback, useRef, useEffect, useMemo, type PointerEvent as ReactPointerEvent } from "react";
import { Link } from "wouter";
import { setFlipHandoff } from "@/lib/flip-handoff";
import { takeStylishHandoff } from "@/lib/stylish-handoff";
import {
  ArrowLeft, FileText, Download, Loader2, CalendarClock, CheckCircle2, ImageIcon,
  Sparkles, Palette, RotateCcw, Wand2, Trash2, Move, ArrowUpDown, Film,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { readFileAsText } from "@/lib/csv-format";
import { loadGoogleFonts, FONT_OPTIONS } from "@/lib/slide-utils";
import { usePresets, type ClientPreset } from "@/lib/use-presets";
import ApprovedImagesPicker from "@/components/approved-images-picker";
import { ScheduleModal, type SchedulePostPayload } from "@/components/schedule-modal";
import { nthPostingSlot } from "@/lib/schedule";
import opentype from "opentype.js";

loadGoogleFonts();
if (typeof document !== "undefined" && !document.getElementById("stylish-fonts")) {
  const link = document.createElement("link");
  link.id = "stylish-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800;900&family=Jost:wght@300;400;500;600&family=Poppins:wght@400;600;700;800&family=Instrument+Serif:ital@0;1&display=swap";
  document.head.appendChild(link);
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const W = 1080;
const H = 1440;
const SIDE_PAD = 90;
const STYLE_STORAGE_KEY = "stylish-style-v4";

// ---------------------------------------------------------------------------
// Types and defaults
// ---------------------------------------------------------------------------

type CoverLayout = "band" | "centred" | "block" | "split" | "serif" | "plain" | "behind"
  | "fullbleed" | "blur" | "strip" | "diagonal" | "behind2" | "polaroid" | "sidebar" | "frame" | "layered"
  // The "October 26" set: each is a scene photo (made in AI Photo Studio) with the words placed on it. The number is the pin's number.
  | "oct1" | "oct8" | "oct9" | "oct11" | "oct17" | "oct2" | "oct5" | "oct10" | "oct15" | "oct3" | "oct4" | "oct6" | "oct7" | "oct12" | "oct13" | "oct14" | "oct16" | "oct18";

type Style = {
  // Slide 1 (cover)
  coverLayout: CoverLayout;
  cvFont: string;
  cvSubFont: string;
  plainFont: string;    // cover option 6: its own headline and subheading fonts
  plainSubFont: string;
  behindFont: string;   // cover option 7: heading sits behind the person
  behindSubFont: string;
  lf: Record<string, { h: string; s: string }>; // fonts for cover options 8 to 16
  clientCoverFont: string;    // this client's own headline font, forced on every cover option. Empty means unset.
  clientCoverSubFont: string; // this client's own subtitle font, forced on every cover option. Empty means unset.
  cvBlur: number;   // motion blur, option 9
  cvAngle: number;  // heading angle, option 11
  cvAll: boolean;   // one pair of text colours on every cover
  cvAllColour: string;
  cvAllSubColour: string;
  cvWeight: number;
  cvSubWeight: number;
  cvCaps: boolean;
  cvSubCaps: boolean;
  cvTracking: number;
  cvSubTracking: number;
  cvScrim: number;
  cvSize: number;
  cvSubSize: number;
  cvColour: string;
  cvSubColour: string;
  cvBlock: string;
  cvBand: string;
  cvBandOn: boolean;
  cvPunch?: number; // October 26: how much contrast and colour the photo gets, 0 to 100 (75 when empty)
  cvTowel?: boolean; // October 26 No. 17: a towel on the head
  cvShades?: boolean; // October 26 No. 17: sunglasses
  cvSpot?: string; // spot colour for the recolourable picture covers. Empty uses the client's brand colour.
  cvAlts?: Record<number, number>; // which letters use the font's curly alternates: letter position to alternate number
  cvCurve?: number;   // bend the headline: above 0 arches it up, below 0 makes a smile (October 26 covers)
  cvLeading?: number; // line spacing as a multiple of the text size (October 26 covers)
  cvBlockAll: string; // set by "Change all": this block colour wins on every cover option
  cvBandAll: string;  // same for the bottom band
  cvPhoto: number;   // photo share of the slide, in percent
  cvFocus: number;   // where the photo is cropped, in percent
  cvY: number;       // vertical position, centred cover only
  cvGradOn: boolean;    // a colour gradient wash over the cover photo
  cvGradFrom: string;
  cvGradTo: string;
  cvGradOpacity: number;
  // Slides 2 onwards (photo with text over)
  layout: "editorial" | "classic";
  fontFamily: string;   // small labels
  displayFont: string;  // slide text
  textWeight: number;
  textItalic: boolean;
  bodySize: number;
  ctaSize: number;
  bodyColour: string;
  ctaColour: string;
  lineColour: string;
  uppercase: boolean;
  letterSpacing: number;
  lineHeight: number;
  align: "left" | "centre";
  bodyY: number;
  overlay: number;
  scrim: number;
  shadow: boolean;
  background: string;
  frame: boolean;
  counter: boolean;
  brandMark: boolean;
  arrow: boolean;
  rule: boolean;
  showLogo: boolean;
  logoScale: number; // multiplier on the client's saved logo size
};

const INTER_TIGHT = "'Inter Tight', sans-serif";
const F_BREUL = "'Breul Grotesk', 'Inter Tight', sans-serif";
const F_HELV = "'Helvetica Now Display', 'Inter Tight', sans-serif";
const F_NOW = "'Now', 'Poppins', sans-serif";
const F_EVOLVENTA = "'Evolventa', 'Montserrat', sans-serif";
const F_INSTRUMENT = "'Instrument Serif', serif";

// Fonts each cover is designed around. If a font is not free to bundle, the person adds their own copy.
const COVER_WANTS: Record<CoverLayout, string[]> = {
  band: ["Breul Grotesk"],
  centred: ["Evolventa"],
  block: ["Helvetica Now Display"],
  split: ["Now"],
  serif: [],
  plain: [],
  behind: [],
  fullbleed: [], blur: [], strip: [], diagonal: [], behind2: [], polaroid: [], sidebar: [], frame: [], layered: [],
  oct1: [], oct8: [], oct9: [], oct11: [], oct17: [], oct2: [], oct5: [], oct10: [], oct15: [], oct3: [], oct4: [], oct6: [], oct7: [], oct12: [], oct13: [], oct14: [], oct16: [], oct18: [],
};

// Each cover layout brings its own type, colours and proportions. Everything can be changed afterwards.
const COVER_PRESETS: Record<CoverLayout, Partial<Style>> = {
  band: {
    coverLayout: "band", cvFont: F_BREUL, cvSubFont: F_BREUL, cvWeight: 700, cvSubWeight: 400,
    cvCaps: true, cvSubCaps: true, cvTracking: -2, cvSubTracking: 4, cvSize: 150, cvSubSize: 30, cvScrim: 0,
    cvColour: "#000000", cvSubColour: "#000000", cvBlock: "#faf9f5", cvBandOn: false, cvPhoto: 74, cvFocus: 30,
  },
  centred: {
    coverLayout: "centred", cvFont: F_EVOLVENTA, cvSubFont: "'Montserrat', sans-serif", cvWeight: 700, cvSubWeight: 400,
    cvCaps: true, cvSubCaps: true, cvTracking: 1, cvSubTracking: 2, cvSize: 170, cvSubSize: 46, cvScrim: 0,
    cvColour: "#38b6ff", cvSubColour: "#ffffff", cvPhoto: 100, cvFocus: 50, cvY: 58,
  },
  block: {
    coverLayout: "block", cvFont: F_HELV, cvSubFont: F_HELV, cvWeight: 700, cvSubWeight: 400,
    cvCaps: true, cvSubCaps: true, cvTracking: -6, cvSubTracking: 1, cvSize: 300, cvSubSize: 32, cvScrim: 0,
    cvColour: "#000000", cvSubColour: "#000000", cvBlock: "#e4e2dd", cvBandOn: false, cvPhoto: 38, cvFocus: 35,
  },
  split: {
    coverLayout: "split", cvFont: F_NOW, cvSubFont: F_NOW, cvWeight: 700, cvSubWeight: 400,
    cvCaps: true, cvSubCaps: false, cvTracking: 0, cvSubTracking: 0, cvSize: 120, cvSubSize: 46, cvScrim: 0,
    cvColour: "#000000", cvSubColour: "#000000", cvBlock: "#ffffff", cvBand: "#666666", cvBandOn: true, cvPhoto: 47.5, cvFocus: 50,
  },
  plain: {
    coverLayout: "plain", cvWeight: 700, cvSubWeight: 400,
    cvCaps: false, cvSubCaps: false, cvTracking: 0, cvSubTracking: 0, cvSize: 150, cvSubSize: 56, cvScrim: 0,
    cvColour: "#ffffff", cvSubColour: "#ffffff", cvBlock: "#1f2a44",
  },
  fullbleed: {
    coverLayout: "fullbleed", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: false, cvTracking: 0, cvSubTracking: 0,
    cvSize: 300, cvSubSize: 54, cvScrim: 12, cvColour: "#f5f5f5", cvSubColour: "#f5f5f5", cvY: 16,
  },
  blur: {
    coverLayout: "blur", cvWeight: 400, cvSubWeight: 400, cvCaps: false, cvSubCaps: false, cvTracking: -3, cvSubTracking: 0,
    cvSize: 190, cvSubSize: 40, cvScrim: 0, cvBlur: 90, cvColour: "#ffffff", cvSubColour: "#ffffff", cvY: 42,
  },
  strip: {
    coverLayout: "strip", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: false, cvTracking: 1, cvSubTracking: 0,
    cvSize: 120, cvSubSize: 46, cvScrim: 0, cvColour: "#0d0d0d", cvSubColour: "#0d0d0d", cvBlock: "#fff9e8",
  },
  diagonal: {
    coverLayout: "diagonal", cvWeight: 300, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 3, cvSubTracking: 1,
    cvSize: 150, cvSubSize: 50, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#ffffff", cvAngle: 24, cvY: 31,
  },
  behind2: {
    coverLayout: "behind2", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 0,
    cvSize: 420, cvSubSize: 40, cvScrim: 0, cvColour: "#274585", cvSubColour: "#274585", cvBlock: "#ffffff", cvY: 34,
  },
  polaroid: {
    coverLayout: "polaroid", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: false, cvTracking: 0, cvSubTracking: 0,
    cvSize: 96, cvSubSize: 44, cvScrim: 0, cvColour: "#111111", cvSubColour: "#111111", cvBlock: "#ffffff",
  },
  sidebar: {
    coverLayout: "sidebar", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 1,
    cvSize: 150, cvSubSize: 34, cvScrim: 0, cvColour: "#111111", cvSubColour: "#111111", cvBlock: "#ffffff", cvPhoto: 50, cvY: 29,
  },
  frame: {
    coverLayout: "frame", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: false, cvTracking: -2, cvSubTracking: 0,
    cvSize: 100, cvSubSize: 44, cvScrim: 0, cvColour: "#111111", cvSubColour: "#111111", cvBlock: "#ffffff",
  },
  layered: {
    coverLayout: "layered", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 1,
    cvSize: 92, cvSubSize: 30, cvScrim: 8, cvColour: "#1c1c1c", cvSubColour: "#1c1c1c", cvBlock: "#ececec",
  },
  // October 26. Text colours here are only starting points; the client's brand colour is used where a look calls for it.
  oct1: {
    coverLayout: "oct1", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 6,
    cvSize: 100, cvSubSize: 28, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#141414",
  },
  oct8: {
    coverLayout: "oct8", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 6,
    cvSize: 110, cvSubSize: 30, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#141414",
  },
  oct9: {
    coverLayout: "oct9", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: false, cvTracking: 0, cvSubTracking: 3,
    cvSize: 120, cvSubSize: 30, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#141414",
  },
  oct11: {
    coverLayout: "oct11", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 8,
    cvSize: 150, cvSubSize: 32, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#141414",
  },
  oct17: {
    coverLayout: "oct17", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: false, cvTracking: 0, cvSubTracking: 3,
    cvSize: 100, cvSubSize: 30, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#141414",
  },
  oct2: {
    coverLayout: "oct2", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: false, cvTracking: 0, cvSubTracking: 3,
    cvSize: 150, cvSubSize: 34, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#ffffff",
  },
  oct5: {
    coverLayout: "oct5", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 4,
    cvSize: 100, cvSubSize: 30, cvScrim: 0, cvColour: "#141414", cvSubColour: "#141414",
  },
  oct10: {
    coverLayout: "oct10", cvWeight: 400, cvSubWeight: 400, cvCaps: false, cvSubCaps: false, cvTracking: 0, cvSubTracking: 3,
    cvSize: 130, cvSubSize: 34, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#ffffff",
  },
  oct15: {
    coverLayout: "oct15", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: false, cvTracking: 2, cvSubTracking: 3,
    cvSize: 60, cvSubSize: 34, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#141414",
  },
  oct3: {
    coverLayout: "oct3", cvWeight: 400, cvSubWeight: 400, cvCaps: false, cvSubCaps: false, cvTracking: 0, cvSubTracking: 3,
    cvSize: 150, cvSubSize: 34, cvScrim: 0, cvColour: "#1a1a1a", cvSubColour: "#1a1a1a",
  },
  oct4: {
    coverLayout: "oct4", cvWeight: 400, cvSubWeight: 400, cvCaps: false, cvSubCaps: true, cvTracking: 0, cvSubTracking: 4,
    cvSize: 120, cvSubSize: 34, cvScrim: 0, cvColour: "#1a1a1a", cvSubColour: "#ffffff",
  },
  oct7: {
    coverLayout: "oct7", cvWeight: 400, cvSubWeight: 400, cvCaps: false, cvSubCaps: false, cvTracking: 0, cvSubTracking: 3,
    cvSize: 150, cvSubSize: 34, cvScrim: 0, cvColour: "#141414", cvSubColour: "#141414",
  },
  oct12: {
    coverLayout: "oct12", cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: false, cvTracking: 0, cvSubTracking: 3,
    cvSize: 110, cvSubSize: 34, cvScrim: 0, cvColour: "#0d0d0d", cvSubColour: "#0d0d0d",
  },
  oct14: {
    coverLayout: "oct14", cvWeight: 400, cvSubWeight: 400, cvCaps: false, cvSubCaps: false, cvTracking: 0, cvSubTracking: 3,
    cvSize: 190, cvSubSize: 34, cvScrim: 0, cvColour: "#141414", cvSubColour: "#141414",
  },
  oct6: {
    coverLayout: "oct6", cvWeight: 400, cvSubWeight: 400, cvCaps: false, cvSubCaps: false, cvTracking: 0, cvSubTracking: 3,
    cvSize: 110, cvSubSize: 34, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#ffffff",
  },
  oct13: {
    coverLayout: "oct13", cvFont: F_INSTRUMENT, cvSubFont: F_INSTRUMENT, cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 8,
    cvSize: 260, cvSubSize: 40, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#ffffff",
  },
  oct18: {
    coverLayout: "oct18", cvFont: F_INSTRUMENT, cvSubFont: F_INSTRUMENT, cvWeight: 400, cvSubWeight: 400, cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 6,
    cvSize: 300, cvSubSize: 34, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#ffffff",
  },
  oct16: {
    coverLayout: "oct16", cvWeight: 400, cvSubWeight: 400, cvCaps: false, cvSubCaps: false, cvTracking: 0, cvSubTracking: 3,
    cvSize: 70, cvSubSize: 34, cvScrim: 0, cvColour: "#ffffff", cvSubColour: "#ffffff",
  },
  behind: {
    coverLayout: "behind", cvWeight: 400, cvSubWeight: 400,
    cvCaps: true, cvSubCaps: true, cvTracking: 0, cvSubTracking: 0, cvSize: 420, cvSubSize: 36, cvScrim: 0,
    cvColour: "#1c1c1c", cvSubColour: "#1c1c1c", cvBlock: "#efefef", cvY: 31,
  },
  serif: {
    coverLayout: "serif", cvFont: F_INSTRUMENT, cvSubFont: F_INSTRUMENT, cvWeight: 400, cvSubWeight: 400,
    cvCaps: true, cvSubCaps: false, cvTracking: -4, cvSubTracking: -2, cvSize: 170, cvSubSize: 66, cvScrim: 62,
    cvColour: "#ffffff", cvSubColour: "#ffffff", cvPhoto: 100, cvFocus: 50, cvY: 90,
  },
};

const LOOK_EDITORIAL: Partial<Style> = {
  layout: "editorial",
  fontFamily: "'Montserrat', sans-serif",
  displayFont: "'Cormorant Garamond', serif",
  textWeight: 400,
  textItalic: false,
  bodySize: 78,
  ctaSize: 82,
  bodyColour: "#ffffff",
  ctaColour: "#ffffff",
  lineColour: "#ffffff",
  uppercase: false,
  letterSpacing: 0,
  lineHeight: 1.14,
  align: "left",
  bodyY: 86,
  overlay: 0,
  scrim: 64,
  shadow: false,
  frame: true,
  counter: true,
  brandMark: true,
  arrow: true,
  rule: true,
};

const LOOK_CLASSIC: Partial<Style> = {
  layout: "classic",
  fontFamily: "'Montserrat', sans-serif",
  displayFont: "'Montserrat', sans-serif",
  textWeight: 300,
  textItalic: false,
  bodySize: 62,
  ctaSize: 66,
  bodyColour: "#ffffff",
  ctaColour: "#ffffff",
  lineColour: "#ffffff",
  uppercase: true,
  letterSpacing: 1,
  lineHeight: 1.25,
  align: "centre",
  bodyY: 50,
  overlay: 12,
  scrim: 0,
  shadow: true,
  frame: false,
  counter: false,
  brandMark: false,
  arrow: false,
  rule: false,
};

const DEFAULT_STYLE: Style = {
  ...COVER_PRESETS.band,
  ...LOOK_EDITORIAL,
  plainFont: "'Cormorant Garamond', serif",
  plainSubFont: "'Montserrat', sans-serif",
  behindFont: "'Anton', sans-serif",
  behindSubFont: "'Inter Tight', sans-serif",
  lf: {
    fullbleed: { h: "'Bebas Neue', sans-serif", s: "'Playfair Display', serif" },
    blur: { h: "'Instrument Serif', serif", s: "'Inter Tight', sans-serif" },
    strip: { h: "'Bebas Neue', sans-serif", s: "'Poppins', sans-serif" },
    diagonal: { h: "'Jost', sans-serif", s: "'Jost', sans-serif" },
    behind2: { h: "'Anton', sans-serif", s: "'Montserrat', sans-serif" },
    polaroid: { h: "'DM Serif Display', serif", s: "'Inter Tight', sans-serif" },
    sidebar: { h: "'DM Serif Display', serif", s: "'Inter Tight', sans-serif" },
    frame: { h: "'Playfair Display', serif", s: "'Playfair Display', serif" },
    layered: { h: "'Anton', sans-serif", s: "'Inter Tight', sans-serif" },
  },
  clientCoverFont: "",
  clientCoverSubFont: "",
  cvBlur: 90,
  cvAngle: 24,
  cvAll: false,
  cvAllColour: "#ffffff",
  cvAllSubColour: "#ffffff",
  cvBand: "#666666",
  cvBlockAll: "",
  cvBandAll: "",
  cvY: 58,
  cvScrim: 0,
  cvGradOn: false,
  cvGradFrom: "#ff5f6d",
  cvGradTo: "#6a11cb",
  cvGradOpacity: 45,
  background: "#8a8a8a",
  showLogo: false,
  logoScale: 1.35,
} as Style;

// Vanessa never wants em dashes (or spaced en dashes) in captions.
const noDashes = (t: string) =>
  t.replace(/(\d)\u2013(\d)/g, "$1-$2").replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/,\s*,/g, ",");

type Post = {
  id: string;
  texts: string[]; // headline, subtitle, ...text columns, cta
  caption: string;
  captionBusy: boolean;
  selected: boolean;
  cover?: CoverLayout; // this post's own cover option. Empty means it follows the main choice.
  coverColour?: string;    // this post's own headline colour on slide 1. Empty means the option's colour.
  coverSubColour?: string; // and its subtitle colour
  coverBlockColour?: string; // its band or block colour (band, block and split covers)
  coverBandColour?: string;  // and the split cover's bottom band
  coverPunch?: number;     // October 26: contrast and colour boost on the photo
  coverTowel?: boolean;    // No. 17: towel on the head
  coverShades?: boolean;   // No. 17: sunglasses
  coverSpot?: string;      // this post's spot colour for the recolourable picture (heels, lips, glove)
  coverAlts?: Record<number, number>; // curly letters, by position in the headline
  coverCaps?: boolean;     // this post's capitals switch. Empty follows the cover's own.
  coverCurve?: number;     // this post's headline curve, letter spacing and line spacing on slide 1
  coverTracking?: number;
  coverLeading?: number;
  coverFont?: string;      // this post's own headline font on slide 1. Empty follows the client's font.
  coverSubFont?: string;   // and its subtitle font
};

type SlideKind = "cover" | "body" | "cta";
type SlideSpec = { kind: SlideKind; text: string; sub: string };

const COVER_FONTS = [
  { label: "Inter Tight", value: INTER_TIGHT },
  { label: "Instrument Serif", value: F_INSTRUMENT },
  { label: "Poppins", value: "'Poppins', sans-serif" },
  { label: "Montserrat", value: "'Montserrat', sans-serif" },
  { label: "Jost", value: "'Jost', sans-serif" },
  { label: "Anton", value: "'Anton', sans-serif" },
  { label: "Bebas Neue", value: "'Bebas Neue', sans-serif" },
  { label: "Oswald", value: "'Oswald', sans-serif" },
  { label: "Barlow Condensed", value: "'Barlow Condensed', sans-serif" },
  { label: "Raleway", value: "'Raleway', sans-serif" },
  { label: "Playfair Display", value: "'Playfair Display', serif" },
  { label: "Cormorant Garamond", value: "'Cormorant Garamond', serif" },
  { label: "DM Serif Display", value: "'DM Serif Display', serif" },
];

const COVER_WEIGHTS = [
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Medium", value: 500 },
  { label: "Semi bold", value: 600 },
  { label: "Bold", value: 700 },
  { label: "Extra bold", value: 800 },
  { label: "Black", value: 900 },
];

const WEIGHTS = [
  { label: "Light", value: 300 },
  { label: "Regular", value: 400 },
  { label: "Semi bold", value: 600 },
  { label: "Bold", value: 700 },
];

const TONES = [
  { value: "1", label: "Northern grit" },
  { value: "2", label: "Storyteller, whimsical" },
  { value: "3", label: "Funny and blunt" },
  { value: "4", label: "Professional with personality" },
  { value: "5", label: "Feral, savage, sarcastic" },
];

const SAMPLE_CSV = [
  "headline,subtitle,text 1,text 2,text 3,cta",
  `"5 reasons","to always wear SPF","Your future skin will thank you","It keeps skin care at the forefront of your mind","You're teaching the youth how to grow old properly.","Book a skin consultation"`,
].join("\n");

// ---------------------------------------------------------------------------
// CSV to slides
// ---------------------------------------------------------------------------

function buildSlides(texts: string[]): SlideSpec[] {
  const t = texts.map(x => (x ?? "").trim());
  const out: SlideSpec[] = [];
  if (t[0]) out.push({ kind: "cover", text: t[0], sub: t[1] ?? "" });
  const last = t.length >= 3 ? t.length - 1 : -1;
  for (let i = 2; i < t.length; i++) {
    if (!t[i]) continue;
    out.push({ kind: i === last ? "cta" : "body", text: t[i], sub: "" });
  }
  return out;
}

// Block, serif, diagonal, behind 2, polaroid and layered were retired. Their drawing code is left in place, but they are no longer offered.
const COVER_ORDER: CoverLayout[] = ["band", "centred", "split", "plain", "behind", "fullbleed", "blur", "strip", "sidebar", "frame"];

// The "October 26" set. Each look is named by its number on the Pinterest board.
const OCT_ORDER: CoverLayout[] = ["oct1", "oct2", "oct3", "oct4", "oct5", "oct6", "oct7", "oct8", "oct9", "oct10", "oct11", "oct12", "oct13", "oct14", "oct15", "oct16", "oct17", "oct18"];
const OCT_LAYOUTS = new Set<CoverLayout>(OCT_ORDER);
const OCT_NAMES: Partial<Record<CoverLayout, string>> = {
  oct3: "Poster on the pavement", oct4: "Poster on the wall", oct7: "Shhh lips", oct12: "Newspaper on a chair", oct14: "Black heels", oct16: "Glove and card",
  oct1: "Newspaper over the face", oct8: "Retro badge", oct9: "Yellow jumper newspaper", oct11: "Street poster", oct17: "Better late than ugly", oct2: "Escalator advert", oct5: "Three newspapers", oct10: "Peeping through blinds", oct15: "Stack of books", oct6: "Black and white portrait", oct13: "Magazine cover", oct18: "Big serif lettering",
};
const OCT_HELP: Partial<Record<CoverLayout, string>> = {
  oct3: "Black heels standing on a poster. The headline goes on the poster. Use the shared heels photo.",
  oct4: "The clinician holding a poster, headline on the poster and the clinic name along the bottom.",
  oct7: "Lips with a finger held to them in the brand colour, headline across the bottom.",
  oct12: "The clinician behind a newspaper on a cafe chair, black and white, headline on the newspaper.",
  oct14: "Glossy black heels in black and white, one big headline on the left.",
  oct16: "A gloved hand holding a card, headline on the card.",
  oct6: "A black and white portrait of the clinician with one headline across the bottom.",
  oct13: "A magazine cover over a photo of the client. Headline: MASTHEAD | SECOND HEADLINE. Subtitle: the small line. OCTOBER 2026 sits under the masthead.",
  oct18: "One huge serif headline across the photo, used for a treatment name.",
  oct1: "The clinician peeping over a newspaper in the clinic colour. Headline: Book your consultation at the clinic. Subtitle: the tiny masthead (Aesthetics news). Move the photo so the eyes sit above the paper.",
  oct8: "A retro badge: the photo turned into a flat illustration in the clinic colour. Headline on top, subtitle below, TODAY on the ribbon.",
  oct9: "Black and white photo with the dress and shoes in the clinic colour and a big newspaper held in front. Headline on the paper, subtitle small beneath it.",
  oct11: "A street poster: the photo with the shoes in the clinic colour. Headline: HEADING 1 | HEADING 2. Subtitle along the bottom.",
  oct17: "A panelled wall in the clinic colours, the clinician in an arch holding a newspaper. Headline on the paper, subtitle as the text beneath it. Tick Towel or Sunglasses below for the full look.",
  oct2: "Two photo frames beside a colour strip, the headline running up the strip. The second frame uses the post's second photo.",
  oct5: "Three newspapers over a winter photo. Headline: HEADLINE 1 | HEADLINE 2 | HEADLINE 3. Subtitle: SUBTITLE 1 | SUBTITLE 2 (small Breaking news style lines).",
  oct10: "A black and white portrait seen through blinds in the clinic colour, headline in the bottom third.",
  oct15: "A stack of books in shades of the clinic colour, one headline on each spine. Headline: ONE | TWO | THREE and so on, up to seven.",
};

// The name of each cover's colour block, for the colour picker. Covers not listed have no block.
const BLOCK_LABEL: Partial<Record<CoverLayout, string>> = {
  band: "Band colour", block: "Block colour", split: "Block colour", plain: "Background colour", behind: "Background colour",
  behind2: "Background colour", strip: "Band colour", polaroid: "Background colour", sidebar: "Band colour", frame: "Panel colour", layered: "Card colour",
};

// Each cover's headline and subtitle fonts, before any client override.
function coverDefaultFaces(style: Style, layout: CoverLayout): [string, string] {
  if (layout === "plain") return [style.plainFont, style.plainSubFont];
  if (layout === "behind") return [style.behindFont, style.behindSubFont];
  const f = style.lf?.[layout];
  return f ? [f.h, f.s] : [style.cvFont, style.cvSubFont];
}

// Each cover's headline and subtitle fonts. Once a client has their own cover fonts set, those
// take over on every cover option's slide 1, whichever look that option is otherwise using.
function faces(style: Style, layout: CoverLayout): [string, string] {
  const [h, s] = coverDefaultFaces(style, layout);
  return [style.clientCoverFont || h, style.clientCoverSubFont || s];
}

// The look of a slide. A post that has its own cover option gets that option's designed fonts, colours and
// proportions on slide 1. Every other slide, and every post on the main choice, uses the settings as they are.
function styleForSlide(style: Style, post: Post, kind: SlideKind): Style {
  if (kind !== "cover") return style;
  let out = style;
  if (post.cover && post.cover !== style.coverLayout) out = { ...style, ...COVER_PRESETS[post.cover] } as Style;
  // A picture block (such as leopard print) chosen for the whole set is kept on every cover option.
  if (TEXTURES[style.cvBlock]) out = { ...out, cvBlock: style.cvBlock };
  // "Change all" colours win over each cover option's own designed colours, so posts on their own
  // option do not slip back to that option's white block or grey band.
  if (style.cvBlockAll) out = { ...out, cvBlock: style.cvBlockAll };
  if (style.cvBandAll) out = { ...out, cvBand: style.cvBandAll };
  if (style.cvAll) out = { ...out, cvColour: style.cvAllColour, cvSubColour: style.cvAllSubColour };
  if (post.coverSpot) out = { ...out, cvSpot: post.coverSpot };
  if (post.coverPunch !== undefined) out = { ...out, cvPunch: post.coverPunch };
  if (post.coverTowel !== undefined) out = { ...out, cvTowel: post.coverTowel };
  if (post.coverShades !== undefined) out = { ...out, cvShades: post.coverShades };
  if (post.coverAlts) out = { ...out, cvAlts: post.coverAlts };
  if (post.coverCaps !== undefined) out = { ...out, cvCaps: post.coverCaps };
  if (post.coverCurve !== undefined) out = { ...out, cvCurve: post.coverCurve };
  if (post.coverTracking !== undefined) out = { ...out, cvTracking: post.coverTracking };
  if (post.coverLeading !== undefined) out = { ...out, cvLeading: post.coverLeading };
  if (post.coverFont) out = { ...out, clientCoverFont: post.coverFont };
  if (post.coverSubFont) out = { ...out, clientCoverSubFont: post.coverSubFont };
  if (post.coverColour) out = { ...out, cvColour: post.coverColour };
  if (post.coverSubColour) out = { ...out, cvSubColour: post.coverSubColour };
  if (post.coverBlockColour) out = { ...out, cvBlock: post.coverBlockColour };
  if (post.coverBandColour) out = { ...out, cvBand: post.coverBandColour };
  return out;
}

function naturalSort(a: File, b: File) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

// Fills every slide by cycling through the photos. Slide 1 of each post is taken from the pool in turn,
// so covers do not repeat until every photo has been a cover. The other slides carry on round the pool
// without ever repeating the cover, or each other, inside the same post (as far as the pool allows).
function planReusedPhotos(pool: File[], slideCounts: number[]): File[][] {
  const n = pool.length;
  if (!n) return slideCounts.map(() => []);
  let body = 1;
  return slideCounts.map((count, p) => {
    if (count <= 0) return [];
    const cover = p % n;
    const picked = [cover];
    let guard = 0;
    while (picked.length < count && guard++ < n * count + 10) {
      const idx = body % n;
      body++;
      if (n > 1 && picked.length < n && picked.includes(idx)) continue;
      // Pool smaller than the slides: allow repeats, but never the cover or the slide just before.
      if (n > 1 && picked.length >= n && (idx === cover || idx === picked[picked.length - 1])) continue;
      picked.push(idx);
    }
    while (picked.length < count) picked.push(cover);
    return picked.map(i => pool[i]);
  });
}

// ---------------------------------------------------------------------------
// Image preparation. Each photo is shrunk once (never cropped, so it can be dragged
// around later) and kept as a compressed blob so a large batch does not hold
// gigabytes of pixels in memory.
// ---------------------------------------------------------------------------

const MAX_PHOTO_SIDE = 2400;
const prepared = new Map<File, Promise<Blob | null>>();
const photoDims = new Map<File, { w: number; h: number }>();
const octDims = new Map<File, { w: number; h: number }>(); // raw size of the photos used as October 26 covers

// Face finding. Uses the browser's own detector when it has one, otherwise a small model that is
// fetched once. Any failure just means the photo is left as it was.
type FacePoint = { x: number; y: number };
let faceDetectorPromise: Promise<((c: HTMLCanvasElement) => Promise<FacePoint | null>) | null> | null = null;

function getFaceDetector() {
  if (faceDetectorPromise) return faceDetectorPromise;
  faceDetectorPromise = (async () => {
    try {
      const Native = (window as unknown as { FaceDetector?: new (o?: object) => { detect: (i: CanvasImageSource) => Promise<{ boundingBox: DOMRectReadOnly }[]> } }).FaceDetector;
      if (Native) {
        const d = new Native({ fastMode: true, maxDetectedFaces: 4 });
        return async (c: HTMLCanvasElement) => {
          const faces = await d.detect(c);
          if (!faces.length) return null;
          const b = faces.map(f => f.boundingBox).sort((a, z) => z.width * z.height - a.width * a.height)[0];
          return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        };
      }
      const base = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
      const mod = await import(/* @vite-ignore */ `${base}/vision_bundle.mjs`);
      const fileset = await mod.FilesetResolver.forVisionTasks(`${base}/wasm`);
      const det = await mod.FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite" },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
      return async (c: HTMLCanvasElement) => {
        const res = det.detect(c);
        const dets = (res?.detections ?? []) as { boundingBox?: { originX: number; originY: number; width: number; height: number } }[];
        const boxes = dets.map(d => d.boundingBox).filter(Boolean) as { originX: number; originY: number; width: number; height: number }[];
        if (!boxes.length) return null;
        const b = boxes.sort((a, z) => z.width * z.height - a.width * a.height)[0];
        return { x: b.originX + b.width / 2, y: b.originY + b.height / 2 };
      };
    } catch {
      return null;
    }
  })();
  return faceDetectorPromise;
}

async function findFace(canvas: HTMLCanvasElement): Promise<FacePoint | null> {
  try {
    const detect = await getFaceDetector();
    return detect ? await detect(canvas) : null;
  } catch { return null; }
}

function prepareImage(file: File): Promise<Blob | null> {
  const existing = prepared.get(file);
  if (existing) return existing;
  const p = (async () => {
    try {
      const bmp = await createImageBitmap(file);
      const s = Math.min(1, MAX_PHOTO_SIDE / Math.max(bmp.width, bmp.height));
      const w = Math.max(1, Math.round(bmp.width * s));
      const h = Math.max(1, Math.round(bmp.height * s));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      // Find the face and trim the photo so the face sits in the middle of the slide, so nobody
      // has to drag every photo into place. Falls back to the untouched photo if no face is found.
      const face = await findFace(canvas);
      let out: HTMLCanvasElement = canvas;
      let ow = w, oh = h;
      if (face) {
        let cx = 0, cy = 0, cw = w, ch = h;
        const hw = Math.min(face.x, w - face.x);
        if (Math.abs(face.x - w / 2) > w * 0.04 && hw * 2 >= w * 0.55) { cx = face.x - hw; cw = hw * 2; }
        const maxH = Math.min(h, face.y / 0.48, (h - face.y) / 0.52);
        if (maxH >= h * 0.5 && maxH < h * 0.98) { ch = maxH; cy = face.y - 0.48 * ch; }
        if (cw !== w || ch !== h) {
          cx = Math.round(cx); cy = Math.round(cy); cw = Math.round(cw); ch = Math.round(ch);
          const c2 = document.createElement("canvas");
          c2.width = cw; c2.height = ch;
          c2.getContext("2d")!.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
          out = c2; ow = cw; oh = ch;
        }
      }
      photoDims.set(file, { w: ow, h: oh });
      return await new Promise<Blob | null>(res => out.toBlob(b => res(b), "image/jpeg", 0.93));
    } catch {
      return null;
    }
  })();
  prepared.set(file, p);
  return p;
}

// Where a photo sits inside its frame, in percent (50, 50 is centred). Dragging changes it per slide.
type PhotoPos = { x: number; y: number; z?: number }; // z = zoom, 1 to 3 (October 26 covers)

// How far a headline (and its subtitle) has been nudged from its usual spot, in canvas pixels.
type TextPos = { dx: number; dy: number };
const ZERO_TEXT_POS: TextPos = { dx: 0, dy: 0 };

// A photo is scaled up a bit past the bare minimum needed to cover its frame, so there's real
// room either side to drag it around instead of it barely being able to move at all.
const PHOTO_OVERSCAN = 1.45;

// The frame a slide's photo fills, so a drag can be turned into a shift of the photo.
function photoArea(kind: SlideKind, style: Style): { w: number; h: number } {
  if (kind !== "cover") return { w: W, h: H };
  if (style.coverLayout === "band" || style.coverLayout === "block") return { w: W, h: Math.round(H * (style.cvPhoto / 100)) };
  if (style.coverLayout === "split") return { w: Math.round(W * (style.cvPhoto / 100)), h: H };
  return { w: W, h: H };
}

function defaultPos(kind: SlideKind, style: Style): PhotoPos {
  if (kind !== "cover") return { x: 50, y: 50 };
  if (style.coverLayout === "band" || style.coverLayout === "block") return { x: 50, y: style.cvFocus };
  if (style.coverLayout === "split") return { x: style.cvFocus, y: 50 };
  return { x: 50, y: 50 };
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = src;
  });
}

async function loadLogo(preset: ClientPreset | null): Promise<HTMLImageElement | null> {
  if (!preset?.logoUrl) return null;
  try { return await loadImg(preset.logoUrl); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function setSpacing(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = `${px}px`;
}


// -- curly letters ----------------------------------------------------------------------------
// Many fonts hold spare letter shapes (swashes, stylistic sets) that a canvas cannot switch on by itself.
// The uploaded font file is read here, and the chosen letters are drawn from those alternates.
const fontBytes = new Map<string, ArrayBuffer>(); // lower case family name to the uploaded font file
const otCache = new Map<string, { font: opentype.Font; alts: Map<number, number[]> } | null>();

function cssFamilyKey(face: string): string {
  const m = face.match(/^\s*['"]?([^'",]+)['"]?/);
  return (m?.[1] ?? "").trim().toLowerCase();
}

function loadOtFont(face: string): { font: opentype.Font; alts: Map<number, number[]> } | null {
  const key = cssFamilyKey(face);
  if (otCache.has(key)) return otCache.get(key) ?? null;
  const data = fontBytes.get(key);
  if (!data) return null;
  try {
    const font = opentype.parse(data.slice(0));
    const alts = new Map<number, number[]>();
    for (const tag of ["salt", "swsh", "cswh", "ss01", "ss02", "ss03", "ss04", "ss05", "aalt"]) {
      for (const script of [undefined, "latn"]) {
        try {
          const list = (font.substitution as unknown as { getFeature(f: string, s?: string): { sub: number; by: number | number[] }[] | undefined }).getFeature(tag, script) ?? [];
          for (const it of list) {
            const bys = Array.isArray(it.by) ? it.by : [it.by];
            const cur = alts.get(it.sub) ?? [];
            for (const b of bys) if (b !== it.sub && !cur.includes(b)) cur.push(b);
            alts.set(it.sub, cur);
          }
        } catch { /* this feature is not in the font */ }
      }
    }
    const out = { font, alts };
    otCache.set(key, out);
    return out;
  } catch {
    otCache.set(key, null);
    return null;
  }
}

// How many curly versions this font has for one letter.
function altCount(face: string, ch: string): number {
  const f = loadOtFont(face);
  if (!f) return 0;
  return f.alts.get(f.font.charToGlyph(ch).index)?.length ?? 0;
}

// One line drawn from the font's own letter shapes, using the chosen alternates. Optionally bent along an arc.
function drawGlyphLine(
  ctx: CanvasRenderingContext2D, ot: { font: opentype.Font; alts: Map<number, number[]> }, line: string, startIdx: number,
  choice: Record<number, number>, cx: number, baseline: number, size: number, tracking: number, curve: number, fill: string,
) {
  const chars = [...line];
  const glyphs = chars.map((ch, i) => {
    const base = ot.font.charToGlyph(ch);
    const list = ot.alts.get(base.index) ?? [];
    const pick = choice[startIdx + i] ?? 0;
    return pick > 0 && list[pick - 1] !== undefined ? ot.font.glyphs.get(list[pick - 1]) : base;
  });
  const scale = size / ot.font.unitsPerEm;
  const adv = glyphs.map(g => (g.advanceWidth ?? 0) * scale + tracking);
  const total = adv.reduce((a, b) => a + b, 0) - tracking;
  const span = (Math.abs(curve) / 100) * 1.5;
  const R = span > 0.01 ? total / span : 0;
  const up = curve > 0;
  let pos = -total / 2;
  glyphs.forEach((g, i) => {
    const w = adv[i] - tracking;
    const mid = pos + w / 2;
    pos += adv[i];
    ctx.save();
    if (R > 0) {
      const a = mid / R;
      const dy = R * (1 - Math.cos(a));
      ctx.translate(cx + R * Math.sin(a), up ? baseline + dy : baseline - dy);
      ctx.rotate(up ? a : -a);
      const path = g.getPath(-w / 2, 0, size);
      path.fill = fill; path.draw(ctx);
    } else {
      const path = g.getPath(cx + mid - w / 2, baseline, size);
      path.fill = fill; path.draw(ctx);
    }
    ctx.restore();
  });
}

// One line of words bent along an arc. curve is -100 to 100: above 0 arches it up, below 0 makes a smile.
function drawCurvedLine(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, curve: number, tracking: number) {
  const chars = [...text];
  setSpacing(ctx, 0);
  const widths = chars.map(c => ctx.measureText(c).width + tracking);
  const total = widths.reduce((a, b) => a + b, 0) - tracking;
  const span = (Math.abs(curve) / 100) * 1.5; // radians the whole line covers, at most about 86 degrees
  const R = total / span;
  const up = curve > 0;
  ctx.save();
  ctx.textAlign = "center";
  let pos = -total / 2;
  chars.forEach((ch, i) => {
    const mid = pos + (widths[i] - tracking) / 2;
    pos += widths[i];
    const a = mid / R;
    const dy = R * (1 - Math.cos(a));
    ctx.save();
    ctx.translate(cx + R * Math.sin(a), up ? y + dy : y - dy);
    ctx.rotate(up ? a : -a);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (cur && ctx.measureText(test).width > maxW) { out.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) out.push(cur);
  }
  return out.length ? out : [""];
}

function widest(ctx: CanvasRenderingContext2D, lines: string[]) {
  return lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
}

// Wraps text, then narrows the line width as far as it can without adding a line,
// so the last line is never a lonely word.
function balancedWrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const base = wrapText(ctx, text, maxW);
  if (base.length < 2) return base;
  let best = base;
  for (let w = maxW - 12; w >= maxW * 0.5; w -= 12) {
    const l = wrapText(ctx, text, w);
    if (l.length > base.length || widest(ctx, l) > maxW) break;
    best = l;
  }
  return best;
}

type Block = { lines: string[]; font: string; lineH: number; colour: string; gapBefore: number; spacing: number };

function drawLogo(ctx: CanvasRenderingContext2D, logo: HTMLImageElement, position: string, size: number) {
  if (!position || position === "none") return;
  const pad = 44;
  const asp = logo.naturalWidth / logo.naturalHeight;
  const lw = asp >= 1 ? size : size * asp;
  const lh = asp >= 1 ? size / asp : size;
  let x = pad, y = pad;
  if (position === "top-right") x = W - lw - pad;
  else if (position === "bottom-left") y = H - lh - pad;
  else if (position === "bottom-right") { x = W - lw - pad; y = H - lh - pad; }
  ctx.shadowColor = "transparent";
  ctx.globalAlpha = 0.92;
  ctx.drawImage(logo, x, y, lw, lh);
  ctx.globalAlpha = 1;
}

type RenderMeta = { index: number; total: number; extras?: (File | null)[] };

function drawPhotoIn(
  ctx: CanvasRenderingContext2D, bmp: ImageBitmap,
  x: number, y: number, w: number, h: number, pos: PhotoPos,
) {
  const sc = Math.max(w / bmp.width, h / bmp.height) * PHOTO_OVERSCAN;
  const dw = bmp.width * sc;
  const dh = bmp.height * sc;
  const dx = x + (w - dw) * (pos.x / 100);
  const dy = y + (h - dh) * (pos.y / 100);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(bmp, dx, dy, dw, dh);
  ctx.restore();
}

// Shrinks a heading to fit: one line if it can stay above 55% of the size, otherwise wrapped and balanced.
function fitHeading(
  ctx: CanvasRenderingContext2D, text: string, fontAt: (size: number) => string,
  maxW: number, maxSize: number, maxLines = 3,
): { size: number; lines: string[] } {
  if (!text.includes("\n")) {
    for (let sz = maxSize; sz >= maxSize * 0.55; sz -= 4) {
      ctx.font = fontAt(sz);
      if (ctx.measureText(text).width <= maxW) return { size: sz, lines: [text] };
    }
  }
  let lines: string[] = [text];
  let size = maxSize;
  for (let sz = maxSize; sz >= 30; sz -= 4) {
    ctx.font = fontAt(sz);
    lines = balancedWrap(ctx, text, maxW);
    size = sz;
    if (lines.length <= maxLines && widest(ctx, lines) <= maxW) break;
  }
  return { size, lines };
}

// Cuts the person out of a photo, in this browser (nothing is uploaded). Done one at a time and remembered,
// because it takes several seconds the first time.
const cutoutBlobs = new WeakMap<File, Promise<Blob | null>>();
let cutoutQueue: Promise<unknown> = Promise.resolve();
let cutoutFailedNoted = false;
let cutoutsWaiting = 0;

function cutoutBlob(file: File): Promise<Blob | null> {
  const existing = cutoutBlobs.get(file);
  if (existing) return existing;
  cutoutsWaiting++;
  const job = cutoutQueue.then(async () => {
    const toastId = "stylish-cutout";
    toast.loading("Cutting the person out of the photo (the first time takes a little while)", { id: toastId });
    try {
      const src = await prepareImage(file);
      if (!src) return null;
      const { removeBackground } = await import("@imgly/background-removal");
      // Big photos can run the browser out of memory, so the cut-out works from a smaller copy.
      const small = await shrinkBlob(src, 1500);
      const opts = { model: "isnet" as const, output: { format: "image/png" as const, quality: 0.95 } };
      try {
        return await removeBackground(small, opts);
      } catch (first) {
        console.warn("Cutout first try failed, retrying on the processor", first);
        return await removeBackground(small, { ...opts, device: "cpu" as const });
      }
    } catch (err) {
      console.warn("Cutout failed, using the whole photo", err);
      // Say it once per session at most, quietly, so a batch of photos does not spam the screen.
      if (!cutoutFailedNoted) {
        cutoutFailedNoted = true;
        toast.message("The cut out effect is not available right now, so those covers use the whole photo", { duration: 4000 });
      }
      return null;
    } finally {
      cutoutsWaiting--;
      if (cutoutsWaiting <= 0) toast.dismiss(toastId);
    }
  });
  cutoutQueue = job.catch(() => null);
  cutoutBlobs.set(file, job);
  return job;
}

async function shrinkBlob(blob: Blob, maxSide: number): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob);
    const sc = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (sc >= 1) { bmp.close(); return blob; }
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const out = await new Promise<Blob | null>(res => c.toBlob(b => res(b), "image/jpeg", 0.92));
    return out ?? blob;
  } catch { return blob; }
}

async function getCutout(file: File): Promise<ImageBitmap | null> {
  const blob = await cutoutBlob(file);
  return blob ? createImageBitmap(blob) : null;
}


// ---------------------------------------------------------------------------
// Cover options 8 to 16
// ---------------------------------------------------------------------------

const MORE_LAYOUTS = new Set<CoverLayout>(["fullbleed", "blur", "strip", "diagonal", "behind2", "polaroid", "sidebar", "frame", "layered"]);

// A small print style card, drawn tilted around its centre. Anything passed as inner is drawn in the tilted space.
function drawPolaroid(
  ctx: CanvasRenderingContext2D, bmp: ImageBitmap | null, cx: number, cy: number, w: number, h: number, rot: number,
  card: string, pad: number, capH: number, inner?: () => void,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
  ctx.fillStyle = card;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  if (bmp) drawPhotoIn(ctx, bmp, -w / 2 + pad, -h / 2 + pad, w - pad * 2, h - pad - capH, { x: 50, y: 50 });
  inner?.();
  ctx.restore();
}

function drawBinderClip(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#c9c9c9"; ctx.lineWidth = 9; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-32, 10); ctx.lineTo(-32, -70); ctx.arc(0, -70, 32, Math.PI, 0); ctx.lineTo(32, 10); ctx.stroke();
  ctx.fillStyle = "#141414";
  ctx.beginPath(); ctx.moveTo(-80, 0); ctx.lineTo(80, 0); ctx.lineTo(62, 86); ctx.lineTo(-62, 86); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawPaperclip(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#d9998a"; ctx.lineWidth = 7; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, 70); ctx.lineTo(0, -50); ctx.arc(18, -50, 18, Math.PI, 0); ctx.lineTo(36, 66); ctx.arc(24, 66, 12, 0, Math.PI); ctx.lineTo(12, -30); ctx.stroke();
  ctx.restore();
}

// Picture fills for a cover's block colour. A block colour of one of these keys paints the picture
// instead of a flat colour. The pictures live in the public/textures folder.
const TEXTURES: Record<string, { label: string; file: string }> = {
  "texture:leopard": { label: "Leopard print", file: "textures/leopard.jpg" },
};
const textureCache = new Map<string, HTMLImageElement>();
function preloadTexture(value: string): Promise<void> {
  const t = TEXTURES[value];
  if (!t || textureCache.has(value)) return Promise.resolve();
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { textureCache.set(value, img); resolve(); };
    img.onerror = () => resolve();
    img.src = `${import.meta.env.BASE_URL}${t.file}`;
  });
}
// A flat colour, or the picture pattern when the value is a texture key that has loaded.
function blockFill(ctx: CanvasRenderingContext2D, value: string): string | CanvasPattern {
  const img = textureCache.get(value);
  if (img) { const pat = ctx.createPattern(img, "repeat"); if (pat) return pat; }
  return TEXTURES[value] ? "#8a6a3b" : value;
}

// Metallic cover text. A headline or subtitle colour of one of the METALLICS keys below paints
// with a shine-sweep gradient instead of a flat colour.
const METALLICS: Record<string, { label: string; stops: [number, string][] }> = {
  "metallic-gold": { label: "Gold", stops: [[0, "#fff6d8"], [0.25, "#e8c34a"], [0.5, "#b8860b"], [0.75, "#f5d67e"], [1, "#8a6a1f"]] },
  "metallic-silver": { label: "Silver", stops: [[0, "#ffffff"], [0.25, "#c9c9c9"], [0.5, "#8e8e8e"], [0.75, "#eaeaea"], [1, "#5a5a5a"]] },
  "metallic-rose-gold": { label: "Rose gold", stops: [[0, "#ffe4dc"], [0.25, "#e8a998"], [0.5, "#b76e79"], [0.75, "#f0c3b6"], [1, "#8a4a4f"]] },
  "metallic-bronze": { label: "Bronze", stops: [[0, "#f0d3a8"], [0.25, "#cd7f32"], [0.5, "#8c5a26"], [0.75, "#e0a866"], [1, "#5c3a17"]] },
  "metallic-gunmetal": { label: "Gunmetal", stops: [[0, "#d8dde1"], [0.25, "#8b969e"], [0.5, "#3a4148"], [0.75, "#aeb7bd"], [1, "#1c2024"]] },
  "metallic-copper": { label: "Copper", stops: [[0, "#f7c9a3"], [0.25, "#c96f3e"], [0.5, "#8f4520"], [0.75, "#e39a68"], [1, "#5a2a11"]] },
};
function metallicFill(ctx: CanvasRenderingContext2D, colour: string): string | CanvasGradient {
  const m = METALLICS[colour];
  if (!m) return colour;
  const g = ctx.createLinearGradient(0, 0, W * 0.75, H * 0.22);
  for (const [offset, c] of m.stops) g.addColorStop(offset, c);
  return g;
}

// A colour gradient wash over the cover photo (or cutout), blended so the photo still shows through.
function applyCoverGradient(ctx: CanvasRenderingContext2D, style: Style, x: number, y: number, w: number, h: number) {
  if (!style.cvGradOn || style.cvGradOpacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = style.cvGradOpacity / 100;
  ctx.globalCompositeOperation = "overlay";
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, style.cvGradFrom);
  g.addColorStop(1, style.cvGradTo);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

async function drawCoverMore(
  ctx: CanvasRenderingContext2D, spec: SlideSpec, photo: File | null, extras: (File | null)[],
  style: Style, layout: CoverLayout, at: PhotoPos, textAt: TextPos = ZERO_TEXT_POS, subTextAt: TextPos = ZERO_TEXT_POS,
  headScale = 1, subScale = 1,
) {
  const [hf, sf] = faces(style, layout);
  const head = style.cvCaps ? spec.text.toUpperCase() : spec.text;
  const sub = spec.sub ? (style.cvSubCaps ? spec.sub.toUpperCase() : spec.sub) : "";
  const headFont = (sz: number) => `${style.cvWeight} ${sz}px ${hf}`;
  const subSize = Math.round(style.cvSubSize * subScale);
  const subLineH = Math.round(subSize * 1.3);
  ctx.textBaseline = "top";
  const drawLines = (ls: string[], x: number, y: number, lh: number, align: CanvasTextAlign) => {
    ctx.textAlign = align;
    for (const l of ls) { ctx.fillText(l, x, y); y += lh; }
    return y;
  };
  const setHead = (sz: number) => { ctx.font = headFont(sz); setSpacing(ctx, style.cvTracking); ctx.fillStyle = metallicFill(ctx, style.cvColour); };
  const setSub = () => { ctx.font = `${style.cvSubWeight} ${subSize}px ${sf}`; setSpacing(ctx, style.cvSubTracking); ctx.fillStyle = metallicFill(ctx, style.cvSubColour); };
  const opened: ImageBitmap[] = [];
  const open = async (f: File | null) => {
    if (!f) return null;
    const blob = await prepareImage(f);
    const b = blob ? await createImageBitmap(blob) : null;
    if (b) opened.push(b);
    return b;
  };
  const fill = (c: string) => { ctx.fillStyle = blockFill(ctx, c); ctx.fillRect(0, 0, W, H); };
  const scrim = () => { if (style.cvScrim > 0) { ctx.fillStyle = `rgba(0,0,0,${style.cvScrim / 100})`; ctx.fillRect(0, 0, W, H); } };
  // Headline: from a top edge, or centred on a height.
  const heading = (x: number, where: { top?: number; centre?: number }, maxW: number, maxLines: number, align: CanvasTextAlign, factor = 0.96) => {
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, head, headFont, maxW, style.cvSize * headScale, maxLines);
    const lh = Math.round(fit.size * factor);
    const top = where.top ?? Math.round((where.centre ?? H / 2) - (fit.lines.length * lh) / 2);
    setHead(fit.size);
    return { bottom: drawLines(fit.lines, x + textAt.dx, top + textAt.dy, lh, align) - textAt.dy, size: fit.size };
  };
  const subtitle = (x: number, y: number, maxW: number, align: CanvasTextAlign) => {
    if (!sub) return y;
    setSub();
    return drawLines(balancedWrap(ctx, sub, maxW), x + subTextAt.dx, y + subTextAt.dy, subLineH, align) - subTextAt.dy;
  };
  const shadowOn = () => { ctx.shadowColor = "rgba(0,0,0,0.25)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12; };
  const shadowOff = () => { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };

  try {
    if (layout === "fullbleed") {
      // Option 8: full photo, big stacked headline top left, subtitle low down.
      fill("#777777");
      const b = await open(photo);
      if (b) drawPhotoIn(ctx, b, 0, 0, W, H, at);
      applyCoverGradient(ctx, style, 0, 0, W, H);
      scrim();
      heading(110, { top: Math.round((style.cvY / 100) * H) }, Math.round(W * 0.6), 4, "left");
      subtitle(110, Math.round(H * 0.77), Math.round(W * 0.7), "left");
    } else if (layout === "blur") {
      // Option 9: the photo smeared sideways like a long exposure, headline and subtitle in the middle.
      fill("#9a9a9a");
      const b = await open(photo);
      if (b) {
        const n = 30, span = Math.max(0, style.cvBlur);
        for (let i = 0; i < n; i++) {
          ctx.globalAlpha = 1 / (i + 1);
          const off = span ? (i / (n - 1) - 0.5) * span : 0;
          drawPhotoIn(ctx, b, off - span, 0, W + span * 2, H, at);
        }
        ctx.globalAlpha = 1;
      }
      applyCoverGradient(ctx, style, 0, 0, W, H);
      scrim();
      const r = heading(W / 2, { centre: Math.round((style.cvY / 100) * H) }, W - 160, 3, "center", 1);
      subtitle(W / 2, r.bottom + 50, Math.round(W * 0.7), "center");
    } else if (layout === "strip") {
      // Option 10: big photo, a dark strip of three small photos, and a colour band with the words.
      fill("#777777");
      const b = await open(photo);
      if (b) drawPhotoIn(ctx, b, 0, 0, W, H, at);
      applyCoverGradient(ctx, style, 0, 0, W, H);
      const sx = Math.round(W * 0.1), sw = Math.round(W * 0.31);
      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(sx, 0, sw, H);
      const gap = 30, ph = Math.round((H - gap * 4) / 3);
      for (let i = 0; i < 3; i++) {
        const e = await open(extras[i] ?? photo);
        if (e) drawPhotoIn(ctx, e, sx + 22, gap + i * (ph + gap), sw - 44, ph, { x: 50, y: 50 });
      }
      const bx = sx + sw, by = Math.round(H * 0.68), bh = Math.round(H * 0.26);
      ctx.fillStyle = blockFill(ctx, style.cvBlock);
      ctx.fillRect(bx, by, W - bx, bh);
      const r = heading(bx + 50, { top: by + 44 }, W - bx - 100, 2, "left");
      subtitle(bx + 50, r.bottom + 14, W - bx - 100, "left");
    } else if (layout === "diagonal") {
      // Option 11: headline set on a slant across the photo.
      fill("#777777");
      const b = await open(photo);
      if (b) drawPhotoIn(ctx, b, 0, 0, W, H, at);
      applyCoverGradient(ctx, style, 0, 0, W, H);
      scrim();
      ctx.save();
      ctx.translate(Math.round(W * 0.4), Math.round((style.cvY / 100) * H));
      ctx.rotate((style.cvAngle * Math.PI) / 180);
      heading(0, { centre: 0 }, Math.round(W * 0.7), 2, "center", 1);
      ctx.restore();
      subtitle(80, Math.round(H * 0.56), Math.round(W * 0.5), "left");
    } else if (layout === "behind2") {
      // Option 12: like option 7, with the subtitle on the left.
      fill(style.cvBlock);
      const cut = photo ? await getCutout(photo) : null;
      const r = heading(W / 2, { centre: Math.round((style.cvY / 100) * H) }, W - 60, 2, "center");
      subtitle(52, r.bottom + 50, Math.round(W * 0.5), "left");
      if (cut) {
        drawPhotoIn(ctx, cut, 0, 0, W, H, at);
        applyCoverGradient(ctx, style, 0, 0, W, H);
        cut.close();
      } else {
        const whole = await open(photo);
        if (whole) { drawPhotoIn(ctx, whole, 0, 0, W, H, at); applyCoverGradient(ctx, style, 0, 0, W, H); }
      }
    } else if (layout === "polaroid") {
      // Option 13: your photo in a print in the middle, a second card behind with the subtitle, held by a clip.
      fill(style.cvBlock);
      const b = await open(photo);
      ctx.save();
      ctx.translate(Math.round(W * 0.55), Math.round(H * 0.56));
      ctx.rotate(-0.1);
      shadowOn();
      ctx.fillStyle = "#f3f1ed";
      ctx.fillRect(-W * 0.23, -H * 0.31, W * 0.46, H * 0.62);
      shadowOff();
      ctx.restore();
      if (sub) {
        ctx.save();
        ctx.translate(Math.round(W * 0.42), Math.round(H * 0.79));
        ctx.rotate(-0.1);
        setSub();
        drawLines(balancedWrap(ctx, sub, Math.round(W * 0.36)), subTextAt.dx, subTextAt.dy, subLineH, "left");
        ctx.restore();
      }
      const pw = Math.round(W * 0.51), phh = Math.round(H * 0.47), capH = Math.round(phh * 0.2);
      drawPolaroid(ctx, b, Math.round(W * 0.44), Math.round(H * 0.48), pw, phh, 0, "#f2f0ec", Math.round(W * 0.022), capH, () => {
        setSpacing(ctx, style.cvTracking);
        // One line in the print's caption strip, shrunk until the whole headline fits.
        let size = Math.min(Math.round(style.cvSize * headScale), Math.round(capH * 0.8));
        setSpacing(ctx, style.cvTracking);
        while (size > 24) {
          ctx.font = headFont(size);
          if (ctx.measureText(head).width <= pw * 0.86) break;
          size -= 4;
        }
        setHead(size);
        ctx.textAlign = "center";
        ctx.fillText(head, 0 + textAt.dx, phh / 2 - capH + Math.round((capH - size) / 2) + textAt.dy);
      });
      drawBinderClip(ctx, Math.round(W * 0.44), Math.round(H * 0.48 - phh / 2 - 60));
    } else if (layout === "sidebar") {
      // Option 14: full photo with a colour band down the side carrying the words.
      fill("#777777");
      const b = await open(photo);
      if (b) drawPhotoIn(ctx, b, 0, 0, W, H, at);
      applyCoverGradient(ctx, style, 0, 0, W, H);
      const bx = Math.round(W * 0.07), bw = Math.round(W * (style.cvPhoto / 100));
      ctx.fillStyle = blockFill(ctx, style.cvBlock);
      ctx.fillRect(bx, 0, bw, H);
      const r = heading(bx + 34, { top: Math.round((style.cvY / 100) * H) }, bw - 68, 3, "left");
      subtitle(bx + 50, r.bottom + 50, bw - 100, "left");
    } else if (layout === "frame") {
      // Option 15: photo behind, a white panel on top with two photos and two blocks of words on the diagonal.
      fill("#777777");
      const b = await open(photo);
      if (b) drawPhotoIn(ctx, b, 0, 0, W, H, at);
      applyCoverGradient(ctx, style, 0, 0, W, H);
      const px = Math.round(W * 0.1), py = Math.round(H * 0.1), pw = Math.round(W * 0.8), ph = Math.round(H * 0.8);
      ctx.fillStyle = blockFill(ctx, style.cvBlock);
      ctx.fillRect(px, py, pw, ph);
      const cw = Math.round(pw / 2), ch = Math.round(ph / 2), m = 18;
      const e0 = await open(extras[0] ?? photo), e1 = await open(extras[1] ?? photo);
      if (e0) drawPhotoIn(ctx, e0, px + m, py + m, cw - m, ch - m, { x: 50, y: 50 });
      if (e1) drawPhotoIn(ctx, e1, px + cw, py + ch, cw - m, ch - m, { x: 50, y: 50 });
      heading(px + cw + cw / 2, { centre: py + ch / 2 }, cw - 40, 2, "center", 1);
      if (sub) {
        setSub();
        const ls = balancedWrap(ctx, sub, cw - 60);
        drawLines(ls, px + cw / 2 + subTextAt.dx, Math.round(py + ch + ch / 2 - (ls.length * subLineH) / 2) + subTextAt.dy, subLineH, "center");
      }
    } else if (layout === "layered") {
      // Option 16: photo at the back, a second photo in a print at the front, words on a card below it.
      fill("#777777");
      const back = await open(photo);
      if (back) drawPhotoIn(ctx, back, 0, 0, W, H, at);
      applyCoverGradient(ctx, style, 0, 0, W, H);
      scrim();
      const front = await open(extras[0] ?? photo);
      const cardX = Math.round(W * 0.283), cardW = Math.round(W * 0.4), cardY = Math.round(H * 0.235), cardH = Math.round(H * 0.545);
      shadowOn();
      ctx.fillStyle = blockFill(ctx, style.cvBlock);
      ctx.fillRect(cardX, cardY, cardW, cardH);
      shadowOff();
      drawPolaroid(ctx, front, Math.round(W * 0.485), Math.round(H * 0.415), Math.round(W * 0.505), Math.round(H * 0.4), 0.03, "#f4f3f0", Math.round(W * 0.02), Math.round(H * 0.03));
      drawPaperclip(ctx, Math.round(W * 0.335), Math.round(H * 0.225));
      const r = heading(cardX + 26, { top: Math.round(H * 0.655) }, cardW - 52, 2, "left");
      subtitle(cardX + 26, r.bottom + 12, cardW - 52, "left");
    }
  } finally {
    for (const b of opened) b.close();
    setSpacing(ctx, 0);
  }
}

// The "October 26" covers. The slide 1 photo is a finished scene (made in AI Photo Studio) that is never
// re-cropped around a face; the words are placed on the part of the scene built to carry them.
type OctLook = {
  fit: "cover" | "extend";
  box: [number, number, number, number]; // x, y, width, height in slide pixels
  brand: boolean;                        // headline in the client's brand colour
  glow: boolean;                         // soft light halo so the words read over a busy picture
  align: CanvasTextAlign;
  maxLines: number;
  subAtBottom?: boolean;
  ink?: string;                          // fixed headline colour when the picture is light
  mono?: boolean;                        // turn the picture black and white
  skipPhoto?: boolean;                   // the cover places the photo itself
  recolour?: boolean;                    // the picture's one strong colour (made in teal) is swapped for the spot colour
};

// Draws a photo to fill a frame, with the zoom and drag position, clipped to that frame.
function punchFilter(punch: number | undefined, mono = false) {
  const p = Math.min(100, Math.max(0, punch ?? 75)) / 100;
  return mono ? `grayscale(1) contrast(${1 + 0.8 * p}) brightness(${1 - 0.04 * p})` : `contrast(${1 + 0.45 * p}) saturate(${1 + 0.7 * p}) brightness(${1 - 0.03 * p})`;
}
// Applies a CSS-style filter to a canvas after it has been drawn (so the backdrop is recoloured before contrast can crush it to black).
function filterCanvas(c: HTMLCanvasElement, filter: string): HTMLCanvasElement {
  if (!filter || filter === "none") return c;
  const o = document.createElement("canvas"); o.width = c.width; o.height = c.height;
  const g = o.getContext("2d"); if (!g) return c;
  (g as CanvasRenderingContext2D & { filter?: string }).filter = filter;
  g.drawImage(c, 0, 0);
  return o;
}
// Unsharp-style sharpen so photos look crisp rather than soft.
function sharpenCanvas(c: HTMLCanvasElement, amount = 0.8) {
  const w = c.width, h = c.height;
  if (w < 3 || h < 3) return;
  const g = c.getContext("2d"); if (!g) return;
  const src = g.getImageData(0, 0, w, h), d = src.data, o = new Uint8ClampedArray(d);
  const a = amount, cen = 1 + 4 * a;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) {
        o[i + k] = cen * d[i + k] - a * (d[i - 4 + k] + d[i + 4 + k] + d[i - w * 4 + k] + d[i + w * 4 + k]);
      }
    }
  }
  src.data.set(o); g.putImageData(src, 0, 0);
}
// Studio backdrops are often a dark blue. This swaps blue-ish pixels for the client's brand colour (lifted), so the cover looks like their brand.
let octBackdrop: string | null = null;
function tintBackdrop(c: HTMLCanvasElement, hex: string | null, mono = false) {
  const m = hex ? /^#?([0-9a-f]{6})$/i.exec(hex.trim()) : null;
  if (!m) return;
  const n = parseInt(m[1], 16);
  const r0 = ((n >> 16) & 255) / 255, g0 = ((n >> 8) & 255) / 255, b0 = (n & 255) / 255;
  const hsl = (r: number, g: number, b: number): [number, number, number] => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
    if (d === 0) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    return [h, s, l];
  };
  const [th, ts, tl] = hsl(r0, g0, b0);
  const rgb = (h: number, s: number, l: number): [number, number, number] => {
    const cc = (1 - Math.abs(2 * l - 1)) * s, x = cc * (1 - Math.abs(((h / 60) % 2) - 1)), mm = l - cc / 2;
    const [r, g, b] = h < 60 ? [cc, x, 0] : h < 120 ? [x, cc, 0] : h < 180 ? [0, cc, x] : h < 240 ? [0, x, cc] : h < 300 ? [x, 0, cc] : [cc, 0, x];
    return [(r + mm) * 255, (g + mm) * 255, (b + mm) * 255];
  };
  const g = c.getContext("2d"); if (!g) return;
  const cw = c.width, ch = c.height;
  const img = g.getImageData(0, 0, cw, ch), d = img.data;
  const ws = new Float32Array(cw * ch);
  for (let y = 0, j = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++, j++) {
      const i = j * 4;
      const [h, s, l] = hsl(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
      const hueOk = h >= 185 && h <= 265;
      const w = hueOk ? Math.min(1, Math.max(0, (s - 0.1) / 0.2)) * (h < 200 ? (h - 185) / 15 : h > 250 ? (265 - h) / 15 : 1) : 0;
      ws[j] = w * Math.min(1, Math.max(0, (l - 0.05) / 0.07));
    }
  }
  for (let y = 0, j = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++, j++) {
      const i = j * 4;
      const w = ws[j];
      const [, , l] = hsl(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
      if (w <= 0 && !mono) continue;
      const nl = Math.min(0.7, l * 1.1 + tl * 0.45);
      const [r, gg, b] = rgb(th, Math.max(0.35, Math.min(1, ts * 0.95)), nl);
      let br = d[i], bg = d[i + 1], bb = d[i + 2];
      if (mono) { const yv = 0.299 * br + 0.587 * bg + 0.114 * bb; const v = Math.max(0, Math.min(255, yv + (yv - 128) * 0.5)); br = bg = bb = v; }
      d[i] = br + (r - br) * w; d[i + 1] = bg + (gg - bg) * w; d[i + 2] = bb + (b - bb) * w;
    }
  }
  g.putImageData(img, 0, 0);
}
async function drawFileIn(ctx: CanvasRenderingContext2D, file: File, x: number, y: number, w: number, h: number, pos?: PhotoPos, filter = "none") {
  try {
    const b = await createImageBitmap(file);
    const z = Math.min(3, Math.max(1, pos?.z ?? 1));
    const sc = Math.max(w / b.width, h / b.height) * z;
    const dw = b.width * sc, dh = b.height * sc;
    const tw = Math.max(1, Math.round(w)), th = Math.max(1, Math.round(h));
    const t = document.createElement("canvas"); t.width = tw; t.height = th;
    const tg = t.getContext("2d");
    if (!tg) { b.close(); return false; }
    tg.drawImage(b, (w - dw) * ((pos?.x ?? 50) / 100), (h - dh) * ((pos?.y ?? 50) / 100), dw, dh);
    tintBackdrop(t, octBackdrop, filter.includes("grayscale") && !!octBackdrop);
    const tf = filterCanvas(t, filter);
    sharpenCanvas(tf, 0.7);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(tf, x, y, w, h);
    ctx.restore(); b.close();
    return true;
  } catch { return false; }
}

// Swap the strong teal in a picture for another colour. Neutral greys, blacks, whites and the red nails stay as they are.
const SPOT_SOURCE_HUE = 174;
function recolourSpot(ctx: CanvasRenderingContext2D, hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return;
  const n = parseInt(m[1], 16);
  const tr = ((n >> 16) & 255) / 255, tg = ((n >> 8) & 255) / 255, tb = (n & 255) / 255;
  const toHsl = (r: number, g: number, b: number): [number, number, number] => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
    if (d === 0) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
    return [h, s, l];
  };
  const [th, ts, tl] = toHsl(tr, tg, tb);
  const srcS = 0.556, srcL = 0.388;
  const sScale = ts / srcS, lShift = (tl - srcL) * 0.7;
  const fromHsl = (h: number, s: number, l: number): [number, number, number] => {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), mm = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(r + mm) * 255, (g + mm) * 255, (b + mm) * 255];
  };
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const [h, s, l] = toHsl(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255);
    if (s < 0.12) continue;
    let diff = Math.abs(h - SPOT_SOURCE_HUE); if (diff > 180) diff = 360 - diff;
    if (diff > 45) continue;
    const w = diff < 25 ? 1 : 1 - (diff - 25) / 20; // soft edge so shiny highlights blend
    const ns = Math.min(1, Math.max(0, s * sScale));
    const nl = Math.min(0.97, Math.max(0.03, l + lShift));
    const [r, g, b] = fromHsl(th, ns, nl);
    d[i] = d[i] + (r - d[i]) * w; d[i + 1] = d[i + 1] + (g - d[i + 1]) * w; d[i + 2] = d[i + 2] + (b - d[i + 2]) * w;
  }
  ctx.putImageData(img, 0, 0);
}
const OCT_LOOKS: Partial<Record<CoverLayout, OctLook>> = {
  oct1: { fit: "cover", box: [0, 0, 0, 0], brand: false, glow: false, align: "center", maxLines: 1 },
  oct8: { fit: "cover", box: [0, 0, 0, 0], brand: false, glow: false, align: "center", maxLines: 1, skipPhoto: true },
  oct9: { fit: "cover", box: [0, 0, 0, 0], brand: false, glow: false, align: "center", maxLines: 1, mono: true },
  oct11: { fit: "cover", box: [0, 0, 0, 0], brand: false, glow: false, align: "center", maxLines: 1, skipPhoto: true },
  oct17: { fit: "cover", box: [0, 0, 0, 0], brand: false, glow: false, align: "center", maxLines: 1, skipPhoto: true },
  oct2: { fit: "cover", box: [0, 0, 0, 0], brand: false, glow: false, align: "center", maxLines: 1 },
  oct5: { fit: "cover", box: [0, 0, 0, 0], brand: false, glow: false, align: "center", maxLines: 1 },
  oct10: { fit: "cover", box: [90, 1010, 900, 330], brand: false, glow: false, align: "center", maxLines: 3, mono: true },
  oct15: { fit: "cover", box: [0, 0, 0, 0], brand: false, glow: false, align: "center", maxLines: 1 },
  oct3: { fit: "cover", box: [130, 960, 820, 340], recolour: true, brand: true, glow: false, align: "center", maxLines: 3 },
  oct4: { fit: "cover", box: [290, 610, 500, 500], brand: true, glow: false, align: "center", maxLines: 4, subAtBottom: true },
  oct6: { fit: "cover", box: [90, 1000, 900, 340], brand: false, glow: true, align: "center", maxLines: 4, mono: true },
  oct13: { fit: "cover", box: [0, 0, 0, 0], brand: false, glow: false, align: "center", maxLines: 1 },
  oct18: { fit: "cover", box: [30, 380, 1020, 620], brand: false, glow: true, align: "center", maxLines: 2 },
  oct7: { fit: "cover", box: [90, 1120, 900, 240], recolour: true, brand: false, glow: true, align: "center", maxLines: 2 },
  oct12: { fit: "cover", box: [270, 280, 560, 330], brand: false, glow: true, align: "center", maxLines: 3 },
  oct14: { fit: "extend", box: [50, 330, 560, 560], recolour: true, brand: false, glow: true, ink: "#111111", align: "left", maxLines: 4 },
  oct16: { fit: "extend", box: [285, 415, 360, 250], recolour: true, brand: false, glow: false, align: "center", maxLines: 3 },
};

async function drawCoverOct(
  ctx: CanvasRenderingContext2D, spec: SlideSpec, photo: File | null, style: Style, layout: CoverLayout,
  preset: ClientPreset | null, textAt: TextPos, subTextAt: TextPos, headScale: number, subScale: number, pos?: PhotoPos, second?: File | null,
) {
  const look = OCT_LOOKS[layout];
  if (!look) return;
  { const bc = (style.cvSpot || preset?.accentColor || "").trim(); octBackdrop = /^#?[0-9a-f]{6}$/i.test(bc) ? bc : "#2c9a8f"; }
  const [hf, sf] = faces(style, layout);
  ctx.fillStyle = "#d9d9d9";
  ctx.fillRect(0, 0, W, H);
  let bmp: ImageBitmap | null = null;
  try { bmp = photo ? await createImageBitmap(photo) : null; } catch { bmp = null; }
  if (bmp && photo) octDims.set(photo, { w: bmp.width, h: bmp.height });
  if (bmp && look.skipPhoto) { bmp.close(); bmp = null; }
  if (bmp) {
    if (look.fit === "cover") {
      const z = Math.min(3, Math.max(1, pos?.z ?? 1));
      const sc = Math.max(W / bmp.width, H / bmp.height) * z;
      const dw = bmp.width * sc, dh = bmp.height * sc;
      const tc = document.createElement("canvas"); tc.width = W; tc.height = H;
      const tg = tc.getContext("2d");
      if (tg) {
        tg.drawImage(bmp, (W - dw) * ((pos?.x ?? 50) / 100), (H - dh) * ((pos?.y ?? 50) / 100), dw, dh);
        tintBackdrop(tc, octBackdrop, !!look.mono);
        const tf = filterCanvas(tc, punchFilter(style.cvPunch, false));
        sharpenCanvas(tf, 0.7);
        ctx.drawImage(tf, 0, 0);
      }
    } else {
      // A square scene on a tall slide: the picture keeps its full width, and its top and bottom edges are smeared outwards.
      const sc = W / bmp.width;
      const dh = bmp.height * sc;
      const y0 = Math.round((H - dh) / 2);
      const slice = Math.max(2, Math.round(bmp.height * 0.01));
      // Flat colour above and below the picture (the most common shade along that edge), no gradient or blur.
      const edge = (sy: number) => {
        const c = document.createElement("canvas"); c.width = 32; c.height = 1;
        const g = c.getContext("2d");
        if (!g) return "#d9d9d9";
        g.drawImage(bmp!, 0, sy, bmp!.width, slice, 0, 0, 32, 1);
        const d = g.getImageData(0, 0, 32, 1).data;
        const med = (o: number) => { const v: number[] = []; for (let i = 0; i < 32; i++) v.push(d[i * 4 + o]); v.sort((x, y) => x - y); return v[16]; };
        return `rgb(${med(0)},${med(1)},${med(2)})`;
      };
      ctx.fillStyle = edge(0); ctx.fillRect(0, 0, W, y0 + 1);
      ctx.fillStyle = edge(bmp.height - slice); ctx.fillRect(0, y0 + dh - 1, W, H - (y0 + dh) + 1);
      const z = Math.min(3, Math.max(1, pos?.z ?? 1));
      const dw = W * z, dh2 = dh * z;
      const py = dh2 >= H ? (H - dh2) * ((pos?.y ?? 50) / 100) : y0 + (dh - dh2) / 2;
      (ctx as CanvasRenderingContext2D & { filter?: string }).filter = punchFilter(style.cvPunch);
      ctx.drawImage(bmp, (W - dw) * ((pos?.x ?? 50) / 100), py, dw, dh2);
      (ctx as CanvasRenderingContext2D & { filter?: string }).filter = "none";
    }
    bmp.close();
    if (look.recolour) {
      const spot = (style.cvSpot || preset?.accentColor || "").trim();
      if (/^#?[0-9a-f]{6}$/i.test(spot) && !/^#?2c9a8f$/i.test(spot)) recolourSpot(ctx, spot);
    }
  }

  if (layout === "oct13") {
    // Magazine cover: MASTHEAD | SECOND HEADLINE in the headline, the small line in the subtitle.
    const parts = spec.text.split("|").map(x => x.trim());
    const mast = (style.cvCaps ? parts[0].toUpperCase() : parts[0]) || "";
    const second = parts[1] ?? "";
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 24;
    ctx.fillStyle = style.cvColour; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    setSpacing(ctx, style.cvTracking);
    let msz = Math.round(style.cvSize * headScale);
    ctx.font = `${style.cvWeight} ${msz}px ${hf}`;
    while (msz > 24 && ctx.measureText(mast).width > 940) { msz -= 6; ctx.font = `${style.cvWeight} ${msz}px ${hf}`; }
    const my = 70 + Math.round(msz * 0.85) + textAt.dy;
    ctx.fillText(mast, W / 2 + textAt.dx, my);
    setSpacing(ctx, 12);
    ctx.font = `400 34px ${sf}`;
    ctx.fillText("OCTOBER 2026", W / 2 + textAt.dx, my + 58);
    if (second) {
      setSpacing(ctx, 0);
      ctx.textAlign = "left";
      let ssz = Math.round(style.cvSize * 0.7 * headScale);
      ctx.font = `italic ${style.cvWeight} ${ssz}px ${hf}`;
      const sx = 70 + subTextAt.dx;
      while (ssz > 50 && ctx.measureText(second).width > 800) { ssz -= 6; ctx.font = `italic ${style.cvWeight} ${ssz}px ${hf}`; }
      ctx.fillText(second, sx, 1010 + subTextAt.dy);
      if (spec.sub) {
        setSpacing(ctx, style.cvSubTracking);
        ctx.font = `${style.cvSubWeight} ${Math.round(style.cvSubSize * subScale)}px ${sf}`;
        ctx.fillStyle = style.cvSubColour;
        ctx.fillText(style.cvSubCaps ? spec.sub.toUpperCase() : spec.sub, sx, 1010 + 70 + subTextAt.dy);
      }
    } else if (spec.sub) {
      setSpacing(ctx, style.cvSubTracking);
      ctx.font = `${style.cvSubWeight} ${Math.round(style.cvSubSize * subScale)}px ${sf}`;
      ctx.fillStyle = style.cvSubColour; ctx.textAlign = "left";
      ctx.fillText(style.cvSubCaps ? spec.sub.toUpperCase() : spec.sub, 70 + subTextAt.dx, 1090 + subTextAt.dy);
    }
    ctx.restore();
    setSpacing(ctx, 0);
    return;
  }


  // ---- covers drawn in the tool itself: escalator, three newspapers, blinds and books ----
  const mixHex = (hex: string, to: string, t: number) => {
    const a = /^#?([0-9a-f]{6})$/i.exec(hex.trim())?.[1] ?? "2c9a8f", b = /^#?([0-9a-f]{6})$/i.exec(to.trim())?.[1] ?? "ffffff";
    const c = (i: number) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t);
    return `rgb(${c(0)},${c(2)},${c(4)})`;
  };
  const brandHex = /^#?[0-9a-f]{6}$/i.test((style.cvSpot || preset?.accentColor || "").trim()) ? (style.cvSpot || preset?.accentColor || "").trim() : "#2c9a8f";
  const pickedInk = !/^#?f{6}$/i.test((style.cvColour || "").trim());
  const capsT = (t: string) => (style.cvCaps ? t.toUpperCase() : t);

  if (layout === "oct15") {
    // A stack of books in shades of the brand colour. Each spine carries one headline.
    ctx.fillStyle = mixHex(brandHex, "#ffffff", 0.9); ctx.fillRect(0, 0, W, H);
    const titles = spec.text.split("|").map(x => x.trim()).filter(Boolean).slice(0, 7);
    const count = 7;
    const bh = 158, gap = 6;
    const total = count * bh + (count - 1) * gap;
    let y = Math.round((H - total) / 2) + 20 + textAt.dy;
    const shades = [0.55, 0.25, 0, -0.2, 0.4, -0.35, 0.15];
    for (let i = 0; i < count; i++) {
      const w = [780, 720, 820, 700, 760, 830, 690][i];
      const off = [0, 30, -20, 40, -30, 10, 20][i];
      const x = Math.round((W - w) / 2) + off + textAt.dx;
      const t = shades[i];
      const base = t >= 0 ? mixHex(brandHex, "#ffffff", t) : mixHex(brandHex, "#000000", -t);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.22)"; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.roundRect(x, y, w, bh, 10); ctx.fill();
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.18)"; ctx.fillRect(x, y, w, 8);
      ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.fillRect(x, y + bh - 8, w, 8);
      ctx.fillStyle = "rgba(0,0,0,0.14)"; ctx.fillRect(x + 34, y, 6, bh); ctx.fillRect(x + w - 40, y, 6, bh);
      const title = titles[i];
      if (title) {
        const light = t > 0.3;
        ctx.fillStyle = pickedInk ? style.cvColour : (light ? "#1a1a1a" : "#ffffff");
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        setSpacing(ctx, style.cvTracking);
        let sz = Math.round(style.cvSize * headScale);
        const txt = capsT(title);
        ctx.font = `${style.cvWeight} ${sz}px ${hf}`;
        while (sz > 20 && ctx.measureText(txt).width > w - 150) { sz -= 4; ctx.font = `${style.cvWeight} ${sz}px ${hf}`; }
        ctx.fillText(txt, x + w / 2, y + bh / 2 + 2);
      }
      y += bh + gap;
    }
    setSpacing(ctx, 0);
    return;
  }

  if (layout === "oct5") {
    // Three newspapers laid over the winter photo. Headlines 1, 2, 3 and subtitles 1, 2.
    ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fillRect(0, 0, W, H);
    const heads = spec.text.split("|").map(x => x.trim());
    const subs = (spec.sub || "").split("|").map(x => x.trim());
    const rot = [-0.05, 0.035, -0.02];
    const ys = [90, 520, 950];
    for (let i = 0; i < 3; i++) {
      const pw = 880, ph = 390;
      ctx.save();
      ctx.translate(W / 2 + (i === 1 ? 20 : i === 0 ? -15 : 5) + textAt.dx, ys[i] + ph / 2 + textAt.dy);
      ctx.rotate(rot[i]);
      ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
      ctx.fillStyle = "#f5f0e4"; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
      ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.fillStyle = brandHex; ctx.fillRect(-pw / 2 + 30, -ph / 2 + 28, pw - 60, 6);
      const subT = subs[i] ?? "";
      if (subT) {
        ctx.fillStyle = "#3a3a3a"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
        setSpacing(ctx, style.cvSubTracking);
        ctx.font = `${style.cvSubWeight} ${Math.round(style.cvSubSize * subScale)}px ${sf}`;
        ctx.fillText(style.cvSubCaps ? subT.toUpperCase() : subT, -pw / 2 + 30, -ph / 2 + 76);
      }
      const h = heads[i] ?? "";
      if (h) {
        ctx.fillStyle = pickedInk ? style.cvColour : "#141414";
        ctx.textAlign = "center"; ctx.textBaseline = "top";
        setSpacing(ctx, style.cvTracking);
        const face = (sz: number) => `${style.cvWeight} ${sz}px ${hf}`;
        const t = capsT(h);
        let fit = fitHeading(ctx, t, face, pw - 90, style.cvSize * headScale, 3);
        for (let sz = style.cvSize * headScale; sz >= 26; sz -= 4) { fit = fitHeading(ctx, t, face, pw - 90, sz, 3); if (fit.lines.length * fit.size * 1.05 <= ph - 150) break; }
        ctx.font = face(fit.size);
        let ty = -ph / 2 + 100;
        for (const l of fit.lines) { ctx.fillText(l, 0, ty); ty += fit.size * 1.05; }
      }
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      for (let k = 0; k < 3; k++) ctx.fillRect(-pw / 2 + 30, ph / 2 - 60 + k * 16, pw - 60 - k * 90, 5);
      ctx.restore();
    }
    setSpacing(ctx, 0);
    return;
  }

  if (layout === "oct2") {
    // Escalator advert: a colour strip down the right with the headline running up it, two photo frames beside it.
    ctx.fillStyle = brandHex; ctx.fillRect(0, 0, W, H);
    const stripX = 800, fw = 740, fh = 650, fx = 30;
    const frames: [number, File | null][] = [[40, photo], [750, second || photo]];
    for (let i = 0; i < 2; i++) {
      const [fy, f] = frames[i];
      ctx.fillStyle = "#ffffff"; ctx.fillRect(fx - 10, fy - 10, fw + 20, fh + 20);
      ctx.fillStyle = "#cfcfcf"; ctx.fillRect(fx, fy, fw, fh);
      if (f) {
        try {
          const b = await createImageBitmap(f);
          const z = Math.min(3, Math.max(1, pos?.z ?? 1)) * (i === 1 && !second ? 1.6 : 1);
          const sc = Math.max(fw / b.width, fh / b.height) * z;
          const dw = b.width * sc, dh = b.height * sc;
          const px = (pos?.x ?? 50) / 100, py = i === 1 && !second ? 0.85 : (pos?.y ?? 50) / 100;
          ctx.save(); ctx.beginPath(); ctx.rect(fx, fy, fw, fh); ctx.clip();
          (ctx as CanvasRenderingContext2D & { filter?: string }).filter = punchFilter(style.cvPunch);
          ctx.drawImage(b, fx + (fw - dw) * px, fy + (fh - dh) * py, dw, dh);
          ctx.restore(); b.close();
        } catch { /* leave the grey frame */ }
      }
    }
    ctx.save();
    ctx.translate(stripX + (W - stripX) / 2 + textAt.dx, H / 2 + textAt.dy); ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = pickedInk ? style.cvColour : "#ffffff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    setSpacing(ctx, style.cvTracking);
    const t2 = capsT(spec.text.replace(/\s*\|\s*/g, "  "));
    let sz2 = Math.round(style.cvSize * headScale);
    ctx.font = `${style.cvWeight} ${sz2}px ${hf}`;
    while (sz2 > 30 && ctx.measureText(t2).width > 1300) { sz2 -= 4; ctx.font = `${style.cvWeight} ${sz2}px ${hf}`; }
    ctx.fillText(t2, 0, 0);
    ctx.restore();
    setSpacing(ctx, 0);
    return;
  }

  if (layout === "oct10") {
    // Venetian blinds in the clinic colour with a gap to peep through. The headline is drawn by the shared text code below.
    const slat = 46, bar = 32;
    for (let y0 = -10; y0 < H; y0 += slat) {
      if (y0 > 380 && y0 < 700) {
        ctx.fillStyle = brandHex; ctx.globalAlpha = 0.9;
        ctx.fillRect(0, y0, W, 6);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = brandHex; ctx.fillRect(0, y0, W, bar);
        ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(0, y0, W, 5);
        ctx.fillStyle = "rgba(0,0,0,0.28)"; ctx.fillRect(0, y0 + bar - 5, W, 5);
      }
    }
  }


  // ---- covers drawn from the client's own photo: newspaper over the face, retro badge, yellow jumper, street poster, better late than ugly ----
  const fitDraw = (txt: string, cx: number, top: number, maxW: number, maxH: number, startSize: number, maxLines: number, align: CanvasTextAlign, colour: string, italic = false, lead = 1.04) => {
    const face = (sz: number) => `${italic ? "italic " : ""}${style.cvWeight} ${sz}px ${hf}`;
    setSpacing(ctx, style.cvTracking);
    let fit = fitHeading(ctx, txt, face, maxW, startSize, maxLines);
    for (let sz = startSize; sz >= 24; sz -= 4) { fit = fitHeading(ctx, txt, face, maxW, sz, maxLines); if (fit.lines.length * fit.size * lead <= maxH) break; }
    ctx.font = face(fit.size); ctx.fillStyle = colour; ctx.textAlign = align; ctx.textBaseline = "top";
    let yy = top;
    for (const l of fit.lines) { ctx.fillText(l, cx, yy); yy += fit.size * lead; }
    return yy;
  };
  const smallDraw = (txt: string, cx: number, y: number, size: number, colour: string, align: CanvasTextAlign = "center") => {
    ctx.font = `${style.cvSubWeight} ${size}px ${sf}`; setSpacing(ctx, style.cvSubTracking);
    ctx.fillStyle = colour; ctx.textAlign = align; ctx.textBaseline = "alphabetic";
    ctx.fillText(style.cvSubCaps ? txt.toUpperCase() : txt, cx, y);
  };
  const tintBand = (y0: number, y1: number, x0: number, x1: number, colour: string) => {
    // Gives a band of the picture (shoes, dress) the clinic colour while keeping its light and shade.
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    ctx.globalCompositeOperation = "color";
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(0.35, colour); g.addColorStop(1, colour);
    ctx.fillStyle = g; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  };
  const inkOr = (d: string) => (pickedInk ? style.cvColour : d);

  if (layout === "oct1") {
    // A newspaper held up so only the top half of the face peeps over it.
    const sub = (spec.sub || "").trim() || "Aesthetics news";
    let paperTop = 760;
    try { const cv = ctx.canvas; const f = await findFace(cv); if (f) paperTop = Math.round(f.y / (cv.width / W) + 12); } catch { /* keep the usual height */ }
    paperTop = Math.min(680, Math.max(430, paperTop));
    ctx.save();
    ctx.translate(W / 2 + textAt.dx, paperTop + textAt.dy); ctx.rotate(-0.025);
    const pw = 960, top = 0, ph = H - paperTop + 120;
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 30; ctx.shadowOffsetY = -6;
    ctx.fillStyle = mixHex(brandHex, "#ffffff", 0.12); ctx.fillRect(-pw / 2, top, pw, ph);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(-pw / 2 + 40, top + 34, pw - 80, 3);
    smallDraw(sub, subTextAt.dx, top + 72 + subTextAt.dy, Math.max(18, Math.round(style.cvSubSize * 0.7 * subScale)), "rgba(0,0,0,0.75)");
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(-pw / 2 + 40, top + 92, pw - 80, 3);
    fitDraw(capsT(spec.text), 0, top + 120, pw - 120, 360, Math.round(style.cvSize * headScale), 4, "center", inkOr("#161616"));
    // small pictures cut from the same photo, and tiny lines of text
    if (photo) {
      try {
        const b = await createImageBitmap(photo);
        const crops: [number, number][] = [[0.5, 0.3], [0.5, 0.55], [0.5, 0.8]];
        for (let i = 0; i < 3; i++) {
          const cw = 270, chh = 190, cx0 = -pw / 2 + 60 + i * (cw + 30), cy0 = Math.max(top + 470, H - paperTop - 330);
          const sc = Math.max(cw / b.width, chh / b.height) * 1.6;
          const dw = b.width * sc, dh = b.height * sc;
          ctx.save(); ctx.beginPath(); ctx.rect(cx0, cy0, cw, chh); ctx.clip();
          ctx.filter = "grayscale(1) contrast(1.1)";
          ctx.drawImage(b, cx0 + (cw - dw) * crops[i][0], cy0 + (chh - dh) * crops[i][1], dw, dh);
          ctx.restore();
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          for (let k = 0; k < 3; k++) ctx.fillRect(cx0, cy0 + chh + 14 + k * 14, cw - k * 50, 4);
        }
        ctx.filter = "none"; b.close();
      } catch { /* pictures are optional */ }
    }
    ctx.restore();
    setSpacing(ctx, 0);
    return;
  }

  if (layout === "oct8") {
    // Retro badge: the photo turned into a flat, posterised illustration in the clinic colour.
    ctx.fillStyle = "#f4ecdc"; ctx.fillRect(0, 0, W, H);
    const R = 360, cx = W / 2 + textAt.dx, cy = 790 + textAt.dy;
    const off = document.createElement("canvas"); off.width = R * 2; off.height = R * 2;
    const og = off.getContext("2d");
    if (og && photo) {
      try {
        const b = await createImageBitmap(photo);
        let fcx = b.width / 2, fcy = b.height * 0.25;
        try {
          const t = document.createElement("canvas"); const ts = Math.min(1, 640 / Math.max(b.width, b.height));
          t.width = Math.round(b.width * ts); t.height = Math.round(b.height * ts); t.getContext("2d")!.drawImage(b, 0, 0, t.width, t.height);
          const f = await findFace(t); if (f) { fcx = f.x / ts; fcy = f.y / ts; }
        } catch { /* use the top middle */ }
        const z = Math.min(3, Math.max(1, pos?.z ?? 1));
        const side = Math.min(b.width, b.height) * 0.6 / z;
        let sx = fcx - side / 2 + (((pos?.x ?? 50) - 50) / 100) * side, sy = fcy - side * 0.42 + (((pos?.y ?? 50) - 50) / 100) * side;
        sx = Math.max(0, Math.min(b.width - side, sx)); sy = Math.max(0, Math.min(b.height - side, sy));
        (og as CanvasRenderingContext2D & { filter?: string }).filter = "blur(5px) contrast(1.2)";
        og.drawImage(b, sx, sy, side, side, 0, 0, R * 2, R * 2); b.close();
        (og as CanvasRenderingContext2D & { filter?: string }).filter = "none";
        tintBackdrop(off, octBackdrop);
      } catch { /* leave the circle plain */ }
      const id = og.getImageData(0, 0, R * 2, R * 2); const d = id.data;
      const lum = new Float32Array(d.length / 4); const hist = new Uint32Array(256);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) { lum[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; hist[Math.min(255, Math.round(lum[j]))]++; }
      const cut = (q: number) => { let acc = 0; const tot = lum.length * q; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= tot) return v; } return 255; };
      const t1 = cut(0.28), t2 = cut(0.55), t3 = cut(0.82);
      const pal = [mixHex(brandHex, "#000000", 0.72), brandHex, mixHex(brandHex, "#ffffff", 0.55), "rgb(244,236,220)"].map(c => (c.match(/\d+/g) || ["0", "0", "0"]).map(Number));
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        const l = lum[j]; const k = l < t1 ? 0 : l < t2 ? 1 : l < t3 ? 2 : 3;
        d[i] = pal[k][0]; d[i + 1] = pal[k][1]; d[i + 2] = pal[k][2]; d[i + 3] = 255;
      }
      og.putImageData(id, 0, 0);
    }
    ctx.fillStyle = mixHex(brandHex, "#000000", 0.15);
    ctx.beginPath(); ctx.arc(cx, cy, R + 38, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f4ecdc"; ctx.beginPath(); ctx.arc(cx, cy, R + 20, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = mixHex(brandHex, "#ffffff", 0.5); ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.drawImage(off, cx - R, cy - R);
    ctx.restore();
    ctx.strokeStyle = mixHex(brandHex, "#000000", 0.6); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    // ribbon
    ctx.fillStyle = mixHex(brandHex, "#000000", 0.15); ctx.fillRect(cx - 250, cy + R - 40, 500, 86);
    smallDraw("TODAY", cx, cy + R + 22, Math.round(style.cvSubSize * 1.6 * subScale), "#f4ecdc");
    fitDraw(capsT(spec.text), W / 2 + textAt.dx, 90 + textAt.dy, 900, 280, Math.round(style.cvSize * headScale), 2, "center", inkOr(mixHex(brandHex, "#000000", 0.5)));
    if (spec.sub) smallDraw(spec.sub, W / 2 + subTextAt.dx, 1340 + subTextAt.dy, Math.round(style.cvSubSize * 1.3 * subScale), mixHex(brandHex, "#000000", 0.5));
    setSpacing(ctx, 0);
    return;
  }

  if (layout === "oct9") {
    // Black and white photo, her dress and shoes in the clinic colour, and a big newspaper held in front.
    tintBand(930, H, 0, W, brandHex);
    ctx.save();
    ctx.translate(W / 2 + textAt.dx, 800 + textAt.dy); ctx.rotate(0.03);
    const pw = 820, ph = 400;
    ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 28; ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#f5f0e4"; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(-pw / 2 + 30, -ph / 2 + 26, pw - 60, 4);
    fitDraw(capsT(spec.text), 0, -ph / 2 + 56, pw - 70, ph - 140, Math.round(style.cvSize * 1.7 * headScale), 3, "center", inkOr("#141414"));
    if (spec.sub) smallDraw(spec.sub, subTextAt.dx, ph / 2 - 36 + subTextAt.dy, Math.round(style.cvSubSize * 0.9 * subScale), "#333333");
    ctx.restore();
    setSpacing(ctx, 0);
    return;
  }

  if (layout === "oct11") {
    // Street poster: headline 1 and 2 on the paper above, the photo below with the shoes in the spot colour.
    ctx.fillStyle = brandHex; ctx.fillRect(0, 0, W, H);
    const parts = spec.text.split("|").map(x => x.trim());
    const px = 60, py = 420, pw = W - 120, ph = 900;
    if (photo) await drawFileIn(ctx, photo, px, py, pw, ph, pos, punchFilter(style.cvPunch));
    tintBand(py + ph - 190, py + ph, px, px + pw, brandHex);
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 14; ctx.strokeRect(px, py, pw, ph);
    const endY = fitDraw(capsT(parts[0] || ""), W / 2 + textAt.dx, 60 + textAt.dy, 940, 200, Math.round(style.cvSize * headScale), 2, "center", inkOr("#ffffff"));
    if (parts[1]) fitDraw(parts[1], W / 2 + textAt.dx, Math.max(endY, 250) + 6 + textAt.dy, 940, 110, Math.round(style.cvSize * 0.5 * headScale), 1, "center", inkOr("#ffffff"), true);
    if (spec.sub) smallDraw(spec.sub, W / 2 + subTextAt.dx, 1390 + subTextAt.dy, Math.round(style.cvSubSize * subScale), "#ffffff");
    setSpacing(ctx, 0);
    return;
  }

  if (layout === "oct17") {
    // Panelled wall in the clinic colours, the clinician in an arch holding a newspaper, with towel and sunglasses as options.
    const strip = 60;
    for (let x0 = 0, i = 0; x0 < W; x0 += strip, i++) {
      ctx.fillStyle = mixHex(brandHex, i % 2 ? "#ffffff" : "#000000", i % 2 ? 0.25 : 0.12); ctx.fillRect(x0, 0, strip, H);
      ctx.fillStyle = "rgba(0,0,0,0.22)"; ctx.fillRect(x0, 0, 4, H);
    }
    const ax = 150, ay = 90, aw = 780, ah = 1000;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(ax, ay + ah); ctx.lineTo(ax, ay + aw / 2); ctx.arc(ax + aw / 2, ay + aw / 2, aw / 2, Math.PI, 0); ctx.lineTo(ax + aw, ay + ah); ctx.closePath();
    ctx.shadowColor = "rgba(0,0,0,0.4)"; ctx.shadowBlur = 30; ctx.fillStyle = "#e9e1d2"; ctx.fill();
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
    ctx.clip();
    const fr = document.createElement("canvas"); fr.width = aw; fr.height = ah;
    const fg = fr.getContext("2d");
    if (fg && photo) { await drawFileIn(fg, photo, 0, 0, aw, ah, pos, punchFilter(style.cvPunch)); ctx.drawImage(fr, ax, ay); }
    ctx.restore();
    // towel and sunglasses, placed from the face if one is found
    if (style.cvTowel || style.cvShades) {
      let fx = aw / 2, fy = ah * 0.3;
      try { if (fg && photo) { const f = await findFace(fr); if (f) { fx = f.x; fy = f.y; } } } catch { /* use the default spot */ }
      const hx = ax + fx, hy = ay + fy, hw = aw * 0.34;
      if (style.cvTowel) {
        ctx.fillStyle = "#fbfaf7"; ctx.beginPath(); ctx.ellipse(hx, hy - hw * 0.78, hw * 0.78, hw * 0.46, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = brandHex; ctx.fillRect(hx - hw * 0.7, hy - hw * 0.8, hw * 1.4, 10);
        ctx.fillRect(hx - hw * 0.62, hy - hw * 0.62, hw * 1.24, 10);
      }
      if (style.cvShades) {
        ctx.fillStyle = "#111"; const sy = hy - hw * 0.1, sw = hw * 0.62, sh = hw * 0.4;
        ctx.beginPath(); ctx.roundRect(hx - hw * 0.08 - sw, sy, sw, sh, 14); ctx.fill();
        ctx.beginPath(); ctx.roundRect(hx + hw * 0.08, sy, sw, sh, 14); ctx.fill();
        ctx.fillRect(hx - hw * 0.1, sy + 8, hw * 0.2, 8);
        ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.fillRect(hx - hw * 0.08 - sw + 14, sy + 8, sw * 0.4, 6);
      }
    }
    // newspaper held at the bottom, headline 1 and text 1
    ctx.save();
    ctx.translate(W / 2 + textAt.dx, 1100 + textAt.dy); ctx.rotate(-0.02);
    const pw = 760, ph = 420;
    ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
    ctx.fillStyle = "#f5f0e4"; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(-pw / 2 + 30, -ph / 2 + 24, pw - 60, 4);
    const endY = fitDraw(capsT(spec.text), 0, -ph / 2 + 46, pw - 80, 190, Math.round(style.cvSize * headScale), 2, "center", inkOr("#141414"));
    if (spec.sub) {
      ctx.fillStyle = "#333333"; ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.font = `${style.cvSubWeight} ${Math.round(style.cvSubSize * 0.85 * subScale)}px ${sf}`; setSpacing(ctx, style.cvSubTracking);
      const words = spec.sub.split(/\s+/); let line = ""; let yy = endY + 14 + subTextAt.dy; const lh = Math.round(style.cvSubSize * 1.2 * subScale);
      for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > pw - 100 && line) { ctx.fillText(line, subTextAt.dx, yy); yy += lh; line = w; } else line = t; }
      if (line && yy < ph / 2 + 200) ctx.fillText(line, subTextAt.dx, yy);
    }
    ctx.restore();
    setSpacing(ctx, 0);
    return;
  }

  const brand = (preset?.accentColor || "").trim();
  // White is the untouched default, so the cover supplies its own colour; any colour she picks always wins.
  const picked = !/^#?f{6}$/i.test((style.cvColour || "").trim());
  const headColour = picked ? style.cvColour : (look.ink ?? (look.brand && /^#[0-9a-f]{6}$/i.test(brand) ? brand : style.cvColour));
  const text = style.cvCaps ? spec.text.toUpperCase() : spec.text;
  if (text) {
    const [bx, by, bw, bh] = look.box;
    const face = (sz: number) => `${style.cvWeight} ${sz}px ${hf}`;
    setSpacing(ctx, style.cvTracking);
    let fit = fitHeading(ctx, text, face, bw, style.cvSize * headScale, look.maxLines);
    for (let sz = style.cvSize * headScale; sz >= 30; sz -= 6) {
      fit = fitHeading(ctx, text, face, bw, sz, look.maxLines);
      if (fit.lines.length * fit.size * (style.cvLeading ?? 1.02) <= bh) break;
    }
    const lh = Math.round(fit.size * (style.cvLeading ?? 1.02));
    ctx.textBaseline = "top";
    ctx.textAlign = look.align;
    ctx.font = face(fit.size);
    ctx.fillStyle = headColour;
    if (look.glow) { ctx.shadowColor = "rgba(255,255,255,0.85)"; ctx.shadowBlur = 18; }
    const x = look.align === "left" ? bx : look.align === "right" ? bx + bw : bx + bw / 2;
    let y = by + Math.round((bh - fit.lines.length * lh) / 2);
    const curve = style.cvCurve ?? 0;
    const altChoice = style.cvAlts && Object.values(style.cvAlts).some(v => v > 0) ? style.cvAlts : null;
    const ot = altChoice ? loadOtFont(hf) : null;
    let cursor = 0;
    for (const l of fit.lines) {
      const at = text.indexOf(l, cursor);
      const lineStart = at >= 0 ? at : cursor;
      cursor = lineStart + l.length;
      if (ot && altChoice) {
        const lineX = look.align === "left" ? x + ctx.measureText(l).width / 2 : look.align === "right" ? x - ctx.measureText(l).width / 2 : x;
        drawGlyphLine(ctx, ot, l, lineStart, altChoice, lineX + textAt.dx, y + fit.size * 0.8 + textAt.dy, fit.size, style.cvTracking, Math.abs(curve) >= 2 ? curve : 0, headColour);
      } else if (Math.abs(curve) >= 2) {
        ctx.textBaseline = "alphabetic";
        const lineX = look.align === "left" ? x + ctx.measureText(l).width / 2 : look.align === "right" ? x - ctx.measureText(l).width / 2 : x;
        drawCurvedLine(ctx, l, lineX + textAt.dx, y + fit.size * 0.8 + textAt.dy, curve, style.cvTracking);
        ctx.textBaseline = "top";
        setSpacing(ctx, style.cvTracking);
      } else {
        ctx.fillText(l, x + textAt.dx, y + textAt.dy);
      }
      y += lh;
    }
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
  }
  if (look.subAtBottom && spec.sub) {
    const sub = style.cvSubCaps ? spec.sub.toUpperCase() : spec.sub;
    const size = Math.round(style.cvSubSize * subScale);
    ctx.font = `${style.cvSubWeight} ${size}px ${sf}`;
    setSpacing(ctx, style.cvSubTracking);
    ctx.fillStyle = style.cvSubColour;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = 14;
    ctx.fillText(sub, W / 2 + subTextAt.dx, H - 90 + subTextAt.dy);
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0;
  }
}

async function drawCover(
  ctx: CanvasRenderingContext2D, spec: SlideSpec, photo: File | null, style: Style,
  logo: HTMLImageElement | null, preset: ClientPreset | null, pos?: PhotoPos, extras: (File | null)[] = [],
  textAt: TextPos = ZERO_TEXT_POS, subTextAt: TextPos = ZERO_TEXT_POS, headScale = 1, subScale = 1,
) {
  const layout = style.coverLayout;
  const at = pos ?? defaultPos("cover", style);
  if (OCT_LAYOUTS.has(layout)) {
    await drawCoverOct(ctx, spec, photo, style, layout, preset, textAt, subTextAt, headScale, subScale, pos, extras[0] ?? null);
    if (logo && style.showLogo && preset) drawLogo(ctx, logo, "top-right", (preset.logoSize || 110) * (style.logoScale ?? 1.35));
    return;
  }
  if (MORE_LAYOUTS.has(layout)) {
    await drawCoverMore(ctx, spec, photo, extras, style, layout, at, textAt, subTextAt, headScale, subScale);
    if (logo && style.showLogo && preset) drawLogo(ctx, logo, "top-right", (preset.logoSize || 110) * (style.logoScale ?? 1.35));
    return;
  }
  const bmp = photo && layout !== "plain" && layout !== "behind" ? await (async () => {
    const blob = await prepareImage(photo);
    return blob ? createImageBitmap(blob) : null;
  })() : null;

  const heading = style.cvCaps ? spec.text.toUpperCase() : spec.text;
  const subtitle = spec.sub ? (style.cvSubCaps ? spec.sub.toUpperCase() : spec.sub) : "";
  const [headFace, subFace] = faces(style, layout);
  const headFont = (sz: number) => `${style.cvWeight} ${sz}px ${headFace}`;
  const cvSizeScaled = style.cvSize * headScale;
  const subSize = Math.round(style.cvSubSize * subScale);
  const subFont = `${style.cvSubWeight} ${subSize}px ${subFace}`;
  const lineH = (sz: number) => Math.round(sz * (layout === "centred" ? 1.05 : layout === "serif" ? 0.9 : 0.94));
  const subLineH = Math.round(subSize * (layout === "serif" ? 1.05 : 1.3));
  ctx.textBaseline = "top";

  const drawLines = (lines: string[], x: number, y: number, lh: number, align: CanvasTextAlign) => {
    ctx.textAlign = align;
    for (const l of lines) { ctx.fillText(l, x, y); y += lh; }
    return y;
  };
  const setHead = (sz: number) => { ctx.font = headFont(sz); setSpacing(ctx, style.cvTracking); ctx.fillStyle = metallicFill(ctx, style.cvColour); };
  const setSub = () => { ctx.font = subFont; setSpacing(ctx, style.cvSubTracking); ctx.fillStyle = metallicFill(ctx, style.cvSubColour); };

  if (layout === "band") {
    const photoH = Math.round(H * (style.cvPhoto / 100));
    const bandH = H - photoH;
    ctx.fillStyle = blockFill(ctx, style.cvBlock);
    ctx.fillRect(0, 0, W, H);
    if (bmp) drawPhotoIn(ctx, bmp, 0, 0, W, photoH, at);
    applyCoverGradient(ctx, style, 0, 0, W, photoH);
    const x = 96, maxW = W - x * 2;
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, heading, headFont, maxW, cvSizeScaled, 2);
    const lh = lineH(fit.size);
    setSub();
    const subLines = subtitle ? balancedWrap(ctx, subtitle, maxW) : [];
    const total = fit.lines.length * lh + (subLines.length ? 26 + subLines.length * subLineH : 0);
    let y = photoH + Math.round((bandH - total) / 2);
    setHead(fit.size);
    y = drawLines(fit.lines, x + textAt.dx, y + textAt.dy, lh, "left") - textAt.dy + 26;
    if (subLines.length) { setSub(); drawLines(subLines, x + subTextAt.dx, y + subTextAt.dy, subLineH, "left"); }
  } else if (layout === "block") {
    const photoH = Math.round(H * (style.cvPhoto / 100));
    ctx.fillStyle = blockFill(ctx, style.cvBlock);
    ctx.fillRect(0, 0, W, H);
    if (bmp) drawPhotoIn(ctx, bmp, 0, 0, W, photoH, at);
    applyCoverGradient(ctx, style, 0, 0, W, photoH);
    const x = 50, maxW = W - x * 2;
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, heading, headFont, maxW, cvSizeScaled, 2);
    const lh = lineH(fit.size);
    const blockH = H - photoH;
    const top = photoH + Math.round(blockH * 0.42 - (fit.lines.length * lh) / 2);
    setHead(fit.size);
    drawLines(fit.lines, x + textAt.dx, top + textAt.dy, lh, "left");
    if (subtitle) {
      setSub();
      const subLines = balancedWrap(ctx, subtitle, maxW);
      drawLines(subLines, x + 12 + subTextAt.dx, H - 130 - subLines.length * subLineH + subTextAt.dy, subLineH, "left");
    }
  } else if (layout === "split") {
    const photoW = Math.round(W * (style.cvPhoto / 100));
    ctx.fillStyle = blockFill(ctx, style.cvBlock);
    ctx.fillRect(0, 0, W, H);
    if (bmp) drawPhotoIn(ctx, bmp, 0, 0, photoW, H, at);
    applyCoverGradient(ctx, style, 0, 0, photoW, H);
    if (style.cvBandOn) {
      ctx.fillStyle = style.cvBand;
      ctx.fillRect(photoW, H - 133, W - photoW, 133);
    }
    const x0 = photoW + 50, x1 = W - 60, maxW = x1 - x0;
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, heading, headFont, maxW, cvSizeScaled, 4);
    const lh = lineH(fit.size);
    const top = Math.round(H * 0.255 - (fit.lines.length * lh) / 2);
    setHead(fit.size);
    const bottom = drawLines(fit.lines, x0 + textAt.dx, top + textAt.dy, lh, "left") - textAt.dy;
    if (subtitle) {
      setSub();
      const subLines = balancedWrap(ctx, subtitle, maxW);
      drawLines(subLines, x1 + subTextAt.dx, bottom + 110 + subTextAt.dy, subLineH, "right");
    }
  } else if (layout === "plain") {
    // Option 6: no photo. A flat colour with the headline and subheading centred.
    ctx.fillStyle = blockFill(ctx, style.cvBlock);
    ctx.fillRect(0, 0, W, H);
    const maxW = W - 180;
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, heading, headFont, maxW, cvSizeScaled, 4);
    const lh = lineH(fit.size);
    setSub();
    const subLines = subtitle ? balancedWrap(ctx, subtitle, maxW) : [];
    const total = fit.lines.length * lh + (subLines.length ? 40 + subLines.length * subLineH : 0);
    let y = Math.round(H / 2 - total / 2);
    setHead(fit.size);
    y = drawLines(fit.lines, W / 2 + textAt.dx, y + textAt.dy, lh, "center") - textAt.dy + 40;
    if (subLines.length) { setSub(); drawLines(subLines, W / 2 + subTextAt.dx, y + subTextAt.dy, subLineH, "center"); }
  } else if (layout === "behind") {
    // Option 7: flat colour, big heading, then the person cut out of their photo drawn on top so the heading sits behind them.
    ctx.fillStyle = blockFill(ctx, style.cvBlock);
    ctx.fillRect(0, 0, W, H);
    const cut = photo ? await getCutout(photo) : null;
    const maxW = W - 100;
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, heading, headFont, maxW, cvSizeScaled, 2);
    const lh = lineH(fit.size);
    const top = Math.round((style.cvY / 100) * H - (fit.lines.length * lh) / 2);
    setHead(fit.size);
    const bottom = drawLines(fit.lines, W / 2 + textAt.dx, top + textAt.dy, lh, "center") - textAt.dy;
    if (subtitle) {
      setSub();
      const subLines = balancedWrap(ctx, subtitle, Math.round(W * 0.4));
      drawLines(subLines, Math.round(W * 0.69) + subTextAt.dx, bottom + 100 + subTextAt.dy, subLineH, "center");
    }
    if (cut) {
      drawPhotoIn(ctx, cut, 0, 0, W, H, at);
      applyCoverGradient(ctx, style, 0, 0, W, H);
      cut.close();
    } else {
      // The cut out did not work, so keep the photo whole rather than losing it.
      const whole = photo ? await (async () => { const b = await prepareImage(photo); return b ? createImageBitmap(b) : null; })() : null;
      if (whole) { drawPhotoIn(ctx, whole, 0, 0, W, H, at); applyCoverGradient(ctx, style, 0, 0, W, H); whole.close(); }
    }
  } else {
    // centred and serif: full bleed photo. Centred sits in the middle; serif hangs from a bottom edge on a soft gradient.
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, W, H);
    if (bmp) drawPhotoIn(ctx, bmp, 0, 0, W, H, at);
    applyCoverGradient(ctx, style, 0, 0, W, H);
    if (style.overlay > 0 && layout === "centred") {
      ctx.fillStyle = `rgba(0,0,0,${style.overlay / 100})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (layout === "serif" && style.cvScrim > 0) {
      const g = ctx.createLinearGradient(0, H * 0.3, 0, H);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, `rgba(0,0,0,${style.cvScrim / 100})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    const maxW = layout === "serif" ? W - 90 : W - 180;
    setSpacing(ctx, style.cvTracking);
    const fit = fitHeading(ctx, heading, headFont, maxW, cvSizeScaled, layout === "serif" ? 4 : 3);
    const lh = lineH(fit.size);
    setSub();
    const subLines = subtitle ? balancedWrap(ctx, subtitle, maxW) : [];
    const total = fit.lines.length * lh + (subLines.length ? (layout === "serif" ? 22 : 30) + subLines.length * subLineH : 0);
    const anchor = (style.cvY / 100) * H;
    let y = Math.round(layout === "serif" ? anchor - total : anchor - total / 2);
    if (style.shadow && layout === "centred") { ctx.shadowColor = "rgba(0,0,0,0.35)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 2; }
    setHead(fit.size);
    y = drawLines(fit.lines, W / 2 + textAt.dx, y + textAt.dy, lh, "center") - textAt.dy + (layout === "serif" ? 22 : 30);
    if (subLines.length) { setSub(); drawLines(subLines, W / 2 + subTextAt.dx, y + subTextAt.dy, subLineH, "center"); }
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }

  bmp?.close();
  setSpacing(ctx, 0);
  if (logo && style.showLogo && preset) {
    drawLogo(ctx, logo, "top-right", (preset.logoSize || 110) * (style.logoScale ?? 1.35));
  }
}

async function renderSlide(
  spec: SlideSpec,
  photo: File | null,
  style: Style,
  logo: HTMLImageElement | null,
  preset: ClientPreset | null,
  scale: number,
  meta: RenderMeta = { index: 0, total: 1 },
  pos?: PhotoPos,
  textPos?: TextPos,
  subTextPos?: TextPos,
  headScale?: number,
  subScale?: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  await preloadTexture(style.cvBlock);

  if (spec.kind === "cover") {
    await drawCover(ctx, spec, photo, style, logo, preset, pos, meta.extras ?? [], textPos, subTextPos, headScale, subScale);
    return canvas;
  }

  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, W, H);

  if (photo) {
    const blob = await prepareImage(photo);
    if (blob) {
      const bmp = await createImageBitmap(blob);
      drawPhotoIn(ctx, bmp, 0, 0, W, H, pos ?? defaultPos(spec.kind, style));
      bmp.close();
    }
  }

  if (style.overlay > 0) {
    ctx.fillStyle = `rgba(0,0,0,${style.overlay / 100})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (style.scrim > 0) {
    // Soft gradient rising from the bottom keeps the photo bright and the words readable.
    const g = ctx.createLinearGradient(0, H * 0.3, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${style.scrim / 100})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const t = ctx.createLinearGradient(0, 0, 0, H * 0.16);
    t.addColorStop(0, `rgba(0,0,0,${(style.scrim * 0.45) / 100})`);
    t.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = t;
    ctx.fillRect(0, 0, W, H * 0.16);
  }

  const editorial = style.layout === "editorial";
  const left = style.align === "left";
  const M = 92;
  const x = left ? M : W / 2;
  const maxW = W - M * 2;
  const up = (t: string) => (style.uppercase ? t.toUpperCase() : t);
  const display = style.displayFont;
  const blocks: Block[] = [];

  ctx.textAlign = left ? "left" : "center";
  ctx.textBaseline = "top";
  setSpacing(ctx, style.letterSpacing);

  const isCta = spec.kind === "cta";
  let size = isCta ? style.ctaSize : style.bodySize;
  let f = `${isCta && editorial ? "italic " : style.textItalic ? "italic " : ""}${style.textWeight} ${size}px ${display}`;
  ctx.font = f;
  let bodyLines = balancedWrap(ctx, up(spec.text), maxW - (left ? 40 : 30));
  // Longer passages shrink a little until they fit comfortably, so a three sentence slide never runs off the photo.
  while (size > 40 && bodyLines.length * Math.round(size * style.lineHeight) > H * 0.6) {
    size -= 4;
    f = `${isCta && editorial ? "italic " : style.textItalic ? "italic " : ""}${style.textWeight} ${size}px ${display}`;
    ctx.font = f;
    bodyLines = balancedWrap(ctx, up(spec.text), maxW - (left ? 40 : 30));
  }
  blocks.push({
    lines: bodyLines, font: f,
    lineH: Math.round(size * style.lineHeight),
    colour: isCta ? style.ctaColour : style.bodyColour, gapBefore: 0, spacing: style.letterSpacing,
  });

  const total = blocks.reduce((sum, b) => sum + b.gapBefore + b.lines.length * b.lineH, 0);
  const anchor = (style.bodyY / 100) * H;
  // Editorial text hangs from a fixed bottom edge; classic text is centred on the anchor.
  let y = Math.round(editorial ? anchor - total : anchor - total / 2);
  const blockTop = y;

  if (style.shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 2;
  }
  for (const b of blocks) {
    y += b.gapBefore;
    ctx.font = b.font;
    setSpacing(ctx, b.spacing);
    ctx.fillStyle = b.colour;
    for (const line of b.lines) { ctx.fillText(line, x, y); y += b.lineH; }
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  setSpacing(ctx, 0);

  // Fine details: rule above the words, frame, counter, brand and swipe arrow.
  ctx.strokeStyle = style.lineColour;
  if (style.rule) {
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    const ry = blockTop - 40;
    if (left) { ctx.moveTo(M, ry); ctx.lineTo(M + 96, ry); }
    else { ctx.moveTo(W / 2 - 48, ry); ctx.lineTo(W / 2 + 48, ry); }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (style.frame) {
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.55;
    ctx.strokeRect(38, 38, W - 76, H - 76);
    ctx.globalAlpha = 1;
  }
  if (style.counter || (style.brandMark && preset)) {
    ctx.font = `400 22px ${style.fontFamily}`;
    setSpacing(ctx, 6);
    ctx.textBaseline = "middle";
    ctx.fillStyle = style.lineColour;
    ctx.globalAlpha = 0.92;
    if (style.counter) {
      ctx.textAlign = "left";
      const n = (v: number) => String(v).padStart(2, "0");
      ctx.fillText(`${n(meta.index + 1)} / ${n(meta.total)}`, M, 96);
    }
    if (style.brandMark && preset && !(logo && style.showLogo)) { // the logo takes the top right corner
      ctx.textAlign = "right";
      ctx.fillText(preset.name.toUpperCase(), W - M + 6, 96);
    }
    ctx.globalAlpha = 1;
    setSpacing(ctx, 0);
    ctx.textBaseline = "top";
  }
  if (style.arrow && meta.index < meta.total - 1) {
    const ay = H - 100;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(W - M - 76, ay); ctx.lineTo(W - M, ay);
    ctx.moveTo(W - M - 14, ay - 11); ctx.lineTo(W - M, ay); ctx.lineTo(W - M - 14, ay + 11);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (logo && style.showLogo && preset) {
    drawLogo(ctx, logo, "top-right", (preset.logoSize || 110) * (style.logoScale ?? 1.35));
  }
  return canvas;
}

async function warmFonts(style: Style) {
  await Promise.allSettled([
    document.fonts.load(`${style.cvWeight} ${style.cvSize}px ${style.cvFont}`),
    document.fonts.load(`${style.cvSubWeight} ${style.cvSubSize}px ${style.cvSubFont}`),
    document.fonts.load(`${style.cvWeight} ${style.cvSize}px ${style.plainFont}`),
    document.fonts.load(`${style.cvSubWeight} ${style.cvSubSize}px ${style.plainSubFont}`),
    document.fonts.load(`${style.cvWeight} ${style.cvSize}px ${style.behindFont}`),
    document.fonts.load(`${style.cvSubWeight} ${style.cvSubSize}px ${style.behindSubFont}`),
    ...Object.values(style.lf ?? {}).flatMap(f => [
      document.fonts.load(`${style.cvWeight} 100px ${f.h}`),
      document.fonts.load(`${style.cvSubWeight} 40px ${f.s}`),
    ]),
    document.fonts.load(`${style.textItalic ? "italic " : ""}${style.textWeight} ${style.bodySize}px ${style.displayFont}`),
    document.fonts.load(`italic ${style.textWeight} ${style.ctaSize}px ${style.displayFont}`),
    document.fonts.load(`400 22px ${style.fontFamily}`),
    ...(style.clientCoverFont ? [document.fonts.load(`${style.cvWeight} ${style.cvSize}px ${style.clientCoverFont}`)] : []),
    ...(style.clientCoverSubFont ? [document.fonts.load(`${style.cvSubWeight} ${style.cvSubSize}px ${style.clientCoverSubFont}`)] : []),
  ]);
}

// ---------------------------------------------------------------------------
// Upload helper for scheduling
// ---------------------------------------------------------------------------

async function uploadPngs(dataUrls: string[], names: string[]): Promise<string[]> {
  const BATCH = 3;
  const urls: string[] = [];
  for (let i = 0; i < dataUrls.length; i += BATCH) {
    const images = dataUrls.slice(i, i + BATCH).map((base64, j) => ({ name: names[i + j], base64 }));
    const res = await fetch(`${BASE}/api/content/upload-image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
      throw new Error(data.error || "Upload failed");
    }
    const data = await res.json();
    urls.push(...(data.results ?? []).map((r: { url: string }) => r.url));
  }
  return urls;
}

// The client's own photos are filed in their library the first time they are used, so they can be
// picked again next time under "Add approved photos". Photos already saved are skipped.
async function savePhotosToClientLibrary(files: File[], clientName: string) {
  if (!clientName) return;
  const key = `stylish-saved-photos:${clientName.toLowerCase()}`;
  let seen: string[] = [];
  try { seen = JSON.parse(localStorage.getItem(key) || "[]"); } catch { /* ignore */ }
  const sig = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;
  const fresh = files.filter(f => !/^approved-/.test(f.name) && !seen.includes(sig(f)));
  if (!fresh.length) return;
  try {
    const dataUrls: string[] = [];
    for (const f of fresh) {
      const bmp = await createImageBitmap(f);
      const sc = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas");
      c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
      c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close();
      dataUrls.push(c.toDataURL("image/jpeg", 0.9));
    }
    const urls = await uploadPngs(dataUrls, fresh.map((f, i) => `photo-${Date.now()}-${i + 1}.jpg`));
    const pw = localStorage.getItem("cybersuite-pw") || "";
    const r = await fetch(`${BASE}/api/approval/batches`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-app-password": pw, Authorization: `Bearer ${pw}` },
      body: JSON.stringify({ name: `Stylish photos ${new Date().toLocaleDateString("en-GB")}`, clientName, imageUrls: urls, alreadyApproved: true }),
    });
    if (r.ok) {
      try { localStorage.setItem(key, JSON.stringify([...seen, ...fresh.map(sig)].slice(-2000))); } catch { /* ignore */ }
      toast.success(`Saved ${fresh.length} photo${fresh.length !== 1 ? "s" : ""} to ${clientName}'s library`);
    }
  } catch { /* never blocks the main job */ }
}

const tick = () => new Promise<void>(r => setTimeout(r, 0));

// 1080 x 1920 story: the post's cover photo, a dark layer so the words read, the question in
// bold across the top and a "reply below" line under it. Kept clear of the top 250px and bottom
// 340px, which Instagram covers with its own buttons.
async function renderStory(question: string, photo: File | null, style: Style, preset: ClientPreset | null): Promise<HTMLCanvasElement> {
  const SW = 1080, SH = 1920;
  const c = document.createElement("canvas");
  c.width = SW; c.height = SH;
  const ctx = c.getContext("2d")!;
  const accent = preset?.accentColor || "#e11d74";
  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(0, 0, SW, SH);
  if (photo) {
    const b = await prepareImage(photo);
    const bmp = b ? await createImageBitmap(b) : null;
    if (bmp) {
      const sc = Math.max(SW / bmp.width, SH / bmp.height);
      const dw = bmp.width * sc, dh = bmp.height * sc;
      ctx.drawImage(bmp, (SW - dw) / 2, (SH - dh) / 2, dw, dh);
      bmp.close();
    }
  }
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, SW, SH);
  const g = ctx.createLinearGradient(0, 0, 0, 1000);
  g.addColorStop(0, "rgba(0,0,0,0.7)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SW, 1000);

  const family = style.displayFont;
  const text = question.toUpperCase();
  let size = 128;
  let lines: string[] = [];
  for (; size >= 72; size -= 6) {
    await document.fonts.load(`900 ${size}px ${family}`).catch(() => undefined);
    ctx.font = `900 ${size}px ${family}`;
    lines = wrapText(ctx, text, 900);
    if (lines.length <= 5) break;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 18;
  const lh = Math.round(size * 1.08);
  let y = 300;
  for (const line of lines) { ctx.fillText(line, SW / 2, y); y += lh; }
  ctx.shadowBlur = 0;

  const pillText = "REPLY BELOW WITH YOUR ANSWER";
  await document.fonts.load(`800 46px ${family}`).catch(() => undefined);
  ctx.font = `800 46px ${family}`;
  const pw = ctx.measureText(pillText).width + 90, ph = 96, px = (SW - pw) / 2, py = y + 40;
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, ph / 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, SW / 2, py + ph / 2 + 2);
  return c;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Your own fonts. Files stay in this browser only (IndexedDB) and are never uploaded anywhere.
// ---------------------------------------------------------------------------

type FontInfo = { family: string; compact: string; weight: number; italic: boolean };

function parseFontFile(fileName: string): FontInfo {
  let base = fileName.replace(/\.[^.]+$/, "");
  const lower = base.toLowerCase();
  const italic = /italic|oblique/.test(lower);
  const weights: [RegExp, number][] = [
    [/extra[-_ ]?black|ultra/, 950], [/black|heavy/, 900], [/extra[-_ ]?bold|ultra[-_ ]?bold/, 800],
    [/semi[-_ ]?bold|demi/, 600], [/bold/, 700], [/medium/, 500], [/extra[-_ ]?light|ultra[-_ ]?light/, 200],
    [/thin|hairline/, 100], [/light/, 300],
  ];
  let weight = 400;
  for (const [re, w] of weights) if (re.test(lower)) { weight = Math.min(w, 900); break; }
  base = base.replace(/([-_ ]?(extra|ultra|semi|demi)?[-_ ]?(black|heavy|bold|medium|light|thin|hairline|regular|italic|oblique|book|roman))+$/i, "");
  const spaced = base.replace(/[-_]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\s+/g, " ").trim() || "My font";
  return { family: spaced, compact: spaced.replace(/\s+/g, ""), weight, italic };
}

type FontOption = { label: string; value: string; group?: string };
// Font list rows, with a small heading above each named group (Envato headings, Envato subtitles, Your fonts).
function fontItems(options: FontOption[]) {
  const out: React.ReactNode[] = [];
  let last: string | undefined;
  for (const f of options) {
    if (f.group && f.group !== last) out.push(<div key={`g-${f.group}`} className="px-2 pt-2 pb-1 text-[18px] uppercase tracking-wide text-muted-foreground">{f.group}</div>);
    last = f.group;
    out.push(<SelectItem key={f.value} value={f.value}><span style={{ fontFamily: f.value }}>{f.label}</span></SelectItem>);
  }
  return out;
}

const fontFaceRegistry = new Map<string, FontFace[]>();

async function registerFont(fileName: string, data: ArrayBuffer): Promise<string | null> {
  try {
    for (const old of fontFaceRegistry.get(fileName) ?? []) document.fonts.delete(old);
    fontFaceRegistry.delete(fileName);
    const info = parseFontFile(fileName);
    const faces: FontFace[] = [];
    for (const fam of new Set([info.family, info.compact])) {
      const face = new FontFace(fam, data.slice(0), { weight: String(info.weight), style: info.italic ? "italic" : "normal" });
      await face.load();
      document.fonts.add(face);
      faces.push(face);
    }
    fontFaceRegistry.set(fileName, faces);
    for (const fam of new Set([info.family, info.compact])) {
      const key = fam.toLowerCase();
      if (!info.italic || !fontBytes.has(key)) fontBytes.set(key, data.slice(0));
      otCache.delete(key);
    }
    return info.family;
  } catch {
    return null;
  }
}

function openFontDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open("stylish-fonts", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("fonts");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function fontDbAll(): Promise<{ name: string; data: ArrayBuffer }[]> {
  const db = await openFontDb();
  if (!db) return [];
  return new Promise(resolve => {
    try {
      const out: { name: string; data: ArrayBuffer }[] = [];
      const cur = db.transaction("fonts").objectStore("fonts").openCursor();
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) { out.push({ name: String(c.key), data: c.value as ArrayBuffer }); c.continue(); } else resolve(out);
      };
      cur.onerror = () => resolve(out);
    } catch { resolve([]); }
  });
}

async function fontDbPut(name: string, data: ArrayBuffer) {
  const db = await openFontDb();
  if (!db) return;
  try { db.transaction("fonts", "readwrite").objectStore("fonts").put(data, name); } catch { /* not saved, still usable this visit */ }
}

async function fontDbDelete(name: string) {
  const db = await openFontDb();
  if (!db) return;
  try { db.transaction("fonts", "readwrite").objectStore("fonts").delete(name); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------

function CoverIcon({ k }: { k: CoverLayout }) {
  return (
    <div className="relative w-9 h-12 rounded-sm overflow-hidden bg-neutral-100 border border-border/30 shrink-0">
      {k === "band" && (<><div className="absolute inset-x-0 top-0 h-[74%] bg-amber-700/70" /><div className="absolute left-1 bottom-1.5 w-5 h-1 bg-black" /></>)}
      {k === "centred" && (<><div className="absolute inset-0 bg-amber-700/70" /><div className="absolute left-1.5 right-1.5 top-[42%] h-1 bg-sky-400" /><div className="absolute left-2.5 right-2.5 top-[58%] h-0.5 bg-white" /></>)}
      {k === "block" && (<><div className="absolute inset-x-0 top-0 h-[38%] bg-amber-700/70" /><div className="absolute left-1 right-1 top-[58%] h-2 bg-black" /><div className="absolute left-1 bottom-1.5 w-3 h-0.5 bg-black" /></>)}
      {k === "serif" && (<><div className="absolute inset-0 bg-amber-700/70" /><div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/70 to-transparent" /><div className="absolute left-1 right-1 bottom-4 h-1.5 bg-white" /><div className="absolute left-2 right-2 bottom-2 h-0.5 bg-white/80" /></>)}
      {k === "behind" && (<><div className="absolute inset-0 bg-neutral-200" /><div className="absolute left-0.5 right-0.5 top-[14%] h-3 bg-neutral-800" /><div className="absolute left-2 right-2 bottom-0 top-[22%] bg-amber-700/80 rounded-t-full" /></>)}
      {k === "plain" && (<><div className="absolute inset-0 bg-indigo-900" /><div className="absolute left-1.5 right-1.5 top-[40%] h-1.5 bg-white" /><div className="absolute left-2.5 right-2.5 top-[56%] h-0.5 bg-white/80" /></>)}
      {k === "fullbleed" && (<><div className="absolute inset-0 bg-amber-800/70" /><div className="absolute left-1 top-[18%] w-4 h-1.5 bg-white" /><div className="absolute left-1 top-[30%] w-4 h-1.5 bg-white" /><div className="absolute left-1 bottom-2 w-3 h-0.5 bg-white/80" /></>)}
      {k === "blur" && (<><div className="absolute inset-0 bg-gradient-to-r from-neutral-300 via-amber-800/60 to-neutral-800/80 blur-[1px]" /><div className="absolute left-2 right-2 top-[42%] h-1 bg-white" /><div className="absolute left-3 right-3 top-[58%] h-0.5 bg-white/80" /></>)}
      {k === "strip" && (<><div className="absolute inset-0 bg-amber-800/60" /><div className="absolute inset-y-0 left-1 w-3 bg-black" /><div className="absolute left-4 right-0 bottom-[6%] h-[26%] bg-amber-50" /><div className="absolute left-5 bottom-[16%] w-4 h-1 bg-black" /></>)}
      {k === "diagonal" && (<><div className="absolute inset-0 bg-amber-800/70" /><div className="absolute left-1 right-1 top-[28%] h-1 bg-white rotate-[24deg]" /><div className="absolute left-1 bottom-3 w-3 h-0.5 bg-white/80" /></>)}
      {k === "behind2" && (<><div className="absolute inset-0 bg-white" /><div className="absolute left-0.5 right-0.5 top-[16%] h-3 bg-blue-800" /><div className="absolute left-2 right-0 bottom-0 top-[30%] bg-amber-700/80 rounded-t-full" /></>)}
      {k === "polaroid" && (<><div className="absolute inset-0 bg-white" /><div className="absolute left-2 right-1 top-[20%] bottom-[22%] bg-stone-200 rotate-[-6deg]" /><div className="absolute left-1 right-2 top-[26%] bottom-[30%] bg-amber-700/70 border-2 border-white" /></>)}
      {k === "sidebar" && (<><div className="absolute inset-0 bg-amber-800/60" /><div className="absolute left-1 top-0 bottom-0 w-[50%] bg-white" /><div className="absolute left-1.5 top-[30%] w-3 h-1.5 bg-black" /></>)}
      {k === "frame" && (<><div className="absolute inset-0 bg-amber-900/70" /><div className="absolute inset-1 bg-white" /><div className="absolute left-1.5 top-1.5 w-[42%] h-[42%] bg-amber-700/70" /><div className="absolute right-1.5 bottom-1.5 w-[42%] h-[42%] bg-amber-700/70" /></>)}
      {k === "layered" && (<><div className="absolute inset-0 bg-amber-900/60" /><div className="absolute left-2 right-2 top-[20%] bottom-[18%] bg-stone-200" /><div className="absolute left-2.5 right-2.5 top-[24%] h-[32%] bg-amber-700/70" /></>)}
      {k === "split" && (<><div className="absolute inset-y-0 left-0 w-[47%] bg-amber-700/70" /><div className="absolute left-[54%] right-1 top-[24%] h-1.5 bg-black" /><div className="absolute right-1 bottom-0 left-[47%] h-1.5 bg-neutral-500" /></>)}
    </div>
  );
}

function ColourField({ label, value, onChange, metallic, textures }: { label: string; value: string; onChange: (v: string) => void; metallic?: boolean; textures?: boolean }) {
  const isMetallic = metallic && !!METALLICS[value];
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          spellCheck={false}
          className="w-20 h-7 rounded bg-muted/30 border border-border/40 px-1.5 text-xs font-mono"
        />
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"}
          onChange={e => onChange(e.target.value)}
          className="w-8 h-7 rounded border border-border/40 bg-transparent cursor-pointer p-0"
          aria-label={`${label} picker`}
        />
        {isMetallic && <span className="text-[18px] text-sky-400/90 whitespace-nowrap">using {METALLICS[value].label.toLowerCase()}</span>}
        {textures && TEXTURES[value] && <span className="text-[18px] text-sky-400/90 whitespace-nowrap">using {TEXTURES[value].label.toLowerCase()}</span>}
      </div>
      {textures && (
        <div className="flex flex-wrap gap-1.5 max-w-[210px]">
          {Object.entries(TEXTURES).map(([key, t]) => (
            <button
              key={key}
              type="button" onClick={() => onChange(key)} title={t.label}
              className={["w-6 h-6 rounded border shrink-0 bg-cover bg-center", value === key ? "border-sky-500 ring-1 ring-sky-500" : "border-border/40"].join(" ")}
              style={{ backgroundImage: `url(${import.meta.env.BASE_URL}${t.file})` }}
            />
          ))}
        </div>
      )}
      {metallic && (
        <div className="flex flex-wrap gap-1.5 max-w-[210px]">
          {Object.entries(METALLICS).map(([key, m]) => (
            <button
              key={key}
              type="button" onClick={() => onChange(key)} title={m.label}
              className={["w-6 h-6 rounded border shrink-0", value === key ? "border-sky-500 ring-1 ring-sky-500" : "border-border/40"].join(" ")}
              style={{ background: `linear-gradient(135deg, ${m.stops.map(([, c]) => c).join(", ")})` }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SliderField({
  label, value, min, max, step = 1, suffix = "", onChange,
}: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-[18px] font-mono text-foreground/70">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-sky-500"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const CLIENT_FONTS_KEY = "stylish-client-fonts-v1";
const CLIENT_FONT_KEYS = ["cvFont", "cvSubFont", "plainFont", "plainSubFont", "behindFont", "behindSubFont", "displayFont", "lf"] as const;

export default function Stylish() {
  const { presets, loading: presetsLoading, updatePresetCoverFonts } = usePresets();

  const [style, setStyle] = useState<Style>(() => {
    try {
      const raw = localStorage.getItem(STYLE_STORAGE_KEY);
      if (raw) return { ...DEFAULT_STYLE, ...JSON.parse(raw) };
    } catch { /* storage can be blocked, defaults are fine */ }
    return DEFAULT_STYLE;
  });
  const patch = useCallback((p: Partial<Style>) => setStyle(s => ({ ...s, ...p })), []);
  const coverNo = COVER_ORDER.indexOf(style.coverLayout) + 1;
  // Sets the headline (0) or subtitle (1) font of the cover that is showing.
  const setFace = (which: 0 | 1, v: string) => {
    const l = style.coverLayout;
    if (l === "plain") patch(which === 0 ? { plainFont: v } : { plainSubFont: v });
    else if (l === "behind") patch(which === 0 ? { behindFont: v } : { behindSubFont: v });
    else if (MORE_LAYOUTS.has(l)) {
      const cur = coverDefaultFaces(style, l);
      patch({ lf: { ...style.lf, [l]: { h: which === 0 ? v : cur[0], s: which === 1 ? v : cur[1] } } });
    } else patch(which === 0 ? { cvFont: v } : { cvSubFont: v });
  };

  useEffect(() => {
    try { localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(style)); } catch { /* ignore */ }
  }, [style]);

  const [images, setImages] = useState<File[]>([]);
  const [perPost, setPerPost] = useState(5);
  const [reusePhotos, setReusePhotos] = useState(true);
  const [coverVersion, setCoverVersion] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, File>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [csvName, setCsvName] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [imgDrag, setImgDrag] = useState(false);
  const [csvDrag, setCsvDrag] = useState(false);

  const [presetId, setPresetId] = useState<number | null>(null);
  const preset = presets.find(p => p.id === presetId) ?? null;
  // The client's saved area fills the SEO box for captions, unless one has been typed already.
  useEffect(() => {
    const saved = preset?.seoArea?.trim();
    if (saved) setArea(cur => cur.trim() ? cur : saved);
  }, [preset?.id, preset?.seoArea]);

  // Each client remembers the per-option cover fonts chosen for them (browser only —
  // these are the "Headline font (option N)" pickers, not the client's own cover fonts
  // below, which live on the client's preset so they follow the client, not this browser).
  const clientFonts = () => {
    try { return JSON.parse(localStorage.getItem(CLIENT_FONTS_KEY) || "{}") as Record<string, Partial<Style>>; } catch { return {}; }
  };
  const chooseClient = (id: number) => {
    const saved = clientFonts()[String(id)];
    const chosen = presets.find(p => p.id === id);
    setPresetId(id);
    // A client with no fonts saved yet starts from the defaults, not whichever fonts the
    // previously selected client happened to leave behind.
    const fallback = Object.fromEntries(CLIENT_FONT_KEYS.map(k => [k, DEFAULT_STYLE[k]])) as Partial<Style>;
    patch({
      ...fallback,
      ...saved,
      ...(saved.coverLayout && !COVER_ORDER.includes(saved.coverLayout) ? COVER_PRESETS.band : {}),
      ...(TEXTURES[style.cvBlock] ? { cvBlock: DEFAULT_STYLE.cvBlock } : {}),
      // Tweaked Helen's cover block is leopard print, so it starts that way whenever she is chosen.
      ...(/tweaked\s*helen/i.test(chosen?.name ?? "") ? { cvBlock: "texture:leopard" } : {}),
      clientCoverFont: chosen?.stylishCoverHeadlineFont || "",
      clientCoverSubFont: chosen?.stylishCoverSubtitleFont || "",
    });
  };
  useEffect(() => {
    if (!presetId) return;
    try {
      const all = clientFonts();
      all[String(presetId)] = Object.fromEntries(CLIENT_FONT_KEYS.map(k => [k, style[k]])) as Partial<Style>;
      localStorage.setItem(CLIENT_FONTS_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, style.cvFont, style.cvSubFont, style.plainFont, style.plainSubFont, style.behindFont, style.behindSubFont, style.displayFont, style.lf]);

  // The client's own cover fonts (headline + subtitle) live on their preset, not this
  // browser, so picking one here saves straight to the client.
  const setClientCoverFont = (which: "head" | "sub", v: string) => {
    const value = v === "__none" ? "" : v;
    const next = which === "head"
      ? { clientCoverFont: value, clientCoverSubFont: style.clientCoverSubFont }
      : { clientCoverFont: style.clientCoverFont, clientCoverSubFont: value };
    patch(which === "head" ? { clientCoverFont: value } : { clientCoverSubFont: value });
    if (!presetId) { toast.error("Choose a client first"); return; }
    updatePresetCoverFonts(presetId, next.clientCoverFont || null, next.clientCoverSubFont || null)
      .catch(() => toast.error("Could not save that font to the client"));
  };

  const [tone, setTone] = useState("1");
  const [area, setArea] = useState("");
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [customFonts, setCustomFonts] = useState<{ file: string; family: string }[]>([]);
  const [fontVersion, setFontVersion] = useState(0);
  const fontInputRef = useRef<HTMLInputElement>(null);
  const headlineFontInputRef = useRef<HTMLInputElement>(null);
  const subtitleFontInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      const saved = await fontDbAll();
      const loaded: { file: string; family: string }[] = [];
      for (const f of saved) {
        const fam = await registerFont(f.name, f.data);
        if (fam) loaded.push({ file: f.name, family: fam });
      }
      if (!dead && loaded.length) { setCustomFonts(loaded); setFontVersion(v => v + 1); }
    })();
    return () => { dead = true; };
  }, []);

  const addFonts = async (files: File[]) => {
    const added: { file: string; family: string }[] = [];
    for (const f of files) {
      if (!/\.(otf|ttf|woff2?|)$/i.test(f.name)) continue;
      const data = await f.arrayBuffer();
      const fam = await registerFont(f.name, data);
      if (fam) { added.push({ file: f.name, family: fam }); await fontDbPut(f.name, data); }
      else toast.error(`Could not read ${f.name}`);
    }
    if (added.length) {
      setCustomFonts(list => [...list.filter(x => !added.some(a => a.file === x.file)), ...added]);
      setFontVersion(v => v + 1);
      toast.success(`Added ${[...new Set(added.map(a => a.family))].join(", ")}`);
    }
    return added;
  };

  // Upload a font file straight into a client's headline or subtitle font, in one step:
  // register it under "Your fonts" and set + save it for this client immediately.
  const uploadClientFont = async (which: "head" | "sub", file: File) => {
    const added = await addFonts([file]);
    const fam = added[0]?.family;
    if (fam) setClientCoverFont(which, `'${fam}', sans-serif`);
  };

  const removeFont = async (file: string) => {
    for (const face of fontFaceRegistry.get(file) ?? []) document.fonts.delete(face);
    fontFaceRegistry.delete(file);
    await fontDbDelete(file);
    setCustomFonts(list => list.filter(x => x.file !== file));
    setFontVersion(v => v + 1);
  };

  const customFamilies = [...new Set(customFonts.map(f => f.family))];
  // Fonts bought from Envato get their own sections, headings and subtitles, at the top of every font list.
  const envatoGroup = (fam: string) => {
    const n = fam.toLowerCase().replace(/[^a-z]/g, "");
    if (/annyra|syora|avoraty|ragitras|brylliant/.test(n)) return "Envato fonts: headings";
    if (/geonnix|enchantedlove|justsans/.test(n)) return "Envato fonts: subtitles";
    return "";
  };
  const customOptions: FontOption[] = customFamilies
    .map(fam => {
      const group = envatoGroup(fam);
      return { label: group ? fam : `${fam} (yours)`, value: `'${fam}', sans-serif`, group: group || "Your fonts" };
    })
    .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  const coverFontOptions: FontOption[] = [...customOptions, ...COVER_FONTS];
  const slideFontOptions: FontOption[] = [...customOptions, { label: "Instrument Serif", value: F_INSTRUMENT }, ...FONT_OPTIONS];
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, "");
  const missingFonts = COVER_WANTS[style.coverLayout].filter(w => !customFamilies.some(c => norm(c) === norm(w)));
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [scheduleStart, setScheduleStart] = useState<string | undefined>(undefined);
  const [scheduling, setScheduling] = useState<string | null>(null);
  const [captionAllBusy, setCaptionAllBusy] = useState(false);
  const [scheduleItems, setScheduleItems] = useState<SchedulePostPayload[] | null>(null);
  const [scheduleMode, setScheduleMode] = useState<"carousel" | "reel">("carousel");
  const [withStories, setWithStories] = useState(true);
  const [scheduleStories, setScheduleStories] = useState<{ imageUrl: string; title: string }[] | undefined>(undefined);
  const [sendingFlip, setSendingFlip] = useState(false);

  const imgInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  // Where each photo has been dragged to, keyed by "postId:slideIndex". A ref so a drag is smooth,
  // with a counter to refresh the buttons that depend on it.
  const focusRef = useRef<Record<string, PhotoPos>>({});
  const [, bumpFocus] = useState(0);
  // Same idea, for how far a cover's headline (and, separately, its subtitle) has been nudged
  // off its usual spot.
  const textFocusRef = useRef<Record<string, TextPos>>({});
  const subTextFocusRef = useRef<Record<string, TextPos>>({});
  // How much bigger or smaller than normal a cover's headline/subtitle has been dragged to, 1 = normal size.
  const textScaleRef = useRef<Record<string, number>>({});
  const subTextScaleRef = useRef<Record<string, number>>({});
  const logoRef = useRef<HTMLImageElement | null>(null);
  const redrawSeq = useRef<Record<string, number>>({});
  const dragRef = useRef<{
    key: string; pi: number; si: number; startX: number; startY: number;
    start: PhotoPos; ox: number; oy: number; thumbScale: number; busy: boolean; pending: boolean;
  } | null>(null);
  const textDragRef = useRef<{
    key: string; pi: number; si: number; startX: number; startY: number;
    start: TextPos; thumbScale: number; busy: boolean; pending: boolean;
  } | null>(null);
  const subTextDragRef = useRef<{
    key: string; pi: number; si: number; startX: number; startY: number;
    start: TextPos; thumbScale: number; busy: boolean; pending: boolean;
  } | null>(null);
  const textResizeRef = useRef<{
    key: string; pi: number; si: number; startY: number; start: number; thumbScale: number; busy: boolean; pending: boolean;
  } | null>(null);
  const subTextResizeRef = useRef<{
    key: string; pi: number; si: number; startY: number; start: number; thumbScale: number; busy: boolean; pending: boolean;
  } | null>(null);

  // -- which photo belongs to which slide ----------------------------------

  const slideCounts = useMemo(() => posts.map(p => buildSlides(p.texts).length), [posts]);
  const shortOfPhotos = images.length > 0 && images.length < posts.reduce((sum, _p, i) => sum + Math.max(perPost, slideCounts[i] ?? 0), 0);
  const reusing = reusePhotos && shortOfPhotos;
  const reusePlan = useMemo(
    () => (reusing ? planReusedPhotos(images, slideCounts) : null),
    [reusing, images, slideCounts],
  );

  const photoFor = useCallback((postIndex: number, post: Post, slideIndex: number): File | null => {
    const o = overrides[`${post.id}:${slideIndex}`];
    if (o) return o;
    if (reusePlan) return reusePlan[postIndex]?.[slideIndex] ?? null;
    const start = postIndex * perPost;
    const idx = start + Math.min(slideIndex, perPost - 1);
    return images[idx] ?? (images[start + slideIndex] ?? null);
  }, [images, perPost, overrides, reusePlan]);

  // -- inputs ----------------------------------------------------------------

  const handleImages = (incoming: File[]) => {
    const files = incoming.filter(f => f.type.startsWith("image/")).sort(naturalSort);
    if (!files.length) { toast.error("No images found in that selection"); return; }
    setImages(files);
    setOverrides({});
    focusRef.current = {};
  };

  const addApproved = (files: File[]) => {
    if (!files.length) return;
    setImages(prev => [
      ...prev,
      ...files.map((f, i) => new File([f], `approved-${String(prev.length + i + 1).padStart(3, "0")}-${f.name}`, { type: f.type })),
    ]);
  };

  const parseCsv = useCallback((file: File) => {
    setCsvError(null);
    readFileAsText(file).then(raw => {
      Papa.parse<string[]>(raw, {
        skipEmptyLines: "greedy",
        complete: result => {
          let rows = result.data.map(r => (Array.isArray(r) ? r.map(c => String(c ?? "")) : [String(r)]));
          if (!rows.length) { setCsvError("That CSV is empty"); return; }
          const first = (rows[0][0] ?? "").trim().toLowerCase();
          const hasHeader = /^(headline|hook|title|heading|column ?1)/.test(first);
          const cols = Math.max(hasHeader ? rows[0].length : 0, ...rows.slice(hasHeader ? 1 : 0).map(r => r.length));
          if (hasHeader) rows = rows.slice(1);
          if (cols < 3) { setCsvError("The CSV needs at least 3 columns: headline, subtitle and CTA (with any number of text columns between)."); return; }
          const parsed: Post[] = rows
            .map(r => Array.from({ length: cols }, (_, i) => (r[i] ?? "").trim()))
            .filter(t => t.some(Boolean))
            .map((texts, i) => ({ id: makeId(), texts, caption: "", captionBusy: false, selected: true, cover: COVER_ORDER[i % COVER_ORDER.length] }));
          if (!parsed.length) { setCsvError("No rows with text were found"); return; }
          setPosts(parsed);
          setCsvName(file.name);
          setOverrides({});
          focusRef.current = {};
        },
        error: (err: Error) => setCsvError(err.message),
      });
    });
  }, []);

  const downloadSample = () => {
    saveAs(new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" }), "stylish-sample.csv");
  };

  // A pack made on the Client Stylish page (16 photos and the CSV) arrives here ready to style.
  const [pendingClient, setPendingClient] = useState<string | null>(null);
  const autoRunRef = useRef(false);
  const octoberRef = useRef<{ spot?: string } | null>(null);
  // A pack sent with "Use the October 26 covers" gets one October cover per post, once the posts are read.
  useEffect(() => {
    if (!octoberRef.current || !posts.length || pendingClient) return;
    const o = octoberRef.current;
    octoberRef.current = null;
    const order: CoverLayout[] = ["oct13", "oct1", "oct6", "oct9", "oct18", "oct17", "oct4", "oct8", "oct12", "oct11", "oct10", "oct3", "oct14", "oct7", "oct16"];
    setPosts(l => l.map((p, i) => ({ ...p, cover: order[i % order.length], coverSpot: o.spot && /^#?[0-9a-f]{6}$/i.test(o.spot) ? (o.spot.startsWith("#") ? o.spot : `#${o.spot}`) : p.coverSpot })));
    toast.success("October 26 covers added, one per post. Change any of them from that post's cover options.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length, pendingClient]);
  useEffect(() => {
    takeStylishHandoff().then(h => {
      if (!h) return;
      setImages(h.files);
      setOverrides({});
      focusRef.current = {};
      parseCsv(new File([h.csv], h.csvName, { type: "text/csv" }));
      setPendingClient(h.clientName);
      if (h.location) setArea(h.location);
      toast.success(`${h.clientName} pack loaded: ${h.files.length} photos and the CSV.`);
      if (h.october) { octoberRef.current = { spot: h.spot }; }
      if (h.intent === "auto") autoRunRef.current = true;
      if (h.intent === "reels") toast.message("Pick the look, tick the posts you want, then press Make into reels. Each post also has a Magazine Flip reel button above its caption.", { duration: 12000 });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!pendingClient || presetsLoading) return;
    const n = pendingClient.trim().toLowerCase();
    const match =
      presets.find(p => p.name.trim().toLowerCase() === n) ??
      (n.length >= 4 ? presets.find(p => { const pn = p.name.trim().toLowerCase(); return pn.length >= 4 && (pn.includes(n) || n.includes(pn)); }) : undefined);
    if (match) chooseClient(match.id);
    else toast.info(`No saved Stylish client called ${pendingClient} yet. Pick a template, then set size, placement and fonts below and save it as a client.`);
    setPendingClient(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingClient, presetsLoading, presets]);

  // "Posts and stories in one go" from Client Stylish: once the pack, the client's look and the
  // photos are all in, write the captions, make the stories and open the schedule screen. It stops
  // there so nothing is booked until it has been checked.
  useEffect(() => {
    if (!autoRunRef.current || pendingClient || presetsLoading) return;
    if (!posts.length || !images.length) return;
    autoRunRef.current = false;
    if (!preset) { toast.error("Pick the client above first, then press Schedule. I need to know whose account to use."); return; }
    setPosts(l => l.map(p => ({ ...p, selected: true })));
    setTimeout(() => { void handleScheduleRef.current("carousel"); }, 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingClient, presetsLoading, posts.length, images.length, preset]);

  // -- live thumbnails -------------------------------------------------------

  const renderKey = useMemo(
    () => JSON.stringify([
      posts.map(p => [p.id, p.texts]), style, images.map((f, i) => i + f.name + f.size), perPost, reusing, coverVersion,
      Object.entries(overrides).map(([k, f]) => k + f.name + f.size), preset?.id, preset?.logoUrl, fontVersion,
    ]),
    [posts, style, images, perPost, reusing, coverVersion, overrides, preset, fontVersion],
  );

  const postsRef = useRef(posts);
  postsRef.current = posts;

  // Loads the fonts for the main cover and for any cover option a post has picked for itself.
  const warmAll = async () => {
    await warmFonts(style);
    const own = new Set(postsRef.current.map(p => p.cover).filter((c): c is CoverLayout => !!c && c !== style.coverLayout));
    for (const c of own) await warmFonts({ ...style, ...COVER_PRESETS[c] } as Style);
  };
  const photoForRef = useRef(photoFor);
  photoForRef.current = photoFor;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!postsRef.current.length) { setThumbs({}); return; }
      setRendering(true);
      try {
        await warmAll();
        const logo = style.showLogo ? await loadLogo(preset) : null;
        logoRef.current = logo;
        for (let pi = 0; pi < postsRef.current.length; pi++) {
          if (cancelled) return;
          const post = postsRef.current[pi];
          const specs = buildSlides(post.texts);
          const batch: Record<string, string> = {};
          for (let si = 0; si < specs.length; si++) {
            const tk = `${post.id}:${si}`;
            const canvas = await renderSlide(specs[si], photoForRef.current(pi, post, si), styleForSlide(style, post, specs[si].kind), logo, preset, 0.3, { index: si, total: specs.length, extras: si === 0 ? [1, 2, 3].map(k => photoForRef.current(pi, post, k)) : undefined }, focusRef.current[tk], textFocusRef.current[tk], subTextFocusRef.current[tk], textScaleRef.current[tk], subTextScaleRef.current[tk]);
            batch[`${post.id}:${si}`] = canvas.toDataURL("image/jpeg", 0.75);
          }
          if (cancelled) return;
          setThumbs(prev => ({ ...prev, ...batch }));
          await tick();
        }
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Preview failed");
      } finally {
        if (!cancelled) setRendering(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKey]);

  // -- dragging a photo to the right spot -----------------------------------------

  // Redraws just the slide being dragged (photo, headline or subtitle), so the preview follows
  // the pointer without waiting for every post.
  const redrawOne = useCallback(async (post: Post, pi: number, si: number) => {
    const key = `${post.id}:${si}`;
    const active: { busy: boolean; pending: boolean } | null =
      dragRef.current?.key === key ? dragRef.current
      : textDragRef.current?.key === key ? textDragRef.current
      : subTextDragRef.current?.key === key ? subTextDragRef.current
      : textResizeRef.current?.key === key ? textResizeRef.current
      : subTextResizeRef.current?.key === key ? subTextResizeRef.current
      : null;
    const run = async () => {
      const specs = buildSlides(post.texts);
      if (!specs[si]) return;
      const seq = (redrawSeq.current[key] = (redrawSeq.current[key] ?? 0) + 1);
      const canvas = await renderSlide(
        specs[si], photoFor(pi, post, si), styleForSlide(style, post, specs[si].kind), logoRef.current, preset, 0.3,
        { index: si, total: specs.length, extras: si === 0 ? [1, 2, 3].map(k => photoFor(pi, post, k)) : undefined },
        focusRef.current[key], textFocusRef.current[key], subTextFocusRef.current[key],
        textScaleRef.current[key], subTextScaleRef.current[key],
      );
      if (redrawSeq.current[key] !== seq) return; // a newer change has been drawn since, keep that one
      setThumbs(prev => ({ ...prev, [key]: canvas.toDataURL("image/jpeg", 0.75) }));
    };
    if (active) {
      if (active.busy) { active.pending = true; return; }
      active.busy = true;
      try {
        do { active.pending = false; await run(); } while (active.pending);
      } finally { active.busy = false; }
    } else {
      await run();
    }
  }, [photoFor, style, preset]);

  const startDrag = (e: ReactPointerEvent<HTMLDivElement>, post: Post, pi: number, si: number, spec: SlideSpec) => {
    if (e.button !== 0) return;
    const photo = photoFor(pi, post, si);
    const slideStyle = styleForSlide(style, post, spec.kind);
    const dims = photo ? (spec.kind === "cover" && OCT_LAYOUTS.has(slideStyle.coverLayout) ? octDims.get(photo) : photoDims.get(photo)) : undefined;
    if (!photo || !dims) return;
    const area = photoArea(spec.kind, slideStyle);
    const key = `${post.id}:${si}`;
    const isOct = spec.kind === "cover" && OCT_LAYOUTS.has(slideStyle.coverLayout);
    const oz = Math.min(3, Math.max(1, focusRef.current[key]?.z ?? 1));
    const octBase = OCT_LOOKS[slideStyle.coverLayout]?.fit === "extend" ? W / dims.w : Math.max(W / dims.w, H / dims.h);
    const sc = isOct ? octBase * oz : Math.max(area.w / dims.w, area.h / dims.h) * PHOTO_OVERSCAN;
    const rect = e.currentTarget.getBoundingClientRect();
    dragRef.current = {
      key, pi, si, startX: e.clientX, startY: e.clientY,
      start: focusRef.current[key] ?? defaultPos(spec.kind, slideStyle),
      ox: isOct ? dims.w * sc - W : dims.w * sc - area.w, oy: isOct ? dims.h * sc - H : dims.h * sc - area.h,
      thumbScale: rect.width / W, busy: false, pending: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const moveDrag = (e: ReactPointerEvent<HTMLDivElement>, post: Post) => {
    const d = dragRef.current;
    if (!d || d.key !== `${post.id}:${d.si}`) return;
    const clamp = (v: number) => Math.min(100, Math.max(0, v));
    const dx = (e.clientX - d.startX) / d.thumbScale;
    const dy = (e.clientY - d.startY) / d.thumbScale;
    // Dragging the photo right shows more of its left side, so the focus moves the other way.
    const x = d.ox > 1 ? clamp(d.start.x - (dx / d.ox) * 100) : d.start.x;
    const y = d.oy > 1 ? clamp(d.start.y - (dy / d.oy) * 100) : d.start.y;
    if (x === d.start.x && y === d.start.y && !focusRef.current[d.key]) return;
    focusRef.current = { ...focusRef.current, [d.key]: { x, y, z: focusRef.current[d.key]?.z } };
    redrawOne(post, d.pi, d.si);
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    dragRef.current = null;
    bumpFocus(n => n + 1);
  };

  const resetPos = (post: Post, pi: number, si: number) => {
    const next = { ...focusRef.current };
    delete next[`${post.id}:${si}`];
    focusRef.current = next;
    bumpFocus(n => n + 1);
    redrawOne(post, pi, si);
  };

  // -- dragging the headline (and subtitle) to a different spot on the cover -----------

  const TEXT_DRAG_LIMIT = 340; // canvas px either side, so the words can move a long way but not off the slide

  const startTextDrag = (e: ReactPointerEvent<HTMLDivElement>, post: Post, pi: number, si: number) => {
    if (e.button !== 0) return;
    const key = `${post.id}:${si}`;
    const thumb = e.currentTarget.closest("[data-thumb]") as HTMLElement | null;
    const rect = (thumb ?? e.currentTarget).getBoundingClientRect();
    textDragRef.current = {
      key, pi, si, startX: e.clientX, startY: e.clientY,
      start: textFocusRef.current[key] ?? ZERO_TEXT_POS,
      thumbScale: rect.width / W, busy: false, pending: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  };

  const moveTextDrag = (e: ReactPointerEvent<HTMLDivElement>, post: Post) => {
    const d = textDragRef.current;
    if (!d || d.key !== `${post.id}:${d.si}`) return;
    const clamp = (v: number) => Math.min(TEXT_DRAG_LIMIT, Math.max(-TEXT_DRAG_LIMIT, v));
    const dx = clamp(d.start.dx + (e.clientX - d.startX) / d.thumbScale);
    const dy = clamp(d.start.dy + (e.clientY - d.startY) / d.thumbScale);
    if (dx === d.start.dx && dy === d.start.dy && !textFocusRef.current[d.key]) return;
    textFocusRef.current = { ...textFocusRef.current, [d.key]: { dx, dy } };
    redrawOne(post, d.pi, d.si);
    e.stopPropagation();
  };

  const endTextDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!textDragRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    textDragRef.current = null;
    bumpFocus(n => n + 1);
    e.stopPropagation();
  };

  // Puts the headline back to its usual spot and its usual size.
  const resetTextPos = (post: Post, pi: number, si: number) => {
    const key = `${post.id}:${si}`;
    const nextPos = { ...textFocusRef.current }; delete nextPos[key]; textFocusRef.current = nextPos;
    const nextScale = { ...textScaleRef.current }; delete nextScale[key]; textScaleRef.current = nextScale;
    bumpFocus(n => n + 1);
    redrawOne(post, pi, si);
  };

  // Same again, for the subtitle on its own - moves independently of the headline.
  const startSubTextDrag = (e: ReactPointerEvent<HTMLDivElement>, post: Post, pi: number, si: number) => {
    if (e.button !== 0) return;
    const key = `${post.id}:${si}`;
    const thumb = e.currentTarget.closest("[data-thumb]") as HTMLElement | null;
    const rect = (thumb ?? e.currentTarget).getBoundingClientRect();
    subTextDragRef.current = {
      key, pi, si, startX: e.clientX, startY: e.clientY,
      start: subTextFocusRef.current[key] ?? ZERO_TEXT_POS,
      thumbScale: rect.width / W, busy: false, pending: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  };

  const moveSubTextDrag = (e: ReactPointerEvent<HTMLDivElement>, post: Post) => {
    const d = subTextDragRef.current;
    if (!d || d.key !== `${post.id}:${d.si}`) return;
    const clamp = (v: number) => Math.min(TEXT_DRAG_LIMIT, Math.max(-TEXT_DRAG_LIMIT, v));
    const dx = clamp(d.start.dx + (e.clientX - d.startX) / d.thumbScale);
    const dy = clamp(d.start.dy + (e.clientY - d.startY) / d.thumbScale);
    if (dx === d.start.dx && dy === d.start.dy && !subTextFocusRef.current[d.key]) return;
    subTextFocusRef.current = { ...subTextFocusRef.current, [d.key]: { dx, dy } };
    redrawOne(post, d.pi, d.si);
    e.stopPropagation();
  };

  const endSubTextDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!subTextDragRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    subTextDragRef.current = null;
    bumpFocus(n => n + 1);
    e.stopPropagation();
  };

  // Puts the subtitle back to its usual spot and its usual size.
  const resetSubTextPos = (post: Post, pi: number, si: number) => {
    const key = `${post.id}:${si}`;
    const nextPos = { ...subTextFocusRef.current }; delete nextPos[key]; subTextFocusRef.current = nextPos;
    const nextScale = { ...subTextScaleRef.current }; delete nextScale[key]; subTextScaleRef.current = nextScale;
    bumpFocus(n => n + 1);
    redrawOne(post, pi, si);
  };

  // -- resizing the headline and subtitle ------------------------------------------

  const TEXT_SCALE_MIN = 0.5, TEXT_SCALE_MAX = 2.2;

  const startTextResize = (e: ReactPointerEvent<HTMLDivElement>, post: Post, pi: number, si: number) => {
    if (e.button !== 0) return;
    const key = `${post.id}:${si}`;
    const thumb = e.currentTarget.closest("[data-thumb]") as HTMLElement | null;
    const rect = (thumb ?? e.currentTarget).getBoundingClientRect();
    textResizeRef.current = {
      key, pi, si, startY: e.clientY, start: textScaleRef.current[key] ?? 1,
      thumbScale: rect.width / W, busy: false, pending: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  };

  const moveTextResize = (e: ReactPointerEvent<HTMLDivElement>, post: Post) => {
    const d = textResizeRef.current;
    if (!d || d.key !== `${post.id}:${d.si}`) return;
    // Dragging up makes it bigger, dragging down makes it smaller.
    const scale = Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, d.start - (e.clientY - d.startY) / (d.thumbScale * 220)));
    if (scale === d.start && !textScaleRef.current[d.key]) return;
    textScaleRef.current = { ...textScaleRef.current, [d.key]: scale };
    redrawOne(post, d.pi, d.si);
    e.stopPropagation();
  };

  const endTextResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!textResizeRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    textResizeRef.current = null;
    bumpFocus(n => n + 1);
    e.stopPropagation();
  };

  const resetTextScale = (post: Post, pi: number, si: number) => {
    const next = { ...textScaleRef.current };
    delete next[`${post.id}:${si}`];
    textScaleRef.current = next;
    bumpFocus(n => n + 1);
    redrawOne(post, pi, si);
  };

  // Same again, for the subtitle's own size.
  const startSubTextResize = (e: ReactPointerEvent<HTMLDivElement>, post: Post, pi: number, si: number) => {
    if (e.button !== 0) return;
    const key = `${post.id}:${si}`;
    const thumb = e.currentTarget.closest("[data-thumb]") as HTMLElement | null;
    const rect = (thumb ?? e.currentTarget).getBoundingClientRect();
    subTextResizeRef.current = {
      key, pi, si, startY: e.clientY, start: subTextScaleRef.current[key] ?? 1,
      thumbScale: rect.width / W, busy: false, pending: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  };

  const moveSubTextResize = (e: ReactPointerEvent<HTMLDivElement>, post: Post) => {
    const d = subTextResizeRef.current;
    if (!d || d.key !== `${post.id}:${d.si}`) return;
    const scale = Math.min(TEXT_SCALE_MAX, Math.max(TEXT_SCALE_MIN, d.start - (e.clientY - d.startY) / (d.thumbScale * 220)));
    if (scale === d.start && !subTextScaleRef.current[d.key]) return;
    subTextScaleRef.current = { ...subTextScaleRef.current, [d.key]: scale };
    redrawOne(post, d.pi, d.si);
    e.stopPropagation();
  };

  const endSubTextResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!subTextResizeRef.current) return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    subTextResizeRef.current = null;
    bumpFocus(n => n + 1);
    e.stopPropagation();
  };

  const resetSubTextScale = (post: Post, pi: number, si: number) => {
    const next = { ...subTextScaleRef.current };
    delete next[`${post.id}:${si}`];
    subTextScaleRef.current = next;
    bumpFocus(n => n + 1);
    redrawOne(post, pi, si);
  };

  // -- choosing a cover for each post ----------------------------------------------

  const setCover = (post: Post, pi: number, cover: CoverLayout | undefined) => {
    if (post.cover === cover) return;
    updatePost(post.id, { cover });
    warmFonts({ ...style, ...COVER_PRESETS[cover ?? style.coverLayout] } as Style).then(() => redrawOne({ ...post, cover }, pi, 0));
  };

  // Gives every post a different cover option, going round all the options in turn.
  const mixCovers = () => {
    setPosts(list => list.map((p, i) => ({ ...p, cover: COVER_ORDER[i % COVER_ORDER.length] })));
    setCoverVersion(v => v + 1);
  };

  // Colour picked for one post's cover text. Empty puts it back to the option's own colour.
  const setCoverColours = (post: Post, pi: number, patchColours: Partial<Pick<Post, "coverColour" | "coverSubColour" | "coverBlockColour" | "coverBandColour" | "coverSpot">>) => {
    updatePost(post.id, patchColours);
    redrawOne({ ...post, ...patchColours }, pi, 0);
  };

  // A font picked for one post's cover. Empty follows the client's font again.
  const setCoverFonts = (post: Post, pi: number, patchFonts: Partial<Pick<Post, "coverFont" | "coverSubFont">>) => {
    updatePost(post.id, patchFonts);
    redrawOne({ ...post, ...patchFonts }, pi, 0);
  };

  // Curve, letter spacing and line spacing for one post's headline.
  const setCoverText = (post: Post, pi: number, patchText: Partial<Pick<Post, "coverCurve" | "coverTracking" | "coverLeading">>) => {
    updatePost(post.id, patchText);
    redrawOne({ ...post, ...patchText }, pi, 0);
  };

  // Curly letters: each click on a letter moves it to the font's next alternate, then back to the plain letter.
  const cycleLetter = (post: Post, pi: number, index: number, count: number) => {
    const cur = { ...(post.coverAlts ?? {}) };
    const next = ((cur[index] ?? 0) + 1) % (count + 1);
    if (next === 0) delete cur[index]; else cur[index] = next;
    const value = Object.keys(cur).length ? cur : undefined;
    updatePost(post.id, { coverAlts: value });
    redrawOne({ ...post, coverAlts: value }, pi, 0);
  };

  const setCoverCaps = (post: Post, pi: number, caps: boolean | undefined) => {
    updatePost(post.id, { coverCaps: caps });
    redrawOne({ ...post, coverCaps: caps }, pi, 0);
  };
  const changeAllCaps = (caps: boolean) => {
    setPosts(list => list.map(p => ({ ...p, coverCaps: caps })));
    setCoverVersion(v => v + 1);
    toast.success(caps ? "Capitals on every headline" : "Capitals off on every headline");
  };

  // Uses one font on every cover in this batch and clears the fonts set on single posts.
  // It is not saved to the client; the Client fonts section above does that.
  const changeAllFonts = (which: "head" | "sub", font: string) => {
    patch(which === "head" ? { clientCoverFont: font } : { clientCoverSubFont: font });
    setPosts(list => list.map(p => ({ ...p, ...(which === "head" ? { coverFont: undefined } : { coverSubFont: undefined }) })));
    setCoverVersion(v => v + 1);
    toast.success(which === "head" ? "Headline font changed on every cover" : "Subtitle font changed on every cover");
  };

  // Puts one set of colours - headline, subtitle, and the block/band colour behind them - on
  // every post's cover, and clears any colours set on single posts.
  const changeAllText = (head: string, subtitleColour: string, blockColour: string, bandColour: string) => {
    patch({ cvAll: true, cvAllColour: head, cvAllSubColour: subtitleColour, cvBlock: blockColour, cvBand: bandColour, cvBlockAll: blockColour, cvBandAll: bandColour });
    setPosts(list => list.map(p => ({ ...p, coverColour: undefined, coverSubColour: undefined, coverBlockColour: undefined, coverBandColour: undefined })));
    setCoverVersion(v => v + 1);
    toast.success("Colours changed on every cover");
  };

  // Puts one block (or band) colour on every cover and clears any set on individual posts,
  // without touching headline/subtitle colours.
  const changeAllBlocks = (blockColour: string) => {
    patch({ cvBlock: blockColour, cvBlockAll: blockColour });
    setPosts(list => list.map(p => ({ ...p, coverBlockColour: undefined })));
    setCoverVersion(v => v + 1);
    toast.success("Block colour changed on every cover");
  };
  const changeAllBands = (bandColour: string) => {
    patch({ cvBand: bandColour, cvBandAll: bandColour });
    setPosts(list => list.map(p => ({ ...p, coverBandColour: undefined })));
    setCoverVersion(v => v + 1);
    toast.success("Band colour changed on every cover");
  };

  const sameCovers = () => {
    setPosts(list => list.map(p => ({ ...p, cover: undefined, coverColour: undefined, coverSubColour: undefined, coverBlockColour: undefined, coverBandColour: undefined, coverFont: undefined, coverSubFont: undefined, coverAlts: undefined, coverCaps: undefined, coverCurve: undefined, coverTracking: undefined, coverLeading: undefined })));
    setCoverVersion(v => v + 1);
  };

  // -- post helpers ----------------------------------------------------------

  const deletePost = (id: string) => {
    setPosts(list => list.filter(x => x.id !== id));
    setOverrides(o => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith(`${id}:`))));
    delete focusRef.current[id];
    for (const k of Object.keys(focusRef.current)) if (k.startsWith(`${id}:`)) delete focusRef.current[k];
    setConfirmDelete(null);
    toast.success("Post deleted");
  };

  const updatePost = (id: string, p: Partial<Post>) =>
    setPosts(list => list.map(x => (x.id === id ? { ...x, ...p } : x)));

  const setText = (id: string, col: number, value: string) =>
    setPosts(list => list.map(x => (x.id === id ? { ...x, texts: x.texts.map((t, i) => (i === col ? value : t)) } : x)));

  const selectedPosts = posts.filter(p => p.selected);

  // -- captions ----------------------------------------------------------------

  const generateCaption = useCallback(async (post: Post, asReel = false): Promise<string | null> => {
    const specs = buildSlides(post.texts);
    const context =
      `${asReel ? `An Instagram reel that plays these ${specs.length} slides one after another, so the caption should make people stay to the end` : `An Instagram carousel of ${specs.length} slides`}. The slide text, in order:\n` +
      specs.map((s, i) => `${i + 1}. ${s.text}${s.sub ? ` (${s.sub})` : ""}`).join("\n") +
      `\nThe last slide is the call to action. Write a caption that adds something the slides do not already say, ` +
      `and finish with a friendly, low pressure invitation that fits the last slide. ` +
      `Write the whole caption in the first person, as the clinician or clinic owner speaking directly to the reader ` +
      `(I, me, my, and we or our when speaking for the clinic). Never write about "the clinic", "the team" or "she" as an outsider. ` +
      `Use UK spelling. Never use em dashes or en dashes anywhere in the caption.`;
    const res = await fetch(`${BASE}/api/caption-generator/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tone, context, clinicName: preset?.name, location: area.trim() || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.caption) throw new Error(data.error || "Caption generation failed");
    let caption: string = noDashes(data.caption);
    const footnote = preset?.captionFootnote?.trim();
    if (footnote && !caption.includes(footnote)) caption += `\n\n${footnote}`;
    return caption;
  }, [tone, preset, area]);

  const handleCaptionOne = async (post: Post) => {
    updatePost(post.id, { captionBusy: true });
    try {
      const caption = await generateCaption(post);
      if (caption) updatePost(post.id, { caption });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Caption generation failed");
    } finally {
      updatePost(post.id, { captionBusy: false });
    }
  };

  const handleCaptionAll = async () => {
    const targets = postsRef.current.filter(p => p.selected);
    if (!targets.length) { toast.error("Tick at least one post first"); return; }
    setCaptionAllBusy(true);
    let done = 0;
    const toastId = toast.loading(`Writing captions 0/${targets.length}`);
    try {
      const queue = [...targets];
      const worker = async () => {
        while (queue.length) {
          const post = queue.shift()!;
          try {
            const caption = await generateCaption(post);
            if (caption) updatePost(post.id, { caption });
          } catch { /* one failure should not stop the rest */ }
          done++;
          toast.loading(`Writing captions ${done}/${targets.length}`, { id: toastId });
        }
      };
      await Promise.all([worker(), worker()]);
      toast.success(`Captions written for ${targets.length} post${targets.length !== 1 ? "s" : ""}`, { id: toastId });
    } finally {
      setCaptionAllBusy(false);
    }
  };

  // -- export ------------------------------------------------------------------

  const renderPostCanvases = async (postIndex: number, post: Post, logo: HTMLImageElement | null) => {
    const specs = buildSlides(post.texts);
    const out: HTMLCanvasElement[] = [];
    for (let si = 0; si < specs.length; si++) {
      out.push(await renderSlide(specs[si], photoFor(postIndex, post, si), styleForSlide(style, post, specs[si].kind), logo, preset, 1, { index: si, total: specs.length, extras: si === 0 ? [1, 2, 3].map(k => photoFor(postIndex, post, k)) : undefined }, focusRef.current[`${post.id}:${si}`]));
    }
    return out;
  };

  const handleDownload = async () => {
    if (!selectedPosts.length) { toast.error("Tick at least one post first"); return; }
    setExporting("Starting");
    try {
      await warmAll();
      const logo = style.showLogo ? await loadLogo(preset) : null;
      const zip = new JSZip();
      const captionRows: string[][] = [["post", "caption"]];
      let n = 0;
      for (const post of selectedPosts) {
        n++;
        const pi = posts.indexOf(post);
        setExporting(`Rendering post ${n} of ${selectedPosts.length}`);
        const canvases = await renderPostCanvases(pi, post, logo);
        const folder = `post-${String(pi + 1).padStart(2, "0")}`;
        for (let si = 0; si < canvases.length; si++) {
          const blob = await new Promise<Blob | null>(res => canvases[si].toBlob(b => res(b), "image/png"));
          if (blob) zip.file(`${folder}/slide-${si + 1}.png`, blob);
        }
        if (post.caption.trim()) zip.file(`${folder}/caption.txt`, noDashes(post.caption.trim()));
        captionRows.push([folder, noDashes(post.caption.trim())]);
        await tick();
      }
      zip.file("captions.csv", Papa.unparse(captionRows));
      setExporting("Zipping");
      const blob = await zip.generateAsync({ type: "blob" });
      saveAs(blob, `stylish-${Date.now()}.zip`);
      toast.success(`${selectedPosts.length} post${selectedPosts.length !== 1 ? "s" : ""} downloaded at 1080 x 1440`);
      if (preset?.name) {
        setExporting("Saving their photos to the client library");
        await savePhotosToClientLibrary(images, preset.name);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  // -- scheduling --------------------------------------------------------------

  // Sends slide 1 of each ticked post (up to five) to Magazine Flip, named Clientname-Preview there.
  const handleSendToFlip = async () => {
    if (!selectedPosts.length) { toast.error("Tick at least one post first"); return; }
    setSendingFlip(true);
    try {
      await warmAll();
      const logo = style.showLogo ? await loadLogo(preset) : null;
      const chosen = selectedPosts.slice(0, 16);
      const canvases: HTMLCanvasElement[] = [];
      for (const post of chosen) {
        const pi = posts.indexOf(post);
        const specs = buildSlides(post.texts);
        canvases.push(await renderSlide(specs[0], photoFor(pi, post, 0), styleForSlide(style, post, specs[0].kind), logo, preset, 1, { index: 0, total: specs.length, extras: [1, 2, 3].map(k => photoFor(pi, post, k)) }, focusRef.current[`${post.id}:0`]));
        await tick();
      }
      await setFlipHandoff({ canvases, clientName: preset?.name || "" });
      if (selectedPosts.length > 16) toast.message(`Magazine Flip holds 16 pages, so I sent the first 16 of your ${selectedPosts.length} ticked posts`);
      // Opens in its own tab rather than navigating away, so this page - ticks, captions, the
      // Schedule button - is exactly as she left it when she comes back to it.
      window.open("/magazine", "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send to Magazine Flip");
    } finally {
      setSendingFlip(false);
    }
  };

  // One post's own slides go to Magazine Flip as its pages, with the caption and area travelling
  // too, so it can be shared from there as a reel or a trial reel.
  const handleSendPostToFlip = async (post: Post) => {
    setSendingFlip(true);
    try {
      await warmAll();
      const logo = style.showLogo ? await loadLogo(preset) : null;
      const pi = posts.indexOf(post);
      const canvases = await renderPostCanvases(pi, post, logo);
      if (canvases.length < 4) { toast.error("Magazine Flip needs at least 4 slides in a post"); return; }
      await setFlipHandoff({ canvases: canvases.slice(0, 16), clientName: preset?.name || "", caption: post.caption.trim() || undefined, location: area.trim() || undefined, title: buildSlides(post.texts)[0]?.text });
      window.open("/magazine", "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send to Magazine Flip");
    } finally {
      setSendingFlip(false);
    }
  };

  const handleSchedule = async (mode: "carousel" | "reel" = "carousel") => {
    if (!selectedPosts.length) { toast.error("Tick at least one post first"); return; }
    if (!preset) { toast.error("Choose a client first so I know whose account to schedule to"); return; }
    setScheduling("Starting");
    try {
      await warmAll();
      const logo = style.showLogo ? await loadLogo(preset) : null;
      const items: SchedulePostPayload[] = [];
      let n = 0;
      for (const post of selectedPosts) {
        n++;
        const pi = posts.indexOf(post);
        setScheduling(`Uploading post ${n} of ${selectedPosts.length}`);
        // One slide at a time: render, upload, then free the canvas straight away so the tab never
        // holds a whole post (or several posts) of full size images in memory.
        const specs = buildSlides(post.texts);
        const urls: string[] = [];
        const reelForm = new FormData();
        for (let si = 0; si < specs.length; si++) {
          setScheduling(`${mode === "reel" ? "Building reel" : "Uploading post"} ${n} of ${selectedPosts.length} (slide ${si + 1} of ${specs.length})`);
          const canvas = await renderSlide(specs[si], photoFor(pi, post, si), styleForSlide(style, post, specs[si].kind), logo, preset, 1, { index: si, total: specs.length, extras: si === 0 ? [1, 2, 3].map(k => photoFor(pi, post, k)) : undefined }, focusRef.current[`${post.id}:${si}`]);
          if (mode === "reel") {
            const blob: Blob | null = await new Promise(r => canvas.toBlob(r, "image/png"));
            canvas.width = 0; canvas.height = 0;
            if (!blob) throw new Error("Could not render a slide");
            reelForm.append("slides", blob, `slide-${si + 1}.png`);
            await tick();
            continue;
          }
          let dataUrl: string | null = canvas.toDataURL("image/png");
          canvas.width = 0; canvas.height = 0;
          const name = `stylish-${pi + 1}-slide-${si + 1}.png`;
          let got: string[] | null = null;
          for (let attempt = 0; attempt < 3 && !got; attempt++) {
            try { got = await uploadPngs([dataUrl], [name]); }
            catch (e) { if (attempt === 2) throw e; await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); }
          }
          dataUrl = null;
          urls.push(...(got ?? []));
          await tick();
        }
        let videoUrl: string | undefined;
        if (mode === "reel") {
          setScheduling(`Making reel ${n} of ${selectedPosts.length}`);
          reelForm.append("secondsPerSlide", "2.5");
          const rr = await fetch(`${BASE}/api/stylish-reel`, { method: "POST", body: reelForm });
          const rd = await rr.json().catch(() => ({}));
          if (!rr.ok || !rd.videoUrl) throw new Error(rd.error || "Could not make the reel");
          videoUrl = rd.videoUrl as string;
        }
        // Captions are written here if a post does not have one yet, so nothing is scheduled blank.
        let caption = post.caption.trim();
        if (!caption) {
          setScheduling(`Writing caption ${n} of ${selectedPosts.length}`);
          try {
            caption = (await generateCaption(post, mode === "reel")) ?? "";
            if (caption) updatePost(post.id, { caption });
          } catch { /* the caption can still be written in the schedule screen */ }
        }
        items.push({
          title: `${buildSlides(post.texts)[0]?.text ?? `Post ${pi + 1}`} · ${preset.name}`,
          caption: noDashes(caption),
          ...(mode === "reel" ? { videoUrl } : { imageUrls: urls }),
        });
      }
      // A story for each post, asking a question about it. It goes out at 7am on the post's day.
      let stories: { imageUrl: string; title: string }[] | undefined;
      if (withStories) {
        setScheduling("Writing the story questions");
        const qr = await fetch(`${BASE}/api/stylish-story/questions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tone: "3",
            area: area.trim() || undefined,
            clinicName: preset.name,
            posts: selectedPosts.map(p => ({ slides: buildSlides(p.texts).map(s => s.text) })),
          }),
        });
        const qd = await qr.json().catch(() => ({}));
        if (!qr.ok || !Array.isArray(qd.questions)) throw new Error(qd.error || "Could not write the story questions");
        stories = [];
        for (let k = 0; k < selectedPosts.length; k++) {
          const post = selectedPosts[k];
          const pi = posts.indexOf(post);
          setScheduling(`Making story ${k + 1} of ${selectedPosts.length}`);
          const canvas = await renderStory(String(qd.questions[k]), photoFor(pi, post, 0), style, preset);
          let dataUrl: string | null = canvas.toDataURL("image/png");
          canvas.width = 0; canvas.height = 0;
          let got: string[] | null = null;
          for (let attempt = 0; attempt < 3 && !got; attempt++) {
            try { got = await uploadPngs([dataUrl], [`stylish-${pi + 1}-story.png`]); }
            catch (e) { if (attempt === 2) throw e; await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); }
          }
          dataUrl = null;
          if (!got?.[0]) throw new Error("A story would not upload");
          stories.push({ imageUrl: got[0], title: `${buildSlides(post.texts)[0]?.text ?? `Post ${pi + 1}`} · ${preset.name}` });
          await tick();
        }
      }
      setScheduleStories(stories);
      void savePhotosToClientLibrary(images, preset.name);
      // First post on the next Monday, Wednesday, Friday or Sunday at 6.15pm, then one on each
      // posting day after that (the schedule screen does the stepping).
      const start = new Date();
      start.setHours(18, 15, 0, 0);
      if (start.getTime() <= Date.now() + 5 * 60000) start.setDate(start.getDate() + 1);
      const first = nthPostingSlot(start, 0);
      first.setMinutes(first.getMinutes() - first.getTimezoneOffset());
      setScheduleStart(first.toISOString().slice(0, 16));
      setScheduleMode(mode);
      setScheduleItems(items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setScheduling(null);
    }
  };

  const handleScheduleRef = useRef(handleSchedule);
  handleScheduleRef.current = handleSchedule;

  const useClientLook = () => {
    if (!preset) { toast.error("Choose a client first"); return; }
    patch({
      displayFont: preset.fontFamily || style.displayFont,
      lineColour: preset.accentColor || style.lineColour,
      cvBand: preset.accentColor || style.cvBand,
      cvColour: style.coverLayout === "centred" ? (preset.accentColor || style.cvColour) : style.cvColour,
      bodyColour: preset.textColor || style.bodyColour,
      ctaColour: preset.textColor || style.ctaColour,
      showLogo: !!preset.logoUrl,
    });
    toast.success(`Style matched to ${preset.name}`);
  };

  // -- checks shown to the user ------------------------------------------------

  const expectedImages = posts.length * perPost;
  const maxSlides = slideCounts.length ? Math.max(...slideCounts) : 0;

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border/30 py-4 px-6 flex items-center gap-3">
        <Link href="/hub">
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            All Tools
          </button>
        </Link>
        <span className="text-border/60">·</span>
        <h1 className="font-semibold text-sm">Stylish</h1>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid gap-8 lg:grid-cols-[340px_1fr]">

        {/* ------------------------------ left: setup and style ------------------------------ */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto pr-1">
          <div>
            <h2 className="text-2xl font-bold mb-1">Stylish</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Full bleed photo carousels. One CSV row is one post, and each post takes its photos in order.
            </p>
          </div>

          <section className="space-y-2">
            <Label className="text-sm font-medium">Choose client name (business)</Label>
            <Select value={presetId ? String(presetId) : ""} onValueChange={v => chooseClient(Number(v))}>
              <SelectTrigger className="bg-muted/30 border-border/40">
                <SelectValue placeholder={presetsLoading ? "Loading…" : "Choose a client"} />
              </SelectTrigger>
              <SelectContent>
                {presets.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Needed for captions in their name, the logo and scheduling. Not needed to preview or download.
            </p>
            <Button variant="outline" size="sm" onClick={useClientLook} disabled={!preset} className="w-full">
              <Palette className="w-4 h-4 mr-1.5" />Match this client's fonts and colours
            </Button>
          </section>

          <section className="space-y-2">
            <Label className="text-sm font-medium">Photos</Label>
            <div
              onDrop={e => { e.preventDefault(); setImgDrag(false); handleImages(Array.from(e.dataTransfer.files)); }}
              onDragOver={e => { e.preventDefault(); setImgDrag(true); }}
              onDragLeave={() => setImgDrag(false)}
              onClick={() => imgInputRef.current?.click()}
              className={[
                "border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors select-none text-center",
                imgDrag ? "border-amber-500/60 bg-amber-500/5" : images.length ? "border-amber-500/40 bg-amber-500/5" : "border-border/40 hover:border-border/60",
              ].join(" ")}
            >
              {images.length ? (
                <>
                  <CheckCircle2 className="w-7 h-7 text-amber-400" />
                  <p className="text-sm font-medium text-amber-400">{images.length} photo{images.length !== 1 ? "s" : ""} loaded</p>
                  <p className="text-xs text-muted-foreground">Click to replace them all, or add approved photos below</p>
                </>
              ) : (
                <>
                  <ImageIcon className="w-7 h-7 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop photos here or click to browse</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Put them in order by file name. Photos 1 to {perPost} go to post 1, the next {perPost} to post 2, and so on.
                  </p>
                </>
              )}
            </div>
            <input
              ref={imgInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) handleImages(f); e.target.value = ""; }}
            />
            <ApprovedImagesPicker
              clientName={preset?.name || ""}
              mode="multi"
              skipBackgroundRemoval
              large
              label="Add approved photos"
              onAddImages={addApproved}
            />
            {images.length > 0 && (
              <button
                type="button"
                onClick={() => { setImages([]); setOverrides({}); focusRef.current = {}; }}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Clear all photos
              </button>
            )}
            <div className="flex items-center justify-between gap-3">
              <Label className="text-xs text-muted-foreground">Photos per post</Label>
              <input
                type="number" min={1} max={10} value={perPost}
                onChange={e => setPerPost(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                className="w-16 h-8 rounded bg-muted/30 border border-border/40 px-2 text-sm"
              />
            </div>
            <label className="flex items-start gap-2 text-sm leading-snug">
              <input
                type="checkbox" checked={reusePhotos}
                onChange={e => { setReusePhotos(e.target.checked); focusRef.current = {}; }}
                className="accent-sky-500 mt-0.5"
              />
              <span>
                Reuse my photos to fill every slide
                <span className="block text-xs text-muted-foreground">
                  Only kicks in when you have fewer photos than slides. Each post gets different photos, and slide 1 is a new photo each time until they have all been used.
                </span>
              </span>
            </label>
          </section>

          <section className="space-y-2">
            <Label className="text-sm font-medium">CSV</Label>
            <div
              onDrop={e => { e.preventDefault(); setCsvDrag(false); const f = e.dataTransfer.files[0]; if (f) parseCsv(f); }}
              onDragOver={e => { e.preventDefault(); setCsvDrag(true); }}
              onDragLeave={() => setCsvDrag(false)}
              onClick={() => csvInputRef.current?.click()}
              className={[
                "border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors select-none text-center",
                csvDrag ? "border-sky-500/60 bg-sky-500/5" : csvName ? "border-sky-500/40 bg-sky-500/5" : "border-border/40 hover:border-border/60",
              ].join(" ")}
            >
              {csvName ? (
                <>
                  <CheckCircle2 className="w-7 h-7 text-sky-400" />
                  <p className="text-sm font-medium text-sky-400 break-all">{csvName}</p>
                  <p className="text-xs text-muted-foreground">{posts.length} post{posts.length !== 1 ? "s" : ""}. Click to replace.</p>
                </>
              ) : (
                <>
                  <FileText className="w-7 h-7 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop CSV here or click to browse</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Columns: headline, subtitle, then as many text columns as you need. The last column is always the CTA.
                  </p>
                </>
              )}
            </div>
            <input
              ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) parseCsv(f); e.target.value = ""; }}
            />
            {csvError && <p className="text-xs text-destructive">{csvError}</p>}
            <button onClick={downloadSample} className="text-xs text-sky-400 hover:underline">Download a sample CSV</button>
          </section>

          <section className="space-y-2 border-t border-border/30 pt-5">
            <Label className="text-sm font-medium">Client fonts</Label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Their own headline and subtitle font, bought and added here or under "Your fonts" below. Once set,
              these save straight to this client's profile — not just this browser — and show on the cover of
              every post, whichever cover option that post uses. Everything else about each cover,
              and every other slide, stays as it is.
            </p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Headline font</Label>
                <button type="button" onClick={() => headlineFontInputRef.current?.click()} className="text-xs text-sky-400 hover:underline">Upload a font file</button>
              </div>
              <input
                ref={headlineFontInputRef} type="file" accept=".otf,.ttf,.woff,.woff2" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadClientFont("head", f); e.target.value = ""; }}
              />
              <Select value={style.clientCoverFont || "__none"} onValueChange={v => setClientCoverFont("head", v)}>
                <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none">Use each cover's own font</SelectItem>
                  {fontItems(coverFontOptions)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">Subtitle font</Label>
                <button type="button" onClick={() => subtitleFontInputRef.current?.click()} className="text-xs text-sky-400 hover:underline">Upload a font file</button>
              </div>
              <input
                ref={subtitleFontInputRef} type="file" accept=".otf,.ttf,.woff,.woff2" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadClientFont("sub", f); e.target.value = ""; }}
              />
              <Select value={style.clientCoverSubFont || "__none"} onValueChange={v => setClientCoverFont("sub", v)}>
                <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__none">Use each cover's own font</SelectItem>
                  {fontItems(coverFontOptions)}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-4 border-t border-border/30 pt-5">
            <h3 className="text-sm font-semibold">Slide 1: cover</h3>
            <div className="grid grid-cols-4 gap-1.5">
              {COVER_ORDER.map((k, i) => (
                <button
                  key={k} type="button"
                  onClick={() => patch(TEXTURES[style.cvBlock] ? { ...COVER_PRESETS[k], cvBlock: style.cvBlock } : COVER_PRESETS[k])}
                  className={["rounded-lg border p-1.5 flex flex-col items-center gap-1 transition-colors", style.coverLayout === k ? "border-sky-500 bg-sky-500/10" : "border-border/40 hover:border-border/70"].join(" ")}
                  aria-label={`Cover option ${i + 1}`}
                >
                  <CoverIcon k={k} />
                  <span className="text-[18px] text-muted-foreground">Option {i + 1}</span>
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-[18px] font-semibold uppercase tracking-wide text-muted-foreground">October 26</p>
              <div className="grid grid-cols-3 gap-1.5">
                {OCT_ORDER.map(k => (
                  <button
                    key={k} type="button"
                    onClick={() => { patch(COVER_PRESETS[k]); if (!posts.length) toast.message(`October 26 No. ${k.replace("oct", "")} chosen. Add your photos and your CSV and every post will use it. You can change it per post after that.`); }}
                    className={["rounded-lg border px-1.5 py-2 text-left transition-colors", style.coverLayout === k ? "border-sky-500 bg-sky-500/10" : "border-border/40 hover:border-border/70"].join(" ")}
                    aria-label={`October 26 cover ${OCT_NAMES[k]}`}
                  >
                    <span className="block text-[18px] text-muted-foreground">No. {k.replace("oct", "")}</span>
                    <span className="block text-[18px] leading-tight">{OCT_NAMES[k]}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {OCT_HELP[style.coverLayout]}
              {style.coverLayout === "band" && "Photo fills the slide with a thick colour band along the bottom."}
              {style.coverLayout === "centred" && "Full photo with the headline and subtitle centred in the middle."}
              {style.coverLayout === "block" && "Photo across the top with a big bold headline on a colour block."}
              {style.coverLayout === "split" && "Photo on the left, colour block on the right with the headline."}
              {style.coverLayout === "serif" && "Full photo with a big serif headline and subtitle along the bottom."}
              {style.coverLayout === "behind" && "Big heading behind the person in your photo. The person is cut out of the photo automatically, in your browser, the first time."}
              {style.coverLayout === "fullbleed" && "Full photo with a big stacked headline top left and the subtitle low down."}
              {style.coverLayout === "blur" && "Your photo smeared sideways like a long exposure, with the headline and subtitle in the middle."}
              {style.coverLayout === "strip" && "A big photo, a dark strip of three small photos, and a colour band with the words. Uses this post's next three photos."}
              {style.coverLayout === "diagonal" && "Full photo with the headline set on a slant."}
              {style.coverLayout === "behind2" && "Heading behind a cut out person, with the subtitle on the left."}
              {style.coverLayout === "polaroid" && "Your photo in a print in the middle of a colour background, held by a clip, with a second card behind."}
              {style.coverLayout === "sidebar" && "Full photo with a colour band down the side carrying the words."}
              {style.coverLayout === "frame" && "Photo behind, a panel on top with two photos and two blocks of words on the diagonal. Uses this post's next two photos."}
              {style.coverLayout === "layered" && "One photo at the back, a print at the front and a card below with the words."}
              {style.coverLayout === "plain" && "No photo. A flat colour of your choice with your own headline and subheading fonts."}
              {" "}Picking one loads its fonts and colours, then change whatever you like.
            </p>
            {missingFonts.length > 0 && (
              <p className="text-xs text-amber-500/90 bg-amber-500/5 border border-amber-500/30 rounded-lg px-3 py-2 leading-relaxed">
                This cover is designed around {missingFonts.join(" and ")}. Add your copy of the font below and it takes over.
                Until then I use a close match.
              </p>
            )}
            <div className="space-y-2 rounded-lg border border-border/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-medium">Your fonts</Label>
                <button type="button" onClick={() => fontInputRef.current?.click()} className="text-xs text-sky-400 hover:underline">Add font files</button>
              </div>
              <input
                ref={fontInputRef} type="file" multiple accept=".otf,.ttf,.woff,.woff2" className="hidden"
                onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) addFonts(f); e.target.value = ""; }}
              />
              {customFonts.length === 0 ? (
                <p className="text-[18px] text-muted-foreground leading-relaxed">
                  Add .otf, .ttf or .woff2 files, for example Helvetica Now Display, Breul Grotesk, Now or Evolventa. Add each weight you use (regular and bold).
                  They stay in this browser on this computer and are not uploaded anywhere.
                </p>
              ) : (
                <ul className="space-y-1">
                  {customFonts.map(f => (
                    <li key={f.file} className="flex items-center justify-between gap-2 text-[18px]">
                      <span className="truncate" style={{ fontFamily: `'${f.family}', sans-serif` }}>{f.file}</span>
                      <button type="button" onClick={() => removeFont(f.file)} className="text-muted-foreground hover:text-destructive shrink-0">remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {(style.clientCoverFont || style.clientCoverSubFont) && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                This client's own fonts (set above, under "Client fonts") are showing on every cover instead of the
                choices below. Clear them there to pick a font per option again.
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{coverNo > 5 ? `Headline font (option ${coverNo})` : "Headline font"}</Label>
              <Select value={coverDefaultFaces(style, style.coverLayout)[0]} onValueChange={v => setFace(0, v)}>
                <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {fontItems(coverFontOptions)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{coverNo > 5 ? `Subheading font (option ${coverNo})` : "Subtitle font"}</Label>
              <Select value={coverDefaultFaces(style, style.coverLayout)[1]} onValueChange={v => setFace(1, v)}>
                <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {fontItems(coverFontOptions)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Headline weight</Label>
                <Select value={String(style.cvWeight)} onValueChange={v => patch({ cvWeight: Number(v) })}>
                  <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{COVER_WEIGHTS.map(w => <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Subtitle weight</Label>
                <Select value={String(style.cvSubWeight)} onValueChange={v => patch({ cvSubWeight: Number(v) })}>
                  <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{COVER_WEIGHTS.map(w => <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <SliderField label="Headline size (shrinks to fit)" value={style.cvSize} min={60} max={380} step={2} suffix="px" onChange={v => patch({ cvSize: v })} />
            <SliderField label="Subtitle size" value={style.cvSubSize} min={20} max={100} suffix="px" onChange={v => patch({ cvSubSize: v })} />
            <SliderField label="Headline letter spacing" value={style.cvTracking} min={-12} max={12} step={0.5} suffix="px" onChange={v => patch({ cvTracking: v })} />
            <SliderField label="Subtitle letter spacing" value={style.cvSubTracking} min={-8} max={12} step={0.5} suffix="px" onChange={v => patch({ cvSubTracking: v })} />
            {(style.coverLayout === "band" || style.coverLayout === "block" || style.coverLayout === "split") && (
              <>
                <SliderField
                  label={style.coverLayout === "split" ? "Photo width" : "Photo height"}
                  value={style.cvPhoto} min={style.coverLayout === "split" ? 25 : 20} max={style.coverLayout === "split" ? 75 : 85} step={0.5} suffix="%"
                  onChange={v => patch({ cvPhoto: v })}
                />
                <SliderField
                  label={style.coverLayout === "split" ? "Photo focus (left to right)" : "Photo focus (top to bottom)"}
                  value={style.cvFocus} min={0} max={100} suffix="%" onChange={v => patch({ cvFocus: v })}
                />
              </>
            )}
            {["centred", "serif", "behind", "behind2", "fullbleed", "blur", "diagonal", "sidebar"].includes(style.coverLayout) && (
              <SliderField label={style.coverLayout === "serif" ? "Text bottom edge" : "Text height"} value={style.cvY} min={5} max={96} suffix="%" onChange={v => patch({ cvY: v })} />
            )}
            {style.coverLayout === "blur" && (
              <SliderField label="Motion blur" value={style.cvBlur} min={0} max={240} suffix="px" onChange={v => patch({ cvBlur: v })} />
            )}
            {style.coverLayout === "diagonal" && (
              <SliderField label="Headline angle" value={style.cvAngle} min={-60} max={60} suffix="°" onChange={v => patch({ cvAngle: v })} />
            )}
            {style.coverLayout === "sidebar" && (
              <SliderField label="Band width" value={style.cvPhoto} min={25} max={80} suffix="%" onChange={v => patch({ cvPhoto: v })} />
            )}
            {["fullbleed", "blur", "diagonal", "layered"].includes(style.coverLayout) && (
              <SliderField label="Darken the photo" value={style.cvScrim} min={0} max={70} suffix="%" onChange={v => patch({ cvScrim: v })} />
            )}
            {style.coverLayout === "serif" && (
              <SliderField label="Bottom gradient" value={style.cvScrim} min={0} max={90} suffix="%" onChange={v => patch({ cvScrim: v })} />
            )}
            {style.coverLayout !== "plain" && (
              <div className="space-y-2 rounded-lg border border-border/30 p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={style.cvGradOn} onChange={e => patch({ cvGradOn: e.target.checked })} className="accent-sky-500" />
                  Colour gradient over the photo
                </label>
                {style.cvGradOn && (
                  <>
                    <ColourField label="Gradient from" value={style.cvGradFrom} onChange={v => patch({ cvGradFrom: v })} />
                    <ColourField label="Gradient to" value={style.cvGradTo} onChange={v => patch({ cvGradTo: v })} />
                    <SliderField label="Strength" value={style.cvGradOpacity} min={0} max={100} suffix="%" onChange={v => patch({ cvGradOpacity: v })} />
                  </>
                )}
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.cvCaps} onChange={e => patch({ cvCaps: e.target.checked })} className="accent-sky-500" />
              Capital letters on the headline
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.cvSubCaps} onChange={e => patch({ cvSubCaps: e.target.checked })} className="accent-sky-500" />
              Capital letters on the subtitle
            </label>
            {style.coverLayout === "split" && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={style.cvBandOn} onChange={e => patch({ cvBandOn: e.target.checked })} className="accent-sky-500" />
                Band along the bottom
              </label>
            )}
            <div className="space-y-3 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={style.cvAll} onChange={e => patch({ cvAll: e.target.checked })} className="accent-sky-500" />
                Same text colours on every cover
              </label>
              {style.cvAll ? (
                <>
                  <ColourField label="Headline colour (all covers)" value={style.cvAllColour} onChange={v => patch({ cvAllColour: v })} metallic />
                  <ColourField label="Subtitle colour (all covers)" value={style.cvAllSubColour} onChange={v => patch({ cvAllSubColour: v })} metallic />
                </>
              ) : (
                <>
                  <ColourField label="Headline colour" value={style.cvColour} onChange={v => patch({ cvColour: v })} metallic />
                  <ColourField label="Subtitle colour" value={style.cvSubColour} onChange={v => patch({ cvSubColour: v })} metallic />
                </>
              )}
              {BLOCK_LABEL[style.coverLayout] && (
                <div className="flex items-end gap-2 flex-wrap">
                  <ColourField label={BLOCK_LABEL[style.coverLayout]!} value={style.cvBlock} textures onChange={v => patch({ cvBlock: v })} />
                  <button
                    type="button"
                    onClick={() => changeAllBlocks(style.cvBlock)}
                    className="text-xs rounded-lg border border-sky-500/50 text-sky-400 hover:bg-sky-500/10 px-2.5 py-1.5 mb-[3px]"
                    title="Use this colour as the block colour on every cover, clearing any set on individual posts"
                  >Change all blocks</button>
                </div>
              )}
              {style.coverLayout === "split" && style.cvBandOn && (
                <div className="flex items-end gap-2 flex-wrap">
                  <ColourField label="Bottom band colour" value={style.cvBand} onChange={v => patch({ cvBand: v })} />
                  <button
                    type="button"
                    onClick={() => changeAllBands(style.cvBand)}
                    className="text-xs rounded-lg border border-sky-500/50 text-sky-400 hover:bg-sky-500/10 px-2.5 py-1.5 mb-[3px]"
                    title="Use this colour as the band colour on every cover, clearing any set on individual posts"
                  >Change all bands</button>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-4 border-t border-border/30 pt-5">
            <h3 className="text-sm font-semibold">Slides 2 onwards: photo with text</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm" variant={style.layout === "editorial" ? "default" : "outline"}
                className={style.layout === "editorial" ? "bg-sky-600 hover:bg-sky-700 text-white" : ""}
                onClick={() => patch(LOOK_EDITORIAL)}
              >Editorial</Button>
              <Button
                size="sm" variant={style.layout === "classic" ? "default" : "outline"}
                className={style.layout === "classic" ? "bg-sky-600 hover:bg-sky-700 text-white" : ""}
                onClick={() => patch(LOOK_CLASSIC)}
              >Classic centred</Button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Picking a look resets the settings below to that look. Change anything after that and it sticks.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Slide text font</Label>
              <Select value={style.displayFont} onValueChange={v => patch({ displayFont: v })}>
                <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {fontItems(slideFontOptions)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Small text font (counter)</Label>
              <Select value={style.fontFamily} onValueChange={v => patch({ fontFamily: v })}>
                <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {fontItems(slideFontOptions)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Text weight</Label>
                <Select value={String(style.textWeight)} onValueChange={v => patch({ textWeight: Number(v) })}>
                  <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{WEIGHTS.map(w => <SelectItem key={w.value} value={String(w.value)}>{w.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Alignment</Label>
                <Select value={style.align} onValueChange={v => patch({ align: v as Style["align"] })}>
                  <SelectTrigger className="bg-muted/30 border-border/40 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="centre">Centre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <SliderField label="Slide text size" value={style.bodySize} min={36} max={120} suffix="px" onChange={v => patch({ bodySize: v })} />
            <SliderField label="CTA size" value={style.ctaSize} min={36} max={120} suffix="px" onChange={v => patch({ ctaSize: v })} />
            <SliderField label="Letter spacing" value={style.letterSpacing} min={0} max={10} step={0.5} suffix="px" onChange={v => patch({ letterSpacing: v })} />
            <SliderField label="Line height" value={style.lineHeight} min={1} max={1.8} step={0.02} onChange={v => patch({ lineHeight: v })} />
            <SliderField label={style.layout === "editorial" ? "Text bottom edge" : "Text height"} value={style.bodyY} min={15} max={95} suffix="%" onChange={v => patch({ bodyY: v })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.uppercase} onChange={e => patch({ uppercase: e.target.checked })} className="accent-sky-500" />
              Capital letters
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.textItalic} onChange={e => patch({ textItalic: e.target.checked })} className="accent-sky-500" />
              Italic slide text
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.shadow} onChange={e => patch({ shadow: e.target.checked })} className="accent-sky-500" />
              Soft shadow behind text
            </label>
          </section>

          <section className="space-y-3 border-t border-border/30 pt-5">
            <h3 className="text-sm font-semibold">Details</h3>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.frame} onChange={e => patch({ frame: e.target.checked })} className="accent-sky-500" />
              Fine frame
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.rule} onChange={e => patch({ rule: e.target.checked })} className="accent-sky-500" />
              Short line above the words
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.counter} onChange={e => patch({ counter: e.target.checked })} className="accent-sky-500" />
              Slide counter (01 / 05)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.brandMark} onChange={e => patch({ brandMark: e.target.checked })} className="accent-sky-500" />
              Client name in the corner
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.arrow} onChange={e => patch({ arrow: e.target.checked })} className="accent-sky-500" />
              Swipe arrow
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={style.showLogo} onChange={e => patch({ showLogo: e.target.checked })} className="accent-sky-500" />
              Client logo (all slides)
            </label>
            {style.showLogo && (
              <label className="block text-sm space-y-1">
                <span className="text-muted-foreground">Logo size ({Math.round((style.logoScale ?? 1.35) * 100)}%)</span>
                <input type="range" min={50} max={300} step={5} value={Math.round((style.logoScale ?? 1.35) * 100)}
                  onChange={e => patch({ logoScale: Number(e.target.value) / 100 })} className="w-full accent-sky-500" />
              </label>
            )}
          </section>

          <section className="space-y-3 border-t border-border/30 pt-5">
            <h3 className="text-sm font-semibold">Colours for slides 2 onwards</h3>
            <ColourField label="Slide text" value={style.bodyColour} onChange={v => patch({ bodyColour: v })} />
            <ColourField label="CTA" value={style.ctaColour} onChange={v => patch({ ctaColour: v })} />
            <ColourField label="Lines, frame, counter" value={style.lineColour} onChange={v => patch({ lineColour: v })} />
            <ColourField label="Behind photos" value={style.background} onChange={v => patch({ background: v })} />
            <SliderField label="Bottom gradient" value={style.scrim} min={0} max={90} suffix="%" onChange={v => patch({ scrim: v })} />
            <SliderField label="Darken whole photo" value={style.overlay} min={0} max={80} suffix="%" onChange={v => patch({ overlay: v })} />
          </section>
        </aside>

        {/* ------------------------------ right: posts ------------------------------ */}
        <section className="space-y-6 min-w-0">
          {!posts.length ? (
            <div className="border border-dashed border-border/40 rounded-xl p-10 text-center text-sm text-muted-foreground leading-relaxed">
              Add your photos and your CSV on the left and your posts appear here, ready to style, caption, download or schedule.
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold">{posts.length} post{posts.length !== 1 ? "s" : ""}, {selectedPosts.length} ticked</h2>
                  <p className="text-xs text-muted-foreground">
                    Slides export at 1080 x 1440. Drag any photo to move it, double click to put it back.{rendering && " Refreshing previews…"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    value={area}
                    onChange={e => setArea(e.target.value)}
                    placeholder="Clinic area for local SEO, e.g. Harrogate, North Yorkshire"
                    className="h-9 text-sm bg-muted/30 border border-border/40 rounded-md px-3 w-72"
                  />
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/40 w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>{TONES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={handleCaptionAll} disabled={captionAllBusy}>
                    {captionAllBusy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
                    Write all captions
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownload} disabled={!!exporting}>
                    {exporting ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{exporting}</> : <><Download className="w-4 h-4 mr-1.5" />Download all images</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleSendToFlip} disabled={sendingFlip || !!scheduling} title="Sends slide 1 of each ticked post to Magazine Flip">
                    {sendingFlip ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-1.5" />}
                    Send to Magazine Flip
                  </Button>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title="Adds a story to each post with a bold question about it, booked for 7am on the post's day">
                    <input type="checkbox" checked={withStories} onChange={e => setWithStories(e.target.checked)} />
                    Add a 7am story to each post
                  </label>
                  <Button size="sm" onClick={() => handleSchedule("carousel")} disabled={!!scheduling} className="bg-pink-600 hover:bg-pink-700 text-white" title="Schedules on Monday, Wednesday, Friday and Sunday">
                    {scheduling ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />{scheduling}</> : <><CalendarClock className="w-4 h-4 mr-1.5" />Schedule</>}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleSchedule("reel")} disabled={!!scheduling} title="Turns each ticked post into a 1080x1440 reel, writes captions and schedules on Monday, Wednesday, Friday and Sunday. Tick 'trial reel' on the next screen if you want it as a trial.">
                    <Film className="w-4 h-4 mr-1.5" />Make into reels
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <button className="text-sky-400 hover:underline" onClick={() => setPosts(l => l.map(p => ({ ...p, selected: true })))}>Tick all</button>
                <button className="text-sky-400 hover:underline" onClick={() => setPosts(l => l.map(p => ({ ...p, selected: false })))}>Untick all</button>
                <span className="text-border/60">|</span>
                <button className="text-sky-400 hover:underline" onClick={mixCovers}>Give each post a different cover</button>
                <button className="text-sky-400 hover:underline" onClick={sameCovers}>Same cover on every post</button>
              </div>

              {images.length > 0 && images.length !== expectedImages && (
                <p className="text-xs text-amber-500/90 bg-amber-500/5 border border-amber-500/30 rounded-lg px-3 py-2">
                  You have {images.length} photo{images.length !== 1 ? "s" : ""} for {posts.length} post{posts.length !== 1 ? "s" : ""} at {perPost} each, which needs {expectedImages}.
                  {images.length < expectedImages
                    ? (reusing
                      ? " I am reusing your photos to fill every slide. Slide 1 gets a different photo each time, and no post shows the same photo twice unless you have fewer photos than slides."
                      : " Posts without photos get a plain background. Tick 'Reuse my photos' on the left to fill them.")
                    : " The extra photos are ignored."}
                </p>
              )}
              {maxSlides > perPost && (
                <p className="text-xs text-amber-500/90 bg-amber-500/5 border border-amber-500/30 rounded-lg px-3 py-2">
                  Your CSV makes up to {maxSlides} slides per post but you are using {perPost} photos per post. The last photo repeats for the extra slides.
                </p>
              )}

              <div className="space-y-5">
                {posts.map((post, pi) => {
                  const specs = buildSlides(post.texts);
                  return (
                    <div key={post.id} className={["rounded-xl border p-4 space-y-4", post.selected ? "border-border/50 bg-muted/10" : "border-border/20 opacity-60"].join(" ")}>
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox" checked={post.selected}
                          onChange={e => updatePost(post.id, { selected: e.target.checked })}
                          className="accent-sky-500 w-4 h-4" aria-label={`Include post ${pi + 1}`}
                        />
                        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Post {pi + 1}</span>
                        <span className="text-sm text-foreground/80 truncate">{post.texts[0]}</span>
                        <span className="ml-auto text-[18px] text-muted-foreground shrink-0">{specs.length} slides</span>
                        {confirmDelete === post.id ? (
                          <span className="flex items-center gap-2 text-xs shrink-0">
                            <span className="text-muted-foreground">Delete post {pi + 1}?</span>
                            <button type="button" className="text-red-400 font-medium hover:underline" onClick={() => deletePost(post.id)}>Yes, delete</button>
                            <button type="button" className="text-muted-foreground hover:underline" onClick={() => setConfirmDelete(null)}>Keep</button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(post.id)}
                            className="text-muted-foreground hover:text-red-400 shrink-0"
                            title="Delete this post"
                            aria-label={`Delete post ${pi + 1}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {specs.map((spec, si) => {
                          const thumb = thumbs[`${post.id}:${si}`];
                          const hasPhoto = !!photoFor(pi, post, si);
                          const moved = !!focusRef.current[`${post.id}:${si}`];
                          const textMoved = !!textFocusRef.current[`${post.id}:${si}`] || !!textScaleRef.current[`${post.id}:${si}`];
                          const subTextMoved = !!subTextFocusRef.current[`${post.id}:${si}`] || !!subTextScaleRef.current[`${post.id}:${si}`];
                          const isCover = spec.kind === "cover";
                          return (
                            <div
                              key={si}
                              data-thumb
                              onPointerDown={e => startDrag(e, post, pi, si, spec)}
                              onPointerMove={e => moveDrag(e, post)}
                              onPointerUp={endDrag}
                              onPointerCancel={endDrag}
                              onDoubleClick={() => resetPos(post, pi, si)}
                              title={hasPhoto ? "Drag to move the photo. Double click to put it back." : undefined}
                              className={["relative rounded-lg overflow-hidden border border-border/30 shrink-0 group select-none", hasPhoto ? "cursor-grab active:cursor-grabbing" : ""].join(" ")}
                              style={{ width: 170, touchAction: hasPhoto ? "none" : undefined }}
                            >
                              {thumb ? (
                                <img src={thumb} alt={`Post ${pi + 1}, slide ${si + 1}`} className="w-full block pointer-events-none" style={{ aspectRatio: `${W}/${H}` }} draggable={false} />
                              ) : (
                                <div className="w-full bg-muted/30 flex items-center justify-center" style={{ aspectRatio: `${W}/${H}` }}>
                                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                </div>
                              )}
                              {isCover && (
                                <div
                                  onPointerDown={e => startTextDrag(e, post, pi, si)}
                                  onPointerMove={e => moveTextDrag(e, post)}
                                  onPointerUp={endTextDrag}
                                  onPointerCancel={endTextDrag}
                                  onDoubleClick={e => { e.stopPropagation(); resetTextPos(post, pi, si); }}
                                  title="Drag to move the headline. Double click to put it back."
                                  className="absolute top-1.5 left-1.5 flex items-center gap-0.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[18px] font-semibold uppercase tracking-wider text-white opacity-90 group-hover:opacity-100 cursor-grab active:cursor-grabbing select-none"
                                  style={{ touchAction: "none" }}
                                >
                                  <Move className="w-2.5 h-2.5" /> Aa
                                </div>
                              )}
                              {isCover && (
                                <div
                                  onPointerDown={e => startTextResize(e, post, pi, si)}
                                  onPointerMove={e => moveTextResize(e, post)}
                                  onPointerUp={endTextResize}
                                  onPointerCancel={endTextResize}
                                  onDoubleClick={e => { e.stopPropagation(); resetTextScale(post, pi, si); }}
                                  title="Drag up or down to resize the headline. Double click to put it back."
                                  className="absolute top-7 left-1.5 flex items-center rounded-md bg-black/65 p-0.5 text-white opacity-90 group-hover:opacity-100 cursor-ns-resize select-none"
                                  style={{ touchAction: "none" }}
                                >
                                  <ArrowUpDown className="w-2.5 h-2.5" />
                                </div>
                              )}
                              {isCover && (
                                <div
                                  onPointerDown={e => startSubTextDrag(e, post, pi, si)}
                                  onPointerMove={e => moveSubTextDrag(e, post)}
                                  onPointerUp={endSubTextDrag}
                                  onPointerCancel={endSubTextDrag}
                                  onDoubleClick={e => { e.stopPropagation(); resetSubTextPos(post, pi, si); }}
                                  title="Drag to move the subtitle. Double click to put it back."
                                  className="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-md bg-black/65 px-1.5 py-0.5 text-[18px] font-semibold uppercase tracking-wider text-white opacity-90 group-hover:opacity-100 cursor-grab active:cursor-grabbing select-none"
                                  style={{ touchAction: "none" }}
                                >
                                  <Move className="w-2.5 h-2.5" /> aa
                                </div>
                              )}
                              {isCover && (
                                <div
                                  onPointerDown={e => startSubTextResize(e, post, pi, si)}
                                  onPointerMove={e => moveSubTextResize(e, post)}
                                  onPointerUp={endSubTextResize}
                                  onPointerCancel={endSubTextResize}
                                  onDoubleClick={e => { e.stopPropagation(); resetSubTextScale(post, pi, si); }}
                                  title="Drag up or down to resize the subtitle. Double click to put it back."
                                  className="absolute top-7 right-1.5 flex items-center rounded-md bg-black/65 p-0.5 text-white opacity-90 group-hover:opacity-100 cursor-ns-resize select-none"
                                  style={{ touchAction: "none" }}
                                >
                                  <ArrowUpDown className="w-2.5 h-2.5" />
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent">
                                <span className="text-[18px] text-white/80 font-medium">{si + 1}</span>
                                <span className="flex items-center gap-1.5">
                                  {textMoved && (
                                    <button
                                      type="button"
                                      onPointerDown={e => e.stopPropagation()}
                                      onDoubleClick={e => e.stopPropagation()}
                                      onClick={() => resetTextPos(post, pi, si)}
                                      className="text-[18px] text-white/80 uppercase tracking-wider hover:text-white"
                                    >reset text</button>
                                  )}
                                  {subTextMoved && (
                                    <button
                                      type="button"
                                      onPointerDown={e => e.stopPropagation()}
                                      onDoubleClick={e => e.stopPropagation()}
                                      onClick={() => resetSubTextPos(post, pi, si)}
                                      className="text-[18px] text-white/80 uppercase tracking-wider hover:text-white"
                                    >reset subtitle</button>
                                  )}
                                  {moved && (
                                    <button
                                      type="button"
                                      onPointerDown={e => e.stopPropagation()}
                                      onDoubleClick={e => e.stopPropagation()}
                                      onClick={() => resetPos(post, pi, si)}
                                      className="text-[18px] text-white/80 uppercase tracking-wider hover:text-white"
                                    >reset</button>
                                  )}
                                  <button
                                    type="button"
                                    onPointerDown={e => e.stopPropagation()}
                                    onDoubleClick={e => e.stopPropagation()}
                                    onClick={() => { replaceTarget.current = `${post.id}:${si}`; replaceInputRef.current?.click(); }}
                                    className="text-[18px] text-white/80 uppercase tracking-wider hover:text-white"
                                  >swap</button>
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground mr-1">Cover</span>
                        <button
                          type="button" onClick={() => setCover(post, pi, undefined)}
                          className={["rounded-lg border px-2.5 py-1.5 text-[18px] transition-colors", !post.cover ? "border-sky-500 bg-sky-500/10 text-foreground" : "border-border/40 text-muted-foreground hover:border-border/70"].join(" ")}
                        >Main choice</button>
                        {COVER_ORDER.map((k, ci) => (
                          <button
                            key={k} type="button" onClick={() => setCover(post, pi, k)}
                            title={`Cover option ${ci + 1}`}
                            aria-label={`Cover option ${ci + 1} for post ${pi + 1}`}
                            className={["rounded-lg border p-1 flex items-center gap-1.5 transition-colors", post.cover === k ? "border-sky-500 bg-sky-500/10" : "border-border/40 hover:border-border/70"].join(" ")}
                          >
                            <span className="scale-[0.6] origin-left -mr-3.5"><CoverIcon k={k} /></span>
                            <span className="text-[18px] text-muted-foreground pr-1">{ci + 1}</span>
                          </button>
                        ))}
                        {OCT_ORDER.map(k => (
                          <button
                            key={k} type="button" onClick={() => setCover(post, pi, k)}
                            title={`October 26: ${OCT_NAMES[k]}`}
                            aria-label={`October 26 cover ${OCT_NAMES[k]} for post ${pi + 1}`}
                            className={["rounded-lg border px-1.5 py-1 text-[18px] transition-colors", post.cover === k ? "border-sky-500 bg-sky-500/10 text-foreground" : "border-border/40 text-muted-foreground hover:border-border/70"].join(" ")}
                          >Oct {k.replace("oct", "")}</button>
                        ))}
                      </div>

                      {(() => {
                        const eff = styleForSlide(style, post, "cover");
                        return (
                          <div className="flex items-end gap-x-6 gap-y-2 flex-wrap">
                            <div className="w-56 space-y-1">
                              <Label className="text-xs text-muted-foreground">Cover headline font</Label>
                              <div className="flex gap-1.5">
                                <Select value={post.coverFont || "__same"} onValueChange={v => setCoverFonts(post, pi, { coverFont: v === "__same" ? undefined : v })}>
                                  <SelectTrigger className="bg-muted/30 border-border/40 h-8 flex-1"><SelectValue /></SelectTrigger>
                                  <SelectContent className="max-h-72">
                                    <SelectItem value="__same">Same as the rest</SelectItem>
                                    {fontItems(coverFontOptions)}
                                  </SelectContent>
                                </Select>
                                <button
                                  type="button" disabled={!(post.coverFont || eff.clientCoverFont)}
                                  onClick={() => changeAllFonts("head", post.coverFont || eff.clientCoverFont)}
                                  className="text-xs rounded-lg border border-sky-500/50 text-sky-400 hover:bg-sky-500/10 px-2 disabled:opacity-40"
                                  title="Use this headline font on every cover"
                                >Change all</button>
                              </div>
                            </div>
                            <div className="w-56 space-y-1">
                              <Label className="text-xs text-muted-foreground">Cover subtitle font</Label>
                              <div className="flex gap-1.5">
                                <Select value={post.coverSubFont || "__same"} onValueChange={v => setCoverFonts(post, pi, { coverSubFont: v === "__same" ? undefined : v })}>
                                  <SelectTrigger className="bg-muted/30 border-border/40 h-8 flex-1"><SelectValue /></SelectTrigger>
                                  <SelectContent className="max-h-72">
                                    <SelectItem value="__same">Same as the rest</SelectItem>
                                    {fontItems(coverFontOptions)}
                                  </SelectContent>
                                </Select>
                                <button
                                  type="button" disabled={!(post.coverSubFont || eff.clientCoverSubFont)}
                                  onClick={() => changeAllFonts("sub", post.coverSubFont || eff.clientCoverSubFont)}
                                  className="text-xs rounded-lg border border-sky-500/50 text-sky-400 hover:bg-sky-500/10 px-2 disabled:opacity-40"
                                  title="Use this subtitle font on every cover"
                                >Change all</button>
                              </div>
                            </div>
                            {OCT_LAYOUTS.has(eff.coverLayout) && (
                              <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
                                {([
                                  { label: "Curve", key: "coverCurve" as const, val: eff.cvCurve ?? 0, min: -100, max: 100, step: 5, fmt: (v: number) => (v === 0 ? "straight" : v > 0 ? `arch ${v}` : `smile ${-v}`) },
                                  { label: "Letter spacing", key: "coverTracking" as const, val: eff.cvTracking, min: -6, max: 40, step: 1, fmt: (v: number) => `${v}px` },
                                  { label: "Line spacing", key: "coverLeading" as const, val: eff.cvLeading ?? 1.02, min: 0.7, max: 1.8, step: 0.02, fmt: (v: number) => v.toFixed(2) },
                                ]).map(c => (
                                  <div key={c.key}>
                                    <label className="text-xs font-medium text-muted-foreground block mb-1">{c.label} ({c.fmt(c.val)})</label>
                                    <input
                                      type="range" min={c.min} max={c.max} step={c.step} value={c.val} className="w-full"
                                      aria-label={`${c.label} for the headline on post ${pi + 1}`}
                                      onChange={e => setCoverText(post, pi, { [c.key]: Number(e.target.value) })}
                                    />
                                  </div>
                                ))}
                                <div className="sm:col-span-3 flex items-center gap-2 flex-wrap">
                                  <button
                                    type="button" aria-pressed={eff.cvCaps}
                                    onClick={() => setCoverCaps(post, pi, !eff.cvCaps)}
                                    className={["text-xs rounded-lg border px-2.5 py-1.5", eff.cvCaps ? "border-sky-500 bg-sky-500/10 text-foreground" : "border-border/40 text-muted-foreground hover:border-border/70"].join(" ")}
                                    title="Capitals on or off for this headline"
                                  >CAPS LOCK</button>
                                  <button
                                    type="button" onClick={() => changeAllCaps(!!eff.cvCaps)}
                                    className="text-xs rounded-lg border border-sky-500/50 text-sky-400 hover:bg-sky-500/10 px-2.5 py-1.5"
                                    title="Use this capitals setting on every headline"
                                  >Change all</button>
                                </div>
                                {(() => {
                                  const headFace = faces(eff, eff.coverLayout)[0];
                                  const raw = post.texts[0] ?? "";
                                  const letters = [...raw];
                                  const any = letters.some(ch => /\S/.test(ch) && altCount(headFace, ch) > 0);
                                  return (
                                    <details className="sm:col-span-3 text-sm">
                                      <summary className="cursor-pointer text-xs text-muted-foreground">Curly letters</summary>
                                      {!any ? (
                                        <p className="text-xs text-muted-foreground mt-1">This font has no curly alternates for these letters. Fonts you have uploaded, such as Felgine, Bedross, Charnoir, Hatcher and Peany Timer, usually do.</p>
                                      ) : (
                                        <div className="mt-1.5">
                                          <p className="text-xs text-muted-foreground mb-1">Click a letter to swap it for the font's curly version. Click again for the next one, and again to go back.</p>
                                          <div className="flex flex-wrap gap-1">
                                            {letters.map((ch, i) => {
                                              if (!/\S/.test(ch)) return <span key={i} className="w-3" />;
                                              const n = altCount(headFace, ch);
                                              const cur = post.coverAlts?.[i] ?? 0;
                                              return (
                                                <button
                                                  key={i} type="button" disabled={n === 0}
                                                  onClick={() => cycleLetter(post, pi, i, n)}
                                                  className={["min-w-7 h-8 px-1 rounded border text-base leading-none", n === 0 ? "border-border/20 text-muted-foreground/40" : cur > 0 ? "border-sky-500 bg-sky-500/15 text-foreground" : "border-border/50 text-foreground hover:border-sky-500/60"].join(" ")}
                                                  title={n === 0 ? "No curly version" : cur > 0 ? `Curly version ${cur} of ${n}` : `${n} curly ${n === 1 ? "version" : "versions"}`}
                                                  style={{ fontFamily: headFace }}
                                                >{ch}</button>
                                              );
                                            })}
                                          </div>
                                          {post.coverAlts && (
                                            <button type="button" className="text-xs text-muted-foreground underline hover:text-foreground mt-1.5"
                                              onClick={() => { updatePost(post.id, { coverAlts: undefined }); redrawOne({ ...post, coverAlts: undefined }, pi, 0); }}
                                            >Put every letter back</button>
                                          )}
                                        </div>
                                      )}
                                    </details>
                                  );
                                })()}
                                {(post.coverCurve !== undefined || post.coverTracking !== undefined || post.coverLeading !== undefined) && (
                                  <button type="button" className="text-xs text-muted-foreground underline hover:text-foreground text-left"
                                    onClick={() => setCoverText(post, pi, { coverCurve: undefined, coverTracking: undefined, coverLeading: undefined })}
                                  >Put the text shape back</button>
                                )}
                              </div>
                            )}
                            <div className="w-56"><ColourField label="Cover headline" value={eff.cvColour} onChange={v => setCoverColours(post, pi, { coverColour: v })} metallic /></div>
                            <div className="w-56"><ColourField label="Cover subtitle" value={eff.cvSubColour} onChange={v => setCoverColours(post, pi, { coverSubColour: v })} metallic /></div>
                            {OCT_LAYOUTS.has(eff.coverLayout) && (() => {
                              const key = `${post.id}:0`;
                              const cur = focusRef.current[key];
                              return (
                                <div className="w-56">
                                  <label className="text-xs font-medium text-muted-foreground block mb-1">Zoom photo ({Math.round((cur?.z ?? 1) * 100)}%)</label>
                                  <input
                                    type="range" min={100} max={300} step={5} value={Math.round((cur?.z ?? 1) * 100)}
                                    aria-label={`Zoom the cover photo for post ${pi + 1}`}
                                    className="w-full"
                                    onChange={e => {
                                      const z = Number(e.target.value) / 100;
                                      focusRef.current = { ...focusRef.current, [key]: { x: cur?.x ?? 50, y: cur?.y ?? 50, z } };
                                      bumpFocus(n => n + 1);
                                      redrawOne(post, pi, 0);
                                    }}
                                  />
                                  <div className="text-[18px] text-muted-foreground mt-0.5">Drag the photo to move it. Double click to reset.</div>
                                  <label className="text-xs font-medium text-muted-foreground block mt-2 mb-1">Punch: contrast and colour ({post.coverPunch ?? 75})</label>
                                  <input
                                    type="range" min={0} max={100} step={5} value={post.coverPunch ?? 75}
                                    aria-label={`Photo punch for post ${pi + 1}`}
                                    className="w-full"
                                    onChange={e => { const v = Number(e.target.value); updatePost(post.id, { coverPunch: v }); redrawOne({ ...post, coverPunch: v }, pi, 0); }}
                                  />
                                </div>
                              );
                            })()}
                            {OCT_LOOKS[eff.coverLayout]?.recolour && (
                              <div className="w-56">
                                <ColourField label="Spot colour in the picture" value={eff.cvSpot || preset?.accentColor || "#2c9a8f"} onChange={v => setCoverColours(post, pi, { coverSpot: v })} />
                                <div className="text-[18px] text-muted-foreground mt-0.5">Starts as the clinic colour. Pick another to recolour the shoes, lips or glove.</div>
                              </div>
                            )}
                            {eff.coverLayout === "oct17" && (
                              <div className="flex gap-4 items-center text-xs">
                                <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!eff.cvTowel} onChange={e => { updatePost(post.id, { coverTowel: e.target.checked }); redrawOne({ ...post, coverTowel: e.target.checked }, pi, 0); }} />Towel on head</label>
                                <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!eff.cvShades} onChange={e => { updatePost(post.id, { coverShades: e.target.checked }); redrawOne({ ...post, coverShades: e.target.checked }, pi, 0); }} />Sunglasses</label>
                              </div>
                            )}
                            {BLOCK_LABEL[eff.coverLayout] && (
                              <div className="w-56"><ColourField label={BLOCK_LABEL[eff.coverLayout]!} value={eff.cvBlock} textures onChange={v => setCoverColours(post, pi, { coverBlockColour: v })} /></div>
                            )}
                            {eff.coverLayout === "split" && eff.cvBandOn && (
                              <div className="w-56"><ColourField label="Bottom band colour" value={eff.cvBand} onChange={v => setCoverColours(post, pi, { coverBandColour: v })} /></div>
                            )}
                            <button
                              type="button"
                              onClick={() => changeAllText(eff.cvColour, eff.cvSubColour, eff.cvBlock, eff.cvBand)}
                              className="text-xs rounded-lg border border-sky-500/50 text-sky-400 hover:bg-sky-500/10 px-2.5 py-1.5"
                              title="Use this post's headline, subtitle and block/band colours on every cover"
                            >Change all</button>
                            {(post.coverColour || post.coverSubColour || post.coverBlockColour || post.coverBandColour || post.coverSpot) && (
                              <button
                                type="button"
                                onClick={() => setCoverColours(post, pi, { coverColour: undefined, coverSubColour: undefined, coverBlockColour: undefined, coverBandColour: undefined, coverSpot: undefined })}
                                className="text-xs text-muted-foreground underline hover:text-foreground pb-1"
                              >Put the colours back</button>
                            )}
                          </div>
                        );
                      })()}

                      <details className="text-sm">
                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Edit the words on this post</summary>
                        <div className="grid gap-2 mt-3 md:grid-cols-2">
                          {post.texts.map((t, ci) => {
                            const label = ci === 0 ? "Headline" : ci === 1 ? "Subtitle" : ci === post.texts.length - 1 ? "CTA" : `Text ${ci - 1}`;
                            return (
                              <div key={ci} className="space-y-1">
                                <Label className="text-[18px] text-muted-foreground">{label}</Label>
                                <textarea
                                  value={t} rows={2}
                                  onChange={e => setText(post.id, ci, e.target.value)}
                                  className="w-full bg-muted/30 border border-border/40 rounded-md px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-sky-500"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </details>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Caption</Label>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleSendPostToFlip(post)} disabled={sendingFlip || !!scheduling} title="Sends this post to Magazine Flip so you can share it as a reel or a trial reel">
                              <Film className="w-3.5 h-3.5 mr-1" />Magazine Flip reel
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleCaptionOne(post)} disabled={post.captionBusy}>
                              {post.captionBusy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                              {post.caption ? "Write another" : "Write caption"}
                            </Button>
                          </div>
                        </div>
                        <textarea
                          value={post.caption} rows={5}
                          onChange={e => updatePost(post.id, { caption: e.target.value })}
                          placeholder="Write your own, or let me draft one in the tone you chose above."
                          className="w-full bg-muted/30 border border-border/40 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </main>

      <input
        ref={replaceInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          const key = replaceTarget.current;
          if (f && key) {
            setOverrides(o => ({ ...o, [key]: f }));
            const next = { ...focusRef.current };
            delete next[key];
            focusRef.current = next;
          }
          e.target.value = "";
        }}
      />

      {scheduleItems && preset && (
        <ScheduleModal
          presetId={preset.id}
          presetName={preset.name}
          postType={scheduleMode}
          posts={scheduleItems}
          perPostCaptions
          initialScheduledAt={scheduleStart}
          postingDays
          companionStories={scheduleStories}
          sourceTool="stylish"
          onClose={() => setScheduleItems(null)}
          onSaved={() => setScheduleItems(null)}
          presets={presets.map(p => ({ id: p.id, name: p.name }))}
        />
      )}
    </div>
  );
}
