import { useState, useEffect, useCallback, useRef } from 'react'
import ReactFlow, {
  Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  MarkerType,
  Handle, Position,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  getWorkflows, getTemplates, createWorkflow,
  updateWorkflow, deleteWorkflow, getAgents, startRun
} from '../api/client'

// ── Custom Node ──────────────────────────────────────────────────────────────
function AgentNode({ data, selected }) {
  return (
    <div style={{
      background: selected ? 'var(--bg-3)' : 'var(--bg-2)',
      border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-bright)'}`,
      padding: '14px 18px',
      minWidth: '180px',
      position: 'relative',
    }}>
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'var(--accent)', width: 10, height: 10 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'var(--accent)', width: 10, height: 10 }}
      />
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: '3px', height: '100%',
        background: data.channel === 'telegram' ? 'var(--blue)' : 'var(--accent)',
      }} />
      <div style={{ paddingLeft: '8px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: '4px' }}>
          {data.role?.toUpperCase() || 'AGENT'}
        </div>
        <div style={{ fontWeight: 700, fontSize: '13px' }}>{data.label}</div>
        {data.channel && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--blue)', marginTop: '4px' }}>
            ◉ {data.channel}
          </div>
        )}
      </div>
    </div>
  )
}

const nodeTypes = { agentNode: AgentNode }

const edgeStyle = {
  style: { stroke: 'var(--border-bright)', strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border-bright)' },
  type: 'smoothstep',
}

// ── Workflow Card ─────────────────────────────────────────────────────────────
function WorkflowCard({ workflow, onOpen, onDelete, onRun }) {
  const agentCount = workflow.graph_config?.agents?.length || 0
  const isTemplate = workflow.is_template

  return (
    <div style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--border)',
      padding: '20px 24px',
      display: 'flex', flexDirection: 'column', gap: '12px',
      transition: 'border-color 0.15s',
      position: 'relative', overflow: 'hidden',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: '3px', height: '100%',
        background: isTemplate ? 'var(--orange)' : 'var(--green)',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>{workflow.name}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
            {isTemplate ? '⬡ TEMPLATE' : `⬡ ${agentCount} AGENT${agentCount !== 1 ? 'S' : ''}`}
          </div>
        </div>
        {isTemplate && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1px',
            padding: '3px 8px', border: '1px solid var(--orange)',
            color: 'var(--orange)', borderRadius: '2px',
          }}>TEMPLATE</span>
        )}
      </div>

      {workflow.description && (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
          {workflow.description}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => onOpen(workflow)} style={{
          flex: 1, padding: '8px',
          background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--text-muted)', fontSize: '10px', letterSpacing: '1px',
          transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-muted)' }}
        >
          {isTemplate ? 'USE' : 'EDIT'}
        </button>
        {!isTemplate && agentCount > 0 && (
          <button onClick={() => onRun(workflow)} style={{
            flex: 1, padding: '8px',
            background: 'var(--accent-dim2)', border: '1px solid var(--accent)',
            color: 'var(--accent)', fontSize: '10px', letterSpacing: '1px',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.target.style.background = 'var(--accent-dim)' }}
            onMouseLeave={e => { e.target.style.background = 'var(--accent-dim2)' }}
          >
            ▶ RUN
          </button>
        )}
        {!isTemplate && (
          <button onClick={() => onDelete(workflow.id)} style={{
            padding: '8px 14px',
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: '10px',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.target.style.borderColor = 'var(--red)'; e.target.style.color = 'var(--red)' }}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-muted)' }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

// ── Run Modal ─────────────────────────────────────────────────────────────────
function RunModal({ workflow, onClose }) {
  const [msg, setMsg] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleRun = async () => {
    if (!msg.trim()) return
    setRunning(true)
    setError('')
    try {
      const res = await startRun({ workflow_id: workflow.id, input_message: msg })
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || 'Run failed.')
    } finally {
      setRunning(false)
    }
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
        width: '100%', maxWidth: '480px',
        padding: '32px',
        display: 'flex', flexDirection: 'column', gap: '20px',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '2px', color: 'var(--accent)' }}>
          // EXECUTE WORKFLOW
        </div>
        <div style={{ fontSize: '16px', fontWeight: 700 }}>{workflow.name}</div>

        <div>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', letterSpacing: '1.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
            INPUT MESSAGE
          </label>
          <textarea
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder="Enter the input for your agents..."
            style={{
              width: '100%', padding: '12px',
              fontSize: '12px', minHeight: '100px',
              resize: 'vertical', lineHeight: '1.6',
              borderRadius: '2px',
            }}
          />
        </div>

        {error && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--red)', padding: '10px', border: '1px solid var(--red)' }}>
            {error}
          </div>
        )}

        {result && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--green)', padding: '12px', border: '1px solid var(--green)', background: 'rgba(68,255,136,0.05)' }}>
            <div style={{ letterSpacing: '1px', marginBottom: '6px' }}>✓ RUN COMPLETED</div>
            <div style={{ color: 'var(--text-muted)' }}>run_id: {result.run_id}</div>
            <div style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '10px' }}>
              Check the Monitor page for live message logs.
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px',
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '1px',
          }}>CANCEL</button>
          <button onClick={handleRun} disabled={running || !msg.trim()} style={{
            flex: 2, padding: '12px',
            background: running ? 'var(--border)' : 'var(--accent)',
            color: 'var(--bg)',
            fontSize: '11px', fontWeight: 700, letterSpacing: '2px',
          }}>
            {running ? 'RUNNING...' : '▶ EXECUTE'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Builder Modal ─────────────────────────────────────────────────────────────
function BuilderModal({ workflow, agents, onClose, onSaved }) {
  const isTemplate = workflow?.is_template

  // Init from existing workflow or template
  const initFromConfig = (config, allAgents) => {
    const agentIds = config?.agents || []
    const edges = config?.edges || []
    const positions = config?.positions || {}

    const ns = agentIds.map((id, i) => {
      const agent = allAgents.find(a => a.id === id)
      return {
        id,
        type: 'agentNode',
        position: positions[id] || { x: 150 + i * 220, y: 200 },
        data: {
          label: agent?.name || id,
          role: agent?.role,
          channel: agent?.channel,
        },
      }
    })

    const es = edges
      .filter(([from, to]) => to !== 'END' && agentIds.includes(agents.find(a => a.name === from)?.id) && agentIds.includes(agents.find(a => a.name === to)?.id))
      .map(([from, to], i) => {
        const fromId = allAgents.find(a => a.name === from)?.id
        const toId = allAgents.find(a => a.name === to)?.id
        return fromId && toId ? { id: `e${i}`, source: fromId, target: toId, ...edgeStyle } : null
      })
      .filter(Boolean)

    return { ns, es }
  }

  const initFromTemplate = (config, allAgents) => {
    const roles = config?.template_roles || []
    return roles.map((r, i) => {
      const agent = allAgents.find(a => a.role === r.role || a.name === r.name)
      return agent ? {
        id: agent.id,
        type: 'agentNode',
        position: r.position || { x: 150 + i * 220, y: 200 },
        data: { label: agent.name, role: agent.role, channel: agent.channel },
      } : null
    }).filter(Boolean)
  }

  const getInit = () => {
    if (isTemplate) {
      const ns = initFromTemplate(workflow?.graph_config, agents)
      return { ns, es: [] }
    }
    return initFromConfig(workflow?.graph_config, agents)
  }

  const { ns: initNodes, es: initEdges } = getInit()

  const [nodes, setNodes, onNodesChange] = useNodesState(initNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initEdges)
  const [name, setName] = useState(isTemplate ? `${workflow.name} (copy)` : (workflow?.name || ''))
  const [description, setDescription] = useState(isTemplate ? workflow.description : (workflow?.description || ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [selectedAgents, setSelectedAgents] = useState(initNodes.map(n => n.id))

  const onConnect = useCallback(
    (params) => setEdges(eds => addEdge({ ...params, ...edgeStyle }, eds)),
    [setEdges]
  )

  const toggleAgent = (agent) => {
    const exists = nodes.find(n => n.id === agent.id)
    if (exists) {
      setNodes(ns => ns.filter(n => n.id !== agent.id))
      setEdges(es => es.filter(e => e.source !== agent.id && e.target !== agent.id))
      setSelectedAgents(s => s.filter(id => id !== agent.id))
    } else {
      const newNode = {
        id: agent.id,
        type: 'agentNode',
        position: { x: 150 + nodes.length * 220, y: 200 },
        data: { label: agent.name, role: agent.role, channel: agent.channel },
      }
      setNodes(ns => [...ns, newNode])
      setSelectedAgents(s => [...s, agent.id])
    }
  }

  const buildGraphConfig = () => {
    const agentIds = nodes.map(n => n.id)
    const agentNameById = {}
    agents.forEach(a => { agentNameById[a.id] = a.name })

    const edgeList = edges.map(e => [agentNameById[e.source], agentNameById[e.target]])
    const positions = {}
    nodes.forEach(n => { positions[n.id] = n.position })

    // Auto-add END edge for last agent
    const sources = new Set(edges.map(e => e.source))
    const targets = new Set(edges.map(e => e.target))
    const terminals = agentIds.filter(id => sources.has(id) && !targets.has(id) || (!sources.has(id) && !targets.has(id)))
    terminals.forEach(id => {
      if (!edgeList.find(([from]) => from === agentNameById[id] && edgeList.includes('END'))) {
        edgeList.push([agentNameById[id], 'END'])
      }
    })

    return { agents: agentIds, edges: edgeList, positions }
  }

  const handleSave = async () => {
    if (!name) { setError('Workflow name is required.'); return }
    if (nodes.length === 0) { setError('Add at least one agent.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name,
        description,
        graph_config: buildGraphConfig(),
        is_template: false,
      }
      if (workflow?.id && !isTemplate) await updateWorkflow(workflow.id, payload)
      else await createWorkflow(payload)
      onSaved()
    } catch (e) {
      setError(e.response?.data?.detail || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg)',
      zIndex: 1000,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '0 24px', height: '56px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-2)',
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: 'transparent', color: 'var(--text-muted)',
          fontSize: '12px', letterSpacing: '1px', padding: '6px 10px',
          border: '1px solid var(--border)',
        }}>← BACK</button>

        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Workflow name..."
          style={{
            background: 'transparent', border: 'none',
            borderBottom: '1px solid var(--border)',
            color: 'var(--text)', fontSize: '15px', fontWeight: 700,
            fontFamily: 'var(--font-display)',
            padding: '4px 0', width: '240px',
          }}
        />

        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description..."
          style={{
            background: 'transparent', border: 'none',
            borderBottom: '1px solid var(--border)',
            color: 'var(--text-muted)', fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            padding: '4px 0', flex: 1,
          }}
        />

        {error && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--red)' }}>
            {error}
          </div>
        )}

        <button onClick={handleSave} disabled={saving} style={{
          padding: '10px 24px',
          background: saving ? 'var(--border)' : 'var(--accent)',
          color: 'var(--bg)',
          fontSize: '11px', fontWeight: 700, letterSpacing: '2px',
          marginLeft: 'auto',
        }}>
          {saving ? 'SAVING...' : 'SAVE WORKFLOW'}
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Agent Sidebar */}
        <div style={{
          width: '220px', flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-2)',
          overflowY: 'auto',
          padding: '16px',
          display: 'flex', flexDirection: 'column', gap: '8px',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)', marginBottom: '8px' }}>
            AVAILABLE AGENTS
          </div>
          {agents.map(agent => {
            const active = nodes.find(n => n.id === agent.id)
            return (
              <button key={agent.id} onClick={() => toggleAgent(agent)} style={{
                padding: '10px 12px',
                background: active ? 'var(--accent-dim)' : 'var(--bg-3)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                color: active ? 'var(--accent)' : 'var(--text)',
                textAlign: 'left',
                transition: 'all 0.15s',
                cursor: 'pointer',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>{agent.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: active ? 'var(--accent)' : 'var(--text-muted)', letterSpacing: '1px' }}>
                  {agent.role.toUpperCase()}
                </div>
              </button>
            )
          })}
          {agents.length === 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center', paddingTop: '24px' }}>
              No agents yet.<br />Create agents first.
            </div>
          )}
        </div>

        {/* ReactFlow Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            style={{ background: 'var(--bg)' }}
          >
            <Background color="var(--border)" gap={24} size={1} />
            <Controls style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }} />
            <MiniMap
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
              nodeColor={() => 'var(--accent)'}
            />
          </ReactFlow>

          {nodes.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px' }}>
                  CANVAS EMPTY
                </div>
                <div style={{ fontSize: '13px' }}>Click agents on the left to add them</div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>Then drag between nodes to connect them</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Workflows() {
  const [workflows, setWorkflows] = useState([])
  const [templates, setTemplates] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [builder, setBuilder] = useState(null) // null | workflow object | 'new'
  const [runModal, setRunModal] = useState(null)
  const [tab, setTab] = useState('workflows') // 'workflows' | 'templates'

  const load = async () => {
    const [wfRes, tplRes, agRes] = await Promise.all([getWorkflows(), getTemplates(), getAgents()])
    setWorkflows(wfRes.data.filter(w => !w.is_template))
    setTemplates(tplRes.data)
    setAgents(agRes.data)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    if (!confirm('Delete this workflow?')) return
    await deleteWorkflow(id)
    load()
  }

  const displayed = tab === 'workflows' ? workflows : templates

  if (builder) {
    return (
      <BuilderModal
        workflow={builder === 'new' ? null : builder}
        agents={agents}
        onClose={() => setBuilder(null)}
        onSaved={() => { setBuilder(null); load() }}
      />
    )
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '6px' }}>
            // WORKFLOW BUILDER
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1px' }}>Workflows</h1>
        </div>
        <button onClick={() => setBuilder('new')} style={{
          padding: '12px 24px',
          background: 'var(--accent)', color: 'var(--bg)',
          fontSize: '11px', fontWeight: 700, letterSpacing: '2px',
        }}>
          + NEW WORKFLOW
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
        {['workflows', 'templates'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 24px',
            background: 'transparent',
            color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: `2px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
            fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '2px',
            transition: 'all 0.15s',
          }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: '12px' }}>Loading...</div>
      ) : displayed.length === 0 ? (
        <div style={{ border: '1px dashed var(--border)', padding: '64px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '2px', marginBottom: '12px' }}>
            {tab === 'workflows' ? 'NO WORKFLOWS YET' : 'NO TEMPLATES'}
          </div>
          <div style={{ fontSize: '13px' }}>
            {tab === 'workflows' ? 'Create a workflow or use a template.' : 'Templates will appear here.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
          {displayed.map(wf => (
            <WorkflowCard
              key={wf.id}
              workflow={wf}
              onOpen={setBuilder}
              onDelete={handleDelete}
              onRun={setRunModal}
            />
          ))}
        </div>
      )}

      {runModal && <RunModal workflow={runModal} onClose={() => setRunModal(null)} />}
    </div>
  )
}
