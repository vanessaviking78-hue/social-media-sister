// NO 1 BODY SCULPTING, Birmingham: 18 sections of 6 posts each, the same layout as Castle Clinic and Dr Kathryn Bell.
// Friendly, warm and dry, in her own first person voice. No prices, no promises, no medicine names.
// Edit this list to add or rename posts. Each name is crossed out once it has been scheduled.
// The 44 carousel types on /no1 are separate and stay exactly as they are.

export type No1SectionId =
  | "ems" | "pad4" | "rf" | "cav" | "intimate" | "lymph" | "poly" | "lymphface" | "needle" | "derma" | "peel" | "lips" | "led"
  | "volume" | "weightloss" | "menopause" | "tweets" | "about" | "fit" | "safety";

// word is the comment word on the last slide. Sections with no word close on a friendly area line.
export const NO1_SECTIONS: { id: No1SectionId; label: string; word: string }[] = [
  { id: "ems", label: "EMS HIEMT", word: "EMS" },
  { id: "pad4", label: "4 paddle EMS", word: "PADDLES" },
  { id: "rf", label: "Radiofrequency", word: "RADIOFREQUENCY" },
  { id: "cav", label: "Cavitation", word: "CAVITATION" },
  { id: "intimate", label: "Intimate wellness machine", word: "INTIMATE" },
  { id: "lymph", label: "Body lymphatic drainage", word: "LYMPHATIC" },
  { id: "poly", label: "Polynucleotides", word: "POLY" },
  { id: "lymphface", label: "Lymphatic facial", word: "FACIAL" },
  { id: "needle", label: "Microneedling", word: "MICRONEEDLING" },
  { id: "derma", label: "Dermaplaning", word: "DERMAPLANING" },
  { id: "peel", label: "Amiko chemical peel", word: "PEEL" },
  { id: "lips", label: "Amiko lip skin boosters", word: "LIPS" },
  { id: "led", label: "LED red light", word: "RED LIGHT" },
  { id: "volume", label: "Volume loss and why it happens", word: "" },
  { id: "weightloss", label: "Weight loss support", word: "" },
  { id: "menopause", label: "Menopause memes and jokes", word: "" },
  { id: "tweets", label: "Weight loss tweets", word: "" },
  { id: "about", label: "About her", word: "" },
  { id: "fit", label: "Keeping fit at 40", word: "" },
  { id: "safety", label: "Safety", word: "" },
];

export type No1SectionPost = { id: string; group: No1SectionId; label: string; brief: string; word: string };

const WORD = new Map(NO1_SECTIONS.map((s) => [s.id, s.word]));
const p = (id: string, group: No1SectionId, label: string, brief: string): No1SectionPost => ({ id, group, label, brief, word: WORD.get(group) || "" });

const TREAT_NOTE = " Friendly, funny and reassuring, in plain words. No promises, no results, no prices. A consultation always comes first.";

export const NO1_SECTION_POSTS: No1SectionPost[] = [
  // EMS HIEMT
  p("ems1", "ems", "What EMS HIEMT actually is", "A cheerful explanation of EMS HIEMT: high intensity electromagnetic muscle stimulation, done lying down, no needles, no sweating." + TREAT_NOTE),
  p("ems2", "ems", "What it feels like", "An honest, funny description of the sensation of an EMS session: a strong tingling and tightening, nothing mysterious, and how I talk you through it so you feel in control." + TREAT_NOTE),
  p("ems3", "ems", "What happens in your first session", "A warm walk through a first visit: a chat, a look at what you would like, getting comfortable, how long it takes and what to wear." + TREAT_NOTE),
  p("ems4", "ems", "Who EMS may suit", "Who I see coming in for EMS and why a consultation matters first. Honest about who it may not be suitable for, never pushy." + TREAT_NOTE),
  p("ems5", "ems", "EMS and the gym, an honest chat", "A dry, friendly post on how EMS sits alongside the things you already do, without claiming it replaces anything. No promises about results." + TREAT_NOTE),
  p("ems6", "ems", "Questions I get asked about EMS", "A relaxed question and answer: how long a session takes, whether you need a course, what to eat beforehand. Only general, truthful answers." + TREAT_NOTE),

  // 4 PADDLE EMS
  p("pd1", "pad4", "Why four paddles", "A fun explanation of why four paddles means more than one area can be worked in the same visit. Light and chatty." + TREAT_NOTE),
  p("pd2", "pad4", "Tummy, thighs, bum and arms", "Which areas people most often ask me about for a 4 paddle session, said kindly and without judgement. No promises." + TREAT_NOTE),
  p("pd3", "pad4", "How a 4 paddle session runs", "A step by step, friendly walk through the session: getting comfy, paddles placed, the machine building up, a chat while it works." + TREAT_NOTE),
  p("pd4", "pad4", "Where did my bum go", "A funny, relatable post about the way our shape changes over the years and a kind invitation to come and talk about it. No promises." + TREAT_NOTE),
  p("pd5", "pad4", "What to wear and bring", "Practical and chatty: comfy clothes, water, and what to expect on the day. Reassuring for anyone nervous about being seen." + TREAT_NOTE),
  p("pd6", "pad4", "Booking your first 4 paddle consultation", "A warm invitation to a no pressure consultation. Say you can ask anything and nobody is judged. No offers and no prices." + TREAT_NOTE),

  // RADIOFREQUENCY
  p("rf1", "rf", "What radiofrequency is", "A simple, friendly explanation of radiofrequency: a warming treatment used to support skin that feels firmer, done as a course." + TREAT_NOTE),
  p("rf2", "rf", "What the warmth feels like", "An honest description of the gentle warmth, often compared to a hot stone massage, and how I check you are comfortable throughout." + TREAT_NOTE),
  p("rf3", "rf", "Skin that feels a bit looser", "A kind, funny post about skin that has changed with time, weight or children, and an invitation to talk about what you would like." + TREAT_NOTE),
  p("rf4", "rf", "Why it is done as a course", "Why radiofrequency is usually a series of sessions rather than one, explained simply. No promises about results." + TREAT_NOTE),
  p("rf5", "rf", "Radiofrequency for the face and the body", "That radiofrequency can be used on different areas, and that I advise after seeing you in person. Light and welcoming." + TREAT_NOTE),
  p("rf6", "rf", "Looking after your skin between sessions", "General, friendly skin care tips between sessions: water, sun care, gentle products. Nothing medical." + TREAT_NOTE),

  // CAVITATION
  p("cv1", "cav", "What cavitation is", "A friendly explanation of cavitation: a non invasive body contouring treatment using ultrasound, usually part of a course." + TREAT_NOTE),
  p("cv2", "cav", "What cavitation feels like", "An honest, funny description of the sensation: a warm, slightly buzzy feeling, and how I keep you comfortable." + TREAT_NOTE),
  p("cv3", "cav", "Cavitation and skin tightening", "How cavitation is often paired with other treatments for skin that feels looser, said carefully with no promises." + TREAT_NOTE),
  p("cv4", "cav", "Cavitation and volume loss", "A kind post about changes in body shape and volume and how a tailored plan is built at a consultation. No promises." + TREAT_NOTE),
  p("cv5", "cav", "What to do before and after", "Friendly general guidance: drink plenty of water, wear comfy clothes, and ask me anything. Never medical advice." + TREAT_NOTE),
  p("cv6", "cav", "Myths about cavitation", "Gently and humorously busting a couple of general myths, without claiming any result. Honest and kind." + TREAT_NOTE),

  // INTIMATE WELLNESS MACHINE
  p("in1", "intimate", "What the intimate wellness machine is", "A warm, matter of fact introduction to a seated comfort and confidence treatment. Keep it about comfort, confidence and a private, kind consultation. Never claim it treats bladder control, incontinence or any condition." + TREAT_NOTE),
  p("in2", "intimate", "Let us talk about the bit nobody talks about", "A gentle, funny post that makes it easier to start the conversation about intimate comfort and confidence in midlife. No medical claims." + TREAT_NOTE),
  p("in3", "intimate", "What a session is like", "A calm walk through a session: private, seated, fully clothed in the right places, and talked through every step so you feel safe. No claims." + TREAT_NOTE),
  p("in4", "intimate", "Privacy and dignity", "How I protect your privacy and dignity at every stage, said warmly and plainly. Reassuring for the nervous." + TREAT_NOTE),
  p("in5", "intimate", "Midlife, comfort and confidence", "A kind post for women in midlife about feeling comfortable in their own skin, with a consultation first. No medical claims." + TREAT_NOTE),
  p("in6", "intimate", "Questions you are too shy to ask", "A relaxed question and answer that invites shy questions, answered kindly and generally. Never promise or diagnose." + TREAT_NOTE),

  // BODY LYMPHATIC DRAINAGE
  p("ly1", "lymph", "What body lymphatic drainage is", "A friendly explanation of a gentle treatment many clients find relaxing, leaving legs and middles feeling lighter." + TREAT_NOTE),
  p("ly2", "lymph", "Heavy legs and tired middles", "A relatable, funny post about feeling heavy and puffy and an invitation to try something gentle. No claims." + TREAT_NOTE),
  p("ly3", "lymph", "What a session feels like", "A soothing description of the light, rhythmic touch and the relaxation. Wonderfully calm, a little funny." + TREAT_NOTE),
  p("ly4", "lymph", "Why it is so relaxing", "Why many clients find it calming and how it fits into a self care routine. No medical claims." + TREAT_NOTE),
  p("ly5", "lymph", "Drainage and your treatment plan", "How drainage can sit alongside other treatments, advised after a consultation. Friendly and general." + TREAT_NOTE),
  p("ly6", "lymph", "A little treat for yourself", "A warm post about giving yourself an hour. Lightly funny, kind about bodies, no promises." + TREAT_NOTE),

  // POLYNUCLEOTIDES
  p("po1", "poly", "What polynucleotides are", "A simple, friendly introduction to polynucleotides as a skin quality treatment that supports skin that looks and feels more nourished. Do not describe the method." + TREAT_NOTE),
  p("po2", "poly", "Tired, crepey skin", "A relatable post about skin that looks tired, particularly around the eyes and neck, and a kind invitation to talk. No promises." + TREAT_NOTE),
  p("po3", "poly", "What to expect at your appointment", "A calm walk through the appointment in general terms: a consultation, a chat about your skin and how I look after you. Do not describe the method." + TREAT_NOTE),
  p("po4", "poly", "Skin quality, not a new face", "A light, honest post about wanting to look like yourself, only rested. Gentle and funny, no promises." + TREAT_NOTE),
  p("po5", "poly", "Looking after your skin around treatment", "General, friendly skin care habits that help any skin: water, sun care, sleep and gentle products." + TREAT_NOTE),
  p("po6", "poly", "Is it right for you", "Why a consultation comes first and who it may not suit. Honest and unpressured." + TREAT_NOTE),

  // LYMPHATIC FACIAL
  p("lf1", "lymphface", "What a lymphatic facial is", "A friendly description of a gentle facial using drainage techniques, relaxing, and a good one for tired and puffy looking faces." + TREAT_NOTE),
  p("lf2", "lymphface", "Puffy mornings", "A funny, relatable post about waking up with a face like a pillow and what a calm facial can feel like. No claims." + TREAT_NOTE),
  p("lf3", "lymphface", "What happens in the room", "A soothing description of the treatment room, the touch and the quiet hour you get to yourself." + TREAT_NOTE),
  p("lf4", "lymphface", "A facial before a big day", "Warm, practical thinking about treating yourself before an event, with no promises about how you will look." + TREAT_NOTE),
  p("lf5", "lymphface", "Who loves a lymphatic facial", "Who tends to book one: busy mums, tired professionals, anyone who needs to switch off. Kind and a little funny." + TREAT_NOTE),
  p("lf6", "lymphface", "Skin care at home that goes with it", "General, friendly home care ideas: gentle cleansing, moisture, sun care. Nothing medical and no product names." + TREAT_NOTE),

  // MICRONEEDLING
  p("mn1", "needle", "What microneedling is", "A friendly explanation of microneedling as a skin treatment used to support texture and tone, done as a course after a consultation." + TREAT_NOTE),
  p("mn2", "needle", "Is microneedling scary", "An honest, funny look at the fear of the word needle and how I keep you comfortable and informed throughout." + TREAT_NOTE),
  p("mn3", "needle", "Your first appointment", "A calm walk through a first visit: consultation, a chat about your skin and what to expect on the day." + TREAT_NOTE),
  p("mn4", "needle", "Looking after your skin afterwards", "General, friendly aftercare: gentle products, sun care, patience. Say I will give you personal advice at your appointment." + TREAT_NOTE),
  p("mn5", "needle", "Why a course", "Why microneedling is usually a series of sessions, explained simply and with no promises." + TREAT_NOTE),
  p("mn6", "needle", "Skin texture chat", "A light, kind post about skin texture changes and an invitation to a consultation. No promises." + TREAT_NOTE),

  // DERMAPLANING
  p("dp1", "derma", "What dermaplaning is", "A simple, cheerful explanation of a gentle exfoliating treatment that leaves skin smooth and makeup sitting better." + TREAT_NOTE),
  p("dp2", "derma", "The peach fuzz question", "A funny, honest post about peach fuzz and the myth that it grows back thicker. Say what is generally understood, kindly, with no promises." + TREAT_NOTE),
  p("dp3", "derma", "What it feels like", "A reassuring description of the gentle sensation and how quick the treatment is." + TREAT_NOTE),
  p("dp4", "derma", "Makeup and dermaplaning", "A light, relatable post about foundation sitting better on smooth skin. No promises." + TREAT_NOTE),
  p("dp5", "derma", "Who dermaplaning may suit", "Who it may suit and who it may not, with a consultation first. Honest and unpressured." + TREAT_NOTE),
  p("dp6", "derma", "Dermaplaning aftercare", "General, friendly aftercare: gentle products, sun care and keeping hands off. Personal advice given on the day." + TREAT_NOTE),

  // AMIKO CHEMICAL PEEL
  p("pl1", "peel", "What a chemical peel is", "A friendly explanation of an Amiko peel, chosen for the skin in front of me, always after a consultation." + TREAT_NOTE),
  p("pl2", "peel", "Peeling, but not like that", "A funny post easing the fear of the word peel: what to expect in general terms and how I look after you." + TREAT_NOTE),
  p("pl3", "peel", "Choosing the right peel for your skin", "Why I choose a peel for the skin in front of me rather than one for everyone. Warm and honest." + TREAT_NOTE),
  p("pl4", "peel", "Sun care and peels", "Friendly, general sun care guidance around skin treatments, and why it matters all year round in Birmingham." + TREAT_NOTE),
  p("pl5", "peel", "What your skin may do afterwards", "General, calm information on how skin can feel afterwards and that I explain it all at your appointment. No promises." + TREAT_NOTE),
  p("pl6", "peel", "A peel and a chat", "A warm invitation to a consultation to talk about what you would like from your skin. No offers, no prices." + TREAT_NOTE),

  // AMIKO LIP SKIN BOOSTERS
  p("lp1", "lips", "What lip skin boosters are", "A friendly explanation of an Amiko lip skin treatment for dry, tired lips, all about hydration and how the lips feel." + TREAT_NOTE),
  p("lp2", "lips", "Dry lips that never feel right", "A relatable, funny post about permanently dry lips and balm that never quite works. A kind invitation to talk." + TREAT_NOTE),
  p("lp3", "lips", "Hydration, not size", "A light post making clear this is about how lips look and feel, not about changing their shape. Honest and kind. No promises." + TREAT_NOTE),
  p("lp4", "lips", "What happens at the appointment", "A calm, general walk through the appointment, with a consultation first." + TREAT_NOTE),
  p("lp5", "lips", "Lip care you can do at home", "Friendly general lip care: water, sun care, gentle exfoliation, and not picking. No product names." + TREAT_NOTE),
  p("lp6", "lips", "Lipstick, lines and lip care", "A warm, funny post about lipstick that will not sit nicely and a gentle invitation to a chat." + TREAT_NOTE),

  // LED RED LIGHT
  p("le1", "led", "What LED red light is", "A relaxing description of a light treatment: you lie back and it is over before you have finished the playlist." + TREAT_NOTE),
  p("le2", "led", "The easiest treatment on the menu", "A funny post about how little effort red light takes and how it can be a lovely pause in a busy week. No claims." + TREAT_NOTE),
  p("le3", "led", "What it feels like", "A soothing, honest description: gentle warmth, eyes covered, quiet time. No claims." + TREAT_NOTE),
  p("le4", "led", "Red light with other treatments", "How red light can follow other treatments as a calming finish, advised after consultation. General only." + TREAT_NOTE),
  p("le5", "led", "A lunch hour treat", "A warm post about fitting self care into a busy day. Light and friendly." + TREAT_NOTE),
  p("le6", "led", "Questions about red light", "A relaxed question and answer: how long, how often, what to wear. General, truthful answers only." + TREAT_NOTE),

  // VOLUME LOSS AND WHY IT HAPPENS
  p("vl1", "volume", "Volume loss, explained kindly", "A warm, plain explanation of why the face and body can lose volume with age, weight change and life. Gentle and never alarming. No promises." + TREAT_NOTE),
  p("vl2", "volume", "Why your jeans fit differently now", "A funny, relatable post about the way our bodies change over time and why that is normal. A kind invitation to talk." + TREAT_NOTE),
  p("vl3", "volume", "Volume loss and weight loss", "How losing weight can change volume in the face and body, explained kindly. No promises, nothing medical." + TREAT_NOTE),
  p("vl4", "volume", "Volume loss in midlife", "How hormones and midlife can play a part in the way we look and feel, said kindly and generally." + TREAT_NOTE),
  p("vl5", "volume", "Where volume loss shows first", "The places people most often notice changes, said with humour and kindness, and how a plan starts with a conversation." + TREAT_NOTE),
  p("vl6", "volume", "Looking after your skin through change", "Friendly, general habits that support skin through change: water, protein, sun care, sleep. Nothing medical." + TREAT_NOTE),

  // WEIGHT LOSS SUPPORT
  p("wl1", "weightloss", "Weight loss and your skin", "A kind post about how skin and body can change after losing weight, with no judgement. Never name any medicine or injection." + TREAT_NOTE),
  p("wl2", "weightloss", "After weight loss, then what", "A warm post for anyone who has lost weight and feels their body has not quite caught up, with an invitation to talk about gentle support. Never name any medicine." + TREAT_NOTE),
  p("wl3", "weightloss", "Loose skin chat", "A kind, honest and funny post about loose skin and the treatments I offer that people often ask about. No promises." + TREAT_NOTE),
  p("wl4", "weightloss", "Looking after your body on a weight loss plan", "General, friendly habits to look after your skin and muscles while losing weight: protein, movement, water. Nothing medical. Never name any medicine." + TREAT_NOTE),
  p("wl5", "weightloss", "Feeling confident through the change", "A supportive post about feeling at home in a changing body. No judgement, no promises." + TREAT_NOTE),
  p("wl6", "weightloss", "How I can support you", "Which of my treatments clients often ask about alongside weight loss, said generally and kindly after a consultation. Never name any medicine." + TREAT_NOTE),

  // MENOPAUSE MEMES AND JOKES
  p("mp1", "menopause", "Hot flush humour", "A dry, warm and funny post about hot flushes and sitting in front of the freezer. Relatable and kind, no medical claims." + TREAT_NOTE),
  p("mp2", "menopause", "Where did my memory go", "A funny, relatable post about brain fog and walking into rooms and forgetting why. Warm and never medical." + TREAT_NOTE),
  p("mp3", "menopause", "The sleep I used to have", "A funny post about night waking and a kind nod to self care. No claims." + TREAT_NOTE),
  p("mp4", "menopause", "Midlife body, new rules", "A witty post about the way our bodies change in midlife and how I see it every day at the clinic. Kind and reassuring." + TREAT_NOTE),
  p("mp5", "menopause", "Things nobody told us", "A list style post of funny, relatable midlife surprises, all kind and general. No medical claims." + TREAT_NOTE),
  p("mp6", "menopause", "You are not imagining it", "A warm, validating post for women in midlife that makes them feel seen, with a gentle, funny edge. No medical claims." + TREAT_NOTE),

  // WEIGHT LOSS TWEETS
  p("tw1", "tweets", "Tweet: the scales do not know", "A short, punchy, funny tweet style post about scales not telling the whole story. Kind about bodies." + TREAT_NOTE),
  p("tw2", "tweets", "Tweet: loose skin", "A short, dry tweet style post about the surprise of loose skin after weight loss, kind and funny." + TREAT_NOTE),
  p("tw3", "tweets", "Tweet: the new wardrobe", "A short tweet style post about needing a whole new wardrobe after weight loss. Light and funny." + TREAT_NOTE),
  p("tw4", "tweets", "Tweet: the downsides nobody mentions", "A short tweet style post about the things people do not warn you about after losing weight, like a face that looks tired. Honest, kind, funny." + TREAT_NOTE),
  p("tw5", "tweets", "Tweet: the compliments", "A short tweet style post about people commenting on your body. Dry, funny, protective of the reader." + TREAT_NOTE),
  p("tw6", "tweets", "Tweet: still you", "A short, warm tweet style post that says you are still you, whatever size you are. Kind and a little funny." + TREAT_NOTE),

  // ABOUT HER
  p("ab1", "about", "Meet me", "A warm, funny introduction to me and how I work, using only general, truthful statements. Never invent a number, an award, a year or a name." + TREAT_NOTE),
  p("ab2", "about", "Why I do this", "A sincere piece on why I love looking after women and their confidence. General and truthful, with nothing invented." + TREAT_NOTE),
  p("ab3", "about", "What it is like to walk into my clinic", "A friendly description of a visit: a warm welcome, no judgement and plenty of time. General and truthful." + TREAT_NOTE),
  p("ab4", "about", "How I look after nervous clients", "How I make nervous clients feel safe: listening first, explaining everything and going at your pace." + TREAT_NOTE),
  p("ab5", "about", "Things I will always be honest about", "A promise of honest, unpressured care in my own straight talking voice: what you need, what can wait and what is not right for you." + TREAT_NOTE),
  p("ab6", "about", "Birmingham, this is for you", "A friendly local post saying hello to Birmingham and the women who come to see me, warm and funny. Never invent a fact about the city." + TREAT_NOTE),
  p("fit1", "fit", "Keeping fit at 40, the honest version", "A real, friendly post about keeping fit at 40: finding something you will actually keep doing rather than a punishing plan. Kind, warm and a little funny. No exercise prescriptions, no diets, no calorie or weight numbers, no medical claims, no promises. Never assume the reader is a beginner or an expert."),
  p("fit2", "fit", "Keeping fit at 40, strength and energy", "A warm post about why so many women at 40 enjoy strength work and moving daily, said generally and kindly, nothing medical. Kind, warm and a little funny. No exercise prescriptions, no diets, no calorie or weight numbers, no medical claims, no promises. Never assume the reader is a beginner or an expert."),
  p("fit3", "fit", "Keeping fit at 40, showing up on tired days", "A relatable post for the busy woman at 40 who wants to look after herself, with a dry sense of humour about the tired days. Kind, warm and a little funny. No exercise prescriptions, no diets, no calorie or weight numbers, no medical claims, no promises. Never assume the reader is a beginner or an expert."),
  p("sf1", "safety", "Safety first, what to check before you book anything", "A calm, clear post on what to check before booking any treatment anywhere: who is treating you, their training and insurance, a proper consultation first and no pressure on the day. Never invent a name, qualification, year, number, client or story: only say what I could truthfully say about how I work. No promises, no prices, no medicine names, no website."),
  p("sf2", "safety", "Why I always say no sometimes", "A warm, honest post on why a good practitioner will sometimes say not today or not this, and why that is a sign you are in safe hands. Never invent a name, qualification, year, number, client or story: only say what I could truthfully say about how I work. No promises, no prices, no medicine names, no website."),
  p("sf3", "safety", "Aftercare and what to do if you are worried", "A reassuring post on why aftercare matters and why you should always feel able to contact your practitioner if something does not feel right. Never invent a name, qualification, year, number, client or story: only say what I could truthfully say about how I work. No promises, no prices, no medicine names, no website."),
];

export const NO1_SECTION_CLINIC = { name: "NO 1 BODY SCULPTING", area: "Birmingham" } as const;
