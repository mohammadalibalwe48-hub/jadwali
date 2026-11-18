type Color = [r: number, g: number, b: number];
type Band = { top: number; bottom: number };

export function inspectScreenshot(image: HTMLCanvasElement, imageScale: number): {
  portalTables: Array<{ header: Band; rows: Band[] }>;
  daySeparators: (x: number) => number[];
} {
  if (image.width < 100 || image.height < 65) return { portalTables: [], daySeparators: () => [] };
  const scan = document.createElement('canvas');
  const ratio = Math.min(1, 420 / image.width, 1250 / image.height);
  const width = scan.width = Math.max(1, Math.round(image.width * ratio));
  const height = scan.height = Math.max(1, Math.round(image.height * ratio));
  const ctx = scan.getContext('2d')!;
  ctx.drawImage(image, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const toInputY = (y: number) => y * image.height / height / imageScale;
  const sample = (y: number, left: number, right: number): Color[] => {
    const colors: Color[] = [];
    for (let x = Math.max(0, left); x < Math.min(width, right); x += 3) {
      const at = (y * width + x) * 4;
      colors.push([pixels[at], pixels[at + 1], pixels[at + 2]]);
    }
    return colors;
  };
  const mean = ([r, g, b]: Color) => (r + g + b) / 3;
  const percentile = (values: number[], p: number) =>
    values.sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];
  const rows = Array.from({ length: height }, (_, y) => sample(y, Math.floor(width * 0.13), Math.ceil(width * 0.87)));
  const fraction = (row: Color[], test: (color: Color) => boolean) => row.filter(test).length / row.length;
  const accent = rows.map((row) => fraction(row, ([r, g, b]) => b - g > 17 && r - g > 5 && b - r > 8) >= 0.7);
  const mint = rows.map((row) => fraction(row, ([r, g, b]) => g - r > 8 && g - b >= 2 && g > 195) >= 0.7);
  const shades = rows.map((row) => percentile(row.map(mean), 0.8));
  const minBandHeight = Math.max(12, Math.round(width * 0.045));

  const portalTables: Array<{ header: Band; rows: Band[] }> = [];
  for (let y = 0; y < height; y++) {
    if (!accent[y] || accent[y + 1]) continue;
    const end = mint.findIndex((present, index) => present && index > y + minBandHeight * 2 &&
      index + minBandHeight < height && mint[index + minBandHeight]);
    if (end < 0 || end - y > width * 1.9) continue;
    const edges = [y + 1];
    for (let at = y + minBandHeight; at < end - minBandHeight; at++) {
      const before = shades[at - 3];
      const after = shades[at + 3];
      if (Math.abs(after - before) < 5 || before < 218 || after < 218) continue;
      if (Math.abs(shades[at - 9] - before) > 3 || Math.abs(shades[at + 9] - after) > 3) continue;
      edges.push(at);
      at += minBandHeight;
    }
    edges.push(end);
    const heights = edges.slice(1).map((edge, i) => edge - edges[i]);
    if (heights.length < 2 || heights.length > 25 || Math.max(...heights) > Math.min(...heights) * 1.55) continue;
    const typical = heights[Math.floor(heights.length / 2)];
    portalTables.push({
      header: { top: toInputY(Math.max(0, y - typical * 0.96)), bottom: toInputY(y) },
      rows: edges.slice(1).map((edge, i) => ({ top: toInputY(edges[i]), bottom: toInputY(edge) })),
    });
    y = end;
  }

  function daySeparators(x: number): number[] {
    const center = x * imageScale * width / image.width;
    const span = Math.round(width * 0.045);
    const levels = Array.from({ length: height }, (_, y) =>
      sample(y, Math.floor(center - span), Math.ceil(center + span)).map(mean));
    const stripeStrength = (series: number[], y: number) => {
      if (y < 3 || y >= height - 3) return 0;
      return Math.min(Math.abs(series[y] - series[y - 3]), Math.abs(series[y] - series[y + 3]));
    };
    const rules: number[] = [];
    for (let y = 3; y < height - 3; y++) {
      const line = levels[y];
      const coverage = line.filter((value, x) =>
        value < Math.min(levels[y - 3][x], levels[y + 3][x]) - 2.7 ||
        value > Math.max(levels[y - 3][x], levels[y + 3][x]) + 2.7).length / line.length;
      const stripe = coverage >= 0.68 &&
        [y - 1, y, y + 1].some((at) => stripeStrength(shades, at) >= 2.7);
      if (stripe) {
        rules.push(toInputY(y));
        y += 4;
      }
    }
    return rules;
  }

  return { portalTables, daySeparators };
}
