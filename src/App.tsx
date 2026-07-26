import { useEffect, useState } from 'react';
import { LeftBar } from './components/LeftBar';
import { Sidebar } from './components/Sidebar';
import { Storyboard } from './components/Storyboard';
import { ApiKeyModal } from './components/ApiKeyModal';
import { SettingsModal } from './components/SettingsModal';
import { YTDescriptionModal } from './components/YTDescriptionModal';
import { ToastContainer } from './components/ToastContainer';
import { useScriptStore } from './stores/scriptStore';
import { useUIStore } from './stores/uiStore';
import { getStoredApiKey, initializeDatabase } from './services/db';
import { hasBackupConfig, restoreFromGitHub, startAutoBackup, syncWithRemote } from './services/backup';

function App() {
  const { loadScripts, scripts, isLoading } = useScriptStore();
  const { addToast, mainFontSize, mainLineHeight, sidebarOpen } = useUIStore();

  // Apply typography settings to CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--main-font-size', `${mainFontSize}px`);
    root.style.setProperty('--main-line-height', String(mainLineHeight));
  }, [mainFontSize, mainLineHeight]);
  const [restoring, setRestoring] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);

  // Initialize database and validate schema on mount
  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();
        setDbInitialized(true);
      } catch (error) {
        console.error('Failed to initialize database:', error);
        addToast({
          type: 'error',
          message: 'Failed to initialize database',
        });
      }
    };
    init();
  }, [addToast]);

  // Load scripts after database is initialized
  useEffect(() => {
    if (dbInitialized) {
      loadScripts();
    }
  }, [dbInitialized, loadScripts]);

  // Check for API key on mount
  useEffect(() => {
    const apiKey = getStoredApiKey();
    if (!apiKey) {
      // Show a gentle reminder after a short delay
      const timer = setTimeout(() => {
        addToast({
          type: 'info',
          message: 'Add your OpenAI API key to enable generation',
          duration: 6000,
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [addToast]);

  // Còpies automàtiques al GitHub mentre l'app és oberta
  useEffect(() => {
    if (!dbInitialized) return;
    return startAutoBackup(message =>
      addToast({ type: 'warning', message: `Còpia automàtica fallida: ${message}` }),
    );
  }, [dbInitialized, addToast]);

  // Sincronització entre navegadors: en obrir l'app i cada cop que la pestanya
  // torna a primer pla, si al GitHub hi ha una còpia més nova es carrega sola.
  useEffect(() => {
    if (!dbInitialized) return;
    let lastCheck = 0;
    let cancelled = false;

    const check = async () => {
      if (Date.now() - lastCheck < 30_000) return; // no repetir a cada canvi de focus
      lastCheck = Date.now();
      try {
        const result = await syncWithRemote();
        if (cancelled) return;
        if (result === 'restored') {
          await loadScripts();
          addToast({ type: 'success', message: 'Actualitzat amb la còpia del GitHub' });
        } else if (result === 'conflict') {
          addToast({
            type: 'warning',
            duration: 10000,
            message:
              'Hi ha canvis aquí i una còpia més nova al GitHub. A Configuració: «Restaura» (guanya el GitHub) o «Fes còpia ara» (guanya aquest navegador).',
          });
        }
      } catch (e) {
        console.error('[backup] sincronització fallida:', e);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [dbInitialized, loadScripts, addToast]);

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const { scriptsImported } = await restoreFromGitHub();
      await loadScripts();
      addToast({
        type: 'success',
        message: `Còpia restaurada: ${scriptsImported} projecte${scriptsImported === 1 ? '' : 's'}`,
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: `No s'ha pogut restaurar: ${error instanceof Error ? error.message : 'error desconegut'}`,
      });
    } finally {
      setRestoring(false);
    }
  };

  if (!dbInitialized || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/40">
          {!dbInitialized ? 'Initializing...' : 'Loading...'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <LeftBar />
      <Sidebar />
      <Storyboard />
      <ApiKeyModal />
      <SettingsModal />
      <YTDescriptionModal />
      <ToastContainer />

      {/* Base de dades buida + còpia configurada al GitHub → oferir restaurar.
          És el camí d'un navegador nou (o del link de GitHub Pages). */}
      {scripts.length === 0 && !sidebarOpen && hasBackupConfig() && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-6 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-[400px] text-center text-white">
            <p className="text-sm leading-relaxed text-white/60 mb-5">
              Aquest navegador no té cap projecte, però hi ha una còpia de
              seguretat al GitHub.
            </p>
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="w-full max-w-[280px] px-4 py-2.5 bg-[var(--color-accent)] hover:bg-[#e89a3f] disabled:opacity-50 text-[#1a1a1a] rounded-lg shadow-lg font-medium text-sm"
            >
              {restoring ? 'Restaurant…' : 'Restaura els projectes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
