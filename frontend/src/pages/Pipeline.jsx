import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../api/client';
import { User, Paperclip, Calendar } from 'lucide-react';

const COLUMNS = [
  { key: 'unassigned', label: 'Unassigned', color: '#6b7280' },
  { key: 'claimed', label: 'Claimed', color: '#f97316' },
  { key: 'editing', label: 'Editing', color: '#eab308' },
  { key: 'internal_review', label: 'Internal Review', color: '#a855f7' },
  { key: 'revision', label: 'Revision', color: '#f97316' },
  { key: 'delivered', label: 'Delivered', color: '#22c55e' },
  { key: 'closed', label: 'Closed', color: '#14b8a6' },
];

const priorityDot = { urgent: '#ef4444', high: '#f97316', medium: '#f97316', low: 'rgba(88,66,55,0.6)' };

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
          <div style={{ width: '80px', height: '20px', background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '4px', marginBottom: '12px' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1,2,3].map(i => <div key={i} style={{ height: '70px', background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '8px' }} />)}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.25s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Pipeline</h1>
        <span style={{ fontSize: '12px', color: 'rgba(88,66,55,0.5)' }}>Drag tasks to advance through stages</span>
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
                    background: snapshot.isDraggingOver ? '#0f0f18' : '#1a1210',
                    border: '1px solid rgba(88,66,55,0.15)', transition: 'background 150ms',
                  }}>
                    {/* Column Header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px', borderBottom: '1px solid rgba(88,66,55,0.15)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color, display: 'inline-block' }} />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#e0c0b1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          {col.label}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, color: 'rgba(88,66,55,0.6)',
                        background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '2px 8px', borderRadius: '4px',
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
                                padding: '12px', borderRadius: '8px', marginBottom: '6px',
                                background: snap.isDragging ? '#2f2926' : '#201a18',
                                border: snap.isDragging ? '1px solid #f97316' : '1px solid rgba(88,66,55,0.2)',
                                boxShadow: snap.isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
                                transition: snap.isDragging ? 'none' : 'border 150ms, box-shadow 150ms',
                                cursor: 'grab',
                                ...prov.draggableProps.style,
                              }}
                            >
                              {/* Title */}
                              <p style={{
                                fontSize: '12px', fontWeight: 600, color: '#ece0dc',
                                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                lineHeight: 1.4, marginBottom: '8px',
                              }}>
                                {task.title}
                              </p>

                              {/* Priority */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                <span style={{
                                  width: '6px', height: '6px', borderRadius: '50%',
                                  background: priorityDot[task.priority] || 'rgba(88,66,55,0.6)', display: 'inline-block',
                                }} />
                                <span style={{ fontSize: '10px', color: 'rgba(88,66,55,0.5)', textTransform: 'capitalize' }}>{task.priority}</span>
                              </div>

                              {/* Footer */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                {task.assigned_user_name ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <div style={{
                                      width: '18px', height: '18px', borderRadius: '50%',
                                      background: '#2f2926', border: '1px solid rgba(88,66,55,0.3)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                      <User size={8} style={{ color: 'rgba(88,66,55,0.6)' }} />
                                    </div>
                                    <span style={{ fontSize: '10px', color: 'rgba(88,66,55,0.6)', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {task.assigned_user_name}
                                    </span>
                                  </div>
                                ) : (
                                  <span style={{ fontSize: '10px', color: 'rgba(88,66,55,0.5)', fontStyle: 'italic' }}>unassigned</span>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {task.attachment_link && <Paperclip size={10} style={{ color: 'rgba(88,66,55,0.5)' }} />}
                                  {task.deadline && <Calendar size={10} style={{ color: 'rgba(88,66,55,0.5)' }} />}
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
