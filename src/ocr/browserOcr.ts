import { createWorker, PSM, type Block, type Worker } from 'tesseract.js';
import { canvasBlob, readScheduleGrids } from './gridOcr';
import { readDay } from './scheduleGridParser';
import { inspectScreenshot } from './screenshotGeometry';
import { combinePortalFragments, readGroupedWeek, readPortalFragment, type PortalFragment, type ScanResult } from './scheduleLayouts';
import {
  distinctMeetings,
  parseScheduleFromOcr,
  type OcrLine,
  type OcrPagePayload,
  type ParsedRawSession,
} from './scheduleOcrParser';

let arWorkerPromise: Promise<Worker> | null = null;
let enWorkerPromise: Promise<Worker> | null = null;

function getArWorker(): Promise<Worker> {
  if (!arWorkerPromise) {
    arWorkerPromise = (async () => {
      const w = await createWorker('ara');
      await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      return w;
    })().catch((err) => {
      arWorkerPromise = null;
      throw err;
    });
  }
  return arWorkerPromise;
}

function getEnWorker(): Promise<Worker> {
  if (!enWorkerPromise) {
    enWorkerPromise = (async () => {
      const w = await createWorker('eng');
      return w;
    })().catch((err) => {
      enWorkerPromise = null;
      throw err;
    });
  }
  return enWorkerPromise;
}

function blocksToOcrLines(blocks: Block[] | null | undefined, scale: number): OcrLine[] {
  const out: OcrLine[] = [];
  for (const block of blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const lx = line.bbox.x0 / scale;
        const ly = line.bbox.y0 / scale;
        const lw = (line.bbox.x1 - line.bbox.x0) / scale;
        const lh = (line.bbox.y1 - line.bbox.y0) / scale;

        const words = (line.words || []).map((w) => ({
          text: w.text,
          x: Math.round((w.bbox.x0 / scale) * 10) / 10,
          y: Math.round((w.bbox.y0 / scale) * 10) / 10,
          w: Math.round(((w.bbox.x1 - w.bbox.x0) / scale) * 10) / 10,
          h: Math.round(((w.bbox.y1 - w.bbox.y0) / scale) * 10) / 10,
        }));

        out.push({
          text: line.text.trim(),
          x: Math.round(lx * 10) / 10,
          y: Math.round(ly * 10) / 10,
          w: Math.round(lw * 10) / 10,
          h: Math.round(lh * 10) / 10,
          words,
        });
      }
    }
  }
  return out;
}

async function prepareCanvasAndScanColors(file: File): Promise<{
  canvas: HTMLCanvasElement;
  scale: number;
  darkMode: boolean;
  warmRows: number[];
  coolRows: number[];
}> {
  const objUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('تعذّر فتح الصورة. جرّب صورة بصيغة JPG أو PNG.'));
      el.src = objUrl;
    });

    // Bound decoded canvas memory on phones while preserving small printed text.
    const scale = Math.min(2, 1700 / img.naturalWidth, 3300 / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = width;
    scanCanvas.height = height;
    const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    if (!scanCtx) throw new Error('Canvas 2D unavailable');
    scanCtx.fillStyle = 'white';
    scanCtx.fillRect(0, 0, width, height);
    scanCtx.drawImage(img, 0, 0, width, height);

    const imgData = scanCtx.getImageData(0, 0, width, height).data;
    const warmRows: number[] = [];
    const coolRows: number[] = [];
    const stepY = Math.max(2, Math.floor(height / 320));
    const stepX = Math.max(3, Math.floor(width / 220));
    const maxXScan = Math.floor(width * 0.83);

    let darkPixels = 0;
    let totalSampled = 0;

    for (let y = 0; y < height; y += stepY) {
      let warmCount = 0;
      let coolCount = 0;
      for (let x = 0; x < maxXScan; x += stepX) {
        const idx = (y * width + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];

        totalSampled++;
        if (r + g + b < 320) darkPixels++;

        if (r > 110 && r - b >= 20 && r - g >= 5) {
          warmCount++;
        } else if (b > 110 && b - r >= 18) {
          coolCount++;
        }
      }
      if (warmCount >= 2) warmRows.push(y / scale);
      if (coolCount >= 3) coolRows.push(y / scale);
    }

    return {
      canvas: scanCanvas,
      scale,
      darkMode: totalSampled > 0 && darkPixels / totalSampled > 0.45,
      warmRows,
      coolRows,
    };
  } finally {
    URL.revokeObjectURL(objUrl);
  }
}

async function readWeekdayCrop(
  source: HTMLCanvasElement, scale: number, arWorker: Worker, enWorker: Worker,
  band: { top: number; bottom: number }, left: number, right: number
) {
  if (right <= left || band.bottom <= band.top) return undefined;
  const cell = document.createElement('canvas');
  cell.width = Math.ceil((right - left) * scale) + 24;
  cell.height = Math.ceil((band.bottom - band.top) * scale) + 24;
  const ctx = cell.getContext('2d')!;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, cell.width, cell.height);
  ctx.filter = 'grayscale(1) contrast(2)';
  ctx.drawImage(source, left * scale, band.top * scale,
    cell.width - 24, cell.height - 24, 12, 12, cell.width - 24, cell.height - 24);
  const pixels = ctx.getImageData(0, 0, cell.width, cell.height).data;
  let minX = cell.width, maxX = -1, minY = cell.height, maxY = -1;
  for (let y = 0; y < cell.height; y++) {
    for (let x = 0; x < cell.width; x++) {
      if (pixels[(y * cell.width + x) * 4] > 150) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX <= minX || maxY <= minY) return undefined;
  const crop = document.createElement('canvas');
  crop.width = maxX - minX + 25;
  crop.height = maxY - minY + 25;
  const target = crop.getContext('2d')!;
  target.fillStyle = 'white';
  target.fillRect(0, 0, crop.width, crop.height);
  target.drawImage(cell, minX, minY, crop.width - 24, crop.height - 24, 12, 12, crop.width - 24, crop.height - 24);
  const blob = await canvasBlob(crop);
  const options = { rotateAuto: false, tessedit_pageseg_mode: PSM.SINGLE_WORD };
  const result = await arWorker.recognize(blob, options);
  const ar = result.data.text.trim().replace(/[^\p{Script=Arabic}\s]/gu, '');
  const day = readDay({ ar, en: '' });
  if (day) return day;
  const alternate = await enWorker.recognize(blob, options);
  return readDay({ ar, en: alternate.data.text.trim() });
}

export async function runPureBrowserOcr(files: File[]): Promise<ScanResult> {
  const [arWorker, enWorker] = await Promise.all([getArWorker(), getEnWorker()]);
  const payloads: OcrPagePayload[] = [];
  const sessions: ParsedRawSession[] = [];
  const fragments: PortalFragment[] = [];
  const notices = new Set<string>();
  for (const file of files) {
    const prep = await prepareCanvasAndScanColors(file).catch(() => null);
    if (!prep) {
      notices.add('تعذّر فتح إحدى الصور. جرّب إعادة رفعها بصيغة JPG أو PNG.');
      continue;
    }
    const recognize = async (canvas: HTMLCanvasElement) => {
      const blob = await canvasBlob(canvas);
      return Promise.all([
        arWorker.recognize(blob, {}, { blocks: true }),
        enWorker.recognize(blob, {}, { blocks: true }),
      ]);
    };
    const [arRes, enRes] = await recognize(prep.canvas);
    let arLines = blocksToOcrLines(arRes.data.blocks, prep.scale);
    let enLines = blocksToOcrLines(enRes.data.blocks, prep.scale);
    if (prep.darkMode) {
      const inverted = document.createElement('canvas');
      inverted.width = prep.canvas.width;
      inverted.height = prep.canvas.height;
      const ctx = inverted.getContext('2d')!;
      ctx.filter = 'invert(1)';
      ctx.drawImage(prep.canvas, 0, 0);
      const [arInv, enInv] = await recognize(inverted);
      arLines = arLines.concat(blocksToOcrLines(arInv.data.blocks, prep.scale));
      enLines = enLines.concat(blocksToOcrLines(enInv.data.blocks, prep.scale));
    }
    const page: OcrPagePayload = {
      width: prep.canvas.width / prep.scale,
      height: prep.canvas.height / prep.scale,
      warmRows: prep.warmRows,
      coolRows: prep.coolRows,
      arLines,
      enLines,
    };
    const screenshot = inspectScreenshot(prep.canvas, prep.scale);
    const portal = screenshot.portalTables.flatMap(({ header, rows }) => {
      const fragment = readPortalFragment(page, header, rows);
      return fragment ? [fragment] : [];
    });
    if (portal.length) {
      fragments.push(...portal);
      continue;
    }
    const grouped = await readGroupedWeek(page, screenshot.daySeparators, (band, left, right) =>
      readWeekdayCrop(prep.canvas, prep.scale, arWorker, enWorker, band, left, right));
    if (grouped?.sessions.length) {
      sessions.push(...grouped.sessions);
      grouped.notices.forEach((notice) => notices.add(notice));
      continue;
    }
    const grid = await readScheduleGrids(prep.canvas, arWorker, enWorker);
    if (grid?.length) sessions.push(...grid);
    else if (grid === null && grouped === null) payloads.push(page);
    else notices.add('ظهرت عناوين الجدول لكن بعض الصفوف غير واضحة. جرّب صورة أقرب أو أضف لقطة أخرى.');
  }

  const portal = combinePortalFragments(fragments);
  portal.notices.forEach((notice) => notices.add(notice));
  return {
    sessions: distinctMeetings([...sessions, ...portal.sessions, ...parseScheduleFromOcr(payloads)]),
    notices: [...notices],
  };
}
