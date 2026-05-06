import { getTimezoneOffset } from 'date-fns-tz';

const MINUTES_IN_WEEK = 10080; // 7 dienas * 24h * 60m

// Iegūst laika zonas nobīdi minūtēs (piem., 'Europe/Riga' vasarā ir +180)
export function getOffsetMinutes(timezone: string): number {
  try {
    return getTimezoneOffset(timezone, new Date()) / 60000;
  } catch (e) {
    return 0; // Atgriežamies uz UTC, ja kļūda
  }
}

// Pārvērš UTC minūtes uz vietējām minūtēm
export function utcToLocal(utcMinute: number, timezone: string): number {
  const offset = getOffsetMinutes(timezone);
  let local = (utcMinute + offset) % MINUTES_IN_WEEK;
  if (local < 0) local += MINUTES_IN_WEEK;
  return local;
}

// Pārvērš vietējās minūtes uz UTC minūtēm (sūtīšanai uz datubāzi)
export function localToUtc(localMinute: number, timezone: string): number {
  const offset = getOffsetMinutes(timezone);
  let utc = (localMinute - offset) % MINUTES_IN_WEEK;
  if (utc < 0) utc += MINUTES_IN_WEEK;
  return Math.round(utc);
}

// Formatē stundu 12h vai 24h sistēmā
export function formatHour(hour: number, timeFormat: '12h' | '24h'): string {
  if (timeFormat === '24h') return `${hour}:00`;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12; // 0 pārvēršas par 12
  return `${h} ${ampm}`;
}