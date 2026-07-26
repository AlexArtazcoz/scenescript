import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PenIcon, MenuIcon, GenerateIcon, LockedIcon, UnlockedIcon, ImportMenuIcon, ExportMenuIcon, YouTubeDescIcon } from '../Icons';
import { useScriptStore } from '../../stores/scriptStore';
import { useUIStore } from '../../stores/uiStore';
import { ABOUT_SPEED } from '../../constants';
import { calculateTotalRuntime, getScenesForGeneration } from '../../utils/sceneHelpers';
import { generateBatch } from '../../services/generation';
import { exportAllData, importAllData, downloadJson, pickAndReadJsonFile } from '../../services/db';

// Format seconds to MM:SS
function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function LeftBar() {
  const {
    scenes,
    getActiveScript,
    updateNarration,
    toggleFixed,
  } = useScriptStore();

  const {
    sidebarOpen,
    sidebarClosing,
    toggleSidebar,
    isGenerating,
    setGenerating,
    setGeneratingSceneIds,
    setGenerationProgress,
    pendingScriptSwitch,
    aboutAnimPhase,
    addToast,
    timelinePreviewActive,
    setTimelinePreviewActive,
    setYtDescModalOpen,
  } = useUIStore();

  const [generateMenuOpen, setGenerateMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [importing, setImporting] = useState(false);

  const closeMenu = () => {
    setMenuClosing(true);
    setTimeout(() => {
      setGenerateMenuOpen(false);
      setMenuClosing(false);
    }, 150);
  };

  const script = getActiveScript();

  const activeScenes = script
    ? scenes.filter(s => s.scriptId === script.id)
    : [];

  const totalRuntime = script
    ? calculateTotalRuntime(activeScenes, script.sceneOrder)
    : 0;

  const handleBatchGenerate = async (mode: 'all-unlocked' | 'missing-or-outdated') => {
    if (!script || isGenerating) return;

    const scenesToGenerate = getScenesForGeneration(
      activeScenes,
      script.sceneOrder,
      mode,
      script.paceWordsPerSec
    );

    if (scenesToGenerate.length === 0) {
      addToast({
        type: 'info',
        message: mode === 'all-unlocked'
          ? 'All scenes are locked'
          : 'No scenes need regeneration',
      });
      return;
    }

    setGenerating(true);
    closeMenu();

    try {
      const results = await generateBatch(
        scenesToGenerate,
        script,
        scenes,
        (sceneId, index, total) => {
          setGeneratingSceneIds([sceneId]);
          setGenerationProgress({ current: index + 1, total });
        },
        (result, index) => {
          if (result.success && result.narration) {
            const scene = scenesToGenerate[index];
            updateNarration(scene.id, result.narration, scene.currentDraftIndex);
          }
        }
      );

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      if (failCount === 0) {
        addToast({
          type: 'success',
          message: `Generated narration for ${successCount} scene${successCount !== 1 ? 's' : ''}`,
        });
      } else {
        addToast({
          type: 'warning',
          message: `Generated ${successCount}, failed ${failCount} scene${failCount !== 1 ? 's' : ''}`,
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        message: 'Batch generation failed',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateYTDescription = () => {
    if (!script) return;
    setYtDescModalOpen(true);
    closeMenu();
  };

  const handleLockAll = () => {
    activeScenes.filter(s => !s.isFixed).forEach(s => toggleFixed(s.id));
    closeMenu();
  };

  const handleUnlockAll = () => {
    activeScenes.filter(s => s.isFixed).forEach(s => toggleFixed(s.id));
    closeMenu();
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      downloadJson(data);
      addToast({ type: 'success', message: `Exported ${data.scripts.length} script(s)` });
    } catch {
      addToast({ type: 'error', message: 'Export failed' });
    }
    closeMenu();
  };

  const handleImport = async () => {
    try {
      setImporting(true);
      const data = await pickAndReadJsonFile();
      const { loadScripts } = useScriptStore.getState();
      await importAllData(data, 'replace');
      await loadScripts();
      addToast({ type: 'success', message: 'Import successful' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg !== 'Cancelled') {
        addToast({ type: 'error', message: msg || 'Import failed' });
      }
    } finally {
      setImporting(false);
      closeMenu();
    }
  };

  // Fade sidebar content during about animation (bg stays visible)
  const aboutContentVisible = aboutAnimPhase === 'closed' || aboutAnimPhase === 'cols-hide' || aboutAnimPhase === 'close-cleanup';

  return (
    <div className={`left-bar fixed left-0 top-0 h-full w-[110px] bg-[var(--color-black)] border-r border-[#383838] z-30 flex flex-col justify-between ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarClosing ? 'sidebar-closing' : ''}`}>
      {/* ── Upper part — aligned to scene columns ── */}
      <div
        className="flex flex-col items-center w-full"
        style={{
          opacity: aboutContentVisible ? 1 : 0,
          transition: `opacity ${0.3 / ABOUT_SPEED}s ease`,
          pointerEvents: aboutContentVisible ? 'auto' : 'none',
        }}
      >

        {/* Top spacer — keeps the pen/runtime rows aligned with scene columns */}
        <div className="h-[80px]" />

        {/* Pen icon — 28×48, morphs on hover. Opens generate menu on click. */}
        <div
          className="relative flex items-center justify-center h-[48px]"
          style={{
            opacity: aboutAnimPhase === 'closed' ? 1 : 0,
            transition: 'none',
            pointerEvents: aboutAnimPhase === 'closed' ? 'auto' : 'none',
          }}
        >
          <button
            onClick={() => generateMenuOpen ? closeMenu() : setGenerateMenuOpen(true)}
            disabled={isGenerating || !script}
            className={`transition-colors ${
              isGenerating || !script
                ? 'text-white/20 cursor-not-allowed'
                : 'text-white hover:text-[var(--color-accent)]'
            }`}
            title="Generate narration"
          >
            {isGenerating ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <PenIcon forceHovered={generateMenuOpen} />
            )}
          </button>

          {/* Generate menu popout — squircle, 3 sections */}
          {generateMenuOpen && !isGenerating && (
            <div className={`generate-menu absolute left-full ml-2 top-0 z-50${menuClosing ? ' is-closing' : ''}`}>
              {/* Section 1: Generation */}
              <button
                onClick={() => script && handleBatchGenerate('all-unlocked')}
                disabled={!script}
                className="generate-menu-item disabled:opacity-40"
              >
                <GenerateIcon size={24} />
                Generate all unlocked
              </button>
              <button
                onClick={handleGenerateYTDescription}
                disabled={!script}
                className="generate-menu-item disabled:opacity-40"
              >
                <YouTubeDescIcon size={24} />
                Create YouTube Description
              </button>

              <div className="generate-menu-separator" />

              {/* Section 2: Locking */}
              <button
                onClick={handleUnlockAll}
                disabled={!script}
                className="generate-menu-item disabled:opacity-40"
              >
                <UnlockedIcon size={24} />
                Unlock all
              </button>
              <button
                onClick={handleLockAll}
                disabled={!script}
                className="generate-menu-item disabled:opacity-40"
              >
                <LockedIcon size={24} />
                Lock all
              </button>

              <div className="generate-menu-separator" />

              {/* Section 3: Import / Export */}
              <button onClick={handleImport} disabled={importing} className="generate-menu-item disabled:opacity-40">
                <ImportMenuIcon size={24} />
                Import
              </button>
              <button onClick={handleExport} className="generate-menu-item">
                <ExportMenuIcon size={24} />
                Export
              </button>
            </div>
          )}
        </div>

        {/* Gap to keep runtime row at exactly same position as before:
            original total = 80+50+64 = 194px; new = 60+48+gap = 194px → gap = 86px */}
        <div className="h-[66px]" />

        {/* Fadeable content — fades out during script switch, fades in after */}
        <div
          style={{
            opacity: pendingScriptSwitch ? 0 : 1,
            transition: 'opacity 0.25s ease',
          }}
        >
          {/* Total runtime — aligned with scene duration row */}
          {script && (
            <div className="flex justify-center relative w-full">
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  width: timelinePreviewActive ? '50%' : 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  height: 1,
                  background: 'var(--color-accent)',
                  opacity: timelinePreviewActive ? 1 : 0,
                  transition: `width 520ms cubic-bezier(0.22, 1, 0.36, 1) ${timelinePreviewActive ? 760 : 0}ms, opacity 180ms ease ${timelinePreviewActive ? 760 : 0}ms`,
                }}
              />
              <button
                onClick={() => setTimelinePreviewActive(!timelinePreviewActive)}
                className="subheading transition-all duration-200"
                style={{
                  color: timelinePreviewActive ? 'var(--color-accent)' : 'white',
                  border: `1px solid ${timelinePreviewActive ? 'var(--color-accent)' : 'rgba(255,255,255,0.35)'}`,
                  borderRadius: 10,
                  padding: '7px 12px',
                  lineHeight: 1,
                  background: timelinePreviewActive ? 'var(--color-black)' : 'transparent',
                  position: 'relative',
                  zIndex: 2,
                  cursor: 'pointer',
                }}
              >
                {formatDuration(totalRuntime)}
              </button>
            </div>
          )}

          {/* 40px gap — matches column spacing between duration and title */}
          <div className="h-[40px]" />

          {/* Vertical script title — top aligns with scene title in columns */}
          {script && (
            <div className="w-full flex flex-col items-center gap-[16px]">
              <span
                className="text-white text-[26px] uppercase whitespace-nowrap origin-center"
                style={{
                  fontFamily: 'var(--font-headline)',
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  marginTop: '12px',
                }}
              >
                {script.name}
              </span>
              {script.titleJP && (
                <span
                  className="text-[var(--color-accent)]"
                  style={{
                    fontFamily: 'var(--font-body)',
                    writingMode: 'vertical-rl',
                    fontSize: '26px',
                    letterSpacing: '0.1em',
                    lineHeight: '1',
                    marginTop: '16px'
                  }}
                >
                  {script.titleJP}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Lower part — bottom-aligned controls ── */}
      <div
        className="left-bar-bottom-icons flex flex-col items-center gap-2 pb-4"
        style={{
          opacity: aboutContentVisible ? 1 : 0,
          transition: `opacity ${0.3 / ABOUT_SPEED}s ease`,
          pointerEvents: aboutContentVisible ? 'auto' : 'none',
        }}
      >
        {/* Scripts panel toggle (burger) */}
        <button
          onClick={toggleSidebar}
          className={`p-2 transition-colors ${
            sidebarOpen
              ? 'text-[var(--color-accent)]'
              : 'text-[#9A9A9A] hover:text-[var(--color-accent)]'
          }`}
          title="Scripts"
        >
          <MenuIcon size={24} />
        </button>
      </div>

      {/* Click-outside to close generate menu */}
      {generateMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={closeMenu}
        />
      )}
    </div>
  );
}
