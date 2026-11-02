// Every treatment an aesthetic clinic might offer, for the topic list in Month. Prescription only medicines are left out on purpose
// (no botulinum toxin, no B12 injections, no drips or infusions), so none of these can trip the compliance check.
export const TREATMENT_BANK: string[] = [
  // Skin treatments
  "Dermal fillers", "Lip filler", "Cheek filler", "Jawline filler", "Chin filler", "Tear trough filler", "Nose filler", "Temple filler",
  "Skin boosters", "Profhilo", "Polynucleotides", "Skin rejuvenation injections", "Hyaluronic acid skin hydration",
  "Microneedling", "Radiofrequency microneedling", "Nanoneedling", "Dermaplaning", "Hydrafacial", "Hydrodermabrasion", "Microdermabrasion",
  "Chemical peels", "Skin peels", "Lactic acid peel", "Salicylic acid peel", "Glycolic peel", "TCA peel", "Jessner peel", "Pumpkin enzyme peel", "Mandelic acid peel",
  "LED light therapy", "Carbon laser facial", "Hollywood peel", "Oxygen facial", "Facial treatments", "Bespoke facial", "Medical grade facial",
  "Dermalux LED", "Cold plasma", "Plasma fibroblast", "Skin analysis", "Skin consultation", "Medical grade skincare", "Skin health programme",
  // Regenerative
  "PRP", "Platelet rich plasma facial", "Vampire facial", "PRP hair restoration", "PRF", "Platelet rich fibrin", "PRF under eyes",
  "Exosomes", "Exosome therapy", "Regenerative aesthetics", "Stem cell facial", "Growth factor facial", "Polynucleotide eye treatment", "Salmon DNA treatment", "Collagen stimulating treatment", "Biostimulators", "Poly-L-lactic acid", "Calcium hydroxylapatite",
  // Devices
  "HIFU", "HIFU facial lift", "Radiofrequency skin tightening", "Morpheus8", "Skin tightening", "Neck tightening", "Non-surgical facelift", "Non-surgical neck lift", "Non-surgical brow lift", "Thread lift", "PDO threads", "Fox eye threads", "Nose threads",
  "Laser hair removal", "IPL", "IPL photofacial", "Laser skin resurfacing", "Fractional laser", "Laser pigmentation treatment", "Laser vein removal", "Thread vein removal", "Spider vein treatment", "Laser tattoo removal", "Laser for acne scarring", "Laser nail fungus treatment", "Skin tag removal", "Mole removal", "Wart and verruca treatment", "Cherry angioma removal", "Milia removal", "Cryotherapy", "Cryo facial", "Electrolysis", "Diathermy", "Fraxel",
  // Body
  "Body contouring", "Cavitation", "Radiofrequency body treatments", "Cryolipolysis", "Fat freezing", "Lipo laser", "Lymphatic drainage", "Wood therapy", "Body sculpting", "Muscle stimulation", "Cellulite treatment", "Stretch mark treatment", "Body peel", "Body microneedling", "Skin tightening for the body", "Endermologie", "Pressotherapy", "Infrared sauna", "Body wraps", "Bum lift treatment", "Decolletage treatment", "Hand rejuvenation", "Hand filler", "Neck rejuvenation",
  // Hair, brows and lashes
  "Hair loss treatment", "Scalp treatments", "Scalp microneedling", "Hair restoration", "Brow lamination", "Brow tint", "Brow henna", "Microblading", "Powder brows", "Nano brows", "Lash lift", "Lash tint", "Lash extensions", "Semi permanent makeup", "Lip blush", "Lip tattoo", "Eyeliner tattoo", "Scalp micropigmentation", "Areola tattooing", "Scar camouflage tattoo", "Hair removal waxing", "Sugaring", "Threading",
  // Other aesthetic clinic offers
  "Ear piercing", "Medical ear piercing", "Dermaroller", "Intimate wellness", "Vaginal rejuvenation", "Intimate skin brightening", "Hyperhidrosis treatment", "Sweat treatment", "Teeth whitening", "Dental whitening", "Smile makeover", "Invisalign", "Composite bonding", "Veneers", "Gum contouring", "Dental facial aesthetics",
  "Acne treatment", "Acne scarring treatment", "Rosacea treatment", "Redness treatment", "Pigmentation treatment", "Melasma treatment", "Sun damage treatment", "Dark circles treatment", "Under eye treatment", "Eye bag treatment", "Fine lines treatment", "Crepey skin treatment", "Open pores treatment", "Dull skin treatment", "Dehydrated skin treatment", "Oily skin treatment", "Sensitive skin treatment", "Mature skin programme", "Teen skin programme", "Pre wedding skin plan", "Bridal skin plan", "Menopause skin plan", "Postnatal skin plan", "Mens skin treatments", "Mens grooming",
  "Facial massage", "Gua sha facial", "Buccal massage", "Kobido massage", "Facial cupping", "Facial acupuncture", "Cosmetic acupuncture", "Facial yoga", "Lymphatic facial", "Microcurrent facial", "Galvanic facial", "Ultrasound facial", "Facial steaming", "Facial reflexology", "Sculpting massage",
  "Collagen induction therapy", "Biorevitalisation", "Skin detox", "Anti ageing skincare", "SPF and sun care advice", "Skin barrier repair", "Post treatment aftercare", "Medical tattoo removal", "Scar treatment", "Keloid treatment", "Surgical scar improvement", "Burn scar improvement", "Birthmark treatment", "Port wine stain treatment", "Vitiligo camouflage", "Hyperpigmentation programme",
].filter((v, i, a) => a.indexOf(v) === i);
