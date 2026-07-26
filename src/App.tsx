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
import { getStoredApiKey, clearAllData, initializeDatabase } from './services/db';
import { seedWithSampleNarrations } from './utils/seedData';

function App() {
  const { loadScripts, setActiveScript, scripts, isLoading } = useScriptStore();
  const { addToast, mainFontSize, mainLineHeight, setSidebarOpen, sidebarOpen } = useUIStore();

  // Apply typography settings to CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--main-font-size', `${mainFontSize}px`);
    root.style.setProperty('--main-line-height', String(mainLineHeight));
  }, [mainFontSize, mainLineHeight]);
  const [seeding, setSeeding] = useState(false);
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

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      // Clear existing data first to ensure fresh demo with all features
      await clearAllData();
      const { script } = await seedWithSampleNarrations();
      await loadScripts();
      await setActiveScript(script.id);
      addToast({
        type: 'success',
        message: 'Onboarding demo loaded — scroll through to learn the app',
      });
    } catch (error) {
      addToast({
        type: 'error',
        message: 'Failed to create demo script',
      });
    } finally {
      setSeeding(false);
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

      {/* Welcome / empty state — only when there are no scripts yet and the
          script panel is closed. Reopens once the panel is closed again. */}
      {scripts.length === 0 && !sidebarOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-6 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-[440px] text-center text-white">
            <h1 className="text-2xl font-semibold mb-3" style={{ fontFamily: 'var(--font-headline)' }}>
              SceneScript
            </h1>

            <p className="text-sm leading-relaxed text-white/60 mb-3">
              Heads up: this is an <span className="text-white/80">unfinished personal playground</span> I
              built for myself. There's no mobile version or responsive layout — it's best on a wide
              desktop screen, and rough edges are expected.
            </p>

            <p className="text-sm leading-relaxed text-white/60 mb-7">
              New here? The <span className="text-white/80">onboarding demo</span> is a sample script that
              doubles as a guided tour — scroll through its scenes to learn how every part of the app works.
            </p>

            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-full max-w-[280px] px-4 py-2.5 bg-[var(--color-accent)] hover:bg-[#e89a3f] text-[#1a1a1a] rounded-lg shadow-lg font-medium text-sm"
              >
                Open script panel
              </button>
              <button
                onClick={handleSeedData}
                disabled={seeding}
                className="w-full max-w-[280px] px-4 py-2.5 bg-transparent hover:bg-white/5 disabled:opacity-50 text-white/70 hover:text-white border border-white/15 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
              >
                {seeding ? (
                  <>
                    <span className="animate-spin">...</span>
                    Creating demo...
                  </>
                ) : (
                  <>Load onboarding demo</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
