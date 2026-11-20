import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react';
import type { DayOfWeek, SessionType } from './types';
import { displayDay, displayLocation, displayType, english, type Locale } from './localeText';

const LocaleContext = createContext<Locale>('ar');

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => localStorage.getItem('jadwali-language') === 'en' ? 'en' : 'ar');
  useLayoutEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.title = locale === 'ar' ? 'جدولي — منظّم جدولك الجامعي' : 'Jadwali — University timetable';
    localStorage.setItem('jadwali-language', locale);
  }, [locale]);
  return <LocaleContext.Provider value={locale}>
    <LocaleSetter.Provider value={setLocale}>{children}</LocaleSetter.Provider>
  </LocaleContext.Provider>;
}

const LocaleSetter = createContext<(locale: Locale) => void>(() => {});

export function useLocale() {
  const locale = useContext(LocaleContext);
  const setLocale = useContext(LocaleSetter);
  return {
    locale,
    setLocale,
    t: (ar: string, en?: string) => locale === 'ar' ? ar : en ?? english[ar] ?? ar,
    dayName: (day: DayOfWeek, short = false) => displayDay(day, locale, short),
    locationName: (value: string) => displayLocation(value, locale),
    typeName: (type: SessionType) => displayType(type, locale),
  };
}
