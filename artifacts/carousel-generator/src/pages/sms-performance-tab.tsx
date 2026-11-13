import { Link } from "wouter";

// Performance tab on the Social Media Sister client page: a doorway to /smsperformance, the high performing posts page.
export default function SmsPerformanceTab() {
  return (
    <div className="p-6 max-w-xl">
      <h2 className="text-2xl font-black mb-2">What is working</h2>
      <p className="text-white/70 mb-4">Likes, comments, saves, shares and reach for every post for every client, with each client's top quarter marked high performing.</p>
      <Link href="/smsperformance" className="inline-block bg-[#ff1f8e] text-white font-black uppercase tracking-widest text-xs px-4 py-3">Open performance</Link>
    </div>
  );
}
