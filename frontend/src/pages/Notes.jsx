import { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Trash2, Search, Tag, Bold, Italic, Code, List, Hash } from 'lucide-react';

const STORAGE_KEY = 'rookishq_notes';

const defaultNotes = [];

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultNotes;
  } catch { return defaultNotes; }
}

function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function renderMarkdown(text) {
  return text
    .replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:800;color:#ece0dc;margin:0 0 12px">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:17px;font-weight:700;color:#ece0dc;margin:16px 0 8px">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;color:#e0c0b1;margin:12px 0 6px">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#ece0dc;font-weight:700">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:#b0b0c0;font-style:italic">$1</em>')
    .replace(/`(.+?)`/g, '<code style="font-family:monospace;background:#2f2926;padding:2px 6px;border-radius:4px;font-size:12px;color:#a855f7">$1</code>')
    .replace(/^- (.+)$/gm, '<li style="color:#b0b0c0;margin:4px 0;padding-left:8px">$1</li>')
    .replace(/(<li.*<\/li>)/s, '<ul style="padding-left:20px;list-style:none">$1</ul>')
    .replace(/^(?!<[h|u|l|c|s])(.+)$/gm, '<p style="color:#9090a8;line-height:1.7;margin:4px 0">$1</p>')
    .replace(/\n\n/g, '<br/>');
}

const tagColors = ['#f97316','#a855f7','#22c55e','#eab308','#f97316','#06b6d4'];

export default function Notes() {
  const [notes, setNotes] = useState(loadNotes);
  const [activeId, setActiveId] = useState(null);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const textareaRef = useRef(null);

  const activeNote = notes.find(n => n.id === activeId);
  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase()) ||
    n.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => { saveNotes(notes); }, [notes]);

  const createNote = () => {
    const n = {
      id: Date.now().toString(),
      title: 'Untitled Note',
      content: '# Untitled Note\n\nStart writing...',
      tags: [],
      updatedAt: new Date().toISOString(),
    };
    setNotes(prev => [n, ...prev]);
    setActiveId(n.id);
    setPreview(false);
  };

  const updateNote = (id, patch) => {
    setNotes(prev => prev.map(n =>
      n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n
    ));
  };

  const deleteNote = (id) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    setActiveId(null);
  };

  const addTag = (e) => {
    e.preventDefault();
    if (!tagInput.trim() || !activeNote) return;
    const tag = tagInput.trim().toLowerCase();
    if (!activeNote.tags.includes(tag)) {
      updateNote(activeNote.id, { tags: [...activeNote.tags, tag] });
    }
    setTagInput('');
  };

  const removeTag = (tag) => {
    updateNote(activeNote.id, { tags: activeNote.tags.filter(t => t !== tag) });
  };

  const insertMarkdown = (syntax) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    let replacement = '';
    if (syntax === 'bold') replacement = `**${selected || 'bold text'}**`;
    else if (syntax === 'italic') replacement = `*${selected || 'italic text'}*`;
    else if (syntax === 'code') replacement = `\`${selected || 'code'}\``;
    else if (syntax === 'h1') replacement = `# ${selected || 'Heading'}`;
    else if (syntax === 'list') replacement = `- ${selected || 'List item'}`;
    const newContent = ta.value.slice(0, start) + replacement + ta.value.slice(end);
    updateNote(activeId, { content: newContent });
    setTimeout(() => {
      ta.selectionStart = start + replacement.length;
      ta.selectionEnd = start + replacement.length;
      ta.focus();
    }, 0);
  };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out', display: 'flex', height: 'calc(100vh - 60px)', gap: '0', background: '#120d0b', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(88,66,55,0.2)' }}>
      {/* Sidebar */}
      <div style={{ width: '260px', flexShrink: 0, borderRight: '1px solid rgba(88,66,55,0.2)', display: 'flex', flexDirection: 'column' }}>
        {/* Sidebar Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(88,66,55,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#ece0dc' }}>Notes</span>
            <button onClick={createNote} style={{
              width: '26px', height: '26px', borderRadius: '6px', background: '#f97316',
              border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}>
              <Plus size={14} style={{ color: 'white' }} />
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(88,66,55,0.6)' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search notes..."
              style={{ width: '100%', padding: '8px 8px 8px 28px', background: '#2f2926', border: '1px solid rgba(88,66,55,0.3)', borderRadius: '6px', fontSize: '12px', color: '#e0c0b1', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Notes List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <FileText size={28} style={{ color: 'rgba(88,66,55,0.5)', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '12px', color: 'rgba(88,66,55,0.5)' }}>No notes yet</p>
              <button onClick={createNote} style={{ marginTop: '8px', fontSize: '11px', color: '#f97316', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                Create one
              </button>
            </div>
          ) : (
            filtered.map(note => (
              <div key={note.id}
                onClick={() => { setActiveId(note.id); setPreview(false); }}
                style={{
                  padding: '14px 16px', borderBottom: '1px solid #111118', cursor: 'pointer', transition: 'background 100ms',
                  background: activeId === note.id ? '#0f0f18' : 'transparent',
                  borderLeft: activeId === note.id ? '2px solid #f97316' : '2px solid transparent',
                }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: activeId === note.id ? '#ece0dc' : '#e0c0b1', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {note.title}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(88,66,55,0.6)', marginBottom: '6px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.4 }}>
                  {note.content.replace(/[#*`-]/g, '').slice(0, 80)}
                </div>
                {note.tags?.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {note.tags.slice(0, 3).map((tag, i) => (
                      <span key={tag} style={{ padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 700, background: tagColors[i % tagColors.length] + '22', color: tagColors[i % tagColors.length] }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: '10px', color: 'rgba(88,66,55,0.5)', marginTop: '4px' }}>{timeAgo(note.updatedAt)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor Area */}
      {activeNote ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(88,66,55,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[
                { icon: <Hash size={13} />, tip: 'Heading', action: 'h1' },
                { icon: <Bold size={13} />, tip: 'Bold', action: 'bold' },
                { icon: <Italic size={13} />, tip: 'Italic', action: 'italic' },
                { icon: <Code size={13} />, tip: 'Code', action: 'code' },
                { icon: <List size={13} />, tip: 'List', action: 'list' },
              ].map(btn => (
                <button key={btn.action} onClick={() => insertMarkdown(btn.action)} title={btn.tip} style={{
                  width: '28px', height: '28px', borderRadius: '5px', background: 'none', border: 'none',
                  color: 'rgba(167,139,125,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 100ms'
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#2f2926'; e.currentTarget.style.color = '#ece0dc'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'rgba(167,139,125,0.6)'; }}>
                  {btn.icon}
                </button>
              ))}

              <div style={{ width: '1px', background: 'rgba(88,66,55,0.2)', margin: '0 4px' }} />

              <button onClick={() => setPreview(!preview)} style={{
                padding: '4px 10px', borderRadius: '5px', background: preview ? 'rgba(249,115,22,0.12)' : 'none',
                border: 'none', color: preview ? '#ffb690' : 'rgba(167,139,125,0.6)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', transition: 'all 100ms'
              }}>
                {preview ? 'Edit' : 'Preview'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {/* Tag Input */}
              <form onSubmit={addTag} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Tag size={12} style={{ color: 'rgba(88,66,55,0.6)' }} />
                {activeNote.tags?.map((tag, i) => (
                  <span key={tag} onClick={() => removeTag(tag)} style={{
                    padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                    background: tagColors[i % tagColors.length] + '22', color: tagColors[i % tagColors.length]
                  }}>
                    {tag} ×
                  </span>
                ))}
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Add tag..."
                  style={{ width: '80px', padding: '3px 8px', background: '#2f2926', border: '1px solid rgba(88,66,55,0.3)', borderRadius: '4px', fontSize: '11px', color: '#e0c0b1', outline: 'none' }} />
              </form>

              <button onClick={() => deleteNote(activeNote.id)} style={{
                padding: '4px 8px', borderRadius: '5px', background: 'none', border: 'none', color: 'rgba(88,66,55,0.5)', cursor: 'pointer', transition: 'all 100ms'
              }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(88,66,55,0.5)'; e.currentTarget.style.background = 'none'; }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Title */}
          <input
            value={activeNote.title}
            onChange={e => updateNote(activeNote.id, { title: e.target.value })}
            style={{
              padding: '16px 24px 8px', fontSize: '18px', fontWeight: 700, color: '#ece0dc',
              background: 'none', border: 'none', outline: 'none', fontFamily: 'inherit'
            }}
          />

          {/* Content */}
          {preview ? (
            <div
              style={{ flex: 1, padding: '0 24px 24px', overflowY: 'auto', lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(activeNote.content) }}
            />
          ) : (
            <textarea
              ref={textareaRef}
              value={activeNote.content}
              onChange={e => updateNote(activeNote.id, { content: e.target.value })}
              style={{
                flex: 1, padding: '0 24px 24px', background: 'none', border: 'none', outline: 'none',
                resize: 'none', fontSize: '14px', color: '#9090a8', lineHeight: 1.8, fontFamily: 'monospace',
              }}
            />
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={24} style={{ color: '#eab308' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#e0c0b1', marginBottom: '6px' }}>Select a note or create one</div>
            <div style={{ fontSize: '12px', color: 'rgba(88,66,55,0.6)' }}>Supports markdown formatting</div>
          </div>
          <button onClick={createNote} style={{
            padding: '10px 22px', borderRadius: '8px', background: '#f97316', border: 'none',
            color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <Plus size={14} /> New Note
          </button>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        textarea::-webkit-scrollbar { width: 4px; }
        textarea::-webkit-scrollbar-track { background: transparent; }
        textarea::-webkit-scrollbar-thumb { background: rgba(88,66,55,0.3); border-radius: 2px; }
      `}</style>
    </div>
  );
}
