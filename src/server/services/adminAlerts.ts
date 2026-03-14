// ==============================================
// Admin Alerts — Backend Error Notifications
// ==============================================
// Logs critical errors and stores them for the
// admin panel. Users never see these.

import cache from '../utils/cache';
import logger from '../utils/logger';

export interface AdminAlert {
  id: string;
  level: 'warning' | 'critical';
  category: string;
  message: string;
  detail: string;
  timestamp: string;
  acknowledged: boolean;
}

const ALERT_KEY = 'admin:alerts';
const MAX_ALERTS = 100;

/**
 * Send an alert to the admin panel
 */
export async function alertAdmin(
  level: 'warning' | 'critical',
  category: string,
  message: string,
  detail: string = '',
) {
  const alert: AdminAlert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    level,
    category,
    message,
    detail: detail.slice(0, 500),
    timestamp: new Date().toISOString(),
    acknowledged: false,
  };

  logger[level === 'critical' ? 'error' : 'warn'](`[AdminAlert] ${category}: ${message}`, { detail: detail.slice(0, 200) });

  try {
    const existing = await cache.get<AdminAlert[]>(ALERT_KEY) || [];
    const updated = [alert, ...existing].slice(0, MAX_ALERTS);
    await cache.set(ALERT_KEY, updated, 7 * 24 * 3600); // 7 day TTL
  } catch {}
}

/**
 * Get all admin alerts
 */
export async function getAdminAlerts(): Promise<AdminAlert[]> {
  return await cache.get<AdminAlert[]>(ALERT_KEY) || [];
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string) {
  const alerts = await getAdminAlerts();
  const updated = alerts.map(a => a.id === alertId ? { ...a, acknowledged: true } : a);
  await cache.set(ALERT_KEY, updated, 7 * 24 * 3600);
}

/**
 * Get unacknowledged alert count
 */
export async function getUnacknowledgedCount(): Promise<number> {
  const alerts = await getAdminAlerts();
  return alerts.filter(a => !a.acknowledged).length;
}

// ── Auto-detect and alert on common issues ────

/**
 * Call this when an external API returns an error.
 * It checks if the error is a config/subscription issue
 * and alerts admin if so.
 */
export function checkAndAlertApiError(apiName: string, statusCode: number, errorMessage: string) {
  if (statusCode === 429) {
    alertAdmin('warning', 'Rate Limit', `${apiName} rate limit hit`, errorMessage);
  } else if (statusCode === 403) {
    alertAdmin('critical', 'API Subscription', `${apiName} returned 403 — subscription may be missing or expired`, errorMessage);
  } else if (statusCode === 401) {
    alertAdmin('critical', 'Auth Error', `${apiName} returned 401 — API key may be invalid`, errorMessage);
  } else if (statusCode >= 500) {
    alertAdmin('warning', 'API Down', `${apiName} returned ${statusCode}`, errorMessage);
  }
}
