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

export class ThaiTtsService {
  private static synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private static isSpeaking = false;

  static speak(text: string, rate: number = 0.95): void {
    if (!this.synth) return;

    try {
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.lang = 'th-TH';

      // Attempt to pick a Thai voice if available
      const voices = this.synth.getVoices();
      const thaiVoice = voices.find((v) => v.lang.includes('th') || v.lang.includes('TH'));
      if (thaiVoice) {
        utterance.voice = thaiVoice;
      }

      this.isSpeaking = true;
      utterance.onend = () => {
        this.isSpeaking = false;
      };
      utterance.onerror = () => {
        this.isSpeaking = false;
      };

      this.synth.speak(utterance);
    } catch (e) {
      console.warn('TTS error:', e);
    }
  }

  static stop(): void {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
    }
  }
}
