import { app, Tray, Menu, BrowserWindow } from 'electron';
import { getAssetPath } from '../util/index.js';

export class SystemTray {
  private tray: Tray | null = null;

  constructor(private mainWindow: BrowserWindow) {}

  create(): Tray {
    if (this.tray) return this.tray;

    const icoPath = getAssetPath('favicon.ico');
    this.tray = new Tray(icoPath);
    this.setupTrayMenu();
    this.setupTrayEvents();

    return this.tray;
  }

  private setupTrayMenu() {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show', click: () => this.mainWindow.show() },
      { label: 'Minimize', click: () => this.mainWindow.hide() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]);

    this.tray.setToolTip('Social Manager AI');
    this.tray.setContextMenu(contextMenu);
  }

  private setupTrayEvents() {
    if (!this.tray) return;

    this.tray.on('click', () => {
      const win = this.mainWindow;
      if (win) {
        win.show();
        win.focus();
      }
    });
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}
