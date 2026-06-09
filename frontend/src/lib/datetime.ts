/**
 * Shared datetime helpers — all display times use Asia/Taipei timezone.
 */

const TAIPEI_TZ = 'Asia/Taipei';

/**
 * Format an ISO string to absolute Taipei time: `2026/06/09 10:35:42`
 */
export function formatTaipeiDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('zh-TW', {
    timeZone: TAIPEI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format an ISO string to relative time: `剛剛 / N 分鐘前 / N 小時前 / N 天前`
 * Future times return `剛剛`.
 */
export function formatRelativeTime(iso: string, now?: Date): string {
  const target = new Date(iso);
  const ref = now ?? new Date();
  const diffMs = ref.getTime() - target.getTime();

  if (diffMs <= 0) return '剛剛';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return '剛剛';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分鐘前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;

  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}
