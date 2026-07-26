// === Core Types ===

export type ScriptStatus = 'backlog' | 'in-progress' | 'done';

export interface Script {
  id: string;
  name: string;
  titleJP: string; // Japanese version of the title (vertical in sidebar)
  emoji: string; // displayed before script name in sidebar
  paceWordsPerSec: number; // e.g., 2.5 words per second
  voiceProfile: string; // tone guide for LLM
  sceneOrder: string[]; // scene IDs in display order
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
  title: string;
  durationSec: number;
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
