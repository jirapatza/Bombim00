import { getAccessToken, db, auth, OperationType, handleFirestoreError } from './firebase';
import { collection, doc, setDoc, getDocs, deleteDoc, query, orderBy } from 'firebase/firestore';

export interface KeepNoteItem {
  id: string;
  title: string;
  content: string;
  tag: string;
  color: 'amber' | 'emerald' | 'blue' | 'purple' | 'rose' | 'neutral';
  isPinned?: boolean;
  createdAt: string;
  updatedAt?: string;
  syncedToFirestore?: boolean;
  isChecklist?: boolean;
  items?: { text: string; done: boolean }[];
}

/**
 * Check Keep Enterprise API availability or fallback to Web Keep & Firestore
 */
export async function testKeepApiConnection(): Promise<{ isEnterprise: boolean; message: string }> {
  const token = await getAccessToken();
  if (!token) {
    return {
      isEnterprise: false,
      message: 'ไม่ได้ลงชื่อเข้าใช้ด้วย Google (ใช้การซิงค์ผ่าน Firestore & Google Keep Web)',
    };
  }

  try {
    const res = await fetch('https://keep.googleapis.com/v1/notes?pageSize=1', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      return { isEnterprise: true, message: 'เชื่อมต่อ Google Keep API (Enterprise) สำเร็จเรียบร้อย' };
    } else {
      return {
        isEnterprise: false,
        message: 'บัญชีทั่วไปใช้งานผ่าน Google Keep Web & Cloud Firestore Sync (ตามข้อกำหนดของ Google Keep API)',
      };
    }
  } catch {
    return {
      isEnterprise: false,
      message: 'ใช้งาน Google Keep ผ่าน Web Export และ Cloud Firestore Synchronization',
    };
  }
}

/**
 * Generate formatted note text for Google Keep
 */
export function formatLotteryResultForKeep(result: {
  lotteryName: string;
  drawDate: string;
  firstPrize: string;
  last2Digits: string;
  top3?: string;
  bottom2?: string;
  front3Digits?: string[];
  last3Digits?: string[];
}): { title: string; body: string } {
  const title = `🎟️ ผลรางวัล ${result.lotteryName} (${result.drawDate})`;
  const lines = [
    `📅 งวดวันที่: ${result.drawDate}`,
    `🏆 รางวัลที่ 1 / 3 ตัวบน: ${result.firstPrize || result.top3 || '-'}`,
    `🔢 เลขท้าย 2 ตัว: ${result.last2Digits || result.bottom2 || '-'}`,
  ];

  if (result.front3Digits && result.front3Digits.length > 0) {
    lines.push(`✨ เลขหน้า 3 ตัว: ${result.front3Digits.join(', ')}`);
  }
  if (result.last3Digits && result.last3Digits.length > 0) {
    lines.push(`🌟 เลขท้าย 3 ตัว: ${result.last3Digits.join(', ')}`);
  }

  lines.push('');
  lines.push('📌 บันทึกอัตโนมัติจาก Lottery Alert Dashboard (Bombim00)');
  lines.push(`⏱️ บันทึกเมื่อ: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`);

  return { title, body: lines.join('\n') };
}

/**
 * Open Google Keep web to create a note or paste directly
 */
export function openGoogleKeepWeb() {
  window.open('https://keep.google.com', '_blank');
}

/**
 * Copy formatted note to clipboard ready for pasting into Keep
 */
export async function copyToKeepClipboard(title: string, body: string): Promise<boolean> {
  const fullText = `${title}\n\n${body}`;
  try {
    await navigator.clipboard.writeText(fullText);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save Keep Note to Firestore
 */
export async function saveNoteToFirestore(note: KeepNoteItem): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const path = `users/${user.uid}/reminders/${note.id}`;
  try {
    await setDoc(doc(db, 'users', user.uid, 'reminders', note.id), {
      id: note.id,
      userId: user.uid,
      title: note.title,
      notes: note.content,
      dueDate: note.createdAt,
      googleTaskId: note.tag || 'keep-note',
      completed: false,
      createdAt: note.createdAt,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Fetch Notes from Firestore
 */
export async function fetchNotesFromFirestore(): Promise<KeepNoteItem[]> {
  const user = auth.currentUser;
  if (!user) return [];

  const path = `users/${user.uid}/reminders`;
  try {
    const q = query(collection(db, 'users', user.uid, 'reminders'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || '',
        content: data.notes || '',
        tag: data.googleTaskId || '#บันทึกหวย',
        color: 'amber',
        createdAt: data.createdAt || new Date().toISOString(),
        syncedToFirestore: true,
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

/**
 * Delete Note from Firestore (Always requires confirmation)
 */
export async function deleteNoteFromFirestore(noteId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const path = `users/${user.uid}/reminders/${noteId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, 'reminders', noteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
