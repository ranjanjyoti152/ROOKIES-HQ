import { useState, useEffect } from 'react';
import api from '../api/client';
import { Plus, ArrowRight, Building2, Mail, Phone, X } from 'lucide-react';

const card = { background: '#0d0d14', border: '1px solid #1a1a28', borderRadius: '10px' };
const label = { display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: '#5a5a70', textTransform: 'uppercase', marginBottom: '8px' };
const inputStyle = { width: '100%', padding: '12px 16px', background: '#131320', border: '1px solid #1c1c2c', borderRadius: '8px', fontSize: '14px', color: '#c0c0d0', outline: 'none', boxSizing: 'border-box' };

const STAGES = [
  { key: 'new_lead', label: 'New Lead', color: '#6b7280' },
  { key: 'follow_ups', label: 'Follow-ups', color: '#2d5fdf' },
  { key: 'vfa', label: 'VFA', color: '#a855f7' },
  { key: 'client_won', label: 'Client Won', color: '#22c55e' },
  { key: 'closed', label: 'Closed', color: '#14b8a6' },
];

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', source: '', value: '' });

  const fetchLeads = async () => { try { const r = await api.get('/leads'); setLeads(r.data); } catch {} finally { setLoading(false); } };
  useEffect(() => { fetchLeads(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try { await api.post('/leads', { ...form, value: form.value ? parseFloat(form.value) : null }); setShowCreate(false); setForm({ name: '', email: '', phone: '', company: '', source: '', value: '' }); fetchLeads(); } catch {}
  };
  const handleTransition = async (id, target) => { try { await api.post(`/leads/${id}/transition`, { target_status: target }); fetchLeads(); } catch (e) { alert(e.response?.data?.detail || 'Failed'); } };
  const handleConvert = async (id) => { try { await api.post(`/leads/${id}/convert`); fetchLeads(); } catch (e) { alert(e.response?.data?.detail || 'Failed'); } };

  const grouped = STAGES.reduce((a, s) => { a[s.key] = leads.filter(l => l.status === s.key); return a; }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.25s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e0e0ec' }}>Leads Pipeline</h1>
        <button onClick={() => setShowCreate(true)} style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 20px', borderRadius: '8px',
          background: '#2d5fdf', border: 'none', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}>
          <Plus size={15} /> Add Lead
        </button>
      </div>

      {/* Kanban Columns */}
      <div style={{ display: 'flex', gap: '10px', flex: 1, overflowX: 'auto', paddingBottom: '16px' }}>
        {STAGES.map(stage => (
          <div key={stage.key} style={{
            display: 'flex', flexDirection: 'column', minWidth: '240px', flex: 1, borderRadius: '10px',
            background: '#0c0c12', border: '1px solid #151520',
          }}>
            {/* Column Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #151520' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color, display: 'inline-block' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#c0c0d0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stage.label}</span>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#4a4a60', background: '#101018', padding: '2px 8px', borderRadius: '4px' }}>
                {grouped[stage.key]?.length || 0}
              </span>
            </div>

            {/* Lead Cards */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(grouped[stage.key] || []).map(lead => (
                <div key={lead.id} style={{ ...card, padding: '14px', transition: 'border 150ms' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#2a2a3a'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#1a1a28'}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#d0d0e0', marginBottom: '6px' }}>{lead.name}</p>

                  {lead.company && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                      <Building2 size={10} style={{ color: '#3a3a50' }} />
                      <span style={{ fontSize: '11px', color: '#4a4a60' }}>{lead.company}</span>
                    </div>
                  )}

                  {lead.value && (
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e', marginBottom: '4px' }}>
                      ${parseFloat(lead.value).toLocaleString()}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    {lead.email && <Mail size={10} style={{ color: '#3a3a50' }} />}
                    {lead.phone && <Phone size={10} style={{ color: '#3a3a50' }} />}
                    {lead.source && <span style={{ fontSize: '10px', color: '#3a3a50' }}>via {lead.source}</span>}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {stage.key === 'new_lead' && (
                      <button onClick={() => handleTransition(lead.id, 'follow_ups')} style={{
                        display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '4px',
                        fontSize: '10px', fontWeight: 700, background: 'rgba(45,95,223,0.12)', color: '#5090ff',
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
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setShowCreate(false)}>
          <div style={{ ...card, padding: '32px', width: '100%', maxWidth: '420px', animation: 'scaleIn 0.15s ease-out' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#e0e0ec' }}>Add Lead</h2>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: '#4a4a60', cursor: 'pointer' }}><X size={18} /></button>
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
                    style={inputStyle} onFocus={e => e.target.style.borderColor = '#2d5fdf'} onBlur={e => e.target.style.borderColor = '#1c1c2c'} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowCreate(false)} style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: 'transparent',
                  border: '1px solid #1c1c2c', fontSize: '14px', fontWeight: 600, color: '#6a6a80', cursor: 'pointer',
                }}>Cancel</button>
                <button type="submit" style={{
                  flex: 1, padding: '12px', borderRadius: '8px', background: '#2d5fdf',
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
