import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useScriptStore } from '../stores/scriptStore';
import { useUIStore } from '../stores/uiStore';
import type React from 'react';
import {
  getStoredModel,
  setStoredModel,
  getStoredApiKey,
  setStoredApiKey,
  getStoredBaseUrl,
  setStoredBaseUrl,
} from '../services/db';
import {
  getBackupConfig,
  setBackupConfig,
  getBackupState,
  hasBackupConfig,
  runBackup,
  restoreFromGitHub,
} from '../services/backup';

const inputStyle: React.CSSProperties = {
  height: 40, borderRadius: 8, border: '0.5px solid #E6E6E6',
  paddingLeft: 10, fontSize: 13, outline: 'none', flexShrink: 0,
  margin: 0, background: 'transparent', fontWeight: 500, width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, color: 'rgba(0,0,0,0.4)',
  marginBottom: 6, display: 'block',
};

export function SettingsModal() {
  const { getActiveScript, updateScript, loadScripts } = useScriptStore();
  const {
    settingsModalOpen, setSettingsModalOpen, addToast,
    mainFontSize, mainLineHeight,
    setMainFontSize, setMainLineHeight,
  } = useUIStore();

  const script = getActiveScript();
  const [model, setModel] = useState(getStoredModel());
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(getStoredBaseUrl());

  // Còpia de seguretat al GitHub
  const [backupRepo, setBackupRepo] = useState('');
  const [backupToken, setBackupToken] = useState('');
  const [showBackupToken, setShowBackupToken] = useState(false);
  const [backupAuto, setBackupAuto] = useState(true);
  const [backupBusy, setBackupBusy] = useState<'backup' | 'restore' | null>(null);
  const [restoreArmed, setRestoreArmed] = useState(false);
  const [backupStatus, setBackupStatus] = useState(() => getBackupState());

  useEffect(() => {
    if (settingsModalOpen) {
      setModel(getStoredModel());
      setBaseUrl(getStoredBaseUrl());
      const stored = getStoredApiKey();
      setApiKey(stored ?? '');
      const cfg = getBackupConfig();
      setBackupRepo(cfg.repo);
      setBackupToken(cfg.token);
      setBackupAuto(cfg.auto);
      setBackupStatus(getBackupState());
      setRestoreArmed(false);
    }
  }, [settingsModalOpen]);

  useEffect(() => {
    if (!settingsModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsModalOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [settingsModalOpen, setSettingsModalOpen]);

  const handleModelChange = (value: string) => {
    setModel(value);
    setStoredModel(value);
  };

  const handleBaseUrlChange = (value: string) => {
    setBaseUrl(value);
    setStoredBaseUrl(value);
  };

  const handleApiKeySave = () => {
    const trimmed = apiKey.trim();
    setStoredApiKey(trimmed || null);
    addToast({ type: 'success', message: trimmed ? 'API key saved' : 'API key removed' });
  };

  const handlePaceChange = (value: string) => {
    if (!script) return;
    const pace = parseFloat(value);
    if (!isNaN(pace) && pace > 0) {
      updateScript(script.id, { paceWordsPerSec: pace });
    }
  };

  const handleBackupNow = async () => {
    setBackupBusy('backup');
    try {
      const result = await runBackup('manual');
      setBackupStatus(getBackupState());
      addToast({
        type: 'success',
        message: result.skipped
          ? 'Res a copiar: tot ja és al GitHub'
          : `Còpia feta (${result.uploadedFiles} fitxer${result.uploadedFiles === 1 ? '' : 's'} pujats)`,
      });
    } catch (e) {
      setBackupStatus(getBackupState());
      addToast({
        type: 'error',
        message: `Còpia fallida: ${e instanceof Error ? e.message : 'error desconegut'}`,
      });
    } finally {
      setBackupBusy(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreArmed) {
      setRestoreArmed(true);
      return;
    }
    setRestoreArmed(false);
    setBackupBusy('restore');
    try {
      const { scriptsImported } = await restoreFromGitHub();
      await loadScripts();
      addToast({
        type: 'success',
        message: `Còpia restaurada: ${scriptsImported} projecte${scriptsImported === 1 ? '' : 's'}`,
      });
      setSettingsModalOpen(false);
    } catch (e) {
      addToast({
        type: 'error',
        message: `No s'ha pogut restaurar: ${e instanceof Error ? e.message : 'error desconegut'}`,
      });
    } finally {
      setBackupBusy(null);
    }
  };

  const backupStatusText = (() => {
    if (!hasBackupConfig()) return 'Sense configurar';
    if (backupStatus?.error) return `Error: ${backupStatus.error}`;
    if (backupStatus?.at) {
      const mins = Math.round((Date.now() - backupStatus.at) / 60000);
      const when = mins < 1 ? 'ara mateix' : mins < 60 ? `fa ${mins} min` : new Date(backupStatus.at).toLocaleString('ca-ES');
      return `Última còpia: ${when} · ${backupStatus.sha.slice(0, 7)}`;
    }
    return 'Encara no s\'ha fet cap còpia';
  })();

  if (!settingsModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={() => setSettingsModalOpen(false)}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        style={{
          position: 'fixed',
          left: 200, top: '50%',
          transform: 'translateY(-50%)',
          maxHeight: 'calc(100vh - 60px)',
          overflowY: 'auto',
          width: 314,
          borderRadius: 16,
          border: '0.5px solid #E6E6E6',
          background: 'white',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          animation: 'ref-dialog-in 0.25s cubic-bezier(0.2, 0, 0, 1) both',
        }}
        onClick={e => e.stopPropagation()}
      >
          <div style={{ height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-headline)', fontSize: 18, textTransform: 'uppercase' }}>Settings</span>
          </div>

          {/* Base URL */}
          <div>
            <span style={labelStyle}>API Base URL</span>
            <input
              type="text"
              value={baseUrl}
              onChange={e => handleBaseUrlChange(e.target.value)}
              placeholder="https://api.openai.com/v1 or a compatible endpoint"
              style={inputStyle}
            />
          </div>

          {/* API Key */}
          <div>
            <span style={labelStyle}>API Key</span>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onBlur={handleApiKeySave}
                placeholder="sk-..."
                style={{ ...inputStyle, paddingRight: 36 }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(0,0,0,0.3)', padding: 4,
                }}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Model */}
          <div>
            <span style={labelStyle}>Model</span>
            <input
              type="text"
              value={model}
              onChange={e => handleModelChange(e.target.value)}
              placeholder="gpt-4.1"
              style={inputStyle}
            />
          </div>

          {/* Pace */}
          {script && (
            <div>
              <span style={labelStyle}>Pace (words/sec)</span>
              <input
                type="number"
                value={script.paceWordsPerSec}
                onChange={e => handlePaceChange(e.target.value)}
                step="0.1"
                min="0.5"
                max="5"
                style={inputStyle}
              />
            </div>
          )}

          {/* Typography */}
          <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', paddingTop: 16 }}>
            <span style={{ ...labelStyle, marginBottom: 12, display: 'block' }}>Typography</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, marginBottom: 0, width: 100, flexShrink: 0 }}>Font size (px)</span>
                <input
                  type="number"
                  value={mainFontSize}
                  onChange={e => setMainFontSize(Number(e.target.value))}
                  min={10} max={20} step={0.5}
                  style={{ ...inputStyle, width: 'auto', flex: 1, flexShrink: 1, minWidth: 0 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...labelStyle, marginBottom: 0, width: 100, flexShrink: 0 }}>Line height</span>
                <input
                  type="number"
                  value={mainLineHeight}
                  onChange={e => setMainLineHeight(Number(e.target.value))}
                  min={1} max={2.5} step={0.05}
                  style={{ ...inputStyle, width: 'auto', flex: 1, flexShrink: 1, minWidth: 0 }}
                />
              </div>
            </div>
          </div>

          {/* Còpia de seguretat al GitHub */}
          <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)', paddingTop: 16 }}>
            <span style={{ ...labelStyle, marginBottom: 12 }}>Còpia de seguretat (GitHub)</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="text"
                value={backupRepo}
                onChange={e => { setBackupRepo(e.target.value); setBackupConfig({ repo: e.target.value }); }}
                placeholder="usuari/repositori (privat)"
                style={inputStyle}
                spellCheck={false}
              />
              <div style={{ position: 'relative' }}>
                <input
                  type={showBackupToken ? 'text' : 'password'}
                  value={backupToken}
                  onChange={e => { setBackupToken(e.target.value); setBackupConfig({ token: e.target.value }); }}
                  placeholder="github_pat_…"
                  style={{ ...inputStyle, paddingRight: 36 }}
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowBackupToken(!showBackupToken)}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(0,0,0,0.3)', padding: 4,
                  }}
                >
                  {showBackupToken ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p style={{ fontSize: 10, lineHeight: 1.5, color: 'rgba(0,0,0,0.35)', margin: 0 }}>
                Token fine-grained amb permís <b>Contents (read i write)</b> només
                sobre el repositori de còpies. Es guarda en aquest navegador.
              </p>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>
                <input
                  type="checkbox"
                  checked={backupAuto}
                  onChange={e => { setBackupAuto(e.target.checked); setBackupConfig({ auto: e.target.checked }); }}
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                Còpia automàtica cada 3 minuts si hi ha canvis
              </label>

              <span style={{ fontSize: 10, color: backupStatus?.error ? '#d44' : 'rgba(0,0,0,0.35)' }}>
                {backupStatusText}
              </span>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleBackupNow}
                  disabled={backupBusy !== null || !hasBackupConfig()}
                  style={{
                    flex: 1, height: 36, borderRadius: 8,
                    border: '0.5px solid #E6E6E6', background: 'transparent',
                    cursor: 'pointer', fontSize: 12, fontWeight: 500,
                    opacity: backupBusy !== null || !hasBackupConfig() ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {backupBusy === 'backup' && <Loader2 size={13} className="animate-spin" />}
                  Fes còpia ara
                </button>
                <button
                  onClick={handleRestore}
                  disabled={backupBusy !== null || !hasBackupConfig()}
                  style={{
                    flex: 1, height: 36, borderRadius: 8,
                    border: restoreArmed ? 'none' : '0.5px solid #E6E6E6',
                    background: restoreArmed ? '#dc2626' : 'transparent',
                    color: restoreArmed ? 'white' : '#7C7C7C',
                    cursor: 'pointer', fontSize: 12, fontWeight: 500,
                    opacity: backupBusy !== null || !hasBackupConfig() ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                  title="Substitueix les dades locals per la còpia del GitHub"
                >
                  {backupBusy === 'restore' && <Loader2 size={13} className="animate-spin" />}
                  {restoreArmed ? 'Segur? Substitueix tot' : 'Restaura'}
                </button>
              </div>
            </div>
          </div>

          {/* Button group */}
          <div style={{ display: 'flex', gap: 16, flexShrink: 0 }}>
            <button
              onClick={() => setSettingsModalOpen(false)}
              style={{
                flex: 1, height: 40, borderRadius: 8,
                border: '0.5px solid #E6E6E6', background: 'transparent',
                cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#7C7C7C',
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => setSettingsModalOpen(false)}
              style={{
                flex: 1, height: 40, borderRadius: 8,
                background: 'var(--color-accent)', color: 'white',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}
            >
              Done
            </button>
          </div>
      </div>
    </div>
  );
}
