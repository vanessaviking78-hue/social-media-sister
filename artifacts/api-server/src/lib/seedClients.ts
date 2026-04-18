import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { logger } from "./logger";

const CLIENT_NAMES = [
  "Ami B",
  "Annorlunda Aesthetics",
  "Aspyre Aesthetics",
  "Behold me",
  "Bex Wood",
  "castle clinic",
  "CK",
  "Claire Brown",
  "Claire connolly",
  "CT",
  "Digital Dentists",
  "Dr Kathryn",
  "Dr Laura - Highcroft",
  "dr lisa academy",
  "dr lisa aesthetics",
  "DR V",
  "Eaton",
  "Emma JB",
  "Equilibrium",
  "Eva Garcia Aesthetics",
  "forever young",
  "Happy Face Aesthetics",
  "Harwood Aesthetics",
  "helen tweaked",
  "kelly anne",
  "kelly rafique",
  "Nova Aesthetics",
  "pip",
  "PJP Academy",
  "pura",
  "radiant rose",
  "Rebecca gleds",
  "Social Media Sister",
  "sonja",
  "Suzanne",
  "taunton",
  "teviot",
  "The Compliance Clinic",
  "timeless by sarah",
];

export async function seedClients(): Promise<void> {
  try {
    const values = CLIENT_NAMES.map((name) => ({ name }));
    await db
      .insert(clientPresetsTable)
      .values(values)
      .onConflictDoNothing();
    logger.info({ count: CLIENT_NAMES.length }, "Client seed complete (skipped duplicates)");
  } catch (err) {
    logger.error({ err }, "Client seed failed");
  }
}
