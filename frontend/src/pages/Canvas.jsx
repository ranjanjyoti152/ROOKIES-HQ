import { useState, useRef, useEffect, useCallback } from 'react';
import { Palette, Plus, Trash2, Move, Type, StickyNote, Square, Minus, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';

const STORAGE_KEY = 'rookishq_canvas';

const COLORS = ['#f97316','#a855f7','#22c55e','#eab308','#f97316','#ef4444','#06b6d4','#ec4899'];

function loadCanvas() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { items: [], connections: [] };
  } catch { return { items: [], connections: [] }; }
}

function saveCanvas(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const TOOL_MODES = [
  { id: 'select', icon: <Move size={15} />, tip: 'Select & Move' },
  { id: 'sticky', icon: <StickyNote size={15} />, tip: 'Sticky Note' },
  { id: 'text', icon: <Type size={15} />, tip: 'Text Block' },
  { id: 'card', icon: <Square size={15} />, tip: 'Card' },
];

export default function Canvas() {
  const canvasRef = useRef(null);
  const [state, setState] = useState(loadCanvas);
  const [tool, setTool] = useState('select');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(null);
  const [editing, setEditing] = useState(null);
  const [panStart, setPanStart] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => { saveCanvas(state); }, [state]);

  const addItem = (e) => {
    if (tool === 'select') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    const newItem = {
      id: Date.now().toString(),
      type: tool,
      x, y,
      width: tool === 'sticky' ? 180 : tool === 'text' ? 200 : 220,
      height: tool === 'sticky' ? 160 : tool === 'text' ? 40 : 100,
      text: tool === 'sticky' ? 'Click to edit...' : tool === 'text' ? 'Text' : 'New Card',
      color: selectedColor,
      bg: tool === 'sticky' ? selectedColor + '22' : tool === 'text' ? 'transparent' : '#201a18',
    };
    setState(prev => ({ ...prev, items: [...prev.items, newItem] }));
    setTool('select');
    setEditing(newItem.id);
    setSelected(newItem.id);
  };

  const updateItem = (id, patch) => {
    setState(prev => ({ ...prev, items: prev.items.map(it => it.id === id ? { ...it, ...patch } : it) }));
  };

  const deleteItem = (id) => {
    setState(prev => ({ ...prev, items: prev.items.filter(it => it.id !== id) }));
    setSelected(null);
    setEditing(null);
  };

  const onMouseDown = (e, id) => {
    e.stopPropagation();
    if (tool !== 'select') return;
    setSelected(id);
    setDragging({ id, startX: e.clientX, startY: e.clientY });
  };

  const onMouseMove = useCallback((e) => {
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / zoom;
      const dy = (e.clientY - dragging.startY) / zoom;
      const item = state.items.find(it => it.id === dragging.id);
      if (item) {
        updateItem(dragging.id, { x: item.x + dx, y: item.y + dy });
        setDragging(prev => ({ ...prev, startX: e.clientX, startY: e.clientY }));
      }
    } else if (panStart) {
      setPan(prev => ({ x: prev.x + (e.clientX - panStart.x), y: prev.y + (e.clientY - panStart.y) }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [dragging, panStart, state.items, zoom]);

  const onMouseUp = () => { setDragging(null); setPanStart(null); };

  const onCanvasMouseDown = (e) => {
    setSelected(null);
    if (tool === 'select' && e.button === 1) {
      setPanStart({ x: e.clientX, y: e.clientY });
    } else if (tool !== 'select') {
      addItem(e);
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(3, Math.max(0.2, z * factor)));
  };

  const handleContextMenu = (e, id) => {
    e.preventDefault();
    deleteItem(id);
  };

  const clearCanvas = () => {
    setState({ items: [], connections: [] });
    setSelected(null);
  };

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
        background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px', marginBottom: '12px',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#ece0dc', marginRight: '8px' }}>Canvas</span>
        <div style={{ width: '1px', height: '20px', background: 'rgba(88,66,55,0.2)' }} />

        {/* Tools */}
        {TOOL_MODES.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)} title={t.tip} style={{
            display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px',
            background: tool === t.id ? 'rgba(45,95,223,0.15)' : 'transparent',
            border: tool === t.id ? '1px solid rgba(45,95,223,0.3)' : '1px solid transparent',
            color: tool === t.id ? '#ffb690' : 'rgba(167,139,125,0.6)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 100ms'
          }}>
            {t.icon} {t.tip}
          </button>
        ))}

        <div style={{ width: '1px', height: '20px', background: 'rgba(88,66,55,0.2)' }} />

        {/* Color Picker */}
        {COLORS.map(c => (
          <button key={c} onClick={() => setSelectedColor(c)} style={{
            width: '18px', height: '18px', borderRadius: '50%', background: c, border: selectedColor === c ? '2px solid white' : '2px solid transparent', cursor: 'pointer', transition: 'all 100ms'
          }} />
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
          <button onClick={() => setZoom(z => Math.min(3, z * 1.2))} title="Zoom In" style={{ padding: '6px', borderRadius: '6px', background: 'none', border: 'none', color: 'rgba(167,139,125,0.6)', cursor: 'pointer' }}>
            <ZoomIn size={15} />
          </button>
          <button onClick={() => setZoom(z => Math.max(0.2, z * 0.8))} title="Zoom Out" style={{ padding: '6px', borderRadius: '6px', background: 'none', border: 'none', color: 'rgba(167,139,125,0.6)', cursor: 'pointer' }}>
            <ZoomOut size={15} />
          </button>
          <button onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }} title="Reset View" style={{ padding: '6px', borderRadius: '6px', background: 'none', border: 'none', color: 'rgba(167,139,125,0.6)', cursor: 'pointer' }}>
            <RotateCcw size={14} />
          </button>
          <div style={{ width: '1px', height: '20px', background: 'rgba(88,66,55,0.2)', margin: '0 2px', alignSelf: 'center' }} />
          <button onClick={clearCanvas} style={{
            padding: '6px 10px', borderRadius: '6px', background: 'none', border: 'none', color: 'rgba(88,66,55,0.5)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 100ms'
          }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(88,66,55,0.5)'; e.currentTarget.style.background = 'none'; }}>
            <Trash2 size={13} /> Clear
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={canvasRef}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseDown={onCanvasMouseDown}
        onWheel={onWheel}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: '#120d0b', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px',
          cursor: tool === 'select' ? 'default' : 'crosshair',
          backgroundImage: 'radial-gradient(circle, rgba(88,66,55,0.2) 1px, transparent 1px)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}>

        {/* Transformed layer */}
        <div style={{ position: 'absolute', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: '100%', height: '100%' }}>
          {state.items.map(item => (
            <div
              key={item.id}
              onMouseDown={(e) => onMouseDown(e, item.id)}
              onContextMenu={(e) => handleContextMenu(e, item.id)}
              onDoubleClick={() => setEditing(item.id)}
              style={{
                position: 'absolute',
                left: item.x, top: item.y,
                width: item.width, minHeight: item.height,
                background: item.bg,
                border: selected === item.id
                  ? `2px solid ${item.color}`
                  : item.type === 'text' ? 'none' : `1px solid ${item.color}44`,
                borderRadius: item.type === 'sticky' ? '8px' : item.type === 'text' ? '0' : '10px',
                padding: item.type === 'text' ? '0' : '14px',
                cursor: tool === 'select' ? (dragging?.id === item.id ? 'grabbing' : 'grab') : 'crosshair',
                boxShadow: selected === item.id ? `0 0 0 1px ${item.color}66, 0 8px 32px rgba(0,0,0,0.4)` : 'none',
                userSelect: 'none',
                transition: 'box-shadow 100ms',
              }}>

              {/* Color bar for sticky */}
              {item.type === 'sticky' && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: item.color, borderRadius: '7px 7px 0 0' }} />
              )}

              {editing === item.id ? (
                <textarea
                  autoFocus
                  value={item.text}
                  onChange={e => updateItem(item.id, { text: e.target.value })}
                  onBlur={() => setEditing(null)}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '100%', background: 'none', border: 'none', outline: 'none', resize: 'none',
                    fontSize: item.type === 'text' ? '18px' : '13px',
                    fontWeight: item.type === 'text' ? 700 : 500,
                    color: item.type === 'text' ? item.color : '#ece0dc',
                    fontFamily: 'inherit', lineHeight: 1.5,
                    minHeight: '60px',
                  }}
                />
              ) : (
                <p style={{
                  margin: item.type === 'sticky' ? '8px 0 0' : 0,
                  fontSize: item.type === 'text' ? '18px' : '13px',
                  fontWeight: item.type === 'text' ? 700 : 500,
                  color: item.type === 'text' ? item.color : '#ece0dc',
                  whiteSpace: 'pre-wrap', lineHeight: 1.5, wordBreak: 'break-word',
                }}>
                  {item.text}
                </p>
              )}

              {/* Delete indicator on select */}
              {selected === item.id && editing !== item.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                  style={{
                    position: 'absolute', top: '-10px', right: '-10px',
                    width: '20px', height: '20px', borderRadius: '50%', background: '#ef4444', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10
                  }}>
                  <Minus size={11} style={{ color: 'white' }} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Empty state */}
        {state.items.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <Palette size={24} style={{ color: '#a855f7' }} />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#e0c0b1', marginBottom: '6px' }}>Creative Canvas</div>
            <div style={{ fontSize: '12px', color: 'rgba(88,66,55,0.6)', textAlign: 'center', maxWidth: '280px', lineHeight: 1.6 }}>
              Pick a tool above and click anywhere to add sticky notes, text blocks, or cards.<br />
              <span style={{ color: 'rgba(88,66,55,0.5)' }}>Right-click any item to delete it.</span>
            </div>
          </div>
        )}

        {/* HUD */}
        <div style={{ position: 'absolute', bottom: '12px', left: '16px', fontSize: '10px', color: 'rgba(88,66,55,0.5)', fontWeight: 700, letterSpacing: '0.05em' }}>
          {Math.round(zoom * 100)}% • {state.items.length} items
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
