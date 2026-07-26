import { useState } from 'react';
import { Plus, Trash2, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import type { Reference } from '../../types';

interface ReferencesPanelProps {
  references: Reference[];
  onAdd: (ref: Omit<Reference, 'id'>) => void;
  onUpdate: (refId: string, updates: Partial<Reference>) => void;
  onDelete: (refId: string) => void;
  disabled?: boolean;
}

export function ReferencesPanel({
  references,
  onAdd,
  onUpdate,
  onDelete,
  disabled = false,
}: ReferencesPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newRef, setNewRef] = useState({ label: '', url: '', note: '' });

  const handleAdd = () => {
    if (newRef.label.trim() && newRef.url.trim()) {
      onAdd(newRef);
      setNewRef({ label: '', url: '', note: '' });
      setIsAdding(false);
    }
  };

  return (
    <div className="border-t border-[var(--color-border)] pt-2 mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-xs text-black/50 hover:text-black w-full"
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span>References ({references.length})</span>
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {references.map(ref => (
            <div
              key={ref.id}
              className="bg-black/5 rounded p-2 text-xs space-y-1"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={ref.label}
                    onChange={e => onUpdate(ref.id, { label: e.target.value })}
                    className="w-full bg-transparent text-black font-medium focus:outline-none"
                    placeholder="Label"
                    disabled={disabled}
                  />
                  <div className="flex items-center gap-1 mt-0.5">
                    <input
                      type="text"
                      value={ref.url}
                      onChange={e => onUpdate(ref.id, { url: e.target.value })}
                      className="flex-1 bg-transparent text-[var(--color-accent)] text-xs focus:outline-none truncate"
                      placeholder="URL"
                      disabled={disabled}
                    />
                    {ref.url && (
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-black/40 hover:text-[var(--color-accent)]"
                      >
                        <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                  <input
                    type="text"
                    value={ref.note}
                    onChange={e => onUpdate(ref.id, { note: e.target.value })}
                    className="w-full bg-transparent text-black/50 text-xs focus:outline-none mt-0.5"
                    placeholder="Note (optional)"
                    disabled={disabled}
                  />
                </div>
                {!disabled && (
                  <button
                    onClick={() => onDelete(ref.id)}
                    className="text-black/40 hover:text-red-500 p-0.5"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {isAdding ? (
            <div className="bg-black/5 rounded p-2 space-y-1">
              <input
                type="text"
                value={newRef.label}
                onChange={e => setNewRef({ ...newRef, label: e.target.value })}
                className="w-full bg-white rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                placeholder="Label"
                autoFocus
              />
              <input
                type="text"
                value={newRef.url}
                onChange={e => setNewRef({ ...newRef, url: e.target.value })}
                className="w-full bg-white rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                placeholder="URL"
              />
              <input
                type="text"
                value={newRef.note}
                onChange={e => setNewRef({ ...newRef, note: e.target.value })}
                className="w-full bg-white rounded px-2 py-1 text-xs text-black focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                placeholder="Note (optional)"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleAdd}
                  className="flex-1 px-2 py-1 text-xs bg-[var(--color-accent)] hover:bg-[#e89a3f] rounded text-[#1a1a1a]"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setIsAdding(false);
                    setNewRef({ label: '', url: '', note: '' });
                  }}
                  className="flex-1 px-2 py-1 text-xs bg-black/10 hover:bg-black/20 rounded text-black/70"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            !disabled && (
              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1 text-xs text-black/40 hover:text-black w-full justify-center py-1 border border-dashed border-black/20 rounded hover:border-black/40"
              >
                <Plus size={12} />
                <span>Add Reference</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
