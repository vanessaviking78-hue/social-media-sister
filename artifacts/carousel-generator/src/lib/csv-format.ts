/**
 * Shared helper so every CSV-accepting tool in the app can also accept
 * Vanessa's "title row + Slide1,Slide2,Slide3..." export format, e.g.:
 *
 *   3things_1774962202804
 *   Slide1,Slide2,Slide3,Slide4,Slide5
 *   "hook text","body text","body text","body text","cta text"
 *
 * Every tool already has its own header-detection/skip logic for its normal
 * CSV shape. The one thing none of them expect is a *second*, throwaway
 * title line sitting above the real header — that line doesn't match any
 * tool's header regex, so it (and the real header row after it) both get
 * treated as data and everything shifts out of place.
 *
 * These helpers are no-ops unless that exact shape is detected, so existing
 * CSVs for every tool keep working exactly as before.
 */

function splitLines(text: string): { lines: string[]; nl: string } {
  const nlMatch = text.match(/\r\n|\r|\n/);
  return { lines: text.split(/\r\n|\r|\n/), nl: nlMatch ? nlMatch[0] : "\n" };
}

/** Minimal CSV cell split, good enough for sniffing a title line or a
 *  "Slide1,Slide2,..." header line (neither is expected to contain commas
 *  inside quoted values). */
function splitCsvCells(line: string): string[] {
  return line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
}

const SLIDE_HEADER_RE = /^slide\s*\d+$/i;

/** True if `line` is a header row made entirely of Slide1, Slide2, Slide3... cells. */
export function isSlideHeaderRow(line: string): boolean {
  const cells = splitCsvCells(line);
  return cells.length > 0 && cells.every((c) => SLIDE_HEADER_RE.test(c));
}

/** Detects a lone title line immediately followed by a Slide1,Slide2,... header
 *  line at the top of the CSV. Returns the Slide header's cell count, or null
 *  if this format isn't present. */
function detectTitleWrapper(text: string): { titleLine: string } | null {
  const { lines } = splitLines(text);
  if (lines.length < 2) return null;
  const firstCells = splitCsvCells(lines[0]);
  const isLoneTitle = firstCells.length === 1 && firstCells[0].length > 0 && !SLIDE_HEADER_RE.test(firstCells[0]);
  if (isLoneTitle && isSlideHeaderRow(lines[1])) {
    return { titleLine: lines[0] };
  }
  return null;
}

/**
 * Strips a leading title row when it's immediately followed by a
 * "Slide1,Slide2,..." header row.
 *
 * @param alsoStripSlideHeaderRow  Pass true for tools whose own header
 *   detection doesn't already recognise "Slide1/Slide2/..." as a header
 *   (e.g. tools that unconditionally treat row 0 as the header, or that
 *   only recognise specific column names). Those tools should get BOTH
 *   throwaway rows removed, leaving pure data. Tools that already treat
 *   any "slide"-prefixed first cell as a header (most of them do) should
 *   pass false so their own logic still runs on the Slide header row.
 */
export function stripSlideCsvTitleRow(text: string, alsoStripSlideHeaderRow = false): string {
  const wrapper = detectTitleWrapper(text);
  if (!wrapper) return text;
  const { lines, nl } = splitLines(text);
  const remaining = alsoStripSlideHeaderRow ? lines.slice(2) : lines.slice(1);
  return remaining.join(nl);
}

/**
 * After stripping the title row, rewrites a "Slide1,Slide2,Slide3..." header
 * line to use `targetColumns` instead (positionally), so header:true parsers
 * that expect specific column names (slide1_hook, slide1_subtitle, etc.) keep
 * working unchanged. Extra Slide columns beyond targetColumns.length keep
 * their original Slide-N name (ignored downstream); missing ones are left as
 * Slide-N too.
 */
export function renameSlideHeaderRow(text: string, targetColumns: string[]): string {
  const { lines, nl } = splitLines(text);
  if (!lines.length || !isSlideHeaderRow(lines[0])) return text;
  const cells = splitCsvCells(lines[0]);
  const renamed = cells.map((c, i) => targetColumns[i] ?? c);
  lines[0] = renamed.join(",");
  return lines.join(nl);
}

/**
 * Convenience for header:true tools with a fixed set of expected column
 * names: strips the title row (if present) and renames the Slide1,Slide2...
 * header to `targetColumns`, in one call.
 */
export function normalizeSlideCsvForHeaders(text: string, targetColumns: string[]): string {
  const stripped = stripSlideCsvTitleRow(text, false);
  return renameSlideHeaderRow(stripped, targetColumns);
}

/**
 * Maps an arbitrary CSV header row onto a fixed set of target columns by
 * reading keywords inside each header cell rather than requiring an exact
 * match. This lets any client-supplied CSV work as long as the column
 * headers hint at what they contain (e.g. "Hook", "Main Text", "Slide 2",
 * "Call to Action") -- the instruction lives in the header itself instead of
 * needing to match one rigid naming scheme.
 *
 * Matching rules, in priority order:
 * 1. A header that already exactly equals one of targetColumns (case and
 *    whitespace insensitive) is left alone.
 * 2. A header containing a strong keyword (hook, subtitle/subheading, cta /
 *    call to action) maps straight to the matching target column.
 * 3. Anything left over is assigned, in the order the columns appear in the
 *    CSV, to whichever target columns are still unfilled -- covering plain
 *    "Slide1/Slide2/..." headers, "Body", "Text", or anything else generic.
 */
export function smartMapCsvHeaders(text: string): string {
  const { lines, nl } = splitLines(text);
  if (!lines.length) return text;
  const headerCells = splitCsvCells(lines[0]);
  if (!headerCells.length) return text;
  const lower = headerCells.map((c) => c.toLowerCase().trim());

  let hookIdx = lower.findIndex((h) => h.includes("hook") || h.includes("headline") || h.includes("title"));
  let ctaIdx = lower.findIndex((h) => h.includes("cta") || h.includes("call to action") || h.includes("call-to-action"));

  // Positional fallback: first column is the hook, last column is the call
  // to action, whatever's in between becomes its own body slide in order.
  // This is what makes plain "Slide1,Slide2,...,SlideN" headers work too.
  if (hookIdx === -1) hookIdx = 0;
  if (ctaIdx === -1 || ctaIdx === hookIdx) ctaIdx = headerCells.length - 1;
  if (ctaIdx === hookIdx) ctaIdx = -1;

  const mapped: string[] = headerCells.map(() => "");
  mapped[hookIdx] = "hook";
  if (ctaIdx !== -1) mapped[ctaIdx] = "cta";

  let bodyNum = 1;
  headerCells.forEach((_cell, i) => {
    if (mapped[i]) return;
    mapped[i] = `body${bodyNum++}`;
  });

  lines[0] = mapped.join(",");
  return lines.join(nl);
}

/** Reads a File as text. Small wrapper so call sites don't need to juggle
 *  FileReader vs File.text() (older Safari lacks File.text()). */
export function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsText(file);
  });
}
