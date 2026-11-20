import { useLocale } from '../locale';
import { useState } from 'react';
import { Cloud, Copy, RefreshCw } from 'lucide-react';
import type { useBackupSync } from '../services/useBackupSync';
import { fieldStyle, primaryStyle, secondaryStyle, ToolDialog } from './ToolDialog';

export function BackupDialog({ sync, hasData, onClose }: { sync: ReturnType<typeof useBackupSync>; hasData: boolean; onClose: () => void }) {
  const { t } = useLocale();
  const [input, setInput] = useState('');
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [replace, setReplace] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = sync.status === 'working';

  return (
    <ToolDialog title={t("النسخ الاحتياطي والمزامنة")} icon={Cloud} onClose={onClose}>
      {sync.code ? <>
        <p className="text-sm leading-relaxed text-[var(--muted)]">{t("جدولك وحضورك وإعدادات الطوابق تُشفّر قبل رفعها. لربط هاتف أو كمبيوتر، افتح جدولي عليه وأدخل رمز الاسترداد.")}</p>
        <div className="space-y-2 rounded-md border border-[var(--line)] bg-white p-3">
          <button type="button" className={secondaryStyle} onClick={() => setReveal(!reveal)}>{reveal ? t("إخفاء الرمز") : t("إظهار رمز الاسترداد")}</button>
          {reveal && <>
            <input aria-label={t("رمزك للاسترداد")} dir="ltr" type="text" value={sync.code} readOnly autoComplete="off" className={`${fieldStyle} font-mono-num`} onFocus={(event) => event.target.select()} />
            <button type="button" className={secondaryStyle} onClick={async () => {
              try { await navigator.clipboard.writeText(sync.code!); setCopied(true); } catch { setCopied(false); }
            }}><Copy size={15} /> {copied ? t("تم النسخ") : t("نسخ الرمز")}</button>
            <p className="text-xs text-[var(--muted)]">{t("احتفظ بالرمز في مكان آمن. يحتاج إليه أي جهاز يفتح النسخة، ولا يمكن استعادته إذا فقدته.")}</p>
          </>}
        </div>
        {sync.conflict && <div className="notice notice-warning">
          <p className="text-sm">{t("تغيّرت البيانات على هذا الجهاز وفي النسخة السحابية. اختر النسخة التي تريد الاحتفاظ بها.")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryStyle} disabled={busy} onClick={() => void sync.resolve(false)}>{t("الاحتفاظ ببيانات هذا الجهاز")}</button>
            <button type="button" className={secondaryStyle} disabled={busy} onClick={() => void sync.resolve(true)}>{t("استخدام النسخة السحابية")}</button>
          </div>
        </div>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryStyle} disabled={busy || !!sync.conflict} onClick={sync.synchronize}><RefreshCw size={16} />{' ' + t("مزامنة الآن")}</button>
          <button type="button" className={secondaryStyle} disabled={busy} onClick={() => { setConfirmDelete(false); sync.disconnect(); }}>{t("فصل هذا الجهاز")}</button>
        </div>
        {confirmDelete ? <div className="notice notice-error">
          <p className="text-xs leading-relaxed">{t("سيُحذف النسخ الاحتياطي السحابي ويتوقف رمز الاسترداد عن العمل. تبقى البيانات المحفوظة على أجهزتك.")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryStyle + ' text-red-800'} disabled={busy} onClick={() => void sync.removeCloudCopy()}>{t("حذف النسخة نهائياً")}</button>
            <button type="button" className={secondaryStyle} onClick={() => setConfirmDelete(false)}>{t("إلغاء")}</button>
          </div>
        </div> : <button type="button" className="text-xs font-semibold text-red-800 underline" onClick={() => setConfirmDelete(true)}>{t("حذف النسخة السحابية")}</button>}
      </> : <>
        <p className="text-sm leading-relaxed text-[var(--muted)]">{t("احفظ نسخة مشفّرة من جدولك وحضورك وإعدادات الطوابق، أو استعد نسخة أنشأتها على جهاز آخر.")}</p>
        <button type="button" className={primaryStyle} disabled={busy} onClick={() => void sync.create()}><Cloud size={16} />{' ' + t("تفعيل المزامنة")}</button>
        <form className="space-y-3 border-t border-[var(--line)] pt-4" onSubmit={(event) => {
          event.preventDefault();
          if (!hasData || replace) void sync.connect(input.trim());
        }}>
          <label className="grid gap-1 text-xs font-bold">{t("رمز الاسترداد من جهاز آخر")}<input className={`${fieldStyle} font-mono-num`} dir="ltr" value={input} autoComplete="off" autoCapitalize="none" spellCheck={false}
              onChange={(event) => setInput(event.target.value)} />
          </label>
          {hasData && input.trim() && <label className="flex items-start gap-2 text-xs leading-relaxed">
            <input className="mt-0.5" type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} />{t("أفهم أن الاستعادة ستستبدل الجدول والحضور وإعدادات الطوابق على هذا الجهاز.")}</label>}
          <button className={secondaryStyle} disabled={busy || !input.trim() || (hasData && !replace)}>{t("ربط هذا الجهاز واستعادة النسخة")}</button>
        </form>
      </>}
      {busy && <p role="status" className="text-xs">{t("جارٍ مزامنة النسخة…")}</p>}
      {sync.status === 'synced' && <p role="status" className="text-xs font-bold text-[var(--success)]">{t("تمت المزامنة.")}</p>}
      {sync.status === 'offline' && <p role="status" className="text-xs">{t("أنت دون اتصال. بقيت تعديلاتك على هذا الجهاز.")}</p>}
      {sync.error && sync.status !== 'offline' && <p role="alert" className="text-xs font-bold text-red-800">{t(sync.error)}</p>}
    </ToolDialog>
  );
}
