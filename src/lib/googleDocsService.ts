import { getAccessToken } from './firebase';

export interface GoogleDocSummary {
  documentId: string;
  title: string;
  revisionId?: string;
  webViewLink?: string;
  createdTime?: string;
}

/**
 * Creates a new Google Doc with an initial title
 */
export async function createGoogleDoc(title: string): Promise<GoogleDocSummary> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('กรุณาลงชื่อเข้าใช้ด้วยบัญชี Google เพื่อสร้าง Google Docs');
  }

  const res = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      title: title.trim(),
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Docs API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return {
    documentId: data.documentId,
    title: data.title,
    revisionId: data.revisionId,
    webViewLink: `https://docs.google.com/document/d/${data.documentId}/edit`,
    createdTime: new Date().toISOString(),
  };
}

/**
 * Appends text content to a Google Doc using batchUpdate
 */
export async function appendTextToDoc(documentId: string, text: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Unauthenticated');

  const safeDocId = encodeURIComponent(documentId.trim());
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${safeDocId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            endOfSegmentLocation: {},
            text: text,
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to update document (${res.status}): ${errorText}`);
  }
}

/**
 * Read document content
 */
export async function getGoogleDoc(documentId: string): Promise<any> {
  const token = await getAccessToken();
  if (!token) throw new Error('Unauthenticated');

  const safeDocId = encodeURIComponent(documentId.trim());
  const res = await fetch(`https://docs.googleapis.com/v1/documents/${safeDocId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to get document (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * List recent lottery Google Docs created by this user
 */
export async function listRecentDocs(): Promise<GoogleDocSummary[]> {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    const query = encodeURIComponent("mimeType = 'application/vnd.google-apps.document' and trashed = false");
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&pageSize=15&fields=files(id,name,webViewLink,createdTime,modifiedTime)`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) return [];
    const data = await res.json();
    return (data.files || []).map((f: any) => ({
      documentId: f.id,
      title: f.name,
      webViewLink: f.webViewLink || `https://docs.google.com/document/d/${f.id}/edit`,
      createdTime: f.createdTime,
    }));
  } catch {
    return [];
  }
}

/**
 * Formats a lottery draw report text ready for Google Docs
 */
export function buildLotteryDocContent(result: {
  lotteryName: string;
  drawDate: string;
  firstPrize: string;
  last2Digits: string;
  front3Digits?: string[];
  last3Digits?: string[];
  adjacentPrizes?: string[];
  secondPrizes?: string[];
  source?: string;
  nextClosing?: { name: string; closeTimeStr: string };
}): string {
  const thaiNow = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
  let content = `\n\n═══════════════════════════════════════════════════════════\n`;
  content += `     รายงานสรุปผลรางวัลอย่างเป็นทางการ: ${result.lotteryName}\n`;
  content += `               ประจำงวดวันที่: ${result.drawDate}\n`;
  content += `═══════════════════════════════════════════════════════════\n\n`;

  content += `【รางวัลใหญ่หลัก】\n`;
  content += `• รางวัลที่ 1 (เลข 6 หลัก): ${result.firstPrize || '-'}\n`;
  content += `• เลขท้าย 2 ตัว: ${result.last2Digits || '-'}\n`;

  if (result.front3Digits && result.front3Digits.length > 0) {
    content += `• เลขหน้า 3 ตัว: ${result.front3Digits.join(' , ')}\n`;
  }
  if (result.last3Digits && result.last3Digits.length > 0) {
    content += `• เลขท้าย 3 ตัว: ${result.last3Digits.join(' , ')}\n`;
  }

  if (result.adjacentPrizes && result.adjacentPrizes.length > 0) {
    content += `• รางวัลข้างเคียงรางวัลที่ 1: ${result.adjacentPrizes.join(' , ')}\n`;
  }

  if (result.secondPrizes && result.secondPrizes.length > 0) {
    content += `\n【รางวัลที่ 2 (ตัวอย่าง)】\n`;
    content += `• ${result.secondPrizes.slice(0, 5).join(' , ')}\n`;
  }

  if (result.nextClosing) {
    content += `\n【กำหนดการรอบถัดไป】\n`;
    content += `• หวยรอบถัดไปที่จะปิดรับ: ${result.nextClosing.name} (เวลา ${result.nextClosing.closeTimeStr})\n`;
  }

  content += `\n───────────────────────────────────────────────────────────\n`;
  content += `แหล่งข้อมูลอ้างอิง: ${result.source || 'สำนักงานสลากกินแบ่งรัฐบาล (GLO)'}\n`;
  content += `เอกสารนี้ถูกสร้างโดย: Lottery Alert System (Bombim00)\n`;
  content += `วัน-เวลาที่จัดทำเอกสาร: ${thaiNow}\n\n`;

  return content;
}
