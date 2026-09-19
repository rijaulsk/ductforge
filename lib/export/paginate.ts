/* Splitting the printed sheet into pages — decided here, not by the printer.
 *
 * WHY. The sheet used to be one long strip, printed with `break-inside: avoid`
 * on its rows and left to the browser to cut. The preview could only guess
 * where the cuts would fall, so it drew dashed lines labelled "approximate
 * break" and a count reading "about 2 pages" — and the owner asked, fairly, for
 * pages: "multiple A4 sized pages with proper breaks to hold all the contents".
 *
 * So the page breaks are now computed, once, from the measured height of every
 * piece of the sheet, and both the preview and the print target draw exactly
 * those pages as fixed-size boxes. The printer is handed pages that already fit
 * its paper and has nothing left to decide: page 2 on screen is page 2 on paper.
 *
 * Framework-free on purpose, like lib/duct: the measuring happens in the
 * browser (components/PagedSheet.tsx), but the packing is plain arithmetic on
 * numbers, and `check:duct` pins its rules without a DOM.
 *
 * THE RULES, each of which is a thing a printed schedule gets wrong:
 *
 *   · A block never splits. A row, a heading, the masthead — whole or not at
 *     all.
 *   · A table that runs over repeats its column headings on the next page,
 *     under a "(continued)" line, so page 3 of a schedule still says what its
 *     columns are.
 *   · A table never starts at the foot of a page with nothing under its
 *     heading: it needs room for its heading, its header row and its first two
 *     rows (or all of them, if it has fewer), or it starts on the next page.
 *   · The totals row never sits alone at the top of a page: it goes with the
 *     last row.
 *   · A block marked `keepWithNext` travels with the blocks after it (a
 *     heading with its first note).
 *   · Anything taller than a whole page gets a page to itself and overflows
 *     it, rather than being pushed forward for ever. The packer always
 *     terminates.
 */

export type PackRow = { key: string; height: number };

export type PackItem =
  | {
      kind: "block";
      key: string;
      height: number;
      /** How many of the following items must start on the same page. */
      keepWithNext?: number;
    }
  | {
      kind: "table";
      key: string;
      /** The section heading above the table; 0 when it has none. */
      heading: number;
      /** The header row, including any space above the table. */
      head: number;
      rows: PackRow[];
      /** The totals row; 0 when there is none. */
      total: number;
    };

export type PagePart =
  | { kind: "block"; key: string }
  | {
      kind: "table";
      key: string;
      /** This part carries the section heading — only the first part does. */
      heading: boolean;
      /** A later part: it prints a "(continued)" line above its header row. */
      continued: boolean;
      rows: string[];
      total: boolean;
    };

export type Page = PagePart[];

/** How many rows a table must bring with it onto a page it starts on. */
const MIN_ROWS = 2;

/** The height an item needs to START on a page, by the rules above. */
function startHeight(item: PackItem): number {
  if (item.kind === "block") return item.height;
  const first = item.rows.slice(0, MIN_ROWS).reduce((s, r) => s + r.height, 0);
  const withTotal = item.rows.length <= MIN_ROWS ? item.total : 0;
  return item.heading + item.head + first + withTotal;
}

/**
 * Pack the sheet into pages.
 *
 * @param pageHeight  the printable height of one page, in the same unit as
 *                    the item heights
 * @param continued   the height of the "(continued)" line a table repeats
 *                    above its header on each later page
 */
export function packPages(items: PackItem[], pageHeight: number, continued = 0): Page[] {
  const pages: Page[] = [[]];
  let used = 0;
  const current = () => pages[pages.length - 1];
  const turn = () => {
    pages.push([]);
    used = 0;
  };

  items.forEach((item, i) => {
    if (item.kind === "block") {
      let need = item.height;
      for (let k = 1; k <= (item.keepWithNext ?? 0) && i + k < items.length; k++) {
        need += startHeight(items[i + k]);
      }
      /* Turn only if the page already holds something: a block too tall for
       * an empty page gets that page and overflows it, and packing moves on. */
      if (used > 0 && used + need > pageHeight) turn();
      current().push({ kind: "block", key: item.key });
      used += item.height;
      return;
    }

    if (used > 0 && used + startHeight(item) > pageHeight) turn();

    let part: Extract<PagePart, { kind: "table" }> = {
      kind: "table",
      key: item.key,
      heading: item.heading > 0,
      continued: false,
      rows: [],
      total: false,
    };
    used += item.heading + item.head;

    item.rows.forEach((row, r) => {
      const last = r === item.rows.length - 1;
      /* The last row brings the totals row with it. */
      const need = row.height + (last ? item.total : 0);
      if (part.rows.length > 0 && used + need > pageHeight) {
        current().push(part);
        turn();
        part = {
          kind: "table",
          key: item.key,
          heading: false,
          continued: true,
          rows: [],
          total: false,
        };
        used += continued + item.head;
      }
      part.rows.push(row.key);
      used += row.height;
    });

    if (item.total > 0) {
      part.total = true;
      used += item.total;
    }
    current().push(part);
  });

  /* A sheet with every section switched off is still one blank page, not
   * none — there is always something to preview and print. */
  return pages.length > 1 && pages[pages.length - 1].length === 0 ? pages.slice(0, -1) : pages;
}
