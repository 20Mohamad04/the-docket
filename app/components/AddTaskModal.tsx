"use client";
import React, { useState } from 'react';

export default function AddTaskModal({ onClose, onSave }: { onClose: () => void, onSave: (data: any) => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Study');
  const [priority, setPriority] = useState('Medium');
  const [type, setType] = useState('milestone');
  const [recurring, setRecurring] = useState('none');

  const handleSave = () => {
    if (title.trim() === '') return;
    onSave({ title, category, priority, type, recurring });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[var(--color-surface)] rounded-[14px] border border-[var(--color-border)] shadow-lg w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-[var(--color-navy)] mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>New Task</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-muted)] mb-1">Task Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Design Landing Page" className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-accent)] text-[var(--color-navy)]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-muted)] mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-accent)] text-[var(--color-navy)]">
                <option>Study</option><option>Trading & Investing</option><option>Business</option><option>Career</option><option>Health</option><option>Admin & Housing</option><option>Faith</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-muted)] mb-1">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-accent)] text-[var(--color-navy)]">
                <option>Medium</option><option>High</option><option>Urgent</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-muted)] mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-accent)] text-[var(--color-navy)]">
                <option value="milestone">Milestone (One-off)</option>
                <option value="ongoing">Ongoing Project</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--color-muted)] mb-1">Recurring</label>
              <select value={recurring} onChange={(e) => setRecurring(e.target.value)} className="w-full px-3 py-2 border border-[var(--color-border)] rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-accent)] text-[var(--color-navy)]">
                <option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-[10px] border border-[var(--color-border)] text-[var(--color-muted)] text-sm font-medium hover:bg-[var(--color-surface-2)]">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 rounded-[10px] bg-[var(--color-navy)] text-white text-sm font-medium hover:opacity-90">Save Task</button>
        </div>
      </div>
    </div>
  );
}