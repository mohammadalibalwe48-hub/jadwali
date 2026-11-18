export const MAX_VISION_SCREENS = 8;
export const MAX_VISION_BODY = 4_000_000;
export type VisionMode = 'gateway' | 'ollama';
export type VisionOptions = { mode: VisionMode; credential: string };
