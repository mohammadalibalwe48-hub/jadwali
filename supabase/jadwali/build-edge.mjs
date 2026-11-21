import { readFileSync } from 'node:fs';

const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const dependencies = JSON.parse(read('../../package-lock.json')).packages;
const types = read('../../src/types.ts');
const days = types.slice(0, types.indexOf('export type SessionType'));
const limits = read('../../src/services/visionSettings.ts').match(/^export const MAX_VISION_.*$/gm).join('\n');
const handler = read('../../api/vision.ts')
  .replace(/^import .* from '\.\.\/.*';\n/gm, '')
  .replace("from 'ai'", `from 'npm:ai@${dependencies['node_modules/ai'].version}'`)
  .replace("from 'zod'", `from 'npm:zod@${dependencies['node_modules/zod'].version}'`)
  .replace('export default async function handler', 'async function handler');
process.stdout.write("import { Buffer } from 'node:buffer';\n" + days + limits + '\n' + handler + read('edge.ts'));
