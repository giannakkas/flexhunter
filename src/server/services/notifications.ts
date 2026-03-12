// ==============================================
// Notification System
// ==============================================
// In-app notifications stored in DB-like structure
// (uses cache for speed, no extra Prisma model needed).

import cache from '../utils/cache';

export interface Notification {
  id: string;
  shopId: string;
  type: 'info' | 'success' | 'warning' | 'critical';
  title: string;
  message: string;
  action?: { label: string; url: string };
  read: boolean;
  createdAt: string;
}

/**
 * Create a notification for a shop
 */
export async function notify(
  shopId: string,
  type: Notification['type'],
  title: string,
  message: string,
  action?: { label: string; url: string },
) {
  const key = `notifications:${shopId}`;
  const existing = await cache.get<Notification[]>(key) || [];

  const notification: Notification = {
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    shopId,
    type,
    title,
    message,
    action,
    read: false,
    createdAt: new Date().toISOString(),
  };

  // Keep last 50 notifications
  const updated = [notification, ...existing].slice(0, 50);
  await cache.set(key, updated, 7 * 24 * 3600); // 7 day TTL

  return notification;
}

/**
 * Get all notifications for a shop
 */
export async function getNotifications(shopId: string): Promise<Notification[]> {
  return await cache.get<Notification[]>(`notifications:${shopId}`) || [];
}

/**
 * Mark notification as read
 */
export async function markRead(shopId: string, notificationId: string) {
  const key = `notifications:${shopId}`;
  const existing = await cache.get<Notification[]>(key) || [];
  const updated = existing.map(n => n.id === notificationId ? { ...n, read: true } : n);
  await cache.set(key, updated, 7 * 24 * 3600);
}

/**
 * Mark all as read
 */
export async function markAllRead(shopId: string) {
  const key = `notifications:${shopId}`;
  const existing = await cache.get<Notification[]>(key) || [];
  const updated = existing.map(n => ({ ...n, read: true }));
  await cache.set(key, updated, 7 * 24 * 3600);
}

/**
 * Get unread count
 */
export async function getUnreadCount(shopId: string): Promise<number> {
  const notifications = await getNotifications(shopId);
  return notifications.filter(n => !n.read).length;
}
