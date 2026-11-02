import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CrashShieldErrorBoundary } from './components/CrashShieldErrorBoundary.tsx';
import { trackDiagnostic } from './utils/siteDiagnostics.ts';

// Global resilience handlers to shield app from uncaught async errors
window.addEventListener('unhandledrejection', (event) => {
  console.log('[CRASH-SHIELD] Handled unhandledrejection');
  trackDiagnostic('frontend_promise_error', 'window');
  // Prevent unhandled promise errors from breaking UI
  event.preventDefault();
});

window.addEventListener('error', () => trackDiagnostic('frontend_runtime_error', 'window'));
trackDiagnostic('frontend_started');

createRoot(document.getElementById('root')!).render(
  <CrashShieldErrorBoundary>
    <App />
  </CrashShieldErrorBoundary>
);
