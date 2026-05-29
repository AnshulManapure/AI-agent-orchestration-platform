import axios from 'axios'

const api = axios.create({ baseURL: 'http://localhost:8000' })

// Agents
export const getAgents = () => api.get('/agents/')
export const createAgent = (data) => api.post('/agents/', data)
export const updateAgent = (id, data) => api.patch(`/agents/${id}`, data)
export const deleteAgent = (id) => api.delete(`/agents/${id}`)

// Workflows
export const getWorkflows = () => api.get('/workflows/')
export const getTemplates = () => api.get('/workflows/templates')
export const createWorkflow = (data) => api.post('/workflows/', data)
export const updateWorkflow = (id, data) => api.patch(`/workflows/${id}`, data)
export const deleteWorkflow = (id) => api.delete(`/workflows/${id}`)
export const getWorkflowRuns = (id) => api.get(`/workflows/${id}/runs`)
export const getRunMessages = (runId) => api.get(`/workflows/runs/${runId}/messages`)

// Runs
export const startRun = (data) => api.post('/runs/', data)
