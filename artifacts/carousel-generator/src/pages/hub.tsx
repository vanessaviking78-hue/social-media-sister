import { Link } from "wouter";
import { Image as ImageIcon, User, Grid, BookOpen, Film, Play, Palette, MessageSquareText, Library, CalendarDays, BarChart3, ShieldCheck, ImagePlus, Sparkles, Bot, Wand2, MessageSquare, ScrollText, Package, Inbox, UploadCloud, Layers, CalendarRange, TableProperties, Eye, Send, FileText } from "lucide-react";

const TOOLS = [
  {
    href: "/carousel",
    icon: ImageIcon,
    name: "Carousel",
    description: "Build multi-slide carousels with photos, fonts and AI captions.",
    color: "from-pink-500/20 to-pink-500/5",
    border: "hover:border-pink-500/50",
    iconColor: "text-pink-400",
  },
  {
    href: "/photo-carousel",
    icon: ImagePlus,
    name: "Photo Carousel",
    description: "Upload up to 12 photos, add text to each slide and export as a ZIP.",
    color: "from-rose-500/20 to-rose-500/5",
    border: "hover:border-rose-500/50",
    iconColor: "text-rose-400",
  },
  {
    href: "/single-image",
    icon: ImagePlus,
    name: "Single Image",
    description: "One photo, one message. Quick single-post with text overlay.",
    color: "from-violet-500/20 to-violet-500/5",
    border: "hover:border-violet-500/50",
    iconColor: "text-violet-400",
  },
  {
    href: "/about-me",
    icon: User,
    name: "About Me",
    description: "Upload your photo, remove the background and build a doodle-style About Me post.",
    color: "from-rose-500/20 to-rose-500/5",
    border: "hover:border-rose-500/50",
    iconColor: "text-rose-400",
  },
  {
    href: "/seamless-carousel",
    icon: Grid,
    name: "Seamless Carousel",
    description: "Slice one wide image into perfectly connected carousel slides.",
    color: "from-amber-500/20 to-amber-500/5",
    border: "hover:border-amber-500/50",
    iconColor: "text-amber-400",
  },
  {
    href: "/stories",
    icon: BookOpen,
    name: "Stories",
    description: "Create Instagram Story engagement posts with questions and custom designs.",
    color: "from-sky-500/20 to-sky-500/5",
    border: "hover:border-sky-500/50",
    iconColor: "text-sky-400",
  },
  {
    href: "/reels",
    icon: Film,
    name: "Reels",
    description: "Generate short-form video content with animated text overlays.",
    color: "from-teal-500/20 to-teal-500/5",
    border: "hover:border-teal-500/50",
    iconColor: "text-teal-400",
  },
  {
    href: "/video-overlay",
    icon: Play,
    name: "Video Overlay",
    description: "Add branded text and logo overlays to existing video clips.",
    color: "from-cyan-500/20 to-cyan-500/5",
    border: "hover:border-cyan-500/50",
    iconColor: "text-cyan-400",
  },
  {
    href: "/brand",
    icon: Wand2,
    name: "Brand Settings",
    description: "Set your default logo, colours and fonts. Applied automatically when you open any generator.",
    color: "from-[#E91976]/20 to-[#E91976]/5",
    border: "hover:border-[#E91976]/50",
    iconColor: "text-[#E91976]",
  },
  {
    href: "/presets",
    icon: Palette,
    name: "Presets",
    description: "Save and load client brand colours, fonts, logos and style settings.",
    color: "from-indigo-500/20 to-indigo-500/5",
    border: "hover:border-indigo-500/50",
    iconColor: "text-indigo-400",
  },
  {
    href: "/captions",
    icon: MessageSquareText,
    name: "Captions",
    description: "Write, organise and reuse captions by client and category.",
    color: "from-fuchsia-500/20 to-fuchsia-500/5",
    border: "hover:border-fuchsia-500/50",
    iconColor: "text-fuchsia-400",
  },
  {
    href: "/library",
    icon: Library,
    name: "Library",
    description: "Browse and manage all your saved content in one place.",
    color: "from-lime-500/20 to-lime-500/5",
    border: "hover:border-lime-500/50",
    iconColor: "text-lime-400",
  },
  {
    href: "/calendar",
    icon: CalendarDays,
    name: "Calendar",
    description: "Plan the month ahead. Drag, drop and reschedule with ease.",
    color: "from-orange-500/20 to-orange-500/5",
    border: "hover:border-orange-500/50",
    iconColor: "text-orange-400",
  },
  {
    href: "/analytics",
    icon: BarChart3,
    name: "Analytics",
    description: "Track what you have created, per client and over time.",
    color: "from-emerald-500/20 to-emerald-500/5",
    border: "hover:border-emerald-500/50",
    iconColor: "text-emerald-400",
  },
  {
    href: "/approval",
    icon: ShieldCheck,
    name: "Approvals",
    description: "Share a link so clients can approve or flag images before posting.",
    color: "from-red-500/20 to-red-500/5",
    border: "hover:border-red-500/50",
    iconColor: "text-red-400",
  },
  {
    href: "/ai-portrait-studio",
    icon: Sparkles,
    name: "AI Portrait Studio",
    description: "Upload a reference photo and generate fresh AI portraits in multiple scenarios.",
    color: "from-purple-500/20 to-purple-500/5",
    border: "hover:border-purple-500/50",
    iconColor: "text-purple-400",
  },
  {
    href: "/dm-automations",
    icon: Bot,
    name: "DM Responder",
    description: "Auto-reply to Instagram DMs that match a keyword. Set it once, let it run.",
    color: "from-cyan-500/20 to-cyan-500/5",
    border: "hover:border-cyan-500/50",
    iconColor: "text-cyan-400",
  },
  {
    href: "/intake",
    icon: Wand2,
    name: "Content Machine",
    description: "Upload a client intake form, pick a batch size, and generate a month of ready-to-post captions.",
    color: "from-yellow-500/20 to-yellow-500/5",
    border: "hover:border-yellow-500/50",
    iconColor: "text-yellow-400",
  },
  {
    href: "/dm-prompts",
    icon: MessageSquare,
    name: "DM Prompts",
    description: "Generate human-sounding DM templates for new followers, enquiries, check-ins, and more.",
    color: "from-rose-500/20 to-rose-500/5",
    border: "hover:border-rose-500/50",
    iconColor: "text-rose-400",
  },
  {
    href: "/reel-scripts",
    icon: ScrollText,
    name: "Reel Scripts",
    description: "Write a reel script with a hook, talking points, and a call to action — ready to speak on camera.",
    color: "from-orange-500/20 to-orange-500/5",
    border: "hover:border-orange-500/50",
    iconColor: "text-orange-400",
  },
  {
    href: "/bundle-builder",
    icon: Package,
    name: "Trial Bundle",
    description: "Generate a full content preview bundle to share with a new clinic prospect. One link, four formats.",
    color: "from-yellow-500/20 to-yellow-500/5",
    border: "hover:border-yellow-500/50",
    iconColor: "text-yellow-400",
  },
  {
    href: "/bundle-requests",
    icon: Inbox,
    name: "Bundle Requests",
    description: "Review inbound trial bundle requests from /trialbundle. Generate or decline each one.",
    color: "from-pink-500/20 to-pink-500/5",
    border: "hover:border-pink-500/50",
    iconColor: "text-pink-400",
  },
  {
    href: "/upload-schedule",
    icon: UploadCloud,
    name: "Upload & Schedule",
    description: "Upload images made in Canva or anywhere else. Write or generate a caption, pick a time, and queue it.",
    color: "from-green-500/20 to-green-500/5",
    border: "hover:border-green-500/50",
    iconColor: "text-green-400",
  },
  {
    href: "/bulk-carousel",
    icon: Layers,
    name: "Bulk Carousel Creator",
    description: "Upload a CSV and image folder. Renders branded 4-slide carousels for every row and exports a master ZIP or sends direct to the scheduler.",
    color: "from-cyan-500/20 to-cyan-500/5",
    border: "hover:border-cyan-500/50",
    iconColor: "text-cyan-400",
  },
  {
    href: "/csv-slide-carousel",
    icon: TableProperties,
    name: "CSV Slide Carousel",
    description: "Upload a single-column CSV. Each row becomes one branded slide. Prefix a row with | for a big hero headline, add a subtitle in column 2. Downloads as ZIP or sends to the scheduler.",
    color: "from-sky-500/20 to-sky-500/5",
    border: "hover:border-sky-500/50",
    iconColor: "text-sky-400",
  },
  {
    href: "/bulk-stories",
    icon: CalendarRange,
    name: "Bulk Story Scheduler",
    description: "Upload a CSV of story questions and a set of images. Queues a full month of story posts with polls, quizzes, or question boxes in one go.",
    color: "from-violet-500/20 to-violet-500/5",
    border: "hover:border-violet-500/50",
    iconColor: "text-violet-400",
  },
  {
    href: "/preview",
    icon: Eye,
    name: "Client Content Preview",
    description: "Share a public preview link with each client so they can see their upcoming scheduled posts, as an Instagram grid or calendar view.",
    color: "from-emerald-500/20 to-emerald-500/5",
    border: "hover:border-emerald-500/50",
    iconColor: "text-emerald-400",
  },
  {
    href: "/approval-bundles",
    icon: Send,
    name: "Client Approvals",
    description: "Send carousels to clients for approval via a shareable link. They review, approve or reject each one, and approved posts queue automatically.",
    color: "from-green-500/20 to-green-500/5",
    border: "hover:border-green-500/50",
    iconColor: "text-green-400",
  },
  {
    href: "/content-generator",
    icon: FileText,
    name: "Content Generator",
    description: "Fill in clinician details, paste post titles from the tick form, and get carousel-ready copy for every slide. Downloads as a CSV.",
    color: "from-pink-500/20 to-pink-500/5",
    border: "hover:border-pink-500/50",
    iconColor: "text-pink-400",
  },
];

export default function Hub() {
  return (
    <div className="min-h-[100dvh] w-full bg-background">
      {/* Header */}
      <header className="border-b border-border/30 py-5 px-8 flex items-center gap-4">
        <img src="/sms-logo.png" alt="Social Media Sister" className="h-8 w-auto object-contain" />
        <div>
          <h1 className="font-bold text-xl leading-none">The CyberSuite</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Social Media Sister</p>
        </div>
      </header>

      {/* Grid */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-muted-foreground text-base mb-10">Pick a tool to get started.</p>

        {/* 3 rows of 4 */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          {TOOLS.slice(0, 12).map((tool) => <ToolCard key={tool.href} tool={tool} />)}
        </div>

        {/* Last rows */}
        <div className="grid grid-cols-4 gap-4">
          {TOOLS.slice(12).map((tool) => <ToolCard key={tool.href} tool={tool} />)}
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

function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  return (
    <Link href={tool.href}>
      <div className={`group relative rounded-2xl border border-border/30 bg-gradient-to-br ${tool.color} p-5 cursor-pointer transition-all duration-200 ${tool.border} hover:shadow-lg hover:-translate-y-0.5 h-full`}>
        <div className={`mb-3 ${tool.iconColor}`}>
          <Icon className="w-7 h-7" />
        </div>
        <h2 className="font-semibold text-base mb-1.5 text-foreground">{tool.name}</h2>
        <p className="text-sm text-muted-foreground leading-snug">{tool.description}</p>
      </div>
    </Link>
  );
}
