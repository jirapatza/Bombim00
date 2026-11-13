/**
 * Recovery policy for lazy-loaded screens after a deploy retires a chunk.
 *
 * Kept free of React and the DOM so the loop-prevention rules can be unit
 * tested: a blocked storage area or an offline browser must never turn a failed
 * chunk into an endless reload loop.
 */
export type ChunkStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type ChunkRecoveryOptions = {
  /** Null when sessionStorage is unavailable or throws on access. */
  storage: ChunkStorage | null;
  isOnline: () => boolean;
  reload: () => void;
};

export const CHUNK_RELOAD_KEY = "lottery_chunk_reloaded";

export class ChunkRecovery {
  private reloaded = false;
  private readonly storage: ChunkStorage | null;
  private readonly isOnline: () => boolean;
  private readonly reload: () => void;

  constructor(options: ChunkRecoveryOptions) {
    this.storage = options.storage;
    this.isOnline = options.isOnline;
    this.reload = options.reload;
  }

  /**
   * One automatic reload per page load, and never while the browser is offline:
   * a reload would replace the in-app recovery panel with a network error page.
   */
  shouldReload(): boolean {
    if (this.reloaded) return false;
    if (this.isOnline() === false) return false;
    if (!this.storage) return true;
    try {
      return this.storage.getItem(CHUNK_RELOAD_KEY) !== "1";
    } catch {
      // Unreadable storage must not block the first reload, and the in-memory
      // flag above is what prevents a loop when writes keep failing.
      return true;
    }
  }

  /** Arms the guard, then reloads. Returns false when it declines to reload. */
  reloadAfterChunkError(): boolean {
    if (!this.shouldReload()) return false;
    this.reloaded = true;
    if (this.storage) {
      try {
        this.storage.setItem(CHUNK_RELOAD_KEY, "1");
      } catch {
        // Private modes can reject writes; the in-memory flag still guards.
      }
    }
    this.reload();
    return true;
  }

  /** A chunk loaded fine, so the cached index and chunks are fresh again. */
  markChunkReady(): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(CHUNK_RELOAD_KEY);
    } catch {
      // Nothing to recover from when storage is blocked.
    }
  }
}
