import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import type { DraftVersion } from '../../types';

interface DraftNotesPagerProps {
  versions: DraftVersion[];
  currentIndex: number;
  onSelectVersion: (index: number) => void;
  disabled?: boolean;
}

export function DraftNotesPager({
  versions,
  currentIndex,
  onSelectVersion,
  disabled = false,
}: DraftNotesPagerProps) {
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < versions.length - 1;
  const totalVersions = versions.length;

  if (totalVersions <= 1) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <History size={12} />
        <span>v1</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onSelectVersion(currentIndex - 1)}
        disabled={!canGoPrev || disabled}
        className={`p-0.5 rounded transition-colors ${
          canGoPrev && !disabled
            ? 'text-gray-400 hover:text-white hover:bg-gray-700'
            : 'text-gray-600 cursor-not-allowed'
        }`}
        title="Previous version"
      >
        <ChevronLeft size={14} />
      </button>

      <div className="flex items-center gap-1 text-xs text-gray-400 min-w-[50px] justify-center">
        <History size={12} />
        <span>
          v{currentIndex + 1}/{totalVersions}
        </span>
      </div>

      <button
        onClick={() => onSelectVersion(currentIndex + 1)}
        disabled={!canGoNext || disabled}
        className={`p-0.5 rounded transition-colors ${
          canGoNext && !disabled
            ? 'text-gray-400 hover:text-white hover:bg-gray-700'
            : 'text-gray-600 cursor-not-allowed'
        }`}
        title="Next version"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
