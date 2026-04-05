import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../api/client';
import { User, Paperclip, Calendar } from 'lucide-react';

const COLUMNS = [
  { key: 'unassigned', label: 'Unassigned', color: '#6b7280' },
  { key: 'claimed', label: 'Claimed', color: '#2d5fdf' },
  { key: 'editing', label: 'Editing', color: '#eab308' },
  { key: 'internal_review', label: 'Internal Review', color: '#a855f7' },
  { key: 'revision', label: 'Revision', color: '#f97316' },
  { key: 'delivered', label: 'Delivered', color: '#22c55e' },
  { key: 'closed', label: 'Closed', color: '#14b8a6' },
];

const priorityDot = { urgent: '#ef4444', high: '#f97316', medium: '#2d5fdf', low: '#4a4a60' };

export default function Pipeline() {
  const [pipeline, setPipeline] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tasks/pipeline').then(r => setPipeline(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleDragEnd = async (result) => {
    if (!result.destination || result.source.droppableId === result.destination.droppableId) return;
    const { source, destination, draggableId } = result;
    const old = { ...pipeline };
    const src = [...(pipeline[source.droppableId] || [])];
    const dst = [...(pipeline[destination.droppableId] || [])];
    const [moved] = src.splice(source.index, 1);
    moved.status = destination.droppableId;
    dst.splice(destination.index, 0, moved);
    setPipeline({ ...pipeline, [source.droppableId]: src, [destination.droppableId]: dst });
    try { await api.post(`/tasks/${draggableId}/transition`, { target_status: destination.droppableId }); }
    catch { setPipeline(old); }
  };

  if (loading) return (
    <div style={{ display: 'flex', gap: '12px', height: '100%' }}>
      {COLUMNS.map(c => (
        <div key={c.key} style={{ flex: 1, minWidth: '180px' }}>
          <div style={{ width: '80px', height: '20px', background: '#0d0d14', borderRadius: '4px', marginBottom: '12px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1,2,3].map(i => <div key={i} style={{ height: '70px', background: '#0d0d14', borderRadius: '8px' }} />)}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.25s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e0e0ec' }}>Pipeline</h1>
        <span style={{ fontSize: '12px', color: '#3a3a50' }}>Drag tasks to advance through stages</span>
      </div>

      {/* Kanban */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, overflowX: 'auto', paddingBottom: '16px' }}>
          {COLUMNS.map(col => {
            const tasks = pipeline[col.key] || [];
            return (
              <Droppable key={col.key} droppableId={col.key}>
                {(provided, snapshot) => (
                  <div style={{
                    display: 'flex', flexDirection: 'column', minWidth: '230px', width: '230px', borderRadius: '10px',
                    background: snapshot.isDraggingOver ? '#0f0f18' : '#0c0c12',
                    border: '1px solid #151520', transition: 'background 150ms',
                  }}>
                    {/* Column Header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px', borderBottom: '1px solid #151520',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#c0c0d0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {col.label}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, color: '#4a4a60',
                        background: '#101018', padding: '2px 8px', borderRadius: '4px',
                      }}>
                        {tasks.length}
                      </span>
                    </div>

                    {/* Cards Area */}
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={{ flex: 1, overflowY: 'auto', padding: '8px', minHeight: '100px' }}
                    >
                      {tasks.map((task, i) => (
                        <Draggable key={task.id} draggableId={task.id} index={i}>
                          {(prov, snap) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              {...prov.dragHandleProps}
                              style={{
                                ...prov.draggableProps.style,
                                padding: '12px', borderRadius: '8px', marginBottom: '6px',
                                background: snap.isDragging ? '#131320' : '#0d0d14',
                                border: snap.isDragging ? '1px solid #2d5fdf' : '1px solid #1a1a28',
                                boxShadow: snap.isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
                                transition: snap.isDragging ? 'none' : 'border 150ms',
                                cursor: 'grab',
                              }}
                            >
                              {/* Title */}
                              <p style={{
                                fontSize: '12px', fontWeight: 600, color: '#d0d0e0',
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                lineHeight: 1.4, marginBottom: '8px',
                              }}>
                                {task.title}
                              </p>

                              {/* Priority */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                <span style={{
                                  width: '6px', height: '6px', borderRadius: '50%',
                                  background: priorityDot[task.priority] || '#4a4a60', display: 'inline-block',
                                }} />
                                <span style={{ fontSize: '10px', color: '#3a3a50', textTransform: 'capitalize' }}>{task.priority}</span>
                              </div>

                              {/* Footer */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {task.assigned_user_name ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <div style={{
                                      width: '18px', height: '18px', borderRadius: '50%',
                                      background: '#131320', border: '1px solid #1c1c2c',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                      <User size={8} style={{ color: '#4a4a60' }} />
                                    </div>
                                    <span style={{ fontSize: '10px', color: '#4a4a60', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {task.assigned_user_name}
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '10px', color: '#2a2a3a', fontStyle: 'italic' }}>unassigned</span>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {task.attachment_link && <Paperclip size={10} style={{ color: '#3a3a50' }} />}
                                  {task.deadline && <Calendar size={10} style={{ color: '#3a3a50' }} />}
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
