"use client";
import React from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: string;
  setView: (view: string) => void;
}

export default function Drawer({ isOpen, onClose, currentView, setView }: DrawerProps) {
  const handleNav = (view: string) => {
    setView(view);
    onClose();
  };

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose}></div>}
      <div className={`fixed top-0 left-0 h-full w-64 bg-[var(--color-surface)] shadow-lg z-50 transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-bold text-[var(--color-navy)]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>The Docket</h2>
        </div>
        <nav className="p-4 space-y-2">
          <button onClick={() => handleNav('daily')} className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium ${currentView === 'daily' ? 'bg-[var(--color-surface-2)] text-[var(--color-navy)]' : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]'}`}>Daily Routine</button>
          <button onClick={() => handleNav('all')} className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium ${currentView === 'all' ? 'bg-[var(--color-surface-2)] text-[var(--color-navy)]' : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]'}`}>All Tasks</button>
          <button onClick={() => handleNav('week')} className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium ${currentView === 'week' ? 'bg-[var(--color-surface-2)] text-[var(--color-navy)]' : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]'}`}>Week View</button>
          <div className="border-t border-[var(--color-border)] my-2"></div>
          <button onClick={() => handleNav('archive')} className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium ${currentView === 'archive' ? 'bg-[var(--color-surface-2)] text-[var(--color-navy)]' : 'text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]'}`}>Finished & Deleted</button>
        </nav>
      </div>
    </>
  );
}