import Dexie, { type Table } from 'dexie';
import type { Script, Scene, Attachment, AttachmentExport } from '../types';
import { makeDefaultCategories, getVideoCategory } from '../utils/projectTemplate';

// Schema version - increment this when you change data structure
const CURRENT_SCHEMA_VERSION = 6;
const SCHEMA_VERSION_KEY = 'scenescript_schema_version';

export class SceneScriptDB extends Dexie {
  scripts!: Table<Script>;
  scenes!: Table<Scene>;
  attachments!: Table<Attachment>;

  constructor() {
    super('SceneScriptDB');

    // Version 1: Initial schema
    this.version(1).stores({
      scripts: 'id, name, updatedAt',
      scenes: 'id, scriptId',
    });

    // Version 2: Added status field to Script
    this.version(2)
      .stores({
        scripts: 'id, name, updatedAt, status',
        scenes: 'id, scriptId',
      })
      .upgrade(async tx => {
        // Migrate existing scripts to add status field
        const scripts = await tx.table('scripts').toArray();
        for (const script of scripts) {
          if (!script.status) {
            script.status = 'backlog';
            await tx.table('scripts').put(script);
          }
        }
      });

    // Version 3: Added emoji field to Script
    this.version(3)
      .stores({
        scripts: 'id, name, updatedAt, status',
        scenes: 'id, scriptId',
      })
      .upgrade(async tx => {
        const scripts = await tx.table('scripts').toArray();
        for (const script of scripts) {
          if (typeof script.emoji === 'undefined') {
            script.emoji = '';
            await tx.table('scripts').put(script);
          }
        }
      });

    // Version 4: Added titleJP field to Script
    this.version(4)
      .stores({
        scripts: 'id, name, updatedAt, status',
        scenes: 'id, scriptId',
      })
      .upgrade(async tx => {
        const scripts = await tx.table('scripts').toArray();
        for (const script of scripts) {
          if (typeof script.titleJP === 'undefined') {
            script.titleJP = '';
            await tx.table('scripts').put(script);
          }
        }
      });

    // Version 5: Added narrationVersions to Scene
    this.version(5)
      .stores({
        scripts: 'id, name, updatedAt, status',
        scenes: 'id, scriptId',
      })
      .upgrade(async tx => {
        const scenes = await tx.table('scenes').toArray();
        for (const scene of scenes) {
          if (!Array.isArray(scene.narrationVersions)) {
            scene.narrationVersions = [];
            scene.currentNarrationVersionIndex = -1;
            await tx.table('scenes').put(scene);
          }
        }
      });

    // Version 6: Project sub-categories (tabs) + file attachments.
    // - Script.categories: 4 renamable tabs; per-tab sceneOrder replaces Script.sceneOrder
    // - Scene.categoryId: which tab each scene lives in
    // - attachments table: PDF/PNG/JPG blobs per scene
    // Existing scripts ARE video scripts, so their scenes move to the video tab.
    this.version(6)
      .stores({
        scripts: 'id, name, updatedAt, status',
        scenes: 'id, scriptId',
        attachments: 'id, sceneId, scriptId',
      })
      .upgrade(async tx => {
        const scripts = await tx.table('scripts').toArray();
        for (const script of scripts) {
          if (!Array.isArray(script.categories) || script.categories.length === 0) {
            script.categories = makeDefaultCategories();
            const video = getVideoCategory(script.categories)!;
            video.sceneOrder = Array.isArray(script.sceneOrder) ? [...script.sceneOrder] : [];
            await tx.table('scripts').put(script);

            const scenes = await tx.table('scenes').where('scriptId').equals(script.id).toArray();
            for (const scene of scenes) {
              if (typeof scene.categoryId !== 'string') {
                scene.categoryId = video.id;
                await tx.table('scenes').put(scene);
              }
            }
          }
        }
      });
  }
}

// Backfill v6 fields on a script loaded from an older source (old export file,
// weird partial state). Mutates in place. Returns the video category id so the
// caller can also assign orphan scenes. NEVER makes validation fail — a missing
// new field must not trigger the clear-database path in initializeDatabase.
export function ensureScriptCategories(script: Partial<Script>): string {
  if (!Array.isArray(script.categories) || script.categories.length === 0) {
    script.categories = makeDefaultCategories();
    const video = getVideoCategory(script.categories)!;
    video.sceneOrder = Array.isArray(script.sceneOrder) ? [...script.sceneOrder] : [];
    return video.id;
  }
  return getVideoCategory(script.categories)?.id ?? script.categories[0].id;
}

// Validate that stored data matches current schema
function validateScript(script: any): script is Script {
  // Default new fields
  if (script && typeof script.emoji === 'undefined') {
    script.emoji = '';
  }
  if (script && typeof script.titleJP === 'undefined') {
    script.titleJP = '';
  }
  if (script) {
    ensureScriptCategories(script);
  }
  return (
    typeof script.id === 'string' &&
    typeof script.name === 'string' &&
    typeof script.paceWordsPerSec === 'number' &&
    typeof script.voiceProfile === 'string' &&
    Array.isArray(script.sceneOrder) &&
    typeof script.status === 'string' &&
    ['backlog', 'in-progress', 'done'].includes(script.status) &&
    typeof script.createdAt === 'number' &&
    typeof script.updatedAt === 'number'
  );
}

export function validateScene(scene: any): scene is Scene {
  if (scene && !Array.isArray(scene.narrationVersions)) {
    scene.narrationVersions = [];
    scene.currentNarrationVersionIndex = -1;
  }
  if (scene && typeof scene.categoryId !== 'string') {
    scene.categoryId = ''; // repaired by ensureScriptCategories callers / import
  }
  return (
    typeof scene.id === 'string' &&
    typeof scene.scriptId === 'string' &&
    typeof scene.title === 'string' &&
    typeof scene.durationSec === 'number' &&
    typeof scene.isFixed === 'boolean' &&
    Array.isArray(scene.draftVersions) &&
    typeof scene.currentDraftIndex === 'number' &&
    Array.isArray(scene.onScreenTexts) &&
    Array.isArray(scene.references)
  );
}

// Check if we need to reset the database due to schema changes
async function checkSchemaVersion(): Promise<boolean> {
  const storedVersion = localStorage.getItem(SCHEMA_VERSION_KEY);
  
  if (!storedVersion) {
    // First time - store current version
    localStorage.setItem(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION.toString());
    return true; // Schema is valid
  }

  const stored = parseInt(storedVersion, 10);
  
  if (stored < CURRENT_SCHEMA_VERSION) {
    console.log(`Schema upgraded from v${stored} to v${CURRENT_SCHEMA_VERSION}`);
    localStorage.setItem(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION.toString());
    // Let Dexie handle the migration
    return true;
  }

  if (stored > CURRENT_SCHEMA_VERSION) {
    // User has newer data (e.g., from a newer version, then downgraded)
    console.warn('Data schema is newer than app version. Resetting database.');
    await clearAllData();
    localStorage.setItem(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION.toString());
    return false; // Data was reset
  }

  return true; // Versions match
}

// Initialize database and validate schema
export async function initializeDatabase(): Promise<void> {
  await checkSchemaVersion();
  
  // Validate existing data
  try {
    const scripts = await db.scripts.toArray();
    let hasInvalidData = false;

    for (const script of scripts) {
      if (!validateScript(script)) {
        console.warn('Invalid script data detected:', script);
        hasInvalidData = true;
        break;
      }
    }

    if (hasInvalidData) {
      console.warn('Invalid data structure detected. Clearing database.');
      await clearAllData();
      localStorage.setItem(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION.toString());
    }
  } catch (error) {
    console.error('Database validation failed:', error);
    await clearAllData();
    localStorage.setItem(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION.toString());
  }
}

export const db = new SceneScriptDB();

// === Avisador d'escriptures ===
// La còpia automàtica s'hi subscriu per pujar els canvis poc després
// d'editar, en lloc d'esperar el proper interval.

const dataWrittenListeners = new Set<() => void>();

export function onDataWritten(listener: () => void): () => void {
  dataWrittenListeners.add(listener);
  return () => dataWrittenListeners.delete(listener);
}

function notifyDataWritten(): void {
  for (const listener of dataWrittenListeners) listener();
}

// === Script Operations ===

export async function getAllScripts(): Promise<Script[]> {
  return db.scripts.orderBy('updatedAt').reverse().toArray();
}

export async function getScript(id: string): Promise<Script | undefined> {
  return db.scripts.get(id);
}

export async function saveScript(script: Script): Promise<void> {
  await db.scripts.put(script);
  notifyDataWritten();
}

export async function deleteScript(id: string): Promise<void> {
  await db.transaction('rw', [db.scripts, db.scenes, db.attachments], async () => {
    // Delete all attachments and scenes for this script
    await db.attachments.where('scriptId').equals(id).delete();
    await db.scenes.where('scriptId').equals(id).delete();
    // Delete the script
    await db.scripts.delete(id);
  });
  notifyDataWritten();
}

// === Scene Operations ===

export async function getScenesForScript(scriptId: string): Promise<Scene[]> {
  return db.scenes.where('scriptId').equals(scriptId).toArray();
}

export async function getScene(id: string): Promise<Scene | undefined> {
  return db.scenes.get(id);
}

export async function saveScene(scene: Scene): Promise<void> {
  await db.scenes.put(scene);
  notifyDataWritten();
}

export async function saveScenes(scenes: Scene[]): Promise<void> {
  await db.scenes.bulkPut(scenes);
  notifyDataWritten();
}

export async function deleteScene(id: string): Promise<void> {
  await db.transaction('rw', [db.scenes, db.attachments], async () => {
    await db.attachments.where('sceneId').equals(id).delete();
    await db.scenes.delete(id);
  });
  notifyDataWritten();
}

// === Attachment Operations ===

export async function saveAttachment(attachment: Attachment): Promise<void> {
  await db.attachments.put(attachment);
  notifyDataWritten();
}

export async function getAttachmentsForScript(scriptId: string): Promise<Attachment[]> {
  return db.attachments.where('scriptId').equals(scriptId).toArray();
}

export async function deleteAttachment(id: string): Promise<void> {
  await db.attachments.delete(id);
  notifyDataWritten();
}

// Only touches the name — the blob is left untouched in IndexedDB.
export async function renameAttachment(id: string, name: string): Promise<void> {
  await db.attachments.update(id, { name });
  notifyDataWritten();
}

// === Bulk Operations ===

export async function saveScriptWithScenes(
  script: Script,
  scenes: Scene[]
): Promise<void> {
  await db.transaction('rw', [db.scripts, db.scenes], async () => {
    await db.scripts.put(script);
    await db.scenes.bulkPut(scenes);
  });
  notifyDataWritten();
}

// === Export / Import ===

export interface ExportData {
  version: number;
  exportedAt: number;
  scripts: Script[];
  scenes: Scene[];
  attachments?: AttachmentExport[]; // v6+; absent in older export files
  settings: {
    apiKey: string | null;
    model: string;
  };
}

// Blob ↔ base64 — chunked so large plans/PDFs don't blow the call stack
async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export async function exportAllData(): Promise<ExportData> {
  const scripts = await db.scripts.toArray();
  const scenes = await db.scenes.toArray();
  const attachments = await db.attachments.toArray();

  const attachmentExports: AttachmentExport[] = [];
  for (const a of attachments) {
    const { blob, ...meta } = a;
    attachmentExports.push({ ...meta, dataBase64: await blobToBase64(blob) });
  }

  return {
    version: CURRENT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    scripts,
    scenes,
    attachments: attachmentExports,
    settings: {
      apiKey: getStoredApiKey(),
      model: getStoredModel(),
    },
  };
}

export async function importAllData(data: ExportData, mode: 'merge' | 'replace' = 'replace'): Promise<{ scriptsImported: number; scenesImported: number }> {
  // Basic validation
  if (!data || !Array.isArray(data.scripts) || !Array.isArray(data.scenes)) {
    throw new Error('Invalid export file format');
  }

  // Normalize pre-v6 export files: create default categories and put the
  // script's scenes in its video tab, mirroring the v6 Dexie migration.
  for (const script of data.scripts) {
    const videoCategoryId = ensureScriptCategories(script);
    for (const scene of data.scenes) {
      if (scene.scriptId === script.id && typeof (scene as Partial<Scene>).categoryId !== 'string') {
        scene.categoryId = videoCategoryId;
      }
    }
  }

  const attachments: Attachment[] = (data.attachments ?? []).map(a => {
    const { dataBase64, ...meta } = a;
    return { ...meta, blob: base64ToBlob(dataBase64, a.mimeType) };
  });

  if (mode === 'replace') {
    await clearAllData();
  }

  await db.transaction('rw', [db.scripts, db.scenes, db.attachments], async () => {
    await db.scripts.bulkPut(data.scripts);
    await db.scenes.bulkPut(data.scenes);
    if (attachments.length > 0) {
      await db.attachments.bulkPut(attachments);
    }
  });

  // Restore settings if present
  if (data.settings) {
    if (data.settings.apiKey) {
      setStoredApiKey(data.settings.apiKey);
    }
    if (data.settings.model) {
      setStoredModel(data.settings.model);
    }
  }

  return {
    scriptsImported: data.scripts.length,
    scenesImported: data.scenes.length,
  };
}

export function downloadJson(data: ExportData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().slice(0, 10);
  const filename = `scenescript-backup-${date}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function pickAndReadJsonFile(): Promise<ExportData> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const text = await file.text();
        const data = JSON.parse(text) as ExportData;
        resolve(data);
      } catch {
        reject(new Error('Failed to read or parse file'));
      }
    };

    input.oncancel = () => reject(new Error('Cancelled'));
    input.click();
  });
}

// === Database Reset ===

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.scripts, db.scenes, db.attachments], async () => {
    await db.scripts.clear();
    await db.scenes.clear();
    await db.attachments.clear();
  });
}

// Development helper - force schema reset
export async function forceSchemaReset(): Promise<void> {
  console.log('Forcing database reset...');
  await clearAllData();
  localStorage.setItem(SCHEMA_VERSION_KEY, CURRENT_SCHEMA_VERSION.toString());
  console.log(`Database cleared and schema version set to ${CURRENT_SCHEMA_VERSION}`);
  console.log('Reload the page to reinitialize.');
}

// Expose reset function to browser console in development
if (import.meta.env.DEV) {
  (window as any).resetDatabase = forceSchemaReset;
  (window as unknown as Record<string, unknown>).__db = { exportAllData, importAllData, clearAllData };
  console.log('💡 Development mode: Call resetDatabase() to force clear database');
}

// === API Key Storage (using localStorage) ===

const API_KEY_STORAGE_KEY = 'scenescript_openai_key';

export function getStoredApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setStoredApiKey(key: string | null): void {
  if (key) {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }
}

// === Model Storage (using localStorage) ===

const MODEL_STORAGE_KEY = 'scenescript_openai_model';
const DEFAULT_MODEL = 'gpt-4o';

export function getStoredModel(): string {
  return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
}

export function setStoredModel(model: string): void {
  if (model.trim()) {
    localStorage.setItem(MODEL_STORAGE_KEY, model.trim());
  } else {
    localStorage.removeItem(MODEL_STORAGE_KEY);
  }
}

// === Base URL Storage (OpenAI-compatible endpoint) ===

const BASE_URL_STORAGE_KEY = 'scenescript_base_url';
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

export function getStoredBaseUrl(): string {
  return localStorage.getItem(BASE_URL_STORAGE_KEY) || DEFAULT_BASE_URL;
}

export function setStoredBaseUrl(url: string): void {
  const trimmed = url.trim().replace(/\/$/, ''); // strip trailing slash
  if (trimmed) {
    localStorage.setItem(BASE_URL_STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(BASE_URL_STORAGE_KEY);
  }
}

// === Active Script (last opened) — restore on return ===

const ACTIVE_SCRIPT_STORAGE_KEY = 'scenescript_active_script_id';

export function getStoredActiveScriptId(): string | null {
  return localStorage.getItem(ACTIVE_SCRIPT_STORAGE_KEY);
}

export function setStoredActiveScriptId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_SCRIPT_STORAGE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_SCRIPT_STORAGE_KEY);
  }
}
