// Cover titles and straplines for the Comic Strip tool. {name} is the clinician,
// {clinic} is the clinic. Written in the feral, sarcastic voice, always on the side of proper care.

export const COMIC_TITLES: string[] = [
  "{name} Says No (Nicely)",
  "{clinic}: Absolutely Not",
  "{clinic} Confidential",
  "Tales from {clinic}",
  "{name} Will See You Now",
  "{name} vs The Internet",
  "{name} and the Very Bad Idea",
  "The Adventures of {name}, Professional Party Pooper",
  "Issue 1: {clinic} Refuses Again",
  "Nope, Said {name}",
  "Absolutely Not, Darling",
  "The Patch Test Chronicles",
  "Consultation Required",
  "Sensible Shoes, Steady Hands",
  "Backstreet Betty Must Be Stopped",
  "Ask Before You Book",
  "Not On My Watch",
  "The Clinic That Said No",
];

export const COMIC_STRAPLINES: string[] = [
  "Contains sarcasm and consent forms",
  "Warning: may cause eye rolls and better decisions",
  "Suitable for sensible people only",
  "The one where nobody gets plunger lips",
];

export const COMIC_ISSUES: string[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export function fillTitle(template: string, name: string, clinic: string): string {
  const n = name.trim() || "Your Clinician";
  const c = clinic.trim() || name.trim() || "The Clinic";
  return template.replace(/\{name\}/g, n).replace(/\{clinic\}/g, c);
}
