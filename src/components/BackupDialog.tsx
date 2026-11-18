import { useState } from 'react';
import { Cloud, Copy, RefreshCw } from 'lucide-react';
import type { useBackupSync } from '../services/useBackupSync';
import { fieldStyle, primaryStyle, secondaryStyle, ToolDialog } from './ToolDialog';

export function BackupDialog({ sync, hasData, onClose }: { sync: ReturnType<typeof useBackupSync>; hasData: boolean; onClose: () => void }) {
  const [input, setInput] = useState('');
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [replace, setReplace] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = sync.status === 'working';

  return (
    <ToolDialog title="النسخ الاحتياطي والمزامنة" onClose={onClose}>
      {sync.code ? <>
        <p className="text-sm leading-relaxed text-[#5F5D55]">جدولك وحضورك وإعدادات الطوابق تُشفّر قبل رفعها. لربط هاتف أو كمبيوتر، افتح جدولي عليه وأدخل رمز الاسترداد.</p>
        <div className="space-y-2 rounded-xl border border-[#DCD9CF] bg-white p-3">
          <button type="button" className={secondaryStyle} onClick={() => setReveal(!reveal)}>{reveal ? 'إخفاء الرمز' : 'إظهار رمز الاسترداد'}</button>
          {reveal && <>
            <input aria-label="رمزك للاسترداد" dir="ltr" type="text" value={sync.code} readOnly autoComplete="off" className={`${fieldStyle} font-mono-num`} onFocus={(event) => event.target.select()} />
            <button type="button" className={secondaryStyle} onClick={async () => {
              try { await navigator.clipboard.writeText(sync.code!); setCopied(true); } catch { setCopied(false); }
            }}><Copy size={15} /> {copied ? 'تم النسخ' : 'نسخ الرمز'}</button>
            <p className="text-xs text-[#5F5D55]">احتفظ بالرمز في مكان آمن. يحتاج إليه أي جهاز يفتح النسخة، ولا يمكن استعادته إذا فقدته.</p>
          </>}
        </div>
        {sync.conflict && <div className="space-y-2 rounded-xl border border-[#DEC080] bg-[#FAECCC] p-3">
          <p className="text-sm">تغيّرت البيانات على هذا الجهاز وفي النسخة السحابية. اختر النسخة التي تريد الاحتفاظ بها.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={primaryStyle} disabled={busy} onClick={() => void sync.resolve(false)}>الاحتفاظ ببيانات هذا الجهاز</button>
            <button type="button" className={secondaryStyle} disabled={busy} onClick={() => void sync.resolve(true)}>استخدام النسخة السحابية</button>
          </div>
        </div>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryStyle} disabled={busy || !!sync.conflict} onClick={sync.synchronize}><RefreshCw size={16} /> مزامنة الآن</button>
          <button type="button" className={secondaryStyle} disabled={busy} onClick={() => { setConfirmDelete(false); sync.disconnect(); }}>فصل هذا الجهاز</button>
        </div>
        {confirmDelete ? <div className="space-y-2 rounded-xl border border-[#E1AEAA] bg-[#FCE3E0] p-3">
          <p className="text-xs leading-relaxed">سيُحذف النسخ الاحتياطي السحابي ويتوقف رمز الاسترداد عن العمل. تبقى البيانات المحفوظة على أجهزتك.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondaryStyle + ' text-red-800'} disabled={busy} onClick={() => void sync.removeCloudCopy()}>حذف النسخة نهائياً</button>
            <button type="button" className={secondaryStyle} onClick={() => setConfirmDelete(false)}>إلغاء</button>
          </div>
        </div> : <button type="button" className="text-xs font-semibold text-red-800 underline" onClick={() => setConfirmDelete(true)}>حذف النسخة السحابية</button>}
      </> : <>
        <p className="text-sm leading-relaxed text-[#5F5D55]">احفظ نسخة مشفّرة من جدولك وحضورك وإعدادات الطوابق، أو استعد نسخة أنشأتها على جهاز آخر.</p>
        <button type="button" className={primaryStyle} disabled={busy} onClick={() => void sync.create()}><Cloud size={16} /> تفعيل المزامنة</button>
        <form className="space-y-3 border-t border-[#E2DFD7] pt-4" onSubmit={(event) => {
          event.preventDefault();
          if (!hasData || replace) void sync.connect(input.trim());
        }}>
          <label className="grid gap-1 text-xs font-bold">رمز الاسترداد من جهاز آخر
            <input className={`${fieldStyle} font-mono-num`} dir="ltr" value={input} autoComplete="off" autoCapitalize="none" spellCheck={false}
              onChange={(event) => setInput(event.target.value)} />
          </label>
          {hasData && input.trim() && <label className="flex items-start gap-2 text-xs leading-relaxed">
            <input className="mt-0.5" type="checkbox" checked={replace} onChange={(event) => setReplace(event.target.checked)} />
            أفهم أن الاستعادة ستستبدل الجدول والحضور وإعدادات الطوابق على هذا الجهاز.
          </label>}
          <button className={secondaryStyle} disabled={busy || !input.trim() || (hasData && !replace)}>ربط هذا الجهاز واستعادة النسخة</button>
        </form>
      </>}
      {busy && <p role="status" className="text-xs">جارٍ مزامنة النسخة…</p>}
      {sync.status === 'synced' && <p role="status" className="text-xs font-bold text-[#235047]">تمت المزامنة.</p>}
      {sync.status === 'offline' && <p role="status" className="text-xs">أنت دون اتصال. بقيت تعديلاتك على هذا الجهاز.</p>}
      {sync.error && sync.status !== 'offline' && <p role="alert" className="text-xs font-bold text-red-800">{sync.error}</p>}
    </ToolDialog>
  );
}
