import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Loader2 } from 'lucide-react';
import { DeleteIcon, GenerateIcon, DragIcon, LockedIcon, UnlockedIcon } from '../Icons';
import { useUIStore } from '../../stores/uiStore';
import { ABOUT_SPEED } from '../../constants';
import { countWords } from '../../utils/wordCount';
import type { SceneWithComputed } from '../../types';

/* Max number of characters allowed in a scene title. */
const TITLE_MAX_LENGTH = 8;

/* ── Local on-screen item (keeps a stable key for React reconciliation) ── */
interface LocalOnScreenItem {
  key: string;     // scene item id, or a temp id for newly created items
  text: string;
  sceneItemId?: string; // links back to scene.onScreenTexts[].id when available
}

/* ── Duration Scale (segmented control) ── */
const TICK_COUNT = 10; // 10 ticks at 5, 10, 15, …, 50
const TICK_GAP = 8;
const TICK_W = 1;
const TOTAL_SCALE_W = TICK_COUNT * TICK_W + (TICK_COUNT - 1) * TICK_GAP; // 82px

function DurationScale({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  // Use a ref instead of state so pointer-move checks the up-to-date value
  // synchronously (no async React batching that would drop drag frames).
  const draggingRef = useRef(false);

  const valueToX = (v: number) => {
    const clamped = Math.max(5, Math.min(50, v));
    return ((clamped - 5) / 45) * (TOTAL_SCALE_W - TICK_W);
  };

  const xToValue = (x: number) => {
    const ratio = Math.max(0, Math.min(1, x / (TOTAL_SCALE_W - TICK_W)));
    const raw = 5 + ratio * 45;
    return Math.round(raw / 5) * 5; // snap to 5s
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rect = trackRef.current!.getBoundingClientRect();
    onChange(xToValue(e.clientX - rect.left));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const rect = trackRef.current!.getBoundingClientRect();
    onChange(xToValue(e.clientX - rect.left));
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
  };

  return (
    <div
      ref={trackRef}
      className="duration-scale"
      style={{ width: TOTAL_SCALE_W }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {Array.from({ length: TICK_COUNT }, (_, i) => (
        <div key={i} className="duration-tick" />
      ))}
      <div
        className="duration-handle"
        style={{ left: valueToX(value) }}
      />
    </div>
  );
}

/* ── Column dimensions ── */
const COL_W = 324;
const COL_W_READING = 437;
const COL_W_TIMELINE = 94;
const TIMELINE_NUMBER_TOP = 80;
const TIMELINE_TIME_TOP = 194;
const TIMELINE_TITLE_TOP = 266;


const CARD_SHADOW_STYLE: React.CSSProperties = {
  boxShadow: '0 33px 69px 0 rgba(0,0,0,0.04), 0 13.787px 28.827px 0 rgba(0,0,0,0.03), 0 7.371px 15.412px 0 rgba(0,0,0,0.02), 0 4.132px 8.64px 0 rgba(0,0,0,0.02), 0 2.195px 4.589px 0 rgba(0,0,0,0.02), 0 0.913px 1.909px 0 rgba(0,0,0,0.01)',
};

/* ── Bordered card wrapper for inputs (duration, title, narration) ── */
function InputCard({ children, isLocked, show, borderOnly, style, onMouseEnter, onMouseLeave, cardRef, highlight, highlightBorderRadius }: {
  children: React.ReactNode;
  isLocked: boolean;
  show?: boolean;
  borderOnly?: boolean;
  style?: React.CSSProperties;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  cardRef?: React.Ref<HTMLDivElement>;
  highlight?: 'black' | 'accent' | 'white-outlined' | null;
  highlightBorderRadius?: string;
}) {
  const [selfHovered, setSelfHovered] = useState(false);
  const visible = show !== undefined ? show : (!isLocked && selfHovered);
  const hlActive = !!highlight;
  return (
    <div
      ref={cardRef}
      onMouseEnter={() => { setSelfHovered(true); onMouseEnter?.(); }}
      onMouseLeave={() => { setSelfHovered(false); onMouseLeave?.(); }}
      style={{
        border: hlActive ? '1px solid transparent' : (visible ? '1px solid rgba(0,0,0,0.1)' : '1px solid transparent'),
        borderRadius: hlActive && highlightBorderRadius ? highlightBorderRadius : 12,
        padding: 12,
        marginLeft: -12,
        marginRight: -12,
        background: hlActive
          ? (highlight === 'black' ? 'var(--color-black)' : highlight === 'white-outlined' ? 'white' : 'var(--color-accent)')
          : (visible && !borderOnly) ? 'white' : 'transparent',
        color: hlActive
          ? (highlight === 'black' ? 'white' : 'var(--color-black)')
          : undefined,
        boxShadow: highlight === 'white-outlined' ? '0 0 0 1px black' : 'none',
        transition: 'border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease, color 0.3s ease, border-radius 0.3s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ── Version Browser ── */

const VB_BTN: React.CSSProperties = {
  width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 20, border: 'none', background: 'white', cursor: 'pointer',
  ...CARD_SHADOW_STYLE,
};

function VersionBrowser({
  versions,
  currentIndex,
  onNavigate,
  onClose,
  onDelete,
  onCreateVersion,
  anchor,
}: {
  versions: { id: string; content: string; wordCount: number; createdAt: number }[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onClose: () => void;
  onDelete: (index: number) => void;
  onCreateVersion: () => void;
  anchor: { left: number; top: number; width: number; height: number } | null;
}) {
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const [measuredH, setMeasuredH] = useState<Record<number, number>>({});

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const navigate = useCallback((dir: -1 | 1) => {
    const next = Math.max(0, Math.min(versions.length - 1, currentIndex + dir));
    if (next !== currentIndex) onNavigate(next);
  }, [versions.length, currentIndex, onNavigate]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => onClose(), 350);
  }, [onClose]);

  const measureRef = useCallback((idx: number, el: HTMLDivElement | null) => {
    if (!el) return;
    const h = el.offsetHeight;
    setMeasuredH(prev => (prev[idx] === h ? prev : { ...prev, [idx]: h }));
  }, []);

  if (!anchor) return null;

  const cardW = anchor.width;
  const cardLeft = anchor.left;
  const CONTROLS_H = 52;
  const GAP = 12;
  const ANIM = '0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';

  const activeCardTop = anchor.top;
  const activeCardH = measuredH[currentIndex] ?? anchor.height;
  const controlsTop = Math.max(8, activeCardTop - GAP - CONTROLS_H);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        background: 'transparent',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {/* Controls */}
      <div style={{
        position: 'absolute',
        left: cardLeft, top: controlsTop, width: cardW,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        zIndex: 20,
        opacity: closing ? 0 : entered ? 1 : 0,
        transform: entered ? 'scale(1)' : 'scale(0.9)',
        transition: 'opacity 0.3s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}>
        <button onClick={() => onDelete(currentIndex)} style={VB_BTN}>
          <img src="/delete_thin.svg" alt="Delete" width={16} height={16} />
        </button>
        <div style={{
          display: 'flex', alignItems: 'center',
          borderRadius: 20, background: 'white', overflow: 'hidden',
          ...CARD_SHADOW_STYLE,
        }}>
          <button onClick={() => navigate(-1)} style={{ ...VB_BTN, paddingLeft: 16, paddingRight: 12, boxShadow: 'none' }}>
            <img src="/down_thin.svg" alt="Older" width={16} height={16} />
          </button>
          <div style={{ width: 1, height: 20, background: 'rgba(0,0,0,0.1)' }} />
          <button onClick={() => navigate(1)} style={{ ...VB_BTN, paddingLeft: 12, paddingRight: 16, boxShadow: 'none' }}>
            <img src="/up_thin.svg" alt="Newer" width={16} height={16} />
          </button>
        </div>
        <button onClick={onCreateVersion} style={VB_BTN}>
          <img src="/add_reference.svg" alt="New version" width={16} height={16} />
        </button>
      </div>

      {/* Full card stack — active card occupies the center slot */}
      {versions.map((v, i) => {
        const isActive = i === currentIndex;
        const dist = Math.abs(i - currentIndex);

        let cardTop: number;
        if (isActive) {
          cardTop = activeCardTop;
        } else if (i < currentIndex) {
          let y = activeCardTop + activeCardH + GAP;
          for (let s = currentIndex - 1; s > i; s -= 1) {
            y += (measuredH[s] ?? anchor.height) + GAP;
          }
          cardTop = y;
        } else {
          let y = controlsTop - GAP - (measuredH[i] ?? anchor.height);
          for (let s = i - 1; s > currentIndex; s -= 1) {
            y -= (measuredH[s] ?? anchor.height) + GAP;
          }
          cardTop = y;
        }

        const rotation = isActive ? 0 : ((i - currentIndex) % 2 === 0 ? -1.5 : 1.5);

        return (
          <div
            key={v.id}
            ref={(el) => measureRef(i, el)}
            onClick={(e) => {
              e.stopPropagation();
              if (isActive) {
                handleClose();
                return;
              }
              onNavigate(i);
            }}
            style={{
              ...CARD_SHADOW_STYLE,
              position: 'absolute',
              left: cardLeft, top: cardTop, width: cardW,
              padding: 12, borderRadius: 12,
              background: 'white',
              border: isActive ? '1px solid black' : '0.5px solid rgba(0,0,0,0.08)',
              transform: entered
                ? `rotate(${rotation}deg) scale(1)`
                : `rotate(0deg) scale(0.92)`,
              opacity: closing ? (isActive ? 1 : 0) : entered ? 1 : 0,
              transition: `top ${ANIM}, transform ${ANIM}, opacity 0.3s ease ${entered ? '0s' : `${dist * 40}ms`}, border-color 0.2s ease`,
              cursor: isActive ? 'default' : 'pointer',
              zIndex: isActive ? 15 : 10 - dist,
              pointerEvents: closing ? 'none' : 'auto',
            }}
          >
            <textarea
              readOnly tabIndex={-1}
              ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
              className="w-full main-text auto-height-textarea"
              value={v.content} rows={1}
              style={{ resize: 'none', cursor: isActive ? 'text' : 'pointer', pointerEvents: 'none' }}
            />
          </div>
        );
      })}
    </div>
  );
}

interface SceneCardProps {
  scene: SceneWithComputed;
  index: number;
  timelinePreview?: boolean;
  timelinePreviewDelayMs?: number;
  paceWordsPerSec: number;
  isGeneratingScene: boolean;
  isReadingMode: boolean;
  isSnapped: boolean;
  onUpdateTitle: (title: string) => void;
  onUpdateDuration: (duration: number) => void;
  onUpdateDraftContent: (content: string) => void;
  onSelectDraftVersion: (index: number) => void;
  onDeleteDraft: (draftIndex: number) => void;
  onUpdateNarration: (narration: string) => void;
  onCreateNarrationVersion: () => void;
  onSetNarrationVersion: (index: number) => void;
  onDeleteNarrationVersion: (index: number) => void;
  onToggleFixed: () => void;
  onGenerate: () => void;
  onToggleOnScreenText: (textId: string) => void;
  onUpdateOnScreenTextsText: (text: string) => void;
  onUpdateReferencesText: (text: string) => void;
  onAddReference: (ref: { label: string; url: string; note: string }) => void;
  onUpdateReference: (refId: string, updates: { label?: string; url?: string }) => void;
  onDeleteReference: (refId: string) => void;
  onDeleteScene: () => void;
  registerRef?: (id: string, el: HTMLDivElement | null) => void;
  reportDragTransform?: (id: string, x: number, y: number) => void;
  totalScenes?: number;
  isRevealing?: boolean;
  externalHovered?: boolean;
  isDeleting?: boolean;
}

export function SceneCard({
  scene,
  index,
  timelinePreview = false,
  timelinePreviewDelayMs = 0,
  paceWordsPerSec,
  isGeneratingScene,
  isReadingMode: _isReadingMode,
  isSnapped,
  onUpdateTitle,
  onUpdateDuration,
  onUpdateDraftContent: _onUpdateDraftContent,
  onSelectDraftVersion: _onSelectDraftVersion,
  onDeleteDraft: _onDeleteDraft,
  onUpdateNarration,
  onCreateNarrationVersion,
  onSetNarrationVersion,
  onDeleteNarrationVersion,
  onToggleFixed,
  onGenerate,
  onToggleOnScreenText,
  onUpdateOnScreenTextsText,
  onUpdateReferencesText: _onUpdateReferencesText,
  onAddReference,
  onUpdateReference,
  onDeleteReference: _onDeleteReference,
  onDeleteScene,
  registerRef,
  reportDragTransform,
  totalScenes: _totalScenes = 1,
  isRevealing,
  externalHovered,
  isDeleting,
}: SceneCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { versionBrowsingSceneId, setVersionBrowsingSceneId, addToast } = useUIStore();
  const isVersionModal = versionBrowsingSceneId === scene.id;
  const otherVersionBrowsing = !!versionBrowsingSceneId && versionBrowsingSceneId !== scene.id;
  const effectiveHovered = otherVersionBrowsing ? false : (isHovered || !!externalHovered || isVersionModal);
  const contentRef = useRef<HTMLDivElement>(null);

  // Layout refs (used for positioning/measurement)
  const durationRowRef = useRef<HTMLDivElement>(null);
  const onScreenHeadingRef = useRef<HTMLDivElement>(null);
  const refsHeadingRef = useRef<HTMLDivElement>(null);
  const titleCardRef = useRef<HTMLDivElement>(null);
  const durationCardRef = useRef<HTMLDivElement>(null);

  // Delete animation: phase 1 = fade out, phase 2 = collapse width
  const [deletePhase, setDeletePhase] = useState(0);
  useEffect(() => {
    if (isDeleting && deletePhase === 0) {
      requestAnimationFrame(() => setDeletePhase(1));
      setTimeout(() => setDeletePhase(2), 350);
    }
  }, [isDeleting, deletePhase]);

  // Entrance animation guard: after initial mount animation, set animation: none
  // to prevent CSS re-trigger when React reorders DOM nodes during drag-drop
  const [hasEntered, setHasEntered] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setHasEntered(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // About-screen animation: columns exit/enter
  const aboutAnimPhase = useUIStore(s => s.aboutAnimPhase);
  const aboutExiting = aboutAnimPhase === 'cols-hide';
  const aboutHidden = aboutAnimPhase !== 'closed' && !aboutExiting && aboutAnimPhase !== 'close-cleanup';
  const aboutEntering = aboutAnimPhase === 'close-cleanup';
  const MAX_VISIBLE_COLS = 7;
  const aboutExitDelay = index < MAX_VISIBLE_COLS ? (MAX_VISIBLE_COLS - 1 - index) * 60 : 0;
  const aboutEnterDelay = index * 60;

  const [localDuration, setLocalDuration] = useState(scene.durationSec.toString());
  const [localTitle, setLocalTitle] = useState(scene.title);
  const [localNarration, setLocalNarration] = useState(scene.narration ?? '');
  const [localOnScreen, setLocalOnScreen] = useState<LocalOnScreenItem[]>([]);
  const [focusOnScreenIdx, setFocusOnScreenIdx] = useState<number | null>(null);
  const onScreenInputRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const onScreenCommitRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onScreenBlurRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isEditingOnScreen = useRef(false);
  let nextLocalKeyRef = useRef(0);
  // Per-reference inline editing: null = not editing, 'new' = adding, or ref id
  const [editingRefId, setEditingRefId] = useState<string | null>(null);
  const [refDialogClosing, setRefDialogClosing] = useState(false);
  const [editingRefLabel, setEditingRefLabel] = useState('');
  const [editingRefUrl, setEditingRefUrl] = useState('');
  const durationTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const titleWarnedAtRef = useRef(0);
  const narrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const narrationRef = useRef<HTMLTextAreaElement>(null);
  const _draftRef = useRef<HTMLTextAreaElement>(null);
  const refLabelInputRef = useRef<HTMLInputElement>(null);
  const refDialogRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: scene.id });

  const columnRef = useRef<HTMLDivElement | null>(null);
  // Combined ref: dnd-kit's setNodeRef + register with parent for FLIP
  const combinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      registerRef?.(scene.id, node);
      columnRef.current = node;
    },
    [setNodeRef, registerRef, scene.id],
  );

  // ── Drag physics: velocity-based inertia ──
  // Track smoothed velocity via exponential moving average (EMA).
  // Raw per-frame delta is tiny (~8px at 500px/s), so EMA accumulates
  // momentum and the higher factor (0.5) makes the rotation clearly visible.
  const prevDragX = useRef<number | null>(null);
  const smoothedVelocity = useRef(0);

  if (isDragging && transform) {
    if (prevDragX.current !== null) {
      const rawVelocity = transform.x - prevDragX.current;
      smoothedVelocity.current = smoothedVelocity.current * 0.65 + rawVelocity * 0.35;
    }
    prevDragX.current = transform.x;
    reportDragTransform?.(scene.id, transform.x, transform.y);
  } else {
    prevDragX.current = null;
    smoothedVelocity.current = 0;
  }

  // Pivot is top-right (drag handle). Positive velocity (drag right) →
  // positive rotation (clockwise around top-right) → bottom lags LEFT.
  const dragRotation = isDragging
    ? Math.max(-6, Math.min(6, smoothedVelocity.current * 0.5))
    : 0;

  // Spring easing for displaced columns
  const springTransition = !isDragging && transition
    ? transition.replace(/ease/g, 'cubic-bezier(0.34, 1.56, 0.64, 1)')
    : transition;

  // Layered drop shadow for dragged column
  const dragFilter = 'drop-shadow(0 0.498px 2.214px rgba(0,0,0,0.01)) drop-shadow(0 1.197px 5.32px rgba(0,0,0,0.02)) drop-shadow(0 2.254px 10.017px rgba(0,0,0,0.02)) drop-shadow(0 4.021px 17.869px rgba(0,0,0,0.02)) drop-shadow(0 7.52px 33.422px rgba(0,0,0,0.03)) drop-shadow(0 18px 80px rgba(0,0,0,0.04))';

  const style = {
    transform: CSS.Transform.toString(transform),
    ...(isDragging ? {
      zIndex: 10,
      background: 'var(--color-bg)',
      filter: dragFilter,
    } : {}),
  };

  const _currentDraft = scene.draftVersions[scene.currentDraftIndex];
  const isLocked = scene.isFixed;

  const narrationVersions = scene.narrationVersions ?? [];
  const versionCount = narrationVersions.length;
  const hasMultipleVersions = versionCount > 1;
  const versionBrowsing = isVersionModal;
  const [narrationFocused, setNarrationFocused] = useState(false);
  const [narrationHovered, setNarrationHovered] = useState(false);


  const [versionAnchor, setVersionAnchor] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const narrationCardRef = useRef<HTMLDivElement>(null);

  const enterVersionBrowsing = useCallback(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    requestAnimationFrame(() => {
      const narrationRect = narrationCardRef.current?.getBoundingClientRect() ?? null;
      const contentRect = contentRef.current?.getBoundingClientRect() ?? null;
      if (narrationRect && contentRect) {
        setVersionAnchor({
          left: narrationRect.left - contentRect.left,
          top: narrationRect.top - contentRect.top,
          width: narrationRect.width,
          height: narrationRect.height,
        });
      } else {
        setVersionAnchor(null);
      }
      setVersionBrowsingSceneId(scene.id);
    });
  }, [scene.id, setVersionBrowsingSceneId]);
  const exitVersionBrowsing = useCallback(() => {
    setVersionAnchor(null);
    setVersionBrowsingSceneId(null);
  }, [setVersionBrowsingSceneId]);

  // Sync local state
  useEffect(() => {
    setLocalDuration(scene.durationSec.toString());
  }, [scene.durationSec]);

  useEffect(() => {
    setLocalTitle(scene.title);
  }, [scene.title]);

  // Word-by-word reveal after generation completes
  const wasGenerating = useRef(false);
  const [revealWords, setRevealWords] = useState(-1); // -1 = show all, 0+ = reveal up to N words
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (isGeneratingScene) {
      wasGenerating.current = true;
    } else if (wasGenerating.current && scene.narration) {
      wasGenerating.current = false;
      const words = scene.narration.split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        setRevealWords(0);
        setLocalNarration(scene.narration);
        let i = 0;
        const tick = () => {
          i += 1;
          setRevealWords(i);
          if (i < words.length) {
            revealTimerRef.current = setTimeout(tick, 35);
          } else {
            revealTimerRef.current = setTimeout(() => setRevealWords(-1), 200);
          }
        };
        revealTimerRef.current = setTimeout(tick, 100);
        return () => clearTimeout(revealTimerRef.current);
      }
    }
  }, [isGeneratingScene, scene.narration]);

  useEffect(() => {
    if (revealWords < 0) setLocalNarration(scene.narration ?? '');
  }, [scene.narration, revealWords]);

  // Auto-resize textareas (defined early — used by multiple effects below)
  const autoResize = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }, []);

  // Sync on-screen items from scene (skip if actively editing to prevent focus loss)
  useEffect(() => {
    if (!isEditingOnScreen.current) {
      setLocalOnScreen(scene.onScreenTexts.map(item => ({
        key: item.id,
        text: item.text,
        sceneItemId: item.id,
      })));
    }
  }, [scene.onScreenTexts]);

  // Focus management for on-screen items
  useEffect(() => {
    if (focusOnScreenIdx !== null) {
      requestAnimationFrame(() => {
        const el = onScreenInputRefs.current[focusOnScreenIdx];
        if (el) {
          el.focus();
          const len = el.value.length;
          el.setSelectionRange(len, len);
          autoResize(el);
        }
      });
      setFocusOnScreenIdx(null);
    }
  }, [focusOnScreenIdx, localOnScreen, autoResize]);

  // Auto-resize all on-screen textareas when local state changes
  useEffect(() => {
    if (!isLocked) {
      onScreenInputRefs.current.forEach(el => autoResize(el));
    }
  }, [localOnScreen, isLocked, autoResize]);


  useEffect(() => {
    autoResize(narrationRef.current);
  }, [localNarration, revealWords, autoResize]);

  useEffect(() => {
    if (!timelinePreview) {
      requestAnimationFrame(() => autoResize(narrationRef.current));
    }
  }, [timelinePreview, autoResize]);

  useEffect(() => {
    autoResize(_draftRef.current);
  }, [_currentDraft?.content, isLocked, autoResize]);

  // Recalculate textarea heights after the expand animation (0.4s) finishes
  // but while the accent overlay still covers the content — so the correction
  // is invisible to the user.
  useEffect(() => {
    if (isRevealing) {
      const t = setTimeout(() => {
        autoResize(narrationRef.current);
        autoResize(_draftRef.current);
        onScreenInputRefs.current.forEach(el => autoResize(el));
      }, 450);
      return () => clearTimeout(t);
    }
  }, [isRevealing, autoResize]);


  const handleDurationChange = (value: string) => {
    setLocalDuration(value);
    if (durationTimeoutRef.current) clearTimeout(durationTimeoutRef.current);
    durationTimeoutRef.current = setTimeout(() => {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num > 0) onUpdateDuration(num);
    }, 300);
  };

  const [durationBounce, setDurationBounce] = useState(false);
  const durationBounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleScaleDurationChange = (value: number) => {
    setLocalDuration(value.toString());
    onUpdateDuration(value);
    // Trigger bounce animation on the duration number
    setDurationBounce(true);
    if (durationBounceRef.current) clearTimeout(durationBounceRef.current);
    durationBounceRef.current = setTimeout(() => setDurationBounce(false), 300);
  };

  const handleTitleChange = (value: string) => {
    if (value.length > TITLE_MAX_LENGTH) {
      if (Date.now() - titleWarnedAtRef.current > 2000) {
        addToast({ type: 'warning', message: `Title is limited to ${TITLE_MAX_LENGTH} characters` });
        titleWarnedAtRef.current = Date.now();
      }
      value = value.slice(0, TITLE_MAX_LENGTH);
    }
    setLocalTitle(value);
    if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
    titleTimeoutRef.current = setTimeout(() => onUpdateTitle(value), 300);
  };

  const handleNarrationChange = (value: string) => {
    setLocalNarration(value);
    if (narrationTimeoutRef.current) clearTimeout(narrationTimeoutRef.current);
    narrationTimeoutRef.current = setTimeout(() => onUpdateNarration(value), 300);
  };

  const speakingTimeSec = useMemo(() => {
    const words = countWords(localNarration);
    if (words === 0 || paceWordsPerSec === 0) return 0;
    return Math.round(words / paceWordsPerSec);
  }, [localNarration, paceWordsPerSec]);

  // Scene items lookup by id (for checked state)
  const sceneItemsById = useMemo(() => {
    return new Map(scene.onScreenTexts.map(item => [item.id, item]));
  }, [scene.onScreenTexts]);

  // On-screen checklist handlers
  const commitOnScreen = useCallback((items: LocalOnScreenItem[]) => {
    // Only commit non-empty items (empty items are local-only placeholders)
    const text = items.filter(item => item.text.trim()).map(item => item.text).join('\n');
    onUpdateOnScreenTextsText(text);
  }, [onUpdateOnScreenTextsText]);

  const handleOnScreenFocus = () => {
    if (onScreenBlurRef.current) clearTimeout(onScreenBlurRef.current);
    isEditingOnScreen.current = true;
  };

  const handleOnScreenBlur = () => {
    if (onScreenBlurRef.current) clearTimeout(onScreenBlurRef.current);
    onScreenBlurRef.current = setTimeout(() => {
      isEditingOnScreen.current = false;
      // Final commit — remove empty trailing items
      commitOnScreen(localOnScreen);
    }, 150);
  };

  const handleOnScreenItemChange = (idx: number, value: string) => {
    const newItems = [...localOnScreen];
    newItems[idx] = { ...newItems[idx], text: value };
    setLocalOnScreen(newItems);
    if (onScreenCommitRef.current) clearTimeout(onScreenCommitRef.current);
    onScreenCommitRef.current = setTimeout(() => commitOnScreen(newItems), 300);
  };

  const handleOnScreenKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newItem: LocalOnScreenItem = {
        key: `local-${nextLocalKeyRef.current++}`,
        text: '',
      };
      const newItems = [...localOnScreen];
      newItems.splice(idx + 1, 0, newItem);
      setLocalOnScreen(newItems);
      setFocusOnScreenIdx(idx + 1);
      // Don't commit — empty item would be filtered out by the store
    } else if (e.key === 'Backspace' && localOnScreen[idx].text === '') {
      e.preventDefault();
      if (localOnScreen.length <= 1) return; // keep at least one
      const newItems = localOnScreen.filter((_: LocalOnScreenItem, i: number) => i !== idx);
      setLocalOnScreen(newItems);
      commitOnScreen(newItems);
      if (idx > 0) setFocusOnScreenIdx(idx - 1);
    }
  };

  const handleAddOnScreenItem = () => {
    isEditingOnScreen.current = true;
    const newItem: LocalOnScreenItem = {
      key: `local-${nextLocalKeyRef.current++}`,
      text: '',
    };
    const newItems = [...localOnScreen, newItem];
    setLocalOnScreen(newItems);
    setFocusOnScreenIdx(newItems.length - 1);
    // Don't commit — empty item
  };

  const startEditRef = (ref: { id: string; label: string; url: string }) => {
    setEditingRefId(ref.id);
    setEditingRefLabel(ref.label);
    setEditingRefUrl(ref.url);
  };

  const startAddRef = () => {
    setEditingRefId('new');
    setEditingRefLabel('');
    setEditingRefUrl('');
  };

  const closeRefDialogAnimated = useCallback(() => {
    setRefDialogClosing(true);
    setTimeout(() => {
      setEditingRefId(null);
      setRefDialogClosing(false);
    }, 200);
  }, []);

  const saveRefEdit = useCallback(() => {
    if (!editingRefId) return;
    if (editingRefId === 'new') {
      if (editingRefLabel.trim() || editingRefUrl.trim()) {
        onAddReference({ label: editingRefLabel.trim(), url: editingRefUrl.trim(), note: '' });
      }
    } else {
      onUpdateReference(editingRefId, { label: editingRefLabel, url: editingRefUrl });
    }
    closeRefDialogAnimated();
  }, [editingRefId, editingRefLabel, editingRefUrl, onAddReference, onUpdateReference, closeRefDialogAnimated]);

  // Click outside reference dialog to close
  useEffect(() => {
    if (!editingRefId) return;
    const handler = (e: MouseEvent) => {
      if (refDialogRef.current && !refDialogRef.current.contains(e.target as Node)) {
        saveRefEdit();
      }
    };
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', handler); };
  }, [editingRefId, saveRefEdit]);

  // Scene number — slide-through-clipping-frame animation on change.
  // Increasing (insert): old slides down, new slides in from above.
  // Decreasing (delete): old slides up, new slides in from below.
  // Staggered: closest column to the change point animates first.
  const sceneNumber = (index + 1).toString();
  const prevNumberRef = useRef(sceneNumber);
  const prevIndexRef = useRef(index);
  const [displayNumber, setDisplayNumber] = useState(sceneNumber);
  const [numberAnim, setNumberAnim] = useState<'idle' | 'out' | 'in'>('idle');
  const [numberDirection, setNumberDirection] = useState<'up' | 'down'>('up');

  useEffect(() => {
    if (sceneNumber !== prevNumberRef.current) {
      const oldNum = parseInt(prevNumberRef.current, 10);
      const newNum = parseInt(sceneNumber, 10);
      const dir = newNum > oldNum ? 'up' : 'down';
      prevNumberRef.current = sceneNumber;

      // Stagger: columns further from the change point wait longer.
      // For insertion the change point is at prevIndex; for deletion at index.
      const staggerMs = Math.abs(index - prevIndexRef.current) * 50;
      prevIndexRef.current = index;

      const delay = setTimeout(() => {
        setNumberDirection(dir);
        setNumberAnim('out');
        setTimeout(() => {
          setDisplayNumber(sceneNumber);
          setNumberAnim('in');
          setTimeout(() => setNumberAnim('idle'), 250);
        }, 200);
      }, 400 + staggerMs);
      return () => clearTimeout(delay);
    }
    prevIndexRef.current = index;
  }, [sceneNumber, index]);

  // Empty checks for locked hide
  const hasNarration = !!localNarration.trim();
  const hasOnScreen = scene.onScreenTexts.length > 0;
  const hasReferences = scene.references.length > 0;

  const columnWidth = isSnapped ? COL_W_READING : COL_W;

  // Reading-mode narration enlargement: three-phase animation
  // 'normal' → 'fading' (opacity 0, 200ms) → 'enlarged' (larger font, opacity 1)
  const [snappedPhase, setSnappedPhase] = useState<'normal' | 'fading' | 'enlarged'>(
    isSnapped ? 'enlarged' : 'normal',
  );
  const snappedPhaseTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prevIsSnappedRef = useRef(isSnapped);
  useEffect(() => {
    if (prevIsSnappedRef.current === isSnapped) return;
    prevIsSnappedRef.current = isSnapped;
    clearTimeout(snappedPhaseTimerRef.current);
    setSnappedPhase('fading');
    // 900ms: wait for the reading-mode scroll to settle before enlarging text
    snappedPhaseTimerRef.current = setTimeout(() => {
      setSnappedPhase(isSnapped ? 'enlarged' : 'normal');
      requestAnimationFrame(() => {
        autoResize(narrationRef.current);
        onScreenInputRefs.current.forEach(el => autoResize(el));
      });
    }, 400);
  }, [isSnapped, autoResize]);
  useEffect(() => () => clearTimeout(snappedPhaseTimerRef.current), []);

  // Determine the CSS animation for this column's root element.
  // - Revealing: expand from 0 width
  // - hasEntered (normal): force 'none' to prevent CSS re-triggers during DOM reorder
  // - Initial entrance / about-screen: handled by CSS rule or aboutStyle
  const columnAnimation = isRevealing
    ? 'insert-col-expand 0.4s cubic-bezier(0.4, 0, 0.2, 1) both'
    : (hasEntered && !aboutExiting && !aboutEntering) ? 'none' : undefined;

  // Build about-animation style overrides (speed-adjusted)
  const aboutStyle: React.CSSProperties = {};
  if (aboutExiting) {
    if (index >= MAX_VISIBLE_COLS) {
      aboutStyle.opacity = 0;
      aboutStyle.transition = 'none';
    } else {
      aboutStyle.animation = `about-col-exit ${0.3 / ABOUT_SPEED}s ease ${aboutExitDelay / ABOUT_SPEED}ms forwards`;
    }
  } else if (aboutHidden) {
    aboutStyle.opacity = 0;
    aboutStyle.transform = 'translateY(30px)';
    aboutStyle.transition = 'none';
    aboutStyle.pointerEvents = 'none';
  } else if (aboutEntering) {
    aboutStyle.opacity = 0;
    aboutStyle.transform = 'translateY(30px)';
    aboutStyle.animation = `about-col-enter ${0.3 / ABOUT_SPEED}s ease ${aboutEnterDelay / ABOUT_SPEED}ms both`;
  }

  const effectiveColumnWidth = timelinePreview ? COL_W_TIMELINE : columnWidth;
  const [showTimelineLayout, setShowTimelineLayout] = useState(timelinePreview);
  // Controls fade-in of collapsed content (chip, title, bullets) — starts hidden,
  // becomes true one frame after collapsed layout mounts so CSS transition fires.
  const [showCollapsedContent, setShowCollapsedContent] = useState(false);
  // Measured translateX to land the number exactly at center of COL_W_TIMELINE.
  // Computed from the actual span width so 1-digit and 2-digit numbers both center.
  const [numberCenterOffset, setNumberCenterOffset] = useState(-8);
  const numberSpanRef = useRef<HTMLSpanElement>(null);
  // timelineDelay = per-column stagger, used for content fade transitions
  const timelineDelay = `${timelinePreviewDelayMs}ms`;
  // widthDelay = stagger + 200ms on enter so content fades before column shrinks
  const isEnteringTimeline = timelinePreview && !showTimelineLayout;
  const widthDelay = isEnteringTimeline
    ? `${timelinePreviewDelayMs + 200}ms`
    : `${timelinePreviewDelayMs}ms`;
  // On enter: content fades (200ms) then width transitions (560ms) = 760ms total.
  // Add 100ms safety buffer so the DOM switch never races the CSS animation end.
  const timelineLayoutSwitchMs = timelinePreview ? 860 : 700;
  const forceMinWidthZero = timelinePreview || showTimelineLayout;

  useEffect(() => {
    const t = setTimeout(() => {
      setShowTimelineLayout(timelinePreview);
      if (!timelinePreview) {
        requestAnimationFrame(() => {
          autoResize(narrationRef.current);
          autoResize(_draftRef.current);
          onScreenInputRefs.current.forEach(el => autoResize(el));
        });
      }
    }, timelineLayoutSwitchMs + timelinePreviewDelayMs);
    return () => clearTimeout(t);
  }, [timelinePreview, autoResize, timelinePreviewDelayMs, timelineLayoutSwitchMs]);

  // Fade in collapsed elements one frame after the collapsed layout mounts.
  useEffect(() => {
    if (showTimelineLayout && timelinePreview) {
      const raf = requestAnimationFrame(() => setShowCollapsedContent(true));
      return () => cancelAnimationFrame(raf);
    }
    setShowCollapsedContent(false);
  }, [showTimelineLayout, timelinePreview]);

  // Measure number width when entering timeline to compute the exact translateX
  // needed to land the number's visual center on COL_W_TIMELINE/2.
  useEffect(() => {
    if (timelinePreview && numberSpanRef.current) {
      const w = numberSpanRef.current.offsetWidth;
      // targetLeft = left edge position for center: (colWidth - w) / 2
      // offset = targetLeft - current left edge position (40px from content padding)
      setNumberCenterOffset((COL_W_TIMELINE - w) / 2 - 40);
    }
  }, [timelinePreview]);

  const isTransitioningToTimeline = timelinePreview && !showTimelineLayout;
  const isTransitioningFromTimeline = !timelinePreview && showTimelineLayout;

  // Separator strategy:
  // - Show border during shrinking and in default mode. Hide only in stable timeline (overlay provides separators).
  // - Use a child div for the right border with explicit background color — avoids currentColor/black flash
  //   when border appears after exiting timeline (border-right on the element was fading from currentColor).
  const showColBorder = !isDragging && !showTimelineLayout;
  const colBorderColor = isLocked ? '#383838' : '#E6E6E6';
  const colBorderRight = 'none'; // border drawn by child div
  const colBorderTransition = undefined; // no transition on element; child handles its own

  // steps() avoids sub-pixel strobe only for timeline expand/collapse (324 ↔ 94).
  // Use smooth cubic-bezier for insert (0→324), delete (324→0), and about-screen.
  // In reading mode: instant width swap (no flex reflow animation = no border pulsation).
  const useStepsForWidth =
    !isRevealing && !isDeleting && deletePhase < 1 && (timelinePreview || showTimelineLayout);
  const suppressWidthAnim = _isReadingMode && !isRevealing && !isDeleting;
  const widthTransition = suppressWidthAnim
    ? 'width 0s'
    : useStepsForWidth
      ? `width 0.56s steps(${COL_W - COL_W_TIMELINE}) ${widthDelay}`
      : `width 0.56s cubic-bezier(0.22, 1, 0.36, 1) ${widthDelay}`;
  const flexBasisTransition = suppressWidthAnim
    ? 'flex-basis 0s'
    : useStepsForWidth
      ? `flex-basis 0.56s steps(${COL_W - COL_W_TIMELINE}) ${widthDelay}`
      : `flex-basis 0.56s cubic-bezier(0.22, 1, 0.36, 1) ${widthDelay}`;
  const maxWidthTransition = suppressWidthAnim
    ? 'max-width 0s'
    : useStepsForWidth
      ? `max-width 0.56s steps(${COL_W - COL_W_TIMELINE}) ${widthDelay}`
      : `max-width 0.56s cubic-bezier(0.22, 1, 0.36, 1) ${widthDelay}`;

  if (showTimelineLayout) {
  return (
    <div
        ref={combinedRef}
        style={{
          ...style,
          rotate: `${dragRotation}deg`,
          transformOrigin: 'top right',
          width: deletePhase === 2 ? 0 : (isRevealing ? 0 : effectiveColumnWidth),
          flexBasis: deletePhase === 2 ? 0 : (isRevealing ? 0 : effectiveColumnWidth),
          maxWidth: deletePhase === 2 ? 0 : (isRevealing ? 0 : effectiveColumnWidth),
          minWidth: isRevealing || isDeleting || forceMinWidthZero ? 0 : undefined,
          opacity: deletePhase >= 1 ? 0 : 1,
          borderRight: colBorderRight,
          transition: [
            'rotate 0.15s ease-out',
            widthTransition,
            flexBasisTransition,
            maxWidthTransition,
            'opacity 0.3s ease',
            'filter 0.15s ease',
            colBorderTransition,
          ].filter(Boolean).join(', '),
          '--scene-index': index,
          ...aboutStyle,
          ...(columnAnimation ? { animation: columnAnimation } : {}),
        } as React.CSSProperties}
        data-scene-id={scene.id}
        className={`scene-column flex-shrink-0 h-full ${isSnapped ? 'overflow-hidden' : ''} ${
          hasEntered && !aboutExiting && !aboutEntering ? 'has-entered' : ''
        } ${isLocked ? 'is-locked' : ''} ${isSnapped ? 'is-snapped' : ''}`}
      >
        {/* Left border: drawn by the right column of each pair so it always composites on top */}
        {showColBorder && index > 0 && (
          <div
            style={{
              position: 'absolute', top: 0, left: 0, bottom: 0, width: 1,
              background: colBorderColor,
              pointerEvents: 'none',
              zIndex: 30,
              transition: 'background 0.15s ease',
            }}
          />
        )}
        {/* Right border only for the last column */}
        {showColBorder && index === _totalScenes - 1 && (
          <div
            style={{
              position: 'absolute', top: 0, right: 0, bottom: 0, width: 1,
              background: colBorderColor,
              pointerEvents: 'none',
              zIndex: 30,
              transition: 'background 0.15s ease',
            }}
          />
        )}
        <div
          className="scene-column-content"
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            overflow: 'visible',
            paddingTop: 20,
            paddingBottom: 20,
            paddingLeft: 40,
            paddingRight: 8,
          }}
        >
          {/* Number — fixed COL_W_TIMELINE-wide container so justifyContent:center always
               references the 94px column width, not the expanding width during exit.
               On exit, translateX(-numberCenterOffset) mirrors the enter animation exactly. */}
          <div
            style={{
              position: 'absolute',
              top: TIMELINE_NUMBER_TOP,
              left: 0,
              width: COL_W_TIMELINE,
              height: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 1,
              transform: isTransitioningFromTimeline ? `translateX(${-numberCenterOffset}px)` : 'translateX(0)',
              transition: `transform 0.56s cubic-bezier(0.22, 1, 0.36, 1) ${timelineDelay}`,
            }}
          >
            <span style={{ fontFamily: 'var(--font-headline)', fontSize: 50, lineHeight: 1 }}>{displayNumber}</span>
          </div>

          {/* Scene time */}
          <div
            style={{
              position: 'absolute',
              top: TIMELINE_TIME_TOP,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              zIndex: 3,
              opacity: (!isTransitioningFromTimeline && showCollapsedContent) ? 1 : 0,
              transition: 'opacity 280ms ease',
            }}
          >
            <span
              className="subheading"
              style={{
                color: 'var(--color-accent-text)',
                  border: '1px solid var(--color-accent)',
                borderRadius: 10,
                padding: '7px 12px',
                lineHeight: 1,
                background: 'white',
                  position: 'relative',
                  zIndex: 4,
              }}
            >
              {localDuration}
            </span>
          </div>

          {/* Collapsed title: anchored at top, grows downward */}
          <div
            style={{
              position: 'absolute',
              top: TIMELINE_TITLE_TOP,
              left: 'calc(50% - 12px)',
              width: 0,
              height: 0,
              overflow: 'visible',
              pointerEvents: 'none',
              zIndex: 4,
              opacity: (!isTransitioningFromTimeline && showCollapsedContent) ? 1 : 0,
              transform: isTransitioningFromTimeline ? 'translateY(8px)' : 'translateY(0)',
              transition: 'opacity 280ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <span
              className="uppercase whitespace-nowrap"
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                display: 'block',
                fontFamily: 'var(--font-headline)',
                fontSize: '26px',
                fontWeight: 400,
                lineHeight: 1.05,
                color: '#111111',
                letterSpacing: '0.01em',
                textAlign: 'right',
                transform: 'rotate(-90deg)',
                transformOrigin: 'top right',
              }}
            >
              {localTitle || scene.title}
            </span>
          </div>

          {/* On-screen checklist lane at bottom of collapsed column */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 24,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 3,
              opacity: (!isTransitioningFromTimeline && showCollapsedContent) ? 1 : 0,
              transform: isTransitioningFromTimeline ? 'translateY(8px)' : 'translateY(0)',
              transition: 'opacity 280ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                maxHeight: 120,
                overflow: 'hidden',
              }}
            >
              {scene.onScreenTexts.map((item) => (
                <span
                  key={item.id}
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    border: '1px solid var(--color-accent)',
                    background: item.isChecked ? 'var(--color-accent)' : 'white',
                    boxSizing: 'border-box',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        {isRevealing && (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 50,
              background: 'var(--color-accent)',
              transformOrigin: 'right',
              animation: 'insert-col-reveal 0.55s cubic-bezier(0.4, 0, 0.2, 1) 0.42s forwards',
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      ref={combinedRef}
      style={{
        ...style,
        rotate: `${dragRotation}deg`,
        transformOrigin: 'top right',
        width: deletePhase === 2 ? 0 : (isRevealing ? 0 : (timelinePreview ? COL_W_TIMELINE : columnWidth)),
        flexBasis: deletePhase === 2 ? 0 : (isRevealing ? 0 : (timelinePreview ? COL_W_TIMELINE : columnWidth)),
        maxWidth: deletePhase === 2 ? 0 : (isRevealing ? 0 : (timelinePreview ? COL_W_TIMELINE : columnWidth)),
        minWidth: isRevealing || isDeleting || forceMinWidthZero ? 0 : undefined,
        opacity: deletePhase >= 1 ? 0 : 1,
        borderRight: colBorderRight,
        transition: [
          springTransition,
          'rotate 0.15s ease-out',
          widthTransition,
          flexBasisTransition,
          maxWidthTransition,
          'opacity 0.3s ease',
          'filter 0.15s ease',
          colBorderTransition,
        ].filter(Boolean).join(', '),
        '--scene-index': index,
        // Earlier columns paint on top of later ones → right border never covered by adjacent column
        ...aboutStyle,
        ...(columnAnimation ? { animation: columnAnimation } : {}),
      } as React.CSSProperties}
      data-scene-id={scene.id}
      className={`scene-column flex-shrink-0 h-full ${isSnapped ? 'overflow-hidden' : ''} ${
        hasEntered && !aboutExiting && !aboutEntering ? 'has-entered' : ''
      } ${isLocked ? 'is-locked' : ''} ${isSnapped ? 'is-snapped' : ''}`}
      onTransitionEnd={(e) => {
        if (timelinePreview) return;
        if (e.propertyName !== 'width' && e.propertyName !== 'flex-basis' && e.propertyName !== 'max-width') return;
        requestAnimationFrame(() => {
          autoResize(narrationRef.current);
          autoResize(_draftRef.current);
          onScreenInputRefs.current.forEach(el => autoResize(el));
        });
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left border: drawn by the right column of each pair so it always composites on top */}
      {showColBorder && index > 0 && (
        <div
          style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: 1,
            background: colBorderColor,
            pointerEvents: 'none',
            zIndex: 30,
            transition: 'background 0.15s ease',
          }}
        />
      )}
      {/* Right border only for the last column */}
      {showColBorder && index === _totalScenes - 1 && (
        <div
          style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 1,
            background: colBorderColor,
            pointerEvents: 'none',
            zIndex: 30,
            transition: 'background 0.15s ease',
          }}
        />
      )}
      <div
        ref={contentRef}
        className="scene-column-content px-[40px] pt-[20px] pb-[20px] overflow-y-auto"
        style={{
          width: columnWidth,
          height: '100%',
          transition: _isReadingMode
            ? 'opacity 0.15s ease'
            : 'opacity 0.15s ease, width 0.56s cubic-bezier(0.22, 1, 0.36, 1)',
          opacity: editingRefId ? 0.2 : 1,
          pointerEvents: (editingRefId || timelinePreview) ? 'none' : 'auto',
          position: 'relative',
        }}
      >
        {/* ── Row 1: Scene Number + Icons ── */}
        <div className="flex items-center justify-between mt-[60px] h-[50px] min-h-[50px]">
          {/* Number with clip-frame slide animation */}
          <div
            style={{
              height: 50, overflow: 'hidden', position: 'relative',
              fontFamily: 'var(--font-headline)', fontSize: 50, lineHeight: 1,
              transform: isTransitioningToTimeline ? `translateX(${numberCenterOffset}px)` : 'translateX(0)',
              transition: isTransitioningToTimeline
                ? `transform 0.56s cubic-bezier(0.22, 1, 0.36, 1) ${widthDelay}`
                : 'none',
            }}
          >
            <span ref={numberSpanRef} style={{
              display: 'block',
              transition: numberAnim !== 'idle' ? 'transform 200ms ease, opacity 200ms ease' : 'none',
              transform: numberAnim === 'out'
                ? `translateY(${numberDirection === 'up' ? '100%' : '-100%'})`
                : 'translateY(0)',
              opacity: numberAnim === 'out' ? 0 : 1,
            }}>
              {displayNumber}
          </span>
          </div>

          {/* Icons — all appear at once on hover */}
          <div
            className="scene-column-icons flex items-center gap-1 min-h-[24px]"
            style={{
              opacity: isTransitioningToTimeline ? 0 : 1,
              transition: isTransitioningToTimeline ? 'opacity 100ms ease' : `opacity 180ms ease ${timelineDelay}`,
            }}
          >
            {/* Unlocked icons — fade in together on hover */}
            {!isLocked && (
              <div
                className="flex items-center gap-1"
                style={{
                  opacity: effectiveHovered || isGeneratingScene ? 1 : 0,
                  transition: 'opacity 200ms ease',
                  pointerEvents: effectiveHovered ? 'auto' : 'none',
                }}
              >
            <button
                  onClick={onDeleteScene}
                  className="p-0.5 text-[var(--color-black)] hover:text-red-500 transition-colors"
                  title="Delete scene"
                >
                  <DeleteIcon size={24} />
            </button>

                <button
                  onClick={onGenerate}
                  disabled={isGeneratingScene}
                  className={`p-0.5 transition-colors ${
                    isGeneratingScene ? 'text-[var(--color-accent)]' : 'text-[var(--color-black)] hover:text-[var(--color-accent)]'
                  }`}
                  title="Generate narration for this scene"
                >
                  {isGeneratingScene ? (
                    <Loader2 size={24} className="animate-spin" />
                  ) : (
                    <GenerateIcon size={24} />
                  )}
                </button>

            <button
              {...attributes}
              {...listeners}
                  className="p-0.5 text-[var(--color-black)] hover:text-[var(--color-accent)] cursor-grab active:cursor-grabbing transition-colors"
                >
                  <DragIcon size={24} isPressed={isDragging} />
                </button>
              </div>
            )}

            {/* Lock icon — always visible when locked, fades in with rest when unlocked */}
            <button
              onClick={onToggleFixed}
              className={`p-0.5 transition-colors ${
                isLocked
                  ? 'text-[var(--color-accent)] hover:text-white'
                  : 'text-[var(--color-black)] hover:text-[var(--color-accent)]'
              }`}
              style={{
                opacity: isLocked ? 1 : (effectiveHovered ? 1 : 0),
                transition: 'opacity 200ms ease, color 150ms ease',
                pointerEvents: isLocked || effectiveHovered ? 'auto' : 'none',
              }}
              title={isLocked ? 'Unlock scene' : 'Lock scene'}
            >
              {isLocked ? <LockedIcon size={24} /> : <UnlockedIcon size={24} />}
            </button>
          </div>
        </div>

        {/* ── Row 2: Duration + Scale ── */}
        <div
          ref={durationRowRef}
          className="mt-[54px] flex items-center gap-[12px]"
          style={{
            opacity: isTransitioningToTimeline ? 0 : 1,
            transform: isTransitioningToTimeline ? 'translateY(10px)' : 'translateY(0)',
            transition: isTransitioningToTimeline ? 'opacity 100ms ease' : `opacity 220ms ease ${timelineDelay}, transform 320ms cubic-bezier(0.22, 1, 0.36, 1) ${timelineDelay}`,
          }}
        >
          <InputCard isLocked={isLocked} borderOnly style={{ marginLeft: -12, marginRight: 0 }} cardRef={durationCardRef}>
          <input
            type="number"
            value={localDuration}
            onChange={e => handleDurationChange(e.target.value)}
            disabled={isLocked}
            min={1}
              className="subheading"
              style={{
                width: 36,
                ...(isLocked ? {} : { color: 'var(--color-black)' }),
                ...(durationBounce ? { animation: 'duration-bounce 0.3s ease' } : {}),
              }}
            />
          </InputCard>
          {speakingTimeSec > 0 && (
            <span
              className="subheading"
              style={{ color: isLocked ? 'rgba(200,200,200,0.3)' : 'rgb(175, 175, 175)' }}
            >
              {speakingTimeSec}
            </span>
          )}
          <div className="flex-1" />
          <DurationScale
            value={parseInt(localDuration, 10) || 0}
            onChange={handleScaleDurationChange}
          />
        </div>

        {/* ── Row 3: Scene Title + Version Count ── */}
        <div
          className="mt-[28px] flex items-center gap-[16px]"
          style={{
            opacity: isTransitioningToTimeline ? 0 : 1,
            transform: isTransitioningToTimeline ? 'translateY(10px)' : 'translateY(0)',
            transition: isTransitioningToTimeline ? 'opacity 100ms ease' : `opacity 220ms ease ${timelineDelay}, transform 320ms cubic-bezier(0.22, 1, 0.36, 1) ${timelineDelay}`,
          }}
        >
          <InputCard isLocked={isLocked} borderOnly style={{ flex: 1, minWidth: 0, marginRight: 0 }} cardRef={titleCardRef}>
        <input
          type="text"
          value={localTitle}
          onChange={e => handleTitleChange(e.target.value.toUpperCase())}
          disabled={isLocked}
              className={`scene-title w-full text-[26px] leading-[1.05] uppercase bg-transparent ${isLocked ? 'text-[var(--color-accent)]' : ''}`}
          style={{ fontFamily: 'var(--font-headline)' }}
        />
          </InputCard>
          {!isLocked && (
            hasMultipleVersions ? (
              <button
                className="flex-shrink-0 version-count-btn"
                onClick={() => versionBrowsing ? exitVersionBrowsing() : enterVersionBrowsing()}
              >
                {versionCount}
              </button>
            ) : effectiveHovered ? (
              <button
                className="flex-shrink-0 add-version-btn"
                onClick={onCreateNarrationVersion}
              >
                <img src="/add_reference.svg" alt="Add" width={16} height={16} />
              </button>
            ) : null
          )}
        </div>

        {/* ── Narration — hide when locked & empty ── */}
        {/* ── Narration — hide when locked & empty ── */}
        {(!isLocked || hasNarration) && (() => {
          const showCard = !isLocked && (narrationFocused || narrationHovered || versionBrowsing);
          const showStack = hasMultipleVersions && !versionBrowsing;
          return (
            <div
              className="narration-wrap mt-[16px]"
              style={{
                position: 'relative',
                opacity: isTransitioningToTimeline ? 0 : 1,
                transform: isTransitioningToTimeline ? 'translateY(10px)' : 'translateY(0)',
                transition: isTransitioningToTimeline ? 'opacity 100ms ease' : `opacity 220ms ease ${timelineDelay}, transform 320ms cubic-bezier(0.22, 1, 0.36, 1) ${timelineDelay}`,
              }}
            >
              {/* Card stack peek cards — always rendered, fade via opacity */}
              {showStack && (
                <>
                  <div style={{
                    position: 'absolute',
                    left: 0, right: 0, top: 10, bottom: -10,
                    background: 'white',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 12, zIndex: -1,
                    opacity: narrationHovered ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                    pointerEvents: 'none',
                  }} />
                  {versionCount > 2 && (
                    <div style={{
                      position: 'absolute',
                      left: 12, right: 12, top: 20, bottom: -20,
                      background: 'white',
                      border: '1px solid rgba(0,0,0,0.1)',
                      borderRadius: 12, zIndex: -2,
                      opacity: narrationHovered ? 1 : 0,
                      transition: 'opacity 0.2s ease',
                      pointerEvents: 'none',
                    }} />
                  )}
                </>
              )}

              <InputCard
                isLocked={isLocked}
                show={showCard}
                style={{
                  position: 'relative',
                  zIndex: versionBrowsing ? 3 : 1,
                  opacity: versionBrowsing ? 0 : 1,
                  pointerEvents: versionBrowsing ? 'none' : 'auto',
                  ...(versionBrowsing ? {
                    border: '1px solid black',
                    ...CARD_SHADOW_STYLE,
                  } : {}),
                }}
                onMouseEnter={() => setNarrationHovered(true)}
                onMouseLeave={() => setNarrationHovered(false)}
                cardRef={narrationCardRef}
              >
          <textarea
            ref={narrationRef}
                  value={revealWords >= 0
                    ? localNarration.split(/\s+/).filter(Boolean).slice(0, revealWords).join(' ')
                    : localNarration}
            onChange={e => {
                    handleNarrationChange(e.target.value);
              autoResize(e.target);
            }}
                  onFocus={() => setNarrationFocused(true)}
                  onBlur={() => setNarrationFocused(false)}
                  disabled={isLocked || revealWords >= 0}
            className="w-full main-text auto-height-textarea"
                  placeholder={isLocked ? '' : 'Narration'}
            rows={1}
                  style={{
                    fontSize: snappedPhase === 'enlarged' ? 15 : undefined,
                    lineHeight: snappedPhase === 'enlarged' ? 1.65 : undefined,
                    opacity: snappedPhase === 'fading' ? 0 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                />
              </InputCard>
        </div>
          );
        })()}

        {/* ── On-Screen Texts — always a checklist ── */}
        {(!isLocked || hasOnScreen) && (
          <div
            className="mt-[52px]"
            style={{
              opacity: isTransitioningToTimeline ? 0 : 1,
              transform: isTransitioningToTimeline ? 'translateY(10px)' : 'translateY(0)',
              transition: isTransitioningToTimeline ? 'opacity 100ms ease' : `opacity 220ms ease ${timelineDelay}, transform 320ms cubic-bezier(0.22, 1, 0.36, 1) ${timelineDelay}, margin-top 0.3s cubic-bezier(0.22, 1, 0.36, 1)`,
              marginTop: snappedPhase === 'enlarged' ? 72 : undefined,
            }}
                >
                  <div
              ref={onScreenHeadingRef}
              className="subheading"
            >On-screen</div>
            <div className="mt-[20px] space-y-2">
              {localOnScreen.length > 0 ? (
                localOnScreen.map((localItem, idx) => {
                  const sceneItem = localItem.sceneItemId
                    ? sceneItemsById.get(localItem.sceneItemId)
                    : undefined;
                  const isChecked = sceneItem?.isChecked ?? false;

                  return (
                    <div key={localItem.key} className="flex items-start gap-[10px]">
                      <div
                        className={`onscreen-bullet mt-[5px] ${isChecked ? 'is-checked' : ''}`}
                        onClick={() => sceneItem && onToggleOnScreenText(sceneItem.id)}
                      />
                      <textarea
                        ref={(el: HTMLTextAreaElement | null) => { onScreenInputRefs.current[idx] = el; }}
                        value={localItem.text}
                        onChange={e => {
                          if (!isLocked) {
                            handleOnScreenItemChange(idx, e.target.value);
                            autoResize(e.target);
                          }
                        }}
                        onKeyDown={e => { if (!isLocked) handleOnScreenKeyDown(e, idx); }}
                        onFocus={() => { if (!isLocked) handleOnScreenFocus(); }}
                        onBlur={() => { if (!isLocked) handleOnScreenBlur(); }}
                        disabled={isLocked}
                        readOnly={isLocked}
                        className={`onscreen-input flex-1 min-w-0 main-text auto-height-textarea ${isChecked ? 'onscreen-item is-checked' : ''}`}
                        rows={1}
                      />
                </div>
                  );
                })
              ) : (
                !isLocked && (
                  <div
                    className="flex items-start gap-[10px] cursor-text"
                    onClick={handleAddOnScreenItem}
                  >
                    <div className="onscreen-bullet is-placeholder mt-[5px]" />
                    <span className="placeholder-text main-text">Add on-screen text</span>
            </div>
                )
              )}
          </div>
          </div>
        )}

        {/* ── References — per-item with modal editing ── */}
        {(!isLocked || hasReferences) && (
          <div
            className="references-section mt-[52px]"
            style={{
              opacity: isTransitioningToTimeline ? 0 : 1,
              transform: isTransitioningToTimeline ? 'translateY(10px)' : 'translateY(0)',
              transition: isTransitioningToTimeline
                ? 'opacity 100ms ease'
                : `opacity 220ms ease ${timelineDelay}, transform 320ms cubic-bezier(0.22, 1, 0.36, 1) ${timelineDelay}, margin-top 0.3s cubic-bezier(0.22, 1, 0.36, 1)`,
              marginTop: snappedPhase === 'enlarged' ? 72 : undefined,
            }}
          >
            <div ref={refsHeadingRef} className="subheading mb-[20px]">References</div>
            <div className="flex flex-col gap-2">
              {scene.references.map(ref => (
                <div key={ref.id}>
                  <span
                    className="reference-pill"
                    onClick={() => !isLocked && startEditRef(ref)}
                  >
                    <span className="reference-pill-label">{ref.label}</span>
                    {ref.url && (
                      <span
                        className="reference-pill-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(ref.url, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <img src="/external_link.svg" alt="" width={16} height={16} />
                </span>
                    )}
                  </span>
                </div>
              ))}

              {!isLocked && (
                <button
                  className="add-reference-btn"
                  onClick={startAddRef}
                  title="Add a reference"
                >
                  <img src="/add_reference.svg" alt="Add" />
                </button>
            )}
          </div>
          </div>
        )}

        {/* ── Version Browser Overlay — in-column for identical text rendering ── */}
        {versionBrowsing && versionCount > 0 && (
          <VersionBrowser
            versions={narrationVersions}
            currentIndex={scene.currentNarrationVersionIndex}
            anchor={versionAnchor}
            onNavigate={onSetNarrationVersion}
            onClose={exitVersionBrowsing}
            onDelete={(idx) => {
              if (versionCount <= 1) {
                exitVersionBrowsing();
                return;
              }
              onDeleteNarrationVersion(idx);
            }}
            onCreateVersion={onCreateNarrationVersion}
          />
        )}

        <div className="h-[40px]" />
          </div>

      {/* Reference Edit/Add Dialog — portal, centered on this column */}
      {editingRefId && (() => {
        const rect = columnRef.current?.getBoundingClientRect();
        const cx = rect ? rect.left + rect.width / 2 : 0;
        const cy = rect ? rect.top + rect.height / 2 : 0;
        const isDisabled = !editingRefLabel.trim() && !editingRefUrl.trim();
        const isEditing = editingRefId !== 'new';
        return createPortal(
          <div
            ref={refDialogRef}
            style={{
              position: 'fixed',
              left: cx, top: cy,
              transform: 'translate(-50%, -50%)',
              zIndex: 50,
              width: COL_W + 32,
              borderRadius: 16,
              border: '0.5px solid #E6E6E6',
              background: 'white',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              animation: refDialogClosing
                ? 'ref-dialog-out 0.2s ease both'
                : 'ref-dialog-in 0.5s cubic-bezier(0.2, 0, 0, 1) both',
            }}
                        onClick={e => e.stopPropagation()}
                      >
            <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-headline)', fontSize: 18, textTransform: 'uppercase' }}>
                {isEditing ? 'Edit Reference' : 'Add Reference'}
              </span>
                  </div>

            <input
              ref={refLabelInputRef}
              type="text"
              value={editingRefLabel}
              onChange={e => setEditingRefLabel(e.target.value)}
              placeholder="Title"
              autoFocus
              style={{
                height: 40, borderRadius: 8, border: '0.5px solid #E6E6E6',
                paddingLeft: 10, fontSize: 13, outline: 'none', flexShrink: 0,
                margin: 0, background: 'transparent',
              }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveRefEdit(); } if (e.key === 'Escape') closeRefDialogAnimated(); }}
            />

            <input
              type="text"
              value={editingRefUrl}
              onChange={e => setEditingRefUrl(e.target.value)}
              placeholder="Link"
              style={{
                height: 40, borderRadius: 8, border: '0.5px solid #E6E6E6',
                paddingLeft: 10, fontSize: 13, outline: 'none', flexShrink: 0,
                margin: 0, background: 'transparent',
              }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveRefEdit(); } if (e.key === 'Escape') closeRefDialogAnimated(); }}
            />

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button
                onClick={closeRefDialogAnimated}
                style={{
                  flex: 1, height: 40, borderRadius: 8,
                  border: '0.5px solid #E6E6E6', background: 'transparent',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#7C7C7C',
                }}
              >
                Cancel
              </button>
              {isEditing && (
                <button
                  onClick={() => { _onDeleteReference(editingRefId); closeRefDialogAnimated(); }}
                  style={{
                    flex: 1, height: 40, borderRadius: 8,
                    border: '0.5px solid #E6E6E6', background: 'transparent',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#E53935',
                  }}
                >
                  Delete
                </button>
              )}
              <button
                onClick={saveRefEdit}
                disabled={isDisabled}
                style={{
                  flex: 1, height: 40, borderRadius: 8,
                  background: isDisabled ? '#E6E6E6' : 'var(--color-accent)',
                  color: 'white',
                  border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                }}
              >
                {isEditing ? 'Save' : 'Add'}
              </button>
              </div>
          </div>,
          document.body,
        );
      })()}

      {/* Insert-reveal overlay: accent curtain that shrinks from left, anchored at right */}
      {isRevealing && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'var(--color-accent)',
            transformOrigin: 'right',
            animation: 'insert-col-reveal 0.55s cubic-bezier(0.4, 0, 0.2, 1) 0.42s forwards',
          }}
        />
      )}
    </div>
  );
}
