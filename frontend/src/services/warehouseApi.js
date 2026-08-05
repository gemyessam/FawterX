import axios from 'axios'
import { auth } from '../firebase'

const api = axios.create({
  baseURL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '/api'
    : 'https://fawterx-api.onrender.com/api'
})

api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser
    if (user) {
      const token = await user.getIdToken()
      config.headers['Authorization'] = `Bearer ${token}`
    }
  } catch (e) {
    console.error('Error during warehouse api interceptor:', e)
  }
  return config
}, (error) => Promise.reject(error))

/** Check current user warehouse access */
export async function getWarehouseAccess() {
  const { data } = await api.get('/warehouse/access')
  return data
}

/** Get list of users with warehouse permissions (Admin only) */
export async function getWarehouseUsers() {
  const { data } = await api.get('/warehouse/users')
  return data
}

/** Update warehouse access for a specific user (Admin only) */
export async function updateWarehouseUserAccess(uid, payload) {
  const { data } = await api.post(`/warehouse/users/${uid}`, payload)
  return data
}

/** Get list of warehouse projects */
export async function getWarehouseProjects() {
  const { data } = await api.get('/warehouse/projects')
  return data
}

/** Create a new warehouse project */
export async function createWarehouseProject(payload) {
  const { data } = await api.post('/warehouse/projects', payload)
  return data
}

/** Get stock snapshot for a project */
export async function getProjectStock(projectId) {
  const { data } = await api.get(`/warehouse/projects/${projectId}/stock`)
  return data
}

/** Save reviewed purchase invoice lines into inbound stock movements */
export async function processWarehouseInvoice(projectId, invoiceMeta, lines) {
  const { data } = await api.post(`/warehouse/projects/${projectId}/invoices/process`, { invoiceMeta, lines })
  return data
}
