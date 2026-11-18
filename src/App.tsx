import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Cloud, ImagePlus, Loader2, Plus, ScanLine, X } from 'lucide-react';
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
import { AttendanceDialog } from './components/AttendanceDialog';
import { CalendarDialog } from './components/CalendarDialog';
import { ImageDialog } from './components/ImageDialog';
import { InstallDialog, useInstall } from './components/InstallDialog';
import { BackupDialog } from './components/BackupDialog';
import { useBackupSync } from './services/useBackupSync';
import type { ScheduleBackup } from './services/backup';
import { EMPTY_ATTENDANCE, type Attendance } from './utils/attendance';

import { JadwaliBrand, WorkspaceMenu, WorkspaceNavigation, type WorkspaceTool } from './components/WorkspaceNavigation';
import { ScheduleBoard, WeekOverview, weekGroups, type DayFilter } from './components/ScheduleBoard';
import { scheduleDay } from './utils/semester';

const ATTENDANCE_KEY = 'jadwali_attendance_v1';
const dateFormat = new Intl.DateTimeFormat('ar-SY', { weekday: 'long', day: 'numeric', month: 'long', numberingSystem: 'latn' });

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
  const [scan, setScan] = useState<{ files: File[]; sessions: LectureSession[]; notices: string[]; failed: boolean } | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => setNow((previous) => {
      const current = new Date();
      return previous.toDateString() === current.toDateString() ? previous : current;
    });
    const timer = window.setInterval(refresh, 60_000);
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
    setStatusToast(additions.length
      ? `تمت إضافة ${additions.length} محاضرات للجدول.` : 'المحاضرات المحدّدة موجودة مسبقاً في الجدول.');
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
  const onUpload = () => fileInputRef.current?.click();
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
    <div className="jadwali-workspace">
      <a className="skip-link" href="#workspace-content">تجاوز إلى الجدول</a>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => {
        if (event.target.files?.length) void handleScanFiles(Array.from(event.target.files));
        event.target.value = '';
      }} />
      <WorkspaceNavigation onTool={openTool} onSchedule={onSchedule} />
      <div className="workspace-main">
        <header className="workspace-header">
          <div className="workspace-header-inner">
            <div className="header-brand"><JadwaliBrand onSchedule={onSchedule} /></div>
            <div className="header-location"><CalendarDays size={18} aria-hidden="true" /> الجدول</div>
            {hasSchedule && <div className="header-actions">
              <button className="button button-secondary header-add" type="button" aria-label="إضافة محاضرة" onClick={onNew}>
                <Plus size={19} aria-hidden="true" /><span>إضافة محاضرة</span>
              </button>
              <button className="button button-primary" type="button" disabled={isScanning} onClick={onUpload}>
                {isScanning ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <ScanLine size={17} aria-hidden="true" />}
                {isScanning ? 'جارٍ الاستيراد…' : 'استيراد صورة'}
              </button>
            </div>}
          </div>
        </header>
        <main id="workspace-content" className="workspace-content" tabIndex={-1}>
          <div className="workspace-title">
            <p className="workspace-date"><CalendarDays size={16} aria-hidden="true" /> {dateFormat.format(now)}</p>
            <h1>{metadata.title.trim() && metadata.title !== DEFAULT_META.title ? metadata.title : 'جدولي الدراسي'}</h1>
            {metadata.subtitle.trim() && <p className="workspace-subtitle" dir="auto">{metadata.subtitle}</p>}
            {hasSchedule && metadata.semester.trim() && <p className="workspace-semester">
              {metadata.semester.split(/(\d{4}\s*\/\s*\d{4})/).map((part, index) => index % 2 ? <bdi key={index} dir="ltr">{part}</bdi> : part)}
            </p>}
          </div>

          {statusToast && <div role="status" className="workspace-status">
            <CheckCircle2 size={19} aria-hidden="true" /><span>{statusToast}</span>
            <button className="icon-button" type="button" aria-label="إغلاق التنبيه" onClick={() => setStatusToast(null)}><X size={17} /></button>
          </div>}
          {isScanning && hasSchedule && !scan && <div role="status" className="workspace-status">
            <Loader2 size={19} className="animate-spin" aria-hidden="true" /><span>جارٍ قراءة الجدول. ستظهر المحاضرات للمراجعة.</span>
          </div>}

          {hasSchedule ? <div className="schedule-layout">
            <NextClass sessions={sessions} />
            <ScheduleBoard groups={groups} today={today} selectedDay={selectedDay} onDay={setSelectedDay}
              view={viewMode} onView={setViewMode} onNew={onNew}
              onEdit={(session) => { setEditingSession(session); setIsEditorOpen(true); }} />
            <WeekOverview groups={groups} today={today} />
          </div> : <section className="workspace-empty surface" aria-labelledby="empty-title" onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void handleScanFiles(Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/')));
              }}>
            <div className="workspace-empty-content">
              <span className="empty-mark"><ImagePlus size={26} aria-hidden="true" /></span>
              <h2 id="empty-title">أضف جدول محاضراتك</h2>
              <p>ارفع صورة أو لقطة شاشة لجدولك، ثم راجع المحاضرات المستخرجة واحفظها.</p>
              <div className="empty-actions">
                <button className="button button-primary" type="button" disabled={isScanning} onClick={onUpload}>
                  {isScanning ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <ScanLine size={18} aria-hidden="true" />}
                  <span role={isScanning ? 'status' : undefined}>{isScanning ? 'جارٍ قراءة الجدول…' : 'استيراد صورة'}</span>
                </button>
                <button className="button button-secondary" type="button" onClick={onNew}>
                  <Plus size={18} aria-hidden="true" /> إضافة محاضرة
                </button>
              </div>
              <button className="empty-restore" type="button" onClick={(event) => openTool('backup', event.currentTarget)}>
                <Cloud size={17} aria-hidden="true" /> استعادة جدول من جهاز آخر
              </button>
            </div>
            <div className="workspace-empty-photo" aria-hidden="true" />
          </section>}
        </main>
      </div>

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
      {scan && <ImportReview
        sessions={scan.sessions}
        notices={scan.notices}
        busy={isScanning}
        onClose={() => setScan(null)}
        onAddImages={(files) => handleScanFiles([...scan.files, ...files])}
        onRetry={scan.failed ? () => handleScanFiles(scan.files) : undefined}
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
