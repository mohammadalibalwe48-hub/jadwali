import { useLocale } from '../locale';
import React, { useState } from 'react';
import { PencilLine, Trash2 } from 'lucide-react';
import {
  DAYS_ORDER,
  type DayOfWeek,
  type FloorRule,
  type LectureSession,
  type SessionType,
} from '../types';
import { fieldStyle, primaryStyle, secondaryStyle, ToolDialog } from './ToolDialog';
import { cleanRoomCode, detectFloorFromRoom } from '../utils/floorMapper';

interface SessionEditorModalProps {
  session: LectureSession | null;
  floorRules: FloorRule[];
  defaultDay?: DayOfWeek;
  onClose: () => void;
  onSave: (session: LectureSession) => void;
  onDelete?: (id: string) => void;
}

const UNIVERSITY_SLOTS = [
  { label: '08:30 – 10:00', start: '08:30', end: '10:00' },
  { label: '10:00 – 11:30', start: '10:00', end: '11:30' },
  { label: '11:30 – 13:00', start: '11:30', end: '13:00' },
  { label: '13:00 – 14:30', start: '13:00', end: '14:30' },
  { label: '14:30 – 16:00', start: '14:30', end: '16:00' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function splitTime(hhmm: string): [string, string] {
  const parts = (hhmm || '10:00').split(':');
  const h = HOURS.includes(parts[0]) ? parts[0] : '10';
  const m = MINUTES.includes(parts[1]) ? parts[1] : '00';
  return [h, m];
}

export const SessionEditorModal: React.FC<SessionEditorModalProps> = ({
  session,
  floorRules,
  defaultDay = 'السبت',
  onClose,
  onSave,
  onDelete,
}) => {
  const { t, typeName, dayName } = useLocale();
  const [error, setError] = useState(false);
  const [day, setDay] = useState<DayOfWeek>(session?.day ?? defaultDay);
  const [startTime, setStartTime] = useState(session?.startTime ?? '10:00');
  const [endTime, setEndTime] = useState(session?.endTime ?? '11:30');
  const [courseName, setCourseName] = useState(session?.courseName ?? '');
  const [courseCode, setCourseCode] = useState(session?.courseCode ?? '');
  const [type, setType] = useState<SessionType>(session?.type ?? 'نظري');
  const [room, setRoom] = useState(session?.room === '—' ? '' : session?.room ?? '');
  const [floor, setFloor] = useState(session?.floor === '—' ? '' : session?.floor ?? '');
  const [floorAuto, setFloorAuto] = useState(session?.floorAuto ?? true);

  const [startH, startM] = splitTime(startTime);
  const [endH, endM] = splitTime(endTime);

  const handleRoomChange = (val: string) => {
    setRoom(val);
    const { room: cleaned, hintedType } = cleanRoomCode(val);
    if (hintedType) setType(hintedType);
    if (floorAuto) {
      setFloor(val.trim() ? detectFloorFromRoom(cleaned || val, floorRules) : '');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim()) return;
    if (endTime <= startTime) { setError(true); return; }
    const { room: cleanedRoom } = cleanRoomCode(room);
    const finalRoom = cleanedRoom || room.trim() || '—';
    const finalFloor =
      finalRoom === '—' && floorAuto
        ? '—'
        : floorAuto
        ? detectFloorFromRoom(finalRoom, floorRules)
        : floor.trim() || '—';

    onSave({
      id: session?.id || `sess-${Date.now()}`,
      day,
      startTime,
      endTime,
      courseName: courseName.trim(),
      courseCode: courseCode.trim(),
      type,
      room: finalRoom,
      floor: finalFloor,
      floorAuto,
    });
    onClose();
  };

  return (
    <ToolDialog title={session ? t("تعديل المحاضرة") : t("محاضرة جديدة")} onClose={onClose} size="wide" icon={PencilLine} footer={
      <>
        {session && onDelete ? (
          <button type="button" className="button button-danger" onClick={() => { onDelete(session.id); onClose(); }}>
            <Trash2 size={16} aria-hidden="true" />{' ' + t("حذف")}</button>
        ) : <span />}
        <div className="flex gap-2">
          <button type="button" className={secondaryStyle} onClick={onClose}>{t("إلغاء")}</button>
          <button type="submit" form="session-editor-form" className={primaryStyle}>{t("حفظ")}</button>
        </div>
      </>
    }>
      <form id="session-editor-form" onSubmit={handleSubmit} className="space-y-5">
        {/* Course Name & Code */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="col-span-2">
            <label htmlFor="editor-course" className="block text-xs font-semibold text-[var(--muted)] mb-1.5">{t("المادة")}</label>
            <input id="editor-course"
              type="text"
              dir="auto"
              placeholder={t("مثلاً: تحليل رياضي 1")}
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className={fieldStyle + ' font-semibold'}
              required
            />
          </div>
          <div>
            <label htmlFor="editor-code" className="block text-xs font-semibold text-[var(--muted)] mb-1.5">{t("الرمز")}</label>
            <input id="editor-code"
              type="text"
              dir="ltr"
              placeholder="CEDC101"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
              className={fieldStyle + ' font-semibold font-mono-num text-left'}
            />
          </div>
        </div>

        {/* Day Pills */}
        <div>
          <p id="editor-day" className="block text-xs font-semibold text-[var(--muted)] mb-2">{t("اليوم")}</p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5" role="group" aria-labelledby="editor-day">
            {DAYS_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                aria-pressed={day === d}
                className={`py-2 rounded-md text-xs font-semibold transition cursor-pointer active:scale-[0.97] ${
                  day === d
                    ? 'bg-[var(--brand)] text-white'
                    : 'bg-[var(--soft)] text-[var(--muted)] hover:bg-[var(--hover)]'
                }`}
              >
                {dayName(d)}
              </button>
            ))}
          </div>
        </div>

        {/* Time Selection (Preset Pills + Clean 24h Selectors) */}
        <div>
          <p className="block text-xs font-semibold text-[var(--muted)] mb-2">{t("الوقت")}</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {UNIVERSITY_SLOTS.map((slot) => {
              const isSelected = startTime === slot.start && endTime === slot.end;
              return (
                <button
                  key={slot.label}
                  type="button"
                  dir="ltr"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setStartTime(slot.start);
                    setEndTime(slot.end);
                  }}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-mono-num font-semibold transition cursor-pointer ${
                    isSelected
                      ? 'bg-[var(--brand)] text-white'
                      : 'bg-[var(--soft)] text-[var(--muted)] hover:bg-[var(--hover)]'
                  }`}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2.5 editor-times">
            <div className="bg-[var(--soft)] border border-[var(--line)] rounded-md p-2.5">
              <span className="block text-[11px] font-medium text-[var(--muted)] mb-1">{t("البداية")}</span>
              <div className="flex items-center gap-1.5" dir="ltr">
                <select
                  value={startH} aria-label={t("ساعة البداية")}
                  onChange={(e) => setStartTime(`${e.target.value}:${startM}`)}
                  className="min-w-0 flex-1 bg-white border border-[var(--line)] rounded-md py-1.5 px-2 text-sm font-mono-num font-semibold focus:outline-none focus:border-[var(--ink)]"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="font-mono-num font-bold text-[var(--muted)]">:</span>
                <select
                  value={startM} aria-label={t("دقيقة البداية")}
                  onChange={(e) => setStartTime(`${startH}:${e.target.value}`)}
                  className="min-w-0 flex-1 bg-white border border-[var(--line)] rounded-md py-1.5 px-2 text-sm font-mono-num font-semibold focus:outline-none focus:border-[var(--ink)]"
                >
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-[var(--soft)] border border-[var(--line)] rounded-md p-2.5">
              <span className="block text-[11px] font-medium text-[var(--muted)] mb-1">{t("النهاية")}</span>
              <div className="flex items-center gap-1.5" dir="ltr">
                <select
                  value={endH} aria-label={t("ساعة النهاية")}
                  onChange={(e) => setEndTime(`${e.target.value}:${endM}`)}
                  className="min-w-0 flex-1 bg-white border border-[var(--line)] rounded-md py-1.5 px-2 text-sm font-mono-num font-semibold focus:outline-none focus:border-[var(--ink)]"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="font-mono-num font-bold text-[var(--muted)]">:</span>
                <select
                  value={endM} aria-label={t("دقيقة النهاية")}
                  onChange={(e) => setEndTime(`${endH}:${e.target.value}`)}
                  className="min-w-0 flex-1 bg-white border border-[var(--line)] rounded-md py-1.5 px-2 text-sm font-mono-num font-semibold focus:outline-none focus:border-[var(--ink)]"
                >
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {error && endTime <= startTime && <p className="notice notice-error" role="alert">
          {t('يجب أن يكون وقت النهاية بعد البداية.', 'End time must be after start time.')}
        </p>}
        {/* Type + Room + Floor */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <p id="editor-type" className="block text-xs font-semibold text-[var(--muted)] mb-1.5">{t("النوع")}</p>
            <div className="grid grid-cols-2 gap-1.5 bg-[var(--soft)] p-1 rounded-md" role="group" aria-labelledby="editor-type">
              {(['نظري', 'عملي'] as SessionType[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setType(kind)}
                  aria-pressed={type === kind}
                  className={`py-2 rounded-md text-xs font-bold transition cursor-pointer ${
                    type === kind
                      ? 'bg-white text-[var(--ink)]'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {typeName(kind)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="editor-room" className="block text-xs font-semibold text-[var(--muted)] mb-1.5">{t("القاعة")}</label>
            <input id="editor-room"
              type="text"
              dir="auto"
              placeholder={t("B-06 أو المدرّج")}
              value={room}
              onChange={(e) => handleRoomChange(e.target.value)}
              className={fieldStyle + ' font-semibold font-mono-num'}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="editor-floor" className="text-xs font-semibold text-[var(--muted)]">{t("الطابق")}</label>
              <button
                type="button"
                onClick={() => {
                  const next = !floorAuto;
                  setFloorAuto(next);
                  if (next && room.trim()) {
                    setFloor(detectFloorFromRoom(room, floorRules));
                  }
                }}
                className="text-[11px] font-medium text-[var(--muted)] underline cursor-pointer"
              >
                {floorAuto ? t("تلقائي") : t("تعديل يدوي")}
              </button>
            </div>
            <input id="editor-floor"
              type="text"
              placeholder={t("يُحدّد من القاعة")}
              value={floor}
              onChange={(e) => {
                setFloorAuto(false);
                setFloor(e.target.value);
              }}
              className={fieldStyle + ' font-semibold'}
            />
          </div>
        </div>

      </form>
    </ToolDialog>
  );
};
