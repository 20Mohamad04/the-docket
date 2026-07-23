import React from 'react';

interface TaskCardProps {
  title: string;
  priority: string;
  category: string;
  done: boolean;
  type: string;
  recurring: string;
  onToggle: () => void;
  onDelete: () => void;
  onRestore?: () => void;
  isArchived?: boolean;
}

export default function TaskCard({ title, priority, category, done, type, recurring, onToggle, onDelete, onRestore, isArchived }: TaskCardProps) {
  return (
    <div className={`bg-[var(--color-surface)] rounded-[14px] border border-[var(--color-border)] shadow-sm p-4 mb-4 ${done ? 'opacity-60' : ''}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          {!isArchived && <input type="checkbox" checked={done} onChange={onToggle} className="w-5 h-5 accent-[var(--color-primary-accent)] cursor-pointer" />}
          <h3 className={`text-lg font-bold text-[var(--color-navy)] ${done ? 'line-through' : ''}`}>{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 rounded-md text-xs font-semibold" style={{ backgroundColor: '#F4DFDA', color: '#C0503C' }}>{priority}</span>
          {isArchived ? (
            <button onClick={onRestore} className="text-[var(--color-sage)] hover:underline text-xs font-bold">↺ Restore</button>
          ) : (
            <button onClick={onDelete} className="text-[var(--color-muted-2)] hover:text-[var(--color-urgent)] text-sm font-bold">✕</button>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between pl-8">
        <div className="flex gap-2">
          <span className="px-3 py-1 rounded-md text-xs font-semibold" style={{ backgroundColor: '#F6E9D3', color: '#9c6a1f' }}>{category}</span>
          {type === 'ongoing' && <span className="px-3 py-1 rounded-md text-xs font-semibold bg-[var(--color-surface-2)] text-[var(--color-muted)]">Ongoing</span>}
          {recurring !== 'none' && <span className="px-3 py-1 rounded-md text-xs font-semibold bg-[var(--color-surface-2)] text-[var(--color-muted)] capitalize">{recurring}</span>}
        </div>
      </div>
    </div>
  );
}