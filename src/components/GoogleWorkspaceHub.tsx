import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Bookmark,
  Calendar,
  ExternalLink,
  Copy,
  Plus,
  Trash2,
  RefreshCw,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ListTodo,
  FileText,
  Share2,
  LogOut,
  User as UserIcon,
  HelpCircle,
  Layers,
  ChevronRight,
  Send,
  FileSpreadsheet,
  FileQuestion,
  Eye,
  Check,
} from 'lucide-react';
import {
  initAuth,
  googleSignIn,
  logout,
  getAccessToken,
  auth,
} from '../lib/firebase';
import {
  fetchTaskLists,
  fetchTasks,
  createGoogleTask,
  toggleGoogleTaskStatus,
  deleteGoogleTask,
  GoogleTaskList,
  GoogleTask,
  LOTTERY_TASK_TEMPLATES,
} from '../lib/googleTasksService';
import {
  testKeepApiConnection,
  formatLotteryResultForKeep,
  openGoogleKeepWeb,
  copyToKeepClipboard,
  saveNoteToFirestore,
  fetchNotesFromFirestore,
  deleteNoteFromFirestore,
  KeepNoteItem,
} from '../lib/googleKeepService';
import {
  createGoogleDoc,
  appendTextToDoc,
  listRecentDocs,
  buildLotteryDocContent,
  GoogleDocSummary,
} from '../lib/googleDocsService';
import {
  createGoogleForm,
  addQuestionsToForm,
  getFormResponses,
  LOTTERY_FORM_TEMPLATES,
  GoogleFormSummary,
  GoogleFormResponse,
} from '../lib/googleFormsService';

interface GoogleWorkspaceHubProps {
  latestResult?: any;
}

export const GoogleWorkspaceHub: React.FC<GoogleWorkspaceHubProps> = ({ latestResult }) => {
  const [user, setUser] = useState<any>(auth.currentUser);
  const [token, setToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'keep' | 'docs' | 'forms'>('tasks');

  // Tasks state
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string>('@default');
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [taskMessage, setTaskMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<GoogleTask | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);

  // Keep state
  const [keepNotes, setKeepNotes] = useState<KeepNoteItem[]>([]);
  const [isLoadingKeep, setIsLoadingKeep] = useState(false);
  const [keepApiStatus, setKeepApiStatus] = useState<string>('');
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTag, setNewNoteTag] = useState('#สลากกินแบ่ง');
  const [newNoteColor, setNewNoteColor] = useState<'amber' | 'emerald' | 'blue' | 'purple' | 'rose'>('amber');
  const [keepMessage, setKeepMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<KeepNoteItem | null>(null);

  // Docs state
  const [recentDocs, setRecentDocs] = useState<GoogleDocSummary[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [docsMessage, setDocsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Forms state
  const [createdForms, setCreatedForms] = useState<GoogleFormSummary[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('lottery_created_forms') || '[]');
    } catch {
      return [];
    }
  });
  const [isCreatingForm, setIsCreatingForm] = useState(false);
  const [formsMessage, setFormsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedFormForResponses, setSelectedFormForResponses] = useState<GoogleFormSummary | null>(null);
  const [formResponses, setFormResponses] = useState<GoogleFormResponse[]>([]);
  const [isLoadingResponses, setIsLoadingResponses] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (currentUser, accessToken) => {
        setUser(currentUser);
        setToken(accessToken);
        if (currentUser) {
          loadTaskLists();
          loadKeepNotes();
          loadRecentDocs();
        }
      },
      () => {
        setUser(null);
        setToken(null);
        setTasks([]);
        setTaskLists([]);
        setRecentDocs([]);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setTaskMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        setTaskMessage({ type: 'success', text: `ลงชื่อเข้าใช้ด้วย Google สำเร็จ (${result.user.email})` });
        loadTaskLists();
        loadKeepNotes();
        loadRecentDocs();
      }
    } catch (err: any) {
      setTaskMessage({ type: 'error', text: `เข้าสู่ระบบไม่สำเร็จ: ${err.message}` });
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setToken(null);
    setTasks([]);
    setTaskLists([]);
    setRecentDocs([]);
    setTaskMessage({ type: 'success', text: 'ออกจากระบบ Google เรียบร้อยแล้ว' });
  };

  // Google Tasks methods
  const loadTaskLists = async () => {
    setIsLoadingTasks(true);
    try {
      const lists = await fetchTaskLists();
      setTaskLists(lists);
      if (lists.length > 0 && selectedListId === '@default') {
        setSelectedListId(lists[0].id);
        loadTasksForList(lists[0].id);
      } else {
        loadTasksForList(selectedListId);
      }
    } catch (err: any) {
      console.warn('Tasks load note:', err.message);
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const loadTasksForList = async (listId: string) => {
    setIsLoadingTasks(true);
    try {
      const items = await fetchTasks(listId);
      setTasks(items);
    } catch (err: any) {
      setTaskMessage({ type: 'error', text: `ไม่สามารถโหลดงานได้: ${err.message}` });
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const handleCreateTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim()) return;

    setIsCreatingTask(true);
    setTaskMessage(null);
    try {
      await createGoogleTask(selectedListId, {
        title: newTaskTitle.trim(),
        notes: newTaskNotes.trim(),
        due: newTaskDue || undefined,
      });
      setTaskMessage({ type: 'success', text: 'เพิ่มการแจ้งเตือนใน Google Tasks สำเร็จ! ✅' });
      setNewTaskTitle('');
      setNewTaskNotes('');
      setNewTaskDue('');
      loadTasksForList(selectedListId);
    } catch (err: any) {
      setTaskMessage({ type: 'error', text: `สร้างงานไม่สำเร็จ: ${err.message}` });
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleQuickAddTemplate = async (template: { title: string; notes: string }) => {
    setIsCreatingTask(true);
    setTaskMessage(null);
    try {
      await createGoogleTask(selectedListId, {
        title: template.title,
        notes: template.notes,
      });
      setTaskMessage({ type: 'success', text: `เพิ่มงาน "${template.title}" ไปยัง Google Tasks สำเร็จ!` });
      loadTasksForList(selectedListId);
    } catch (err: any) {
      setTaskMessage({ type: 'error', text: `เพิ่มงานไม่สำเร็จ: ${err.message}` });
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleToggleTask = async (task: GoogleTask) => {
    const newStatus = task.status !== 'completed';
    try {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus ? 'completed' : 'needsAction' } : t))
      );
      await toggleGoogleTaskStatus(selectedListId, task.id, newStatus);
    } catch (err: any) {
      loadTasksForList(selectedListId);
      setTaskMessage({ type: 'error', text: `อัปเดตสถานะงานไม่สำเร็จ: ${err.message}` });
    }
  };

  const confirmDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsDeletingTask(true);
    try {
      await deleteGoogleTask(selectedListId, taskToDelete.id);
      setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
      setTaskMessage({ type: 'success', text: `ลบงาน "${taskToDelete.title}" เรียบร้อยแล้ว` });
      setTaskToDelete(null);
    } catch (err: any) {
      setTaskMessage({ type: 'error', text: `ลบงานไม่สำเร็จ: ${err.message}` });
    } finally {
      setIsDeletingTask(false);
    }
  };

  // Keep methods
  const loadKeepNotes = async () => {
    setIsLoadingKeep(true);
    try {
      const conn = await testKeepApiConnection();
      setKeepApiStatus(conn.message);
      const items = await fetchNotesFromFirestore();
      setKeepNotes(items);
    } catch (err: any) {
      console.warn('Keep notes load note:', err.message);
    } finally {
      setIsLoadingKeep(false);
    }
  };

  const handleCreateKeepNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newNoteTitle.trim()) return;

    const noteItem: KeepNoteItem = {
      id: `note-${Date.now()}`,
      title: newNoteTitle.trim(),
      content: newNoteContent.trim(),
      tag: newNoteTag.trim(),
      color: newNoteColor,
      createdAt: new Date().toISOString(),
    };

    try {
      await saveNoteToFirestore(noteItem);
      setKeepNotes((prev) => [noteItem, ...prev]);
      setNewNoteTitle('');
      setNewNoteContent('');
      setKeepMessage({ type: 'success', text: 'บันทึกโน้ตสำเร็จและซิงค์ลง Cloud Firestore เรียบร้อย! 📝' });
    } catch (err: any) {
      setKeepMessage({ type: 'error', text: `บันทึกไม่สำเร็จ: ${err.message}` });
    }
  };

  const handleCreateFromDrawResult = async () => {
    if (!latestResult) return;
    const formatted = formatLotteryResultForKeep({
      lotteryName: latestResult.ชื่อหวย || latestResult.หวย || 'สลากกินแบ่งรัฐบาล',
      drawDate: latestResult.งวดวันที่ || latestResult.วันที่จัดรูปแบบ || 'งวดล่าสุด',
      firstPrize: latestResult.รางวัลที่_1 || latestResult.เลขบน_3_ตัว || '',
      last2Digits: latestResult.เลขท้าย_2_ตัว || latestResult.เลขล่าง_2_ตัว || '',
      front3Digits: latestResult.เลขหน้า_3_ตัว,
      last3Digits: latestResult.เลขท้าย_3_ตัว,
    });

    const noteItem: KeepNoteItem = {
      id: `note-${Date.now()}`,
      title: formatted.title,
      content: formatted.body,
      tag: '#ผลสลากกินแบ่ง',
      color: 'amber',
      createdAt: new Date().toISOString(),
    };

    try {
      await saveNoteToFirestore(noteItem);
      setKeepNotes((prev) => [noteItem, ...prev]);
      setKeepMessage({ type: 'success', text: 'สร้างการ์ดผลรางวัลสำหรับ Google Keep สำเร็จแล้ว! 🎟️' });
    } catch (err: any) {
      setKeepMessage({ type: 'error', text: `ไม่สามารถบันทึกได้: ${err.message}` });
    }
  };

  const handleExportToKeep = async (note: KeepNoteItem) => {
    const copied = await copyToKeepClipboard(note.title, note.content);
    if (copied) {
      setKeepMessage({
        type: 'success',
        text: 'คัดลอกเนื้อหาโน้ตเรียบร้อย! กำลังเปิด Google Keep เพื่อให้คุณวางโน้ตได้ทันที...',
      });
      openGoogleKeepWeb();
    }
  };

  const confirmDeleteNote = async () => {
    if (!noteToDelete) return;
    try {
      await deleteNoteFromFirestore(noteToDelete.id);
      setKeepNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      setKeepMessage({ type: 'success', text: 'ลบโน้ตเรียบร้อยแล้ว' });
      setNoteToDelete(null);
    } catch (err: any) {
      setKeepMessage({ type: 'error', text: `ลบไม่สำเร็จ: ${err.message}` });
    }
  };

  // Google Docs methods
  const loadRecentDocs = async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await listRecentDocs();
      setRecentDocs(docs);
    } catch (err: any) {
      console.warn('Recent docs load note:', err.message);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const handleCreateOfficialLotteryDoc = async () => {
    setIsCreatingDoc(true);
    setDocsMessage(null);
    try {
      const lotteryTitle = latestResult?.ชื่อหวย || latestResult?.หวย || 'สลากกินแบ่งรัฐบาลไทย';
      const drawDate = latestResult?.งวดวันที่ || 'งวดล่าสุด';
      const docTitle = `รายงานผลรางวัล ${lotteryTitle} ประจำงวด ${drawDate}`;

      const newDoc = await createGoogleDoc(docTitle);

      const content = buildLotteryDocContent({
        lotteryName: lotteryTitle,
        drawDate,
        firstPrize: latestResult?.รางวัลที่_1 || '289594',
        last2Digits: latestResult?.เลขท้าย_2_ตัว || '84',
        front3Digits: latestResult?.เลขหน้า_3_ตัว || ['012', '425'],
        last3Digits: latestResult?.เลขท้าย_3_ตัว || ['318', '972'],
        adjacentPrizes: latestResult?.รางวัลข้างเคียงรางวัลที่_1 || ['289593', '289595'],
        source: latestResult?.แหล่งข้อมูล || 'สำนักงานสลากกินแบ่งรัฐบาล (GLO)',
      });

      await appendTextToDoc(newDoc.documentId, content);

      setRecentDocs((prev) => [newDoc, ...prev]);
      setDocsMessage({
        type: 'success',
        text: `สร้าง Google Doc "${docTitle}" พร้อมเขียนเนื้อหารายงานเรียบร้อยแล้ว! 🎉`,
      });
    } catch (err: any) {
      setDocsMessage({ type: 'error', text: `สร้างเอกสารไม่สำเร็จ: ${err.message}` });
    } finally {
      setIsCreatingDoc(false);
    }
  };

  const handleCreateCustomDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) return;

    setIsCreatingDoc(true);
    setDocsMessage(null);
    try {
      const doc = await createGoogleDoc(newDocTitle.trim());
      setRecentDocs((prev) => [doc, ...prev]);
      setNewDocTitle('');
      setDocsMessage({
        type: 'success',
        text: `สร้าง Google Doc "${doc.title}" สำเร็จเรียบร้อย!`,
      });
    } catch (err: any) {
      setDocsMessage({ type: 'error', text: `สร้างเอกสารไม่สำเร็จ: ${err.message}` });
    } finally {
      setIsCreatingDoc(false);
    }
  };

  // Google Forms methods
  const handleCreateTemplateForm = async (template: (typeof LOTTERY_FORM_TEMPLATES)[0]) => {
    setIsCreatingForm(true);
    setFormsMessage(null);
    try {
      const form = await createGoogleForm(template.title, template.description);
      await addQuestionsToForm(form.formId, template.questions);

      const updated = [form, ...createdForms];
      setCreatedForms(updated);
      localStorage.setItem('lottery_created_forms', JSON.stringify(updated));

      setFormsMessage({
        type: 'success',
        text: `สร้าง Google Form "${template.title}" พร้อมคำถามครบถ้วนสำเร็จแล้ว! 🎉`,
      });
    } catch (err: any) {
      setFormsMessage({ type: 'error', text: `สร้างฟอร์มไม่สำเร็จ: ${err.message}` });
    } finally {
      setIsCreatingForm(false);
    }
  };

  const handleInspectResponses = async (form: GoogleFormSummary) => {
    setSelectedFormForResponses(form);
    setIsLoadingResponses(true);
    setFormsMessage(null);
    try {
      const responses = await getFormResponses(form.formId);
      setFormResponses(responses);
    } catch (err: any) {
      setFormsMessage({ type: 'error', text: `ไม่สามารถดึงคำตอบได้: ${err.message}` });
    } finally {
      setIsLoadingResponses(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mb-6">
      {/* Header bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border-b border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Bookmark className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Google Workspace Hub</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                Tasks • Keep • Docs • Forms
              </span>
            </div>
            <p className="text-xs text-slate-400">
              จัดการเตือนความจำ, สมุดโน้ตผลรางวัล, เอกสารรายงานสรุป และแบบสำรวจความคิดเห็นบน Google Workspace
            </p>
          </div>
        </div>

        {/* Auth status & Official Google Sign-In */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs overflow-hidden border border-indigo-400/50">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'Google User'} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-4 h-4 text-white" />
                )}
              </div>
              <div className="text-left text-xs">
                <p className="font-semibold text-white leading-tight">{user.displayName || 'Google Account'}</p>
                <p className="text-slate-400 text-[11px] truncate max-w-[140px]">{user.email}</p>
              </div>
              <button
                onClick={handleSignOut}
                title="ออกจากระบบ"
                className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="gsi-material-button shadow-md hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <div className="gsi-material-button-state"></div>
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isSigningIn ? 'กำลังเชื่อมต่อ...' : 'Sign in with Google'}
                </span>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Tabs navigation: Tasks, Keep, Docs, Forms */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 px-5 pt-3 gap-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
            activeTab === 'tasks'
              ? 'bg-slate-800/80 text-amber-400 border-amber-500'
              : 'text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          Google Tasks (แจ้งเตือน)
          {tasks.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded-full">
              {tasks.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('keep')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
            activeTab === 'keep'
              ? 'bg-slate-800/80 text-amber-400 border-amber-500'
              : 'text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          Google Keep (บันทึกโน้ต)
          {keepNotes.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 rounded-full">
              {keepNotes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
            activeTab === 'docs'
              ? 'bg-slate-800/80 text-blue-400 border-blue-500'
              : 'text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <FileText className="w-4 h-4" />
          Google Docs (รายงานผลสลาก)
          {recentDocs.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 bg-blue-500/20 text-blue-300 rounded-full">
              {recentDocs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('forms')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
            activeTab === 'forms'
              ? 'bg-slate-800/80 text-purple-400 border-purple-500'
              : 'text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <FileQuestion className="w-4 h-4" />
          Google Forms (แบบสำรวจ & ตรวจสลาก)
          {createdForms.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 bg-purple-500/20 text-purple-300 rounded-full">
              {createdForms.length}
            </span>
          )}
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="p-5">
        {!user ? (
          <div className="text-center py-10 px-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
            <ListTodo className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white mb-1">เชื่อมต่อบัญชี Google ของคุณ</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
              เมื่อลงชื่อเข้าใช้ด้วย Google คุณจะสามารถสร้างงานเตือนความจำใน Tasks, บันทึกโน้ตผลรางวัลใน Keep,
              สร้างเอกสารรายงานทางการใน Docs และสร้างแบบสำรวจใน Forms ได้ทันที
            </p>
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="gsi-material-button shadow-lg hover:scale-105 transition"
            >
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="gsi-material-button-contents">Sign in with Google เพื่อเริ่มใช้งาน</span>
              </div>
            </button>
          </div>
        ) : (
          <div>
            {/* TAB 1: GOOGLE TASKS */}
            {activeTab === 'tasks' && (
              <div className="space-y-6">
                {taskMessage && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
                      taskMessage.type === 'success'
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {taskMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span>{taskMessage.text}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">สมุดงาน:</span>
                    <select
                      value={selectedListId}
                      onChange={(e) => {
                        setSelectedListId(e.target.value);
                        loadTasksForList(e.target.value);
                      }}
                      className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-1.5 focus:outline-none focus:border-amber-500 font-medium"
                    >
                      {taskLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadTasksForList(selectedListId)}
                      disabled={isLoadingTasks}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-xs text-slate-200 rounded-lg transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTasks ? 'animate-spin' : ''}`} />
                      <span>รีเฟรช</span>
                    </button>
                    <a
                      href="https://tasks.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-xs text-indigo-300 border border-indigo-500/30 rounded-lg transition"
                    >
                      <span>เปิด Google Tasks Web</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    เทมเพลตเตือนรอบออกรางวัลสำเร็จรูป:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {LOTTERY_TASK_TEMPLATES.map((tmpl, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleQuickAddTemplate(tmpl)}
                        disabled={isCreatingTask}
                        className="text-left p-3 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/40 transition group cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-white group-hover:text-amber-300 transition">
                            {tmpl.title}
                          </p>
                          <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-400" />
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">{tmpl.notes}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleCreateTask} className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                  <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-amber-400" />
                    สร้างงานเตือนความจำใหม่ใน Google Tasks
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        placeholder="ชื่องาน เช่น ซื้อสลากชุดเลขท้าย 84 งวด 1 พ.ย."
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="date"
                        value={newTaskDue}
                        onChange={(e) => setNewTaskDue(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <input
                        type="text"
                        placeholder="รายละเอียดเพิ่มเติม"
                        value={newTaskNotes}
                        onChange={(e) => setNewTaskNotes(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="submit"
                      disabled={isCreatingTask || !newTaskTitle.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isCreatingTask ? 'กำลังสร้าง...' : 'เพิ่มงานลง Google Tasks'}</span>
                    </button>
                  </div>
                </form>

                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                    <ListTodo className="w-4 h-4 text-indigo-400" />
                    รายการงานใน Google Tasks ({tasks.length} รายการ)
                  </h4>
                  {isLoadingTasks ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                      กำลังโหลดข้อมูลงาน...
                    </div>
                  ) : tasks.length === 0 ? (
                    <div className="py-8 text-center bg-slate-800/30 rounded-xl border border-slate-800 text-xs text-slate-400">
                      ยังไม่มีรายการงานในสมุดงานนี้
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tasks.map((task) => {
                        const isCompleted = task.status === 'completed';
                        return (
                          <div
                            key={task.id}
                            className={`p-3 rounded-xl border transition flex items-start justify-between gap-3 ${
                              isCompleted
                                ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                                : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isCompleted}
                                onChange={() => handleToggleTask(task)}
                                className="mt-1 w-4 h-4 rounded border-slate-600 text-amber-500 focus:ring-amber-400 cursor-pointer"
                              />
                              <div>
                                <p
                                  className={`text-xs font-semibold text-white ${
                                    isCompleted ? 'line-through text-slate-400' : ''
                                  }`}
                                >
                                  {task.title}
                                </p>
                                {task.notes && (
                                  <p className="text-[11px] text-slate-400 mt-0.5 whitespace-pre-wrap">{task.notes}</p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => setTaskToDelete(task)}
                              title="ลบงานนี้จาก Google Tasks"
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: GOOGLE KEEP */}
            {activeTab === 'keep' && (
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-indigo-200">
                    <p className="font-bold text-white mb-1">Google Keep &amp; Cloud Firestore Synchronization</p>
                    <p className="text-slate-300 leading-relaxed">
                      สร้างและส่งออกการ์ดสรุปผลรางวัลสลากไปยัง <strong>Google Keep</strong>{' '}
                      ได้ในคลิกเดียว พร้อมสำรองข้อมูลลงใน <strong>Cloud Firestore</strong> ถาวร
                    </p>
                  </div>
                </div>

                {keepMessage && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
                      keepMessage.type === 'success'
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {keepMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span>{keepMessage.text}</span>
                  </div>
                )}

                {latestResult && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-slate-800 to-indigo-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        ส่งออกผลรางวัลล่าสุดไปยัง Google Keep
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        งวดวันที่ {latestResult.งวดวันที่ || 'ล่าสุด'} • รางวัลที่ 1:{' '}
                        <span className="font-mono text-amber-300 font-bold">{latestResult.รางวัลที่_1 || '-'}</span> •
                        เลขท้าย 2 ตัว:{' '}
                        <span className="font-mono text-amber-300 font-bold">{latestResult.เลขท้าย_2_ตัว || '-'}</span>
                      </p>
                    </div>
                    <button
                      onClick={handleCreateFromDrawResult}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition shadow flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>สร้างโน้ตผลรางวัล</span>
                    </button>
                  </div>
                )}

                <form onSubmit={handleCreateKeepNote} className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                  <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-amber-400" />
                    เขียนโน้ตใหม่สำหรับ Google Keep / Firestore
                  </h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          placeholder="หัวข้อโน้ต"
                          value={newNoteTitle}
                          onChange={(e) => setNewNoteTitle(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          placeholder="แท็ก เช่น #เลขเด็ด"
                          value={newNoteTag}
                          onChange={(e) => setNewNoteTag(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <textarea
                        rows={3}
                        placeholder="เนื้อหาบันทึก"
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg p-3 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={openGoogleKeepWeb}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg transition flex items-center gap-1"
                      >
                        <span>เปิด Google Keep</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                      <button
                        type="submit"
                        disabled={!newNoteTitle.trim()}
                        className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition"
                      >
                        บันทึกโน้ต
                      </button>
                    </div>
                  </div>
                </form>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {keepNotes.map((note) => (
                    <div key={note.id} className="p-4 rounded-xl border border-slate-700/80 bg-slate-800/50 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <h5 className="text-xs font-bold text-white">{note.title}</h5>
                          <span className="text-[10px] text-amber-400 font-mono">{note.tag}</span>
                        </div>
                        <p className="text-xs text-slate-300 whitespace-pre-wrap">{note.content}</p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">{new Date(note.createdAt).toLocaleDateString('th-TH')}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleExportToKeep(note)}
                            className="px-2 py-1 bg-amber-500/20 text-amber-300 text-[11px] rounded transition flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Keep</span>
                          </button>
                          <button
                            onClick={() => setNoteToDelete(note)}
                            className="p-1 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: GOOGLE DOCS */}
            {activeTab === 'docs' && (
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-200">
                    <p className="font-bold text-white mb-1">Google Docs Official Reports Generator</p>
                    <p className="text-slate-300 leading-relaxed">
                      สร้างเอกสารรายงานสรุปผลสลากกินแบ่งรัฐบาลและหวยทุกประเภทอย่างเป็นทางการลงใน <strong>Google Docs</strong>{' '}
                      ของบัญชี Google คุณโดยตรง เพื่อนำไปพิมพ์, แชร์, หรือจัดเก็บบันทึกหลักฐาน
                    </p>
                  </div>
                </div>

                {docsMessage && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
                      docsMessage.type === 'success'
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {docsMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span>{docsMessage.text}</span>
                  </div>
                )}

                {/* 1-Click Official Report Button */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-800 to-indigo-950/40 border border-blue-500/40 flex flex-wrap items-center justify-between gap-4 shadow-lg">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                      1-Click Report Generation
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1">
                      สร้างเอกสารรายงานผลรางวัลงวดล่าสุดลง Google Docs
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      ระบบจะจัดทำตารางผลรางวัลที่ 1, เลขท้าย 2 ตัว, เลข 3 ตัว และข้อมูลอ้างอิง GLO ลงในเอกสารทันที
                    </p>
                  </div>
                  <button
                    onClick={handleCreateOfficialLotteryDoc}
                    disabled={isCreatingDoc}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <FileText className="w-4 h-4" />
                    <span>{isCreatingDoc ? 'กำลังสร้างเอกสาร...' : 'สร้างรายงานผลสลากใน Google Docs'}</span>
                  </button>
                </div>

                {/* Create Custom Document Form */}
                <form onSubmit={handleCreateCustomDoc} className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                  <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-blue-400" />
                    สร้างเอกสาร Google Docs เปล่าแบบกำหนดชื่อเอง
                  </h4>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ชื่อเอกสาร เช่น รายงานสถิติหวยปี 2569"
                      value={newDocTitle}
                      onChange={(e) => setNewDocTitle(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={isCreatingDoc || !newDocTitle.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition disabled:opacity-50 shrink-0"
                    >
                      {isCreatingDoc ? 'กำลังสร้าง...' : 'สร้างเอกสาร'}
                    </button>
                  </div>
                </form>

                {/* List of Recent Docs */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-blue-400" />
                      เอกสาร Google Docs ล่าสุดของคุณ ({recentDocs.length})
                    </h4>
                    <button
                      onClick={loadRecentDocs}
                      disabled={isLoadingDocs}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      <RefreshCw className={`w-3 h-3 ${isLoadingDocs ? 'animate-spin' : ''}`} />
                      <span>รีเฟรช</span>
                    </button>
                  </div>

                  {isLoadingDocs ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-400" />
                      กำลังดึงรายการเอกสารจาก Google Docs...
                    </div>
                  ) : recentDocs.length === 0 ? (
                    <div className="py-8 text-center bg-slate-800/30 rounded-xl border border-slate-800 text-xs text-slate-400">
                      ยังไม่มีรายการเอกสารที่สร้างไว้ กดปุ่มสร้างรายงานด้านบนเพื่อเริ่มต้น
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {recentDocs.map((doc) => (
                        <div
                          key={doc.documentId}
                          className="p-3.5 bg-slate-800/50 hover:bg-slate-800 border border-slate-700/60 rounded-xl flex items-center justify-between gap-3 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-white">{doc.title}</h5>
                              <span className="text-[10px] text-slate-400 font-mono">
                                ID: {doc.documentId.slice(0, 16)}...
                              </span>
                            </div>
                          </div>
                          <a
                            href={doc.webViewLink || `https://docs.google.com/document/d/${doc.documentId}/edit`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs rounded-lg border border-blue-500/30 flex items-center gap-1 transition"
                          >
                            <span>เปิดใน Google Docs</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: GOOGLE FORMS */}
            {activeTab === 'forms' && (
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-start gap-3">
                  <FileQuestion className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-purple-200">
                    <p className="font-bold text-white mb-1">Google Forms Creator &amp; Response Inspector</p>
                    <p className="text-slate-300 leading-relaxed">
                      สร้างแบบสำรวจความคิดเห็น, โพลสำรวจเลขเด็ดงวดหน้า และแบบฟอร์มรับส่งตรวจผลสลากผ่าน{' '}
                      <strong>Google Forms</strong> พร้อมฟังก์ชันดูคำตอบที่ส่งเข้ามาแบบเรียลไทม์
                    </p>
                  </div>
                </div>

                {formsMessage && (
                  <div
                    className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium ${
                      formsMessage.type === 'success'
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {formsMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    )}
                    <span>{formsMessage.text}</span>
                  </div>
                )}

                {/* Templates Grid */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    เลือกแม่แบบ Google Forms สำเร็จรูป (สร้างคำถามให้อัตโนมัติใน 1 คลิก):
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {LOTTERY_FORM_TEMPLATES.map((tmpl) => (
                      <div
                        key={tmpl.key}
                        className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col justify-between hover:border-purple-500/50 transition group"
                      >
                        <div>
                          <h5 className="text-xs font-bold text-white group-hover:text-purple-300 transition">
                            {tmpl.title}
                          </h5>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{tmpl.description}</p>
                          <div className="mt-2 text-[10px] text-slate-500">
                            จำนวน {tmpl.questions.length} คำถาม (ตัวเลือก &amp; ข้อความ)
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-700/60">
                          <button
                            onClick={() => handleCreateTemplateForm(tmpl)}
                            disabled={isCreatingForm}
                            className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs rounded-lg transition shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isCreatingForm ? 'กำลังสร้าง...' : 'สร้าง Form นี้'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Created Forms List */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-1.5">
                    <FileQuestion className="w-4 h-4 text-purple-400" />
                    Google Forms ที่คุณสร้างไว้ในระบบ ({createdForms.length})
                  </h4>

                  {createdForms.length === 0 ? (
                    <div className="py-8 text-center bg-slate-800/30 rounded-xl border border-slate-800 text-xs text-slate-400">
                      ยังไม่มีแบบฟอร์มที่สร้างไว้ คลิกปุ่ม &quot;สร้าง Form นี้&quot; ด้านบนเพื่อทดลองสร้างทันที
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {createdForms.map((form) => (
                        <div
                          key={form.formId}
                          className="p-4 bg-slate-800/50 border border-slate-700/60 rounded-xl flex flex-wrap items-center justify-between gap-3"
                        >
                          <div>
                            <h5 className="text-xs font-bold text-white">{form.title}</h5>
                            <p className="text-[11px] text-slate-400">{form.description}</p>
                            <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                              Form ID: {form.formId}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {form.responderUri && (
                              <a
                                href={form.responderUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs rounded-lg border border-emerald-500/30 flex items-center gap-1 transition"
                              >
                                <span>เปิดหน้ากรอกฟอร์ม</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            <a
                              href={`https://docs.google.com/forms/d/${form.formId}/edit`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs rounded-lg border border-purple-500/30 flex items-center gap-1 transition"
                            >
                              <span>แก้ไขฟอร์ม</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <button
                              onClick={() => handleInspectResponses(form)}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1 shadow"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>ดูคำตอบ ({formResponses.length})</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inspect Responses Drawer / Box */}
                {selectedFormForResponses && (
                  <div className="p-5 rounded-2xl bg-slate-950/80 border border-purple-500/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          คำตอบที่ส่งเข้ามาใน: {selectedFormForResponses.title}
                        </h4>
                        <p className="text-[11px] text-slate-400">ดึงสดจาก Google Forms API responses</p>
                      </div>
                      <button
                        onClick={() => setSelectedFormForResponses(null)}
                        className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                      >
                        ปิด
                      </button>
                    </div>

                    {isLoadingResponses ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-purple-400" />
                        กำลังดึงคำตอบจาก Google Forms API...
                      </div>
                    ) : formResponses.length === 0 ? (
                      <div className="py-4 text-center text-xs text-slate-400">
                        ยังไม่มีผู้ส่งคำตอบเข้ามาในฟอร์มนี้ คุณสามารถคลิก &quot;เปิดหน้ากรอกฟอร์ม&quot; ด้านบนเพื่อทดสอบกรอก
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {formResponses.map((r, i) => (
                          <div key={r.responseId || i} className="p-3 bg-slate-900 rounded-lg border border-slate-800 text-xs">
                            <span className="text-[10px] text-slate-400 block mb-1">
                              ส่งเมื่อ: {new Date(r.lastSubmittedTime).toLocaleString('th-TH')}
                            </span>
                            <div className="space-y-1">
                              {r.answers &&
                                Object.entries(r.answers).map(([qId, ans]: any) => (
                                  <div key={qId} className="text-slate-300">
                                    • {ans.textAnswers?.answers?.[0]?.value || '-'}
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MANDATORY USER CONFIRMATION MODAL FOR DESTRUCTIVE TASK DELETION */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">ยืนยันการลบงานใน Google Tasks</h3>
                <p className="text-xs text-slate-400">การดำเนินการนี้จะลบงานออกจากบัญชี Google ของคุณถาวร</p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-xl">
              <p className="text-xs font-semibold text-white">{taskToDelete.title}</p>
              {taskToDelete.notes && <p className="text-[11px] text-slate-400 mt-1">{taskToDelete.notes}</p>}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการลบงานนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setTaskToDelete(null)}
                disabled={isDeletingTask}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDeleteTask}
                disabled={isDeletingTask}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingTask ? 'กำลังลบ...' : 'ยืนยันการลบ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR DELETING KEEP NOTE */}
      {noteToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">ยืนยันการลบโน้ต</h3>
                <p className="text-xs text-slate-400">ต้องการลบโน้ตนี้ออกจากคลาวด์ Firestore หรือไม่</p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/70 border border-slate-700/60 rounded-xl">
              <p className="text-xs font-semibold text-white">{noteToDelete.title}</p>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{noteToDelete.content}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setNoteToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDeleteNote}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยืนยันการลบ</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
