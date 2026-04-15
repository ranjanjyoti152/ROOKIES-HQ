import { useEffect, useMemo, useState } from 'react';
import api from '../api/client';
import { PlayCircle, Download, MessageSquare, CheckCircle2, X } from 'lucide-react';

const card = {
  background: 'rgba(32, 26, 24, 0.55)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(88,66,55,0.2)',
  borderRadius: '10px',
};

const statusColors = {
  pending_review: { bg: 'rgba(234,179,8,0.14)', color: '#eab308' },
  awaiting_feedback: { bg: 'rgba(168,85,247,0.14)', color: '#a855f7' },
  approved: { bg: 'rgba(34,197,94,0.14)', color: '#22c55e' },
  revisions_needed: { bg: 'rgba(249,115,22,0.14)', color: '#f97316' },
  delivered: { bg: 'rgba(34,197,94,0.14)', color: '#22c55e' },
  revision: { bg: 'rgba(249,115,22,0.14)', color: '#f97316' },
  closed: { bg: 'rgba(20,184,166,0.14)', color: '#14b8a6' },
};

function formatTimecode(ms) {
  if (!ms && ms !== 0) return null;
  const totalSeconds = Math.floor(ms / 1000);
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}:00`;
}

export default function ClientPortal() {
  const [dashboard, setDashboard] = useState(null);
  const [queue, setQueue] = useState([]);
  const [mentions, setMentions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [reviewState, setReviewState] = useState({
    open: false,
    taskId: null,
    detail: null,
    comment: '',
    secondMark: '',
    selectedMentions: [],
    posting: false,
  });

  const load = async () => {
    try {
      const [dashRes, queueRes, mentionsRes] = await Promise.all([
        api.get('/client-portal/dashboard'),
        api.get('/client-portal/review-queue'),
        api.get('/users/mentions').catch(() => ({ data: [] })),
      ]);
      setDashboard(dashRes.data);
      setQueue(queueRes.data || []);
      setMentions(mentionsRes.data || []);
      setError('');
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to load client portal data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => { if (!cancelled) await load(); };
    run();
    const t = setInterval(run, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  const openReview = async (taskId) => {
    try {
      const detailRes = await api.get(`/client-portal/videos/${taskId}`);
      setReviewState({
        open: true,
        taskId,
        detail: detailRes.data,
        comment: '',
        secondMark: '',
        selectedMentions: [],
        posting: false,
      });
    } catch (e) {
      setError(e.response?.data?.detail || 'Unable to load review details.');
    }
  };

  const closeReview = () => {
    setReviewState({
      open: false,
      taskId: null,
      detail: null,
      comment: '',
      secondMark: '',
      selectedMentions: [],
      posting: false,
    });
  };

  const postComment = async () => {
    if (!reviewState.comment.trim() || !reviewState.taskId) return;
    setReviewState((prev) => ({ ...prev, posting: true }));
    try {
      const timestamp = reviewState.secondMark ? Number(reviewState.secondMark) * 1000 : null;
      await api.post(`/tasks/${reviewState.taskId}/comments`, {
        content: reviewState.comment.trim(),
        mentions: reviewState.selectedMentions,
        video_timestamp_ms: Number.isFinite(timestamp) ? timestamp : null,
      });
      const detailRes = await api.get(`/client-portal/videos/${reviewState.taskId}`);
      setReviewState((prev) => ({
        ...prev,
        detail: detailRes.data,
        comment: '',
        secondMark: '',
        selectedMentions: [],
        posting: false,
      }));
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to post comment.');
      setReviewState((prev) => ({ ...prev, posting: false }));
    }
  };

  const resolveComment = async (commentId) => {
    if (!reviewState.taskId) return;
    try {
      await api.post(`/tasks/${reviewState.taskId}/comments/${commentId}/resolve`);
      const detailRes = await api.get(`/client-portal/videos/${reviewState.taskId}`);
      setReviewState((prev) => ({ ...prev, detail: detailRes.data }));
      await load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to resolve comment.');
    }
  };

  const selectedMentionSet = useMemo(() => new Set(reviewState.selectedMentions), [reviewState.selectedMentions]);

  return (
    <div style={{ animation: 'fadeIn 0.25s ease-out' }}>
      {error && (
        <div style={{ ...card, padding: '12px 14px', marginBottom: '12px', fontSize: '12px', color: '#f87171' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ece0dc' }}>Client Portal</h1>
        <p style={{ fontSize: '13px', color: 'rgba(88,66,55,0.6)', marginTop: '4px' }}>
          Review deliverables, leave timestamped feedback, and track revisions.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '18px' }}>
        <div style={{ ...card, padding: '16px' }}>
          <div style={{ fontSize: '10px', color: 'rgba(167,139,125,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Videos</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#ece0dc', marginTop: '8px' }}>{dashboard?.analytics?.video_count ?? 0}</div>
        </div>
        <div style={{ ...card, padding: '16px' }}>
          <div style={{ fontSize: '10px', color: 'rgba(167,139,125,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pending Revisions</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#f97316', marginTop: '8px' }}>{dashboard?.analytics?.pending_revisions ?? 0}</div>
        </div>
        <div style={{ ...card, padding: '16px' }}>
          <div style={{ fontSize: '10px', color: 'rgba(167,139,125,0.6)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Completion</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#22c55e', marginTop: '8px' }}>{dashboard?.analytics?.completion_rate ?? 0}%</div>
        </div>
      </div>

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(88,66,55,0.18)', fontSize: '12px', color: '#f2ddd3', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Revised Videos / Content Library
        </div>

        {loading ? (
          <div style={{ padding: '24px 16px', fontSize: '12px', color: 'rgba(167,139,125,0.7)' }}>Loading review queue...</div>
        ) : queue.length === 0 ? (
          <div style={{ padding: '32px 16px', fontSize: '12px', color: 'rgba(167,139,125,0.65)' }}>No videos in review queue.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '10px', padding: '12px' }}>
            {queue.map((item) => {
              const st = statusColors[item.status] || statusColors.pending_review;
              return (
                <div key={item.task_id} style={{ border: '1px solid rgba(88,66,55,0.22)', borderRadius: '10px', padding: '12px', background: 'rgba(23,17,15,0.7)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#ede2dd' }}>{item.video_title}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(167,139,125,0.58)', marginTop: '2px' }}>{item.project_name || 'Unknown Project'}</div>
                    </div>
                    <span style={{ alignSelf: 'flex-start', padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 700, background: st.bg, color: st.color, textTransform: 'uppercase' }}>
                      {String(item.status).replace('_', ' ')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', fontSize: '11px', color: 'rgba(167,139,125,0.6)' }}>
                    <span>{item.upload_date ? new Date(item.upload_date).toLocaleDateString() : '—'}</span>
                    <span>{item.comments_count} comments</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => openReview(item.task_id)} style={{ flex: 1, border: 'none', borderRadius: '8px', background: '#f97316', color: 'white', padding: '8px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                      <PlayCircle size={14} /> + Review
                    </button>
                    <a href={item.download_url || '#'} target="_blank" rel="noreferrer" style={{ border: '1px solid rgba(88,66,55,0.34)', borderRadius: '8px', color: '#e5d5ce', padding: '8px 10px', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Download size={14} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {reviewState.open && (
        <div className="ui-overlay" style={{ zIndex: 1200, padding: '20px' }} onClick={closeReview}>
          <div className="ui-subwindow" style={{ ...card, width: 'min(1200px, 100%)', height: 'min(90vh, 820px)', display: 'grid', gridTemplateColumns: '2fr 1fr', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: '#0f0b0a', borderRight: '1px solid rgba(88,66,55,0.25)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(88,66,55,0.22)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#efe4de' }}>{reviewState.detail?.task?.title}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(167,139,125,0.6)' }}>{reviewState.detail?.task?.project_name}</div>
                </div>
                <button onClick={closeReview} style={{ border: 'none', background: 'transparent', color: 'rgba(167,139,125,0.8)', cursor: 'pointer' }}><X size={16} /></button>
              </div>

              <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '16px' }}>
                {reviewState.detail?.task?.video_url ? (
                  <iframe
                    title="review-video"
                    src={reviewState.detail.task.video_url}
                    style={{ width: '100%', height: '100%', border: '1px solid rgba(88,66,55,0.25)', borderRadius: '10px', background: '#0a0a0a' }}
                    allow="autoplay; fullscreen"
                  />
                ) : (
                  <div style={{ color: 'rgba(167,139,125,0.62)', fontSize: '13px' }}>No video URL attached.</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(88,66,55,0.22)', fontSize: '12px', color: '#f3e5de', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Comments
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(reviewState.detail?.comments || []).length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'rgba(167,139,125,0.65)' }}>No comments yet.</div>
                ) : (reviewState.detail?.comments || []).map((c) => (
                  <div key={c.id} style={{ border: '1px solid rgba(88,66,55,0.2)', borderRadius: '8px', padding: '9px 10px', background: 'rgba(20,15,13,0.7)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#e8d7d0' }}>{c.name}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(167,139,125,0.6)' }}>{new Date(c.created_at).toLocaleDateString()}</div>
                    </div>
                    {c.video_timestamp_ms !== null && c.video_timestamp_ms !== undefined && (
                      <div style={{ marginBottom: '4px', fontSize: '11px', fontWeight: 700, color: '#eab308' }}>{formatTimecode(c.video_timestamp_ms)}</div>
                    )}
                    <div style={{ fontSize: '12px', color: '#ddc7bd', lineHeight: 1.45 }}>{c.content}</div>

                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        onClick={() => resolveComment(c.id)}
                        disabled={c.is_resolved}
                        style={{ border: 'none', background: 'transparent', cursor: c.is_resolved ? 'default' : 'pointer', fontSize: '11px', color: c.is_resolved ? '#22c55e' : 'rgba(167,139,125,0.72)', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <CheckCircle2 size={12} /> {c.is_resolved ? 'Resolved' : 'Mark Resolved'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid rgba(88,66,55,0.22)', padding: '10px 12px', display: 'grid', gap: '8px' }}>
                <textarea
                  value={reviewState.comment}
                  onChange={(e) => setReviewState((prev) => ({ ...prev, comment: e.target.value }))}
                  placeholder="Leave your comment..."
                  rows={3}
                  style={{ width: '100%', border: '1px solid rgba(88,66,55,0.34)', background: '#2f2926', color: '#efe0d8', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', resize: 'vertical', outline: 'none' }}
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Video second"
                    value={reviewState.secondMark}
                    onChange={(e) => setReviewState((prev) => ({ ...prev, secondMark: e.target.value }))}
                    style={{ flex: 1, border: '1px solid rgba(88,66,55,0.34)', background: '#2f2926', color: '#efe0d8', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', outline: 'none' }}
                  />
                  <button onClick={postComment} disabled={reviewState.posting} style={{ border: 'none', borderRadius: '8px', background: '#f97316', color: 'white', padding: '8px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    {reviewState.posting ? 'Posting...' : 'Post'}
                  </button>
                </div>

                <div>
                  <div style={{ fontSize: '10px', color: 'rgba(167,139,125,0.6)', marginBottom: '6px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    @ Mentions
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {mentions.map((u) => {
                      const selected = selectedMentionSet.has(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setReviewState((prev) => {
                              const has = prev.selectedMentions.includes(u.id);
                              return {
                                ...prev,
                                selectedMentions: has
                                  ? prev.selectedMentions.filter((id) => id !== u.id)
                                  : [...prev.selectedMentions, u.id],
                              };
                            });
                          }}
                          style={{
                            border: '1px solid',
                            borderColor: selected ? '#f97316' : 'rgba(88,66,55,0.35)',
                            background: selected ? 'rgba(249,115,22,0.16)' : 'transparent',
                            color: selected ? '#ffb690' : 'rgba(167,139,125,0.72)',
                            borderRadius: '20px',
                            padding: '4px 9px',
                            fontSize: '11px',
                            cursor: 'pointer',
                          }}
                        >
                          @{u.display_name}
                        </button>
                      );
                    })}
                    {mentions.length === 0 && <span style={{ fontSize: '11px', color: 'rgba(167,139,125,0.6)' }}>No mentionable users found.</span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }`}</style>
    </div>
  );
}
