import { Link } from "wouter";
import { useEffect, useState } from "react";
import { Image as ImageIcon, User, Grid, BookOpen, Film, Play, Palette, MessageSquareText, Library, CalendarDays, BarChart3, ShieldCheck, ImagePlus, Sparkles, Bot, Wand2, MessageSquare, ScrollText, Package, Inbox, UploadCloud, Layers, CalendarRange, TableProperties, Eye, Send, FileText, CalendarClock, Twitter, TrendingUp, Newspaper, Camera, Sun, ListChecks, AlertTriangle, Target, Activity, Gift, Smartphone, PenSquare, Megaphone, BookImage, Video, Clapperboard, Captions, Trophy, Rows3 } from "lucide-react";
import { LogOut } from "lucide-react";

const TOOLS = [
{
href: "/daily-focus",
group: "today",
icon: Target,
name: "Daily Focus",
description: "Your 12 for today: 2 personal, 10 client, picked live by who has gone quiet. Plus a reminders panel for renewals, invoicing and one-off flags.",
color: "from-pink-500/20 to-pink-500/5",
border: "hover:border-pink-500/50",
iconColor: "text-pink-400",
},
{
href: "/today",
group: "today",
icon: Sun,
name: "Today",
description: "What's going out today, for every client, with live posting status pulled straight from the scheduler.",
color: "from-yellow-500/20 to-yellow-500/5",
border: "hover:border-yellow-500/50",
iconColor: "text-yellow-400",
},
{
href: "/scheduler",
group: "admin",
icon: CalendarClock,
name: "Posting Scheduler",
description: "See everything queued, published or failed across every client. Retry, cancel, reschedule, or drag posts to a new date in the preview feed.",
color: "from-blue-500/20 to-blue-500/5",
border: "hover:border-blue-500/50",
iconColor: "text-blue-400",
},
{
href: "/catch-up",
group: "today",
icon: AlertTriangle,
name: "Catch-Up Plan",
description: "Live, not a snapshot: pulls straight from the scheduler and Meta connections every time you open it. Fires to sort today, clients with no post ever, and accounts that still aren't connected. Tick each one off as you clear it.",
color: "from-red-500/20 to-red-500/5",
border: "hover:border-red-500/50",
iconColor: "text-red-400",
},
{
href: "/health-check",
group: "today",
icon: Activity,
name: "Health Check",
description: "Live check of every client’s Instagram and Facebook connection, plus their last successful and failed post, so you can catch a dropped connection before a client does.",
color: "from-teal-500/20 to-teal-500/5",
border: "hover:border-teal-500/50",
iconColor: "text-teal-400",
},
{
href: "/homework",
group: "today",
icon: MessageSquareText,
name: "Homework",
description: "Set a weekly set of three questions for every client to answer in their portal. Their replies land here, ready to be turned straight into content.",
color: "from-fuchsia-500/20 to-fuchsia-500/5",
border: "hover:border-fuchsia-500/50",
iconColor: "text-fuchsia-400",
},
{
href: "/reel-progress",
group: "today",
icon: Clapperboard,
name: "100 Reels Progress",
description: "See how far every client has got through their 100 reel checklist, so you know who needs a nudge and who is smashing it.",
color: "from-violet-500/20 to-violet-500/5",
border: "hover:border-violet-500/50",
iconColor: "text-violet-400",
},
{
href: "/reel-captioning",
group: "today",
icon: Captions,
name: "Reel Captions",
description: "Turn a client's raw uploaded reel into a captioned one — transcribe, edit the text, and burn it on in their chosen font and colours.",
color: "from-pink-500/20 to-pink-500/5",
border: "hover:border-pink-500/50",
iconColor: "text-pink-400",
},
{
href: "/reels-challenge-admin",
group: "today",
icon: Trophy,
name: "Reels Challenge",
description: "See who's smashing the 30 reel ideas and who needs a nudge, with a full leaderboard across every client.",
color: "from-yellow-500/20 to-yellow-500/5",
border: "hover:border-yellow-500/50",
iconColor: "text-yellow-400",
},
{
href: "/bonus-content",
group: "today",
icon: Gift,
name: "Bonus Content",
description: "Drop images, videos and notes into a specific client's own space, ready for them to see and use whenever they check their portal.",
color: "from-amber-500/20 to-amber-500/5",
border: "hover:border-amber-500/50",
iconColor: "text-amber-400",
},
{
href: "/client-portal-view",
group: "today",
icon: Smartphone,
name: "Client Portal",
description: "Pick a client and see their portal exactly as they see it, posts, homework and bonus content included.",
color: "from-violet-500/20 to-violet-500/5",
border: "hover:border-violet-500/50",
iconColor: "text-violet-400",
},
{
href: "/blog",
group: "content",
icon: PenSquare,
name: "Blog",
description: "Post images and text to the public blog and to every client portal, all in one go.",
color: "from-cyan-500/20 to-cyan-500/5",
border: "hover:border-cyan-500/50",
iconColor: "text-cyan-400",
},
{
href: "/broadcasts",
group: "content",
icon: Megaphone,
name: "Broadcasts",
description: "Send a ready-made post from the content library to every connected client, branded automatically.",
color: "from-orange-500/20 to-orange-500/5",
border: "hover:border-orange-500/50",
iconColor: "text-orange-400",
},
{
href: "/veo-video",
group: "content",
icon: Video,
name: "AI Video Generator",
description: "Describe a video and generate it from scratch with Veo, then broadcast it straight out to every client.",
color: "from-red-500/20 to-red-500/5",
border: "hover:border-red-500/50",
iconColor: "text-red-400",
},
{
href: "/reports",
group: "admin",
icon: FileText,
name: "Monthly Report",
description: "Top posts, Instagram enquiries, followers and engagement rate for a client, month by month.",
color: "from-emerald-500/20 to-emerald-500/5",
border: "hover:border-emerald-500/50",
iconColor: "text-emerald-400",
},
{
href: "/checklist",
group: "today",
icon: ListChecks,
name: "Client Checklist",
description: "One ongoing row per client. Hex colours, images, carousels, quotes, before and afters, footnote and logo, connected accounts. Always a live snapshot before your next 90-day batch.",
color: "from-emerald-500/20 to-emerald-500/5",
border: "hover:border-emerald-500/50",
iconColor: "text-emerald-400",
},
{
href: "/analytics",
group: "admin",
icon: BarChart3,
name: "Analytics",
description: "Track what you have created, per client and over time.",
color: "from-emerald-500/20 to-emerald-500/5",
border: "hover:border-emerald-500/50",
iconColor: "text-emerald-400",
},
{
href: "/calendar",
group: "admin",
icon: CalendarDays,
name: "Calendar",
description: "Plan the month ahead. Drag, drop and reschedule with ease.",
color: "from-orange-500/20 to-orange-500/5",
border: "hover:border-orange-500/50",
iconColor: "text-orange-400",
},
{
href: "/approval",
group: "today",
icon: ShieldCheck,
name: "Approvals",
description: "Share a link so clients can approve or flag images before posting.",
color: "from-red-500/20 to-red-500/5",
border: "hover:border-red-500/50",
iconColor: "text-red-400",
},
{
href: "/presets",
group: "admin",
icon: Palette,
name: "Presets",
description: "Save and load client brand colours, fonts, logos and style settings.",
color: "from-indigo-500/20 to-indigo-500/5",
border: "hover:border-indigo-500/50",
iconColor: "text-indigo-400",
},
{
href: "/brand",
group: "admin",
icon: Wand2,
name: "Brand Settings",
description: "Set your default logo, colours and fonts. Applied automatically when you open any generator.",
color: "from-[#E91976]/20 to-[#E91976]/5",
border: "hover:border-[#E91976]/50",
iconColor: "text-[#E91976]",
},
{
href: "/library",
group: "admin",
icon: Library,
name: "Library",
description: "Browse and manage all your saved content in one place.",
color: "from-lime-500/20 to-lime-500/5",
border: "hover:border-lime-500/50",
iconColor: "text-lime-400",
},
{
href: "/preview",
group: "today",
icon: Eye,
name: "Client Content Preview",
description: "Share a public preview link with each client so they can see their upcoming scheduled posts, as an Instagram grid or calendar view.",
color: "from-emerald-500/20 to-emerald-500/5",
border: "hover:border-emerald-500/50",
iconColor: "text-emerald-400",
},
{
href: "/approval-bundles",
group: "today",
icon: Send,
name: "Client Approvals",
description: "Send carousels to clients for approval via a shareable link. They review, approve or reject each one, and approved posts queue automatically.",
color: "from-green-500/20 to-green-500/5",
border: "hover:border-green-500/50",
iconColor: "text-green-400",
},
{
href: "/bundle-requests",
group: "admin",
icon: Inbox,
name: "Bundle Requests",
description: "Review inbound trial bundle requests from /trialbundle. Generate or decline each one.",
color: "from-pink-500/20 to-pink-500/5",
border: "hover:border-pink-500/50",
iconColor: "text-pink-400",
},
{
href: "/bundle-builder",
group: "admin",
icon: Package,
name: "Trial Bundle",
description: "Generate a full content preview bundle to share with a new clinic prospect. One link, four formats.",
color: "from-yellow-500/20 to-yellow-500/5",
border: "hover:border-yellow-500/50",
iconColor: "text-yellow-400",
},
{
href: "/news",
group: "admin",
icon: Newspaper,
name: "News & Updates",
description: "Post news and updates on a client's behalf. Shows straight away on their content preview page.",
color: "from-indigo-500/20 to-indigo-500/5",
border: "hover:border-indigo-500/50",
iconColor: "text-indigo-400",
},
{
href: "/resources",
group: "admin",
icon: FileText,
name: "Resource Library",
description: "Upload PDFs, cheat sheets and guides once. Every client sees them straight in their portal.",
color: "from-blue-500/20 to-blue-500/5",
border: "hover:border-blue-500/50",
iconColor: "text-blue-400",
},
{
href: "/revenue-ideas",
group: "admin",
icon: TrendingUp,
name: "Revenue Ideas",
description: "Generate, review and approve fresh revenue ideas per client, with a history of everything approved.",
color: "from-emerald-500/20 to-emerald-500/5",
border: "hover:border-emerald-500/50",
iconColor: "text-emerald-400",
},
{
href: "/upload-schedule",
group: "content",
icon: UploadCloud,
name: "Upload & Schedule",
description: "Upload images made in Canva or anywhere else. Write or generate a caption, pick a time, and queue it.",
color: "from-green-500/20 to-green-500/5",
border: "hover:border-green-500/50",
iconColor: "text-green-400",
},
{
href: "/dm-automations",
group: "admin",
icon: Bot,
name: "DM Responder",
description: "Auto-reply to Instagram DMs that match a keyword. Set it once, let it run.",
color: "from-cyan-500/20 to-cyan-500/5",
border: "hover:border-cyan-500/50",
iconColor: "text-cyan-400",
},
{
href: "/dm-prompts",
group: "admin",
icon: MessageSquare,
name: "DM Prompts",
description: "Generate human-sounding DM templates for new followers, enquiries, check-ins, and more.",
color: "from-rose-500/20 to-rose-500/5",
border: "hover:border-rose-500/50",
iconColor: "text-rose-400",
},
{
href: "/intake",
group: "content",
icon: Wand2,
name: "Content Machine",
description: "Upload a client intake form, pick a batch size, and generate a month of ready-to-post captions.",
color: "from-yellow-500/20 to-yellow-500/5",
border: "hover:border-yellow-500/50",
iconColor: "text-yellow-400",
},
{
href: "/reel-scripts",
group: "content",
icon: ScrollText,
name: "Reel Scripts",
description: "Write a reel script with a hook, talking points, and a call to action — ready to speak on camera.",
color: "from-orange-500/20 to-orange-500/5",
border: "hover:border-orange-500/50",
iconColor: "text-orange-400",
},
{
href: "/content-generator",
group: "content",
icon: Wand2,
name: "Content Generator",
description: "Enter clinician details, pick a tone, and generate carousel CSVs ready for the builder.",
color: "from-pink-500/20 to-pink-500/5",
border: "hover:border-pink-500/50",
iconColor: "text-pink-400",
},
{
href: "/tweet-maker",
group: "content",
icon: Twitter,
name: "Tweet Maker",
description: "Draft and format posts for X/Twitter, in the client's voice, ready to copy or schedule.",
color: "from-sky-500/20 to-sky-500/5",
border: "hover:border-sky-500/50",
iconColor: "text-sky-400",
},
{
href: "/submissions",
group: "admin",
icon: Inbox,
name: "Before & After Inbox",
description: "Clinics upload their before and after photos and a short story straight to you.",
color: "from-teal-500/20 to-teal-500/5",
border: "hover:border-teal-500/50",
iconColor: "text-teal-400",
},
{
href: "/seamless-bulk",
group: "carousel",
icon: Layers,
name: "Seamless Carousels",
description: "Drop wide strips, pick 2 to 5 slides, and it cuts them into seamless slides ready to schedule.",
color: "from-fuchsia-500/20 to-fuchsia-500/5",
border: "hover:border-fuchsia-500/50",
iconColor: "text-fuchsia-400",
},
{
href: "/seamless-carousel",
group: "carousel",
icon: Grid,
name: "Seamless Caro Builder",
description: "Pick a client's backgrounds, add their approved photos, drag each into place, and composite a whole batch of seamless carousels in one go.",
color: "from-amber-500/20 to-amber-500/5",
border: "hover:border-amber-500/50",
iconColor: "text-amber-400",
},
{
href: "/background-builder",
group: "carousel",
icon: Palette,
name: "Background Builder",
description: "Describe a background in your own words and it generates one sized for Seamless Carousels, ready to download, add to Canva, or send straight to a client.",
color: "from-amber-500/20 to-amber-500/5",
border: "hover:border-amber-500/50",
iconColor: "text-amber-400",
},
{
href: "/highlight-covers",
group: "carousel",
icon: BookImage,
name: "Highlight Cover Maker",
description: "Pick a client, confirm their brand colours, list out the highlight names, and get a matching set of Instagram highlight covers back with the right icon on each one automatically.",
color: "from-amber-500/20 to-amber-500/5",
border: "hover:border-amber-500/50",
iconColor: "text-amber-400",
},
{
href: "/selfie-carousels",
group: "carousel",
icon: Camera,
name: "Selfie to Carousels",
description: "One make-up-free selfie in, twelve AI photoshoot images out, each composited into its own carousel ready to caption and schedule.",
color: "from-violet-500/20 to-violet-500/5",
border: "hover:border-violet-500/50",
iconColor: "text-violet-400",
},
{
href: "/single-image",
group: "carousel",
icon: ImagePlus,
name: "Single Image",
description: "One photo, one message. Quick single-post with text overlay.",
color: "from-violet-500/20 to-violet-500/5",
border: "hover:border-violet-500/50",
iconColor: "text-violet-400",
},
{
href: "/showcase-builder",
group: "content",
icon: Play,
name: "Sample Showcase",
description: "Build a 6-carousel showcase for a prospect. Auto-plays, ends on their grid, one link to send.",
color: "from-pink-500/20 to-pink-500/5",
border: "hover:border-pink-500/50",
iconColor: "text-pink-400",
},
{
href: "/bulk-carousel",
group: "carousel",
icon: Layers,
name: "Bulk Carousel Creator",
description: "Upload a CSV and image folder. Renders branded 4-slide carousels for every row and exports a master ZIP or sends direct to the scheduler.",
color: "from-cyan-500/20 to-cyan-500/5",
border: "hover:border-cyan-500/50",
iconColor: "text-cyan-400",
},
  {
    href: "/editorial-posts",
    group: "carousel",
    icon: Rows3,
    name: "Editorial Posts",
    description: "Upload 12 photos and one CSV. Renders branded 3-slide editorial carousels, one photo reused across all three slides, with a font and colour picker per slide.",
    color: "from-cyan-500/20 to-cyan-500/5",
    border: "hover:border-cyan-500/50",
    iconColor: "text-cyan-400",
  },
{
href: "/animated-carousels",
group: "carousel",
icon: Film,
name: "Animated Carousels",
description: "Upload your finished MP4 animated carousels, add captions, and schedule them in bulk. They post to Instagram as Reels.",
color: "from-fuchsia-500/20 to-fuchsia-500/5",
border: "hover:border-fuchsia-500/50",
iconColor: "text-fuchsia-400",
},
{
href: "/about-me-studio",
group: "content",
icon: User,
name: "About Me Studio",
description: "Upload a photo, it removes the background over a blurred version and lays your title, phrases and teaser on top.",
color: "from-rose-500/20 to-rose-500/5",
border: "hover:border-rose-500/50",
iconColor: "text-rose-400",
},
{
href: "/personal-page",
group: "content",
icon: User,
name: "Personal Page",
description: "Build a stand-alone about-me post: a photo up top, hand-picked sections like values and treatments, signed off with love from the client.",
color: "from-rose-500/20 to-rose-500/5",
border: "hover:border-rose-500/50",
iconColor: "text-rose-400",
},
{
href: "/before-after",
group: "content",
icon: ImagePlus,
name: "Before & After Maker",
description: "Upload a before and after, pick a template, add the story and post it.",
color: "from-rose-500/20 to-rose-500/5",
border: "hover:border-rose-500/50",
iconColor: "text-rose-400",
},
{
href: "/quotes",
group: "content",
icon: MessageSquareText,
name: "Quote Maker",
description: "Drop in a CSV of quotes and get bold, bright quote cards in your colours.",
color: "from-amber-500/20 to-amber-500/5",
border: "hover:border-amber-500/50",
iconColor: "text-amber-400",
},
{
href: "/meme",
group: "content",
icon: Sparkles,
name: "Meme Maker",
description: "Kind, funny memes for women over 40. Your photo, your voice, never a wrinkle in sight.",
color: "from-fuchsia-500/20 to-fuchsia-500/5",
border: "hover:border-fuchsia-500/50",
iconColor: "text-fuchsia-400",
},
{
href: "/stories",
group: "content",
icon: BookOpen,
name: "Stories",
description: "Create Instagram Story engagement posts with questions and custom designs.",
color: "from-sky-500/20 to-sky-500/5",
border: "hover:border-sky-500/50",
iconColor: "text-sky-400",
},
{
href: "/bulk-stories",
group: "content",
icon: CalendarRange,
name: "Bulk Story Scheduler",
description: "Upload a CSV of story questions and a set of images. Queues a full month of story posts with polls, quizzes, or question boxes in one go.",
color: "from-violet-500/20 to-violet-500/5",
border: "hover:border-violet-500/50",
iconColor: "text-violet-400",
},
{
href: "/reels",
group: "carousel",
icon: Film,
name: "Reels",
description: "Generate short-form video content with animated text overlays.",
color: "from-teal-500/20 to-teal-500/5",
border: "hover:border-teal-500/50",
iconColor: "text-teal-400",
},
{
href: "/video-overlay",
group: "carousel",
icon: Play,
name: "Video Overlay",
description: "Add branded text and logo overlays to existing video clips.",
color: "from-cyan-500/20 to-cyan-500/5",
border: "hover:border-cyan-500/50",
iconColor: "text-cyan-400",
},
{
href: "/ai-portrait-studio",
group: "content",
icon: Sparkles,
name: "AI Portrait Studio",
description: "Upload a reference photo and generate fresh AI portraits in multiple scenarios.",
color: "from-purple-500/20 to-purple-500/5",
border: "hover:border-purple-500/50",
iconColor: "text-purple-400",
},
{
href: "/client-bank",
group: "today",
icon: Package,
name: "Client Bank",
description: "Park finished carousels and single images against a client with no date attached. Invisible in their portal until you pull it out and schedule it or send it for approval.",
color: "from-pink-500/20 to-pink-500/5",
border: "hover:border-pink-500/50",
iconColor: "text-pink-400",
},
];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function Hub() {
const [newCount, setNewCount] = useState(0);
const [hwCount, setHwCount] = useState(0);
const [reelCaptionCount, setReelCaptionCount] = useState(0);
const [activeGroup, setActiveGroup] = useState<"today" | "admin" | "content" | "carousel">("today");
useEffect(() => {
const pw = localStorage.getItem("cybersuite-pw") || "";
if (!pw) return;
const load = () => {
fetch(`${BASE}/api/submissions`, { headers: { "x-app-password": pw, "Authorization": "Bearer " + pw } })
.then((r) => (r.ok ? r.json() : []))
.then((d) => {
const arr = Array.isArray(d) ? d : [];
setNewCount(arr.filter((x: any) => (x.status || "new") === "new").length);
})
.catch(() => {});
};
load();
const id = setInterval(load, 60000);
return () => clearInterval(id);
}, []);

useEffect(() => {
const pw = localStorage.getItem("cybersuite-pw") || "";
if (!pw) return;
const loadHw = () => {
fetch(`${BASE}/api/homework/replies`, { headers: { "x-app-password": pw, "Authorization": "Bearer " + pw } })
.then((r) => (r.ok ? r.json() : { replies: [] }))
.then((d) => {
const arr = Array.isArray(d.replies) ? d.replies : [];
setHwCount(arr.filter((r: any) => r.set && r.set.status === "active").length);
})
.catch(() => {});
};
loadHw();
const id = setInterval(loadHw, 60000);
return () => clearInterval(id);
}, []);

useEffect(() => {
const pw = localStorage.getItem("cybersuite-pw") || "";
if (!pw) return;
const loadReelCaptions = () => {
fetch(`${BASE}/api/reel-captions/submissions`, { headers: { "x-app-password": pw, "Authorization": "Bearer " + pw } })
.then((r) => (r.ok ? r.json() : { submissions: [] }))
.then((d) => {
const arr = Array.isArray(d.submissions) ? d.submissions : [];
setReelCaptionCount(arr.filter((s: any) => s.status === "pending").length);
})
.catch(() => {});
};
loadReelCaptions();
const id2 = setInterval(loadReelCaptions, 60000);
return () => clearInterval(id2);
}, []);
return (
<div className="min-h-[100dvh] w-full bg-background">
{/* Header */}
<header className="border-b border-border/30 py-5 px-8 flex items-center gap-4">
<img src="/sms-logo.png" alt="Social Media Sister" className="h-8 w-auto object-contain" />
<div>
<h1 className="font-bold text-xl leading-none">The CyberSuite</h1>
<p className="text-sm text-muted-foreground mt-0.5">Social Media Sister</p>
</div>

  <button
    type="button"
    onClick={() => {
      localStorage.removeItem("cybersuite-auth");
      localStorage.removeItem("cybersuite-pw");
      window.location.href = "/";
    }}
    className="ml-auto flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
  <LogOut className="w-4 h-4" />
  Log out
  </button>
</header>

{/* Grid */}
<main className="max-w-5xl mx-auto px-6 py-12">
<p className="text-muted-foreground text-base mb-10">Pick a tool to get started.</p>

{/* Group tabs */}
<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
{[
{ key: "today", label: "Today & Clients" },
{ key: "admin", label: "Admin" },
{ key: "content", label: "Content Creation" },
{ key: "carousel", label: "Carousel" },
].map((tab) => (
<button
key={tab.key}
type="button"
onClick={() => setActiveGroup(tab.key as typeof activeGroup)}
className={`rounded-2xl border p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
activeGroup === tab.key
? "border-pink-500/60 bg-gradient-to-br from-pink-500/30 to-pink-500/10 shadow-lg"
: "border-border/30 bg-gradient-to-br from-pink-500/10 to-pink-500/0 hover:border-pink-500/50"
}`}
>
<span className={`block text-base font-semibold ${activeGroup === tab.key ? "text-pink-300" : "text-foreground"}`}>{tab.label}</span>
</button>
))}
</div>

{/* Filtered grid */}
<div className="grid grid-cols-4 gap-4">
{TOOLS.filter((tool) => tool.group === activeGroup).map((tool) => <ToolCard key={tool.href} tool={tool} badge={tool.href === "/submissions" ? newCount : tool.href === "/homework" ? hwCount : tool.href === "/reel-captioning" ? reelCaptionCount : 0} />)}
</div>
</main>

<footer className="border-t border-border/20 mt-8 px-8 py-5 flex justify-center gap-6 text-xs text-muted-foreground">
<Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
<Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
<Link href="/data-deletion" className="hover:text-foreground transition-colors">Data Deletion</Link>
<Link href="/settings" className="hover:text-foreground transition-colors">Settings</Link>
</footer>
</div>
);
}

type Tool = typeof TOOLS[number];

function ToolCard({ tool, badge = 0 }: { tool: Tool; badge?: number }) {
const Icon = tool.icon;
return (
<Link href={tool.href}>
<div className={`group relative rounded-2xl border border-border/30 bg-gradient-to-br ${tool.color} p-5 cursor-pointer transition-all duration-200 ${tool.border} hover:shadow-lg hover:-translate-y-0.5 h-full`}>
{badge > 0 && (
<span className="absolute -top-2 -right-2 z-10 min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-pink-500 text-white text-xs font-bold shadow-lg ring-2 ring-background animate-pulse">
{badge > 99 ? "99+" : badge}
</span>
)}
<div className={`mb-3 ${tool.iconColor}`}>
<Icon className="w-7 h-7" />
</div>
<h2 className="font-semibold text-base mb-1.5 text-foreground">{tool.name}</h2>
<p className="text-sm text-muted-foreground leading-snug">{tool.description}</p>
</div>
</Link>
);
}
