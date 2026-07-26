import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarClosing: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // Selection
  selectedSceneId: string | null;
  setSelectedSceneId: (id: string | null) => void;

  // Generation state
  isGenerating: boolean;
  generatingSceneIds: string[];
  generationProgress: { current: number; total: number } | null;
  setGenerating: (isGenerating: boolean) => void;
  setGeneratingSceneIds: (ids: string[]) => void;
  addGeneratingSceneId: (id: string) => void;
  removeGeneratingSceneId: (id: string) => void;
  setGenerationProgress: (progress: { current: number; total: number } | null) => void;

  // Modals
  apiKeyModalOpen: boolean;
  setApiKeyModalOpen: (open: boolean) => void;

  settingsModalOpen: boolean;
  setSettingsModalOpen: (open: boolean) => void;

  aboutOpen: boolean;
  setAboutOpen: (open: boolean) => void;

  aboutAnimPhase: string;
  setAboutAnimPhase: (phase: string) => void;

  deleteConfirmSceneId: string | null;
  setDeleteConfirmSceneId: (id: string | null) => void;

  ytDescModalOpen: boolean;
  setYtDescModalOpen: (open: boolean) => void;

  // Script transition animation
  pendingScriptSwitch: string | null;
  setPendingScriptSwitch: (id: string | null) => void;

  // Version browsing modal
  versionBrowsingSceneId: string | null;
  setVersionBrowsingSceneId: (id: string | null) => void;

  // Timeline preview (hover on total duration)
  timelinePreviewActive: boolean;
  setTimelinePreviewActive: (active: boolean) => void;

  // Typography settings
  mainFontSize: number;
  mainLineHeight: number;
  setMainFontSize: (v: number) => void;
  setMainLineHeight: (v: number) => void;

  // Toast notifications
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

let toastIdCounter = 0;

export const useUIStore = create<UIState>()(
  immer((set, get) => ({
    // Sidebar
    sidebarOpen: false,
    sidebarClosing: false,
    toggleSidebar: () => {
      const { sidebarOpen, sidebarClosing } = get();
      if (sidebarClosing) return;
      if (sidebarOpen) {
        set(s => { s.sidebarClosing = true; });
        setTimeout(() => {
          set(s => { s.sidebarOpen = false; s.sidebarClosing = false; });
        }, 500);
      } else {
        set(s => { s.sidebarOpen = true; s.sidebarClosing = false; });
      }
    },
    setSidebarOpen: (open: boolean) => {
      const { sidebarOpen, sidebarClosing } = get();
      if (sidebarClosing) return;
      if (open === sidebarOpen) return;
      if (!open) {
        set(s => { s.sidebarClosing = true; });
        setTimeout(() => {
          set(s => { s.sidebarOpen = false; s.sidebarClosing = false; });
        }, 500);
      } else {
        set(s => { s.sidebarOpen = true; s.sidebarClosing = false; });
      }
    },

    // Selection
    selectedSceneId: null,
    setSelectedSceneId: (id: string | null) =>
      set(state => {
        state.selectedSceneId = id;
      }),

    // Generation state
    isGenerating: false,
    generatingSceneIds: [],
    generationProgress: null,
    setGenerating: (isGenerating: boolean) =>
      set(state => {
        state.isGenerating = isGenerating;
        if (!isGenerating) {
          state.generatingSceneIds = [];
          state.generationProgress = null;
        }
      }),
    setGeneratingSceneIds: (ids: string[]) =>
      set(state => {
        state.generatingSceneIds = ids;
      }),
    addGeneratingSceneId: (id: string) =>
      set(state => {
        if (!state.generatingSceneIds.includes(id)) {
          state.generatingSceneIds.push(id);
        }
      }),
    removeGeneratingSceneId: (id: string) =>
      set(state => {
        state.generatingSceneIds = state.generatingSceneIds.filter(
          sceneId => sceneId !== id
        );
      }),
    setGenerationProgress: (progress: { current: number; total: number } | null) =>
      set(state => {
        state.generationProgress = progress;
      }),

    // Modals
    apiKeyModalOpen: false,
    setApiKeyModalOpen: (open: boolean) =>
      set(state => {
        state.apiKeyModalOpen = open;
      }),

    settingsModalOpen: false,
    setSettingsModalOpen: (open: boolean) =>
      set(state => {
        state.settingsModalOpen = open;
      }),

    aboutOpen: false,
    setAboutOpen: (open: boolean) =>
      set(state => {
        state.aboutOpen = open;
      }),

    aboutAnimPhase: 'closed',
    setAboutAnimPhase: (phase: string) =>
      set(state => {
        state.aboutAnimPhase = phase;
      }),

    deleteConfirmSceneId: null,
    setDeleteConfirmSceneId: (id: string | null) =>
      set(state => {
        state.deleteConfirmSceneId = id;
      }),

    ytDescModalOpen: false,
    setYtDescModalOpen: (open: boolean) =>
      set(state => {
        state.ytDescModalOpen = open;
      }),

    // Script transition animation
    pendingScriptSwitch: null,
    setPendingScriptSwitch: (id: string | null) =>
      set(state => {
        state.pendingScriptSwitch = id;
      }),

    // Version browsing modal
    versionBrowsingSceneId: null,
    setVersionBrowsingSceneId: (id: string | null) =>
      set(state => {
        state.versionBrowsingSceneId = id;
      }),

    // Timeline preview
    timelinePreviewActive: false,
    setTimelinePreviewActive: (active: boolean) =>
      set(state => {
        state.timelinePreviewActive = active;
      }),

    // Typography settings — persisted to localStorage
    mainFontSize: Number(localStorage.getItem('typo_mainFontSize') || 13),
    mainLineHeight: Number(localStorage.getItem('typo_mainLineHeight') || 1.5),
    setMainFontSize: (v: number) => {
      localStorage.setItem('typo_mainFontSize', String(v));
      set(state => { state.mainFontSize = v; });
    },
    setMainLineHeight: (v: number) => {
      localStorage.setItem('typo_mainLineHeight', String(v));
      set(state => { state.mainLineHeight = v; });
    },

    // Toast notifications
    toasts: [],
    addToast: (toast: Omit<Toast, 'id'>) =>
      set(state => {
        const id = `toast-${++toastIdCounter}`;
        state.toasts.push({ ...toast, id });

        // Auto-remove after duration
        const duration = toast.duration ?? 4000;
        setTimeout(() => {
          set(s => {
            s.toasts = s.toasts.filter(t => t.id !== id);
          });
        }, duration);
      }),
    removeToast: (id: string) =>
      set(state => {
        state.toasts = state.toasts.filter(t => t.id !== id);
      }),
  }))
);
