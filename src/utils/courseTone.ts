import type { LectureSession } from '../types';
import { courseKey } from './attendance';

export function courseTone(session: LectureSession) {
  let hash = 0;
  for (const character of courseKey(session)) {
    hash = (Math.imul(hash, 31) + character.codePointAt(0)!) >>> 0;
  }
  return hash % 5;
}
