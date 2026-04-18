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

const NO_UNIQUE_CONSTRAINT_CODE = "42P10";

export async function seedClients(): Promise<void> {
  try {
    const values = CLIENT_NAMES.map((name) => ({ name }));

    try {
      await db
        .insert(clientPresetsTable)
        .values(values)
        .onConflictDoNothing({ target: clientPresetsTable.name });
      logger.info({ count: CLIENT_NAMES.length }, "Client seed complete (skipped duplicates)");
    } catch (innerErr: any) {
      const pgCode = innerErr?.cause?.code ?? innerErr?.code;
      if (pgCode !== NO_UNIQUE_CONSTRAINT_CODE) throw innerErr;

      logger.warn("Unique constraint not present — falling back to app-side deduplication for seed");
      const existing = await db.select({ name: clientPresetsTable.name }).from(clientPresetsTable);
      const existingLower = new Set(existing.map((r) => r.name.toLowerCase()));
      const toInsert = CLIENT_NAMES.filter((n) => !existingLower.has(n.toLowerCase()));
      if (toInsert.length > 0) {
        await db.insert(clientPresetsTable).values(toInsert.map((name) => ({ name })));
      }
      logger.info(
        { inserted: toInsert.length, skipped: CLIENT_NAMES.length - toInsert.length },
        "Client seed complete (fallback mode — add unique constraint to enable idempotent seeding)"
      );
    }
  } catch (err) {
    logger.error({ err }, "Client seed failed");
  }
}
