export const matchesIos = (userAgent: string, maxTouchPoints = 0): boolean =>
  /iPad|iPhone|iPod/.test(userAgent) ||
  (userAgent.includes("Macintosh") && maxTouchPoints > 1);

export const isInstalled = (standaloneDisplayMode: boolean, iosStandalone = false): boolean =>
  standaloneDisplayMode || iosStandalone;

export const isIos = (): boolean =>
  matchesIos(window.navigator.userAgent, window.navigator.maxTouchPoints);

export const isStandalone = (): boolean =>
  isInstalled(
    window.matchMedia?.("(display-mode: standalone)").matches === true,
    (window.navigator as { standalone?: boolean }).standalone === true,
  );

export const iosNeedsInstall = (): boolean => isIos() && !isStandalone();
