import { PSM, type Worker } from 'tesseract.js';
import { findScheduleGrids, type GridCell } from './gridGeometry';
import { parseScheduleGrid, type GridText } from './scheduleGridParser';
import type { ParsedRawSession } from './scheduleOcrParser';

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('تعذّر تجهيز الصورة للقراءة.')))
  );
}

function grayscale(canvas: HTMLCanvasElement): Uint8Array {
  const rgba = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
  const gray = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < gray.length; i++) {
    gray[i] = (rgba[i * 4] * 77 + rgba[i * 4 + 1] * 150 + rgba[i * 4 + 2] * 29) >> 8;
  }
  return gray;
}

interface Tile {
  canvas: HTMLCanvasElement;
  row: number;
  col: number;
}

function makeTile(
  cell: GridCell, source: Uint8Array, sourceWidth: number, sourceHeight: number,
  scaleX: number, scaleY: number
): HTMLCanvasElement | null {
  const [tl, tr, br, bl] = cell;
  const w = Math.max(tr.x - tl.x, br.x - bl.x);
  const h = Math.max(bl.y - tl.y, br.y - tr.y);
  if (w < 9 || h < 9) return null;
  const padX = Math.min(0.14, 2.1 / w);
  const padY = Math.min(0.19, 2.4 / h);
  const canvas = document.createElement('canvas');
  const width = canvas.width = Math.min(680, Math.ceil(w * 3.1));
  const height = canvas.height = Math.min(550, Math.ceil(h * 3.1));
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.createImageData(width, height);
  const gray = new Uint8Array(width * height);
  const stride = width + 1;
  const integral = new Uint32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    const v = padY + (1 - 2 * padY) * y / height;
    const left = tl.x + (bl.x - tl.x) * v;
    const right = tr.x + (br.x - tr.x) * v;
    const leftY = tl.y + (bl.y - tl.y) * v;
    const rightY = tr.y + (br.y - tr.y) * v;
    let lineSum = 0;
    for (let x = 0; x < width; x++) {
      const u = padX + (1 - 2 * padX) * x / width;
      const sx = Math.min(sourceWidth - 1, Math.max(0, (left + (right - left) * u) * scaleX));
      const sy = Math.min(sourceHeight - 1, Math.max(0, (leftY + (rightY - leftY) * u) * scaleY));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const rightOffset = x0 < sourceWidth - 1 ? 1 : 0;
      const lowerOffset = y0 < sourceHeight - 1 ? sourceWidth : 0;
      const at = y0 * sourceWidth + x0;
      const top = source[at] + (source[at + rightOffset] - source[at]) * (sx - x0);
      const bottom = source[at + lowerOffset] +
        (source[at + lowerOffset + rightOffset] - source[at + lowerOffset]) * (sx - x0);
      const value = top + (bottom - top) * (sy - y0);
      gray[y * width + x] = value;
      lineSum += value;
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1] + lineSum;
    }
  }

  let ink = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - 22);
      const x1 = Math.min(width, x + 23);
      const y0 = Math.max(0, y - 22);
      const y1 = Math.min(height, y + 23);
      const sum = integral[y1 * stride + x1] - integral[y0 * stride + x1] -
        integral[y1 * stride + x0] + integral[y0 * stride + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const at = y * width + x;
      const value = Math.max(0, Math.min(255, 255 + (gray[at] - mean + 9) * 6));
      if (value < 155) ink++;
      const i = at * 4;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
      pixels.data[i + 3] = 255;
    }
  }
  if (ink < 15) return null;
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

async function rereadMeeting(tile: Tile, worker: Worker): Promise<string> {
  const canvas = tile.canvas;
  const padding = 19;
  const page = document.createElement('canvas');
  page.width = canvas.width + padding * 2;
  page.height = canvas.height + padding * 2;
  const ctx = page.getContext('2d')!;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, page.width, page.height);
  ctx.drawImage(canvas, padding, padding);
  const options = { rotateAuto: false, tessedit_pageseg_mode: PSM.SINGLE_BLOCK };
  const blob = await canvasBlob(page);
  const result = await worker.recognize(blob, options);
  const text = result.data.text.trim();
  if (/^\s*[TP]\b/i.test(text)) return text;

  // Sparse and block OCR can skip a lone P/T above a time range.
  const pixels = ctx.getImageData(0, 0, page.width, page.height).data;
  let top = -1;
  let bottom = -1;
  let left = page.width;
  let right = 0;
  let nextTop = -1;
  for (let y = 0; y < page.height; y++) {
    let minX = page.width;
    let maxX = -1;
    for (let x = padding; x < page.width - padding; x++) {
      if (pixels[(y * page.width + x) * 4] < 130) {
        minX = Math.min(minX, x);
        maxX = x;
      }
    }
    if (maxX < 0) continue;
    if (top < 0) top = y;
    if (bottom >= 0 && y - bottom > 3) {
      nextTop = y;
      break;
    }
    left = Math.min(left, minX);
    right = Math.max(right, maxX);
    bottom = y;
  }
  const glyphHeight = bottom - top + 1;
  const glyphWidth = right - left + 1;
  if (nextTop < 0 || glyphHeight < 8 || glyphWidth / glyphHeight < 0.36 ||
    glyphWidth / glyphHeight > 1.18 || glyphWidth > canvas.width * 0.25) return text;

  const rectangle = { left: left - 7, top: top - 7, width: glyphWidth + 14, height: glyphHeight + 11 };
  const markerOptions = { rectangle, tessedit_pageseg_mode: PSM.SINGLE_CHAR, tessedit_char_whitelist: 'PT' };
  const marker = (await worker.recognize(blob, markerOptions)).data;
  const cue = marker.text.trim();
  return /^[PT]$/.test(cue) && marker.confidence >= 55 ? `${cue}\n${text}` : text;
}

async function recognizeTiles(grid: GridText[][], tiles: Tile[], ar: Worker, en: Worker): Promise<void> {
  const side = 1450;
  const padding = 34;
  for (let start = 0; start < tiles.length;) {
    const placed: Array<Tile & { x: number; y: number }> = [];
    let x = padding;
    let y = padding;
    let rowHeight = 0;
    while (start < tiles.length) {
      const tile = tiles[start];
      const { width, height } = tile.canvas;
      if (x + width + padding > side) {
        x = padding;
        y += rowHeight + padding;
        rowHeight = 0;
      }
      if (y + height + padding > side) break;
      placed.push({ ...tile, x, y });
      start++;
      x += width + padding;
      rowHeight = Math.max(rowHeight, height);
    }
    const atlas = document.createElement('canvas');
    atlas.width = side;
    atlas.height = Math.max(...placed.map((tile) => tile.y + tile.canvas.height)) + padding;
    const ctx = atlas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, atlas.width, atlas.height);
    for (const tile of placed) ctx.drawImage(tile.canvas, tile.x, tile.y);

    const blob = await canvasBlob(atlas);
    const options = { rotateAuto: false, tessedit_pageseg_mode: PSM.SPARSE_TEXT };
    await Promise.all(([['ar', ar], ['en', en]] as const).map(async ([language, worker]) => {
      const result = await worker.recognize(blob, options, { blocks: true });
      const words = result.data.blocks?.flatMap((block) =>
        block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words))) ?? [];
      for (const tile of placed) {
        const lines: typeof words[] = [];
        const centerY = (word: typeof words[number]) => (word.bbox.y0 + word.bbox.y1) / 2;
        for (const word of words.filter(({ bbox }) => {
          const cx = (bbox.x0 + bbox.x1) / 2;
          const cy = (bbox.y0 + bbox.y1) / 2;
          return cx >= tile.x && cx <= tile.x + tile.canvas.width &&
            cy >= tile.y && cy <= tile.y + tile.canvas.height;
        }).sort((a, b) => centerY(a) - centerY(b))) {
          const line = lines.at(-1);
          if (line && centerY(word) - centerY(line[0]) < Math.max(5, (word.bbox.y1 - word.bbox.y0) * 0.53)) line.push(word);
          else lines.push([word]);
        }
        grid[tile.row][tile.col][language] = lines.map((line) => {
          const rtl = language === 'ar' && line.some((word) => /\p{Script=Arabic}/u.test(word.text));
          return line.sort((a, b) => (a.bbox.x0 - b.bbox.x0) * (rtl ? -1 : 1))
            .map((word) => word.text).join(' ');
        }).join('\n');
      }
    }));
  }
}

export async function readScheduleGrids(
  image: HTMLCanvasElement, ar: Worker, en: Worker
): Promise<ParsedRawSession[] | null> {
  const scan = document.createElement('canvas');
  const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
  scan.width = Math.round(image.width * scale);
  scan.height = Math.round(image.height * scale);
  scan.getContext('2d')!.drawImage(image, 0, 0, scan.width, scan.height);
  const grids = findScheduleGrids(grayscale(scan), scan.width, scan.height);
  if (!grids.length) return null;
  const source = grayscale(image);
  let sessions: ParsedRawSession[] | null = null;
  for (const geometry of grids) {
    const tiles: Tile[] = [];
    const text = geometry.map((row, r) => row.map((cell, c): GridText => {
      const canvas = makeTile(cell, source, image.width, image.height,
        image.width / scan.width, image.height / scan.height);
      if (canvas) tiles.push({ canvas, row: r, col: c });
      return { ar: '', en: '' };
    }));
    await recognizeTiles(text, tiles, ar, en);
    const firstPass = parseScheduleGrid(text);
    if (firstPass === null) continue;
    for (const tile of tiles) {
      const cell = text[tile.row][tile.col];
      if (!/\d\s*[:.]\s*\d/.test(cell.en + ' ' + cell.ar)) continue;
      cell.retry = await rereadMeeting(tile, en);
    }
    const result = parseScheduleGrid(text);
    if (result !== null) sessions = [...(sessions ?? []), ...result];
  }
  return sessions;
}
