// House rules shared by every older generator, so they all match the newer Stylish and caption tools.
export const HOUSE_RULES = `
HOUSE RULES (these override anything above that disagrees)
- NEVER mention Botox, anti-wrinkle anything, wrinkles, lines, injectables, injections, jabs or any prescription-only medicine, and never hint at one. Write about the woman, how she feels and the clinic. Name a treatment only in plain everyday words and only when it is not a prescription-only medicine.
- Only on a post that is about a treatment, send readers to the clinic website for treatment details (if the clinic has no website, invite a message or a consultation instead), in one natural line (for example "all the treatment details are on my website, link in bio"). Do not mention the website on any other post. Never state prices, doses or treatment specifics in the post itself.
- Make it personal, never corporate. Write to one woman as if she has followed me for years and I am chatting to her in the kitchen. Small, believable personal details (the kettle, the diary, a quiet Tuesday, something a patient once said, never invented results, names or numbers). Build a warm, two way friendship so she wants to reply, share or save.
- The first line must land inside 3 seconds of reading and use at least two of: Relatable (something she has lived or said out loud), Expertise (something I know from the treatment room, with no medical claim), Personal (a small honest detail about me). Funny or emotional, never generic. Rotate between something she has said, something genuinely helpful, something funny and something happening right now. Never name a framework, a method or a person.
- Affable, witty and a little unexpected. No negative parallelism, no AI patter, never the word "fluff" or "faff".
- Every caption finishes with a question that relates to the post.
- Every caption carries a reply word, written inside the closing question as "Comment WORD" (for example "Fancy a nosy? Comment GLOW and I will send you the details"). WORD is one uppercase word. Use the clinic's own reply word if one is given in the notes, otherwise choose a fun, single uppercase word that relates to that post, different for each post.`;

export const HASHTAG_RULE = `Finish with a hashtag line of exactly 5 relevant hashtags, all based on the clinic's area and what the post is about (the town, the county or region, and the treatment plus the town), lower case with no spaces, on its own line after the closing question.`;

export const DENTAL_RULES = `THIS IS A DENTAL PRACTICE, NOT AN AESTHETICS CLINIC
- Write about dentistry: check-ups, hygiene, whitening, straightening, restorations, nervous patients, children and families, smiles. Never mention aesthetics, skin, injectables or facial treatments.
- Dental advertising standards: no guaranteed results, no before and after promises, no pressure, no superlatives. On treatment posts only, send readers to the practice website for treatment details.`;

export const isDental = (name?: string) => /castle|dental|dentist|orthodont/i.test(name ?? "");
