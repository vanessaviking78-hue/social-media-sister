import { CalendarCheck } from "lucide-react";
import { BRAND } from "@/config/brand";

// Public booking page for the free call. Lives at /freecall.
// Bookings go straight into Vanessa's Google Calendar (Mon to Thu, 9am to 1pm).
const BOOKING_URL = "https://calendar.app.google/mmnpkpU5fvemfQwY8";

export default function FreeCall() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="max-w-md text-center">
        <img
          src={BRAND.logoPath}
          alt={BRAND.productName}
          className="w-20 h-20 mx-auto mb-6 object-contain"
        />
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-pink-500/15 text-pink-400 mb-4">
          <CalendarCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-semibold mb-4">Book a free call with me</h1>
        <p className="text-muted-foreground mb-4 leading-relaxed">
          Book a free call with me and I will do you a content calendar
          tailored for you, right there on the call.
        </p>
        <p className="text-muted-foreground mb-8 leading-relaxed">
          After the call, I will send it over to you.
        </p>
        <a
          href={BOOKING_URL}
          className="inline-block rounded-full px-8 py-3 text-white font-medium"
          style={{ backgroundColor: BRAND.primaryColor }}
        >
          Pick your time
        </a>
      </div>
    </div>
  );
}
