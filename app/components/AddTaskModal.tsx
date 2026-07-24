"use client";
import React, { useState } from 'react';

const CATS: Record<string, string> = {
  health:"Health & Fitness", fitness:"Fitness & Exercise", nutrition:"Nutrition & Diet",
  mental:"Mental Health", medical:"Medical & Appointments", faith:"Faith & Spirituality",
  personal:"Personal Development", reading:"Reading & Books", music:"Music",
  creative:"Creative & Arts", language:"Language Learning", study:"Study",
  research:"Research", writing:"Writing", education:"Education", career:"Career",
  interview:"Interviews & Applications", networking:"Networking", project:"Projects",
  hr:"HR & People", business:"Business", side_hustle:"Side Hustle", marketing:"Marketing",
  sales:"Sales", design:"Design", content:"Content Creation", customer:"Customer Service",
  finance:"Finance", trading:"Trading & Investing", savings:"Savings & Goals",
  investment:"Investments", debt:"Debt & Loans", tax:"Tax & Accounting",
  insurance:"Insurance", subscriptions:"Subscriptions", legal:"Legal",
  legal_work:"Legal Work", compliance:"Compliance", admin:"Admin & Housing",
  home:"Home & DIY", property:"Property", utilities:"Utilities & Bills",
  vehicle:"Vehicle & Transport", driving:"Driving", shopping:"Shopping & Errands",
  family:"Family", childcare:"Childcare", pets:"Pets", social:"Social Life",
  events:"Events & Occasions", technology:"Technology & Tech", travel:"Travel & Holidays",
  volunteering:"Volunteering", charity:"Charity & Giving", community:"Community",
  environment:"Environment", sports:"Sports", cooking:"Cooking & Recipes", other:"Other",
};

const CAT_STYLES: Record<string, { bg: string; color: string }> = {
  health:{bg:"#E4E9F9",color:"#3D52A0"}, fitness:{bg:"#DCE8FA",color:"#2a4a8a"},
  nutrition:{bg:"#E0F5DC",color:"#2d7a25"}, mental:{bg:"#F0E8FA",color:"#6a3a9a"},
  medical:{bg:"#FAE8E8",color:"#9a2a2a"}, faith:{bg:"#DCF0E6",color:"#1f7a52"},
  personal:{bg:"#E0EEF5",color:"#2f5f8a"}, reading:{bg:"#FFF8DC",color:"#8a6a10"},
  music:{bg:"#F5E0FA",color:"#8a2a9a"}, creative:{bg:"#FFE4F0",color:"#a53070"},
  language:{bg:"#E4FAF5",color:"#1a7a6a"}, study:{bg:"#ECE9FA",color:"#5a4fae"},
  research:{bg:"#E8E4FA",color:"#4a3a9e"}, writing:{bg:"#FAF0E4",color:"#8a5a1a"},
  education:{bg:"#E4ECFA",color:"#2a3a9e"}, career:{bg:"#F4DFDA",color:"#a5382f"},
  interview:{bg:"#FAE0DC",color:"#9a2f25"}, networking:{bg:"#FAE8DC",color:"#9a4a1a"},
  project:{bg:"#DCEAF4",color:"#2a5a8a"}, hr:{bg:"#F5DCFA",color:"#8a2a9a"},
  business:{bg:"#F6E9D3",color:"#9c6a1f"}, side_hustle:{bg:"#FAF0DC",color:"#8a6a10"},
  marketing:{bg:"#FAE4DC",color:"#9a3a1a"}, sales:{bg:"#FAEADC",color:"#9a5a1a"},
  design:{bg:"#FFE8F5",color:"#9a2070"}, content:{bg:"#FFE4F0",color:"#a53070"},
  customer:{bg:"#DCFAF0",color:"#1a8a5a"}, finance:{bg:"#D6EEE0",color:"#1f6b45"},
  trading:{bg:"#DCEEE3",color:"#2f6b4f"}, savings:{bg:"#DCF0DC",color:"#2a7a2a"},
  investment:{bg:"#D8EED8",color:"#257a25"}, debt:{bg:"#FAE0E0",color:"#9a2a2a"},
  tax:{bg:"#F5E8DC",color:"#8a5a1a"}, insurance:{bg:"#DCF0FA",color:"#1a5a8a"},
  subscriptions:{bg:"#F0DCFA",color:"#7a1a9a"}, legal:{bg:"#EDE0F5",color:"#7a3a9e"},
  legal_work:{bg:"#E8DCF5",color:"#6a2a9e"}, compliance:{bg:"#F5E0E0",color:"#9a2a3a"},
  admin:{bg:"#DCEEF0",color:"#3d7a8a"}, home:{bg:"#E8F0DC",color:"#4a6a2a"},
  property:{bg:"#E8F0E0",color:"#4a6e2f"}, utilities:{bg:"#DCF0F5",color:"#1a6a7a"},
  vehicle:{bg:"#F5F0DC",color:"#7a6a1a"}, driving:{bg:"#FFF0D9",color:"#9c6010"},
  shopping:{bg:"#FAE8F5",color:"#9a2a7a"}, family:{bg:"#FFF0E4",color:"#9c5030"},
  childcare:{bg:"#FAF0E8",color:"#9a5a2a"}, pets:{bg:"#F0FAE4",color:"#5a8a2a"},
  social:{bg:"#FAE8EC",color:"#9a2a4a"}, events:{bg:"#F5E0FA",color:"#8a1a9a"},
  technology:{bg:"#DCE8F5",color:"#2a4a8a"}, travel:{bg:"#DCF5FA",color:"#1a6a7a"},
  volunteering:{bg:"#E4FAE8",color:"#2a8a3a"}, charity:{bg:"#FAE4E8",color:"#9a2a3a"},
  community:{bg:"#E8FAE4",color:"#3a8a2a"}, environment:{bg:"#DCF5DC",color:"#2a7a2a"},
  sports:{bg:"#DCE4FA",color:"#2a3a9a"}, cooking:{bg:"#FAF0DC",color:"#9a6a1a"},
  other:{bg:"#F0F0F0",color:"#6a6a6a"},
};

function CategoryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = Object.entries(CATS).filter(([, v]) =>
    v.toLowerCase().includes(search.toLowerCase())
  );
  const s = CAT_STYLES[value] ?? { bg: '#F0F0F0', color: '#6a6a6a' };
  return (
    <div style={{ position: 'relative' }}>
      <div onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '10px 12px', border: '1px solid #DCD9EE',
        borderRadius: 8, background: '#F6F4FB', display: 'flex',
        alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none',
      }}>
        <span style={{ background: s.bg, color: s.color, padding: '2px 8px',
          borderRadius: 6, fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
          {CATS[value] ?? value}
        </span>
        <span style={{ color: '#9a9dbb', fontSize: 12, flex: 1 }}>
          {open ? 'Type to search…' : 'Click to change'}
        </span>
        <span style={{ color: '#9a9dbb', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'white', border: '1.5px solid #3D52A0', borderRadius: 9,
          boxShadow: '0 8px 24px rgba(35,42,77,0.18)', zIndex: 999, overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #DCD9EE' }}>
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search categories…"
              style={{ width: '100%', border: 'none', outline: 'none',
                fontSize: 13, background: 'transparent', color: '#232A4D', fontFamily: 'inherit' }} />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: 12, color: '#9a9dbb', textAlign: 'center' }}>
                No categories found
              </div>
            )}
            {filtered.map(([k, v]) => {
              const st = CAT_STYLES[k] ?? { bg: '#F0F0F0', color: '#6a6a6a' };
              return (
                <div key={k} onClick={() => { onChange(k); setOpen(false); setSearch(''); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                    cursor: 'pointer', background: k === value ? '#F6F4FB' : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F6F4FB')}
                  onMouseLeave={e => (e.currentTarget.style.background = k === value ? '#F6F4FB' : 'transparent')}>
                  <span style={{ background: st.bg, color: st.color, padding: '2px 8px',
                    borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddTaskModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('study');
  const [priority, setPriority] = useState('medium');
  const [type, setType] = useState('milestone');
  const [recurring, setRecurring] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title, category, priority, type, recurring, date, notes });
    onClose();
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #DCD9EE',
    borderRadius: 8, fontSize: 13, background: '#F6F4FB',
    color: '#232A4D', outline: 'none', fontFamily: 'inherit',
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(35,42,77,0.35)',
      backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 18,
        padding: 28, width: '100%', maxWidth: 440,
        boxShadow: '0 30px 80px rgba(35,42,77,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>

        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700,
          color: '#232A4D', marginBottom: 18 }}>New Task</h2>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7094', marginBottom: 6 }}>Task</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inp} autoFocus />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7094', marginBottom: 6 }}>Category</label>
          <CategoryPicker value={category} onChange={setCategory} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7094', marginBottom: 6 }}>Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)} style={inp}>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7094', marginBottom: 6 }}>Nature</label>
            <select value={type} onChange={e => setType(e.target.value)} style={inp}>
              <option value="milestone">Completable</option>
              <option value="ongoing">Ongoing</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7094', marginBottom: 6 }}>Recurring</label>
            <select value={recurring} onChange={e => setRecurring(e.target.value)} style={inp}>
              <option value="">One-off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7094', marginBottom: 6 }}>Due date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7094', marginBottom: 6 }}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder="Any detail worth remembering" style={{ ...inp, resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 9,
            border: '1.5px solid #DCD9EE', fontSize: 13, fontWeight: 600,
            color: '#6b7094', background: 'none', cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleSave} style={{ padding: '10px 18px', borderRadius: 9,
            background: '#232A4D', color: 'white', border: 'none',
            fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Save Task</button>
        </div>
      </div>
    </div>
  );
}