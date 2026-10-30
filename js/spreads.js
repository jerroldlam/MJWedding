/*
 * Editorial spread composition: turns a chapter's ordered photo shapes into
 * rows of one, two or three photos, like a printed album. Pure and
 * deterministic; never reorders photos.
 */

const PANORAMA_MIN = 2.0;
const LANDSCAPE_MIN = 1.1;

export function classifyShape(width, height) {
  const aspect = width / height;
  if (aspect >= PANORAMA_MIN) return "panorama";
  if (aspect > LANDSCAPE_MIN) return "landscape";
  return "portrait";
}

function portraitRun(shapes, start) {
  let end = start;
  while (shapes[end] === "portrait") end += 1;
  return end - start;
}

function range(start, count) {
  return Array.from({ length: count }, (_, k) => start + k);
}

/**
 * @param {string[]} shapes  "landscape" | "portrait" | "panorama", in display order
 * @param {boolean} wide     true for tablet/desktop, false for phones
 * @returns {{ kind: "full" | "group" | "single", indices: number[] }[]}
 */
export function composeRows(shapes, wide) {
  const rows = [];
  let i = 0;
  // Consecutive landscape pairs; after two, the next landscape goes full-width for rhythm.
  let landscapePairs = 0;

  while (i < shapes.length) {
    const shape = shapes[i];

    if (shape === "panorama") {
      rows.push({ kind: "full", indices: [i] });
      landscapePairs = 0;
      i += 1;
    } else if (shape === "landscape") {
      if (wide && shapes[i + 1] === "landscape" && landscapePairs < 2) {
        rows.push({ kind: "group", indices: [i, i + 1] });
        landscapePairs += 1;
        i += 2;
      } else {
        rows.push({ kind: "full", indices: [i] });
        landscapePairs = 0;
        i += 1;
      }
    } else {
      const run = portraitRun(shapes, i);
      landscapePairs = 0;

      if (!wide) {
        const take = run >= 2 ? 2 : 1;
        rows.push({ kind: take === 2 ? "group" : "single", indices: range(i, take) });
        i += take;
      } else if (run >= 2) {
        // 4 portraits become 2 + 2 rather than 3 + a lone 1.
        const take = run === 4 ? 2 : Math.min(run, 3);
        rows.push({ kind: "group", indices: range(i, take) });
        i += take;
      } else if (shapes[i + 1] === "landscape") {
        rows.push({ kind: "group", indices: [i, i + 1] });
        i += 2;
      } else {
        rows.push({ kind: "single", indices: [i] });
        i += 1;
      }
    }
  }

  return rows;
}
