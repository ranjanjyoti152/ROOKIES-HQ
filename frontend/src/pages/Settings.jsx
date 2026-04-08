import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Cpu,
  KeyRound,
  Save,
  RotateCcw,
  ShieldCheck,
  Eye,
  EyeOff,
  Star,
  ToggleLeft,
  ToggleRight,
  Globe,
  Bot,
  Link2,
  RefreshCw,
} from 'lucide-react';
import api from '../api/client';
import useAuthStore from '../store/authStore';
import useToastStore from '../store/toastStore';

const PROVIDER_META = {
  openai: {
    label: 'OpenAI',
    icon: Bot,
    accent: '#22d3ee',
    hint: 'Best for broad reasoning and quality assistant responses.',
  },
  openrouter: {
    label: 'OpenRouter',
    icon: Link2,
    accent: '#f97316',
    hint: 'Access multiple hosted models through one API gateway.',
  },
  gemini: {
    label: 'Gemini',
    icon: Cpu,
    accent: '#a855f7',
    hint: 'Fast multimodal responses and useful long-context behavior.',
  },
  ollama: {
    label: 'Ollama',
    icon: ShieldCheck,
    accent: '#22c55e',
    hint: 'Self-hosted local models for private on-prem workloads.',
  },
};

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="hover-lift"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        border: '1px solid rgba(88,66,55,0.35)',
        background: checked ? 'rgba(249,115,22,0.12)' : 'rgba(36,30,28,0.65)',
        color: checked ? '#ffb690' : 'rgba(236,224,220,0.72)',
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {checked ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
      {label}
    </button>
  );
}

export default function Settings() {
  const { user } = useAuthStore();
  const { pushToast } = useToastStore();

  const [providers, setProviders] = useState([]);
  const [forms, setForms] = useState({});
  const [showKeyByProvider, setShowKeyByProvider] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingByProvider, setSavingByProvider] = useState({});
  const [modelOptionsByProvider, setModelOptionsByProvider] = useState({});
  const [modelStatusByProvider, setModelStatusByProvider] = useState({});
  const [modelInfoByProvider, setModelInfoByProvider] = useState({});
  const signatureRef = useRef({});

  const isSuperadmin = !!user?.is_superadmin;

  const enabledCount = useMemo(
    () => providers.filter((p) => p.enabled).length,
    [providers]
  );

  const defaultProvider = useMemo(
    () => providers.find((p) => p.is_default)?.provider || 'none',
    [providers]
  );

  const hydrateForms = (rows) => {
    const nextForms = {};
    for (const row of rows) {
      nextForms[row.provider] = {
        enabled: !!row.enabled,
        is_default: !!row.is_default,
        base_url: row.base_url || '',
        model: row.model || '',
        api_key: '',
        extra_config: row.extra_config || null,
      };
    }
    setForms(nextForms);
  };

  const fetchModelsForProvider = async (provider, overrides = {}) => {
    const existingForm = forms[provider] || {};
    const resolvedBaseUrl = (overrides.base_url ?? existingForm.base_url ?? '').trim();
    const resolvedApiKey = (overrides.api_key ?? existingForm.api_key ?? '').trim();

    setModelStatusByProvider((prev) => ({ ...prev, [provider]: 'loading' }));
    try {
      const params = {};
      if (resolvedBaseUrl) params.base_url = resolvedBaseUrl;
      if (resolvedApiKey) params.api_key = resolvedApiKey;

      const res = await api.get(`/ai/providers/${provider}/models`, { params });
      const models = Array.isArray(res.data?.models) ? res.data.models : [];
      const infoMessage = res.data?.message || (models.length ? `${models.length} models found.` : 'No models found.');

      setModelOptionsByProvider((prev) => ({ ...prev, [provider]: models }));
      setModelStatusByProvider((prev) => ({ ...prev, [provider]: 'ready' }));
      setModelInfoByProvider((prev) => ({ ...prev, [provider]: infoMessage }));

      setForms((prev) => {
        const current = prev[provider];
        if (!current) return prev;
        if (!models.length) return prev;

        const currentModel = current.model || '';
        const suggestedModel = models.includes(res.data?.current_model) ? res.data.current_model : models[0];
        const nextModel = !currentModel || !models.includes(currentModel) ? suggestedModel : currentModel;
        if (nextModel === currentModel) return prev;

        return {
          ...prev,
          [provider]: {
            ...current,
            model: nextModel,
          },
        };
      });
    } catch (err) {
      setModelStatusByProvider((prev) => ({ ...prev, [provider]: 'error' }));
      setModelInfoByProvider((prev) => ({
        ...prev,
        [provider]: err.response?.data?.detail || 'Could not fetch models.',
      }));
      setModelOptionsByProvider((prev) => ({ ...prev, [provider]: [] }));
    }
  };

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/ai/providers');
      setProviders(res.data || []);
      hydrateForms(res.data || []);
      for (const row of (res.data || [])) {
        fetchModelsForProvider(row.provider, { base_url: row.base_url || '' });
      }
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Failed to load settings',
        message: err.response?.data?.detail || 'Unable to fetch provider settings.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperadmin) {
      fetchProviders();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperadmin]);

  useEffect(() => {
    if (!isSuperadmin) return;
    const timers = [];

    for (const providerRow of providers) {
      const provider = providerRow.provider;
      const form = forms[provider];
      if (!form) continue;

      const signature = JSON.stringify({
        base_url: form.base_url || '',
        api_key: form.api_key || '',
        enabled: !!form.enabled,
      });

      if (signatureRef.current[provider] === signature) continue;
      signatureRef.current[provider] = signature;

      const timeout = setTimeout(() => {
        fetchModelsForProvider(provider);
      }, 550);
      timers.push(timeout);
    }

    return () => timers.forEach((timer) => clearTimeout(timer));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forms, providers, isSuperadmin]);

  const updateForm = (provider, key, value) => {
    setForms((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [key]: value,
      },
    }));
  };

  const markDefault = (provider) => {
    setForms((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = {
          ...next[key],
          is_default: key === provider,
          enabled: key === provider ? true : next[key].enabled,
        };
      }
      return next;
    });
  };

  const resetProvider = (provider) => {
    const original = providers.find((p) => p.provider === provider);
    if (!original) return;

    setForms((prev) => ({
      ...prev,
      [provider]: {
        enabled: !!original.enabled,
        is_default: !!original.is_default,
        base_url: original.base_url || '',
        model: original.model || '',
        api_key: '',
        extra_config: original.extra_config || null,
      },
    }));

    pushToast({
      type: 'info',
      title: `${PROVIDER_META[provider]?.label || provider} reset`,
      message: 'Unsaved changes were reverted for this provider.',
    });
  };

  const saveProvider = async (provider) => {
    const formState = forms[provider];
    if (!formState) return;

    const payload = {
      enabled: !!formState.enabled,
      is_default: !!formState.is_default,
      base_url: formState.base_url,
      model: formState.model,
      extra_config: formState.extra_config,
    };

    // Important: do not send empty api_key on model/base-url updates,
    // otherwise backend interprets it as "clear existing key".
    const typedKey = (formState.api_key || '').trim();
    if (typedKey) {
      payload.api_key = typedKey;
    }

    setSavingByProvider((prev) => ({ ...prev, [provider]: true }));
    try {
      const res = await api.put(`/ai/providers/${provider}`, payload);
      const updated = res.data;

      setProviders((prev) => prev.map((p) => (p.provider === provider ? updated : p)));

      setForms((prev) => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          api_key: '',
        },
      }));

      if (updated.is_default) {
        setProviders((prev) => prev.map((p) => ({ ...p, is_default: p.provider === provider })));
      }

      fetchModelsForProvider(provider, { base_url: updated.base_url || '' });

      pushToast({
        type: 'success',
        title: `${PROVIDER_META[provider]?.label || provider} saved`,
        message: 'Provider configuration updated successfully.',
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Save failed',
        message: err.response?.data?.detail || 'Could not save provider settings.',
      });
    } finally {
      setSavingByProvider((prev) => ({ ...prev, [provider]: false }));
    }
  };

  if (!isSuperadmin) {
    return (
      <div className="card" style={{ padding: 28, textAlign: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-primary)' }}>Superadmin Access Required</h2>
        <p style={{ marginTop: 8, color: 'var(--text-muted)' }}>
          Only superadmins can configure AI provider and API key settings.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-in" style={{ maxWidth: 1320, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 20 }}>
      <div className="card" style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            AI Settings
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Configure OpenAI, OpenRouter, Gemini, and Ollama for the AI assistant runtime.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className="badge badge-orange">Enabled: {enabledCount}</span>
          <span className="badge badge-blue">Default: {defaultProvider}</span>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 14 }}>
          {Array(4).fill(0).map((_, idx) => (
            <div key={idx} className="skeleton" style={{ height: 270, borderRadius: 14 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
          {providers.map((providerRow) => {
            const provider = providerRow.provider;
            const meta = PROVIDER_META[provider] || { label: provider, icon: Cpu, accent: '#f97316', hint: '' };
            const Icon = meta.icon;
            const form = forms[provider] || {};
            const showKey = !!showKeyByProvider[provider];

            return (
              <div key={provider} className="card hover-lift micro-pop" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: `${meta.accent}20`,
                        border: `1px solid ${meta.accent}40`,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <Icon size={17} color={meta.accent} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>{meta.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{meta.hint}</div>
                    </div>
                  </div>
                  {providerRow.is_default && (
                    <span className="badge badge-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Star size={10} /> Default
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Toggle
                    checked={!!form.enabled}
                    onChange={(next) => updateForm(provider, 'enabled', next)}
                    label={form.enabled ? 'Enabled' : 'Disabled'}
                  />
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => markDefault(provider)}
                    style={{
                      padding: '6px 10px',
                      border: `1px solid ${form.is_default ? 'rgba(34,197,94,0.32)' : 'rgba(88,66,55,0.35)'}`,
                      color: form.is_default ? '#4ade80' : 'var(--text-muted)',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    <Star size={12} /> Set Default
                  </button>
                </div>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="section-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Globe size={11} /> Base URL
                  </span>
                  <input
                    className="input"
                    value={form.base_url || ''}
                    onChange={(e) => updateForm(provider, 'base_url', e.target.value)}
                    placeholder="https://..."
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="section-label" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Cpu size={11} /> Model
                    </span>
                    <button
                      type="button"
                      onClick={() => fetchModelsForProvider(provider)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: 0,
                      }}
                      title="Refresh models"
                    >
                      <RefreshCw size={11} />
                      Refresh
                    </button>
                  </span>

                  {(modelOptionsByProvider[provider] || []).length > 0 ? (
                    <select
                      className="input"
                      value={form.model || ''}
                      onChange={(e) => updateForm(provider, 'model', e.target.value)}
                    >
                      {(modelOptionsByProvider[provider] || []).map((modelName) => (
                        <option key={modelName} value={modelName}>{modelName}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      value={form.model || ''}
                      onChange={(e) => updateForm(provider, 'model', e.target.value)}
                      placeholder="Models will load automatically"
                    />
                  )}

                  <span
                    style={{
                      fontSize: 11,
                      color: modelStatusByProvider[provider] === 'error' ? 'rgba(248,113,113,0.92)' : 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {modelStatusByProvider[provider] === 'loading' ? (
                      <>
                        <RefreshCw size={11} className="animate-spin" />
                        Fetching model list...
                      </>
                    ) : (
                      modelInfoByProvider[provider] || 'Model list will auto-refresh when API key or URL changes.'
                    )}
                  </span>
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="section-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <KeyRound size={11} /> API Key
                  </span>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      type={showKey ? 'text' : 'password'}
                      value={form.api_key || ''}
                      onChange={(e) => updateForm(provider, 'api_key', e.target.value)}
                      placeholder={providerRow.has_api_key ? `Stored: ${providerRow.api_key_masked || 'configured'}` : 'Paste API key'}
                      style={{ paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeyByProvider((prev) => ({ ...prev, [provider]: !prev[provider] }))}
                      style={{
                        position: 'absolute',
                        right: 9,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 3,
                      }}
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {providerRow.has_api_key && (
                    <span style={{ fontSize: 11, color: 'rgba(74,222,128,0.8)' }}>
                      Existing key is stored securely.
                    </span>
                  )}
                </label>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={() => resetProvider(provider)}
                    style={{ padding: '8px 12px' }}
                  >
                    <RotateCcw size={13} /> Reset
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => saveProvider(provider)}
                    disabled={!!savingByProvider[provider]}
                    style={{ padding: '8px 12px' }}
                  >
                    <Save size={13} /> {savingByProvider[provider] ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
