import { drawAligned, type Align } from "./text-layout";
// Unique: 23 one of a kind cover designs (notices, recalls, wanted posters, myth busting forms) and the two
// full bleed photo slides that follow each one. Everything draws straight onto a 1080 x 1350 canvas so the
// preview, the download and the scheduled image are always identical. No React in here.

import { fillTokens, type Fill } from "./basic-covers";
import {
  XW, XH, drawLogo, headWeightFor, shade, rgba, wrap,
  type Ctx, type Focus, type G, type LogoPos, type Palette, type Slot,
} from "./xmas-designs";
import { LAYOUTS_A } from "./unique-layouts-a";
import { LAYOUTS_B } from "./unique-layouts-b";

export { XW as W, XH as H };

export type UniId =
  | "book" | "notice" | "crime" | "recall" | "divorce" | "news" | "brief" | "planning" | "missing" | "advisory" | "board" | "psa"
  | "wanted" | "chat" | "triage" | "skincare" | "rumour" | "onestar" | "form" | "penalty" | "door" | "redflags" | "nosaid";

export type FieldDef = { key: string; label: string; words: number; rows?: number };

export type UniDesign = {
  id: UniId;
  name: string;
  idea: string;
  photo: boolean; // does the cover have a photo
  palette: Palette;
  fields: FieldDef[];
  defaults: Record<string, string>;
};

const f = (key: string, label: string, words = 6, rows = 1): FieldDef => ({ key, label, words, rows });
const FOOT = "{clinic} | {area}";

export const PALETTE_LABELS: { key: keyof Palette; label: string }[] = [
  { key: "paper", label: "Page" },
  { key: "red", label: "Accent" },
  { key: "green", label: "Dark panels" },
  { key: "tag", label: "Strips and stamps" },
  { key: "frame", label: "Cards and frames" },
  { key: "light", label: "Light text" },
  { key: "ink", label: "Text on paper" },
];

const CREAM: Palette = { paper: "#ede3cf", green: "#1e2d4a", red: "#8e1f2d", tag: "#d8c6a0", frame: "#faf4e6", light: "#f5eedc", ink: "#1c1b1f" };
const KRAFT: Palette = { paper: "#cdbd9c", green: "#2f4a5c", red: "#a02a22", tag: "#b9a47c", frame: "#ece3cd", light: "#f3ead4", ink: "#1d1b17" };
const CORK: Palette = { paper: "#a47a4c", green: "#2a2a2a", red: "#b02a23", tag: "#e0d3b6", frame: "#f2ead8", light: "#fbf5e6", ink: "#1c1a17" };
const WHITE: Palette = { paper: "#d6d6d2", green: "#2b2f36", red: "#c0262d", tag: "#ede9df", frame: "#fbfaf6", light: "#ffffff", ink: "#161616" };
const DARK: Palette = { paper: "#0f0f10", green: "#1a1a1a", red: "#b3261e", tag: "#e8e0cf", frame: "#f4efe3", light: "#ece6d8", ink: "#141414" };
const NEWS: Palette = { paper: "#efe6d4", green: "#1e2a55", red: "#c4262a", tag: "#d9c9a6", frame: "#faf4e6", light: "#ffffff", ink: "#15151a" };
const ORANGE: Palette = { paper: "#f1e6cf", green: "#1c1c1c", red: "#b32a1e", tag: "#e8791c", frame: "#faf3e2", light: "#fff6e4", ink: "#1b1a18" };
const MAROON: Palette = { paper: "#e9e0cd", green: "#1f3350", red: "#6f1d2a", tag: "#cdbb94", frame: "#f6efdf", light: "#f6efe0", ink: "#1c1b1f" };
const YELLOW: Palette = { paper: "#cfcdc8", green: "#2b2b2b", red: "#c0262d", tag: "#f2c200", frame: "#f7f5ee", light: "#ffffff", ink: "#141414" };

export const UNIQUE: UniDesign[] = [
  {
    id: "book", name: "Things I will not do to your face", photo: true, palette: CREAM,
    idea: "a book cover style post called Things I will not do to your face, a practitioner's guide to saying no, about the treatments a good practitioner declines",
    fields: [f("h1", "Headline start", 4, 2), f("hot", "Red word", 1), f("h2", "Headline end", 4, 2), f("sub", "Subtitle", 8, 2), f("name", "Clinician name", 2), f("clinic", "Clinic name", 3)],
    defaults: { h1: "Things\nI will", hot: "NOT", h2: "do to\nyour face", sub: "A Practitioner's\nGuide to\nSaying No", name: "{owner}", clinic: "{clinic}" },
  },
  {
    id: "notice", name: "Permitted to fancy themselves", photo: false, palette: CREAM,
    idea: "an official notice saying women over 40 are legally permitted to fancy themselves, three permissions and a final irrevocable stamp",
    fields: [f("ref", "Ref number", 1), f("h1", "Headline start", 9, 2), f("hot", "Red word", 1), f("h2", "Headline end", 2), f("n1", "Point 1", 12, 2), f("n2", "Point 2", 12, 2), f("n3", "Point 3", 8, 2), f("law", "Box line 1", 6), f("use", "Box line 2", 3), f("footer", "Footer", 6)],
    defaults: { ref: "03", h1: "Women over 40 are reminded they are legally permitted to", hot: "FANCY", h2: "themselves", n1: "This permission is independent of age, size, hair colour, or other people's opinions.", n2: "It applies in mirrors, photographs, changing rooms and everyday life.", n3: "Exercise freely and without apology.", law: "The law is on your side.", use: "Use it.", footer: "{clinic} | {area}" },
  },
  {
    id: "crime", name: "Crime scene, tiny punctures", photo: true, palette: CREAM,
    idea: "a crime scene evidence file post about microneedling, skin refuses to press charges, consultation required",
    fields: [f("tag", "Evidence tag", 2), f("h", "Headline", 3), f("sub", "Sub headline", 6, 2), f("case", "Case file", 2), f("review", "Evidence review", 4), f("big", "Navy box words", 5, 2), f("footer", "Footer", 6)],
    defaults: { tag: "Evidence\n001", h: "Crime\nscene:", sub: "Thousands of tiny punctures discovered", case: "Microneedling", review: "Consultation required", big: "Skin refuses to press charges", footer: "{clinic} | {area}" },
  },
  {
    id: "recall", name: "Urgent recall, unrealistic expectations", photo: true, palette: ORANGE,
    idea: "an urgent recall notice for unrealistic expectations, such as expecting one treatment to undo 20 years of sun damage",
    fields: [f("h1", "Headline", 2), f("h2", "Headline second line", 3), f("batch", "Affected batches", 12, 3), f("reason", "Reason for recall", 4, 2), f("action", "Action", 4, 2), f("status", "Status", 2), f("notes", "Inspection notes", 12, 2), f("stamp", "Stamp", 1), f("footer", "Footer", 6)],
    defaults: { h1: "Urgent recall:", h2: "unrealistic expectations", batch: "Anyone expecting one treatment to undo 20 years of sun damage", reason: "Expectations require review", action: "Book a consultation", status: "Informational", notes: "Inspection notes:", stamp: "Recall", footer: "{clinic} | {area}" },
  },
  {
    id: "divorce", name: "Petition for divorce", photo: true, palette: MAROON,
    idea: "a petition for divorce from an unwanted body hair, grounds irreconcilable differences, status it's complicated and takes a course",
    fields: [f("top", "Top line", 3), f("big", "Big word", 1), f("appl", "Applicant", 2), f("resp", "Respondent", 3), f("grounds", "Grounds", 3, 2), f("status", "Status", 7, 2), f("info", "Course information line", 5), f("line", "Petition line", 14, 2), f("footer", "Footer", 6)],
    defaults: { top: "Petition for", big: "Divorce", appl: "You", resp: "Your leg hair", grounds: "Irreconcilable differences", status: "It's complicated and takes a course", info: "Consultation / course information", line: "I hereby petition for the dissolution of this unwanted relationship.", footer: "{clinic} | {area}" },
  },
  {
    id: "news", name: "Local woman caught having", photo: true, palette: NEWS,
    idea: "a tabloid front page, local woman caught having a treatment, family say she still looks exactly like herself",
    fields: [f("ex", "Red band", 2), f("brk", "Black box", 3, 2), f("h", "Headline", 5, 2), f("hot", "Red word", 2), f("inside", "Blue tag", 2), f("box1", "Side box 1", 6, 3), f("box2", "Side box 2", 4, 3), f("bottom", "Navy bar start", 5, 2), f("hot2", "Navy bar yellow words", 3), f("footer", "Footer", 6)],
    defaults: { ex: "Exclusive:", brk: "Breaking\nclinic news", h: "Local woman caught having", hot: "polynucleotides", inside: "Inside today", box1: "Consultation still considered a good idea", box2: "Mirror declines to comment", bottom: "Family say she still looks", hot2: "exactly like herself", footer: "{clinic} | {area}" },
  },
  {
    id: "brief", name: "Emergency meeting, notices a line", photo: true, palette: CREAM,
    idea: "a confidential briefing, emergency meeting called after a woman aged 46 notices a line, stop feeling bad for ageing",
    fields: [f("org", "Briefing title", 2), f("sub", "Briefing sub title", 5), f("ref", "Meeting ref", 2), f("h", "Headline", 10, 4), f("threat", "Threat level", 3), f("resp", "Response", 5), f("big", "Big line", 8, 3), f("filed", "Stamp", 5, 2), f("disc", "Small print", 14, 2), f("footer", "Footer", 6)],
    defaults: { org: "Confidential briefing", sub: "For authorised personnel only", ref: "A-46/OBS/CR-07", h: "Emergency meeting called after woman aged 46 notices a line", threat: "Entirely normal", resp: "Put the phone down", big: "Stop feeling bad for ageing. It's normal!", filed: "Filed under\nhuman overreaction", disc: "Treatment options should be discussed with a qualified clinician. Results vary.", footer: "{clinic} | {owner}" },
  },
  {
    id: "planning", name: "Planning permission refused", photo: true, palette: CREAM,
    idea: "a planning permission refused notice for the application to have an opinion on another woman's face, reason you are not the owner of the property",
    fields: [f("auth", "Authority", 5, 2), f("refno", "Reference number", 1), f("h", "Headline", 2), f("hot", "Red word", 1), f("app", "Application", 10, 3), f("reason", "Reason", 9, 2), f("appeal", "Appeal rights", 2), f("c1", "Footer left", 3), f("c2", "Footer right", 3)],
    defaults: { auth: "Planning authority\nLocal governance division", refno: "78542A", h: "Planning\npermission", hot: "refused", app: "Application to have an opinion on another woman's face", reason: "You are not the owner of the property", appeal: "None", c1: "{clinic}", c2: "{owner}" },
  },
  {
    id: "missing", name: "Missing: the person who asked", photo: true, palette: WHITE,
    idea: "a missing person poster for the person who asked for your opinion, last seen never, reward silence, tear off tabs saying mind your business",
    fields: [f("band", "Red band", 1), f("h", "Headline", 7, 4), f("l1", "Label 1", 2), f("v1", "Answer 1", 2), f("l2", "Label 2", 2), f("v2", "Answer 2", 4), f("l3", "Label 3", 1), f("v3", "Answer 3", 2), f("tab", "Tear off tab", 3, 2)],
    defaults: { band: "Missing:", h: "The person who asked for your opinion.", l1: "Last seen:", v1: "never.", l2: "Distinguishing features:", v2: "apparently invisible.", l3: "Reward:", v3: "silence.", tab: "Mind your business" },
  },
  {
    id: "advisory", name: "Warning: your opinion may not be required", photo: true, palette: CREAM,
    idea: "an advisory notice, warning your opinion may not be required, common side effects of saying you look better natural",
    fields: [f("top", "Top line", 2), f("ref", "Reference", 3), f("warn", "Warning word", 1), f("h", "Headline", 7, 2), f("listh", "List heading", 9, 3), f("i1", "Side effect 1", 3), f("i2", "Side effect 2", 3), f("i3", "Side effect 3", 5, 2), f("cap", "Photo caption", 3), f("cls", "Stamp top", 1), f("red", "Stamp big", 1), f("cls2", "Stamp small", 3), f("disc", "Disclaimer", 20, 4), f("clinic", "Clinic", 3), f("clin", "Clinician", 3)],
    defaults: { top: "Advisory notice", ref: "Ref: AN-IX/10", warn: "Warning:", h: "Your opinion\nmay not be required", listh: "Common side effects of saying 'you look better natural':", i1: "Awkward silence", i2: "Being ignored", i3: "Discovering she didn't ask", cap: "Clinical advisory expert", cls: "Classification", red: "Red", cls2: "Unsolicited & unnecessary", disc: "This notice does not apply to kindness, mind your business, or compliments. Use discernment. Or don't.", clinic: "{clinic}", clin: "{owner}" },
  },
  {
    id: "board", name: "Conspiracy theory #1, everyone will know", photo: true, palette: CORK,
    idea: "a conspiracy board post, aesthetics conspiracy theory number one, everyone will know, good work is usually not the work you notice",
    fields: [f("h", "Headline", 4, 2), f("hot", "Red words", 4, 2), f("clip", "Newspaper clipping", 10, 3), f("note", "Grey note", 10, 3), f("pink", "Handwritten note", 5, 2), f("stamp", "Stamp", 1), f("footer", "Footer", 6)],
    defaults: { h: "Aesthetics\nconspiracy\ntheory #1:", hot: "'Everyone\nwill know'", clip: "Clinic doors close as patients seek discretion above all", note: "Good work is usually not the work you notice.", pink: "'That's literally the point.'", stamp: "Evidence", footer: "{clinic} | {area}" },
  },
  {
    id: "psa", name: "Public service announcement for men", photo: true, palette: KRAFT,
    idea: "a public service announcement for men, skin is not a women-only organ, yes men have skincare concerns and aesthetic consultations, no your beard does not make you exempt from SPF",
    fields: [f("tag", "Stamp", 2), f("h1", "Headline start", 5, 3), f("h2", "Headline middle", 3), f("hot", "Blue words", 3, 2), f("h3", "Headline end", 1), f("l1", "Line 1", 6, 2), f("l2", "Line 2", 6, 2), f("l3", "Red line", 14, 3), f("footer", "Footer", 6)],
    defaults: { tag: "Public\ninformation", h1: "Public service announcement for men:", h2: "Skin is", hot: "not a women-only", h3: "organ.", l1: "yes, men have skincare concerns.", l2: "yes, men have aesthetic consultations.", l3: "no, your beard does not make you medically exempt from SPF.", footer: "{clinic} | {area}" },
  },
  {
    id: "wanted", name: "Wanted: natural means doing nothing", photo: true, palette: KRAFT,
    idea: "a wanted poster for the person who started natural means doing nothing, natural looking results and choosing treatment are not opposites",
    fields: [f("big", "Big word", 1), f("h", "Headline", 10, 3), f("sub", "Sub line", 8, 2), f("evid", "Evidence label", 2), f("hot", "Red words", 3, 2), f("rest", "Rest of line", 8, 2), f("stamp", "Stamp", 1), f("footer", "Footer", 6)],
    defaults: { big: "Wanted:", h: "The person who started 'natural means doing nothing'.", sub: "Last seen confusing personal choice with biology.", evid: "Evidence no.", hot: "Natural-looking results", rest: "and choosing treatment are not opposites.", stamp: "Wanted", footer: "{clinic} | {area}" },
  },
  {
    id: "chat", name: "Family group chat transcript", photo: true, palette: WHITE,
    idea: "a family group chat transcript where auntie says her friend had filler once and her face fell off, anecdote is not a consultation",
    fields: [f("top", "Top line", 4), f("recv", "Received", 3, 2), f("who1", "Name 1", 1), f("m1", "Message 1", 12, 3), f("who2", "Name 2", 1), f("m2", "Message 2", 14, 4), f("side", "Red note", 6, 2), f("stamp", "Stamp", 5, 2), f("footer", "Footer", 6)],
    defaults: { top: "Family group chat transcript", recv: "Received:\n16/05/24 09:14", who1: "Auntie:", m1: "My friend had filler once and her face fell off.", who2: "Clinician:", m2: "Was your friend's face perhaps still attached when you saw her?", side: "That's not how it works.", stamp: "Anecdote is not a consultation.", footer: "{clinic} | {area}" },
  },
  {
    id: "triage", name: "Triage, internet panic", photo: true, palette: KRAFT,
    idea: "an A and E triage card busting the myth that if I start I'll have to keep having it forever, discharged from TikTok university",
    fields: [f("dept", "Department", 5, 2), f("file", "Case file line", 6), f("stamp", "Stamp", 1), f("comp", "Complaint label", 2), f("q", "Complaint", 12, 4), f("cat", "Category label", 2), f("catv", "Category", 2), f("note", "Note label", 2), f("n1", "Note 1", 4), f("n2", "Note 2", 4), f("n3", "Note 3", 5), f("n4", "Note 4", 10, 2), f("rev", "Handwritten word", 1), f("disch", "Bottom stamp", 5, 2), f("footer", "Footer", 6)],
    defaults: { dept: "A&E department\nMyth-busting unit", file: "Case file: myth series 10/10", stamp: "Triage", comp: "Presenting complaint:", q: "'If I start, I'll have to keep having it forever.'", cat: "Triage category:", catv: "Internet panic.", note: "Clinical note:", n1: "Treatments are optional.", n2: "You can stop.", n3: "You can change your mind.", n4: "Your face does not enter a subscription contract.", rev: "reviewed", disch: "Discharged from TikTok University.", footer: "{clinic} | {area}" },
  },
  {
    id: "skincare", name: "Myth: expensive skincare", photo: true, palette: KRAFT,
    idea: "a myth post, expensive skincare can do everything a procedure can, with a price tag joke and a fact check that skincare and procedures have different jobs",
    fields: [f("h", "Headline", 10, 4), f("tag1", "Red tag top", 5, 2), f("tag2", "Red tag words", 7, 3), f("bar", "Fact bar", 9, 2), f("fc", "Fact check stamp", 2), f("footer", "Footer", 6)],
    defaults: { h: "Myth: Expensive skincare can do everything a procedure can.", tag1: "Reduced from £247 to", tag2: "'Still not a microneedling device'", bar: "skincare and procedures have different jobs.", fc: "Fact\ncheck", footer: "{clinic} | {area}" },
  },
  {
    id: "rumour", name: "Rumour: filler equals massive lips", photo: true, palette: CORK,
    idea: "a rumour and fact check board, filler equals massive lips, source someone's cousin's friend on Facebook, filler is used in different areas for different aims",
    fields: [f("h1", "Rumour start", 3, 2), f("hot", "Red word", 1), f("h2", "Rumour end", 2), f("src", "Source note", 10, 3), f("fc", "Fact check label", 2), f("fct", "Fact check", 10, 4), f("strip", "Black strip", 6, 2), f("footer", "Footer", 6)],
    defaults: { h1: "Rumour:\n'Filler =", hot: "massive", h2: "lips.'", src: "Source: someone's cousin's friend on Facebook, 2018.", fc: "Fact check:", fct: "Filler is used in different areas for different aims", strip: "Natural results. Individual to you.", footer: "{clinic} | {area}" },
  },
  {
    id: "onestar", name: "One star review", photo: true, palette: WHITE,
    idea: "a one star review, had one treatment yesterday still not 23, practitioner response biology has declined your express delivery request",
    fields: [f("h", "Headline", 2), f("date", "Date label", 1), f("quote", "Review", 12, 4), f("resp", "Response label", 2), f("rt", "Response", 10, 4), f("small", "Small note", 4), f("footer", "Footer", 6)],
    defaults: { h: "One star.", date: "Date:", quote: "\"Had one treatment yesterday. Still not 23.\"", resp: "Practitioner response:", rt: "Biology has declined your express delivery request.", small: "treatment timelines vary.", footer: "{clinic} | {area}" },
  },
  {
    id: "form", name: "Eligibility form, start young", photo: true, palette: KRAFT,
    idea: "an aesthetics eligibility assessment form busting the myth you have to start aesthetics young, applicant woman 52, there is no compulsory starting age",
    fields: [f("dept1", "Form title", 5, 2), f("dept2", "Department", 8, 3), f("recv", "Form received", 4, 2), f("myth", "Myth label", 1), f("h", "Myth", 8, 4), f("app", "Applicant label", 1), f("appv", "Applicant", 2), f("elig", "Eligibility label", 1), f("eligv", "Eligibility", 4), f("officer", "Officer label", 3), f("sign", "Signature", 2), f("dec", "Decision label", 1), f("stamp", "Decision stamp", 6, 3), f("notes", "Notes label", 2), f("nt", "Notes", 14, 3), f("footer", "Footer", 6)],
    defaults: { dept1: "Aesthetics eligibility assessment\nForm AE-52", dept2: "Department of wellbeing & appearance standards\nUnited Kingdom", recv: "Form received\n23 May 2024", myth: "Myth:", h: "You have to start aesthetics young.", app: "Applicant:", appv: "Woman, 52.", elig: "Eligibility:", eligv: "Still has a face.", officer: "Assessment officer:", sign: "J. Harper", dec: "Decision:", stamp: "There is no compulsory starting age.", notes: "Officer's notes:", nt: "Consultation should be based on the individual, not internet deadlines.", footer: "{clinic} | {area}" },
  },
  {
    id: "penalty", name: "Penalty notice", photo: true, palette: YELLOW,
    idea: "a penalty notice for parking your opinion on a woman's face without permission, fine 250 pounds, reduced to nothing if you shut up within 14 days",
    fields: [f("h", "Headline", 2, 2), f("off", "Offence label", 1), f("offv", "Offence", 12, 3), f("fine", "Fine label", 1), f("finev", "Fine", 1), f("red", "Red line", 10, 3), f("hand", "Handwritten", 3, 2)],
    defaults: { h: "Penalty\nnotice", off: "Offence:", offv: "Parking your opinion on a woman's face without permission.", fine: "Fine:", finev: "£250.", red: "Reduced to £0 if you shut up within 14 days.", hand: "honestly,\ntry it." },
  },
  {
    id: "door", name: "Notice: before commenting on her face", photo: true, palette: WHITE,
    idea: "a notice on a door, before commenting on another woman's face please confirm she asked you, you pay her bills, it is somehow your face, come in for a consultation not a referendum",
    fields: [f("h", "Headline", 1), f("h2", "Sub headline", 10, 3), f("p1", "Point 1", 5), f("p2", "Point 2", 6), f("p3", "Point 3", 7), f("note", "Note", 14, 3), f("hand", "Handwritten line", 12, 2), f("cap", "Photo caption", 1)],
    defaults: { h: "Notice:", h2: "Before commenting on another woman's face please confirm:", p1: "1. She asked you.", p2: "2. You pay her bills.", p3: "3. It is somehow your face.", note: "If all answers are NO, congratulations, this matter has resolved itself.", hand: "Come in for a consultation, not a referendum.", cap: "{owner}" },
  },
  {
    id: "redflags", name: "Red flags", photo: true, palette: DARK,
    idea: "a red flags checklist of a practitioner who won't tell you qualifications, pressures you to decide today, skips consultation, cannot explain risks, no aftercare, no plan if something goes wrong, safety isn't extra",
    fields: [f("h", "Headline", 2), f("l1", "Flag 1", 5, 2), f("l2", "Flag 2", 5, 2), f("l3", "Flag 3", 4), f("l4", "Flag 4", 4, 2), f("l5", "Flag 5", 4, 2), f("l6", "Flag 6", 8, 3), f("hi", "Yellow note", 8, 2), f("leave", "Bottom line", 8, 2), f("score", "Stamp", 1), f("footer", "Footer", 6)],
    defaults: { h: "Red flags.", l1: "won't tell you qualifications", l2: "pressures you to decide today", l3: "skips consultation", l4: "cannot explain risks", l5: "no clear aftercare", l6: "no plan if something goes wrong", hi: "Safety isn't extra. It's the standard.", leave: "this is the part where you leave.", score: "8/10", footer: "{clinic} | patient safety" },
  },
  {
    id: "nosaid", name: "The practitioner who said no", photo: true, palette: DARK,
    idea: "a Halloween horror poster, the practitioner who said no, they asked for more, she said no, the scariest thing in aesthetics is a practitioner with boundaries",
    fields: [f("small", "Small top word", 1), f("red", "Red words", 3, 2), f("big", "Big word", 1), f("body", "Body", 22, 4), f("scary", "Red line", 16, 3), f("stamp", "Stamp", 6, 3), f("clinic", "Clinic name", 3)],
    defaults: { small: "The", red: "Practitioner\nwho said", big: "NO", body: "They asked for more. She said no.\nThey showed her a filtered celebrity photo.\nShe still said no.", scary: "This Halloween, the scariest thing in aesthetics is a practitioner with boundaries.", stamp: "Coming to a\nconsultation near you.", clinic: "{clinic}" },
  },
];

export const UNIQUE_BY_ID: Record<UniId, UniDesign> = Object.fromEntries(UNIQUE.map((d) => [d.id, d])) as Record<UniId, UniDesign>;

const LAYOUTS: Record<UniId, (g: G) => void> = { ...LAYOUTS_A, ...LAYOUTS_B } as Record<UniId, (g: G) => void>;

export function resolveUniText(design: UniDesign, text: Record<string, string>, fill: Fill): Record<string, string> {
  return Object.fromEntries(design.fields.map((fd) => [fd.key, fillTokens(text[fd.key] ?? design.defaults[fd.key] ?? "", fill)]));
}

export type UniDrawInput = {
  design: UniId;
  text: Record<string, string>; // already resolved, no tokens left
  palette: Palette;
  headFont: string;
  bodyFont: string;
  upper: boolean;
  photo: ImageBitmap | null;
  focus: Focus;
  logo?: HTMLImageElement | null;
  logoPos?: LogoPos;
};

export function drawUnique(ctx: Ctx, d: UniDrawInput): Slot[] {
  const g: G = {
    ctx, t: d.text, c: d.palette, head: d.headFont, body: d.bodyFont, headW: headWeightFor(d.headFont),
    upper: d.upper, photo: d.photo, focus: d.focus, slots: [],
  };
  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
  LAYOUTS[d.design](g);
  if (d.logo && d.logoPos && d.logoPos !== "off") drawLogo(g, d.logo, d.logoPos);
  ctx.restore();
  return g.slots;
}

// ---------------------------------------------------------------------------
// Slides 2 and 3: a full bleed approved photo with the words laid over it
// ---------------------------------------------------------------------------

export type PhotoSlideInput = {
  text: string;
  cta?: string;
  palette: Palette;
  bodyFont: string;
  photo: ImageBitmap | null;
  focus: Focus;
  scrim: number;
  logo: HTMLImageElement | null;
  arrow: boolean;
  align?: Align;
  spacing?: number; // line height as a multiple of the text size
};

function fitText(ctx: Ctx, text: string, font: (s: number) => string, maxW: number, maxH: number, max: number, min: number, lh: number) {
  let s = max;
  let ls: string[] = [];
  for (; s >= min; s -= 2) {
    ctx.font = font(s);
    ls = wrap(ctx, text, maxW);
    if (ls.length * s * lh <= maxH && ls.every((l) => ctx.measureText(l).width <= maxW + 1)) break;
  }
  s = Math.max(s, min);
  ctx.font = font(s);
  return { size: s, lines: wrap(ctx, text, maxW), lh: Math.round(s * lh) };
}

export function drawUniPhotoSlide(ctx: Ctx, d: PhotoSlideInput): Slot[] {
  const W = XW, H = XH;
  const slots: Slot[] = [{ i: 0, x: 0, y: 0, w: W, h: H, rot: 0 }];
  ctx.save();
  ctx.textBaseline = "top";
  ctx.fillStyle = d.palette.green;
  ctx.fillRect(0, 0, W, H);
  if (d.photo) {
    const s = Math.max(W / d.photo.width, H / d.photo.height);
    const dw = d.photo.width * s, dh = d.photo.height * s;
    ctx.drawImage(d.photo, -(dw - W) * d.focus[0], -(dh - H) * d.focus[1], dw, dh);
  } else {
    ctx.fillStyle = shade(d.palette.green, 0.2);
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = rgba(d.palette.light, 0.6);
    ctx.font = `600 40px ${d.bodyFont}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Choose a photo", W / 2, H / 2);
    ctx.textBaseline = "top";
  }
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(80, d.scrim)) / 100})`;
  ctx.fillRect(0, 0, W, H);
  const gr = ctx.createLinearGradient(0, H * 0.3, 0, H);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = gr;
  ctx.fillRect(0, H * 0.3, W, H * 0.7);

  const hasCta = !!d.cta?.trim();
  const body = fitText(ctx, d.text, (s) => `600 ${s}px ${d.bodyFont}`, 860, hasCta ? 500 : 620, 66, 32, d.spacing ?? 1.3);
  const bodyH = body.lines.length * body.lh;
  let pillW = 0, pillH = 0, ctaLines: string[] = [];
  const ctaSize = 38, ctaLh = 48;
  if (hasCta) {
    ctx.font = `700 ${ctaSize}px ${d.bodyFont}`;
    ctaLines = wrap(ctx, d.cta!.trim(), 720);
    pillW = Math.min(840, Math.max(...ctaLines.map((l) => ctx.measureText(l).width)) + 90);
    pillH = ctaLines.length * ctaLh + 56;
  }
  const gap = hasCta ? 56 : 0;
  let y = Math.round(H * 0.56 - (bodyH + gap + pillH) / 2);

  ctx.shadowColor = "rgba(0,0,0,0.42)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${body.size}px ${d.bodyFont}`;
  y = drawAligned(ctx, body.lines, y, body.lh, d.align, W);
  ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  if (hasCta) {
    y += gap;
    const px = (W - pillW) / 2;
    ctx.fillStyle = d.palette.frame;
    ctx.beginPath(); ctx.roundRect(px, y, pillW, pillH, 40); ctx.fill();
    ctx.fillStyle = d.palette.ink;
    ctx.font = `700 ${ctaSize}px ${d.bodyFont}`;
    ctx.textAlign = "center";
    ctaLines.forEach((l, i) => ctx.fillText(l, W / 2, y + 28 + i * ctaLh));
  }
  if (d.arrow) {
    ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const ay = H - 96;
    ctx.beginPath(); ctx.moveTo(W - 168, ay); ctx.lineTo(W - 88, ay); ctx.moveTo(W - 104, ay - 13); ctx.lineTo(W - 88, ay); ctx.lineTo(W - 104, ay + 13); ctx.stroke();
  }
  if (d.logo) {
    const s = Math.min(240 / d.logo.width, 80 / d.logo.height);
    ctx.drawImage(d.logo, W - 50 - d.logo.width * s, 40, d.logo.width * s, d.logo.height * s);
  }
  ctx.restore();
  return slots;
}
