// === Core Types ===

export type ScriptStatus = 'backlog' | 'in-progress' | 'done';

// Kind of a project sub-category (tab). Controls scene semantics:
// 'architecture' — durationSec means HOURS to dedicate, lock = hours already spent
// 'video'        — durationSec means seconds of runtime (original behavior)
export type CategoryKind = 'architecture' | 'video';

// A renamable tab inside a project. Every project gets 4 by default
// (3 architecture phases + 1 YouTube video). Scene ordering lives here,
// scoped per category — Script.sceneOrder is legacy and no longer used.
export interface ScriptCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  sceneOrder: string[]; // scene IDs in display order within this tab
}

export interface Script {
  id: string;
  name: string;
  titleJP: string; // Japanese version of the title (vertical in sidebar)
  emoji: string; // displayed before script name in sidebar
  paceWordsPerSec: number; // e.g., 2.5 words per second
  voiceProfile: string; // tone guide for LLM
  sceneOrder: string[]; // LEGACY (pre-v6): kept so old validators/exports don't break
  categories: ScriptCategory[]; // v6+: the 4 renamable tabs
  status: ScriptStatus;
  createdAt: number;
  updatedAt: number;
}

export interface DraftVersion {
  index: number; // v1=0, v2=1, etc.
  content: string;
  createdAt: number;
  source: 'manual' | 'from-narration-edit';
}

export interface NarrationVersion {
  id: string;
  content: string;
  wordCount: number;
  createdAt: number;
}

export interface Reference {
  id: string;
  label: string;
  url: string;
  note: string;
}

export interface OnScreenText {
  id: string;
  text: string;
  isChecked: boolean;
}

export interface Scene {
  id: string;
  scriptId: string;
  categoryId: string; // v6+: which tab this scene belongs to
  title: string;
  durationSec: number; // seconds (video tabs) or hours (architecture tabs)
  isFixed: boolean;

  // Versioned draft notes
  draftVersions: DraftVersion[];
  currentDraftIndex: number; // points to active version

  // Generated output
  narration: string | null;
  narrationGeneratedAt: number | null;
  narrationFromDraftIndex: number | null; // which version generated this

  // Narration versions — each successful generation adds a version
  narrationVersions: NarrationVersion[];
  currentNarrationVersionIndex: number;

  // On-screen texts (checkable list)
  onScreenTexts: OnScreenText[];

  references: Reference[];
}

// A file (PDF/PNG/JPG plan, drawing, image) attached to a scene column.
// Stored in its own Dexie table so scene edits never rewrite blobs.
export interface Attachment {
  id: string;
  sceneId: string;
  scriptId: string; // denormalized for per-project loading and cascade deletes
  name: string;
  mimeType: string; // application/pdf | image/png | image/jpeg
  size: number; // bytes
  createdAt: number;
  blob: Blob;
}

// Attachment as it travels through JSON export/import (Blob → base64)
export interface AttachmentExport {
  id: string;
  sceneId: string;
  scriptId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: number;
  dataBase64: string;
}

// === Derived/Computed Types ===

export type FitStatus = 'under' | 'ok' | 'over';

export interface SceneComputed {
  targetWords: number;
  actualWords: number;
  fitStatus: FitStatus;
  fitPercent: number; // deviation from target (e.g., -5 means 5% under)
  isOutdated: boolean;
  canEdit: boolean;
  canGenerate: boolean;
}

export interface SceneWithComputed extends Scene {
  computed: SceneComputed;
}

// === Generation Types ===

export type GenerationMode =
  | { type: 'all-unlocked' }
  | { type: 'missing-or-outdated' }
  | { type: 'from-scene'; sceneId: string; onlyOutdated: boolean };

export interface GenerationTarget {
  target: number;
  min: number;
  max: number;
  tolerance: number;
}

export interface GenerationResult {
  sceneId: string;
  success: boolean;
  narration?: string;
  wordCount?: number;
  error?: string;
}

// === UI State Types ===

export interface UIState {
  sidebarOpen: boolean;
  activeScriptId: string | null;
  selectedSceneId: string | null;
  isGenerating: boolean;
  generatingSceneIds: string[];
  apiKeyModalOpen: boolean;
}

// === Undo/Redo Types ===

export interface UndoableAction {
  type: string;
  timestamp: number;
  payload: unknown;
  undo: () => void;
  redo: () => void;
}

// === API Key Types ===

export interface APIKeyConfig {
  openaiKey: string | null;
}
