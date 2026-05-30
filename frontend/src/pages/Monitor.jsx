import { useState, useEffect, useRef } from 'react'
import { getWorkflows, getWorkflowRuns, getRunMessages, startRun } from '../api/client'

function LogLine({ msg, index }) {
  const colors = {
    user: 'var(--accent)',
    Researcher: 'var(--blue)',
    Writer: 'var(--green)',
    Classifier: 'var(--orange)',
    'FAQ Agent': 'var(--accent)',
    'Escalation Agent': 'var(--red)',
}
  const color = colors[msg.sender] || 'var(--text-muted)'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '80px 140px 1fr',
      gap: '12px',
      padding: '10px 16px',
      borderBottom: '1px solid var(--border)',
      background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', paddingTop: '2px' }}>
        {msg.timestamp
          ? new Date(msg.timestamp).toLocaleTimeString('en-US', { hour12: false })
          : '--:--:--'
        }
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: '10px',
        color, letterSpacing: '0.5px', fontWeight: 700,
        display: 'flex', alignItems: 'flex-start', gap: '6px',
      }}>
        <span style={{ color: 'var(--text-dim)' }}>◈</span>
        {msg.sender}
      </div>
      <div style={{
        fontSize: '12px', lineHeight: '1.6',
        color: 'var(--text)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {msg.content}
      </div>
    </div>
  )
}

export default function Monitor() {
  const [workflows, setWorkflows] = useState([])
  const [selectedWf, setSelectedWf] = useState('')
  const [runs, setRuns] = useState([])
  const [selectedRun, setSelectedRun] = useState('')
  const [messages, setMessages] = useState([])
  const [liveMessages, setLiveMessages] = useState([])
  const [wsStatus, setWsStatus] = useState('idle') // idle | connecting | connected | closed
  const [inputMsg, setInputMsg] = useState('')
  const [running, setRunning] = useState(false)
  const wsRef = useRef(null)
  const logRef = useRef(null)

  useEffect(() => {
    getWorkflows().then(res => setWorkflows(res.data.filter(w => !w.is_template)))
  }, [])

  useEffect(() => {
    if (!selectedWf) return
    getWorkflowRuns(selectedWf).then(res => {
      setRuns(res.data.sort((a, b) => new Date(b.started_at) - new Date(a.started_at)))
    })
  }, [selectedWf])

  useEffect(() => {
    if (!selectedRun) return
    setMessages([])
    setLiveMessages([])
    getRunMessages(selectedRun).then(res => setMessages(res.data))
  }, [selectedRun])

  // Auto-scroll to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [messages, liveMessages])

  const connectWs = (runId) => {
    if (wsRef.current) wsRef.current.close()
    setLiveMessages([])
    setWsStatus('connecting')

    const ws = new WebSocket(`ws://localhost:8000/monitor/ws/${runId}`)
    wsRef.current = ws

    ws.onopen = () => setWsStatus('connected')
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.sender === '__system__' && data.content === '__done__') {
        // Workflow finished -- fetch final state
        getRunMessages(data.run_id).then(res => {
          if (res.data.length > 0) {
            setMessages(res.data)
            setLiveMessages([])
          }
        })
        getWorkflowRuns(selectedWf).then(res => {
          setRuns(res.data.sort((a, b) => new Date(b.started_at) - new Date(a.started_at)))
        })
        setWsStatus('closed')
        return
      }
      setLiveMessages(prev => [...prev, data])
    }
    ws.onclose = () => setWsStatus('closed')
    ws.onerror = () => setWsStatus('closed')
  }

  const handleRun = async () => {
    if (!selectedWf || !inputMsg.trim()) return
    setRunning(true)
    setMessages([])
    setLiveMessages([])
    try {
      const runRes = await startRun({ workflow_id: selectedWf, input_message: inputMsg })
      const runId = runRes.data.run_id
      setSelectedRun(runId)

      // Connect WebSocket immediately -- backend is now running in background
      connectWs(runId)

      // Refresh runs list
      const runsRes = await getWorkflowRuns(selectedWf)
      setRuns(runsRes.data.sort((a, b) => new Date(b.started_at) - new Date(a.started_at)))

      // After enough time for workflow to complete, fetch persisted messages
      setTimeout(() => {
        getRunMessages(runId).then(res => {
          if (res.data.length > 0) {
            setMessages(res.data)
            setLiveMessages([])
          }
        })
      }, 15000)
    } finally {
      setRunning(false)
    }
  }

  const allMessages = messages.length > 0 ? messages : liveMessages

  const wsColor = { idle: 'var(--text-dim)', connecting: 'var(--orange)', connected: 'var(--green)', closed: 'var(--red)' }
  const wsLabel = { idle: 'IDLE', connecting: 'CONNECTING', connected: 'LIVE', closed: 'DISCONNECTED' }

  const selectStyle = {
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    padding: '10px 12px',
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    width: '100%',
    outline: 'none',
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '32px', gap: '24px' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '2px', marginBottom: '6px' }}>
            // EXECUTION MONITOR
          </div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-1px' }}>Monitor</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: wsColor[wsStatus],
            boxShadow: wsStatus === 'connected' ? `0 0 8px ${wsColor[wsStatus]}` : 'none',
            animation: wsStatus === 'connected' ? 'pulse 2s infinite' : 'none',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: wsColor[wsStatus], letterSpacing: '1px' }}>
            {wsLabel[wsStatus]}
          </span>
          <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr auto',
        gap: '12px',
        padding: '20px',
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
      }}>
        <div>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
            WORKFLOW
          </label>
          <select style={selectStyle} value={selectedWf} onChange={e => { setSelectedWf(e.target.value); setSelectedRun('') }}>
            <option value="">Select workflow...</option>
            {workflows.map(wf => <option key={wf.id} value={wf.id}>{wf.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
            PAST RUN
          </label>
          <select style={selectStyle} value={selectedRun} onChange={e => setSelectedRun(e.target.value)} disabled={!selectedWf}>
            <option value="">Select run to replay...</option>
            {runs.map(r => (
              <option key={r.id} value={r.id}>
                {new Date(r.started_at).toLocaleString()} — {r.status.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '1.5px', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
            NEW INPUT
          </label>
          <input
            style={{ ...selectStyle, width: '100%' }}
            value={inputMsg}
            onChange={e => setInputMsg(e.target.value)}
            placeholder="Type a message to run..."
            onKeyDown={e => e.key === 'Enter' && handleRun()}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={handleRun} disabled={running || !selectedWf || !inputMsg.trim()} style={{
            padding: '10px 20px',
            background: running ? 'var(--border)' : 'var(--accent)',
            color: 'var(--bg)',
            fontSize: '11px', fontWeight: 700, letterSpacing: '2px',
            height: '40px', whiteSpace: 'nowrap',
          }}>
            {running ? '...' : '▶ RUN'}
          </button>
        </div>
      </div>

      {/* Log Viewer */}
      <div style={{
        flex: 1,
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* Log Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '80px 140px 1fr',
          gap: '12px',
          padding: '8px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-3)',
        }}>
          {['TIME', 'AGENT', 'MESSAGE'].map(h => (
            <div key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', letterSpacing: '2px', color: 'var(--text-dim)' }}>
              {h}
            </div>
          ))}
        </div>

        {/* Log Lines */}
        <div ref={logRef} style={{ flex: 1, overflowY: 'auto' }}>
          {allMessages.length === 0 ? (
            <div style={{
              height: '100%', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-dim)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '2px', marginBottom: '8px' }}>
                  AWAITING SIGNALS
                </div>
                <div style={{ fontSize: '12px' }}>
                  {selectedRun ? 'No messages for this run.' : 'Select a workflow and run it, or pick a past run.'}
                </div>
              </div>
            </div>
          ) : (
            allMessages.map((msg, i) => <LogLine key={msg.id || i} msg={msg} index={i} />)
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-3)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '1px' }}>
            {allMessages.length} MESSAGE{allMessages.length !== 1 ? 'S' : ''}
          </span>
          {selectedRun && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '1px' }}>
              run: {selectedRun.slice(0, 8)}...
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
