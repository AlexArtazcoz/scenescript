import { useState, useEffect } from 'react';
import { Eye, EyeOff, ExternalLink } from 'lucide-react';
import { CloseIcon, ApiKeyIcon } from './Icons';
import { useUIStore } from '../stores/uiStore';
import { getStoredApiKey, setStoredApiKey } from '../services/db';

export function ApiKeyModal() {
  const { apiKeyModalOpen, setApiKeyModalOpen, addToast } = useUIStore();

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasExistingKey, setHasExistingKey] = useState(false);

  useEffect(() => {
    if (apiKeyModalOpen) {
      const storedKey = getStoredApiKey();
      if (storedKey) {
        setApiKey(storedKey);
        setHasExistingKey(true);
      } else {
        setApiKey('');
        setHasExistingKey(false);
      }
    }
  }, [apiKeyModalOpen]);

  // Close on Escape
  useEffect(() => {
    if (!apiKeyModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setApiKeyModalOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [apiKeyModalOpen, setApiKeyModalOpen]);

  const handleSave = () => {
    const trimmedKey = apiKey.trim();
    if (trimmedKey && !trimmedKey.startsWith('sk-')) {
      addToast({
        type: 'error',
        message: 'Invalid API key format. It should start with "sk-"',
      });
      return;
    }

    setStoredApiKey(trimmedKey || null);
    setApiKeyModalOpen(false);

    if (trimmedKey) {
      addToast({
        type: 'success',
        message: 'API key saved',
      });
    } else {
      addToast({
        type: 'info',
        message: 'API key removed',
      });
    }
  };

  const handleClear = () => {
    setApiKey('');
    setStoredApiKey(null);
    setHasExistingKey(false);
    addToast({
      type: 'info',
      message: 'API key removed',
    });
  };

  if (!apiKeyModalOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50"
        onClick={() => setApiKeyModalOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-xl border border-[var(--color-border)] shadow-2xl w-full max-w-md"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <ApiKeyIcon size={20} className="text-[var(--color-accent)]" />
              <h2 className="text-lg font-semibold text-black font-headline">OpenAI API Key</h2>
            </div>
            <button
              onClick={() => setApiKeyModalOpen(false)}
              className="p-1 text-black/40 hover:text-black hover:bg-black/5 rounded"
            >
              <CloseIcon size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-4">
            <p className="text-sm text-black/50">
              Your API key is stored locally in your browser and is never sent to any server
              except OpenAI directly.
            </p>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-black/70">
                API Key
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-black/5 rounded-lg px-4 py-2.5 pr-10 text-black placeholder-black/30 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70"
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <a
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:text-[#e89a3f]"
            >
              Get an API key from OpenAI
              <ExternalLink size={14} />
            </a>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--color-border)] bg-black/[0.02] rounded-b-xl">
            {hasExistingKey ? (
              <button
                onClick={handleClear}
                className="px-4 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Clear Key
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => setApiKeyModalOpen(false)}
                className="px-4 py-2 text-sm text-black/50 hover:text-black hover:bg-black/5 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-[var(--color-accent)] hover:bg-[#e89a3f] text-[#1a1a1a] rounded-lg font-medium transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
