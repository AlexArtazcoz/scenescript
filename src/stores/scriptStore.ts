import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import type { Script, Scene, DraftVersion, NarrationVersion, Reference } from '../types';
import * as db from '../services/db';

interface ScriptState {
  scripts: Script[];
  scenes: Scene[];
  activeScriptId: string | null;
  isLoading: boolean;
  error: string | null;

  // Script actions
  loadScripts: () => Promise<void>;
  createScript: (name: string) => Promise<Script>;
  updateScript: (id: string, updates: Partial<Script>) => Promise<void>;
  deleteScript: (id: string) => Promise<void>;
  setActiveScript: (id: string | null) => Promise<void>;

  // Scene actions
  addScene: (scriptId: string, afterSceneId?: string, preId?: string) => Promise<Scene>;
  updateScene: (id: string, updates: Partial<Scene>) => void;
  deleteScene: (id: string) => void;
  restoreScene: (scene: Scene, afterSceneId?: string) => void;
  reorderScenes: (scriptId: string, newOrder: string[]) => void;

  // Draft notes actions
  updateDraftContent: (sceneId: string, content: string) => void;
  createNewDraftVersion: (sceneId: string, content: string, source: 'manual' | 'from-narration-edit') => void;
  setCurrentDraftVersion: (sceneId: string, index: number) => void;
  deleteDraftVersion: (sceneId: string, draftIndex: number) => void;

  // Narration actions
  updateNarration: (sceneId: string, narration: string, fromDraftIndex: number) => void;
  editNarrationWithNewDraft: (sceneId: string, newNarration: string) => void;

  // Narration version actions
  createNarrationVersion: (sceneId: string) => void;
  setNarrationVersion: (sceneId: string, index: number) => void;
  deleteNarrationVersion: (sceneId: string, index: number) => void;

  // Fixed toggle
  toggleFixed: (sceneId: string) => void;

  // Reference actions
  addReference: (sceneId: string, reference: Omit<Reference, 'id'>) => void;
  updateReference: (sceneId: string, refId: string, updates: Partial<Reference>) => void;
  deleteReference: (sceneId: string, refId: string) => void;
  updateReferencesFromText: (sceneId: string, text: string) => void;

  // On-screen text actions
  toggleOnScreenText: (sceneId: string, textId: string) => void;
  updateOnScreenTextsFromText: (sceneId: string, text: string) => void;

  // Persistence
  saveToDb: () => Promise<void>;

  // Helpers
  getActiveScript: () => Script | null;
  getActiveScenes: () => Scene[];
  getSceneById: (id: string) => Scene | undefined;
}

export const useScriptStore = create<ScriptState>()(
  immer((set, get) => ({
    scripts: [],
    scenes: [],
    activeScriptId: null,
    isLoading: false,
    error: null,

    // === Script Actions ===

    loadScripts: async () => {
      set(state => {
        state.isLoading = true;
        state.error = null;
      });

      try {
        const scripts = await db.getAllScripts();
        const storedActiveId = db.getStoredActiveScriptId();
        const validStoredId =
          storedActiveId && scripts.some((s: Script) => s.id === storedActiveId)
            ? storedActiveId
            : null;

        set(state => {
          state.scripts = scripts;
          state.isLoading = !!validStoredId;
          state.activeScriptId = validStoredId;
        });

        if (validStoredId) {
          try {
            const scenes = await db.getScenesForScript(validStoredId);
            set(state => {
              state.scenes = scenes;
              state.isLoading = false;
            });
          } catch {
            set(state => {
              state.scenes = [];
              state.isLoading = false;
            });
          }
        }
      } catch (error) {
        set(state => {
          state.error = 'Failed to load scripts';
          state.isLoading = false;
        });
      }
    },

    createScript: async (name: string) => {
      const script: Script = {
        id: uuidv4(),
        name,
        titleJP: '',
        emoji: '',
        paceWordsPerSec: 2.5,
        voiceProfile: '',
        sceneOrder: [],
        status: 'backlog',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.saveScript(script);

      set(state => {
        state.scripts.unshift(script);
      });

      return script;
    },

    updateScript: async (id: string, updates: Partial<Script>) => {
      set(state => {
        const script = state.scripts.find(s => s.id === id);
        if (script) {
          Object.assign(script, updates, { updatedAt: Date.now() });
        }
      });

      const script = get().scripts.find(s => s.id === id);
      if (script) {
        await db.saveScript(script);
      }
    },

    deleteScript: async (id: string) => {
      await db.deleteScript(id);

      set(state => {
        state.scripts = state.scripts.filter(s => s.id !== id);
        state.scenes = state.scenes.filter(s => s.scriptId !== id);
        if (state.activeScriptId === id) {
          state.activeScriptId = null;
          db.setStoredActiveScriptId(null);
        }
      });
    },

    setActiveScript: async (id: string | null) => {
      db.setStoredActiveScriptId(id);
      set(state => {
        state.activeScriptId = id;
        state.isLoading = true;
      });

      if (id) {
        try {
          const scenes = await db.getScenesForScript(id);
          set(state => {
            state.scenes = scenes;
            state.isLoading = false;
          });
        } catch (error) {
          set(state => {
            state.error = 'Failed to load scenes';
            state.isLoading = false;
          });
        }
      } else {
        set(state => {
          state.scenes = [];
          state.isLoading = false;
        });
      }
    },

    // === Scene Actions ===

    addScene: async (scriptId: string, afterSceneId?: string, preId?: string) => {
      const scene: Scene = {
        id: preId || uuidv4(),
        scriptId,
        title: 'New Scene',
        durationSec: 30,
        isFixed: false,
        draftVersions: [
          {
            index: 0,
            content: '',
            createdAt: Date.now(),
            source: 'manual',
          },
        ],
        currentDraftIndex: 0,
        narration: null,
        narrationGeneratedAt: null,
        narrationFromDraftIndex: null,
        narrationVersions: [],
        currentNarrationVersionIndex: -1,
        onScreenTexts: [],
        references: [],
      };

      // Update React state FIRST (synchronous) so the UI is never in a
      // state where the scene exists but isRevealing is not yet set.
      set(state => {
        state.scenes.push(scene);

        const script = state.scripts.find(s => s.id === scriptId);
        if (script) {
          if (afterSceneId) {
            const afterIndex = script.sceneOrder.indexOf(afterSceneId);
            if (afterIndex !== -1) {
              script.sceneOrder.splice(afterIndex + 1, 0, scene.id);
            } else {
              script.sceneOrder.push(scene.id);
            }
          } else {
            script.sceneOrder.push(scene.id);
          }
          script.updatedAt = Date.now();
        }
      });

      // Persist to DB in background — don't block the UI
      try {
        await db.saveScene(scene);
        const script = get().scripts.find(s => s.id === scriptId);
        if (script) await db.saveScript(script);
      } catch (e) {
        console.error('Failed to persist scene:', e);
      }

      return scene;
    },

    updateScene: (id: string, updates: Partial<Scene>) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === id);
        if (scene) {
          Object.assign(scene, updates);
        }
      });

      // Debounced save would be better in production
      const scene = get().scenes.find(s => s.id === id);
      if (scene) {
        db.saveScene(scene);
      }
    },

    deleteScene: (id: string) => {
      const scene = get().scenes.find(s => s.id === id);
      if (!scene) return;

      set(state => {
        state.scenes = state.scenes.filter(s => s.id !== id);

        // Update script's scene order
        const script = state.scripts.find(s => s.id === scene.scriptId);
        if (script) {
          script.sceneOrder = script.sceneOrder.filter(sId => sId !== id);
          script.updatedAt = Date.now();
        }
      });

      db.deleteScene(id);

      const script = get().scripts.find(s => s.id === scene.scriptId);
      if (script) {
        db.saveScript(script);
      }
    },

    restoreScene: (scene: Scene, afterSceneId?: string) => {
      set(state => {
        state.scenes.push(scene);
        const script = state.scripts.find(s => s.id === scene.scriptId);
        if (script) {
          if (afterSceneId) {
            const idx = script.sceneOrder.indexOf(afterSceneId);
            if (idx !== -1) {
              script.sceneOrder.splice(idx + 1, 0, scene.id);
            } else {
              script.sceneOrder.push(scene.id);
            }
          } else {
            script.sceneOrder.push(scene.id);
          }
          script.updatedAt = Date.now();
        }
      });
      db.saveScene(scene).catch(console.error);
      const script = get().scripts.find(s => s.id === scene.scriptId);
      if (script) db.saveScript(script).catch(console.error);
    },

    reorderScenes: (scriptId: string, newOrder: string[]) => {
      set(state => {
        const script = state.scripts.find(s => s.id === scriptId);
        if (script) {
          script.sceneOrder = newOrder;
          script.updatedAt = Date.now();
        }
      });

      const script = get().scripts.find(s => s.id === scriptId);
      if (script) {
        db.saveScript(script);
      }
    },

    // === Draft Notes Actions ===

    updateDraftContent: (sceneId: string, content: string) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (scene && !scene.isFixed) {
          const currentDraft = scene.draftVersions[scene.currentDraftIndex];
          if (currentDraft) {
            currentDraft.content = content;
          }
        }
      });

      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) {
        db.saveScene(scene);
      }
    },

    createNewDraftVersion: (sceneId: string, content: string, source: 'manual' | 'from-narration-edit') => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (scene && !scene.isFixed) {
          const newDraft: DraftVersion = {
            index: scene.draftVersions.length,
            content,
            createdAt: Date.now(),
            source,
          };
          scene.draftVersions.push(newDraft);
          scene.currentDraftIndex = newDraft.index;
        }
      });

      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) {
        db.saveScene(scene);
      }
    },

    setCurrentDraftVersion: (sceneId: string, index: number) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (scene && index >= 0 && index < scene.draftVersions.length) {
          scene.currentDraftIndex = index;
        }
      });

      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) {
        db.saveScene(scene);
      }
    },

    deleteDraftVersion: (sceneId: string, draftIndex: number) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (!scene || scene.isFixed) return;
        // Must keep at least one draft
        if (scene.draftVersions.length <= 1) return;

        scene.draftVersions.splice(draftIndex, 1);
        // Re-index remaining drafts
        scene.draftVersions.forEach((d, i) => { d.index = i; });
        // Adjust current draft index
        if (scene.currentDraftIndex >= scene.draftVersions.length) {
          scene.currentDraftIndex = scene.draftVersions.length - 1;
        } else if (scene.currentDraftIndex > draftIndex) {
          scene.currentDraftIndex -= 1;
        }
      });

      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) {
        db.saveScene(scene);
      }
    },

    // === Narration Actions ===

    updateNarration: (sceneId: string, narration: string, fromDraftIndex: number) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (scene && !scene.isFixed) {
          scene.narration = narration;
          scene.narrationGeneratedAt = Date.now();
          scene.narrationFromDraftIndex = fromDraftIndex;

          const version: NarrationVersion = {
            id: uuidv4(),
            content: narration,
            wordCount: narration.split(/\s+/).filter(Boolean).length,
            createdAt: Date.now(),
          };
          scene.narrationVersions.push(version);
          scene.currentNarrationVersionIndex = scene.narrationVersions.length - 1;
        }
      });

      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) {
        db.saveScene(scene);
      }
    },

    editNarrationWithNewDraft: (sceneId: string, newNarration: string) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (scene && !scene.isFixed) {
          // Create new draft from narration edit
          const newDraft: DraftVersion = {
            index: scene.draftVersions.length,
            content: newNarration,
            createdAt: Date.now(),
            source: 'from-narration-edit',
          };
          scene.draftVersions.push(newDraft);
          scene.currentDraftIndex = newDraft.index;

          // Update narration
          scene.narration = newNarration;
          // Note: narrationFromDraftIndex stays old to mark as "outdated"
          // because the narration wasn't generated from this draft
        }
      });

      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) {
        db.saveScene(scene);
      }
    },

    // === Narration Version Actions ===

    createNarrationVersion: (sceneId: string) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (!scene) return;
        const version: NarrationVersion = {
          id: uuidv4(),
          content: scene.narration ?? '',
          wordCount: (scene.narration ?? '').split(/\s+/).filter(Boolean).length,
          createdAt: Date.now(),
        };
        scene.narrationVersions.push(version);
        scene.currentNarrationVersionIndex = scene.narrationVersions.length - 1;
      });
      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) db.saveScene(scene);
    },

    setNarrationVersion: (sceneId: string, index: number) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (scene && index >= 0 && index < scene.narrationVersions.length) {
          scene.currentNarrationVersionIndex = index;
          scene.narration = scene.narrationVersions[index].content;
        }
      });
      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) db.saveScene(scene);
    },

    deleteNarrationVersion: (sceneId: string, index: number) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (!scene || scene.narrationVersions.length <= 1) return;
        scene.narrationVersions.splice(index, 1);
        if (scene.currentNarrationVersionIndex >= scene.narrationVersions.length) {
          scene.currentNarrationVersionIndex = scene.narrationVersions.length - 1;
        } else if (scene.currentNarrationVersionIndex > index) {
          scene.currentNarrationVersionIndex -= 1;
        }
        scene.narration = scene.narrationVersions[scene.currentNarrationVersionIndex]?.content ?? null;
      });
      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) db.saveScene(scene);
    },

    // === Fixed Toggle ===

    toggleFixed: (sceneId: string) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (scene) {
          scene.isFixed = !scene.isFixed;
        }
      });

      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) {
        db.saveScene(scene);
      }
    },

    // === Reference Actions ===

    addReference: (sceneId: string, reference: Omit<Reference, 'id'>) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (scene) {
          scene.references.push({
            ...reference,
            id: uuidv4(),
          });
        }
      });

      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) {
        db.saveScene(scene);
      }
    },

    updateReference: (sceneId: string, refId: string, updates: Partial<Reference>) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (scene) {
          const ref = scene.references.find(r => r.id === refId);
          if (ref) {
            Object.assign(ref, updates);
          }
        }
      });

      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) {
        db.saveScene(scene);
      }
    },

    deleteReference: (sceneId: string, refId: string) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (scene) {
          scene.references = scene.references.filter(r => r.id !== refId);
        }
      });

      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) {
        db.saveScene(scene);
      }
    },

    updateReferencesFromText: (sceneId: string, text: string) => {
      // Parse text format: alternating lines — odd = label, even = url
      const lines = text.split('\n');
      const references: { id: string; label: string; url: string; note: string }[] = [];
      let i = 0;
      while (i < lines.length) {
        const label = lines[i].trim();
        i++;
        // Skip empty label lines
        if (!label) continue;
        const url = (i < lines.length ? lines[i].trim() : '');
        // If next line looks like a URL, consume it; otherwise treat as next label
        if (url.startsWith('http://') || url.startsWith('https://')) {
          references.push({ id: crypto.randomUUID(), label, url, note: '' });
          i++;
        } else {
          // No URL for this label
          references.push({ id: crypto.randomUUID(), label, url: '', note: '' });
        }
      }

      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (scene) {
          scene.references = references;
        }
      });

      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) {
        db.saveScene(scene);
      }
    },

    // === On-Screen Text Actions ===

    toggleOnScreenText: (sceneId: string, textId: string) => {
      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (scene) {
          const item = scene.onScreenTexts.find(t => t.id === textId);
          if (item) {
            item.isChecked = !item.isChecked;
          }
        }
      });

      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) {
        db.saveScene(scene);
      }
    },

    updateOnScreenTextsFromText: (sceneId: string, text: string) => {
      // Parse text format: one item per line
      const lines = text.split('\n').filter(line => line.trim());

      set(state => {
        const scene = state.scenes.find(s => s.id === sceneId);
        if (scene) {
          // Build a lookup of existing items by text to preserve checked state
          const existingByText = new Map(
            scene.onScreenTexts.map(item => [item.text, item])
          );

          scene.onScreenTexts = lines.map(line => {
            const trimmed = line.trim();
            const existing = existingByText.get(trimmed);
            if (existing) {
              return existing; // preserve id and isChecked
            }
            return {
              id: uuidv4(),
              text: trimmed,
              isChecked: false,
            };
          });
        }
      });

      const scene = get().scenes.find(s => s.id === sceneId);
      if (scene) {
        db.saveScene(scene);
      }
    },

    // === Persistence ===

    saveToDb: async () => {
      const { scripts, scenes } = get();
      for (const script of scripts) {
        await db.saveScript(script);
      }
      await db.saveScenes(scenes);
    },

    // === Helpers ===

    getActiveScript: () => {
      const { scripts, activeScriptId } = get();
      return scripts.find(s => s.id === activeScriptId) ?? null;
    },

    getActiveScenes: () => {
      const { scenes, activeScriptId } = get();
      return scenes.filter(s => s.scriptId === activeScriptId);
    },

    getSceneById: (id: string) => {
      return get().scenes.find(s => s.id === id);
    },
  }))
);
