import { useEffect, useState, useCallback } from 'react';
import { Loader2, Copy, Check, X } from 'lucide-react';
import { useScriptStore } from '../stores/scriptStore';
import { useUIStore } from '../stores/uiStore';
import { generateYTDescriptionLLM, type YTDescriptionResult } from '../services/generation';

type Phase = 'loading' | 'error' | 'done';

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 500, color: 'rgba(0,0,0,0.4)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginBottom: 8,
};

const sectionBoxStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,0.03)',
  borderRadius: 10,
  padding: 12,
  fontSize: 13,
  lineHeight: 1.55,
  color: '#333',
  position: 'relative',
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      style={{
        position: 'absolute', top: 8, right: 8,
        background: 'white', border: '0.5px solid #E6E6E6',
        borderRadius: 6, padding: 4,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: copied ? 1 : 0.5,
        transition: 'opacity 0.15s ease',
      }}
      title="Copy"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

export function YTDescriptionModal() {
  const { ytDescModalOpen, setYtDescModalOpen, addToast } = useUIStore();
  const { getActiveScript, scenes } = useScriptStore();

  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<YTDescriptionResult | null>(null);

  const script = getActiveScript();

  const generate = useCallback(async () => {
    if (!script) return;
    setPhase('loading');
    setError('');
    const result = await generateYTDescriptionLLM(script, scenes);
    if (result.success) {
      setData(result.data);
      setPhase('done');
    } else {
      setError(result.error);
      setPhase('error');
    }
  }, [script, scenes]);

  useEffect(() => {
    if (ytDescModalOpen) {
      setData(null);
      generate();
    }
  }, [ytDescModalOpen, generate]);

  useEffect(() => {
    if (!ytDescModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setYtDescModalOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [ytDescModalOpen, setYtDescModalOpen]);

  if (!ytDescModalOpen) return null;

  const formatAll = (): string => {
    if (!data) return '';
    const parts: string[] = [];
    parts.push('ALTERNATIVE TITLES');
    data.titles.forEach((t, i) => parts.push(`${i + 1}. ${t}`));
    parts.push('', 'INTRO', data.intro);
    if (data.references.length > 0) {
      parts.push('', 'REFERENCES');
      data.references.forEach(r => {
        parts.push(r.label);
        parts.push(r.url);
      });
    }
    parts.push('', 'TAGS', data.tags.join(', '));
    return parts.join('\n');
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(formatAll()).then(() => {
      addToast({ type: 'success', message: 'Description copied to clipboard' });
    });
  };

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={() => setYtDescModalOpen(false)}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        style={{
          position: 'fixed',
          left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 480,
          maxHeight: 'calc(100vh - 80px)',
          borderRadius: 16,
          border: '0.5px solid #E6E6E6',
          background: 'white',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          animation: 'ref-dialog-in 0.25s cubic-bezier(0.2, 0, 0, 1) both',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-headline)', fontSize: 18, textTransform: 'uppercase' }}>
            YouTube Description
          </span>
          <button
            onClick={() => setYtDescModalOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, opacity: 0.4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Loading */}
        {phase === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
            <Loader2 size={28} className="animate-spin" style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)' }}>Generating description...</span>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0' }}>
            <span style={{ fontSize: 13, color: '#d44', textAlign: 'center' }}>{error}</span>
            <button
              onClick={generate}
              style={{
                fontSize: 13, fontWeight: 500,
                padding: '8px 20px', borderRadius: 8,
                border: '0.5px solid #E6E6E6',
                background: 'white', cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Result */}
        {phase === 'done' && data && (
          <>
            {/* Titles */}
            <div>
              <div style={sectionLabelStyle}>Alternative Titles</div>
              <div style={sectionBoxStyle}>
                <CopyBtn text={data.titles.join('\n')} />
                {data.titles.map((t, i) => (
                  <div key={i} style={{ marginBottom: i < data.titles.length - 1 ? 6 : 0 }}>
                    {i + 1}. {t}
                  </div>
                ))}
              </div>
            </div>

            {/* Intro */}
            <div>
              <div style={sectionLabelStyle}>Intro</div>
              <div style={sectionBoxStyle}>
                <CopyBtn text={data.intro} />
                <div style={{ paddingRight: 28 }}>{data.intro}</div>
              </div>
            </div>

            {/* References */}
            {data.references.length > 0 && (
              <div>
                <div style={sectionLabelStyle}>References</div>
                <div style={sectionBoxStyle}>
                  <CopyBtn text={data.references.map(r => `${r.label}\n${r.url}`).join('\n')} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 28 }}>
                    {data.references.map((r, i) => (
                      <div key={i} style={{ lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 500 }}>{r.label}</div>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--color-accent)', textDecoration: 'none', fontSize: 12 }}
                        >
                          {r.url}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tags */}
            <div>
              <div style={sectionLabelStyle}>Suggested Tags</div>
              <div style={sectionBoxStyle}>
                <CopyBtn text={data.tags.join(', ')} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingRight: 28 }}>
                  {data.tags.map((tag, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: 12, fontWeight: 500,
                        background: 'rgba(0,0,0,0.06)',
                        borderRadius: 6, padding: '3px 8px',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Copy All */}
            <button
              onClick={handleCopyAll}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 13, fontWeight: 500,
                padding: '10px 0', borderRadius: 10,
                border: '0.5px solid #E6E6E6',
                background: 'white', cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <Copy size={14} />
              Copy All
            </button>
          </>
        )}
      </div>
    </div>
  );
}
