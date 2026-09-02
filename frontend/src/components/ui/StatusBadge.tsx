import React from 'react';

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: 'bg-yellow-900/40', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  IN_PROGRESS: { bg: 'bg-blue-900/40',   text: 'text-blue-400',   dot: 'bg-blue-400'   },
  SELECTED:    { bg: 'bg-green-900/40',  text: 'text-green-400',  dot: 'bg-green-400'  },
  REJECTED:    { bg: 'bg-red-900/40',    text: 'text-red-400',    dot: 'bg-red-400'    },
  PASSED:      { bg: 'bg-green-900/40',  text: 'text-green-400',  dot: 'bg-green-400'  },
  FAILED:      { bg: 'bg-red-900/40',    text: 'text-red-400',    dot: 'bg-red-400'    },
  OPEN:        { bg: 'bg-green-900/40',  text: 'text-green-400',  dot: 'bg-green-400'  },
  CLOSED:      { bg: 'bg-gray-700/60',   text: 'text-gray-400',   dot: 'bg-gray-400'   },
  SUBMITTED:   { bg: 'bg-purple-900/40', text: 'text-purple-400', dot: 'bg-purple-400' },
  TERMINATED:  { bg: 'bg-red-900/40',    text: 'text-red-400',    dot: 'bg-red-400'    },
  EASY:        { bg: 'bg-green-900/40',  text: 'text-green-400',  dot: 'bg-green-400'  },
  MEDIUM:      { bg: 'bg-yellow-900/40', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  HARD:        { bg: 'bg-red-900/40',    text: 'text-red-400',    dot: 'bg-red-400'    },
};

const DEFAULT_STYLE = { bg: 'bg-gray-700/60', text: 'text-gray-300', dot: 'bg-gray-400' };

interface StatusBadgeProps {
  status: string;
  showDot?: boolean;
  className?: string;
}

export default function StatusBadge({ status, showDot = true, className = '' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status?.toUpperCase()] ?? DEFAULT_STYLE;
  const label = status?.replace(/_/g, ' ') ?? '';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text} ${className}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />}
      {label}
    </span>
  );
}
