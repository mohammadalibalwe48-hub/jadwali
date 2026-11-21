import { useLocale } from './locale';
import { MAX_VISION_SCREENS } from './services/visionSettings';
import { UploadDialog } from './components/UploadDialog';
import { Welcome } from './components/Welcome';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Plus, ScanLine, X } from 'lucide-react';
import {
  DAYS_ORDER,
  isSameMeeting,
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
import { TodayView } from './components/TodayView';
import { AttendanceDialog } from './components/AttendanceDialog';
import { CalendarDialog } from './components/CalendarDialog';
import { ImageDialog } from './components/ImageDialog';
import { InstallDialog, useInstall } from './components/InstallDialog';
import { BackupDialog } from './components/BackupDialog';
import { useBackupSync } from './services/useBackupSync';
import type { ScheduleBackup } from './services/backup';
import { EMPTY_ATTENDANCE, type Attendance } from './utils/attendance';

import { WorkspaceMenu, WorkspaceNavigation, type WorkspaceTool } from './components/WorkspaceNavigation';
import { ScheduleBoard, weekGroups, type DayFilter } from './components/ScheduleBoard';
import { localDate, scheduleDay } from './utils/semester';

const ATTENDANCE_KEY = 'jadwali_attendance_v1';
const dates = Object.fromEntries(['ar', 'en'].map((locale) => [
  locale, new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SY' : 'en', {
    weekday: 'long', day: 'numeric', month: 'long', numberingSystem: 'latn',
  }),
]));

const SESSIONS_KEY = 'jadwali_user_sessions_v2';
const META_KEY = 'jadwali_user_meta_v2';
const RULES_KEY = 'jadwali_floor_rules_v2';

const DEFAULT_META: ScheduleMetadata = {
  title: 'الجدول الدراسي الأسبوعي',
  subtitle: '',
  semester: 'الفصل الأول 2026 / 2027',
};

export function App() {
  const { t, locale } = useLocale();
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
  const [activeTool, setActiveTool] = useState<WorkspaceTool | null>(null);
  const toolLauncher = useRef<HTMLButtonElement | null>(null);
  const openTool = (tool: WorkspaceTool, launcher: HTMLButtonElement) => {
    toolLauncher.current = launcher;
    setActiveTool(tool);
  };
  const closeTool = () => {
    const launcher = toolLauncher.current;
    toolLauncher.current = null;
    setActiveTool(null);
    if (launcher) requestAnimationFrame(() => launcher.focus({ preventScroll: true }));
  };
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

  const [selectedDay, setSelectedDay] = useState<DayFilter>('الكل');
  const [viewMode, setViewMode] = useState<'agenda' | 'table'>('agenda');

  // Extraction & Export states
  const [isScanning, setIsScanning] = useState(false);
  const [pending, setPending] = useState<File[] | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [scan, setScan] = useState<{ files: File[]; sessions: LectureSession[]; notices: string[]; failed: boolean } | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 10_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<LectureSession | null>(null);

  const scanInProgress = useRef(false);

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

  function stageImages(files: File[], replacing = false) {
    if (scanInProgress.current) return;
    const images = files.filter((file) => file.type.startsWith('image/') ||
      (!file.type && /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp)$/i.test(file.name)));
    const prior = replacing ? [] : pending ?? [];
    if (!images.length || prior.length + images.length > MAX_VISION_SCREENS) {
      setPending(pending ?? []);
      setUploadError(!images.length ? t('اختر صورة جدول صالحة.', 'Choose a valid timetable image.') :
        t(`يمكنك اختيار ${MAX_VISION_SCREENS} صور كحد أقصى.`, `You can choose up to ${MAX_VISION_SCREENS} images.`));
      return;
    }
    setPending([...prior, ...images]);
    setUploadError(images.length === files.length ? '' : t('تم تجاهل الملفات غير المدعومة.', 'Non-image files were skipped.'));
  }

  const handleScanFiles = async (files: File[], continuation = false) => {
    if (!files.length || scanInProgress.current) return;
    scanInProgress.current = true;
    setIsScanning(true);
    setStatusToast(null);
    if (!continuation) setScan(null);
    try {
      const result = await uploadAndExtractSchedule(files, floorRules);
      setScan((previous) => ({
        files,
        sessions: result.sessions.length || !continuation ? result.sessions : previous?.sessions ?? [],
        notices: result.notices,
        failed: false,
      }));
    } catch (err) {
      const fallback = 'تعذّرت قراءة الصور. جرّب مرة أخرى.';
      const notice = err instanceof Error ? err.message : fallback;
      const translated = t(notice);
      setScan((previous) => ({
        files,
        sessions: continuation ? previous?.sessions ?? [] : [],
        notices: [locale === 'en' && translated === notice ? t(fallback) : translated],
        failed: true,
      }));
    } finally {
      scanInProgress.current = false;
      setPending(null);
      setIsScanning(false);
    }
  };

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (activeTool || isEditorOpen || scanInProgress.current) return;
      const images = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
      if (!images.length) return;
      if (scan) void handleScanFiles([...scan.files, ...images], true);
      else stageImages(images);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const importSelected = (selected: LectureSession[]) => {
    const additions = selected.filter((incoming) => !sessions.some((saved) => isSameMeeting(saved, incoming)));
    setSessions((previous) => [...previous, ...additions.filter((incoming) =>
      !previous.some((saved) => isSameMeeting(saved, incoming)))]);
    setScan(null);
    setSelectedDay('الكل');
    setStatusToast(additions.length
      ? t(`تمت إضافة ${additions.length} محاضرات للجدول.`, `Added ${additions.length} ${additions.length === 1 ? 'class' : 'classes'} to your timetable.`)
      : t('المحاضرات المحدّدة موجودة مسبقاً في الجدول.'));
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

  const groups = useMemo(() => weekGroups(sessions), [sessions]);
  const today = scheduleDay(now);
  const hasSchedule = sessions.length > 0;
  const onUpload = () => { setUploadError(''); setPending([]); };
  const onNew = () => {
    setEditingSession(null);
    setIsEditorOpen(true);
  };
  const onSchedule = () => {
    closeTool();
    setSelectedDay('الكل');
    window.scrollTo(0, 0);
  };

  return (
    <div className="jadwali-workspace" data-state={hasSchedule ? 'ready' : 'welcome'}>
      <a className="skip-link" href="#workspace-content">{t('تجاوز إلى الجدول')}</a>
      <WorkspaceNavigation onTool={openTool} onSchedule={onSchedule} />
      <main id="workspace-content" className="workspace-content" tabIndex={-1}>
        {hasSchedule && <div className="workspace-masthead">
          <div className="workspace-title">
            <time className="workspace-date" dateTime={localDate(now)}><CalendarDays size={15} aria-hidden="true" />{dates[locale].format(now)}</time>
            <h1>{metadata.title.trim() && metadata.title !== DEFAULT_META.title ? metadata.title : t('جدول المحاضرات')}</h1>
            {metadata.subtitle.trim() && <p className="workspace-subtitle" dir="auto">{metadata.subtitle}</p>}
            {metadata.semester.trim() && <p className="workspace-semester">
              {(metadata.semester === DEFAULT_META.semester
                  ? t(DEFAULT_META.semester, 'First term 2026 / 2027') : metadata.semester).split(/(\d{4}\s*\/\s*\d{4})/).map((part, index) => index % 2 ? <bdi key={index} dir="ltr">{part}</bdi> : part)}
            </p>}
          </div>
          <div className="schedule-actions">
            <button className="button button-secondary" type="button" onClick={onNew}>
              <Plus size={17} aria-hidden="true" />{t('إضافة محاضرة')}
            </button>
            <button className="button button-primary" type="button" disabled={isScanning} onClick={onUpload}>
              <ScanLine size={17} aria-hidden="true" />{t('استيراد صورة')}
            </button>
          </div>
        </div>}

        {statusToast && <div role="status" className="workspace-status">
          <CheckCircle2 size={19} aria-hidden="true" /><span>{statusToast}</span>
          <button className="icon-button" type="button" aria-label={t('إغلاق التنبيه')} onClick={() => setStatusToast(null)}><X size={17} /></button>
        </div>}
        {hasSchedule ? <div className="workspace-grid">
          <div className="workspace-agenda">
            <NextClass sessions={sessions} now={now} />
            <TodayView sessions={sessions} now={now} attendance={attendance} onAttendance={setAttendance} />
          </div>
          <ScheduleBoard groups={groups} today={today} selectedDay={selectedDay} onDay={setSelectedDay}
            view={viewMode} onView={setViewMode} onNew={onNew}
            onEdit={(session) => { setEditingSession(session); setIsEditorOpen(true); }} />
        </div> : <Welcome onUpload={onUpload} onNew={onNew} onRestore={(launcher) => openTool('backup', launcher)}
          onDrop={stageImages} />}
      </main>

      {(activeTool === 'export' || activeTool === 'more') && <WorkspaceMenu type={activeTool} hasSchedule={hasSchedule}
        onTool={setActiveTool} onClose={closeTool} />}
      {activeTool === 'attendance' && <AttendanceDialog sessions={sessions} attendance={attendance} onChange={setAttendance} onClose={closeTool} />}
      {activeTool === 'calendar' && <CalendarDialog sessions={sessions} onClose={closeTool} />}
      {activeTool === 'image' && <ImageDialog sessions={sessions} metadata={metadata} onClose={closeTool} />}
      {activeTool === 'install' && <InstallDialog installation={installation} onClose={closeTool} />}
      {activeTool === 'backup' && <BackupDialog sync={sync} hasData={hasSchedule || attendance.records.length > 0 ||
        Object.keys(attendance.limits).length > 0 || JSON.stringify(floorRules) !== JSON.stringify(DEFAULT_FLOOR_RULES) ||
        JSON.stringify(metadata) !== JSON.stringify(DEFAULT_META)} onClose={closeTool} />}
      {activeTool === 'pdf' && <PdfExportDialog metadata={metadata} sessions={sessions} floorRules={floorRules} onClose={closeTool} />}
      {activeTool === 'floor' && <FloorRulesModal rules={floorRules} onClose={closeTool} onSaveRules={handleUpdateFloorRules} />}
      {activeTool === 'settings' && <SettingsModal hasSessions={hasSchedule} onClose={closeTool} onClearAll={handleClearAll} />}
      {pending && <UploadDialog files={pending} busy={isScanning} error={uploadError}
        onAdd={stageImages} onReplace={(files) => stageImages(files, true)}
        onRemove={(index) => { setPending((files) => files?.filter((_, i) => i !== index) ?? []); setUploadError(''); }}
        onScan={() => void handleScanFiles(pending)}
        onClose={() => setPending(null)} />}
      {scan && !pending && <ImportReview
        files={scan.files}
        sessions={scan.sessions}
        notices={scan.notices}
        busy={isScanning}
        onClose={() => setScan(null)}
        onAddImages={(files) => handleScanFiles([...scan.files, ...files], true)}
        onRetry={scan.failed ? () => handleScanFiles(scan.files, true) : undefined}
        onImport={importSelected}
      />}
      {isEditorOpen && <SessionEditorModal
        session={editingSession}
        floorRules={floorRules}
        defaultDay={selectedDay === 'الكل' ? today : selectedDay}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSaveSession}
        onDelete={handleDeleteSession}
      />}
    </div>
  );
}

export default App;
