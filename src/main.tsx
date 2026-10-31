import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CrashShieldErrorBoundary } from './components/CrashShieldErrorBoundary.tsx';

// Global resilience handlers to shield app from uncaught async errors
window.addEventListener('unhandledrejection', (event) => {
  console.log('[CRASH-SHIELD] Handled unhandledrejection:', event.reason);
  // Prevent unhandled promise errors from breaking UI
  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <CrashShieldErrorBoundary>
    <App />
  </CrashShieldErrorBoundary>
);
