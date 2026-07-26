import { useLayoutEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { PenIcon, MenuIcon, GenerateIcon, LockedIcon, UnlockedIcon, ImportMenuIcon, ExportMenuIcon, YouTubeDescIcon } from '../Icons';
import { useScriptStore } from '../../stores/scriptStore';
import { useUIStore } from '../../stores/uiStore';
import { ABOUT_SPEED } from '../../constants';
import { resolveActiveCategory } from '../../utils/projectTemplate';
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
    activeCategoryId,
  } = useUIStore();

  const [generateMenuOpen, setGenerateMenuOpen] = useState(false);
  const [menuClosing, setMenuClosing] = useState(false);
  const [importing, setImporting] = useState(false);

  const titleAreaRef = useRef<HTMLDivElement>(null);
  const titleInnerRef = useRef<HTMLDivElement>(null);

  const closeMenu = () => {
    setMenuClosing(true);
    setTimeout(() => {
      setGenerateMenuOpen(false);
      setMenuClosing(false);
    }, 150);
  };

  const script = getActiveScript();
  const activeCategory = resolveActiveCategory(script?.categories, activeCategoryId);

  // Shrink the vertical title until it fits the height the bar has left. Vertical
  // text height scales with font-size, so one ratio pass lands it; below
  // MIN_TITLE_PX we stop shrinking and the area scrolls instead.
  useLayoutEffect(() => {
    const area = titleAreaRef.current;
    const inner = titleInnerRef.current;
    if (!area || !inner) return;

    const MIN_TITLE_PX = 11;

    const fit = () => {
      area.style.setProperty('--leftbar-title-fit', 'var(--leftbar-title-size)');
      delete area.dataset.clipped;

      const span = inner.querySelector('span');
      const available = area.clientHeight;
      if (!span || !available) return;

      const base = parseFloat(getComputedStyle(span).fontSize);
      const natural = inner.offsetHeight;
      if (!natural || natural <= available) return;

      // Ratio estimate, then trim by 1px for the margins that don't scale.
      let fitted = Math.max(MIN_TITLE_PX, Math.floor(base * (available / natural)));
      area.style.setProperty('--leftbar-title-fit', `${fitted}px`);
      while (fitted > MIN_TITLE_PX && inner.offsetHeight > available) {
        fitted -= 1;
        area.style.setProperty('--leftbar-title-fit', `${fitted}px`);
      }

      // Still too long even at the floor — fade the cut edge so it reads as
      // scrollable rather than broken.
      if (inner.offsetHeight > available) area.dataset.clipped = 'true';
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(area);
    return () => observer.disconnect();
  }, [script?.name, script?.titleJP, activeCategory?.name]);

  // Scenes of the active phase only — totals are per phase, like the board
  const activeScenes = script
    ? scenes.filter(s => s.scriptId === script.id && s.categoryId === activeCategory?.id)
    : [];

  const categoryOrder = activeCategory?.sceneOrder ?? [];

  const totalRuntime = script
    ? calculateTotalRuntime(activeScenes, categoryOrder)
    : 0;

  // Architecture phases count hours: locked columns are hours already spent
  const isArchitecture = activeCategory?.kind === 'architecture';
  const totalHours = activeScenes.reduce((sum, s) => sum + s.durationSec, 0);
  const spentHours = activeScenes.reduce((sum, s) => sum + (s.isFixed ? s.durationSec : 0), 0);

  const handleBatchGenerate = async (mode: 'all-unlocked' | 'missing-or-outdated') => {
    if (!script || isGenerating) return;

    const scenesToGenerate = getScenesForGeneration(
      activeScenes,
      categoryOrder,
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
    <div className={`left-bar fixed left-0 top-0 bg-[var(--color-black)] border-r border-[#383838] z-30 flex flex-col ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarClosing ? 'sidebar-closing' : ''}`}>
      {/* ── Upper part — aligned to scene columns ── */}
      <div
        className="flex flex-col items-center w-full shrink-0"
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
                {isArchitecture ? `${spentHours}/${totalHours}h` : formatDuration(totalRuntime)}
              </button>
            </div>
          )}

          {/* 40px gap — matches column spacing between duration and title */}
          <div className="h-[40px]" />
        </div>
      </div>

      {/* ── Vertical script title ──
          Takes the leftover height and scrolls on its own. Long titles on short
          screens used to grow the bar past the viewport and push the burger
          below the fold; now they clip here instead. */}
      <div
        ref={titleAreaRef}
        className="left-bar-title-area flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden"
        style={{
          opacity: aboutContentVisible ? 1 : 0,
          transition: `opacity ${0.3 / ABOUT_SPEED}s ease`,
          pointerEvents: aboutContentVisible ? 'auto' : 'none',
        }}
      >
        <div
          ref={titleInnerRef}
          style={{
            opacity: pendingScriptSwitch ? 0 : 1,
            transition: 'opacity 0.25s ease',
          }}
        >
          {script && (
            <div className="w-full flex flex-col items-center gap-[16px]">
              <span
                className="text-white uppercase whitespace-nowrap origin-center"
                style={{
                  fontFamily: 'var(--font-headline)',
                  fontSize: 'var(--leftbar-title-fit, var(--leftbar-title-size))',
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  marginTop: '12px',
                }}
              >
                {script.name}
              </span>
              {activeCategory && (
                <span
                  className="uppercase whitespace-nowrap origin-center"
                  style={{
                    fontFamily: 'var(--font-headline)',
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    color: 'var(--color-accent)',
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                  }}
                >
                  {activeCategory.name}
                </span>
              )}
              {script.titleJP && (
                <span
                  className="text-[var(--color-accent)]"
                  style={{
                    fontFamily: 'var(--font-body)',
                    writingMode: 'vertical-rl',
                    fontSize: 'var(--leftbar-title-fit, var(--leftbar-title-size))',
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
        className="left-bar-bottom-icons flex flex-col items-center gap-2 pb-4 shrink-0"
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
