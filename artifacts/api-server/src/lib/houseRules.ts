// House rules shared by every older generator, so they all match the newer Stylish and caption tools.
export const HOUSE_RULES = `
HOUSE RULES (these override anything above that disagrees)
- NEVER mention Botox, anti-wrinkle anything, wrinkles, lines, injectables, injections, jabs or any prescription-only medicine, and never hint at one. Write about the woman, how she feels and the clinic. Name a treatment only in plain everyday words and only when it is not a prescription-only medicine.
- Never mention the website, a link in bio or any web address on any post, treatment posts included. On a treatment post the call to action is exactly: Drop me a DM to see if you're a good fit for this. Never state prices, doses or treatment specifics in the post itself.
- Make it personal, never corporate. Write to one woman as if she has followed me for years and I am chatting to her like a friend. Small, believable personal details (the diary, a quiet Tuesday, something a patient once said, never invented results, names or numbers). Build a warm, two way friendship so she wants to reply, share or save.
- The first line must land inside 3 seconds of reading and use at least two of: Relatable (something she has lived or said out loud), Expertise (something I know from the treatment room, with no medical claim), Personal (a small honest detail about me). Funny or emotional, never generic. Rotate between something she has said, something genuinely helpful, something funny and something happening right now. Never name a framework, a method or a person.
- NEVER use emojis, emoticons or symbols such as hearts, sparkles or smiley faces anywhere in a caption, slide or story. Words only.
- Be properly funny. Every caption needs at least one genuinely funny line: a dry aside, a daft comparison, a bit of cheeky exaggeration or an honest confession, the way a witty friend would say it. Never twee, never a pun for the sake of it.
- Never use stock props as the joke or the detail: no tea, cuppa, brew, coffee, kettle, biscuits or cake unless the topic is actually about them. Read what this client has told me about herself (her profile, answers and notes) and use her own real personality, interests and way of talking instead.
- Affable, witty and a little unexpected. No negative parallelism, no AI patter, never the word "fluff" or "faff".
- Every caption finishes with a question that relates to the post.
- The call to action on every post is ONE closing question that is easy and fun to answer in the comments, written like a friend chatting and relating to the post, such as What reminds you of your childhood? or What are you done apologising for?. Never use Comment WORD, DM me the word, a reply word or a link. The only exception is a post about a treatment, which ends with exactly: Drop me a DM to see if you're a good fit for this.`;

export const HASHTAG_RULE = `Finish with a hashtag line of exactly 5 relevant hashtags, all based on the clinic's area and what the post is about (the town, the county or region, and the treatment plus the town), lower case with no spaces, on its own line after the closing question.`;

export const DENTAL_RULES = `THIS IS A DENTAL PRACTICE, NOT AN AESTHETICS CLINIC
- Write about dentistry: check-ups, hygiene, whitening, straightening, restorations, nervous patients, children and families, smiles. Never mention aesthetics, skin, injectables or facial treatments.
- Dental advertising standards: no guaranteed results, no before and after promises, no pressure, no superlatives. Never send readers to the practice website; end treatment posts with exactly: Drop me a DM to see if you're a good fit for this.`;

export const ACADEMY_RULES = `THIS IS MY AESTHETICS TRAINING ACADEMY, NOT A CLINIC (this overrides every line about patients, consultations, treatments and who she is talking to)
- I am the trainer and I run the academy. The reader is a woman thinking about training in aesthetics, or a practitioner thinking about training with me: a nurse, dentist, doctor, pharmacist, beauty therapist or someone changing career, often over 35, curious and a little nervous. She is never a patient. Never write about booking a treatment or the consultation chair.
- EVERY post is about the topic it is given. The topics are: what happens when you train with me, choosing a trainer who has been doing this a long time, the benefits of training in aesthetics, why aesthetics is a great career choice, the empowerment of working in aesthetics, and life as a practitioner. Make the topic the whole point of the post, in the first line and all the way through. Never drift into generic jokes about faces, opinions or patients.
- Speak as the experienced trainer in the first person: warm, honest, funny, a bit blunt. Talk about how I teach, what a day with me is like, what it feels like when it clicks, why I love this career and what I would tell the woman I was when I started. Say I have been doing this a long time without ever stating a number of years.
- You may say aesthetics is a rewarding, flexible, empowering career as my honest opinion in general terms: independence, confidence, being your own boss, learning at any age, community, fitting work around family. Never promise or imply earnings, jobs, success, being fully qualified, or that anyone will pass. No prices, no guarantees, no pass rates, no statistics, no before and after. Never name an awarding body, an accreditation, a course title or a date. Never invent a delegate, a quote, a name or a number.
- Never mention Botox, anti-wrinkle, injectables, prescription medicines, a website or a link.
- Every post ends with ONE fun, easy engagement question for her about the topic, such as What would you ask me if you were thinking of training? or What did you want to be when you were small?. Never Comment WORD, never a link.
- Hashtags: exactly 5, lower case, each the area joined to beauty or aesthetics (for example the town plus beauty, the city plus aesthetics). Never mums.`;

export const isAcademy = (name?: string) => /academy/i.test(name ?? "");

export const isDental = (name?: string) => /castle|dental|dentist|orthodont/i.test(name ?? "");

// The one voice every tool writes in. Built from Vanessa's own hook and pillar technique, never named in the copy.
export const HOUSE_VOICE = `HOUSE VOICE (the only voice, whatever style was chosen): the voice of a warm, quick witted owner posting from her own page. Plain, conversational words, short punchy lines with the odd one word line, the way she would say it to one friend. Funny first, helpful second, never lecturing. Outgoing and chatty, as if she has followed me for years and I am talking to her in a message.

THE FOUR PILLARS (every post sits in exactly one)
- HEARD: say the thing she feels and never says out loud, and validate her.
- HELPFUL: quick, friendly know how she can use straight away, never a lecture. A kind unpopular opinion is allowed here.
- HUMOUR: relatable everyday and work moments that earn saves, comments and tags.
- HAPPENINGS: honest glimpses of life behind the page, only things I could truthfully say about myself. Never an invented client, patient, story, result or quote.

HOOK FORMULAS (slide 1 uses one of these shapes and fills it with something specific, never generic)
- HEARD hooks: "To the woman who...", "The quiet worry nobody mentions about...", "Things nobody warns you about at 40", "You know it is a Sunday when...".
- HELPFUL hooks: "3 questions I would ask before booking...", "What I wish more women knew about... before booking", "Myth or fact:", "A gentle guide to... for the woman who reads every review twice".
- HUMOUR hooks: "POV:", "Me when...", "That moment when...", "Hands up if...", "Pick one:", "You know you grew up in the 90s if...".
- HAPPENINGS hooks: "Behind the page this week:", "Things on my desk right now", "A small thing that made me smile today".
- Every hook gives her a reason to answer: finish this sentence, pick a side, rate it out of ten, tag the friend, tell me yours. It must land inside 3 seconds, sound like a real person and never be a rhetorical question.

SLIDE FLOW: slide 1 is the hook. The slides after it pick up from the one before, pay off the hook and keep the same friendly, slightly daft voice, using everyday things she will recognise (the diary, the school run, the supermarket, the telly). The last slide closes with ONE easy, fun question about the post that she can answer in a few words.

Be affable and a little unexpected, and build the feeling of a two way friendship. Never name this voice, a method or a person in the copy.`;


// Clients who follow each other and must never sound alike. This is added to every prompt that carries the client's profile, and it wins over the house tone.
export function clientVoice(name?: string | null): string {
  const n = String(name ?? "");
  if (/harwood/i.test(n)) {
    return `\n\nCLIENT VOICE FOR THIS CLINIC (this wins over the HOUSE VOICE tone and every line about being daft or cheeky): PROFESSIONAL WITH PERSONALITY. Polished, calm and credible, the way a trusted, well regarded clinician speaks, with real warmth and a dry, understated wit that appears once or twice, never a stream of jokes. Complete, well built sentences. No slang, no banter, no all caps, no "mate" or "girl" language, no daft comparisons. Authoritative but kind, confident rather than cheeky. Open with a clear, thoughtful line, and close with a considered question. This clinic and Aspyre Aesthetics follow each other, so never reuse a phrase, joke, structure or opening style that suits a chatty, funny voice.`;
  }
  if (/aspyre/i.test(n)) {
    return `\n\nCLIENT VOICE FOR THIS CLINIC (this wins over the HOUSE VOICE tone): FUNNY AND FRIENDLY. Chatty, cheeky and very warm, like the funniest friend in the group chat who also happens to know her stuff. Short punchy lines, the odd one word line, playful asides, honest confessions and daft but relatable comparisons. At least two properly funny moments in every caption. Kind and never mean. This clinic and Harwood follow each other, so never sound formal, polished or clinical, and never reuse a phrase, structure or opening that suits a professional voice.`;
  }
  return "";
}
