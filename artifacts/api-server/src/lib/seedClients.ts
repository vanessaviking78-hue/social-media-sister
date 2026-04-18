import { db } from "@workspace/db";
import { clientPresetsTable } from "@workspace/db/schema";
import { logger } from "./logger";

const CLIENT_NAMES = [
  "Ami B",
  "Aspyre Aesthetics",
  "Behold me",
  "Bex Wood",
  "castle clinic",
  "CK",
  "Claire Brown",
  "Claire connolly",
  "CT",
  "Digital Dentists",
  "Annorlunda Aesthetics",
  "The Compliance Clinic",
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
  "timeless by sarah",
];

export async function seedClients(): Promise<void> {
  try {
    const existing = await db.select({ name: clientPresetsTable.name }).from(clientPresetsTable);
    const existingNames = new Set(existing.map((r) => r.name.toLowerCase()));
    const toInsert = CLIENT_NAMES.filter((name) => !existingNames.has(name.toLowerCase()));
    if (toInsert.length === 0) {
      logger.info("Client seed: all clients already present, nothing to insert");
      return;
    }
    await db.insert(clientPresetsTable).values(toInsert.map((name) => ({ name })));
    logger.info({ inserted: toInsert.length, skipped: CLIENT_NAMES.length - toInsert.length }, "Client seed complete");
  } catch (err) {
    logger.error({ err }, "Client seed failed");
  }
}
