import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScheduleBackup } from './backup';

type BackupApi = typeof import('./backup');

const LINK_KEY = 'jadwali_backup_link_v1';
type Link = { code: string; etag: string; hash: string };
type Conflict = NonNullable<Awaited<ReturnType<BackupApi['downloadBackup']>>>;
type Status = 'idle' | 'working' | 'synced' | 'offline' | 'conflict' | 'error';

function savedLink(): Link | null {
  try {
    const value = JSON.parse(localStorage.getItem(LINK_KEY) ?? 'null');
    return value && typeof value.code === 'string' && typeof value.etag === 'string' && typeof value.hash === 'string' ? value : null;
  } catch {
    return null;
  }
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'invalid_code') return 'تحقّق من رمز الاسترداد وألصقه كاملاً.';
    if (error.message === 'not_found') return 'لم نجد نسخة بهذا الرمز.';
    if (error.message === 'updated_remotely') return 'تغيّرت النسخة على جهاز آخر. زامن الآن ثم حاول حذفها مجدداً.';
    if (error.message === 'too_large') return 'هذه النسخة أكبر من حدّ المزامنة.';
  }
  return 'تعذّرت المزامنة حالياً. حاول مجدداً.';
}

export function useBackupSync(snapshot: ScheduleBackup, apply: (backup: ScheduleBackup) => void) {
  const [link, setLink] = useState(savedLink);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const lock = useRef(false);
  const [retry, setRetry] = useState(0);
  const latest = useRef(snapshot);

  useEffect(() => { latest.current = snapshot; }, [snapshot]);

  const saveLink = useCallback((newLink: Link | null) => {
    if (newLink) localStorage.setItem(LINK_KEY, JSON.stringify(newLink));
    else localStorage.removeItem(LINK_KEY);
    setLink(newLink);
  }, []);

  const run = useCallback(async (action: (api: BackupApi) => Promise<void>) => {
    if (lock.current) return;
    setError('');
    if (!navigator.onLine) {
      setStatus('offline');
      return;
    }
    lock.current = true;
    const initial = latest.current;
    setStatus('working');
    try {
      await action(await import('./backup'));
    } catch (error) {
      setError(describeError(error));
      setStatus(navigator.onLine ? 'error' : 'offline');
    } finally {
      lock.current = false;
      if (latest.current !== initial) setRetry((count) => count + 1);
    }
  }, []);

  const accept = useCallback((code: string, remote: Conflict, hash: string) => {
    saveLink({ code, etag: remote.etag, hash });
    latest.current = remote.snapshot;
    apply(remote.snapshot);
    setConflict(null);
    setStatus('synced');
  }, [apply, saveLink]);

  const synchronize = useCallback(() => {
    if (!link || conflict) return;
    void run(async ({ backupHash, downloadBackup, uploadBackup }) => {
      const before = latest.current;
      const currentHash = await backupHash(before);
      if (currentHash !== link.hash) {
        const etag = await uploadBackup(link.code, before, link.etag);
        if (etag) {
          saveLink({ ...link, etag, hash: currentHash });
          setStatus('synced');
          return;
        }
      }

      const remote = await downloadBackup(link.code, link.etag);
      if (!remote) {
        setStatus('synced');
        return;
      }
      const remoteHash = await backupHash(remote.snapshot);
      if (remoteHash === currentHash) {
        saveLink({ ...link, etag: remote.etag, hash: currentHash });
        setStatus('synced');
      } else if (currentHash === link.hash && latest.current === before) {
        accept(link.code, remote, remoteHash);
      } else {
        setConflict(remote);
        setStatus('conflict');
      }
    });
  }, [link, conflict, run, saveLink, accept]);

  useEffect(() => {
    if (!link) return;
    const timer = window.setTimeout(synchronize, 1800);
    return () => window.clearTimeout(timer);
  }, [snapshot, link, retry, synchronize]);

  useEffect(() => {
    if (!link) return;
    const check = () => { if (document.visibilityState === 'visible') synchronize(); };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('online', check);
    window.addEventListener('focus', check);
    const timer = window.setInterval(check, 300_000);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('online', check);
      window.removeEventListener('focus', check);
    };
  }, [link, synchronize]);

  return {
    code: link?.code, status, error, conflict, synchronize,
    create() {
      return run(async ({ backupHash, newRecoveryCode, uploadBackup }) => {
        const code = newRecoveryCode();
        const initial = latest.current;
        const hash = await backupHash(initial);
        const etag = await uploadBackup(code, initial);
        if (!etag) throw new Error('storage_error');
        saveLink({ code, etag, hash });
        setStatus('synced');
      });
    },
    connect(code: string) {
      return run(async ({ backupHash, downloadBackup }) => {
        const before = latest.current;
        const remote = await downloadBackup(code);
        if (!remote || latest.current !== before) throw new Error('storage_error');
        const hash = await backupHash(remote.snapshot);
        if (latest.current !== before) throw new Error('storage_error');
        accept(code, remote, hash);
      });
    },
    resolve(useRemote: boolean) {
      if (!link || !conflict) return;
      return run(async ({ backupHash, downloadBackup, uploadBackup }) => {
        if (useRemote) {
          const before = latest.current;
          const remote = await downloadBackup(link.code);
          if (!remote) throw new Error('storage_error');
          const hash = await backupHash(remote.snapshot);
          if (remote.etag !== conflict.etag || latest.current !== before) {
            setConflict(remote);
            setStatus('conflict');
            return;
          }
          accept(link.code, remote, hash);
          return;
        }
        const updated = latest.current;
        const hash = await backupHash(updated);
        const etag = await uploadBackup(link.code, updated, conflict.etag);
        if (!etag) {
          setConflict(await downloadBackup(link.code));
          setStatus('conflict');
          return;
        }
        saveLink({ ...link, etag, hash });
        setConflict(null);
        setStatus('synced');
      });
    },
    removeCloudCopy() {
      if (!link) return;
      return run(async ({ deleteBackup }) => {
        await deleteBackup(link.code, conflict?.etag ?? link.etag);
        saveLink(null);
        setConflict(null);
        setStatus('idle');
      });
    },
    disconnect() {
      if (lock.current) return;
      saveLink(null);
      setStatus('idle');
      setError('');
      setConflict(null);
    },
  };
}
