'use client';

import { useState, useEffect, useRef } from 'react';
import UiIcon from './UiIcon';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  useEffect(() => {
    const load = async () => {
      fetchNotifications();
    };
    load();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: number) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'PUT' });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={isOpen}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-md text-[var(--ui-ink)] transition-colors hover:bg-[#f7e9dd]"
      >
        <UiIcon name="bell" className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#873e29] px-1.5 py-0.5 text-center text-xs font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[var(--ui-line)] bg-[var(--ui-surface)] shadow-[0_16px_36px_rgba(48,40,36,.18)]">
          <div className="flex items-center justify-between border-b border-[var(--ui-line)] bg-[#f8f0e9] p-3">
            <h3 className="text-sm font-bold text-[var(--ui-ink)]">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="min-h-9 rounded px-2 text-sm font-semibold text-[#87432e] hover:bg-[#f0dfd3]"
              >
                Mark all read
              </button>
            )}
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-5 text-center text-sm text-[var(--ui-muted)]">
                No notifications yet.
              </div>
            ) : (
              <div className="divide-y divide-[var(--ui-line)]">
                {notifications.map((notif) => (
                  <button
                    type="button"
                    key={notif.id} 
                    className={`flex w-full gap-3 p-3 text-left transition-colors hover:bg-[#f8f0e9] ${notif.isRead ? 'bg-[var(--ui-surface)]' : 'bg-[#fcf0e6]'}`}
                    onClick={() => !notif.isRead && markAsRead(notif.id)}
                    aria-label={notif.isRead ? `${notif.title}, read` : `Mark ${notif.title} as read`}
                  >
                    <span className="mt-0.5 shrink-0 text-[#87432e]"><UiIcon name={notif.type.includes('approved') ? 'check' : notif.type.includes('rejected') ? 'activity' : notif.type.includes('received') ? 'arrow' : 'bell'} className="h-4 w-4" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[var(--ui-ink)]">
                        {notif.title}
                      </p>
                      <p className="mt-1 break-words text-xs leading-relaxed text-[var(--ui-muted)]">
                        {notif.message}
                      </p>
                      <p className="mt-1 text-xs text-[#6c584d]">
                        {new Date(notif.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!notif.isRead && (
                      <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#a64f35]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
