/**
 * Shared status / severity mapping helpers.
 * Keeps label + color definitions in one place so every page stays consistent.
 */

// ---------------------------------------------------------------------------
// Session status (SOC / Threat / Pentest sessions)
// ---------------------------------------------------------------------------

export type SessionStatus = 'completed' | 'in_progress' | 'failed';

interface StatusMeta {
  label: string;
  color: string;       // text color (Tailwind)
  dot: string;         // dot background (Tailwind)
}

export const SESSION_STATUS: Record<SessionStatus, StatusMeta> = {
  completed:   { label: '已完成',  color: 'text-green-500',  dot: 'bg-green-500' },
  in_progress: { label: '執行中',  color: 'text-yellow-500', dot: 'bg-yellow-500 animate-pulse' },
  failed:      { label: '失敗',    color: 'text-red-500',    dot: 'bg-red-500' },
};

// ---------------------------------------------------------------------------
// Alert status (告警中心)
// ---------------------------------------------------------------------------

export type AlertStatus =
  | 'open'
  | 'investigating'
  | 'resolved'
  | 'ignored'
  | 'false_positive'
  | 'failed_resolution';

interface AlertStatusMeta {
  label: string;
  color: string;
  dot: string;
}

export const ALERT_STATUS: Record<AlertStatus, AlertStatusMeta> = {
  open:              { label: '待處理',   color: 'text-red-500',    dot: 'bg-red-500' },
  investigating:     { label: '調查中',   color: 'text-yellow-500', dot: 'bg-yellow-500 animate-pulse' },
  resolved:          { label: '已解決',   color: 'text-green-500',  dot: 'bg-green-500' },
  ignored:           { label: '已忽略',   color: 'text-gray-500',   dot: 'bg-gray-500' },
  false_positive:    { label: '誤報',     color: 'text-blue-500',   dot: 'bg-blue-500' },
  failed_resolution: { label: '解除失敗', color: 'text-orange-500', dot: 'bg-orange-500' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return a display-friendly label for a session status. */
export function sessionStatusLabel(status: string): string {
  return SESSION_STATUS[status as SessionStatus]?.label ?? status;
}

/** Return a display-friendly label for an alert status. */
export function alertStatusLabel(status: string): string {
  return ALERT_STATUS[status as AlertStatus]?.label ?? status;
}
