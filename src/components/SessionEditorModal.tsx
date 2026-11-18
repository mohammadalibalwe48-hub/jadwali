import React, { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import {
  DAYS_ORDER,
  type DayOfWeek,
  type FloorRule,
  type LectureSession,
  type SessionType,
} from '../types';
import { cleanRoomCode, detectFloorFromRoom } from '../utils/floorMapper';

interface SessionEditorModalProps {
  isOpen: boolean;
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

const HOURS = Array.from({ length: 13 }, (_, i) => String(i + 8).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function splitTime(hhmm: string): [string, string] {
  const parts = (hhmm || '10:00').split(':');
  const h = HOURS.includes(parts[0]) ? parts[0] : '10';
  const m = MINUTES.includes(parts[1]) ? parts[1] : '00';
  return [h, m];
}

export const SessionEditorModal: React.FC<SessionEditorModalProps> = ({
  isOpen,
  session,
  floorRules,
  defaultDay = 'السبت',
  onClose,
  onSave,
  onDelete,
}) => {
  const [day, setDay] = useState<DayOfWeek>(defaultDay);
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:30');
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [type, setType] = useState<SessionType>('نظري');
  const [room, setRoom] = useState('');
  const [floor, setFloor] = useState('');
  const [floorAuto, setFloorAuto] = useState(true);

  useEffect(() => {
    if (session) {
      setDay(session.day);
      setStartTime(session.startTime);
      setEndTime(session.endTime);
      setCourseName(session.courseName);
      setCourseCode(session.courseCode || '');
      setType(session.type);
      setRoom(session.room === '—' ? '' : session.room);
      setFloor(session.floor === '—' ? '' : session.floor);
      setFloorAuto(session.floorAuto);
    } else {
      setDay(defaultDay);
      setStartTime('10:00');
      setEndTime('11:30');
      setCourseName('');
      setCourseCode('');
      setType('نظري');
      setRoom('');
      setFloor('');
      setFloorAuto(true);
    }
  }, [session, defaultDay, isOpen]);

  if (!isOpen) return null;

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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#141413]/45 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up bg-white w-full sm:max-w-lg rounded-t-[26px] sm:rounded-[22px] border border-[#E6E4DC] shadow-2xl max-h-[92dvh] overflow-y-auto"
      >
        {/* Sheet Handle on Mobile */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#D8D5CD]" />
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#ECEAE3] sticky top-0 bg-white z-10">
          <h3 className="text-base font-bold text-[#141413]">
            {session ? 'تعديل المحاضرة' : 'محاضرة جديدة'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B6962] hover:bg-[#F5F4EF] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Course Name & Code */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#6B6962] mb-1.5">المادة</label>
              <input
                type="text"
                placeholder="مثلاً: تحليل رياضي 1"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                className="w-full rounded-xl bg-[#FAF9F5] border border-[#E2DFD7] px-3.5 py-2.5 text-sm font-semibold text-[#141413] placeholder:text-[#A8A59D] focus:bg-white focus:border-[#141413] focus:outline-none transition"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6B6962] mb-1.5">الرمز</label>
              <input
                type="text"
                dir="ltr"
                placeholder="CEDC101"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl bg-[#FAF9F5] border border-[#E2DFD7] px-3 py-2.5 text-sm font-mono-num font-semibold text-left text-[#141413] placeholder:text-[#A8A59D] focus:bg-white focus:border-[#141413] focus:outline-none transition"
              />
            </div>
          </div>

          {/* Day Pills */}
          <div>
            <label className="block text-xs font-semibold text-[#6B6962] mb-2">اليوم</label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {DAYS_ORDER.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  className={`py-2 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-[0.97] ${
                    day === d
                      ? 'bg-[#141413] text-white'
                      : 'bg-[#F5F4EF] text-[#3D3C38] hover:bg-[#EAE8E0]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Time Selection (Preset Pills + Clean 24h Selectors) */}
          <div>
            <label className="block text-xs font-semibold text-[#6B6962] mb-2">الوقت</label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {UNIVERSITY_SLOTS.map((slot) => {
                const isSelected = startTime === slot.start && endTime === slot.end;
                return (
                  <button
                    key={slot.label}
                    type="button"
                    dir="ltr"
                    onClick={() => {
                      setStartTime(slot.start);
                      setEndTime(slot.end);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-num font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#141413] text-white'
                        : 'bg-[#F5F4EF] text-[#3D3C38] hover:bg-[#EAE8E0]'
                    }`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#FAF9F5] border border-[#E2DFD7] rounded-xl p-2.5">
                <span className="block text-[11px] font-medium text-[#6B6962] mb-1">البداية</span>
                <div className="flex items-center gap-1.5" dir="ltr">
                  <select
                    value={startH}
                    onChange={(e) => setStartTime(`${e.target.value}:${startM}`)}
                    className="flex-1 bg-white border border-[#E2DFD7] rounded-lg py-1.5 px-2 text-sm font-mono-num font-semibold focus:outline-none focus:border-[#141413]"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="font-mono-num font-bold text-[#6B6962]">:</span>
                  <select
                    value={startM}
                    onChange={(e) => setStartTime(`${startH}:${e.target.value}`)}
                    className="flex-1 bg-white border border-[#E2DFD7] rounded-lg py-1.5 px-2 text-sm font-mono-num font-semibold focus:outline-none focus:border-[#141413]"
                  >
                    {MINUTES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-[#FAF9F5] border border-[#E2DFD7] rounded-xl p-2.5">
                <span className="block text-[11px] font-medium text-[#6B6962] mb-1">النهاية</span>
                <div className="flex items-center gap-1.5" dir="ltr">
                  <select
                    value={endH}
                    onChange={(e) => setEndTime(`${e.target.value}:${endM}`)}
                    className="flex-1 bg-white border border-[#E2DFD7] rounded-lg py-1.5 px-2 text-sm font-mono-num font-semibold focus:outline-none focus:border-[#141413]"
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="font-mono-num font-bold text-[#6B6962]">:</span>
                  <select
                    value={endM}
                    onChange={(e) => setEndTime(`${endH}:${e.target.value}`)}
                    className="flex-1 bg-white border border-[#E2DFD7] rounded-lg py-1.5 px-2 text-sm font-mono-num font-semibold focus:outline-none focus:border-[#141413]"
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

          {/* Type + Room + Floor */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-[#6B6962] mb-1.5">النوع</label>
              <div className="grid grid-cols-2 gap-1.5 bg-[#F5F4EF] p-1 rounded-xl">
                {(['نظري', 'عملي'] as SessionType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      type === t
                        ? 'bg-white text-[#141413] shadow-2xs'
                        : 'text-[#6B6962] hover:text-[#141413]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6B6962] mb-1.5">القاعة</label>
              <input
                type="text"
                dir="auto"
                placeholder="B-06 أو المدرّج"
                value={room}
                onChange={(e) => handleRoomChange(e.target.value)}
                className="w-full rounded-xl bg-[#FAF9F5] border border-[#E2DFD7] px-3 py-2 text-sm font-mono-num font-bold text-[#141413] placeholder:font-sans placeholder:font-normal placeholder:text-[#A8A59D] focus:bg-white focus:border-[#141413] focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#6B6962]">الطابق</label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !floorAuto;
                    setFloorAuto(next);
                    if (next && room.trim()) {
                      setFloor(detectFloorFromRoom(room, floorRules));
                    }
                  }}
                  className="text-[11px] font-medium text-[#6B6962] underline cursor-pointer"
                >
                  {floorAuto ? 'تلقائي' : 'تعديل يدوي'}
                </button>
              </div>
              <input
                type="text"
                placeholder="يُحدّد من القاعة"
                value={floor}
                onChange={(e) => {
                  setFloorAuto(false);
                  setFloor(e.target.value);
                }}
                className="w-full rounded-xl bg-[#FAF9F5] border border-[#E2DFD7] px-3 py-2 text-sm font-semibold text-[#141413] placeholder:font-normal placeholder:text-[#A8A59D] focus:bg-white focus:border-[#141413] focus:outline-none"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between pt-2 gap-3 border-t border-[#ECEAE3]">
            {session && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onDelete(session.id);
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-[#B42318] bg-[#FEF3F2] hover:bg-[#FEE4E2] transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                حذف
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#6B6962] hover:bg-[#F5F4EF] transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-[#141413] text-white hover:bg-[#2A2927] active:scale-[0.98] transition cursor-pointer"
              >
                حفظ
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
