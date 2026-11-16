import { useCallback, useEffect, useRef, useState } from "react";
import { LotteryCatalogItem } from "../types/lottery";
import { ThaiTtsService } from "./thaiTts";
import {
  Announcement,
  announcementText,
  closingHeadline,
  closingQueue,
  planAnnouncements,
  unseenAnnouncements,
} from "./announcer";
import { countdown } from "../data/drawSchedule";

// Browser-side announcement loop.
//
// One timer drives everything: the countdown on screen, the spoken warnings and
// the dedupe memory. The planning rules live in ./announcer and are unit-tested;
// this file only decides when to look at them and what to do with the result.

const SEEN_KEY = "lottery_announced_keys";
const SEEN_LIMIT = 200;

function loadSeen(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function saveSeen(keys: string[]): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(keys.slice(-SEEN_LIMIT)));
  } catch {
    /* Storage can be blocked; dedupe then lasts for this page view only. */
  }
}

export interface AnnouncerState {
  now: number;
  nextCloseText: string | null;
  nextCloseName: string | null;
  queue: ReturnType<typeof closingQueue>;
  lastSpoken: string | null;
}

export interface AnnouncerOptions {
  items: LotteryCatalogItem[];
  enabled: boolean;
  rate: number;
  /** Lets the screen show what was said, and tests assert on it. */
  onAnnounce?: (announcement: Announcement) => void;
}

export function useAnnouncer({ items, enabled, rate, onAnnounce }: AnnouncerOptions): AnnouncerState {
  const [now, setNow] = useState(() => Date.now());
  const [lastSpoken, setLastSpoken] = useState<string | null>(null);
  const seen = useRef<string[]>([]);
  const speaking = useRef(false);
  const queue = useRef<Announcement[]>([]);
  const itemsRef = useRef(items);
  const enabledRef = useRef(enabled);
  const rateRef = useRef(rate);
  const onAnnounceRef = useRef(onAnnounce);

  itemsRef.current = items;
  enabledRef.current = enabled;
  rateRef.current = rate;
  onAnnounceRef.current = onAnnounce;

  useEffect(() => {
    seen.current = loadSeen();
  }, []);

  const drain = useCallback(() => {
    if (speaking.current) return;
    const next = queue.current.shift();
    if (!next) return;
    speaking.current = true;
    const text = announcementText(next, itemsRef.current, Date.now());
    setLastSpoken(text);
    onAnnounceRef.current?.(next);
    ThaiTtsService.speak(text, rateRef.current, () => {
      speaking.current = false;
      window.setTimeout(drain, 400);
    });
  }, []);

  useEffect(() => {
    const tick = () => {
      const at = Date.now();
      setNow(at);
      if (!enabledRef.current) return;
      const fresh = unseenAnnouncements(planAnnouncements(itemsRef.current, at), seen.current);
      if (!fresh.length) return;
      seen.current = [...seen.current, ...fresh.map((a) => a.key)].slice(-SEEN_LIMIT);
      saveSeen(seen.current);
      queue.current.push(...fresh);
      drain();
    };

    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [drain]);

  // Pausing the timer in a hidden tab would miss a close, so the plan is re-run
  // the moment the tab comes back, and the speech is stopped while away.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
      } else {
        ThaiTtsService.stop();
        speaking.current = false;
        queue.current = [];
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const headline = closingHeadline(items, now);

  return {
    now,
    nextCloseText: headline ? countdown(headline.slot.closeAt, now) : null,
    nextCloseName: headline ? headline.slot.name : null,
    queue: closingQueue(items, now, 5),
    lastSpoken,
  };
}
