import { createWorker, PSM, type Block, type Worker } from 'tesseract.js';
import {
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

function blocksToOcrLines(blocks: Block[] | null | undefined, invScale = 1): OcrLine[] {
  const out: OcrLine[] = [];
  for (const block of blocks || []) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        const lx = line.bbox.x0 / invScale;
        const ly = line.bbox.y0 / invScale;
        const lw = (line.bbox.x1 - line.bbox.x0) / invScale;
        const lh = (line.bbox.y1 - line.bbox.y0) / invScale;

        const words = (line.words || []).map((w) => ({
          text: w.text,
          x: Math.round((w.bbox.x0 / invScale) * 10) / 10,
          y: Math.round((w.bbox.y0 / invScale) * 10) / 10,
          w: Math.round(((w.bbox.x1 - w.bbox.x0) / invScale) * 10) / 10,
          h: Math.round(((w.bbox.y1 - w.bbox.y0) / invScale) * 10) / 10,
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
  normalBlob: Blob;
  invertedBlob: Blob | null;
  origWidth: number;
  origHeight: number;
  scale: number;
  warmRows: number[];
  coolRows: number[];
}> {
  const objUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objUrl;
    });

    const origWidth = img.naturalWidth || img.width;
    const origHeight = img.naturalHeight || img.height;

    // Scan original image pixels for warm ("عملي") and cool ("نظري") badge rows + dark-mode check
    const scanCanvas = document.createElement('canvas');
    scanCanvas.width = origWidth;
    scanCanvas.height = origHeight;
    const scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    if (!scanCtx) throw new Error('Canvas 2D unavailable');
    scanCtx.drawImage(img, 0, 0, origWidth, origHeight);

    const imgData = scanCtx.getImageData(0, 0, origWidth, origHeight).data;
    const warmRows: number[] = [];
    const coolRows: number[] = [];
    const stepY = Math.max(2, Math.floor(origHeight / 320));
    const stepX = Math.max(3, Math.floor(origWidth / 220));
    const maxXScan = Math.floor(origWidth * 0.83);

    let darkPixels = 0;
    let totalSampled = 0;

    for (let y = 0; y < origHeight; y += stepY) {
      let warmCount = 0;
      let coolCount = 0;
      for (let x = 0; x < maxXScan; x += stepX) {
        const idx = (y * origWidth + x) * 4;
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
      if (warmCount >= 2) warmRows.push(y);
      if (coolCount >= 3) coolRows.push(y);
    }

    // Upscale modestly if image is narrow so small digits/room letters are sharp
    const scale = origWidth < 1400 ? Math.min(1.8, 1500 / origWidth) : 1;
    const targetW = Math.round(origWidth * scale);
    const targetH = Math.round(origHeight * scale);

    const upCanvas = document.createElement('canvas');
    upCanvas.width = targetW;
    upCanvas.height = targetH;
    const upCtx = upCanvas.getContext('2d')!;
    upCtx.fillStyle = '#FFFFFF';
    upCtx.fillRect(0, 0, targetW, targetH);
    upCtx.drawImage(img, 0, 0, targetW, targetH);

    const normalBlob = await new Promise<Blob>((res, rej) =>
      upCanvas.toBlob((b) => (b ? res(b) : rej(new Error('Blob failed'))), 'image/png')
    );

    // Only run an extra inverted OCR pass if the screenshot is predominantly dark-mode (>45% dark pixels)
    let invertedBlob: Blob | null = null;
    if (totalSampled > 0 && darkPixels / totalSampled > 0.45) {
      const invCanvas = document.createElement('canvas');
      invCanvas.width = targetW;
      invCanvas.height = targetH;
      const invCtx = invCanvas.getContext('2d')!;
      invCtx.filter = 'invert(1)';
      invCtx.drawImage(upCanvas, 0, 0);
      invertedBlob = await new Promise<Blob>((res, rej) =>
        invCanvas.toBlob((b) => (b ? res(b) : rej(new Error('Inv blob failed'))), 'image/png')
      );
    }

    return {
      normalBlob,
      invertedBlob,
      origWidth,
      origHeight,
      scale,
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

  for (const file of files) {
    const prep = await prepareCanvasAndScanColors(file);

    const [arRes, enRes] = await Promise.all([
      arWorker.recognize(prep.normalBlob, {}, { blocks: true }),
      enWorker.recognize(prep.normalBlob, {}, { blocks: true }),
    ]);

    let arLines = blocksToOcrLines(arRes.data.blocks, prep.scale);
    let enLines = blocksToOcrLines(enRes.data.blocks, prep.scale);

    if (prep.invertedBlob) {
      const [arInv, enInv] = await Promise.all([
        arWorker.recognize(prep.invertedBlob, {}, { blocks: true }),
        enWorker.recognize(prep.invertedBlob, {}, { blocks: true }),
      ]);
      arLines = arLines.concat(blocksToOcrLines(arInv.data.blocks, prep.scale));
      enLines = enLines.concat(blocksToOcrLines(enInv.data.blocks, prep.scale));
    }

    payloads.push({
      width: prep.origWidth,
      height: prep.origHeight,
      warmRows: prep.warmRows,
      coolRows: prep.coolRows,
      arLines,
      enLines,
    });
  }

  return parseScheduleFromOcr(payloads);
}
