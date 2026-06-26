import { BrowserWindow, Notification } from 'electron';
import {
  NotificationService,
  type NotificationPayload,
  type OsNotifier,
  type RendererBroadcaster,
} from './notificationService';

export {
  NotificationService,
  NOTIFY_CHANNEL,
  type NotificationPayload,
  type NotifyLevel,
  type OsNotifier,
  type RendererBroadcaster,
} from './notificationService';

const osNotifier: OsNotifier = {
  isSupported: () => Notification.isSupported(),
  show: (title, body) => {
    new Notification({ title, body }).show();
  },
};

const broadcaster: RendererBroadcaster = {
  send: (channel, payload: NotificationPayload) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, payload);
    }
  },
};

let instance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!instance) instance = new NotificationService(osNotifier, broadcaster);
  return instance;
}
