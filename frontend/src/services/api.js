import axios from 'axios'
import { auth } from '../firebase'

const api = axios.create({
  baseURL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '/api'
    : 'https://fawterx-api.onrender.com/api'
})



// Add request interceptor to dynamically inject Firebase ID Token and ETA company credentials
api.interceptors.request.use(async (config) => {
  try {
    const user = auth.currentUser
    if (user) {
      const token = await user.getIdToken()
      config.headers['Authorization'] = `Bearer ${token}`
    }

    const settings = JSON.parse(localStorage.getItem('companySettings') || '{}')
    if (settings.clientId && !config.headers['X-ETA-Client-Id']) {
      config.headers['X-ETA-Client-Id'] = settings.clientId
    }
    if (settings.clientSecret1 && !config.headers['X-ETA-Client-Secret']) {
      config.headers['X-ETA-Client-Secret'] = settings.clientSecret1
    }
  } catch (e) {
    console.error('Error during api request interceptor:', e)
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

/** رفع ملف Excel وجلب الـ headers والـ preview */
export async function uploadExcel(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/excel/upload', form)
  return data
}

/** توليد ETA JSON من الـ mapping والـ rows */
export async function generateInvoice(mapping, rows, issuer, metadata = {}) {
  const { data } = await api.post('/invoice/generate', { mapping, rows, issuer, metadata })
  return data
}

/** معاينة الـ invoice lines فقط */
export async function previewInvoice(mapping, rows, metadata = {}) {
  const { data } = await api.post('/invoice/preview', { mapping, rows, metadata })
  return data
}

/** اختبار الاتصال بـ ETA */
export async function testETAAuth(customSettings = null) {
  const headers = {}
  if (customSettings) {
    headers['X-ETA-Client-Id'] = customSettings.clientId
    headers['X-ETA-Client-Secret'] = customSettings.clientSecret1
  }
  const { data } = await api.get('/eta/test-auth', { headers })
  return data
}

/** إرسال الفاتورة لـ ETA أو حفظ Draft */
export async function submitToETA(document, dryRun = false) {
  const { data } = await api.post('/eta/submit', { document, dryRun })
  return data
}

/** جلب كل الـ Drafts */
export async function getDrafts() {
  const { data } = await api.get('/eta/drafts')
  return data
}

/** جلب مسودة محددة */
export async function getDraftById(id) {
  const { data } = await api.get(`/eta/drafts/${id}`)
  return data
}

/** إرسال مسودة محددة حقيقيًا لـ ETA */
export async function submitDraft(id) {
  const { data } = await api.post(`/eta/drafts/${id}/submit`)
  return data
}

/** حذف مسودة */
export async function deleteDraft(id) {
  const { data } = await api.delete(`/eta/drafts/${id}`)
  return data
}

/** التحقق من حالة الفاتورة باستخدام UUID */
export async function getETAStatus(uuid) {
  const { data } = await api.get(`/eta/status/${uuid}`)
  return data
}

/** جلب استهلاك المستخدم وحالة اشتراكه */
export async function getUsageStatus() {
  const { data } = await api.get('/eta/usage')
  return data
}

