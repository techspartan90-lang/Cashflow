import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  CheckCheck,
  AlertOctagon,
  AlertTriangle,
  Info,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { MonitoringApiClient } from '../../services/monitoring-api';
import type { InAppNotification } from '../../services/monitoring-service';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTab: (tab: string) => void;
  onNotificationsChanged?: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  onNavigateToTab,
  onNotificationsChanged,
}) => {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await MonitoringApiClient.getNotifications();
      if (res.success && res.data) {
        setNotifications(res.data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id: string, linkTab?: string) => {
    await MonitoringApiClient.markNotificationRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    if (onNotificationsChanged) onNotificationsChanged();
    if (linkTab) {
      onNavigateToTab(linkTab);
      onClose();
    }
  };

  const handleMarkAllRead = async () => {
    for (const n of notifications) {
      if (!n.isRead) {
        await MonitoringApiClient.markNotificationRead(n.id);
      }
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (onNotificationsChanged) onNotificationsChanged();
  };

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-end p-0 sm:p-4">
      <div className="bg-white h-full sm:h-auto sm:max-h-[85vh] sm:rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Financial Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark read
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Feed List */}
        <div className="p-4 overflow-y-auto space-y-2.5 flex-1 text-xs">
          {loading ? (
            <div className="text-center py-10 text-slate-500">Checking notification channels...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <ShieldCheck className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <div className="font-semibold text-slate-700">All clear</div>
              <p className="text-[11px] mt-1 text-slate-500">No active alerts or critical notifications.</p>
            </div>
          ) : (
            notifications.map((notif) => {
              let Icon = Info;
              let iconColor = 'text-sky-600';
              let bgColor = notif.isRead ? 'bg-slate-50/50' : 'bg-white border-indigo-200 ring-1 ring-indigo-50';

              if (notif.severity === 'critical') {
                Icon = AlertOctagon;
                iconColor = 'text-rose-600';
              } else if (notif.severity === 'warning') {
                Icon = AlertTriangle;
                iconColor = 'text-amber-600';
              }

              return (
                <div
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif.id, notif.linkTab)}
                  className={`p-3 rounded-xl border border-slate-200 transition-all cursor-pointer hover:border-indigo-300 hover:shadow-xs ${bgColor}`}
                >
                  <div className="flex items-start space-x-2.5">
                    <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${iconColor}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 leading-tight">{notif.title}</span>
                        {!notif.isRead && (
                          <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0 ml-1.5" />
                        )}
                      </div>
                      <p className="text-slate-600 mt-1 line-clamp-2 leading-relaxed text-[11px]">
                        {notif.description}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                        <span>
                          {new Date(notif.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="inline-flex items-center text-indigo-600 font-semibold">
                          View Details <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500">
          <span>In-app financial monitoring</span>
          <button
            onClick={() => {
              onNavigateToTab('alerts');
              onClose();
            }}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
          >
            Open Alert Center →
          </button>
        </div>
      </div>
    </div>
  );
};
