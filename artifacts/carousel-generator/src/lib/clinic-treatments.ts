import { U_GROUPS, U_TREATMENTS } from "@/lib/universal-treatments";

// THE LONG LIST: every treatment a clinic client can tick on the form. Ids that exist in Universal keep the Universal id,
// so what a client ticks maps straight onto the Universal posts. Anti-wrinkle is left off on purpose, it is never posted about.
// Edit this list to add a treatment. Never rename an id once clients have used the form.
export type ClinicTreatment = { id: string; label: string; group: string };
export type ClinicTreatmentGroup = { id: string; label: string; items: ClinicTreatment[] };

const tt = (group: string, id: string, label: string): ClinicTreatment => ({ id, label, group });

const fromUniversal = (gid: string): ClinicTreatment[] => U_TREATMENTS.filter((x) => x.group === gid).map((x) => tt(gid, x.id, x.name));
const gLabel = (gid: string) => U_GROUPS.find((g) => g.id === gid)?.label ?? gid;

export const CLINIC_TREATMENT_GROUPS: ClinicTreatmentGroup[] = [
  { id: "fillers", label: gLabel("fillers"), items: fromUniversal("fillers") },
  { id: "regenerative", label: gLabel("regenerative"), items: fromUniversal("regenerative") },
  {
    id: "skin", label: gLabel("skin"), items: [
      ...fromUniversal("skin"),
      tt("skin", "rf-microneedling", "Radiofrequency microneedling"),
      tt("skin", "morpheus8", "Morpheus8"),
      tt("skin", "nanoneedling", "Nanoneedling"),
      tt("skin", "oxygen-facial", "Oxygen facial"),
      tt("skin", "plasma-fibroblast", "Plasma fibroblast"),
      tt("skin", "non-surgical-facelift", "Non surgical facelift"),
    ],
  },
  {
    id: "concerns", label: "Skin concerns", items: [
      tt("concerns", "acne", "Acne treatment"),
      tt("concerns", "acne-scarring", "Acne scarring treatment"),
      tt("concerns", "rosacea", "Rosacea and redness"),
      tt("concerns", "pigmentation", "Pigmentation and melasma"),
      tt("concerns", "thread-veins", "Thread vein removal"),
      tt("concerns", "medical-skincare", "Medical grade skincare"),
      tt("concerns", "skin-analysis", "Skin analysis"),
    ],
  },
  { id: "laser", label: gLabel("laser"), items: fromUniversal("laser") },
  {
    id: "body", label: "Body sculpting", items: [
      tt("body", "body-contouring", "Body contouring"),
      tt("body", "body-sculpting", "Body sculpting"),
      tt("body", "cavitation", "Cavitation"),
      tt("body", "rf-body", "Radiofrequency body treatments"),
      tt("body", "fat-freezing", "Fat freezing"),
      tt("body", "lipo-laser", "Lipo laser"),
      tt("body", "lymphatic-drainage", "Lymphatic drainage"),
      tt("body", "wood-therapy", "Wood therapy"),
      tt("body", "muscle-stimulation", "Muscle stimulation (EMS)"),
      tt("body", "cellulite", "Cellulite treatments"),
      tt("body", "body-skin-tightening", "Body skin tightening"),
    ],
  },
  {
    id: "dental", label: "Dental", items: [
      tt("dental", "check-ups", "Check ups"),
      tt("dental", "hygiene", "Hygiene appointments"),
      tt("dental", "teeth-whitening", "Teeth whitening"),
      tt("dental", "composite-bonding", "Composite bonding"),
      tt("dental", "invisalign", "Invisalign"),
      tt("dental", "orthodontics", "Braces and orthodontics"),
      tt("dental", "veneers", "Veneers"),
      tt("dental", "implants", "Dental implants"),
      tt("dental", "crowns-bridges", "Crowns and bridges"),
      tt("dental", "dentures", "Dentures"),
      tt("dental", "root-canal", "Root canal treatment"),
      tt("dental", "childrens-dentistry", "Children's dentistry"),
      tt("dental", "sensitive-teeth", "Sensitive teeth"),
      tt("dental", "emergency-dental", "Emergency appointments"),
    ],
  },
  {
    id: "wellbeing", label: gLabel("wellbeing"), items: [
      ...fromUniversal("wellbeing"),
      tt("wellbeing", "facial-massage", "Facial massage and gua sha"),
      tt("wellbeing", "buccal-massage", "Buccal massage"),
      tt("wellbeing", "facial-acupuncture", "Cosmetic acupuncture"),
      tt("wellbeing", "lymphatic-facial", "Lymphatic facial"),
      tt("wellbeing", "ear-piercing", "Ear piercing"),
      tt("wellbeing", "intimate-wellness", "Intimate wellness"),
    ],
  },
];

export const ALL_CLINIC_TREATMENTS: ClinicTreatment[] = CLINIC_TREATMENT_GROUPS.flatMap((g) => g.items);
export const CLINIC_TREATMENT_BY_ID = new Map(ALL_CLINIC_TREATMENTS.map((x) => [x.id, x]));
