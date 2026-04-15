import { useMemo, useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, Search, X } from 'lucide-react';
import useToastStore from '../store/toastStore';

const card = {
  background: 'rgba(32, 26, 24, 0.55)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(88,66,55,0.2)',
  borderRadius: '10px',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: '#2f2926',
  border: '1px solid rgba(88,66,55,0.3)',
  borderRadius: '8px',
  fontSize: '12px',
  color: '#e0c0b1',
  outline: 'none',
  boxSizing: 'border-box',
};

const STAGES = [
  { key: 'new_lead', label: 'New Lead', color: '#64748b' },
  { key: 'first_follow_up', label: 'First Follow-Up', color: '#f97316' },
  { key: 'second_follow_up', label: 'Second Follow-Up', color: '#fb923c' },
  { key: 'go_to_reply', label: 'Go To Reply', color: '#eab308' },
  { key: 'working_on_value_first', label: 'Working On Value First', color: '#a855f7' },
  { key: 'vfa_send', label: 'VFA Send', color: '#8b5cf6' },
  { key: 'client_won', label: 'Client Won', color: '#22c55e' },
  { key: 'closed', label: 'Closed', color: '#14b8a6' },
];

const TRANSITION_NEXT = {
  new_lead: 'first_follow_up',
  first_follow_up: 'second_follow_up',
  second_follow_up: 'go_to_reply',
  go_to_reply: 'working_on_value_first',
  working_on_value_first: 'vfa_send',
  vfa_send: 'client_won',
  client_won: 'closed',
};

const TRANSITION_GRAPH = {
  new_lead: ['first_follow_up'],
  first_follow_up: ['second_follow_up'],
  second_follow_up: ['go_to_reply'],
  go_to_reply: ['working_on_value_first'],
  working_on_value_first: ['vfa_send'],
  vfa_send: ['client_won', 'closed'],
  client_won: ['closed'],
  closed: [],
};

const STATUS_ALIASES = {
  working_on_valuefirst: 'working_on_value_first',
  'working on value first': 'working_on_value_first',
  'working_on_value first': 'working_on_value_first',
  'working-on-value-first': 'working_on_value_first',
};

function normalizeStatus(status) {
  const key = String(status || '').trim().toLowerCase();
  return STATUS_ALIASES[key] || key;
}

function findTransitionPath(source, target) {
  const start = normalizeStatus(source);
  const end = normalizeStatus(target);
  if (start === end) return [];

  const queue = [[start]];
  const visited = new Set([start]);

  while (queue.length > 0) {
    const path = queue.shift();
    const node = path[path.length - 1];
    const nextNodes = TRANSITION_GRAPH[node] || [];
    for (const next of nextNodes) {
      if (visited.has(next)) continue;
      const nextPath = [...path, next];
      if (next === end) return nextPath.slice(1);
      visited.add(next);
      queue.push(nextPath);
    }
  }

  return null;
}

const defaultQuick = {
  name: '',
  priority: 'medium',
  niche: '',
  task_tags: [],
  niche_tags: [],
  value: '',
  site_url: '',
  description: '',
};

const defaultDetail = {
  id: null,
  name: '',
  company: '',
  status: 'new_lead',
  priority: 'medium',
  value: '',
  site_url: '',
  task_tags: [],
  niche_tags: [],
  niche: '',
  reference_link: '',
  contact_email: '',
  custom_comments: '',
  description: '',
};

function mergeTagNames(...groups) {
  const seen = new Set();
  const names = [];
  groups.flat().forEach((name) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(clean);
  });
  return names.sort((a, b) => a.localeCompare(b));
}

function TagPicker({ label, options, selected, onChange, placeholder = 'Select tags' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isSelected = (tagName) => selected.some((s) => String(s).toLowerCase() === String(tagName).toLowerCase());

  const toggleTag = (tagName) => {
    const key = String(tagName).toLowerCase();
    if (isSelected(tagName)) {
      onChange(selected.filter((s) => String(s).toLowerCase() !== key));
      return;
    }
    onChange([...selected, tagName]);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {label && <div style={{ fontSize: '10px', color: 'rgba(167,139,125,0.75)', marginBottom: '4px' }}>{label}</div>}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          minHeight: '36px',
          padding: '8px 10px',
          borderRadius: '8px',
          border: '1px solid rgba(88,66,55,0.35)',
          background: '#2f2926',
          color: selected.length ? '#e6d5ce' : 'rgba(167,139,125,0.62)',
          fontSize: '12px',
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        {selected.length ? `${selected.length} selected` : placeholder}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 'calc(100% + 6px)',
            maxHeight: '180px',
            overflowY: 'auto',
            border: '1px solid rgba(88,66,55,0.35)',
            borderRadius: '8px',
            background: '#201a18',
            zIndex: 30,
            padding: '6px',
          }}
        >
          {options.length === 0 ? (
            <div style={{ fontSize: '11px', color: 'rgba(167,139,125,0.65)', padding: '6px' }}>No tags available.</div>
          ) : (
            options.map((tagName) => (
              <label
                key={tagName}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: '#e6d5ce',
                  fontSize: '12px',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected(tagName)}
                  onChange={() => toggleTag(tagName)}
                  style={{ accentColor: '#f97316' }}
                />
                <span>{tagName}</span>
              </label>
            ))
          )}
        </div>
      )}
      {selected.length > 0 && (
        <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {selected.map((tagName) => (
            <button
              key={tagName}
              type="button"
              onClick={() => toggleTag(tagName)}
              style={{
                border: '1px solid rgba(249,115,22,0.28)',
                borderRadius: '999px',
                background: 'rgba(249,115,22,0.12)',
                color: '#ffb690',
                fontSize: '10px',
                padding: '2px 8px',
                cursor: 'pointer',
              }}
            >
              {tagName} x
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Leads() {
  const { pushToast } = useToastStore();
  const [leads, setLeads] = useState([]);
  const [summary, setSummary] = useState({ pipeline_value: 0, closed_value: 0 });
  const [taskTagOptions, setTaskTagOptions] = useState([]);
  const [nicheTagOptions, setNicheTagOptions] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [quickStage, setQuickStage] = useState(null);
  const [quickForm, setQuickForm] = useState(defaultQuick);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailForm, setDetailForm] = useState(defaultDetail);

  const fetchAll = async () => {
    try {
      const [leadsRes, summaryRes, taskTagsRes, nicheTagsRes] = await Promise.all([
        api.get('/leads', { params: { search: search || undefined } }),
        api.get('/leads/summary'),
        api.get('/tags', { params: { kind: 'task' } }).catch(() => ({ data: [] })),
        api.get('/tags', { params: { kind: 'niche' } }).catch(() => ({ data: [] })),
      ]);
      const normalizedLeads = (leadsRes.data || []).map((l) => ({ ...l, status: normalizeStatus(l.status) }));
      setLeads(normalizedLeads);
      setSummary(summaryRes.data || { pipeline_value: 0, closed_value: 0 });
      setTaskTagOptions(
        mergeTagNames(
          (taskTagsRes.data || []).map((t) => t.name),
          normalizedLeads.flatMap((l) => (Array.isArray(l.task_tags) ? l.task_tags : []))
        )
      );
      setNicheTagOptions(
        mergeTagNames(
          (nicheTagsRes.data || []).map((t) => t.name),
          normalizedLeads.flatMap((l) => (Array.isArray(l.niche_tags) ? l.niche_tags : [])),
          normalizedLeads.map((l) => l.niche).filter(Boolean)
        )
      );
      setError('');
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to load leads funnel.');
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!cancelled) await fetchAll();
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = !query
      ? leads
      : leads.filter((l) =>
          [l.name, l.company, l.niche, l.contact_email, l.email]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(query))
        );
    return STAGES.reduce((acc, stage) => {
      acc[stage.key] = filtered.filter((l) => l.status === stage.key);
      return acc;
    }, {});
  }, [leads, search]);

  const handleQuickAdd = async () => {
    if (!quickForm.name.trim()) {
      pushToast({ type: 'warning', title: 'Name required', message: 'Lead name is required.' });
      return;
    }
    try {
      await api.post('/leads', {
        name: quickForm.name.trim(),
        priority: quickForm.priority,
        niche: quickForm.niche || null,
        task_tags: quickForm.task_tags,
        niche_tags: quickForm.niche_tags,
        value: quickForm.value ? Number(quickForm.value) : null,
        site_url: quickForm.site_url || null,
        description: quickForm.description || null,
      });

      setQuickStage(null);
      setQuickForm(defaultQuick);
      await fetchAll();
      pushToast({ type: 'success', title: 'Lead added', message: 'Lead saved to funnel.' });
    } catch (e) {
      const message = e.response?.data?.detail || 'Failed to add lead';
      setError(message);
      pushToast({ type: 'error', title: 'Quick add failed', message });
    }
  };

  const openLeadDetail = (lead) => {
    setDetailForm({
      id: lead.id,
      name: lead.name || '',
      company: lead.company || '',
      status: lead.status || 'new_lead',
      priority: lead.priority || 'medium',
      value: lead.value || '',
      site_url: lead.site_url || '',
      task_tags: Array.isArray(lead.task_tags) ? lead.task_tags : [],
      niche_tags: Array.isArray(lead.niche_tags) ? lead.niche_tags : [],
      niche: lead.niche || '',
      reference_link: lead.reference_link || '',
      contact_email: lead.contact_email || lead.email || '',
      custom_comments: lead.custom_comments || '',
      description: lead.description || lead.notes || '',
    });
    setDetailOpen(true);
  };

  const saveLeadDetail = async () => {
    if (!detailForm.id) return;
    try {
      await api.put(`/leads/${detailForm.id}`, {
        name: detailForm.name,
        company: detailForm.company || null,
        status: detailForm.status,
        priority: detailForm.priority,
        value: detailForm.value ? Number(detailForm.value) : null,
        site_url: detailForm.site_url || null,
        task_tags: detailForm.task_tags,
        niche_tags: detailForm.niche_tags,
        niche: detailForm.niche || null,
        reference_link: detailForm.reference_link || null,
        contact_email: detailForm.contact_email || null,
        custom_comments: detailForm.custom_comments || null,
        description: detailForm.description || null,
      });
      setDetailOpen(false);
      await fetchAll();
      pushToast({ type: 'success', title: 'Lead updated', message: 'Lead details saved.' });
    } catch (e) {
      const message = e.response?.data?.detail || 'Failed to update lead';
      setError(message);
      pushToast({ type: 'error', title: 'Update failed', message });
    }
  };

  const transitionLead = async (id, target) => {
    try {
      const normalizedTarget = normalizeStatus(target);
      await api.post(`/leads/${id}/transition`, { target_status: normalizedTarget });
      await fetchAll();
      pushToast({ type: 'success', title: 'Lead moved', message: `Moved to ${normalizedTarget.replace(/_/g, ' ')}.` });
    } catch (e) {
      const message = e.response?.data?.detail || 'Transition failed';
      setError(message);
      pushToast({ type: 'error', title: 'Move failed', message });
    }
  };

  const convertLead = async (id) => {
    try {
      await api.post(`/leads/${id}/convert`);
      await fetchAll();
      pushToast({ type: 'success', title: 'Lead converted', message: 'Project and pipeline task created.' });
    } catch (e) {
      const message = e.response?.data?.detail || 'Conversion failed';
      setError(message);
      pushToast({ type: 'error', title: 'Convert failed', message });
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const old = leads;
    const normalizedSource = normalizeStatus(source.droppableId);
    const normalizedTarget = normalizeStatus(destination.droppableId);
    const transitionSteps = findTransitionPath(normalizedSource, normalizedTarget);

    if (!transitionSteps) {
      const message = `Can't move from '${normalizedSource}' to '${normalizedTarget}'.`;
      setError(message);
      pushToast({ type: 'error', title: 'Drag transition rejected', message });
      return;
    }

    setLeads((prev) => prev.map((l) => (l.id === draggableId ? { ...l, status: normalizedTarget } : l)));

    try {
      for (const step of transitionSteps) {
        await api.post(`/leads/${draggableId}/transition`, { target_status: step });
      }
      await fetchAll();
    } catch (e) {
      setLeads(old);
      const message = e.response?.data?.detail || 'Invalid transition';
      setError(message);
      pushToast({ type: 'error', title: 'Drag transition rejected', message });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.25s ease-out' }}>
      {error && <div style={{ ...card, padding: '12px 14px', marginBottom: '12px', fontSize: '12px', color: '#f87171' }}>{error}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Leads Funnel</h1>
          <p style={{ marginTop: '4px', fontSize: '12px', color: 'rgba(167,139,125,0.65)' }}>
            Pipeline: ${Number(summary.pipeline_value || 0).toLocaleString()} Closed: ${Number(summary.closed_value || 0).toLocaleString()}
          </p>
        </div>
        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(88,66,55,0.56)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." style={{ ...inputStyle, paddingLeft: '30px' }} />
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, overflowX: 'auto', paddingBottom: '12px' }}>
          {STAGES.map((stage) => (
            <Droppable droppableId={stage.key} key={stage.key}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} style={{ minWidth: '255px', width: '255px', borderRadius: '10px', background: '#1a1210', border: '1px solid rgba(88,66,55,0.18)', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '12px', borderBottom: '1px solid rgba(88,66,55,0.16)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color }} />
                      <span style={{ fontSize: '10px', color: '#e6d5ce', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{stage.label}</span>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(88,66,55,0.6)' }}>{grouped[stage.key]?.length || 0}</span>
                  </div>

                  <div style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto' }}>
                    {(grouped[stage.key] || []).map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(dragProvided) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            style={{ ...dragProvided.draggableProps.style, ...card, padding: '10px', cursor: 'pointer' }}
                            onClick={() => openLeadDetail(lead)}
                          >
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#efe2dc', marginBottom: '4px' }}>{lead.name}</div>
                            <div style={{ fontSize: '11px', color: 'rgba(167,139,125,0.62)' }}>{lead.company || 'No company'}</div>
                            {((lead.task_tags?.length || 0) > 0 || (lead.niche_tags?.length || 0) > 0) && (
                              <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {[...new Set([...(lead.task_tags || []), ...(lead.niche_tags || [])])].slice(0, 3).map((tag) => (
                                  <span key={`${lead.id}-${tag}`} style={{ fontSize: '10px', color: '#ffb690', border: '1px solid rgba(249,115,22,0.25)', padding: '2px 6px', borderRadius: '999px' }}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 700 }}>${Number(lead.value || 0).toLocaleString()}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (stage.key === 'client_won') {
                                    convertLead(lead.id);
                                    return;
                                  }
                                  const next = TRANSITION_NEXT[stage.key];
                                  if (next) transitionLead(lead.id, next);
                                }}
                                style={{ border: 'none', borderRadius: '6px', background: 'rgba(249,115,22,0.14)', color: '#ffb690', fontSize: '10px', padding: '4px 8px', fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase' }}
                              >
                                {stage.key === 'client_won' ? 'Convert' : 'Advance'}
                              </button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>

                  {stage.key === 'new_lead' && (
                    <div style={{ padding: '8px', borderTop: '1px solid rgba(88,66,55,0.16)' }}>
                      {quickStage === stage.key ? (
                      <div style={{ ...card, padding: '8px', display: 'grid', gap: '6px' }}>
                        <input value={quickForm.name} onChange={(e) => setQuickForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Lead name*" style={inputStyle} />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <select value={quickForm.priority} onChange={(e) => setQuickForm((prev) => ({ ...prev, priority: e.target.value }))} className="ui-select ui-select-sm">
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                          <input value={quickForm.value} onChange={(e) => setQuickForm((prev) => ({ ...prev, value: e.target.value }))} placeholder="Value" style={inputStyle} />
                        </div>
                        <input value={quickForm.niche} onChange={(e) => setQuickForm((prev) => ({ ...prev, niche: e.target.value }))} placeholder="Niche" style={inputStyle} />
                        <TagPicker
                          label="Task Tags"
                          options={taskTagOptions}
                          selected={quickForm.task_tags}
                          onChange={(next) => setQuickForm((prev) => ({ ...prev, task_tags: next }))}
                          placeholder="Select task tags"
                        />
                        <TagPicker
                          label="Niche Tags"
                          options={nicheTagOptions}
                          selected={quickForm.niche_tags}
                          onChange={(next) => setQuickForm((prev) => ({ ...prev, niche_tags: next }))}
                          placeholder="Select niche tags"
                        />
                        <input value={quickForm.site_url} onChange={(e) => setQuickForm((prev) => ({ ...prev, site_url: e.target.value }))} placeholder="Site" style={inputStyle} />
                        <textarea value={quickForm.description} onChange={(e) => setQuickForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={handleQuickAdd} style={{ flex: 1, border: 'none', borderRadius: '7px', background: '#f97316', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '7px 8px', cursor: 'pointer' }}>Save Lead</button>
                          <button onClick={() => { setQuickStage(null); setQuickForm(defaultQuick); }} style={{ border: '1px solid rgba(88,66,55,0.35)', borderRadius: '7px', background: 'transparent', color: 'rgba(167,139,125,0.7)', fontSize: '11px', padding: '7px 10px', cursor: 'pointer' }}>X</button>
                        </div>
                      </div>
                      ) : (
                        <button onClick={() => setQuickStage(stage.key)} style={{ width: '100%', border: '1px dashed rgba(88,66,55,0.42)', borderRadius: '8px', background: 'transparent', color: 'rgba(167,139,125,0.72)', fontSize: '11px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                          <Plus size={12} /> + Quick add lead...
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      {detailOpen && (
        <div className="ui-overlay" style={{ zIndex: 1200, padding: '16px' }} onClick={() => setDetailOpen(false)}>
          <div className="ui-subwindow" style={{ ...card, width: 'min(760px, 100%)', padding: '18px', maxHeight: '88vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', color: '#efe1db', margin: 0 }}>Edit Lead</h3>
              <button onClick={() => setDetailOpen(false)} style={{ border: 'none', background: 'transparent', color: 'rgba(167,139,125,0.72)', cursor: 'pointer' }}><X size={16} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input value={detailForm.name} onChange={(e) => setDetailForm((p) => ({ ...p, name: e.target.value }))} placeholder="Lead Name*" style={inputStyle} />
              <input value={detailForm.company} onChange={(e) => setDetailForm((p) => ({ ...p, company: e.target.value }))} placeholder="Company / Channel" style={inputStyle} />
              <select value={detailForm.status} onChange={(e) => setDetailForm((p) => ({ ...p, status: e.target.value }))} className="ui-select ui-select-sm">
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
              <select value={detailForm.priority} onChange={(e) => setDetailForm((p) => ({ ...p, priority: e.target.value }))} className="ui-select ui-select-sm">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <input value={detailForm.value} onChange={(e) => setDetailForm((p) => ({ ...p, value: e.target.value }))} placeholder="Dollar Value ($)" style={inputStyle} />
              <input value={detailForm.site_url} onChange={(e) => setDetailForm((p) => ({ ...p, site_url: e.target.value }))} placeholder="Site / URL" style={inputStyle} />
              <TagPicker
                label="Task Tags"
                options={taskTagOptions}
                selected={detailForm.task_tags}
                onChange={(next) => setDetailForm((p) => ({ ...p, task_tags: next }))}
                placeholder="Select task tags"
              />
              <TagPicker
                label="Niche Tags"
                options={nicheTagOptions}
                selected={detailForm.niche_tags}
                onChange={(next) => setDetailForm((p) => ({ ...p, niche_tags: next }))}
                placeholder="Select niche tags"
              />
              <input value={detailForm.niche} onChange={(e) => setDetailForm((p) => ({ ...p, niche: e.target.value }))} placeholder="Niche" style={inputStyle} />
              <input value={detailForm.reference_link} onChange={(e) => setDetailForm((p) => ({ ...p, reference_link: e.target.value }))} placeholder="Reference Link" style={inputStyle} />
              <input value={detailForm.contact_email} onChange={(e) => setDetailForm((p) => ({ ...p, contact_email: e.target.value }))} placeholder="Contact Email" style={inputStyle} />
              <input value={detailForm.custom_comments} onChange={(e) => setDetailForm((p) => ({ ...p, custom_comments: e.target.value }))} placeholder="Custom Comments" style={inputStyle} />
            </div>

            <textarea value={detailForm.description} onChange={(e) => setDetailForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" rows={4} style={{ ...inputStyle, marginTop: '8px', resize: 'vertical' }} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => setDetailOpen(false)} style={{ border: '1px solid rgba(88,66,55,0.35)', borderRadius: '8px', background: 'transparent', color: 'rgba(167,139,125,0.7)', padding: '8px 12px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveLeadDetail} style={{ border: 'none', borderRadius: '8px', background: '#f97316', color: '#fff', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>Save Lead</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
