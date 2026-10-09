import { useEffect } from "react";
import { CalendarCheck } from "lucide-react";
import { BRAND } from "@/config/brand";

// Public booking page for the free brainstorm call. Lives at /freecall.
// Bookings go straight into Vanessa's Google Calendar (Mon to Thu, 9am to 1pm).
const BOOKING_URL = "https://calendar.app.google/mmnpkpU5fvemfQwY8";

export default function FreeCall() {
  useEffect(() => {
    const t = setTimeout(() => {
      window.location.replace(BOOKING_URL);
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <img
          src={BRAND.logoPath}
          alt={BRAND.productName}
          className="w-20 h-20 mx-auto mb-6 object-contain"
        />
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-pink-500/15 text-pink-400 mb-4">
          <CalendarCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-semibold mb-3">Book your brainstorm</h1>
        <p className="text-muted-foreground mb-6">
          Grab a cuppa and let's have a proper natter about your clinic. I'm
          taking you to my diary now.
        </p>
        <a
          href={BOOKING_URL}
          className="inline-block rounded-full px-6 py-3 text-white font-medium"
          style={{ backgroundColor: BRAND.primaryColor }}
        >
          Pick your time
        </a>
      </div>
    </div>
  );
}
