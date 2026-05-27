export default function Competition() {
  return (
    <div className="min-h-screen bg-black text-white">

      {/* Hero photo */}
      <div className="w-full relative overflow-hidden" style={{ maxHeight: "70vh" }}>
        <img
          src="/podcast-host.png"
          alt="Social Media Sister"
          className="w-full object-cover object-top grayscale"
          style={{ maxHeight: "70vh" }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, transparent 40%, black 100%)",
          }}
        />
      </div>

      <div className="max-w-2xl mx-auto px-6 pb-20 -mt-16 relative z-10">

        {/* Heading */}
        <div className="mb-10">
          <p className="text-xs uppercase tracking-widest text-white/40 font-semibold mb-3">
            Social Media Sister
          </p>
          <h1 className="font-bold text-4xl md:text-5xl leading-tight mb-4">
            Win a Content Day
          </h1>
          <div
            style={{ width: "100%", height: "3px", background: "#E91976", borderRadius: "2px" }}
          />
        </div>

        {/* Intro text — placeholder */}
        <div className="space-y-4 text-white/80 text-base md:text-lg leading-relaxed mb-14">
          <p>
            Competition details coming soon.
          </p>
        </div>

        {/* How to enter — placeholder */}
        <div className="mb-14">
          <h2 className="font-bold text-2xl md:text-3xl text-white mb-3">How to Enter</h2>
          <div
            style={{ width: "60px", height: "3px", background: "#E91976", borderRadius: "2px" }}
            className="mb-6"
          />
          <p className="text-white/50 text-sm italic">Entry details coming soon.</p>
        </div>

        {/* Rules — placeholder */}
        <div className="mb-14">
          <h2 className="font-bold text-2xl md:text-3xl text-white mb-3">Terms &amp; Conditions</h2>
          <div
            style={{ width: "60px", height: "3px", background: "#E91976", borderRadius: "2px" }}
            className="mb-6"
          />
          <p className="text-white/50 text-sm italic">Rules coming soon.</p>
        </div>

        <div className="mt-16 pt-8 border-t border-white/10 text-center">
          <p className="text-white/20 text-xs">Social Media Sister · socialmediasister.co.uk</p>
        </div>
      </div>
    </div>
  );
}
