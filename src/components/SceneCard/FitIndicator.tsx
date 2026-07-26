import type { FitStatus } from '../../types';

interface FitIndicatorProps {
  targetWords: number;
  actualWords: number;
  fitStatus: FitStatus;
  fitPercent: number;
}

export function FitIndicator({
  targetWords,
  actualWords,
  fitStatus,
  fitPercent,
}: FitIndicatorProps) {
  const getStatusColor = () => {
    switch (fitStatus) {
      case 'ok':
        return 'text-emerald-400';
      case 'under':
        return 'text-amber-400';
      case 'over':
        return 'text-red-400';
    }
  };

  const getStatusBg = () => {
    switch (fitStatus) {
      case 'ok':
        return 'bg-emerald-500/20';
      case 'under':
        return 'bg-amber-500/20';
      case 'over':
        return 'bg-red-500/20';
    }
  };

  const getStatusLabel = () => {
    if (fitStatus === 'ok') return 'On target';
    const direction = fitStatus === 'under' ? 'under' : 'over';
    return `${Math.abs(fitPercent)}% ${direction}`;
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-400">
        {actualWords}/{targetWords} words
      </span>
      <span
        className={`px-1.5 py-0.5 rounded ${getStatusBg()} ${getStatusColor()}`}
      >
        {getStatusLabel()}
      </span>
    </div>
  );
}
