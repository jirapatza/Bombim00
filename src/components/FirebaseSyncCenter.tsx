import React, { useState, useEffect } from 'react';
import {
  Database,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Eye,
  RefreshCw,
  ShieldCheck,
  Server,
  Zap,
  Sparkles,
  Ticket,
  Lock,
} from 'lucide-react';
import {
  auth,
  db,
  initAuth,
  googleSignIn,
  OperationType,
  handleFirestoreError,
  testConnection,
} from '../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';

interface FirebaseSyncCenterProps {
  latestResult?: any;
}

interface CloudWatchedNumber {
  id: string;
  number: string;
  note: string;
  lotteryTarget: string;
  createdAt: string;
}

interface CloudSavedTicket {
  id: string;
  ticketNumber: string;
  drawDate: string;
  lotteryType: string;
  checked: boolean;
  wonPrize?: string;
  rewardAmount?: number;
  createdAt: string;
}

export const FirebaseSyncCenter: React.FC<FirebaseSyncCenterProps> = ({ latestResult }) => {
  const [user, setUser] = useState<any>(auth.currentUser);
  const [activeTab, setActiveTab] = useState<'watched' | 'tickets' | 'status'>('watched');

  // Watched Numbers State
  const [watchedNumbers, setWatchedNumbers] = useState<CloudWatchedNumber[]>([]);
  const [newNumber, setNewNumber] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newTarget, setNewTarget] = useState('สลากกินแบ่งรัฐบาลไทย');
  const [isAddingNumber, setIsAddingNumber] = useState(false);

  // Saved Tickets State
  const [savedTickets, setSavedTickets] = useState<CloudSavedTicket[]>([]);
  const [newTicketNumber, setNewTicketNumber] = useState('');
  const [newTicketDrawDate, setNewTicketDrawDate] = useState('');
  const [isAddingTicket, setIsAddingTicket] = useState(false);

  // Status & Notifications
  const [syncStatus, setSyncStatus] = useState<'connected' | 'checking' | 'error'>('checking');
  const [statusMsg, setStatusMsg] = useState<string>('กำลังตรวจสอบการเชื่อมต่อ Firestore...');
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Confirmation state for deleting
  const [itemToDelete, setItemToDelete] = useState<{ type: 'number' | 'ticket'; id: string; label: string } | null>(null);

  useEffect(() => {
    const unsubscribeAuth = initAuth((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        listenToFirestoreData(currentUser.uid);
      } else {
        setWatchedNumbers([]);
        setSavedTickets([]);
      }
    });

    checkConnection();

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const checkConnection = async () => {
    setSyncStatus('checking');
    try {
      await testConnection();
      setSyncStatus('connected');
      setStatusMsg('เชื่อมต่อ Cloud Firestore (asia-east1) สำเร็จ พร้อมใช้งาน');
    } catch (err: any) {
      setSyncStatus('error');
      setStatusMsg(`สถานะ Firestore: ${err.message}`);
    }
  };

  const listenToFirestoreData = (uid: string) => {
    // 1. Watched Numbers
    const watchedRef = collection(db, 'users', uid, 'watched_numbers');
    const unsubWatched = onSnapshot(
      watchedRef,
      (snapshot) => {
        const items: CloudWatchedNumber[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setWatchedNumbers(items);
      },
      (error) => {
        console.warn('Firestore snapshot note:', error.message);
      }
    );

    // 2. Saved Tickets
    const ticketsRef = collection(db, 'users', uid, 'saved_tickets');
    const unsubTickets = onSnapshot(
      ticketsRef,
      (snapshot) => {
        const items: CloudSavedTicket[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...(docSnap.data() as any) });
        });
        setSavedTickets(items);
      },
      (error) => {
        console.warn('Firestore snapshot note:', error.message);
      }
    );

    return () => {
      unsubWatched();
      unsubTickets();
    };
  };

  const handleAddWatchedNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setActionAlert({ type: 'error', text: 'กรุณาลงชื่อเข้าใช้ด้วย Google ก่อนบันทึกข้อมูล' });
      return;
    }
    const cleanNum = newNumber.trim();
    if (!cleanNum || cleanNum.length > 6) {
      setActionAlert({ type: 'error', text: 'กรุณากรอกตัวเลข 2 - 6 หลัก' });
      return;
    }

    setIsAddingNumber(true);
    setActionAlert(null);
    const id = `num-${Date.now()}`;
    const path = `users/${user.uid}/watched_numbers/${id}`;

    try {
      await setDoc(doc(db, 'users', user.uid, 'watched_numbers', id), {
        id,
        userId: user.uid,
        number: cleanNum,
        note: newNote.trim() || 'ชุดตัวเลขที่ติดตาม',
        lotteryTarget: newTarget,
        createdAt: new Date().toISOString(),
      });
      setNewNumber('');
      setNewNote('');
      setActionAlert({ type: 'success', text: `บันทึกเลข ${cleanNum} ลงใน Firestore สำเร็จ! ✅` });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsAddingNumber(false);
    }
  };

  const handleAddTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setActionAlert({ type: 'error', text: 'กรุณาลงชื่อเข้าใช้ด้วย Google ก่อนบันทึกข้อมูล' });
      return;
    }
    const cleanTicket = newTicketNumber.trim();
    if (cleanTicket.length !== 6 || !/^\d{6}$/.test(cleanTicket)) {
      setActionAlert({ type: 'error', text: 'กรุณากรอกหมายเลขสลากให้ครบ 6 หลัก' });
      return;
    }

    setIsAddingTicket(true);
    setActionAlert(null);
    const id = `ticket-${Date.now()}`;
    const path = `users/${user.uid}/saved_tickets/${id}`;

    // Auto verify prize if latest result matches
    let wonPrize = '';
    let rewardAmount = 0;
    if (latestResult) {
      const firstPrize = String(latestResult.รางวัลที่_1 || '');
      const last2 = String(latestResult.เลขท้าย_2_ตัว || '');
      if (cleanTicket === firstPrize) {
        wonPrize = 'รางวัลที่ 1 (6,000,000 บาท)';
        rewardAmount = 6000000;
      } else if (cleanTicket.endsWith(last2) && last2) {
        wonPrize = `เลขท้าย 2 ตัว (${last2}) - 2,000 บาท`;
        rewardAmount = 2000;
      }
    }

    try {
      await setDoc(doc(db, 'users', user.uid, 'saved_tickets', id), {
        id,
        userId: user.uid,
        ticketNumber: cleanTicket,
        drawDate: newTicketDrawDate || (latestResult?.งวดวันที่ || 'งวดปัจจุบัน'),
        lotteryType: 'สลากกินแบ่งรัฐบาลไทย',
        checked: Boolean(wonPrize),
        wonPrize,
        rewardAmount,
        createdAt: new Date().toISOString(),
      });
      setNewTicketNumber('');
      setActionAlert({
        type: 'success',
        text: `บันทึกสลากหมายเลข ${cleanTicket} ลง Firestore สำเร็จ! ${wonPrize ? `🎉 ตรวจพบ: ${wonPrize}` : ''}`,
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setIsAddingTicket(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !user) return;
    const { type, id } = itemToDelete;
    const colName = type === 'number' ? 'watched_numbers' : 'saved_tickets';
    const path = `users/${user.uid}/${colName}/${id}`;

    try {
      await deleteDoc(doc(db, 'users', user.uid, colName, id));
      setActionAlert({ type: 'success', text: 'ลบรายการออกจาก Firestore เรียบร้อยแล้ว' });
      setItemToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl mb-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/40 to-slate-900 border-b border-slate-800 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">Firebase Firestore Cloud Center</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium">
                Cloud Database
              </span>
            </div>
            <p className="text-xs text-slate-400">
              ฐานข้อมูลคลาวด์แบบเรียลไทม์ ซิงค์เลขที่ติดตาม ประวัติสลาก และการแจ้งเตือนข้ามอุปกรณ์
            </p>
          </div>
        </div>

        {/* Database status pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-300 font-mono text-[11px]">gen-lang-client-0820377767</span>
          </div>
          <button
            onClick={checkConnection}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
            title="ทดสอบการเชื่อมต่อ Firestore"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-900/60 px-5 pt-3 gap-2">
        <button
          onClick={() => setActiveTab('watched')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
            activeTab === 'watched'
              ? 'bg-slate-800/80 text-amber-400 border-amber-500'
              : 'text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <Eye className="w-4 h-4" />
          เลขที่ติดตามบนคลาวด์ ({watchedNumbers.length})
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
            activeTab === 'tickets'
              ? 'bg-slate-800/80 text-amber-400 border-amber-500'
              : 'text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <Ticket className="w-4 h-4" />
          สลากที่บันทึกไว้ ({savedTickets.length})
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition border-b-2 ${
            activeTab === 'status'
              ? 'bg-slate-800/80 text-amber-400 border-amber-500'
              : 'text-slate-400 hover:text-slate-200 border-transparent'
          }`}
        >
          <Server className="w-4 h-4" />
          ข้อมูลคอนฟิก Firestore
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-5">
        {/* Action Alert */}
        {actionAlert && (
          <div
            className={`flex items-center gap-2 p-3 rounded-xl text-xs font-medium mb-4 ${
              actionAlert.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
            }`}
          >
            {actionAlert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{actionAlert.text}</span>
          </div>
        )}

        {/* TAB 1: WATCHED NUMBERS */}
        {activeTab === 'watched' && (
          <div className="space-y-5">
            {!user ? (
              <div className="text-center py-8 px-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
                <Lock className="w-10 h-10 text-amber-400/80 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-white mb-1">เข้าสู่ระบบเพื่อใช้งานคลาวด์ Firestore</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                  เมื่อเข้าสู่ระบบด้วย Google ข้อมูลเลขที่คุณติดตามจะถูกเก็บไว้บน Cloud Firestore ถาวร
                </p>
                <button
                  onClick={() => googleSignIn()}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer transition"
                >
                  ลงชื่อเข้าใช้ด้วย Google
                </button>
              </div>
            ) : (
              <>
                {/* Add Form */}
                <form
                  onSubmit={handleAddWatchedNumber}
                  className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60"
                >
                  <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-amber-400" />
                    เพิ่มชุดตัวเลขที่ต้องการติดตามผล (Cloud Watched Numbers)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <input
                        type="text"
                        placeholder="ตัวเลข เช่น 84 หรือ 594"
                        value={newNumber}
                        onChange={(e) => setNewNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-amber-300 font-mono font-bold text-center tracking-widest rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                    <div>
                      <select
                        value={newTarget}
                        onChange={(e) => setNewTarget(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                      >
                        <option value="สลากกินแบ่งรัฐบาลไทย">สลากกินแบ่งรัฐบาลไทย</option>
                        <option value="ฮานอย VIP">ฮานอย VIP</option>
                        <option value="ฮานอยพิเศษ">ฮานอยพิเศษ</option>
                        <option value="ลาวพัฒนา">ลาวพัฒนา</option>
                        <option value="ทุกประเภท">ทุกประเภท</option>
                      </select>
                    </div>
                    <div className="md:col-span-2 flex gap-2">
                      <input
                        type="text"
                        placeholder="หมายเหตุ เช่น เลขมงคล, ทะเบียนรถ"
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="submit"
                        disabled={isAddingNumber || !newNumber.trim()}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition disabled:opacity-50 shrink-0 cursor-pointer shadow"
                      >
                        {isAddingNumber ? 'บันทึก...' : 'บันทึก'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* List */}
                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-2">
                    ชุดตัวเลขที่กำลังติดตามในระบบ ({watchedNumbers.length})
                  </h4>
                  {watchedNumbers.length === 0 ? (
                    <div className="py-6 text-center bg-slate-800/30 rounded-xl border border-slate-800 text-xs text-slate-400">
                      ยังไม่มีเลขที่บันทึกไว้ใน Firestore คุณสามารถกรอกตัวเลขด้านบนเพื่อเริ่มติดตาม
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {watchedNumbers.map((item) => {
                        // Check if matches latestResult
                        let isMatch = false;
                        if (latestResult) {
                          const firstPrize = String(latestResult.รางวัลที่_1 || '');
                          const last2 = String(latestResult.เลขท้าย_2_ตัว || '');
                          if (firstPrize.includes(item.number) || last2 === item.number) {
                            isMatch = true;
                          }
                        }

                        return (
                          <div
                            key={item.id}
                            className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                              isMatch
                                ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                                : 'bg-slate-800/60 border-slate-700/60 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-lg font-black tracking-widest text-amber-400">
                                {item.number}
                              </span>
                              <div>
                                <p className="text-xs font-semibold text-white leading-tight">{item.note}</p>
                                <span className="text-[10px] text-slate-400">{item.lotteryTarget}</span>
                                {isMatch && (
                                  <span className="ml-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                                    ตรงกับงวดล่าสุด! 🎉
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                setItemToDelete({ type: 'number', id: item.id, label: `เลข ${item.number}` })
                              }
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                              title="ลบ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: SAVED TICKETS */}
        {activeTab === 'tickets' && (
          <div className="space-y-5">
            {!user ? (
              <div className="text-center py-8 px-4 bg-slate-800/40 border border-slate-700/50 rounded-xl">
                <Ticket className="w-10 h-10 text-amber-400/80 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-white mb-1">เข้าสู่ระบบเพื่อบันทึกประวัติสลาก</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                  บันทึกหมายเลขสลากที่คุณซื้อไว้เพื่อตรวจผลอัตโนมัติแบบเรียลไทม์
                </p>
                <button
                  onClick={() => googleSignIn()}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow cursor-pointer transition"
                >
                  ลงชื่อเข้าใช้ด้วย Google
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleAddTicket} className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
                  <h4 className="text-xs font-bold text-slate-200 mb-3 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-amber-400" />
                    บันทึกสลากกินแบ่งที่ซื้อไว้ (ตรวจผลและคำนวณรางวัลอัตโนมัติ)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <input
                        type="text"
                        placeholder="หมายเลขสลาก 6 หลัก เช่น 289594"
                        value={newTicketNumber}
                        onChange={(e) => setNewTicketNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-amber-300 font-mono font-bold text-center tracking-widest rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder={`งวดประจำวันที่ เช่น ${latestResult?.งวดวันที่ || '16 ตุลาคม 2569'}`}
                        value={newTicketDrawDate}
                        onChange={(e) => setNewTicketDrawDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <button
                        type="submit"
                        disabled={isAddingTicket || newTicketNumber.length !== 6}
                        className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-lg transition disabled:opacity-50 cursor-pointer shadow"
                      >
                        {isAddingTicket ? 'กำลังบันทึก...' : 'บันทึกสลากลง Firestore'}
                      </button>
                    </div>
                  </div>
                </form>

                <div>
                  <h4 className="text-xs font-bold text-slate-300 mb-2">สลากที่บันทึกไว้ ({savedTickets.length})</h4>
                  {savedTickets.length === 0 ? (
                    <div className="py-6 text-center bg-slate-800/30 rounded-xl border border-slate-800 text-xs text-slate-400">
                      ยังไม่มีสลากที่บันทึกไว้
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {savedTickets.map((t) => (
                        <div
                          key={t.id}
                          className="p-3 bg-slate-800/50 border border-slate-700/60 rounded-xl flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-base font-bold text-amber-400 tracking-wider">
                              {t.ticketNumber}
                            </span>
                            <div>
                              <p className="text-xs text-white">งวดวันที่: {t.drawDate}</p>
                              {t.wonPrize ? (
                                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                                  🏆 {t.wonPrize}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">ยังไม่ถูกรางวัลในงวดปัจจุบัน</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              setItemToDelete({ type: 'ticket', id: t.id, label: `สลาก ${t.ticketNumber}` })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: CONFIG STATUS */}
        {activeTab === 'status' && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
              <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                สถานะการกำหนดค่า Cloud Firestore
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300 font-mono">
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Google Cloud Project ID:</span>
                  <span className="text-amber-300 font-bold">gen-lang-client-0820377767</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Firestore Database ID:</span>
                  <span className="text-amber-300 font-bold">ai-studio-bombim00-e782813d-2375-4c45-8d65-2599136bcf61</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Cloud Region:</span>
                  <span className="text-emerald-300">asia-east1</span>
                </div>
                <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Security Rules:</span>
                  <span className="text-emerald-300 font-bold">Deployed (ABAC Hardened)</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/40 text-slate-300">
              <p className="font-bold text-white mb-1">คอลเลกชันที่รองรับใน Blueprint:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400">
                <li><code className="text-amber-300">/users/{'{userId}'}</code> - ข้อมูลโปรไฟล์และการตั้งค่าผู้ใช้</li>
                <li><code className="text-amber-300">/users/{'{userId}'}/watched_numbers</code> - เลขเด็ดที่ติดตามบนคลาวด์</li>
                <li><code className="text-amber-300">/users/{'{userId}'}/saved_tickets</code> - ประวัติสลากที่ซื้อและผลการตรวจรางวัล</li>
                <li><code className="text-amber-300">/users/{'{userId}'}/reminders</code> - การแจ้งเตือนซิงค์กับ Google Tasks &amp; Keep</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400" />
              ยืนยันการลบข้อมูล
            </h3>
            <p className="text-xs text-slate-300">
              ต้องการลบ <strong>{itemToDelete.label}</strong> ออกจาก Cloud Firestore หรือไม่?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg transition"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition"
              >
                ลบข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
