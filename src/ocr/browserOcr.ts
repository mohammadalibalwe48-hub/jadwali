import { createWorker, PSM, type Block, type Worker } from 'tesseract.js';
import { canvasBlob, readScheduleGrids } from './gridOcr';
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

export async function runPureBrowserOcr(files: File[]): Promise<ParsedRawSession[]> {
  const [arWorker, enWorker] = await Promise.all([getArWorker(), getEnWorker()]);
  const payloads: OcrPagePayload[] = [];
  const gridSessions: ParsedRawSession[] = [];
  for (const file of files) {
    const prep = await prepareCanvasAndScanColors(file);
    const tableSessions = await readScheduleGrids(prep.canvas, arWorker, enWorker);
    if (tableSessions !== null) {
      gridSessions.push(...tableSessions);
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
    payloads.push({
      width: prep.canvas.width / prep.scale,
      height: prep.canvas.height / prep.scale,
      warmRows: prep.warmRows,
      coolRows: prep.coolRows,
      arLines,
      enLines,
    });
  }

  return distinctMeetings([...gridSessions, ...parseScheduleFromOcr(payloads)]);
}
