import React, { useState, useEffect } from 'react';
import {
  FileCode2,
  Save,
  Github,
  RotateCw,
  Copy,
  Download,
  CheckCircle2,
  AlertTriangle,
  FolderPlus,
  ArrowUpRight,
  Sparkles,
  Eye,
  Undo2,
  Terminal,
  FileCheck,
  Shield,
  Key,
  Layers,
  Code2
} from 'lucide-react';

interface ProjectFile {
  name: string;
  path: string;
  category: string;
  content: string;
}

const API_BASE = 'https://bombim00-github-api.jirapatcip2557.workers.dev';

interface ProjectCodeEditorProps {
  onRefreshProject?: () => void;
  defaultRepo?: string;
  defaultBranch?: string;
}

export function ProjectCodeEditor({
  onRefreshProject,
  defaultRepo,
  defaultBranch,
}: ProjectCodeEditorProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('lottery_checker.py');
  const [editorContent, setEditorContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingLocal, setIsSavingLocal] = useState<boolean>(false);
  const [isCommittingGitHub, setIsCommittingGitHub] = useState<boolean>(false);
  const [isFetchingRemote, setIsFetchingRemote] = useState<boolean>(false);

  // Status banners
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    details?: string;
    commitSha?: string;
    commitUrl?: string;
  } | null>(null);

  // GitHub credentials & commit metadata
  const [repo, setRepo] = useState<string>(() => localStorage.getItem('gh_repo') || defaultRepo || 'jirapatza/Bombim00');
  const [branch, setBranch] = useState<string>(() => localStorage.getItem('gh_branch') || defaultBranch || 'main');
  const [token, setToken] = useState<string>(() => localStorage.getItem('gh_token') || '');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [authorName, setAuthorName] = useState<string>(() => localStorage.getItem('gh_author_name') || 'Lottery Alert App');
  const [authorEmail, setAuthorEmail] = useState<string>(() => localStorage.getItem('gh_author_email') || 'bombimm43@gmail.com');
  const [showCommitModal, setShowCommitModal] = useState<boolean>(false);

  // New file creation modal
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [newFilePath, setNewFilePath] = useState<string>('');
  const [newFileCategory, setNewFileCategory] = useState<string>('Custom');

  // Copy indicator
  const [copied, setCopied] = useState<boolean>(false);

  // Fetch project files
  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/project-files`);
      const data: ProjectFile[] = await res.json();
      setFiles(data);

      // Select initial file
      const current = data.find((f) => f.path === selectedFilePath) || data[0];
      if (current) {
        setSelectedFilePath(current.path);
        setEditorContent(current.content);
        setOriginalContent(current.content);
      }
    } catch (err: any) {
      console.error('Failed to load project files:', err);
      setActionFeedback({
        type: 'error',
        message: 'ไม่สามารถโหลดรายการไฟล์จากเซิร์ฟเวอร์ได้: ' + err.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const handleSelectFile = (file: ProjectFile) => {
    if (editorContent !== originalContent) {
      const confirmLeave = window.confirm(
        `ไฟล์ ${selectedFilePath} มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการสลับไฟล์โดยไม่บันทึกหรือไม่?`
      );
      if (!confirmLeave) return;
    }
    setSelectedFilePath(file.path);
    setEditorContent(file.content);
    setOriginalContent(file.content);
    setActionFeedback(null);
  };

  const isDirty = editorContent !== originalContent;

  // Handle Tab key in textarea for friendly coding
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newContent = editorContent.substring(0, start) + '  ' + editorContent.substring(end);
      setEditorContent(newContent);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // 1. Save locally to disk
  const handleSaveLocal = async () => {
    setIsSavingLocal(true);
    setActionFeedback(null);
    try {
      localStorage.setItem(`draft:${selectedFilePath}`, editorContent);
      const data = { success: true };

      setOriginalContent(editorContent);
      setActionFeedback({
        type: 'success',
        message: `บันทึกร่างไฟล์ '${selectedFilePath}' ไว้ในแอปเรียบร้อยแล้ว!`,
      });

      // Update in files list
      setFiles((prev) =>
        prev.map((f) => (f.path === selectedFilePath ? { ...f, content: editorContent } : f))
      );

      if (onRefreshProject) onRefreshProject();
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: 'เกิดข้อผิดพลาดในการบันทึกไฟล์: ' + err.message,
      });
    } finally {
      setIsSavingLocal(false);
    }
  };

  // 2. Commit and Push directly to GitHub
  const handleCommitToGitHub = async () => {
    if (!repo) {
      alert('กรุณาระบุชื่อ GitHub Repository เช่น username/th-lottery-alert');
      return;
    }
    if (!token) {
      alert('กรุณากรอก GitHub Personal Access Token (PAT)');
      return;
    }

    setIsCommittingGitHub(true);
    setActionFeedback(null);

    const msg = commitMessage.trim() || `Update ${selectedFilePath} via Lottery Alert App [Web Direct]`;

    try {
      const res = await fetch(`${API_BASE}/api/github/commit-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: repo.trim(),
          token: token.trim(),
          branch: branch.trim() || 'main',
          filePath: selectedFilePath,
          content: editorContent,
          commitMessage: msg,
          authorName: authorName.trim(),
          authorEmail: authorEmail.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to commit to GitHub');
      }

      // Save credentials in localStorage
      localStorage.setItem('gh_repo', repo.trim());
      localStorage.setItem('gh_branch', branch.trim());
      // Do not persist the GitHub credential in browser storage.
      localStorage.setItem('gh_author_name', authorName.trim());
      localStorage.setItem('gh_author_email', authorEmail.trim());

      setOriginalContent(editorContent);
      setShowCommitModal(false);

      setActionFeedback({
        type: 'success',
        message: data.message || `Commit ไฟล์ '${selectedFilePath}' ขึ้น GitHub สำเร็จ 100%!`,
        commitSha: data.commit_sha,
        commitUrl: data.html_url,
      });

      // Update in local files list
      setFiles((prev) =>
        prev.map((f) => (f.path === selectedFilePath ? { ...f, content: editorContent } : f))
      );

      if (onRefreshProject) onRefreshProject();
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: 'ไม่สามารถ Commit ไฟล์ขึ้น GitHub ได้: ' + err.message,
      });
    } finally {
      setIsCommittingGitHub(false);
    }
  };

  // 3. Pull / Inspect Remote version from GitHub
  const handlePullRemote = async () => {
    if (!repo) {
      alert('กรุณาระบุชื่อ GitHub Repository เช่น username/th-lottery-alert');
      return;
    }
    setIsFetchingRemote(true);
    setActionFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/api/github/get-remote-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: repo.trim(),
          token: token.trim(),
          branch: branch.trim() || 'main',
          filePath: selectedFilePath,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch remote file');
      }

      const confirmOverwrite = window.confirm(
        `ดึงโค้ดล่าสุดของ '${selectedFilePath}' จาก GitHub (${repo}) ขนาด ${data.size} bytes สำเร็จ!\nต้องการนำเนื้อหานี้มาทับในหน้าจอ Editor ตอนนี้เลยหรือไม่?`
      );

      if (confirmOverwrite) {
        setEditorContent(data.content);
        setActionFeedback({
          type: 'info',
          message: `ดึงโค้ดล่าสุดจาก GitHub เรียบร้อยแล้ว (SHA: ${data.sha.slice(0, 7)}) กดปุ่ม 'บันทึกลงเครื่อง' เพื่อเซฟ`,
        });
      }
    } catch (err: any) {
      setActionFeedback({
        type: 'error',
        message: 'ไม่สามารถดึงไฟล์จาก GitHub ได้: ' + err.message,
      });
    } finally {
      setIsFetchingRemote(false);
    }
  };

  // 4. Create New File
  const handleCreateNewFile = async () => {
    if (!newFilePath) {
      alert('กรุณาระบุชื่อและพาธของไฟล์ เช่น custom_checker.py หรือ config/my_config.json');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/github/commit-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.trim(), filePath: newFilePath.trim(),
          content: '# New file created via Lottery Alert Dashboard\n',
          commitMessage: `Create ${newFilePath.trim()} via Lottery Alert App`,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);

      setShowNewFileModal(false);
      await loadFiles();
      setSelectedFilePath(newFilePath.trim());
      setEditorContent('# New file created via Lottery Alert Dashboard\n');
      setOriginalContent('# New file created via Lottery Alert Dashboard\n');
      setNewFilePath('');

      setActionFeedback({
        type: 'success',
        message: `สร้างไฟล์ใหม่ '${newFilePath.trim()}' สำเร็จ!`,
      });
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการสร้างไฟล์: ' + err.message);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(editorContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lineCount = editorContent.split('\n').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-inner">
              <Code2 className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  ตัวแก้ไขโค้ดและจัดการไฟล์ในแอป (In-App Code & GitHub Committer)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase">
                  Live Editor
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                แก้ไขโค้ดโปรแกรม เช่น <code className="text-amber-300 font-mono">lottery_checker.py</code>, คอนฟิก, ข้อมูลหวยทุกประเภท แล้วกด{' '}
                <strong className="text-white">"Commit &amp; Push ขึ้น GitHub ทันที"</strong> ได้โดยไม่ต้องเปิด Terminal
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowNewFileModal(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-emerald-400" />
              สร้างไฟล์ใหม่
            </button>

            <button
              type="button"
              onClick={loadFiles}
              disabled={isLoading}
              className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              รีเฟรช
            </button>
          </div>
        </div>
      </div>

      {/* Action feedback notification */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-2xl border text-xs flex flex-wrap items-center justify-between gap-3 animate-fade-in ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
              : actionFeedback.type === 'error'
              ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
              : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : actionFeedback.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
            )}
            <div>
              <div className="font-bold">{actionFeedback.message}</div>
              {actionFeedback.commitSha && (
                <div className="text-[11px] opacity-80 mt-0.5 font-mono">
                  Commit SHA: {actionFeedback.commitSha}
                </div>
              )}
            </div>
          </div>

          {actionFeedback.commitUrl && (
            <a
              href={actionFeedback.commitUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold text-[11px] flex items-center gap-1 transition"
            >
              ดูไฟล์บน GitHub
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Main Grid: File list sidebar + Code Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar: File Catalog */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-3">
          <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <FileCode2 className="w-4 h-4 text-indigo-400" />
              โครงสร้างไฟล์โปรเจกต์ ({files.length})
            </span>
          </div>

          <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1">
            {files.map((f) => {
              const active = f.path === selectedFilePath;
              return (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => handleSelectFile(f)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-mono transition flex items-center justify-between cursor-pointer ${
                    active
                      ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/50 font-bold shadow-md'
                      : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="truncate">{f.path}</span>
                    {active && isDirty && (
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="ยังไม่ได้บันทึก" />
                    )}
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 font-sans border border-slate-800 shrink-0">
                    {f.category}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 flex flex-col space-y-4 shadow-xl">
          {/* Top Bar inside Editor */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono text-xs font-bold border border-indigo-500/30">
                {selectedFilePath}
              </span>
              {isDirty ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ● มีการแก้ไขยังไม่บันทึก
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 flex items-center gap-1">
                  <FileCheck className="w-3 h-3 text-emerald-400" /> ตรงกับในเครื่อง
                </span>
              )}
            </div>

            {/* Actions for current file */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Reset button */}
              {isDirty && (
                <button
                  type="button"
                  onClick={() => setEditorContent(originalContent)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition cursor-pointer flex items-center gap-1"
                  title="คืนค่าเดิมก่อนแก้ไข"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  คืนค่าเดิม
                </button>
              )}

              {/* Copy */}
              <button
                type="button"
                onClick={handleCopyCode}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition cursor-pointer flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'คัดลอกแล้ว!' : 'คัดลอก'}
              </button>

              {/* Download */}
              <a
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(editorContent)}`}
                download={selectedFilePath.split('/').pop()}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition cursor-pointer flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                ดาวน์โหลด
              </a>

              {/* Pull from GitHub */}
              <button
                type="button"
                disabled={isFetchingRemote}
                onClick={handlePullRemote}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                title="ดึงไฟล์เวอร์ชันล่าสุดจาก GitHub มาตรวจดู"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isFetchingRemote ? 'animate-spin' : ''}`} />
                ดึงจาก GitHub
              </button>

              {/* Save locally */}
              <button
                type="button"
                disabled={isSavingLocal || !isDirty}
                onClick={handleSaveLocal}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingLocal ? 'กำลังบันทึก...' : 'บันทึกลงเครื่อง'}
              </button>

              {/* Commit & Push to GitHub */}
              <button
                type="button"
                onClick={() => setShowCommitModal(true)}
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition cursor-pointer flex items-center gap-1.5"
              >
                <Github className="w-3.5 h-3.5" />
                Commit ขึ้น GitHub
              </button>
            </div>
          </div>

          {/* Textarea Code Editor */}
          <div className="relative flex-1 rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden focus-within:border-indigo-500/60 transition">
            <textarea
              rows={22}
              value={editorContent}
              onChange={(e) => setEditorContent(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              className="w-full bg-transparent p-4 text-xs font-mono text-slate-100 focus:outline-none leading-relaxed resize-y selection:bg-indigo-600/40"
              placeholder="ใส่เนื้อหาโค้ดที่นี่..."
            />
          </div>

          {/* Editor Footer / Info */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
            <div className="flex items-center gap-3 font-mono">
              <span>ความยาว: {editorContent.length.toLocaleString()} อักขระ</span>
              <span>•</span>
              <span>จำนวนบรรทัด: {lineCount} บรรทัด</span>
              <span>•</span>
              <span>กดปุ่ม Tab เพื่อย่อหน้า 2 เคาะ</span>
            </div>

            <div className="text-slate-400">
              ปลายทางเซฟ: <code className="text-indigo-300 font-mono">/{selectedFilePath}</code>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Commit & Push to GitHub */}
      {showCommitModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Github className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base text-white">
                  Commit &amp; Push ไฟล์ขึ้น GitHub
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCommitModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              ระบบจะยิง API ตรงไปที่ GitHub เพื่ออัปเดตไฟล์ <code className="text-amber-300 font-mono">{selectedFilePath}</code> ไปยัง Repository ของคุณพร้อมสร้างประวัติ Commit ทันที
            </p>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  GitHub Repository (เช่น owner/repo)
                </label>
                <input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="username/th-lottery-alert"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Branch (กิ่ง)
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    ชื่อผู้ Commit (Author Name)
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">
                    Personal Access Token (PAT)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                  >
                    {showToken ? 'ซ่อน' : 'แสดง'}
                  </button>
                </div>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_xxxx หรือ github_pat_xxxx"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Commit Message (ข้อความกำกับการอัปเดต)
                </label>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder={`Update ${selectedFilePath} with new enhancements`}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCommitModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isCommittingGitHub}
                onClick={handleCommitToGitHub}
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Github className="w-4 h-4" />
                {isCommittingGitHub ? 'กำลังส่งขึ้น GitHub...' : 'ยืนยัน Commit & Push'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create New File */}
      {showNewFileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-emerald-400" />
              สร้างไฟล์ใหม่ในโปรเจกต์
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  ชื่อและพาธไฟล์ (เช่น custom_runner.py หรือ scripts/backup.sh)
                </label>
                <input
                  type="text"
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  placeholder="scripts/my_script.py"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowNewFileModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleCreateNewFile}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                สร้างไฟล์
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
