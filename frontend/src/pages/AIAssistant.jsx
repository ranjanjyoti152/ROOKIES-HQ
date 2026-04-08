import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Plus,
  Send,
  Loader2,
  Trash2,
  Archive,
  ArchiveRestore,
  StopCircle,
} from 'lucide-react';
import api from '../api/client';
import useToastStore from '../store/toastStore';

function formatTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function parseToolPayload(payload) {
  if (!payload) return null;
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
  return payload;
}

function renderInline(text, keyPrefix = 'inline') {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const parts = String(text || '').split(pattern).filter(Boolean);
  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key} style={{ color: '#f3d5c7', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={key}
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '12px',
            background: 'rgba(88,66,55,0.32)',
            border: '1px solid rgba(88,66,55,0.35)',
            borderRadius: 6,
            padding: '1px 5px',
            color: '#ffd9c8',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const close = part.indexOf('](');
      const label = part.slice(1, close);
      const href = part.slice(close + 2, -1);
      return (
        <a key={key} href={href} target="_blank" rel="noreferrer" style={{ color: '#ffb690', textDecoration: 'underline' }}>
          {label}
        </a>
      );
    }

    return <span key={key}>{part}</span>;
  });
}

function isTableSeparator(line) {
  return /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(line || '');
}

function parseTableRow(line) {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function renderFormattedContent(content) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Code blocks
    if (trimmed.startsWith('```')) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      nodes.push(
        <pre
          key={`code-${i}`}
          style={{
            margin: '8px 0',
            background: 'rgba(16,12,10,0.72)',
            border: '1px solid rgba(88,66,55,0.35)',
            borderRadius: 10,
            padding: '10px 12px',
            overflowX: 'auto',
          }}
        >
          <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, color: '#f1ddd3' }}>
            {codeLines.join('\n')}
          </code>
        </pre>
      );
      continue;
    }

    // Tables
    if (line.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = parseTableRow(lines[i]);
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].includes('|')) {
        body.push(parseTableRow(lines[i]));
        i += 1;
      }

      nodes.push(
        <div key={`table-${i}`} style={{ margin: '8px 0', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 320 }}>
            <thead>
              <tr>
                {header.map((cell, idx) => (
                  <th
                    key={`th-${idx}`}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderBottom: '1px solid rgba(88,66,55,0.35)',
                      color: '#f3d5c7',
                      fontWeight: 700,
                    }}
                  >
                    {renderInline(cell, `th-${idx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ridx) => (
                <tr key={`tr-${ridx}`}>
                  {row.map((cell, cidx) => (
                    <td
                      key={`td-${ridx}-${cidx}`}
                      style={{
                        padding: '8px 10px',
                        borderBottom: '1px solid rgba(88,66,55,0.2)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {renderInline(cell, `td-${ridx}-${cidx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      nodes.push(
        <ul key={`ul-${i}`} style={{ margin: '6px 0 6px 18px', color: 'var(--text-secondary)', display: 'grid', gap: 4 }}>
          {items.map((item, idx) => (
            <li key={`li-${idx}`}>{renderInline(item, `li-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      nodes.push(
        <ol key={`ol-${i}`} style={{ margin: '6px 0 6px 18px', color: 'var(--text-secondary)', display: 'grid', gap: 4 }}>
          {items.map((item, idx) => (
            <li key={`oli-${idx}`}>{renderInline(item, `oli-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Headings
    if (/^#{1,3}\s+/.test(trimmed)) {
      const level = Math.min(3, trimmed.match(/^#+/)[0].length);
      const text = trimmed.replace(/^#{1,3}\s+/, '');
      const fontSize = level === 1 ? 18 : level === 2 ? 16 : 14;
      nodes.push(
        <div key={`h-${i}`} style={{ margin: '8px 0 4px', fontSize, fontWeight: 800, color: '#f3d5c7' }}>
          {renderInline(text, `h-${i}`)}
        </div>
      );
      i += 1;
      continue;
    }

    // Paragraph (merge consecutive non-structured lines)
    const para = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !(lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^#{1,3}\s+/.test(lines[i].trim())
    ) {
      para.push(lines[i]);
      i += 1;
    }

    nodes.push(
      <p key={`p-${i}`} style={{ margin: '6px 0', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
        {para.map((part, idx) => (
          <span key={`ps-${idx}`}>
            {renderInline(part, `ps-${idx}`)}
            {idx < para.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    );
  }

  return nodes;
}

function ChatRow({ chat, active, onOpen, onArchiveToggle, onDelete }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(chat.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen(chat.id);
      }}
      className="hover-lift"
      style={{
        padding: '10px 10px 10px 11px',
        borderRadius: 10,
        border: active ? '1px solid rgba(249,115,22,0.38)' : '1px solid rgba(88,66,55,0.22)',
        background: active ? 'rgba(249,115,22,0.1)' : 'rgba(36,30,28,0.52)',
        cursor: 'pointer',
        display: 'grid',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 12, color: active ? '#ffd7c2' : 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {chat.title}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatTime(chat.updated_at)}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onArchiveToggle(chat);
            }}
            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
            title={chat.is_archived ? 'Restore chat' : 'Archive chat'}
          >
            {chat.is_archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(chat.id);
            }}
            style={{ border: 'none', background: 'transparent', color: 'rgba(248,113,113,0.85)', cursor: 'pointer', padding: 2 }}
            title="Delete chat"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const payload = parseToolPayload(message.tool_payload);
  const visual = payload?.visual || null;

  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', alignItems: 'flex-start' }}>
      <div
        className="micro-pop"
        style={{
          maxWidth: 'min(820px, 92%)',
          borderRadius: 14,
          border: isUser ? '1px solid rgba(249,115,22,0.45)' : '1px solid rgba(88,66,55,0.28)',
          background: isUser ? 'linear-gradient(180deg, rgba(249,115,22,0.16), rgba(56,28,16,0.62))' : 'rgba(36,30,28,0.66)',
          padding: '10px 12px',
          boxShadow: isUser ? '0 8px 22px rgba(249,115,22,0.16)' : 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: isUser ? '#ffbb9a' : 'var(--text-muted)', fontWeight: 700 }}>
            {isUser ? 'You' : 'Assistant'}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(167,139,125,0.75)' }}>{formatTime(message.created_at)}</span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.62, whiteSpace: 'pre-wrap' }}>
          {message.content ? renderFormattedContent(message.content) : (message.is_streaming ? 'Thinking...' : '')}
          {message.is_streaming && (
            <span style={{ marginLeft: 6, display: 'inline-flex', verticalAlign: 'middle' }}>
              <Loader2 size={12} className="animate-spin" color="#f97316" />
            </span>
          )}
        </div>
        {visual && (
          <div className="card" style={{ marginTop: 8, padding: 10, fontSize: 11, color: 'var(--text-muted)' }}>
            A visual response is ready.
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIAssistant() {
  const { pushToast } = useToastStore();
  const [chats, setChats] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('openai');

  const abortRef = useRef(null);
  const listRef = useRef(null);

  const fetchChats = useCallback(async (archived) => {
    try {
      setLoadingChats(true);
      const res = await api.get('/ai/chats', { params: { archived } });
      const rows = res.data || [];
      setChats(rows);
      setActiveChatId((prev) => {
        if (!prev && rows.length) return rows[0].id;
        if (prev && !rows.some((chat) => chat.id === prev)) return rows[0]?.id || null;
        return prev;
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Unable to load chats',
        message: err.response?.data?.detail || 'Could not fetch your assistant chats.',
      });
    } finally {
      setLoadingChats(false);
    }
  }, [pushToast]);

  const loadMessages = useCallback(async (chatId) => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    try {
      setLoadingMessages(true);
      const res = await api.get(`/ai/chats/${chatId}/messages`);
      setMessages(
        (res.data || []).map((msg) => ({
          ...msg,
          tool_payload: parseToolPayload(msg.tool_payload),
        }))
      );
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Unable to load messages',
        message: err.response?.data?.detail || 'Could not fetch chat messages.',
      });
    } finally {
      setLoadingMessages(false);
    }
  }, [pushToast]);

  const fetchProviders = useCallback(async () => {
    try {
      const res = await api.get('/ai/providers/public');
      const rows = res.data?.providers || [];

      const defaultProvider = res.data?.default_provider || 'openai';
      const preferred = rows.find((p) => p.provider === defaultProvider && p.enabled);
      const firstEnabled = rows.find((p) => p.enabled);
      setSelectedProvider(preferred?.provider || firstEnabled?.provider || defaultProvider);
    } catch {
      setSelectedProvider('openai');
    }
  }, []);

  useEffect(() => {
    fetchChats(showArchived);
    fetchProviders();
  }, [fetchChats, fetchProviders, showArchived]);

  useEffect(() => {
    loadMessages(activeChatId);
  }, [activeChatId, loadMessages]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  const createChat = async () => {
    try {
      const res = await api.post('/ai/chats', { title: 'New Chat' });
      setChats((prev) => [res.data, ...prev]);
      setActiveChatId(res.data.id);
      setMessages([]);
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Could not create chat',
        message: err.response?.data?.detail || 'Please try again.',
      });
    }
  };

  const toggleArchiveChat = async (chat) => {
    try {
      await api.patch(`/ai/chats/${chat.id}`, { is_archived: !chat.is_archived });
      await fetchChats(showArchived);
      if (chat.id === activeChatId) {
        setMessages([]);
      }
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Archive action failed',
        message: err.response?.data?.detail || 'Could not update chat archive status.',
      });
    }
  };

  const deleteChat = async (chatId) => {
    try {
      await api.delete(`/ai/chats/${chatId}`);
      const next = chats.filter((c) => c.id !== chatId);
      setChats(next);
      if (activeChatId === chatId) {
        setActiveChatId(next[0]?.id || null);
        setMessages([]);
      }
      pushToast({ type: 'success', title: 'Chat deleted', message: 'The conversation was removed.' });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Delete failed',
        message: err.response?.data?.detail || 'Could not delete this chat.',
      });
    }
  };

  const stopStreaming = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setSending(false);
      setMessages((prev) => prev.map((m) => (m.is_streaming ? { ...m, is_streaming: false, content: m.content || 'Response stopped.' } : m)));
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (sending) return;

    const content = prompt.trim();
    if (!content) return;

    const tempUserId = `user-${Date.now()}`;
    const tempAssistantId = `assistant-${Date.now()}`;
    const nowIso = new Date().toISOString();

    setPrompt('');
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: 'user', content, created_at: nowIso },
      { id: tempAssistantId, role: 'assistant', content: '', created_at: nowIso, is_streaming: true, tool_payload: null },
    ]);

    setSending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let streamChatId = activeChatId;
    let hadError = false;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/ai/assistant/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          chat_id: streamChatId || undefined,
          message: content,
          provider: selectedProvider || undefined,
          tools_enabled: true,
          memory_enabled: true,
          request_visual: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const errText = await response.text();
        throw new Error(errText || 'Assistant request failed.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const handleEventBlock = (block) => {
        const lines = block.split('\n');
        let eventName = 'message';
        const dataLines = [];

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }

        let payload = {};
        if (dataLines.length) {
          try {
            payload = JSON.parse(dataLines.join('\n'));
          } catch {
            payload = {};
          }
        }

        if (eventName === 'meta') {
          if (payload.chat_id) {
            streamChatId = payload.chat_id;
            setActiveChatId(payload.chat_id);
          }
          return;
        }

        if (eventName === 'delta') {
          const tokenText = payload.text || '';
          if (!tokenText) return;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAssistantId
                ? { ...msg, content: `${msg.content || ''}${tokenText}` }
                : msg
            )
          );
          return;
        }

        if (eventName === 'visual') {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === tempAssistantId
                ? { ...msg, tool_payload: { ...(msg.tool_payload || {}), visual: payload } }
                : msg
            )
          );
          return;
        }

        if (eventName === 'error') {
          hadError = true;
          throw new Error(payload.message || 'Unknown assistant stream error.');
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let splitIndex = buffer.indexOf('\n\n');
        while (splitIndex !== -1) {
          const block = buffer.slice(0, splitIndex).trim();
          buffer = buffer.slice(splitIndex + 2);
          if (block) handleEventBlock(block);
          splitIndex = buffer.indexOf('\n\n');
        }
      }

      if (buffer.trim()) {
        handleEventBlock(buffer.trim());
      }

      setMessages((prev) => prev.map((m) => (m.id === tempAssistantId ? { ...m, is_streaming: false } : m)));
      await fetchChats(showArchived);
      if (streamChatId && streamChatId !== activeChatId) {
        await loadMessages(streamChatId);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === tempAssistantId
              ? {
                  ...msg,
                  is_streaming: false,
                  content: msg.content || 'I hit an error while generating a response.',
                }
              : msg
          )
        );
        pushToast({
          type: 'error',
          title: hadError ? 'Provider error' : 'Assistant request failed',
          message: err.message || 'Unable to generate response.',
        });
      }
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  };

  return (
    <div className="animate-in" style={{ height: 'calc(100vh - 118px)', minHeight: 540 }}>
      <div className="ai-grid-root">
        <aside className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>Chats</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{showArchived ? 'Archived' : 'Active'} conversations</div>
            </div>
            <button type="button" className="btn-primary" style={{ padding: '7px 10px' }} onClick={createChat}>
              <Plus size={13} /> New
            </button>
          </div>

          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShowArchived((prev) => !prev)}
            style={{
              justifyContent: 'center',
              border: '1px solid rgba(88,66,55,0.25)',
              borderRadius: 9,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: showArchived ? '#ffb690' : 'var(--text-muted)',
              background: showArchived ? 'rgba(249,115,22,0.12)' : 'transparent',
            }}
          >
            {showArchived ? <ArchiveRestore size={12} /> : <Archive size={12} />}
            {showArchived ? 'Show Active' : 'Show Archived'}
          </button>

          <div style={{ display: 'grid', gap: 8, overflowY: 'auto', paddingRight: 2 }}>
            {loadingChats ? (
              Array(4).fill(0).map((_, idx) => <div key={idx} className="skeleton" style={{ height: 74, borderRadius: 10 }} />)
            ) : chats.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '18px 10px', fontSize: 12 }}>
                No chats yet.
              </div>
            ) : (
              chats.map((chat) => (
                <ChatRow
                  key={chat.id}
                  chat={chat}
                  active={chat.id === activeChatId}
                  onOpen={setActiveChatId}
                  onArchiveToggle={toggleArchiveChat}
                  onDelete={deleteChat}
                />
              ))
            )}
          </div>
        </aside>

        <section className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ borderBottom: '1px solid rgba(88,66,55,0.24)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(249,115,22,0.14)', border: '1px solid rgba(249,115,22,0.32)', display: 'grid', placeItems: 'center' }}>
                <Bot size={16} color="#f97316" />
              </div>
              <div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 800 }}>AI Assistant</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ask anything about your workspace data.</div>
              </div>
            </div>
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'grid', gap: 10 }}>
            {loadingMessages ? (
              Array(4).fill(0).map((_, idx) => <div key={idx} className="skeleton" style={{ height: idx % 2 ? 82 : 64, borderRadius: 12 }} />)
            ) : messages.length === 0 ? (
              <div className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Bot size={15} color="#f97316" />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Start a conversation</span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Ask for summaries, insights, recommendations, or status updates.
                </p>
              </div>
            ) : (
              messages.map((message) => <MessageBubble key={message.id} message={message} />)
            )}
          </div>

          <form onSubmit={sendMessage} style={{ borderTop: '1px solid rgba(88,66,55,0.24)', padding: 12, display: 'grid', gap: 8 }}>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask anything about tasks, leads, delivery, or team performance..."
              rows={3}
              style={{
                width: '100%',
                resize: 'vertical',
                minHeight: 78,
                maxHeight: 190,
                background: 'rgba(36,30,28,0.7)',
                border: '1px solid rgba(88,66,55,0.35)',
                color: 'var(--text-primary)',
                borderRadius: 10,
                padding: '10px 12px',
                fontFamily: 'inherit',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Assistant ready</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {sending && (
                  <button type="button" className="btn-outline" onClick={stopStreaming} style={{ padding: '8px 10px' }}>
                    <StopCircle size={13} /> Stop
                  </button>
                )}
                <button type="submit" className="btn-primary" disabled={sending || !prompt.trim()} style={{ padding: '8px 10px' }}>
                  {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>

      <style>{`
        .ai-grid-root {
          height: 100%;
          display: grid;
          grid-template-columns: 280px minmax(0, 1fr);
          gap: 12px;
        }
        @media (max-width: 980px) {
          .ai-grid-root {
            grid-template-columns: 1fr;
            height: auto;
          }
          .ai-grid-root > .card {
            min-height: 260px;
          }
        }
      `}</style>
    </div>
  );
}
