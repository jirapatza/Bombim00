import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { installBrowserDiagnostics, trackDiagnostic } from './utils/siteDiagnostics';
import './index.css';

class DiagnosticBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    // Do not send error messages, stack traces, URLs, or user data to PostHog.
    trackDiagnostic('frontend_render_error');
  }

  render(): React.ReactNode {
    if (this.state.failed) {
      return (
        <main role="alert" style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
          <h1>หน้าเว็บมีข้อผิดพลาด</h1>
          <p>ลองโหลดหน้าเว็บใหม่ หากยังพบปัญหาให้ตรวจสถานะระบบ</p>
          <button type="button" onClick={() => window.location.reload()}>โหลดหน้าใหม่</button>
        </main>
      );
    }
    return this.props.children;
  }
}

installBrowserDiagnostics();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DiagnosticBoundary>
      <App />
    </DiagnosticBoundary>
  </React.StrictMode>
);
