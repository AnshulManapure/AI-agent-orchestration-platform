import { useState, useEffect } from 'react'
import { getAgents, createAgent, updateAgent, deleteAgent } from '../api/client'

const CHANNELS = ['', 'telegram']
const TOOLS = ['web_search', 'calculator', 'code_executor']

function Badge({ children, color = 'var(--text-muted)' }) {
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '9px',
      fontWeight: 700,
      letterSpacing: '1.5px',
      padding: '3px 8px',
      border: `1px solid ${color}`,
      color,
      borderRadius: '2px',
      textTransform: 'uppercase',
    }}>
      {children}
    </span>
  )
}

function AgentCard({ agent, onEdit, onDelete }) {
  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      transition: 'border-color 0.15s',
      position: 'relative',
      overflow: 'hidden',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: '3px', height: '100%',
        background: agent.channel === 'telegram' ? 'var(--blue)' : 'var(--accent)',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>{agent.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
            {agent.role.toUpperCase()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {agent.channel && <Badge color="var(--blue)">{agent.channel}</Badge>}
          {agent.memory_enabled && <Badge color="var(--orange)">memory</Badge>}
          <Badge>{agent.model.replace('gemini-', 'G-')}</Badge>
        </div>
      </div>

      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: 'var(--text-muted)',
        lineHeight: '1.6',
        borderLeft: '2px solid var(--border)',
        paddingLeft: '12px',
        maxHeight: '60px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {agent.system_prompt}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
        <button onClick={() => onEdit(agent)} style={{
          flex: 1,
          padding: '8px',
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: '10px',
          letterSpacing: '1px',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-muted)' }}
        >
          EDIT
        </button>
        <button onClick={() => onDelete(agent.id)} style={{
          flex: 1,
          padding: '8px',
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: '10px',
          letterSpacing: '1px',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.color = 'var(--red)' }}
          onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-muted)' }}
        >
          DELETE
        </button>
      </div>
    </div>
  )
}

const EMPTY_FORM = {
  name: '', role: '', system_prompt: '',
  model: 'gemini-2.5-flash', tools: [],
  channel: '', memory_enabled: false,
}

function AgentModal({ agent, onClose, onSaved }) {
  const [form, setForm] = useState(agent || EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name || !form.role || !form.system_prompt) {
      setError('Name, role, and system prompt are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, channel: form.channel || null }
      if (agent?.id) await updateAgent(agent.id, payload)
      else await createAgent(payload)
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    fontSize: '12px', borderRadius: '2px',
  }
  const labelStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px', letterSpacing: '1.5px',
    color: 'var(--text-muted)', display: 'block',
    marginBottom: '6px',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '24px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border-bright)',
        width: '100%', maxWidth: '560px',
        maxHeight: '90vh', overflowY: 'auto',
        padding: '32px',
        display: 'flex', flexDirection: 'column', gap: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '2px', color: 'var(--accent)' }}>
            {agent?.id ? '// EDIT AGENT' : '// NEW AGENT'}
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', color: 'var(--text-muted)',
            fontSize: '18px', padding: '4px 8px',
          }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>NAME</label>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Researcher" />
          </div>
          <div>
            <label style={labelStyle}>ROLE</label>
            <input style={inputStyle} value={form.role} onChange={e => set('role', e.target.value)} placeholder="researcher" />
          </div>
        </div>

        <div>
          <label style={labelStyle}>SYSTEM PROMPT</label>
          <textarea
            style={{ ...inputStyle, minHeight: '120px', resize: 'vertical', lineHeight: '1.6' }}
            value={form.system_prompt}
            onChange={e => set('system_prompt', e.target.value)}
            placeholder="You are a research assistant..."
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={labelStyle}>MODEL</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.model} onChange={e => set('model', e.target.value)}>
              <option value="gemini-2.5-flash">gemini-2.5-flash</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>CHANNEL</label>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.channel} onChange={e => set('channel', e.target.value)}>
              <option value="">None</option>
              <option value="telegram">Telegram</option>
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>TOOLS</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {TOOLS.map(tool => {
              const active = form.tools.includes(tool)
              return (
                <button key={tool} onClick={() => set('tools', active ? form.tools.filter(t => t !== tool) : [...form.tools, tool])}
                  style={{
                    padding: '6px 12px',
                    background: active ? 'var(--accent-dim)' : 'transparent',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '10px', letterSpacing: '1px',
                    transition: 'all 0.15s',
                  }}>
                  {tool}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => set('memory_enabled', !form.memory_enabled)} style={{
            width: '36px', height: '20px',
            background: form.memory_enabled ? 'var(--accent)' : 'var(--border)',
            borderRadius: '10px', position: 'relative',
            transition: 'background 0.2s',
          }}>
            <span style={{
              position: 'absolute',
              top: '3px', left: form.memory_enabled ? '19px' : '3px',
              width: '14px', height: '14px',
              background: form.memory_enabled ? 'var(--bg)' : 'var(--text-muted)',
              borderRadius: '50%',
              transition: 'left 0.2s',
            }} />
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px' }}>
            MEMORY ENABLED
          </span>
        </div>

        {error && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', padding: '10px', border: '1px solid var(--red)', background: 'rgba(255,68,68,0.05)' }}>
            {error}
          </div>
        )}

        <button onClick={handleSave} disabled={saving} style={{
          padding: '12px',
          background: saving ? 'var(--border)' : 'var(--accent)',
          color: 'var(--bg)',
          fontSize: '11px', fontWeight: 700, letterSpacing: '2px',
          transition: 'all 0.15s',
        }}>
          {saving ? 'SAVING...' : (agent?.id ? 'UPDATE AGENT' : 'CREATE AGENT')}
        </button>
      </div>
    </div>
  )
}

export default function Agents() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | agent object

  const load = async () => {
    try {
      const res = await getAgents()
      setAgents(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this agent?')) return
    await deleteAgent(id)
    load()
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '6px' }}>
            // AGENT REGISTRY
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1px' }}>
            Agents
            <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '12px', fontFamily: 'var(--font-mono)' }}>
              {agents.length} configured
            </span>
          </h1>
        </div>
        <button onClick={() => setModal('new')} style={{
          padding: '12px 24px',
          background: 'var(--accent)',
          color: 'var(--bg)',
          fontSize: '11px', fontWeight: 700, letterSpacing: '2px',
          transition: 'opacity 0.15s',
        }}
          onMouseEnter={e => e.target.style.opacity = '0.85'}
          onMouseLeave={e => e.target.style.opacity = '1'}
        >
          + NEW AGENT
        </button>
      </div>

      {loading ? (
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '12px' }}>
          Loading...
        </div>
      ) : agents.length === 0 ? (
        <div style={{
          border: '1px dashed var(--border)',
          padding: '64px',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px' }}>
            NO AGENTS CONFIGURED
          </div>
          <div style={{ fontSize: '13px' }}>Create your first agent to get started.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {agents.map(agent => (
            <AgentCard key={agent.id} agent={agent} onEdit={setModal} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {modal && (
        <AgentModal
          agent={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
