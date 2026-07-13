import { logger } from "./logger";
import { generateWeeklyRevenueIdeas } from "../routes/revenue-ideas";

let lastRunWeek: string | null = null;
let running = false;

function currentWeekOf(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const sunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  return sunday.toISOString().slice(0, 10);
}

// Checks every hour whether it's Sunday morning and this week's batch of
// revenue ideas hasn't been generated yet, then kicks it off automatically.
// generateWeeklyRevenueIdeas() itself skips any client that already has a
// row for the week, so this is safe to call more than once.
async function checkAndGenerate(): Promise<void> {
  if (running) return;
  const now = new Date();
  const isSunday = now.getUTCDay() === 0;
  const isMorning = now.getUTCHours() >= 7;
  const week = currentWeekOf();
  if (!isSunday || !isMorning || lastRunWeek === week) return;

  running = true;
  try {
    const result = await generateWeeklyRevenueIdeas(week);
    lastRunWeek = week;
    logger.info({ result }, "Sunday revenue-ideas auto-generation ran");
  } catch (err) {
    logger.error({ err }, "Sunday revenue-ideas auto-generation failed");
  } finally {
    running = false;
  }
}

export function startRevenueIdeasCron(): void {
  logger.info("Revenue ideas Sunday scheduler started (hourly check)");
  checkAndGenerate().catch((err) => logger.error({ err }, "Initial revenue-ideas check error"));
  setInterval(() => {
    checkAndGenerate().catch((err) => logger.error({ err }, "Revenue-ideas cron error"));
  }, 60 * 60 * 1000);
}
