import { useMemo, useEffect, useCallback, useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { FileText } from 'lucide-react';
import { NewSceneIcon } from './Icons';
import { SceneCard } from './SceneCard';
import { useScriptStore } from '../stores/scriptStore';
import { useUIStore } from '../stores/uiStore';
import { withComputed } from '../utils/sceneHelpers';
import { generateNarration } from '../services/generation';
import type { Scene } from '../types';

const COL_W = 324;
const COL_W_TIMELINE = 94;

function TimelineIllustration({ active, exiting }: { active: boolean; exiting: boolean }) {
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (!active && exiting) {
      // Stay fully visible, then fade out near the end
      const timer = setTimeout(() => setFadingOut(true), 400);
      return () => clearTimeout(timer);
    }
    setFadingOut(false);
  }, [active, exiting]);

  return (
    <div
      style={{
        flexShrink: 0,
        flex: 1,
        minWidth: active ? 862 : 0,
        height: '100%',
        opacity: fadingOut ? 0 : 1,
        transition: fadingOut ? 'opacity 0.35s ease' : 'none',
        pointerEvents: 'none',
      }}
    />
  );
}

export function Storyboard() {
  const {
    scenes,
    getActiveScript,
    setActiveScript,
    addScene,
    updateScene,
    reorderScenes,
    updateDraftContent,
    setCurrentDraftVersion,
    deleteDraftVersion,
    updateNarration,
    toggleFixed,
    toggleOnScreenText,
    updateOnScreenTextsFromText,
    updateReferencesFromText,
    addReference,
    updateReference,
    deleteReference,
    deleteScene,
    restoreScene,
    createNarrationVersion,
    setNarrationVersion,
    deleteNarrationVersion,
  } = useScriptStore();

  const {
    sidebarOpen,
    sidebarClosing,
    setSidebarOpen,
    generatingSceneIds,
    addGeneratingSceneId,
    removeGeneratingSceneId,
    pendingScriptSwitch,
    setPendingScriptSwitch,
    aboutAnimPhase,
    addToast,
    timelinePreviewActive,
  } = useUIStore();

  const script = getActiveScript();
  const scripts = useScriptStore(state => state.scripts);

  // ── Script-switch animation ──
  // 1. Drawer closes + LeftBar title/duration fades out (both driven by pendingScriptSwitch)
  // 2. After 300ms (drawer close), switch the actual script
  // 3. New columns mount with staggered entrance animation
  useEffect(() => {
    if (!pendingScriptSwitch) return;
    const targetId = pendingScriptSwitch;

    const timer = setTimeout(() => {
      // Clear pending and switch — React batches both updates so
      // orderedScenes becomes [] before showScenes becomes true
      setPendingScriptSwitch(null);
      setActiveScript(targetId);
    }, 450); // wait for drawer close (250ms) + a beat for title to settle

    return () => clearTimeout(timer);
  }, [pendingScriptSwitch, setActiveScript, setPendingScriptSwitch]);

  // Close sidebar on Esc
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }
    },
    [sidebarOpen, setSidebarOpen]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Close sidebar when clicking the dimmed scene area
  const handleSceneAreaClick = () => {
    if (sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const mainContentRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [snappedIndex, setSnappedIndex] = useState(0);

  // Keep timeline illustration visible during the exit animation
  const [timelineExiting, setTimelineExiting] = useState(false);
  const prevTimelineRef = useRef(timelinePreviewActive);
  const timelineExitTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timelineExitTimerRef.current), []);

  // Get ordered scenes with computed properties
  const orderedScenes = useMemo(() => {
    if (!script) return [];
    return script.sceneOrder
      .map(id => scenes.find(s => s.id === id))
      .filter((s): s is Scene => s !== undefined)
      .map(scene => withComputed(scene, script.paceWordsPerSec));
  }, [script, scenes]);

  // Detect reading mode: all scenes are locked
  const isReadingMode = orderedScenes.length > 0 && orderedScenes.every(s => s.isFixed);

  // Reset scroll position when entering reading mode
  useEffect(() => {
    if (isReadingMode && mainContentRef.current) {
      setSnappedIndex(0);
      mainContentRef.current.scrollTo({ left: 0 });
    }
  }, [isReadingMode]);

  // Reading mode: programmatic segmented scrolling.
  // Intercept wheel events and scroll exactly one column per gesture.
  const scrollingRef = useRef(false);

  useEffect(() => {
    if (!isReadingMode || !mainContentRef.current) return;
    const scrollEl = mainContentRef.current;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (scrollingRef.current) return;

      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) < 5) return;

      const dir = delta > 0 ? 1 : -1;
      const nextIdx = Math.max(0, Math.min(orderedScenes.length - 1, snappedIndex + dir));
      if (nextIdx === snappedIndex) return;

      // flushSync: force React to synchronously update the DOM with the new snappedIndex
      // before the scroll starts. Since width transitions are instant in reading mode,
      // the layout is immediately at its final state and nextIdx * COL_W is the correct target.
      flushSync(() => {
        setSnappedIndex(nextIdx);
      });
      scrollingRef.current = true;

      const targetLeft = nextIdx * COL_W;
      scrollEl.scrollTo({ left: targetLeft, behavior: 'smooth' });

      setTimeout(() => { scrollingRef.current = false; }, 800);
    };

    scrollEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => scrollEl.removeEventListener('wheel', handleWheel);
  }, [isReadingMode, snappedIndex, orderedScenes.length]);

  // ── Drop landing: FLIP animation ──
  // Ref map for SceneCard DOM elements
  const columnRefMap = useRef(new Map<string, HTMLDivElement>());
  const registerColumnRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) columnRefMap.current.set(id, el);
    else columnRefMap.current.delete(id);
  }, []);

  // SceneCard reports its dnd-kit transform on every render during drag.
  // By the time handleDragEnd fires, dnd-kit has already reset transforms
  // (via flushSync), so we MUST capture the last known value before that.
  const dragTransformMap = useRef(new Map<string, { x: number; y: number }>());
  // Track which column is currently being dragged (for slot border)
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const reportDragTransform = useCallback((id: string, x: number, y: number) => {
    dragTransformMap.current.set(id, { x, y });
    setActiveDragId(prev => prev === id ? prev : id);
  }, []);

  // Shared helper: animate a column from its mid-air position to its slot
  const animateColumnLanding = (targetId: string, dx: number, dy: number) => {
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
    requestAnimationFrame(() => {
      const el = columnRefMap.current.get(targetId);
      if (!el) return;

      el.style.transform = `translate(${dx}px, ${dy}px)`;
      el.style.transition = 'none';
      el.style.zIndex = '10';

      void el.offsetHeight; // force reflow

      el.style.transition = 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transform = 'translate(0, 0)';

      const cleanup = () => {
        el.style.transform = '';
        el.style.transition = '';
        el.style.zIndex = '';
      };
      el.addEventListener('transitionend', cleanup, { once: true });
      setTimeout(cleanup, 450);
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    // Read and clear the last known transform for this drag
    const lastTransform = dragTransformMap.current.get(active.id as string) ?? { x: 0, y: 0 };
    dragTransformMap.current.clear();
    const targetId = active.id as string;

    // Return to origin (no reorder) — animate back from mid-air
    if (!script || !over || active.id === over.id) {
      animateColumnLanding(targetId, lastTransform.x, lastTransform.y);
      return;
    }

    const oldIndex = script.sceneOrder.indexOf(targetId);
    const newIndex = script.sceneOrder.indexOf(over.id as string);

    if (oldIndex !== -1 && newIndex !== -1) {
      const columnWidth = COL_W;
      const dx = lastTransform.x - (newIndex - oldIndex) * columnWidth;

      const newOrder = [...script.sceneOrder];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, targetId);
      reorderScenes(script.id, newOrder);

      animateColumnLanding(targetId, dx, lastTransform.y);
    }
  };

  const handleAddScene = async () => {
    if (!script) return;
    await addScene(script.id);
  };

  const [revealingSceneId, setRevealingSceneId] = useState<string | null>(null);
  const [externalHoverId, setExternalHoverId] = useState<string | null>(null);
  const [deletingSceneId, setDeletingSceneId] = useState<string | null>(null);
  const TIMELINE_STAGGER_MS = 85;
  // Line starts at the left edge of the first chip (left: 0) and ends at the center of the last chip.
  // Last chip center = (n-1)*COL_W_TIMELINE + COL_W_TIMELINE/2.
  const fullTimelineLineWidth = Math.max(0, (orderedScenes.length - 1) * COL_W_TIMELINE + COL_W_TIMELINE / 2);
  const timelineLineLeft = 0;
  // Chip subheading: font-size 10px + padding 7px top/bottom + 1px border top/bottom → height ~26px.
  // Chip top = TIMELINE_TIME_TOP = 194. Center = 194 + 13 = 207.
  const timelineLineTop = 207;
  // Start line at the same moment chips begin appearing (860ms layout switch).
  // Duration: grow at the same pace as the stagger so the tip reaches each chip as it appears.
  const timelineLineDelay = timelinePreviewActive ? 860 : 0;
  const timelineLineDuration = Math.max(300, Math.round(fullTimelineLineWidth * TIMELINE_STAGGER_MS / COL_W_TIMELINE));

  // Timeline exit: keep illustration visible while columns animate back
  useEffect(() => {
    if (prevTimelineRef.current && !timelinePreviewActive) {
      setTimelineExiting(true);
      clearTimeout(timelineExitTimerRef.current);
      const exitDuration = 700 + orderedScenes.length * TIMELINE_STAGGER_MS + 100;
      timelineExitTimerRef.current = setTimeout(() => setTimelineExiting(false), exitDuration);
    }
    prevTimelineRef.current = timelinePreviewActive;
  }, [timelinePreviewActive, orderedScenes.length, TIMELINE_STAGGER_MS]);

  const handleInsertSceneAfter = useCallback(async (afterSceneId: string) => {
    if (!script) return;
    // Pre-generate the ID and mark it as revealing BEFORE the scene
    // enters the store — this guarantees the SceneCard's first render
    // already has isRevealing=true (width: 0 + expand animation).
    const preId = crypto.randomUUID();
    setRevealingSceneId(preId);
    await addScene(script.id, afterSceneId, preId);
    setTimeout(() => setRevealingSceneId(null), 1100);
  }, [script, addScene]);

  const handleDeleteScene = useCallback((sceneId: string) => {
    if (deletingSceneId) return;
    // Stash scene data + its left neighbour for undo restoration
    const scene = scenes.find(s => s.id === sceneId);
    const sceneOrder = script?.sceneOrder ?? [];
    const idx = sceneOrder.indexOf(sceneId);
    const afterId = idx > 0 ? sceneOrder[idx - 1] : undefined;
    const stashed = scene ? structuredClone(scene) : null;

    setDeletingSceneId(sceneId);
    setTimeout(() => {
      deleteScene(sceneId);
      setDeletingSceneId(null);

      if (stashed) {
        addToast({
          type: 'info',
          message: `Deleted "${stashed.title}"`,
          duration: 8000,
          action: {
            label: 'Undo',
            onClick: () => restoreScene(stashed, afterId),
          },
        });
      }
    }, 750);
  }, [deletingSceneId, deleteScene, scenes, script, addToast, restoreScene]);

  const handleNarrationEdit = useCallback((sceneId: string, narration: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || scene.isFixed) return;

    const versions = scene.narrationVersions ?? [];
    const idx = scene.currentNarrationVersionIndex;
    if (idx >= 0 && idx < versions.length) {
      const updated = versions.map((v, i) =>
        i === idx ? { ...v, content: narration, wordCount: narration.split(/\s+/).filter(Boolean).length } : v
      );
      updateScene(sceneId, { narration, narrationVersions: updated });
    } else {
      updateScene(sceneId, { narration });
    }
  }, [scenes, updateScene]);

  const handleGenerateScene = async (sceneId: string) => {
    if (!script) return;
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene || scene.isFixed) return;

    addGeneratingSceneId(sceneId);

    try {
      const result = await generateNarration(scene, script, scenes);

      if (result.success && result.narration) {
        updateNarration(sceneId, result.narration, scene.currentDraftIndex);
        addToast({
          type: 'success',
          message: `Generated narration for "${scene.title}"`,
        });
      } else {
        addToast({
          type: 'error',
          message: result.error ?? 'Generation failed',
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        message: 'Generation failed',
      });
    } finally {
      removeGeneratingSceneId(sceneId);
    }
  };

  if (!script) {
    // When there are no scripts at all, App renders the welcome overlay on its
    // black background. Render nothing here so the white main-content surface
    // doesn't cover that overlay (its text is white and would be invisible).
    if (scripts.length === 0) {
      return null;
    }

    return (
      <div
        className={`main-content ${sidebarOpen ? 'sidebar-open' : ''} flex items-center justify-center`}
        onClick={handleSceneAreaClick}
      >
        <div className="text-center" onClick={e => e.stopPropagation()}>
          <FileText size={48} className="mx-auto opacity-20 mb-4" />
          <h2 className="text-xl font-medium opacity-60 mb-2">
            No Script Selected
          </h2>
          <p className="opacity-40 mb-4">
            Select a script from the sidebar or create a new one
          </p>
          <button
            onClick={() => setSidebarOpen(true)}
            className="px-4 py-2 text-sm border border-current opacity-40 hover:opacity-100 rounded transition-opacity"
          >
            Open Scripts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mainContentRef}
      className={`main-content ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarClosing ? 'sidebar-closing' : ''} ${isReadingMode ? 'reading-mode' : ''}`}
      onClick={handleSceneAreaClick}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedScenes.map(s => s.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div
            ref={scrollContainerRef}
            className="flex h-full scene-scroll-container"
            style={{
              position: 'relative',
              opacity: pendingScriptSwitch ? 0 : 1,
              transition: pendingScriptSwitch ? 'opacity 0.15s ease' : 'none',
              pointerEvents: pendingScriptSwitch ? 'none' : 'auto',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: timelineLineLeft,
                top: timelineLineTop,
                width: timelinePreviewActive ? fullTimelineLineWidth : 0,
                height: 1,
                background: 'var(--color-accent)',
                opacity: timelinePreviewActive ? 1 : 0,
                transition: `width ${timelineLineDuration}ms cubic-bezier(0.22, 1, 0.36, 1) ${timelineLineDelay}ms, opacity 180ms ease ${timelineLineDelay}ms`,
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            {/* Timeline separators — absolutely positioned at fixed integer px positions.
                Fade in exactly when layout switches (860+k*stagger) so no gap/blink — the +50
                previously caused ~50ms with no borders between column border removal and overlay appear. */}
            {orderedScenes.slice(0, -1).map((scene, k) => (
              <div
                key={`tsep-${scene.id}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: (k + 1) * COL_W_TIMELINE,
                  width: 1,
                  background: scene.isFixed ? '#383838' : '#E6E6E6',
                  pointerEvents: 'none',
                  zIndex: 2,
                  opacity: timelinePreviewActive ? 1 : 0,
                  transition: timelinePreviewActive
                    ? `opacity 0.12s ease ${860 + k * TIMELINE_STAGGER_MS}ms`
                    : 'opacity 0.1s ease',
                }}
              />
            ))}
            {/* Right edge of last column — no overlay between columns, so render it explicitly */}
            {orderedScenes.length > 0 && (() => {
              const last = orderedScenes[orderedScenes.length - 1];
              return (
                <div
                  key="tsep-last"
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: orderedScenes.length * COL_W_TIMELINE,
                    width: 1,
                    background: last.isFixed ? '#383838' : '#E6E6E6',
                    pointerEvents: 'none',
                    zIndex: 2,
                    opacity: timelinePreviewActive ? 1 : 0,
                    transition: timelinePreviewActive
                      ? `opacity 0.12s ease ${860 + (orderedScenes.length - 1) * TIMELINE_STAGGER_MS}ms`
                      : 'opacity 0.1s ease',
                  }}
                />
              );
            })()}

            {orderedScenes.map((scene, index) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                index={index}
                timelinePreview={timelinePreviewActive}
                timelinePreviewDelayMs={index * TIMELINE_STAGGER_MS}
                totalScenes={orderedScenes.length}
                paceWordsPerSec={script.paceWordsPerSec}
                isGeneratingScene={generatingSceneIds.includes(scene.id)}
                registerRef={registerColumnRef}
                reportDragTransform={reportDragTransform}
                isReadingMode={isReadingMode}
                isSnapped={isReadingMode && index === snappedIndex}
                onUpdateTitle={title => updateScene(scene.id, { title })}
                onUpdateDuration={durationSec =>
                  updateScene(scene.id, { durationSec })
                }
                onUpdateDraftContent={content =>
                  updateDraftContent(scene.id, content)
                }
                onSelectDraftVersion={idx =>
                  setCurrentDraftVersion(scene.id, idx)
                }
                onDeleteDraft={idx =>
                  deleteDraftVersion(scene.id, idx)
                }
                onUpdateNarration={narration =>
                  handleNarrationEdit(scene.id, narration)
                }
                onCreateNarrationVersion={() =>
                  createNarrationVersion(scene.id)
                }
                onSetNarrationVersion={idx =>
                  setNarrationVersion(scene.id, idx)
                }
                onDeleteNarrationVersion={idx =>
                  deleteNarrationVersion(scene.id, idx)
                }
                onToggleFixed={() => toggleFixed(scene.id)}
                onGenerate={() => handleGenerateScene(scene.id)}
                onToggleOnScreenText={textId =>
                  toggleOnScreenText(scene.id, textId)
                }
                onUpdateOnScreenTextsText={text =>
                  updateOnScreenTextsFromText(scene.id, text)
                }
                onUpdateReferencesText={text =>
                  updateReferencesFromText(scene.id, text)
                }
                onAddReference={(ref) => addReference(scene.id, { ...ref, note: '' })}
                onUpdateReference={(refId, updates) => updateReference(scene.id, refId, updates)}
                onDeleteReference={(refId) => deleteReference(scene.id, refId)}
                onDeleteScene={() => handleDeleteScene(scene.id)}
                isRevealing={revealingSceneId === scene.id}
                externalHovered={externalHoverId === scene.id}
                isDeleting={deletingSceneId === scene.id}
              />
            ))}

            {/* Insert scene triggers — positioned on each column's right border */}
            {!timelinePreviewActive && orderedScenes.map((scene, idx) => (
              <InsertSceneTrigger
                key={`ins-${scene.id}`}
                left={(idx + 1) * COL_W}
                isLocked={scene.isFixed}
                onInsert={() => handleInsertSceneAfter(scene.id)}
                onHoverChange={h => setExternalHoverId(h ? scene.id : null)}
              />
            ))}

            {/* Static border at the dragged column's slot */}
            {activeDragId && (() => {
              const dragIdx = orderedScenes.findIndex(s => s.id === activeDragId);
              if (dragIdx === -1) return null;
              return (
                <div
                  style={{
                    position: 'absolute',
                    left: (dragIdx + 1) * COL_W,
                    top: 0,
                    bottom: 0,
                    width: 0,
                    borderRight: '0.5px solid #E6E6E6',
                    pointerEvents: 'none',
                    zIndex: 0,
                  }}
                />
              );
            })()}

            {/* Reading mode trailing area */}
            {isReadingMode && (
              <div
                style={{
                  flexShrink: 0,
                  width: 'calc(100vw - 110px - 437px)',
                  minWidth: 862,
                  height: '100%',
                }}
              />
            )}

            {/* Timeline mode trailing area with illustration — stays visible during exit animation */}
            {(timelinePreviewActive || timelineExiting) && (
              <TimelineIllustration active={timelinePreviewActive} exiting={timelineExiting} />
            )}

            {/* Add Scene Button — only when not in reading mode and not in about animation */}
            {!isReadingMode && aboutAnimPhase === 'closed' && !timelinePreviewActive && !timelineExiting && (
              <div style={{ width: COL_W }} className="flex-shrink-0 px-[40px] pt-[20px] pb-[20px] h-full flex flex-col">
                <button
                  onClick={handleAddScene}
                  className="mt-[60px] h-[50px] flex items-center text-[var(--color-black)] hover:text-[var(--color-accent)] transition-colors"
                  title="Add scene"
                >
                  <NewSceneIcon size={50} />
                </button>
                <div className="flex-1" />
              </div>
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ─── Insert Scene Trigger ───────────────────────────────────────────
// Rendered as an absolute-positioned element on each column's right border.
// Visible when the parent column is hovered (or the trigger itself is hovered).

function InsertSceneTrigger({
  left,
  isLocked,
  onInsert,
  onHoverChange,
}: {
  left: number;
  isLocked: boolean;
  onInsert: () => void;
  onHoverChange: (h: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const lineUpRef = useRef<HTMLDivElement>(null);
  const lineDnRef = useRef<HTMLDivElement>(null);
  const yRef = useRef(105);

  const [hovered, setHovered] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  const linesVisible = btnHovered || clicked;
  const accent = 'var(--color-accent)';

  // Direct DOM updates — no React re-renders during mouse movement
  const updatePositions = useCallback((y: number) => {
    if (btnRef.current) btnRef.current.style.top = `${y - 10}px`;
    if (lineUpRef.current) lineUpRef.current.style.bottom = `calc(100% - ${y}px)`;
    if (lineDnRef.current) lineDnRef.current.style.top = `${y}px`;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (clicked || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    yRef.current = e.clientY - rect.top;
    updatePositions(yRef.current);
  }, [clicked, updatePositions]);

  const handleClick = useCallback(() => {
    if (clicked) return;
    setClicked(true);
    setTimeout(() => onInsert(), 350);
    setTimeout(() => {
      setClicked(false);
      setHovered(false);
      setBtnHovered(false);
    }, 500);
  }, [clicked, onInsert]);

  if (isLocked) return null;

  const y = yRef.current;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: left - 25,
        top: 0, bottom: 0,
        width: 50,
        zIndex: 30,
      }}
      onMouseEnter={() => { setHovered(true); onHoverChange(true); }}
      onMouseLeave={() => { setHovered(false); setBtnHovered(false); onHoverChange(false); }}
      onMouseMove={handleMouseMove}
    >
      {/* Upper line — grows from cursor upward */}
      <div ref={lineUpRef} style={{
        position: 'absolute',
        left: 24.5, width: 1,
        bottom: `calc(100% - ${y}px)`,
        height: clicked ? y : (linesVisible ? 44 : 0),
        background: accent,
        transition: `height ${clicked ? '0.3s' : '0.2s'} cubic-bezier(0.4, 0, 0.2, 1)`,
        pointerEvents: 'none',
      }} />

      {/* Lower line — grows from cursor downward */}
      <div ref={lineDnRef} style={{
        position: 'absolute',
        left: 24.5, width: 1,
        top: `${y}px`,
        height: clicked ? `calc(100% - ${y}px)` : (linesVisible ? 44 : 0),
        background: accent,
        transition: `height ${clicked ? '0.3s' : '0.2s'} cubic-bezier(0.4, 0, 0.2, 1)`,
        pointerEvents: 'none',
      }} />

      {/* Plus button — follows cursor via direct DOM updates */}
      <button
        ref={btnRef}
        onMouseEnter={() => setBtnHovered(true)}
        onMouseLeave={() => setBtnHovered(false)}
        onClick={handleClick}
        style={{
          position: 'absolute',
          left: 15, top: `${y - 10}px`,
          width: 20, height: 20,
          borderRadius: 4,
          background: accent,
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          opacity: hovered && !clicked ? 1 : 0,
          transition: 'opacity 200ms ease',
          pointerEvents: hovered && !clicked ? 'auto' : 'none',
          zIndex: 1,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="7.5" y="1" width="1" height="14" fill="white"/>
          <rect x="1" y="8.5" width="1" height="14" transform="rotate(-90 1 8.5)" fill="white"/>
        </svg>
      </button>
    </div>
  );
}
