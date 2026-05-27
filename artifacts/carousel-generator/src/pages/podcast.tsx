import { useState, useEffect } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PODCAST_KEY = "podcast-auth";
const CORRECT = "Podcast26";

const SECTIONS = [
  {
    number: "01",
    title: "The Warm Up",
    subtitle: "Gets them relaxed. Builds trust. Sets the tone.",
    questions: [
      "How did you actually end up in aesthetics — was it planned or did life just take you there?",
      "What did your family think when you told them what you were doing?",
      "What does a typical Tuesday look like for you?",
    ],
  },
  {
    number: "02",
    title: "The Controversial Stuff",
    subtitle: "Stops the scroll. Positions them as an authority.",
    questions: [
      "What's the one treatment you wish clients would stop asking for?",
      "What do you think about practitioners who only ever show perfect results online?",
      "What would you tell someone who's gone to a cheap injector and regrets it?",
      "What's the biggest lie the aesthetics industry tells consumers?",
    ],
  },
  {
    number: "03",
    title: "Safety & Why People Think It's OK",
    subtitle: "This is where they get passionate. Let them go. Don't interrupt.",
    questions: [
      "Why do you think people still go to unregulated practitioners even when they know the risks?",
      "What would you say to someone who's chosen a practitioner based on price alone?",
      "What's the worst case you've seen or heard about from a client who went elsewhere first?",
      "Do you think social media has made the problem better or worse — and why?",
      "What do you wish the government would actually do about regulation?",
      "When a client comes to you after a botched treatment, what does that conversation look like?",
      "What's the one thing you'd want every person researching aesthetics online to know before they book anywhere?",
      "Do you think unqualified practitioners should be named and shamed publicly?",
      "What does proper training actually look like — and why does it cost what it costs?",
      "If your own daughter came to you and said she wanted lip filler from someone she'd found on Instagram, what would you tell her?",
    ],
  },
  {
    number: "04",
    title: "The Endearing Stuff",
    subtitle: "Builds emotional connection. Makes them human.",
    questions: [
      "Tell me about a client who made you want to cry in a good way.",
      "When did you first know you were actually good at this?",
      "What do you genuinely love about the face you work on most?",
    ],
  },
  {
    number: "05",
    title: "The Personal Stuff",
    subtitle: "Makes them memorable. Differentiates them from every other injector online.",
    questions: [
      "What do people get wrong about you when they first meet you?",
      "What would you be doing if aesthetics didn't exist?",
      "What are you most proud of that has nothing to do with work?",
    ],
  },
];

function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === CORRECT) {
      localStorage.setItem(PODCAST_KEY, "true");
      onAuth();
    } else {
      setError("Incorrect password");
      setPassword("");
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <img
            src="/sms-logo.png"
            alt="Social Media Sister"
            className="h-20 w-20 rounded-full object-cover mx-auto mb-6"
          />
          <p className="text-white/50 text-sm">Enter the password to view</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="pl-10 pr-11 h-12 text-base bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-white/30"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <Button
            type="submit"
            disabled={!password}
            className="w-full h-12 text-base bg-white text-black hover:bg-white/90 font-semibold"
          >
            Enter
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function Podcast() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(PODCAST_KEY) === "true") {
      setAuthed(true);
    }
    setChecking(false);
  }, []);

  if (checking) return null;
  if (!authed) return <PasswordGate onAuth={() => setAuthed(true)} />;

  let questionNumber = 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-6 py-16 md:py-24">

        {/* Photo + What to Expect */}
        <div className="mb-20">

          {/* Photo */}
          <div className="mb-10">
            <img
              src="/podcast-host.png"
              alt="Social Media Sister"
              className="w-full max-w-sm mx-auto md:mx-0 rounded-2xl object-cover grayscale"
              style={{ aspectRatio: "3/4", objectPosition: "center top" }}
            />
          </div>

          {/* What to Expect heading */}
          <div className="mb-8">
            <h1 className="font-bold text-3xl md:text-4xl leading-tight mb-3">
              What to Expect at a Content Day
            </h1>
            <div style={{ width: "100%", height: "3px", background: "#E91976", borderRadius: "2px" }} />
          </div>

          {/* Copy */}
          <div className="space-y-5 text-white/80 text-base md:text-lg leading-relaxed">
            <p>You don't need to prepare a single thing.</p>
            <p>
              No notes. No practised answers. No idea in your head of what you're going to say.
              That's not a problem. That's the whole plan.
            </p>
            <p>
              The best content doesn't come from people who've rehearsed. It comes from the pause
              before the words arrive. The moment a memory lands on your face before you've even
              found the sentence for it. That's what your followers actually want to see.
            </p>
            <p>
              I stay off camera. This is your conversation, not a performance. The questions are
              there to get you talking — some about your work, some about you, one or two that
              might make you stop and think for just a second.
            </p>
            <p>
              We're building something that no polished, filtered, perfect-lighting video can
              touch. We're building the version of you that people already trust, already like,
              already want to spend time with.
            </p>
            <p className="text-white font-semibold">You just have to show up.</p>
          </div>

          {/* Divider */}
          <div className="mt-14 mb-2">
            <p className="text-white/25 text-xs uppercase tracking-widest font-semibold">
              This isn't an interview
            </p>
            <p className="text-white/40 text-sm mt-2">
              It's just a chance to get to know you — and let your followers see the face behind the business.
            </p>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-16">
          {SECTIONS.map((section) => (
            <div key={section.number}>
              <div className="mb-8">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-white/20 font-mono text-sm">{section.number}</span>
                  <h2 className="text-white/90 font-semibold text-lg tracking-wide uppercase">{section.title}</h2>
                </div>
                <p className="text-white/35 text-sm ml-9">{section.subtitle}</p>
              </div>

              <div className="space-y-8 ml-9">
                {section.questions.map((q) => {
                  questionNumber++;
                  const num = questionNumber;
                  return (
                    <div key={num} className="flex gap-4 items-start">
                      <span className="text-white/20 font-mono text-sm mt-1.5 flex-shrink-0 w-5 text-right">{num}</span>
                      <p className="text-white font-bold text-xl md:text-2xl leading-snug">
                        {q}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-24 pt-8 border-t border-white/10 text-center">
          <p className="text-white/20 text-xs">Social Media Sister · Content Days</p>
        </div>
      </div>
    </div>
  );
}
