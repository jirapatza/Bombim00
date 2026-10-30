import { getAccessToken } from './firebase';

export interface GoogleFormSummary {
  formId: string;
  title: string;
  description?: string;
  responderUri?: string;
  revisionId?: string;
  createdTime?: string;
}

export interface GoogleFormResponse {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  answers?: Record<string, { questionId: string; textAnswers?: { answers: { value: string }[] } }>;
}

/**
 * Creates a new Google Form
 */
export async function createGoogleForm(title: string, description?: string): Promise<GoogleFormSummary> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('กรุณาลงชื่อเข้าใช้ด้วยบัญชี Google เพื่อสร้าง Google Forms');
  }

  const res = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      info: {
        title: title.trim(),
        documentTitle: title.trim(),
        description: description || 'สร้างโดยระบบ Lottery Alert Dashboard & Control Center',
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Forms API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return {
    formId: data.formId,
    title: data.info?.title || title,
    description: data.info?.description,
    responderUri: data.responderUri,
    revisionId: data.revisionId,
    createdTime: new Date().toISOString(),
  };
}

/**
 * Adds questions to a form using batchUpdate
 */
export async function addQuestionsToForm(formId: string, questions: Array<{
  title: string;
  type: 'TEXT' | 'RADIO';
  options?: string[];
  required?: boolean;
}>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Unauthenticated');

  const safeFormId = encodeURIComponent(formId.trim());

  const requests = questions.map((q, index) => {
    if (q.type === 'RADIO' && q.options) {
      return {
        createItem: {
          item: {
            title: q.title,
            questionItem: {
              question: {
                required: Boolean(q.required),
                choiceQuestion: {
                  type: 'RADIO',
                  options: q.options.map((opt) => ({ value: opt })),
                  shuffle: false,
                },
              },
            },
          },
          location: { index },
        },
      };
    }

    return {
      createItem: {
        item: {
          title: q.title,
          questionItem: {
            question: {
              required: Boolean(q.required),
              textQuestion: { paragraph: false },
            },
          },
        },
        location: { index },
      },
    };
  });

  const res = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to add questions to form (${res.status}): ${errorText}`);
  }
}

/**
 * Fetch form details
 */
export async function getGoogleForm(formId: string): Promise<any> {
  const token = await getAccessToken();
  if (!token) throw new Error('Unauthenticated');

  const safeFormId = encodeURIComponent(formId.trim());
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to get form (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * Fetch form responses
 */
export async function getFormResponses(formId: string): Promise<GoogleFormResponse[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Unauthenticated');

  const safeFormId = encodeURIComponent(formId.trim());
  const res = await fetch(`https://forms.googleapis.com/v1/forms/${safeFormId}/responses`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to get form responses (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.responses || [];
}

/**
 * Form presets for the Lottery App
 */
export const LOTTERY_FORM_TEMPLATES = [
  {
    key: 'poll',
    title: '📊 แบบสำรวจเลขเด็ดและแนวทางสลากงวดถัดไป',
    description: 'รวบรวมความเห็นและสถิติชุดตัวเลขที่ผู้ใช้ติดตาม เพื่อนำไปประมวลผลสรุปใน Dashboard',
    questions: [
      {
        title: 'ชุดตัวเลข 2 ตัว หรือ 3 ตัว ที่คุณมั่นใจในงวดนี้',
        type: 'TEXT' as const,
        required: true,
      },
      {
        title: 'หมวดหมู่หวยที่ท่านติดตามเป็นพิเศษ',
        type: 'RADIO' as const,
        options: ['สลากกินแบ่งรัฐบาลไทย', 'ฮานอย (ปกติ/VIP/พิเศษ)', 'ลาวพัฒนา', 'หวยหุ้น / ต่างประเทศ'],
        required: true,
      },
      {
        title: 'แหล่งที่มาของเลขเด็ด (เช่น ฝันเห็น, ทะเบียนรถ, สถิติย้อนหลัง)',
        type: 'TEXT' as const,
        required: false,
      },
    ],
  },
  {
    key: 'ticket_check',
    title: '🎫 แบบฟอร์มลงทะเบียนสลากเพื่อขอรับการตรวจผลอัตโนมัติ',
    description: 'บันทึกหมายเลขสลากกินแบ่งของผู้ใช้เพื่อส่งผลตรวจกลับทางไลน์หรือการแจ้งเตือน',
    questions: [
      {
        title: 'หมายเลขสลากกินแบ่ง 6 หลัก',
        type: 'TEXT' as const,
        required: true,
      },
      {
        title: 'งวดประจำวันที่ต้องการตรวจ',
        type: 'RADIO' as const,
        options: ['งวดวันที่ 1 ของเดือน', 'งวดวันที่ 16 ของเดือน', 'งวดพิเศษอื่นๆ'],
        required: true,
      },
      {
        title: 'จำนวนใบที่ซื้อ',
        type: 'RADIO' as const,
        options: ['1 ใบ (เดี่ยว)', '2 ใบ (ชุด)', '5 ใบขึ้นไป'],
        required: false,
      },
    ],
  },
  {
    key: 'feedback',
    title: '⭐ แบบประเมินความพึงพอใจการใช้งานระบบ Lottery Alert',
    description: 'ช่วยเราปรับปรุงความเร็วและการแจ้งเตือนผลสลากให้แม่นยำยิ่งขึ้น',
    questions: [
      {
        title: 'ความพึงพอใจต่อความเร็วในการออกผลและการแจ้งเตือน',
        type: 'RADIO' as const,
        options: ['เร็วมาก (ทันทีที่ออกผล)', 'ปานกลาง (ภายใน 5 นาที)', 'ช้า'],
        required: true,
      },
      {
        title: 'ฟีเจอร์ที่ท่านชื่นชอบที่สุดในระบบ',
        type: 'RADIO' as const,
        options: ['เสียงประกาศผลภาษาไทย', 'ตาราง 51 หวยสด', 'Google Workspace Hub (Tasks/Docs/Forms)', 'ตรวจสลากด้วย AI'],
        required: true,
      },
      {
        title: 'ข้อเสนอแนะเพิ่มเติมที่ต้องการให้พัฒนา',
        type: 'TEXT' as const,
        required: false,
      },
    ],
  },
];
