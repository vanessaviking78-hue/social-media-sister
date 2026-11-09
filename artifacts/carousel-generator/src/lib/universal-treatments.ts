// UNIVERSAL: every non prescription treatment an aesthetic clinic offers, six posts each.
// Post 1 is the intro (headline is the treatment name). Posts 2 to 6 are the angles below.
// Edit this list to add or rename a treatment. The folder names in "Universal images" match `name`.

export type UGroupId = "fillers" | "regenerative" | "laser" | "skin" | "wellbeing";

export const U_GROUPS: { id: UGroupId; label: string; folder: string }[] = [
  { id: "fillers", label: "Fillers", folder: "Fillers" },
  { id: "regenerative", label: "Regenerative", folder: "Regenerative" },
  { id: "laser", label: "Laser hair removal", folder: "Laser hair removal" },
  { id: "skin", label: "Skin treatments", folder: "Skin treatments" },
  { id: "wellbeing", label: "Wellbeing", folder: "Wellbeing" },
];

export type UTreatment = {
  id: string;
  group: UGroupId;
  name: string; // also the folder name in Universal images
  mid?: string; // how it reads in the middle of a sentence (defaults to the lower case name)
  short?: string; // a friendly short form for headlines, e.g. polys
  compare: string; // the thing it is compared with in "3 things X do that Y doesn't"
  plural?: boolean; // "do" rather than "does"
  about: string; // plain background for the writer, never copied word for word
};

const t = (id: string, group: UGroupId, name: string, compare: string, about: string, extra: Partial<UTreatment> = {}): UTreatment => ({ id, group, name, compare, about, ...extra });

export const U_TREATMENTS: UTreatment[] = [
  // Fillers
  t("lip-filler", "fillers", "Lip filler", "lip balm", "Hyaluronic acid filler to add shape, balance and softness to the lips, built up gradually and kept natural.", { plural: false }),
  t("cheek-filler", "fillers", "Cheek filler", "contouring makeup", "Hyaluronic acid filler to restore support and definition to the cheeks.", { plural: false }),
  t("jawline-filler", "fillers", "Jawline filler", "a flattering camera angle", "Filler placed along the jawline to add definition and structure.", { plural: false }),
  t("chin-filler", "fillers", "Chin filler", "perfect posture", "Filler to balance the profile and add structure to the chin.", { plural: false }),
  t("tear-trough-filler", "fillers", "Tear trough filler", "concealer", "Careful filler under the eyes to soften the hollow and the shadow that sits there.", { plural: false }),
  t("nose-filler", "fillers", "Nose filler", "contouring makeup", "A non surgical way to refine the profile of the nose with filler, assessed very carefully.", { plural: false }),
  t("temple-filler", "fillers", "Temple filler", "a good fringe", "Filler to replace volume lost at the temples and soften the hollowing there.", { plural: false }),
  t("hand-filler", "fillers", "Hand filler", "hand cream", "Filler to restore volume to the backs of the hands.", { plural: false }),
  // Regenerative
  t("skin-boosters", "regenerative", "Skin boosters", "moisturiser", "Fine, hydrating hyaluronic acid treatments that work on skin quality, glow and hydration from within.", { plural: true }),
  t("profhilo", "regenerative", "Profhilo", "filler", "A hybrid hyaluronic acid treatment used to improve skin quality, hydration and bounce.", { mid: "Profhilo", plural: false }),
  t("polynucleotides", "regenerative", "Polynucleotides", "filler", "Polynucleotides are a purified DNA based substance used to support skin quality, hydration and the look of tired skin, often talked about for the delicate eye area.", { short: "polys", plural: true }),
  t("prp-facial", "regenerative", "PRP facial", "a face mask", "Platelet rich plasma, taken from your own blood, used to support skin quality and a natural glow.", { mid: "a PRP facial", plural: false }),
  t("prp-hair", "regenerative", "PRP hair restoration", "hair vitamins", "Platelet rich plasma used on the scalp to support the look of thicker, healthier hair.", { mid: "PRP for hair", plural: false }),
  t("prf", "regenerative", "PRF", "PRP", "Platelet rich fibrin, made from your own blood, used to support skin quality and gentle volume.", { mid: "PRF", plural: false }),
  t("exosomes", "regenerative", "Exosome therapy", "a serum", "Exosome treatments used alongside skin needling to support skin quality and recovery.", { mid: "exosome therapy", plural: false }),
  t("sculptra", "regenerative", "Sculptra", "filler", "Sculptra is a poly-L-lactic acid biostimulator that encourages the skin to support itself, with results that build gradually over a course of sessions. It is a collagen stimulating treatment, not an instant volume filler.", { mid: "Sculptra", plural: false }),
  t("biostimulators", "regenerative", "Biostimulators", "filler", "Collagen stimulating treatments that encourage the skin to support itself, gradually, over time.", { plural: true }),
  // Laser hair removal
  t("laser-hair-removal", "laser", "Laser hair removal", "shaving", "Laser treatment that reduces hair growth over a course of sessions, suitable areas and skin tones assessed at consultation.", { plural: false }),
  // Skin treatments
  t("microneedling", "skin", "Microneedling", "a roller at home", "A controlled treatment using tiny needles to encourage the skin to renew itself, improving texture and glow.", { plural: false }),
  t("chemical-peels", "skin", "Chemical peels", "a scrub", "Professional peels that lift away dull surface skin to reveal a fresher, brighter complexion.", { plural: true }),
  t("dermaplaning", "skin", "Dermaplaning", "a razor", "Gentle exfoliation using a sterile blade that removes dead skin and fine facial hair for a smooth, glowing finish.", { plural: false }),
  t("hydrafacial", "skin", "Hydrafacial", "a regular facial", "A multi step facial that cleanses, exfoliates and hydrates, with no downtime.", { mid: "Hydrafacial", plural: false }),
  t("led", "skin", "LED light therapy", "a face mask", "Different wavelengths of light used to support the skin, often as a calming, relaxing add on.", { mid: "LED light therapy", plural: false }),
  t("carbon-laser", "skin", "Carbon laser facial", "a charcoal mask", "A laser facial using a carbon layer to refine the look of pores, oil and dull skin.", { plural: false }),
  t("hifu", "skin", "HIFU", "face yoga", "Focused ultrasound used to support firmness and lift in the face and neck.", { mid: "HIFU", plural: false }),
  t("radiofrequency", "skin", "Radiofrequency", "a facial", "Radiofrequency energy used to gently warm the skin to support firmness, texture and tone.", { mid: "radiofrequency", plural: false }),
  t("ipl", "skin", "IPL photofacial", "foundation", "Intense pulsed light used to even the look of skin tone and redness.", { mid: "an IPL photofacial", plural: false }),
  t("laser-resurfacing", "skin", "Laser skin resurfacing", "a peel", "Laser treatment that refreshes skin texture and tone with some downtime.", { plural: false }),
  t("microdermabrasion", "skin", "Microdermabrasion", "a scrub", "Mechanical exfoliation that polishes away dull surface skin.", { plural: false }),
  t("medical-facial", "skin", "Medical grade facial", "a high street facial", "A facial built around medical grade skincare and a proper skin assessment.", { mid: "a medical grade facial", plural: false }),
  t("skin-tightening", "skin", "Skin tightening", "a good night's sleep", "Non surgical treatments that support firmness of the face and body.", { plural: false }),
  // Wellbeing
  t("reiki", "wellbeing", "Reiki", "a massage", "Reiki is a gentle, hands-off relaxation therapy where a practitioner uses light touch or hovering hands while the client rests, fully clothed. It is offered for relaxation and a sense of calm only. Never claim it heals, treats, cures or relieves any condition, pain, stress or illness, and never suggest it replaces medical care.", { mid: "Reiki", plural: false }),
  t("japanese-head-spa", "wellbeing", "Japanese head spa", "a hair wash at the salon", "A Japanese head spa is a slow, deeply relaxing scalp and hair treatment: a scalp analysis, gentle cleansing, a warm water and steam experience and a long scalp massage. It is offered for relaxation and for scalp and hair care. Never claim it treats hair loss, scalp conditions, stress or any health problem, and never promise hair growth or thicker hair.", { mid: "a Japanese head spa", plural: false }),
];

export const U_BY_ID = new Map(U_TREATMENTS.map((x) => [x.id, x]));
export const treatmentMid = (x: UTreatment) => x.mid || x.name.toLowerCase();

export type UAngle = { id: string; title: (x: UTreatment) => string; brief: string };

// Posts 2 to 6 for every treatment. The first post is always the intro with the treatment name as the headline.
export const U_ANGLES: UAngle[] = [
  { id: "after", title: (x) => `What to expect after ${treatmentMid(x)}`, brief: "What the days and weeks after the treatment honestly feel like, in everyday terms: the usual things people notice, what helps, when to ring the clinic. No promises about results." },
  { id: "secret", title: (x) => `What you are secretly thinking in your ${treatmentMid(x)} consultation`, brief: "A warm, funny look at the thoughts a woman has in the consultation chair that she rarely says out loud, such as worrying she will be judged, wondering if she is asking silly questions, or hoping nobody makes her look overdone. Each slide is one of those honest thoughts, followed by a kind, reassuring reply from the clinician. Never promise a result, never mention a price." },
  { id: "myth", title: (x) => `${x.name} myths, and what actually happens`, brief: "A cheeky myth versus reality format. Each slide takes one common myth about this treatment, says it plainly, then gives the honest, grounded version in a friendly voice with a little humour. Use only things any clinician could truthfully say, never a guarantee, and say suitability is decided at a consultation." },
  { id: "twist", title: (x) => `Possible side effects of ${treatmentMid(x)} may include...`, brief: "A playful twist on a medicine leaflet. Each slide is one tongue in cheek 'side effect' about how a woman may feel or what she may catch herself doing around the treatment, such as catching her reflection and smiling or booking in more time for herself. These are light, human moments only: never a claim about results, skin or the body, never anything medical, and keep the final slide a soft nudge that a consultation comes first." },
  { id: "questions", title: (x) => `Your ${treatmentMid(x)} questions answered`, brief: "The questions women ask most often, answered plainly and kindly: what it is, how long it takes, whether it hurts, how to prepare, when to book. Nothing promised." },
];

export const POSTS_PER_TREATMENT = 1 + U_ANGLES.length; // 6

export type UPostType = { key: string; treatment: UTreatment; index: number; headline: string; brief: string; label: string };

export function postTypesFor(x: UTreatment): UPostType[] {
  const intro: UPostType = {
    key: `${x.id}:1`,
    treatment: x,
    index: 0,
    headline: x.name,
    brief: `The introduction to ${x.name}. The subtitle is ONE short quirky sentence that explains what it is in plain, friendly words. The three slides then cover what it is, what it is used for and what a first conversation looks like. Background for you only: ${x.about}`,
    label: `${x.name} 1. Introduction`,
  };
  const rest = U_ANGLES.map((a, i): UPostType => ({
    key: `${x.id}:${i + 2}`,
    treatment: x,
    index: i + 1,
    headline: a.title(x),
    brief: `${a.brief} Background for you only: ${x.about}`,
    label: `${x.name} ${i + 2}. ${a.title(x)}`,
  }));
  return [intro, ...rest];
}
