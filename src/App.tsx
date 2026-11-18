import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ClipboardCheck,
  Cloud,
  Image,
  Smartphone,
  Plus,
  Camera,
  FileText,
  SlidersHorizontal,
  Layers,
  Loader2,
  ArrowUpLeft,
  X,
} from 'lucide-react';
import {
  DAYS_ORDER,
  isSameMeeting,
  type DayOfWeek,
  type FloorRule,
  type LectureSession,
  type ScheduleMetadata,
} from './types';
import { DEFAULT_FLOOR_RULES, detectFloorFromRoom } from './utils/floorMapper';
import { uploadAndExtractSchedule } from './services/clientApi';
import { PdfExportDialog } from './components/PdfExportDialog';
import { ImportReview } from './components/ImportReview';
import { SessionEditorModal } from './components/SessionEditorModal';
import { FloorRulesModal } from './components/FloorRulesModal';
import { SettingsModal } from './components/SettingsModal';

import { NextClass } from './components/NextClass';
import { AttendanceDialog } from './components/AttendanceDialog';
import { CalendarDialog } from './components/CalendarDialog';
import { ImageDialog } from './components/ImageDialog';
import { InstallDialog, useInstall } from './components/InstallDialog';
import { BackupDialog } from './components/BackupDialog';
import { useBackupSync } from './services/useBackupSync';
import type { ScheduleBackup } from './services/backup';
import { EMPTY_ATTENDANCE, type Attendance } from './utils/attendance';

const ATTENDANCE_KEY = 'jadwali_attendance_v1';
const tools = [
  { id: 'attendance', label: 'الحضور', Icon: ClipboardCheck, needsSchedule: false },
  { id: 'calendar', label: 'التقويم', Icon: CalendarDays, needsSchedule: true },
  { id: 'image', label: 'مشاركة صورة', Icon: Image, needsSchedule: true },
  { id: 'install', label: 'تثبيت التطبيق', Icon: Smartphone, needsSchedule: false },
  { id: 'backup', label: 'نسخ ومزامنة', Icon: Cloud, needsSchedule: false },
] as const;

const SESSIONS_KEY = 'jadwali_user_sessions_v2';
const META_KEY = 'jadwali_user_meta_v2';
const RULES_KEY = 'jadwali_floor_rules_v2';

const DEFAULT_META: ScheduleMetadata = {
  title: 'الجدول الدراسي الأسبوعي',
  subtitle: '',
  semester: 'الفصل الأول 2026 / 2027',
};

export function App() {
  // Wipe legacy v1 demo keys immediately so old demo schedules never reappear
  useEffect(() => {
    localStorage.removeItem('dawamna_saved_sessions_v1');
    localStorage.removeItem('dawamna_saved_meta_v1');
    localStorage.removeItem('dawamna_floor_rules_v1');
  }, []);

  const [floorRules, setFloorRules] = useState<FloorRule[]>(() => {
    try {
      const raw = localStorage.getItem(RULES_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_FLOOR_RULES;
    } catch {
      return DEFAULT_FLOOR_RULES;
    }
  });

  const [metadata, setMetadata] = useState<ScheduleMetadata>(() => {
    try {
      const raw = localStorage.getItem(META_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_META;
    } catch {
      return DEFAULT_META;
    }
  });

  const [sessions, setSessions] = useState<LectureSession[]>(() => {
    try {
      const raw = localStorage.getItem(SESSIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [attendance, setAttendance] = useState<Attendance>(() => {
    try {
      return JSON.parse(localStorage.getItem(ATTENDANCE_KEY) ?? 'null') ?? EMPTY_ATTENDANCE;
    } catch {
      return EMPTY_ATTENDANCE;
    }
  });
  const [activeTool, setActiveTool] = useState<(typeof tools)[number]['id'] | null>(null);
  const closeTool = () => setActiveTool(null);
  const installation = useInstall();

  const snapshot = useMemo<ScheduleBackup>(() => ({ version: 1, sessions, metadata, floorRules, attendance }),
    [sessions, metadata, floorRules, attendance]);
  const restore = useCallback((backup: ScheduleBackup) => {
    setSessions(backup.sessions);
    setMetadata(backup.metadata);
    setFloorRules(backup.floorRules);
    setAttendance(backup.attendance);
    setSelectedDay('الكل');
  }, []);
  const sync = useBackupSync(snapshot, restore);

  const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'الكل'>('الكل');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Extraction & Export states
  const [isScanning, setIsScanning] = useState(false);
  const [scan, setScan] = useState<{ files: File[]; sessions: LectureSession[]; notices: string[]; failed: boolean } | null>(null);
  const [statusToast, setStatusToast] = useState<{
    kind: 'info' | 'error';
    text: string;
  } | null>(null);

  const [isPdfOpen, setIsPdfOpen] = useState(false);

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<LectureSession | null>(null);
  const [isFloorOpen, setIsFloorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const scanInProgress = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem(META_KEY, JSON.stringify(metadata));
  }, [metadata]);

  useEffect(() => {
    localStorage.setItem(RULES_KEY, JSON.stringify(floorRules));
  }, [floorRules]);

  useEffect(() => {
    localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(attendance));
  }, [attendance]);

  // Support Ctrl+V paste of screenshots on desktop
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!e.clipboardData?.files?.length) return;
      const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
      if (imgs.length > 0) handleScanFiles(scan ? [...scan.files, ...imgs] : imgs);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const handleScanFiles = async (files: File[]) => {
    if (!files.length || scanInProgress.current) return;
    scanInProgress.current = true;
    setIsScanning(true);
    setStatusToast(null);
    try {
      const result = await uploadAndExtractSchedule(files, floorRules);
      setScan((previous) => ({
        files,
        sessions: result.sessions.length ? result.sessions : previous?.sessions ?? [],
        notices: result.notices,
        failed: false,
      }));
    } catch (err) {
      const notice = err instanceof Error ? err.message : 'تعذّرت قراءة الصور. جرّب مرة أخرى.';
      setScan((previous) => ({ files, sessions: previous?.sessions ?? [], notices: [notice], failed: true }));
    } finally {
      scanInProgress.current = false;
      setIsScanning(false);
    }
  };

  const importSelected = (selected: LectureSession[]) => {
    const additions = selected.filter((incoming) => !sessions.some((saved) => isSameMeeting(saved, incoming)));
    setSessions((previous) => [...previous, ...additions.filter((incoming) =>
      !previous.some((saved) => isSameMeeting(saved, incoming)))]);
    setScan(null);
    setSelectedDay('الكل');
    setStatusToast({ kind: 'info', text: additions.length
      ? `تمت إضافة ${additions.length} محاضرات للجدول.` : 'المحاضرات المحدّدة موجودة مسبقاً في الجدول.' });
  };

  const handleSaveSession = (updated: LectureSession) => {
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === updated.id);
      const next = exists ? prev.map((s) => (s.id === updated.id ? updated : s)) : [...prev, updated];
      return next.sort((a, b) => {
        const d = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
        if (d !== 0) return d;
        return a.startTime.localeCompare(b.startTime);
      });
    });
  };

  const handleDeleteSession = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateFloorRules = (newRules: FloorRule[]) => {
    setFloorRules(newRules);
    setSessions((prev) =>
      prev.map((s) =>
        s.floorAuto && s.room !== '—'
          ? { ...s, floor: detectFloorFromRoom(s.room, newRules) }
          : s
      )
    );
  };

  const handleClearAll = () => {
    setSessions([]);
    setMetadata(DEFAULT_META);
    setSelectedDay('الكل');
    setStatusToast(null);
  };

  const sortedSessions = [...sessions].sort((a, b) => {
    const d = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
    if (d !== 0) return d;
    return a.startTime.localeCompare(b.startTime);
  });

  const visibleSessions =
    selectedDay === 'الكل'
      ? sortedSessions
      : sortedSessions.filter((s) => s.day === selectedDay);

  const dayCounts = DAYS_ORDER.map((day) => ({
    day,
    count: sortedSessions.filter((s) => s.day === day).length,
  }));

  const offDays = dayCounts.filter((d) => d.count === 0).map((d) => d.day);
  const uniqueCourses = new Set(sortedSessions.map((s) => s.courseName.trim())).size;

  return (
    <div className="min-h-dvh bg-[#F5F4EF] text-[#141413] flex flex-col">
      {/* Hidden global file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            handleScanFiles(Array.from(e.target.files));
            e.target.value = '';
          }
        }}
      />

      {/* Minimal Top Bar */}
      <header className="sticky top-0 z-30 bg-[#F5F4EF]/90 backdrop-blur-md border-b border-[#E6E4DC]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-bold tracking-tight text-[#141413]">جدولي</span>
            {sortedSessions.length > 0 && (
              <span className="text-[11px] font-mono-num font-semibold px-2 py-0.5 rounded-full bg-[#E8E6DE] text-[#3D3C38]">
                {sortedSessions.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsFloorOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-[#E2DFD7] text-[#141413] hover:bg-[#FAF9F5] active:scale-[0.98] transition cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-[#6B6962]" />
              <span>الطوابق</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-[#E2DFD7] text-[#3D3C38] hover:bg-[#FAF9F5] active:scale-[0.98] transition cursor-pointer"
              aria-label="الإعدادات"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 pt-6 pb-32">
        {/* Status Banner */}
        {statusToast && (
          <div
            className={`mb-4 px-4 py-3 rounded-2xl border text-xs font-medium flex items-center justify-between gap-3 ${
              statusToast.kind === 'error'
                ? 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
                : 'bg-white border-[#E2DFD7] text-[#141413]'
            }`}
          >
            <span role={statusToast.kind === 'error' ? 'alert' : 'status'}>{statusToast.text}</span>
            <button
              type="button"
              onClick={() => setStatusToast(null)}
              className="p-1 rounded-full hover:bg-black/5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {sessions.length > 0 && <NextClass sessions={sessions} />}
        <div aria-label="أدوات الجدول" className="mb-5 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
          {tools.filter(({ id, needsSchedule }) => (!needsSchedule || sessions.length > 0) &&
            (id !== 'attendance' || sessions.length > 0 || attendance.records.length > 0)).map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => setActiveTool(id)}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#E2DFD7] bg-white px-1.5 py-2.5 text-[11px] font-bold hover:border-[#173832] sm:px-3 sm:text-xs">
              <Icon size={15} aria-hidden="true" className="shrink-0 text-[#235047]" /> {label}
            </button>
          ))}
        </div>

        {sortedSessions.length === 0 ? (
          /* CLEAN EMPTY STATE — ZERO DEMO DATA */
          <div className="pt-6 sm:pt-12 space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141413] leading-snug">
                جدولك الجامعي مرتّب
                <br />
                وجاهز بصفحة واحدة.
              </h1>
              <p className="text-sm text-[#6B6962] leading-relaxed max-w-md">
                ارفع صورة الجدول ليقرأ المواد والأوقات ويحدّد طابق كل قاعة تلقائياً، أو بلّش بإضافة
                محاضراتك يدوياً.
              </p>
            </div>

            {/* Tactile Upload Surface */}
            <div
              onClick={() => !isScanning && fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const imgs = Array.from(e.dataTransfer.files).filter((f) =>
                  f.type.startsWith('image/')
                );
                if (imgs.length > 0) handleScanFiles(imgs);
              }}
              className={`bg-white rounded-[24px] border border-[#DFDDD4] p-7 sm:p-9 transition shadow-[0_2px_12px_rgba(0,0,0,0.03)] ${
                isScanning
                  ? 'opacity-80 cursor-wait'
                  : 'hover:border-[#141413] active:scale-[0.99] cursor-pointer'
              }`}
            >
              {isScanning ? (
                <div className="py-6 flex flex-col items-center text-center space-y-3">
                  <Loader2 className="w-7 h-7 animate-spin text-[#141413]" />
                  <div className="text-sm font-bold text-[#141413]">جاري قراءة الجدول...</div>
                  <div className="text-xs text-[#6B6962]">
                    يتم استخراج الأوقات والقاعات وتحديد الطوابق
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-start space-y-5">
                  <div className="w-12 h-12 rounded-2xl bg-[#141413] text-white flex items-center justify-center">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-base font-bold text-[#141413]">
                      ارفع صورة الجدول أو لقطة شاشة
                    </div>
                    <div className="text-xs text-[#6B6962]">
                      تُرسل الصور إلى نموذج Qwen للقراءة، ثم يمكنك مراجعة النتائج قبل إضافتها.
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#141413] bg-[#F5F4EF] px-3.5 py-2 rounded-full">
                    <span>اختيار من الصور</span>
                    <ArrowUpLeft className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}
            </div>

            {/* Secondary Manual Action + Active Floor Legend */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <button
                type="button"
                onClick={() => {
                  setEditingSession(null);
                  setIsEditorOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full bg-white border border-[#DFDDD4] text-xs font-bold text-[#141413] hover:border-[#141413] active:scale-[0.98] transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة محاضرة يدوياً</span>
              </button>

              <div className="text-[11px] text-[#78766F] flex flex-wrap items-center gap-x-2 gap-y-1">
                {floorRules.map((r) => (
                  <span key={r.id}>
                    <strong dir="ltr" className="font-mono-num text-[#3D3C38]">
                      {r.prefix}
                    </strong>{' '}
                    = {r.floor}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ACTIVE TIMETABLE WORKSPACE */
          <div className="space-y-5">
            {/* Editable Editorial Title Block */}
            <div className="space-y-1.5">
              <input
                type="text"
                value={metadata.semester}
                onChange={(e) => setMetadata((m) => ({ ...m, semester: e.target.value }))}
                className="text-xs font-semibold text-[#6B6962] bg-transparent focus:outline-none focus:text-[#141413] w-full"
                placeholder="الفصل الدراسي"
              />
              <div className="flex items-baseline justify-between gap-3">
                <input
                  type="text"
                  value={metadata.title}
                  onChange={(e) => setMetadata((m) => ({ ...m, title: e.target.value }))}
                  className="text-xl sm:text-2xl font-bold text-[#141413] bg-transparent border-b border-transparent focus:border-[#141413] focus:outline-none w-full pb-0.5"
                  placeholder="عنوان الجدول"
                />
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="text-xs text-[#6B6962] font-medium leading-relaxed">
                  <span>{uniqueCourses} مواد</span>
                  <span> · </span>
                  <span>{sortedSessions.length} جلسات</span>
                  {offDays.length > 0 && offDays.length <= 3 && (
                    <>
                      <span> · </span>
                      <span>عطلة: {offDays.join('، ')}</span>
                    </>
                  )}
                </div>

                {/* Segmented View Toggle */}
                <div className="inline-flex bg-[#EAE8E0] p-0.5 rounded-full shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode('cards')}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                      viewMode === 'cards' ? 'bg-white text-[#141413] shadow-2xs' : 'text-[#6B6962]'
                    }`}
                  >
                    بطاقات
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                      viewMode === 'table' ? 'bg-white text-[#141413] shadow-2xs' : 'text-[#6B6962]'
                    }`}
                  >
                    جدول
                  </button>
                </div>
              </div>
            </div>

            {/* Day Scrubber */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 -mx-4 px-4">
              <button
                type="button"
                onClick={() => setSelectedDay('الكل')}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  selectedDay === 'الكل'
                    ? 'bg-[#141413] text-white'
                    : 'bg-white border border-[#E2DFD7] text-[#3D3C38]'
                }`}
              >
                الكل
              </button>
              {dayCounts.map(({ day, count }) => {
                const active = selectedDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                      active
                        ? 'bg-[#141413] text-white font-bold'
                        : count === 0
                        ? 'bg-transparent text-[#9E9B92] border border-transparent'
                        : 'bg-white border border-[#E2DFD7] text-[#141413]'
                    }`}
                  >
                    <span>{day}</span>
                    {count > 0 && (
                      <span
                        className={`text-[10px] font-mono-num ${
                          active ? 'text-white/75' : 'text-[#78766F]'
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Sessions Content */}
            {visibleSessions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E6E4DC] p-8 text-center space-y-3">
                <div className="text-sm font-bold text-[#141413]">
                  لا توجد محاضرات يوم {selectedDay}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingSession(null);
                    setIsEditorOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#F5F4EF] text-[#141413] hover:bg-[#EAE8E0] transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  إضافة محاضرة في {selectedDay}
                </button>
              </div>
            ) : viewMode === 'cards' ? (
              <div className="space-y-5">
                {DAYS_ORDER.filter((d) => selectedDay === 'الكل' || selectedDay === d).map(
                  (day) => {
                    const items = visibleSessions.filter((s) => s.day === day);
                    if (items.length === 0) return null;

                    return (
                      <section key={day} className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <h2 className="text-xs font-bold text-[#6B6962]">{day}</h2>
                          <span className="text-[11px] font-mono-num text-[#9E9B92]">
                            {items.length}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {items.map((session) => {
                            const isPractical = session.type === 'عملي';
                            return (
                              <div
                                key={session.id}
                                onClick={() => {
                                  setEditingSession(session);
                                  setIsEditorOpen(true);
                                }}
                                className="bg-white rounded-2xl border border-[#E4E2DA] hover:border-[#141413] active:scale-[0.99] transition cursor-pointer flex items-stretch overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                              >
                                {/* Right Main Details */}
                                <div className="flex-1 p-4 min-w-0 flex flex-col justify-center gap-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      dir="ltr"
                                      className="text-xs font-mono-num font-semibold text-[#3D3C38]"
                                    >
                                      {session.startTime} – {session.endTime}
                                    </span>

                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                        isPractical
                                          ? 'bg-[#FEF0E6] text-[#9A3412]'
                                          : 'bg-[#EBF2FA] text-[#1E3A5F]'
                                      }`}
                                    >
                                      {session.type}
                                    </span>

                                    {session.courseCode && (
                                      <span
                                        dir="ltr"
                                        className="text-[11px] font-mono-num text-[#8C8980]"
                                      >
                                        {session.courseCode}
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[15px] font-bold text-[#141413] truncate">
                                    {session.courseName}
                                  </div>
                                </div>

                                {/* Left Architectural Room + Floor Stub */}
                                <div className="w-25 sm:w-28 shrink-0 bg-[#FAF9F5] border-r border-[#ECEAE2] px-3 py-3 flex flex-col items-center justify-center text-center">
                                  <div
                                    dir="ltr"
                                    className="text-sm font-mono-num font-bold text-[#141413]"
                                  >
                                    {session.room}
                                  </div>
                                  <div className="text-[11px] font-medium text-[#6B6962] mt-0.5">
                                    {session.floor && session.floor !== '—'
                                      ? `طابق: ${session.floor}`
                                      : '—'}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  }
                )}
              </div>
            ) : (
              /* Mobile-Perfected 4-Column Grouped Table View (Zero Horizontal Clipping!) */
              <div className="bg-white rounded-2xl border border-[#DFDDD4] overflow-hidden shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
                <table className="w-full text-xs sm:text-sm border-collapse table-fixed">
                  <thead>
                    <tr className="bg-[#FAF9F5] border-b border-[#DFDDD4] text-[#57554F] text-[11px] font-bold">
                      <th className="py-3 px-2.5 text-right w-[18%]">اليوم</th>
                      <th className="py-3 px-2.5 text-right w-[36%]">المادة</th>
                      <th className="py-3 px-2 text-center w-[26%]">الوقت</th>
                      <th className="py-3 px-2.5 text-center w-[20%]">القاعة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS_ORDER.filter((d) => selectedDay === 'الكل' || selectedDay === d).map(
                      (day, groupIdx) => {
                        const dayItems = visibleSessions.filter((s) => s.day === day);
                        if (dayItems.length === 0) return null;

                        return dayItems.map((session, idx) => {
                          const isFirstOfDay = idx === 0;
                          const isPractical = session.type === 'عملي';

                          return (
                            <tr
                              key={session.id}
                              onClick={() => {
                                setEditingSession(session);
                                setIsEditorOpen(true);
                              }}
                              className={`hover:bg-[#FAF9F5] active:bg-[#F3F1EA] cursor-pointer transition ${
                                groupIdx === 0 && idx === 0
                                  ? ''
                                  : isFirstOfDay
                                  ? 'border-t border-[#D6D3C9]'
                                  : 'border-t border-[#F0EFEA]'
                              }`}
                            >
                              {isFirstOfDay && (
                                <td
                                  rowSpan={dayItems.length}
                                  className="py-3 px-2.5 font-bold text-[#141413] bg-[#FAF9F5]/80 border-l border-[#ECEAE2] align-middle text-xs sm:text-sm"
                                >
                                  {day}
                                </td>
                              )}
                              <td className="py-2.5 px-2.5 align-middle">
                                <div className="font-bold text-[#141413] leading-snug break-words">
                                  {session.courseName}
                                </div>
                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      isPractical
                                        ? 'bg-[#FEF0E6] text-[#9A3412]'
                                        : 'bg-[#EBF2FA] text-[#1E3A5F]'
                                    }`}
                                  >
                                    {session.type}
                                  </span>
                                </div>
                              </td>
                              <td
                                dir="ltr"
                                className="py-2.5 px-1.5 text-center font-mono-num text-[11px] sm:text-xs font-semibold text-[#3D3C38] whitespace-nowrap align-middle"
                              >
                                {session.startTime} – {session.endTime}
                              </td>
                              <td className="py-2.5 px-2 text-center align-middle">
                                <div
                                  dir="ltr"
                                  className="font-mono-num font-bold text-xs sm:text-sm text-[#141413]"
                                >
                                  {session.room}
                                </div>
                                {session.floor && session.floor !== '—' && (
                                  <div className="text-[10px] sm:text-[11px] font-medium text-[#6B6962] mt-0.5">
                                    {session.floor}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        });
                      }
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Thumb-Zone Action Bar (only when sessions exist) */}
      {sortedSessions.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-none pb-[max(1rem,env(safe-area-inset-bottom))] px-4">
          <div className="max-w-md mx-auto pointer-events-auto space-y-2">
            <div className="bg-[#141413] text-white rounded-full p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.18)] flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPdfOpen(true)}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-white text-[#141413] text-xs font-bold hover:bg-[#F5F4EF] active:scale-[0.98] transition cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>تصدير PDF</span>
              </button>

              <button
                type="button"
                disabled={isScanning}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-full text-xs font-semibold text-white/90 hover:bg-white/10 active:scale-[0.98] transition cursor-pointer"
                title="إضافة صورة جدول"
              >
                {isScanning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <span className="hidden xs:inline">صورة</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingSession(null);
                  setIsEditorOpen(true);
                }}
                className="inline-flex items-center justify-center gap-1 py-2.5 px-3.5 rounded-full text-xs font-semibold text-white/90 hover:bg-white/10 active:scale-[0.98] transition cursor-pointer"
                title="إضافة محاضرة"
              >
                <Plus className="w-4 h-4" />
                <span>محاضرة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTool === 'attendance' && <AttendanceDialog sessions={sessions} attendance={attendance} onChange={setAttendance} onClose={closeTool} />}
      {activeTool === 'calendar' && <CalendarDialog sessions={sessions} onClose={closeTool} />}
      {activeTool === 'image' && <ImageDialog sessions={sessions} metadata={metadata} onClose={closeTool} />}
      {activeTool === 'install' && <InstallDialog installation={installation} onClose={closeTool} />}
      {activeTool === 'backup' && <BackupDialog sync={sync} hasData={sessions.length > 0 || attendance.records.length > 0 ||
        Object.keys(attendance.limits).length > 0 || JSON.stringify(floorRules) !== JSON.stringify(DEFAULT_FLOOR_RULES) ||
        JSON.stringify(metadata) !== JSON.stringify(DEFAULT_META)} onClose={closeTool} />}

      {/* Modals */}
      {isPdfOpen && <PdfExportDialog metadata={metadata} sessions={sessions} floorRules={floorRules}
        onClose={() => setIsPdfOpen(false)} />}
      {scan && <ImportReview
        sessions={scan.sessions}
        notices={scan.notices}
        busy={isScanning}
        onClose={() => setScan(null)}
        onAddImages={(files) => handleScanFiles([...scan.files, ...files])}
        onRetry={scan.failed ? () => handleScanFiles(scan.files) : undefined}
        onImport={importSelected}
      />}
      <SessionEditorModal
        isOpen={isEditorOpen}
        session={editingSession}
        floorRules={floorRules}
        defaultDay={selectedDay === 'الكل' ? 'السبت' : selectedDay}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveSession}
        onDelete={handleDeleteSession}
      />

      <FloorRulesModal
        isOpen={isFloorOpen}
        rules={floorRules}
        onClose={() => setIsFloorOpen(false)}
        onSaveRules={handleUpdateFloorRules}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        hasSessions={sortedSessions.length > 0}
        onClose={() => setIsSettingsOpen(false)}
        onClearAll={handleClearAll}
      />
    </div>
  );
}

export default App;
