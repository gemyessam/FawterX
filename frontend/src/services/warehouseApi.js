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

/** Parse supplier invoice into warehouse review lines */
export async function parseWarehouseInvoice(file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/warehouse/invoices/parse', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/** Save reviewed purchase invoice lines into inbound stock movements */
export async function processWarehouseInvoice(projectId, invoiceMeta, lines) {
  const { data } = await api.post(`/warehouse/projects/${projectId}/invoices/process`, { invoiceMeta, lines })
  return data
}

/** Update stock item quantity / properties (Admin only) */
export async function updateStockItem(projectId, itemKey, payload) {
  const { data } = await api.put(`/warehouse/projects/${projectId}/stock/${itemKey}`, payload)
  return data
}

/** Delete stock item from inventory (Admin only) */
export async function deleteStockItem(projectId, itemKey) {
  const { data } = await api.delete(`/warehouse/projects/${projectId}/stock/${itemKey}`)
  return data
}

/** Fetch transaction invoice history for a project */
export async function getWarehouseInvoices(projectId) {
  const { data } = await api.get(`/warehouse/projects/${projectId}/invoices`)
  return data
}

/** Fetch granular line-item stock movements for a transaction/invoice */
export async function getInvoiceMovements(projectId, invoiceId) {
  const { data } = await api.get(`/warehouse/projects/${projectId}/invoices/${invoiceId}/movements`)
  return data
}

/** Fetch transaction history for a specific stock item */
export async function getItemMovementsHistory(projectId, itemKey, itemCode) {
  const { data } = await api.get(`/warehouse/projects/${projectId}/stock/${itemKey}/movements`, {
    params: { itemCode },
  })
  return data
}

/** Update invoice metadata (Sales Order # & Customer Reference) */
export async function updateWarehouseInvoiceMetadata(projectId, invoiceId, payload) {
  const { data } = await api.patch(`/warehouse/projects/${projectId}/invoices/${invoiceId}`, payload)
  return data
}

/** Get audit logs for warehouse operations (Admin only) */
export async function getWarehouseAuditLogs(projectId) {
  const { data } = await api.get(`/warehouse/projects/${projectId}/audit-logs`)
  return data
}

/** Get list of restore points for a project */
export async function getProjectRestorePoints(projectId) {
  const { data } = await api.get(`/warehouse/projects/${projectId}/restore-points`)
  return data
}

/** Create a new restore point (snapshot) for a project */
export async function createProjectRestorePoint(projectId, payload) {
  const { data } = await api.post(`/warehouse/projects/${projectId}/restore-points`, payload)
  return data
}

/** Restore project stock to a specific restore point */
export async function restoreProjectToPoint(projectId, pointId) {
  const { data } = await api.post(`/warehouse/projects/${projectId}/restore-points/${pointId}/restore`)
  return data
}

/** Delete a restore point */
export async function deleteProjectRestorePoint(projectId, pointId) {
  const { data } = await api.delete(`/warehouse/projects/${projectId}/restore-points/${pointId}`)
  return data
}


