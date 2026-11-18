// Work on a small grayscale copy to locate the rules. OCR uses the original pixels.
type Rule = { at: (position: number) => number };
type Point = { x: number; y: number };
export type GridCell = [Point, Point, Point, Point];

function detectRules(
  ink: Uint8Array, width: number, height: number,
  from: number, to: number, vertical: boolean, coverage: number
): Rule[] {
  const length = vertical ? width : height;
  const center = (from + to) / 2;
  const span = to - from;
  const padding = Math.ceil(span * 0.13) + 2;
  const points: Array<[number, number]> = [];
  for (let p = from; p < to; p++) {
    for (let q = 0; q < length; q++) {
      if (ink[vertical ? p * width + q : q * width + p]) points.push([p - center, q]);
    }
  }
  const scores = new Uint32Array(length + padding * 2);
  const best = new Float32Array(length);
  const bestSlope = new Float32Array(length);
  for (let step = -20; step <= 20; step++) {
    const slope = step / 80;
    scores.fill(0);
    for (const [p, q] of points) scores[Math.round(q - p * slope) + padding]++;
    for (let q = 1; q < length - 1; q++) {
      const index = q + padding;
      const value = scores[index] + 0.4 * (scores[index - 1] + scores[index + 1]);
      if (value > best[q]) {
        best[q] = value;
        bestSlope[q] = slope;
      }
    }
  }

  const rules: Rule[] = [];
  const separation = vertical ? 8 : 9;
  for (let q = 1; q < length - 1; q++) {
    if (best[q] < span * coverage) continue;
    if (best.subarray(Math.max(0, q - separation), q + separation + 1)
      .some((value, index) => value > best[q] ||
        (value === best[q] && Math.max(0, q - separation) + index < q))) continue;
    const slope = bestSlope[q];
    rules.push({ at: (p) => q + (p - center) * slope });
  }
  return rules;
}

export function findScheduleGrids(gray: Uint8Array, width: number, height: number): GridCell[][][] {
  if (width < 100 || height < 65) return [];
  const horizontalInk = new Uint8Array(gray.length);
  const verticalInk = new Uint8Array(gray.length);
  for (let y = 4; y < height - 4; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const light = gray[i];
      if (Math.min(gray[i - 4 * width], gray[i + 4 * width]) - light >= 11) horizontalInk[i] = 1;
      if (x >= 4 && x < width - 4 && Math.min(gray[i - 4], gray[i + 4]) - light >= 11) {
        verticalInk[i] = 1;
      }
    }
  }

  // Short text strokes can align across the header. Vote only with ink
  // supported on both sides by a continuous rule.
  const horizontalRules = new Uint8Array(gray.length);
  const sampleOffsets = [-12, -8, -4, 4, 8, 12];
  for (let y = 4; y < height - 4; y++) {
    for (let x = 14; x < width - 14; x++) {
      const i = y * width + x;
      if (!horizontalInk[i]) continue;
      let neighbors = 0;
      for (const dx of sampleOffsets) {
        for (let dy = -3; dy <= 3; dy++) {
          if (horizontalInk[i + dy * width + dx]) {
            neighbors++;
            break;
          }
        }
      }
      if (neighbors >= 5) horizontalRules[i] = 1;
    }
  }

  const middle = width / 2;
  const flatRules = detectRules(horizontalRules, width, height,
    Math.floor(width * 0.18), Math.ceil(width * 0.82), false, 0.42);
  if (flatRules.length > 80) return [];
  const rows = flatRules.map((rule, index): Rule => {
    // Refit in short strips so the crop follows bent paper and perspective.
    const knots: Point[] = [];
    for (let strip = 0; strip < 8; strip++) {
      const from = Math.floor(strip * width / 8);
      const to = Math.floor((strip + 1) * width / 8);
      const x = (from + to) / 2;
      const expected = rule.at(x);
      const radius = Math.min(width * 0.028,
        (rule.at(middle) - (flatRules[index - 1]?.at(middle) ?? -Infinity)) * 0.43,
        ((flatRules[index + 1]?.at(middle) ?? Infinity) - rule.at(middle)) * 0.43);
      let bestY = expected;
      let bestSupport = (to - from) * 0.14;
      for (let offset = -Math.floor(radius); offset <= radius; offset++) {
        for (const drift of [-0.08, -0.04, 0, 0.04, 0.08]) {
          let score = -Math.abs(offset) * 0.35;
          for (let p = from; p < to; p++) {
            const y = Math.round(rule.at(p) + offset + (p - x) * drift);
            const i = y * width + p;
            if (horizontalRules[i]) score++;
            else if (horizontalRules[i - width] || horizontalRules[i + width]) score += 0.35;
          }
          if (score > bestSupport) {
            bestSupport = score;
            bestY = expected + offset;
          }
        }
      }
      knots.push({ x, y: bestY });
    }
    return {
      at: (x) => {
        const right = Math.max(1, Math.min(7, Math.floor(x * 8 / width + 0.5)));
        const a = knots[right - 1];
        const b = knots[right];
        return a.y + (x - a.x) / (b.x - a.x) * (b.y - a.y);
      },
    };
  });

  function verticalSupport(column: Rule, top: Rule, bottom: Rule): number {
    const x = column.at((top.at(middle) + bottom.at(middle)) / 2);
    const from = Math.max(0, Math.ceil(top.at(x)) + 2);
    const to = Math.min(height, Math.floor(bottom.at(x)) - 2);
    let hits = 0;
    for (let y = from; y < to; y++) {
      const at = Math.round(column.at(y));
      if (at < 2 || at >= width - 2) continue;
      const i = y * width + at;
      if (verticalInk[i - 2] || verticalInk[i - 1] || verticalInk[i] ||
        verticalInk[i + 1] || verticalInk[i + 2]) hits++;
    }
    return hits / Math.max(1, to - from);
  }

  const grids: GridCell[][][] = [];
  for (let start = 0; start + 2 < rows.length; start++) {
    const from = Math.max(0, Math.ceil(rows[start].at(middle)) + 2);
    const to = Math.min(height, Math.floor(rows[start + 2].at(middle)) - 2);
    if (to - from < 22 || to - from > height * 0.45) continue;
    const midY = (from + to) / 2;
    let columns = detectRules(verticalInk, width, height, from, to, true, 0.72)
      .filter((column) => verticalSupport(column, rows[start], rows[start + 1]) > 0.48 &&
        verticalSupport(column, rows[start + 1], rows[start + 2]) > 0.48);
    if (columns.length < 3 || columns.length > 24) continue;

    // A camera photo can crop the table borders without cropping the text.
    if (columns[0].at(midY) > width * 0.023 && columns[0].at(midY) < width * 0.14) {
      columns = [{ at: () => 0 }, ...columns];
    }
    if (columns.at(-1)!.at(midY) < width * 0.977 && columns.at(-1)!.at(midY) > width * 0.86) {
      columns.push({ at: () => width - 1 });
    }
    function fitColumns(index: number, previous: Rule[]): Rule[] | null {
      const middleY = (rows[index].at(middle) + rows[index + 1].at(middle)) / 2;
      let supported = 0;
      const fitted = previous.map((column, c) => {
        const x = column.at(middleY);
        const gap = Math.min(
          x - (previous[c - 1]?.at(middleY) ?? -Infinity),
          (previous[c + 1]?.at(middleY) ?? Infinity) - x
        );
        const radius = Math.min(8, Math.floor(gap * 0.23));
        let best = column;
        let quality = verticalSupport(column, rows[index], rows[index + 1]);
        for (let dx = -radius; dx <= radius; dx++) {
          for (const slope of [-0.04, 0, 0.04]) {
            const center = x + dx;
            const gradient = column.at(middleY + 1) - x + slope;
            const trial = { at: (y: number) => center + (y - middleY) * gradient };
            const score = verticalSupport(trial, rows[index], rows[index + 1]) -
              Math.abs(dx) * 0.02 - Math.abs(slope);
            if (score > quality) {
              quality = score;
              best = trial;
            }
          }
        }
        if (quality > 0.45) supported++;
        return best;
      });
      return supported >= Math.max(3, Math.ceil(previous.length * 0.62)) ? fitted : null;
    }

    let first = start;
    let last = start + 2;
    const byRow = new Map<number, Rule[]>([
      [start, fitColumns(start, columns) ?? columns],
      [start + 1, fitColumns(start + 1, columns) ?? columns],
    ]);
    while (first > 0) {
      const fitted = fitColumns(first - 1, byRow.get(first)!);
      if (!fitted) break;
      byRow.set(--first, fitted);
    }
    while (last + 1 < rows.length) {
      const fitted = fitColumns(last, byRow.get(last - 1)!);
      if (!fitted) break;
      byRow.set(last++, fitted);
    }

    const intersect = (row: Rule, col: Rule, y: number): Point => {
      const x = Math.max(0, Math.min(width - 1, col.at(row.at(col.at(y)))));
      return { x, y: Math.max(0, Math.min(height - 1, row.at(x))) };
    };
    const grid: GridCell[][] = [];
    for (let r = first; r < last; r++) {
      const cells: GridCell[] = [];
      const rowColumns = byRow.get(r)!;
      const y = (rows[r].at(middle) + rows[r + 1].at(middle)) / 2;
      for (let c = 0; c + 1 < columns.length; c++) {
        cells.push([
          intersect(rows[r], rowColumns[c], y),
          intersect(rows[r], rowColumns[c + 1], y),
          intersect(rows[r + 1], rowColumns[c + 1], y),
          intersect(rows[r + 1], rowColumns[c], y),
        ]);
      }
      grid.push(cells);
    }
    grids.push(grid);
    start = last - 1;
  }
  return grids;
}
