import dayjs from 'dayjs';

/** Free tier daily generation limit */
export const FREE_DAILY_LIMIT = 1;

/**
 * Get current day as YYYY-MM-DD
 */
export function getToday(date: Date = new Date()): string {
  return dayjs(date).format('YYYY-MM-DD');
}
