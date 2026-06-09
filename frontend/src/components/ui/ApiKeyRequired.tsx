'use client';

import { AuthNotice } from './AuthNotice';

interface ApiKeyRequiredProps {
  message?: string;
  /** 'missing' = 401 (no key or invalid), 'forbidden' = 403 (key lacks role) */
  variant?: 'missing' | 'forbidden';
  className?: string;
}

/**
 * @deprecated Use AuthNotice with mode="blocking" instead.
 * Kept for backward compatibility with existing pages.
 */
export function ApiKeyRequired({ variant = 'missing', message, className }: ApiKeyRequiredProps) {
  return (
    <AuthNotice
      variant={variant}
      mode="blocking"
      message={message}
      className={className}
    />
  );
}
