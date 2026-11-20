import { useLocale } from '../locale';
import { useEffect, useState } from 'react';
import { Smartphone, Download, Share } from 'lucide-react';
import { primaryStyle, ToolDialog } from './ToolDialog';

interface BrowserInstallEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const standalone = () => matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function useInstall() {
  const [prompt, setPrompt] = useState<BrowserInstallEvent | null>(null);
  const [installed, setInstalled] = useState(standalone);
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    const media = matchMedia('(display-mode: standalone)');
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BrowserInstallEvent);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    const onMode = () => setInstalled(standalone());
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    media.addEventListener('change', onMode);
    let mounted = true;
    navigator.serviceWorker?.ready.then(() => { if (mounted) setOfflineReady(true); });
    return () => {
      mounted = false;
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      media.removeEventListener('change', onMode);
    };
  }, []);
  return {
    installed, offlineReady, canPrompt: !!prompt,
    async install() {
      if (!prompt) return;
      setPrompt(null);
      try {
        if ((await prompt.prompt()).outcome === 'accepted') setInstalled(true);
      } catch { /* The browser instructions remain available. */ }
    },
  };
}

export function InstallDialog({ installation, onClose }: { installation: ReturnType<typeof useInstall>; onClose: () => void }) {
  const { t } = useLocale();
  return (
    <ToolDialog title={t("تثبيت جدولي")} icon={Smartphone} onClose={onClose}>
      {installation.installed ? <p className="text-sm font-bold">{t("جدولي مثبت على هذا الجهاز.")}</p> : <>
        {installation.canPrompt && <button type="button" className={primaryStyle} onClick={() => void installation.install()}><Download size={16} />{' ' + t("تثبيت التطبيق")}</button>}
        <div className="space-y-3 rounded-xl bg-white p-3 text-sm leading-relaxed">
          <p><strong>{t("Safari على iPhone")}</strong><br />{t("اضغط مشاركة") + ' '}<Share size={14} className="inline" aria-hidden="true" />{' ' + t("ثم اختر «إضافة إلى الشاشة الرئيسية».")}</p>
          <p><strong>Chrome</strong><br />{t("افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».")}</p>
        </div>
      </>}
      <p className="text-xs leading-relaxed text-[var(--muted)]">{installation.offlineReady
        ? t("جدولك المحفوظ متاح دون إنترنت في هذا المتصفح. افتح النسخة المثبّتة مرة وأنت متصل لتجهيزها.")
        : t("افتح جدولي مرة وأنت متصل حتى يصبح جدولك جاهزاً للعمل دون إنترنت.")}</p>
    </ToolDialog>
  );
}
