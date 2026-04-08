import { useState, useEffect } from 'react';
import api from '../api/client';
import { Plus, ArrowRight, Building2, Mail, Phone, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import useToastStore from '../store/toastStore';

const card = { background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(88,66,55,0.2)', borderRadius: '10px' };
const label = { display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(167,139,125,0.5)', textTransform: 'uppercase', marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '12px 16px', background: '#2f2926', border: '1px solid rgba(88,66,55,0.3)', borderRadius: '8px', fontSize: '14px', color: '#e0c0b1', outline: 'none', boxSizing: 'border-box' };

const STAGES = [
  { key: 'new_lead', label: 'New Lead', color: '#6b7280' },
  { key: 'follow_ups', label: 'Follow-ups', color: '#f97316' },
  { key: 'vfa', label: 'VFA', color: '#a855f7' },
  { key: 'client_won', label: 'Client Won', color: '#22c55e' },
  { key: 'closed', label: 'Closed', color: '#14b8a6' },
];

export default function Leads() {
  const { pushToast } = useToastStore();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', source: '', value: '' });

  const fetchLeads = async () => {
    try {
      const r = await api.get('/leads');
      setLeads(r.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to load leads.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchLeads(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/leads', { ...form, value: form.value ? parseFloat(form.value) : null });
      setShowCreate(false);
      setForm({ name: '', email: '', phone: '', company: '', source: '', value: '' });
      await fetchLeads();
      setError('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create lead.');
    }
  };
  const handleTransition = async (id, target) => {
    try {
      await api.post(`/leads/${id}/transition`, { target_status: target });
      await fetchLeads();
      pushToast({ type: 'success', title: 'Lead updated', message: `Moved to ${target.replace('_', ' ')}.` });
    } catch (e) {
      const message = e.response?.data?.detail || 'Failed to move lead';
      setError(message);
      pushToast({ type: 'error', title: 'Lead transition failed', message });
    }
  };
  const handleConvert = async (id) => {
    try {
      await api.post(`/leads/${id}/convert`);
      await fetchLeads();
      pushToast({ type: 'success', title: 'Lead converted', message: 'Project and initial task were created.' });
    } catch (e) {
      const message = e.response?.data?.detail || 'Failed to convert lead';
      setError(message);
      pushToast({ type: 'error', title: 'Conversion failed', message });
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;

    if (source.droppableId !== destination.droppableId) {
      const destKey = destination.droppableId;

      // Optimistically update the UI
      setLeads(prevLeads => prevLeads.map(l => l.id === draggableId ? { ...l, status: destKey } : l));

      try {
        await api.post(`/leads/${draggableId}/transition`, { target_status: destKey });
        // Optionally fetch leads again to ensure exact consistency is maintained.
        fetchLeads();
      } catch (e) {
        const message = e.response?.data?.detail || 'Invalid transition';
        setError(message);
        pushToast({ type: 'error', title: 'Drag transition rejected', message });
        // Revert on error
        fetchLeads();
      }
    }
  };

  const grouped = STAGES.reduce((a, s) => { a[s.key] = leads.filter(l => l.status === s.key); return a; }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.25s ease-out' }}>
      {loading && (
        <div style={{ ...card, padding: '12px 14px', marginBottom: '12px', fontSize: '12px', color: 'rgba(167,139,125,0.7)' }}>
          Loading leads...
        </div>
      )}
      {error && (
        <div style={{ ...card, padding: '12px 14px', marginBottom: '12px', fontSize: '12px', color: '#f87171' }}>
          {error}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Leads Pipeline</h1>
        <button onClick={() => setShowCreate(true)} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px',
          background: '#f97316', border: 'none', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}>
          <Plus size={15} /> Add Lead
        </button>
      </div>

      {/* Kanban Columns */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, overflowX: 'auto', paddingBottom: '16px' }}>
          {STAGES.map(stage => (
            <Droppable droppableId={stage.key} key={stage.key}>
              {(provided) => (
                <div 
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  style={{
                    display: 'flex', flexDirection: 'column', minWidth: '240px', flex: 1, borderRadius: '10px',
                    background: '#1a1210', border: '1px solid rgba(88,66,55,0.15)',
                  }}
                >
                  {/* Column Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid rgba(88,66,55,0.15)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color, display: 'inline-block' }} />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#e0c0b1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stage.label}</span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(88,66,55,0.6)', background: 'rgba(32, 26, 24, 0.55)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', padding: '2px 8px', borderRadius: '4px' }}>
                      {grouped[stage.key]?.length || 0}
                    </span>
                  </div>

                  {/* Lead Cards */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(grouped[stage.key] || []).map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <div 
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{ 
                              ...card, 
                              padding: '14px', 
                              transition: snapshot.isDragging ? 'none' : 'border 150ms',
                              opacity: snapshot.isDragging ? 0.8 : 1,
                              borderColor: snapshot.isDragging ? '#f97316' : 'rgba(88,66,55,0.2)',
                              ...provided.draggableProps.style,
                            }}
                          >
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#ece0dc', marginBottom: '6px' }}>{lead.name}</p>

                            {lead.company && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                                <Building2 size={10} style={{ color: 'rgba(88,66,55,0.5)' }} />
                                <span style={{ fontSize: '11px', color: 'rgba(88,66,55,0.6)' }}>{lead.company}</span>
                              </div>
                            )}

                            {lead.value && (
                              <p style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e', marginBottom: '4px' }}>
                                ${parseFloat(lead.value).toLocaleString()}
                              </p>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                              {lead.email && <Mail size={10} style={{ color: 'rgba(88,66,55,0.5)' }} />}
                              {lead.phone && <Phone size={10} style={{ color: 'rgba(88,66,55,0.5)' }} />}
                              {lead.source && <span style={{ fontSize: '10px', color: 'rgba(88,66,55,0.5)' }}>via {lead.source}</span>}
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {stage.key === 'new_lead' && (
                                <button onClick={() => handleTransition(lead.id, 'follow_ups')} style={{
                                  display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '4px',
                                  fontSize: '10px', fontWeight: 700, background: 'rgba(249,115,22,0.12)', color: '#ffb690',
                                  border: 'none', cursor: 'pointer', textTransform: 'uppercase',
                                }}><ArrowRight size={10} /> Follow-up</button>
                              )}
                              {stage.key === 'follow_ups' && (
                                <button onClick={() => handleTransition(lead.id, 'vfa')} style={{
                                  display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '4px',
                                  fontSize: '10px', fontWeight: 700, background: 'rgba(168,85,247,0.12)', color: '#a855f7',
                                  border: 'none', cursor: 'pointer', textTransform: 'uppercase',
                                }}><ArrowRight size={10} /> VFA</button>
                              )}
                              {stage.key === 'vfa' && (
                                <>
                                  <button onClick={() => handleTransition(lead.id, 'client_won')} style={{
                                    padding: '5px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                                    background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: 'none', cursor: 'pointer',
                                  }}>Won</button>
                                  <button onClick={() => handleTransition(lead.id, 'closed')} style={{
                                    padding: '5px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                                    background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'none', cursor: 'pointer',
                                  }}>Lost</button>
                                </>
                              )}
                              {stage.key === 'client_won' && (
                                <button onClick={() => handleConvert(lead.id)} style={{
                                  padding: '5px 10px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                                  background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: 'none', cursor: 'pointer',
                                }}>🚀 Convert</button>
                              )}
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
          ))}
        </div>
      </DragDropContext>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setShowCreate(false)}>
          <div style={{ ...card, padding: '32px', width: '100%', maxWidth: '420px', animation: 'scaleIn 0.15s ease-out' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#ece0dc' }}>Add Lead</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'rgba(88,66,55,0.6)', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate}>
              {[
                { key: 'name', label: 'Contact Name', placeholder: 'Jane Smith', required: true },
                { key: 'email', label: 'Email', placeholder: 'jane@company.com', type: 'email' },
                { key: 'phone', label: 'Phone', placeholder: '+1 555 0100' },
                { key: 'company', label: 'Company', placeholder: 'Acme Corp' },
                { key: 'source', label: 'Source', placeholder: 'Referral, Website, etc.' },
                { key: 'value', label: 'Deal Value ($)', placeholder: '10000', type: 'number' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: '16px' }}>
                  <label style={label}>{f.label}</label>
                  <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    required={f.required} placeholder={f.placeholder}
                    style={inputStyle} onFocus={e => e.target.style.borderColor = '#f97316'} onBlur={e => e.target.style.borderColor = 'rgba(88,66,55,0.3)'} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: 'transparent',
                  border: '1px solid rgba(88,66,55,0.3)', fontSize: '14px', fontWeight: 600, color: 'rgba(167,139,125,0.6)', cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: '#f97316',
                  border: 'none', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer',
                }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
