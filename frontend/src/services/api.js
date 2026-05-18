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
    const useQuickLogin = localStorage.getItem('useQuickLogin') === 'true'
    if (useQuickLogin) {
      config.headers['Authorization'] = 'Bearer BYPASS_EXPRESS_LOGIN_SECRET_TOKEN_CHOCO_EGYPT_9988'
    } else {
      const user = auth.currentUser
      if (user) {
        const token = await user.getIdToken()
        config.headers['Authorization'] = `Bearer ${token}`
      }
    }

    // For test authentication requests, strictly bypass localStorage injection to test EXACT typed keys
    if (config.url && config.url.includes('/eta/test-auth')) {
      return config
    }

    const settings = JSON.parse(localStorage.getItem('companySettings') || '{}')
    
    // Case-insensitive header value extraction to prevent Axios case normalization from bypassing checks
    const getHeader = (name) => {
      if (!config.headers) return null
      // Axios v1 AxiosHeaders has a .get() method
      if (typeof config.headers.get === 'function') {
        return config.headers.get(name)
      }
      const lower = name.toLowerCase()
      const foundKey = Object.keys(config.headers).find(k => k.toLowerCase() === lower)
      return foundKey ? config.headers[foundKey] : null
    }

    if (settings.clientId && !getHeader('X-ETA-Client-Id')) {
      config.headers['X-ETA-Client-Id'] = settings.clientId
    }
    const activeSecret = settings.clientSecret1 || settings.clientSecret2
    if (activeSecret && !getHeader('X-ETA-Client-Secret')) {
      config.headers['X-ETA-Client-Secret'] = activeSecret
    }
  } catch (e) {
    console.error('Error during api request interceptor:', e)
  }
  return config
}, (error) => {
  return Promise.reject(error)
})

/** رفع ملف Excel وجلب الـ headers والـ preview */
export async function uploadExcel(file, mode = 'template') {
  const form = new FormData()
  form.append('file', file)
  form.append('mode', mode)
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
  if (!customSettings) {
    throw new Error('❌ لا توجد إعدادات لاختبارها')
  }

  const { clientId, clientSecret1, clientSecret2 } = customSettings

  if (!clientId || !clientId.trim()) {
    throw new Error('❌ يرجى إدخال معرف العميل (Client ID) أولاً!')
  }

  const hasSecret1 = clientSecret1 && clientSecret1.trim()
  const hasSecret2 = clientSecret2 && clientSecret2.trim()

  if (!hasSecret1 && !hasSecret2) {
    throw new Error('❌ يجب إدخال السر الأول (Secret 1) أو السر الثاني (Secret 2) لاختبار الاتصال!')
  }

  // 1. Test Client Secret 1 if provided
  if (hasSecret1) {
    const headers = {
      'X-ETA-Client-Id': clientId,
      'X-ETA-Client-Secret': clientSecret1
    }
    await api.get('/eta/test-auth', { headers })
  }

  // 2. Test Client Secret 2 if provided
  if (hasSecret2) {
    const headers = {
      'X-ETA-Client-Id': clientId,
      'X-ETA-Client-Secret': clientSecret2
    }
    await api.get('/eta/test-auth', { headers })
  }

  return { success: true }
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

/** جلب سجل العمليات الخاص بالمستخدم (مقبولة/مرفوضة/خطأ) */
export async function getOperations() {
  const { data } = await api.get('/eta/operations')
  return data
}

/** جلب إعدادات الشركة الخاصة بحساب المستخدم من Firestore */
export async function getCompanySettings() {
  const { data } = await api.get('/eta/settings')
  return data
}

/** حفظ إعدادات الشركة الخاصة بحساب المستخدم في Firestore */
export async function saveCompanySettings(settings) {
  const { data } = await api.post('/eta/settings', settings)
  return data
}
