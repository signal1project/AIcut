/** Minimal ambient types for the Chrome MV3 APIs used by this extension. */

interface ChromeTab {
  id?:  number;
  url?: string;
}

interface ChromeTabChangeInfo {
  status?: string;
}

declare const chrome: {
  action: {
    onClicked: { addListener(cb: (tab: ChromeTab) => void): void };
    setBadgeText(details: { tabId?: number; text: string }): void;
    setBadgeBackgroundColor(details: { tabId?: number; color: string }): void;
  };
  tabs: {
    onUpdated: {
      addListener(
        cb: (tabId: number, changeInfo: ChromeTabChangeInfo, tab: ChromeTab) => void,
      ): void;
    };
  };
};
