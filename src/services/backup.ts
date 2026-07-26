import { exportAllData, importAllData, type ExportData } from './db';
import type { AttachmentExport } from '../types';

/* Còpia de seguretat contínua al GitHub.
 *
 * Cada còpia és un commit en un repo privat de l'Alex:
 *   data.json                     — projectes, columnes i metadades d'adjunts
 *   attachments/<id>__<nom>       — un fitxer binari per adjunt
 *
 * Es fa servir la Git Data API (blobs → tree → commit → ref) perquè un sol
 * JSON amb tots els adjunts en base64 petaria el límit de 100 MB per fitxer.
 * Els adjunts que no han canviat no es tornen a pujar: comparem el seu sha de
 * git (sha1 de "blob <mida>\0<bytes>") amb el que ja hi ha a l'arbre.
 *
 * El token (fine-grained, només permís Contents sobre el repo de còpies) i la
 * resta de configuració viuen a localStorage — per tant són per navegador.
 * L'API key d'OpenAI NO s'inclou mai a la còpia: és un secret i no ha d'anar
 * a cap repo, ni que sigui privat.
 */

const KEY_TOKEN = 'github_backup_token';
const KEY_REPO = 'github_backup_repo';
const KEY_BRANCH = 'github_backup_branch';
const KEY_AUTO = 'github_backup_auto';
const KEY_STATE = 'github_backup_state';

const AUTO_INTERVAL_MS = 3 * 60 * 1000;
const API = 'https://api.github.com';

export interface BackupConfig {
  token: string;
  repo: string; // "usuari/repositori"
  branch: string; // buit = branca per defecte del repo
  auto: boolean;
}

export interface BackupState {
  at: number; // timestamp de l'última còpia bona
  sha: string; // commit de l'última còpia
  fingerprint: string; // empremta de les dades copiades
  error?: string; // últim error, si l'última execució va fallar
}

// === Configuració ===

export function getBackupConfig(): BackupConfig {
  return {
    token: localStorage.getItem(KEY_TOKEN) ?? '',
    repo: (localStorage.getItem(KEY_REPO) ?? '').trim(),
    branch: (localStorage.getItem(KEY_BRANCH) ?? '').trim(),
    auto: localStorage.getItem(KEY_AUTO) !== '0', // activada per defecte
  };
}

export function setBackupConfig(partial: Partial<BackupConfig>): void {
  if (partial.token !== undefined) localStorage.setItem(KEY_TOKEN, partial.token);
  if (partial.repo !== undefined) localStorage.setItem(KEY_REPO, partial.repo.trim());
  if (partial.branch !== undefined) localStorage.setItem(KEY_BRANCH, partial.branch.trim());
  if (partial.auto !== undefined) localStorage.setItem(KEY_AUTO, partial.auto ? '1' : '0');
}

export function hasBackupConfig(): boolean {
  const { token, repo } = getBackupConfig();
  return token.length > 0 && /^[^/\s]+\/[^/\s]+$/.test(repo);
}

export function getBackupState(): BackupState | null {
  try {
    const raw = localStorage.getItem(KEY_STATE);
    return raw ? (JSON.parse(raw) as BackupState) : null;
  } catch {
    return null;
  }
}

function setBackupState(state: BackupState): void {
  localStorage.setItem(KEY_STATE, JSON.stringify(state));
}

// === Client de l'API ===

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const { token } = getBackupConfig();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) detail = `${res.status} ${body.message}`;
    } catch { /* cos no JSON */ }
    throw new GhError(res.status, detail, path);
  }
  return res.json() as Promise<T>;
}

class GhError extends Error {
  status: number;
  constructor(status: number, message: string, path: string) {
    super(`GitHub ${message} (${path})`);
    this.status = status;
  }
}

async function ghRaw(path: string): Promise<ArrayBuffer> {
  const { token } = getBackupConfig();
  const res = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.raw+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new GhError(res.status, `${res.status}`, path);
  return res.arrayBuffer();
}

// === base64 i sha de git ===

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/* sha1 de git per a un blob: "blob <mida>\0" + contingut.
   Si crypto.subtle no hi és, retornem null i el blob es puja sempre. */
async function gitBlobSha(bytes: Uint8Array): Promise<string | null> {
  try {
    const header = new TextEncoder().encode(`blob ${bytes.length}\0`);
    const full = new Uint8Array(header.length + bytes.length);
    full.set(header);
    full.set(bytes, header.length);
    const digest = await crypto.subtle.digest('SHA-1', full);
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/* Empremta barata de l'estat: si no canvia, la còpia automàtica no fa res. */
function fingerprintOf(data: ExportData): string {
  const content = JSON.stringify({ s: data.scripts, c: data.scenes });
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
  }
  const atts = (data.attachments ?? [])
    .map(a => `${a.id}:${a.size}:${a.name}`)
    .sort()
    .join(',');
  return `${data.scripts.length}|${data.scenes.length}|${hash}|${atts}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.·-]+/gu, '-').replace(/-{2,}/g, '-').slice(0, 60);
}

function attachmentPath(a: { id: string; name: string }): string {
  return `attachments/${a.id}__${sanitizeFilename(a.name)}`;
}

// === El manifest que viu a data.json ===

interface ManifestAttachment extends Omit<AttachmentExport, 'dataBase64'> {
  path: string;
}

interface BackupManifest {
  version: number;
  exportedAt: number;
  scripts: ExportData['scripts'];
  scenes: ExportData['scenes'];
  attachments: ManifestAttachment[];
}

// === Còpia ===

interface TreeEntry {
  path: string;
  mode: '100644';
  type: 'blob';
  sha?: string | null;
  content?: string;
}

let backupInFlight: Promise<BackupResult> | null = null;

export interface BackupResult {
  skipped: boolean;
  sha?: string;
  uploadedFiles?: number;
}

export function runBackup(reason: 'auto' | 'manual'): Promise<BackupResult> {
  // Mai dues còpies alhora (interval + botó manual)
  if (backupInFlight) return backupInFlight;
  backupInFlight = doBackup(reason).finally(() => {
    backupInFlight = null;
  });
  return backupInFlight;
}

async function doBackup(reason: 'auto' | 'manual', retried = false): Promise<BackupResult> {
  const cfg = getBackupConfig();
  if (!hasBackupConfig()) throw new Error('Configura el repositori i el token a Configuració');

  const data = await exportAllData();
  const fingerprint = fingerprintOf(data);
  const prev = getBackupState();
  if (reason === 'auto' && prev && !prev.error && prev.fingerprint === fingerprint) {
    return { skipped: true };
  }

  try {
    const branch = cfg.branch || (await gh<{ default_branch: string }>(`/repos/${cfg.repo}`)).default_branch;

    // Punta de la branca; en un repo acabat de crear encara no existeix
    let headSha: string;
    try {
      const ref = await gh<{ object: { sha: string } }>(`/repos/${cfg.repo}/git/ref/heads/${branch}`);
      headSha = ref.object.sha;
    } catch (e) {
      if (!(e instanceof GhError) || e.status !== 404) throw e;
      // Primer commit del repo: el crea la Contents API
      await gh(`/repos/${cfg.repo}/contents/README.md`, {
        method: 'PUT',
        body: JSON.stringify({
          message: 'Inicialitza el repositori de còpies de SceneScript',
          content: btoa('# Copies de seguretat de SceneScript\n\nGenerat automaticament. No editar a ma.\n'),
          branch,
        }),
      });
      const ref = await gh<{ object: { sha: string } }>(`/repos/${cfg.repo}/git/ref/heads/${branch}`);
      headSha = ref.object.sha;
    }

    const headCommit = await gh<{ tree: { sha: string } }>(`/repos/${cfg.repo}/git/commits/${headSha}`);
    const headTree = await gh<{ tree: { path: string; sha: string }[]; truncated: boolean }>(
      `/repos/${cfg.repo}/git/trees/${headCommit.tree.sha}?recursive=1`,
    );
    const existing = new Map(headTree.tree.map(t => [t.path, t.sha]));

    // Adjunts: només es puja el que ha canviat
    const entries: TreeEntry[] = [];
    const wanted = new Set<string>();
    let uploadedFiles = 0;
    const manifestAttachments: ManifestAttachment[] = [];

    for (const att of data.attachments ?? []) {
      const { dataBase64, ...meta } = att;
      const path = attachmentPath(att);
      wanted.add(path);
      manifestAttachments.push({ ...meta, path });

      const localSha = await gitBlobSha(base64ToBytes(dataBase64));
      if (localSha && existing.get(path) === localSha) continue; // ja hi és, idèntic

      const blob = await gh<{ sha: string }>(`/repos/${cfg.repo}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: dataBase64, encoding: 'base64' }),
      });
      uploadedFiles++;
      entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // Adjunts esborrats de l'app → fora de la còpia (la història els conserva)
    for (const [path] of existing) {
      if (path.startsWith('attachments/') && !wanted.has(path)) {
        entries.push({ path, mode: '100644', type: 'blob', sha: null });
      }
    }

    const manifest: BackupManifest = {
      version: data.version,
      exportedAt: data.exportedAt,
      scripts: data.scripts,
      scenes: data.scenes,
      attachments: manifestAttachments,
    };
    entries.push({
      path: 'data.json',
      mode: '100644',
      type: 'blob',
      content: JSON.stringify(manifest, null, 2),
    });

    const tree = await gh<{ sha: string }>(`/repos/${cfg.repo}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: entries }),
    });

    const nAdj = manifestAttachments.length;
    const commit = await gh<{ sha: string }>(`/repos/${cfg.repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message: `Còpia ${reason === 'auto' ? 'automàtica' : 'manual'} — ${data.scripts.length} projectes, ${nAdj} adjunts`,
        tree: tree.sha,
        parents: [headSha],
      }),
    });

    await gh(`/repos/${cfg.repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha }),
    });

    setBackupState({ at: Date.now(), sha: commit.sha, fingerprint });
    return { skipped: false, sha: commit.sha, uploadedFiles };
  } catch (e) {
    // La branca s'ha mogut mentre copiàvem (una altra pestanya): reintenta un cop
    if (e instanceof GhError && e.status === 422 && !retried) {
      return doBackup(reason, true);
    }
    const state = getBackupState();
    setBackupState({
      at: state?.at ?? 0,
      sha: state?.sha ?? '',
      fingerprint: state?.fingerprint ?? '',
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

// === Restauració ===

export async function restoreFromGitHub(): Promise<{ scriptsImported: number; scenesImported: number }> {
  const cfg = getBackupConfig();
  if (!hasBackupConfig()) throw new Error('Configura el repositori i el token a Configuració');

  const branch = cfg.branch || (await gh<{ default_branch: string }>(`/repos/${cfg.repo}`)).default_branch;
  const raw = await ghRaw(`/repos/${cfg.repo}/contents/data.json?ref=${branch}`);
  const manifest = JSON.parse(new TextDecoder().decode(raw)) as BackupManifest;

  const attachments: AttachmentExport[] = [];
  for (const meta of manifest.attachments ?? []) {
    const { path, ...rest } = meta;
    const bytes = await ghRaw(`/repos/${cfg.repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${branch}`);
    attachments.push({ ...rest, dataBase64: bytesToBase64(new Uint8Array(bytes)) });
  }

  const data: ExportData = {
    version: manifest.version,
    exportedAt: manifest.exportedAt,
    scripts: manifest.scripts,
    scenes: manifest.scenes,
    attachments,
    settings: { apiKey: null, model: '' }, // els secrets no viatgen amb la còpia
  };

  return importAllData(data, 'replace');
}

// A la consola en dev, com resetDatabase(): permet provar la còpia a mà
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__backup = {
    runBackup,
    restoreFromGitHub,
    getBackupConfig,
    setBackupConfig,
    getBackupState,
  };
}

// === Còpia automàtica ===

let warnedThisSession = false;

/* Arrenca el bucle de còpia automàtica. Retorna la funció d'aturada. */
export function startAutoBackup(onError?: (message: string) => void): () => void {
  const tick = async () => {
    const cfg = getBackupConfig();
    if (!cfg.auto || !hasBackupConfig()) return;
    try {
      await runBackup('auto');
    } catch (e) {
      console.error('[backup] còpia automàtica fallida:', e);
      if (!warnedThisSession) {
        warnedThisSession = true;
        onError?.(e instanceof Error ? e.message : String(e));
      }
    }
  };

  const interval = setInterval(tick, AUTO_INTERVAL_MS);
  const initial = setTimeout(tick, 15_000); // primera passada poc després d'obrir
  return () => {
    clearInterval(interval);
    clearTimeout(initial);
  };
}
