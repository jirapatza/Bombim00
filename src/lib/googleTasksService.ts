import { getAccessToken } from './firebase';

export interface GoogleTaskList {
  id: string;
  title: string;
  updated: string;
}

export interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  updated: string;
  webViewLink?: string;
}

/**
 * Fetch all task lists of the authenticated user
 */
export async function fetchTaskLists(): Promise<GoogleTaskList[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('กรุณาลงชื่อเข้าใช้ด้วยบัญชี Google เพื่อใช้งาน Google Tasks');
  }

  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Tasks API error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.items || [];
}

/**
 * Fetch tasks from a specific task list
 */
export async function fetchTasks(taskListId: string = '@default'): Promise<GoogleTask[]> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('กรุณาลงชื่อเข้าใช้ด้วยบัญชี Google');
  }

  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks?showCompleted=true&showHidden=true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch tasks (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  return data.items || [];
}

/**
 * Create a new task in Google Tasks
 */
export async function createGoogleTask(
  taskListId: string = '@default',
  task: { title: string; notes?: string; due?: string }
): Promise<GoogleTask> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('กรุณาลงชื่อเข้าใช้ด้วยบัญชี Google');
  }

  const payload: any = {
    title: task.title,
    notes: task.notes || '',
  };

  if (task.due) {
    // RFC 3339 timestamp
    payload.due = new Date(task.due).toISOString();
  }

  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to create task (${res.status}): ${errorText}`);
  }

  return res.json();
}

/**
 * Toggle task completion status
 */
export async function toggleGoogleTaskStatus(
  taskListId: string,
  taskId: string,
  isCompleted: boolean
): Promise<GoogleTask> {
  const token = await getAccessToken();
  if (!token) throw new Error('Unauthenticated');

  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        status: isCompleted ? 'completed' : 'needsAction',
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update task (${res.status}): ${err}`);
  }

  return res.json();
}

/**
 * Delete task from Google Tasks (Always requires user confirmation before calling)
 */
export async function deleteGoogleTask(taskListId: string, taskId: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) throw new Error('Unauthenticated');

  const res = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok && res.status !== 204) {
    const err = await res.text();
    throw new Error(`Failed to delete task (${res.status}): ${err}`);
  }

  return true;
}

/**
 * Quick templates for Lottery Alert Reminders in Google Tasks
 */
export const LOTTERY_TASK_TEMPLATES = [
  {
    title: '🔔 ตรวจผลสลากกินแบ่งรัฐบาลไทย งวดล่าสุด',
    notes: 'เปิดหน้า Dashboard Bombim00 เพื่อตรวจรางวัลที่ 1 และเลขท้าย 2 ตัว อัปเดตสดจากสำนักงานสลากกินแบ่งฯ (GLO)',
  },
  {
    title: '🎯 ตรวจผลหวยฮานอย VIP / พิเศษ',
    notes: 'เวลาออกรางวัลช่วง 17:30 - 19:30 น. ตรวจสอบเลข 3 ตัวบน และ 2 ตัวล่าง พร้อมแจ้งเตือนผ่าน ntfy/Discord',
  },
  {
    title: '🇱🇦 ตรวจผลหวยลาวพัฒนา (จันทร์, พุธ, ศุกร์)',
    notes: 'เวลาออกรางวัล 20:30 น. สรุปผลรางวัลเลข 4 ตัว, 3 ตัวบน และ 2 ตัวล่าง',
  },
  {
    title: '📌 ตรวจสอบเลขเด็ด & สลากที่บันทึกไว้ใน Bombim00',
    notes: 'ตรวจสอบชุดตัวเลขที่ติดตามใน Watchlist ว่าตรงกับผลสลากรางวัลใดบ้าง',
  },
];
