import { useSearch } from "wouter";
import { Builder } from "./ten-free-admin";

// Where Vanessa builds a club member's month: their treatments, About me posts and hooks, drawn in her browser and sent to the approval queue.
export default function ClubBuilder() {
  const id = new URLSearchParams(useSearch()).get("id");
  if (!id || !id.startsWith("club-")) return <div className="max-w-xl mx-auto p-6 text-sm">Open a member's month from the <a className="underline" href={`${(import.meta.env.BASE_URL || "/").replace(/\/$/, "")}/club-admin`}>club admin</a> to build it.</div>;
  return <Builder key={id} id={id} />;
}
