import { LotteryCatalogItem } from '../types/lottery';

const digitNames: Record<string, string> = {
  '0': 'ศูนย์',
  '1': 'หนึ่ง',
  '2': 'สอง',
  '3': 'สาม',
  '4': 'สี่',
  '5': 'ห้า',
  '6': 'หก',
  '7': 'เจ็ด',
  '8': 'แปด',
  '9': 'เก้า',
};

export function spellOutDigits(numberStr: string): string {
  if (!numberStr) return '';
  return numberStr
    .replace(/\D/g, '')
    .split('')
    .map((d) => digitNames[d] || d)
    .join(' ');
}

export function buildAnnouncement(
  item: LotteryCatalogItem,
  politeParticle: string = 'ครับ'
): string {
  const name = item.name || 'หวย';
  const isGov =
    name.includes('สลากกินแบ่ง') ||
    name.includes('รัฐบาล') ||
    item.category === 'government';

  const top3 = item.top3?.trim() || '';
  const bottom2 = item.bottom2?.trim() || '';
  const firstPrize = item.firstPrize?.trim() || '';

  if (isGov && firstPrize) {
    const spelledFirst = spellOutDigits(firstPrize);
    const spelled2 = spellOutDigits(bottom2 || firstPrize.slice(-2));
    return `ประกาศผลสลากกินแบ่งรัฐบาล รางวัลที่หนึ่ง ${spelledFirst} เลขท้ายสองตัว ${spelled2} ${politeParticle}`;
  } else if (top3 && bottom2) {
    const spelledTop = spellOutDigits(top3);
    const spelledBottom = spellOutDigits(bottom2);
    return `ประกาศผล ${name} สามตัวบน ${spelledTop} สองตัวล่าง ${spelledBottom} ${politeParticle}`;
  } else if (top3 || bottom2) {
    const textParts = [];
    if (top3) textParts.push(`สามตัวบน ${spellOutDigits(top3)}`);
    if (bottom2) textParts.push(`สองตัวล่าง ${spellOutDigits(bottom2)}`);
    return `ประกาศผล ${name} ${textParts.join(' ')} ${politeParticle}`;
  } else {
    return `ผล ${name} งวดล่าสุด ยังรอผลการออกรางวัล ${politeParticle}`;
  }
}

/**
 * Thin wrapper around the Web Speech API.
 *
 * `onDone` matters: the announcement queue must wait for one sentence to finish
 * before speaking the next, otherwise every sentence cancels the one before it.
 */
export class ThaiTtsService {
  private static synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private static isSpeaking = false;
  private static thaiVoice: SpeechSynthesisVoice | null = null;

  /** True when this browser has no speech engine, so the UI can say so. */
  static get supported(): boolean {
    return Boolean(this.synth && typeof window !== 'undefined' && 'SpeechSynthesisUtterance' in window);
  }

  private static voice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    if (this.thaiVoice) return this.thaiVoice;
    const voices = this.synth.getVoices();
    // Browsers fill the voice list asynchronously; caching a miss would keep
    // the default voice for the whole session.
    const found =
      voices.find((v) => /^th(-|_)?/i.test(v.lang)) ??
      voices.find((v) => v.lang.toLowerCase().includes('thai')) ??
      null;
    if (found) this.thaiVoice = found;
    return found;
  }

  static speak(text: string, rate: number = 0.95, onDone?: () => void): void {
    if (!this.synth || !text) {
      onDone?.();
      return;
    }

    try {
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.lang = 'th-TH';
      utterance.volume = 1;
      const voice = this.voice();
      if (voice) utterance.voice = voice;

      this.isSpeaking = true;
      const finish = () => {
        this.isSpeaking = false;
        onDone?.();
      };
      utterance.onend = finish;
      utterance.onerror = finish;

      this.synth.speak(utterance);
    } catch (error) {
      this.isSpeaking = false;
      onDone?.();
    }
  }

  static stop(): void {
    if (!this.synth) return;
    this.synth.cancel();
    this.isSpeaking = false;
  }

  static get speaking(): boolean {
    return this.isSpeaking;
  }
}
