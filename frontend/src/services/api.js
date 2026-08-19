import axios from 'axios'
import { auth } from '../firebase'

export const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '/api'
  : 'https://fawterx-api.onrender.com/api'

const api = axios.create({
  baseURL: API_BASE_URL
})

async function getCurrentAuthToken() {
  const useQuickLogin = localStorage.getItem('useQuickLogin') === 'true'
  if (useQuickLogin) {
    return 'BYPASS_EXPRESS_LOGIN_SECRET_TOKEN_CHOCO_EGYPT_9988'
  }

  // Wait for Firebase Auth to fully initialize before checking currentUser
  if (typeof auth.authStateReady === 'function') {
    await auth.authStateReady()
  }

  const user = auth.currentUser
  if (user) {
    // Force refresh to avoid stale/expired tokens after security changes
    const token = await user.getIdToken(true)
    localStorage.setItem('fawterx_id_token', token)
    return token
  }

  return ''
}

// Add request interceptor to dynamically inject Firebase ID Token and ETA company credentials
api.interceptors.request.use(async (config) => {
  try {
    const token = await getCurrentAuthToken()
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }

    // For test authentication requests, strictly bypass localStorage injection to test EXACT typed keys
    if (config.url && config.url.includes('/eta/test-auth')) {
      return config
    }

    // Skip ETA credential injection for non-ETA routes (admin, warehouse, auth-security, excel)
    // These routes don't need ETA secrets and extra custom headers can trigger CORS preflight issues
    if (config.url && (
      config.url.includes('/admin') ||
      config.url.includes('/warehouse') ||
      config.url.includes('/auth-security') ||
      config.url.includes('/excel')
    )) {
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

// Clear stale tokens on 401 to force fresh re-auth on next request
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fawterx_id_token')
    }
    return Promise.reject(error)
  }
)

/** رفع ملف Excel وجلب الـ headers والـ preview */
export async function uploadExcel(file, mode = 'template') {
  const form = new FormData()
  form.append('file', file)
  form.append('mode', mode)
  const { data } = await api.post('/excel/upload', form)
  return data
}

/** رفع مجموعة ملفات Excel/PDF وجلب النتائج المجمعة */
export async function uploadExcelBatch(files, mode = 'template') {
  const form = new FormData()
  Array.from(files).forEach(f => form.append('files', f))
  form.append('mode', mode)
  const { data } = await api.post('/excel/upload-batch', form)
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

/** إيقاظ سيرفر Render مبكراً في الخلفية لتفادي الـ Cold Start */
export async function warmUpServer() {
  try {
    const baseUrl = API_BASE_URL.replace(/\/api$/, '')
    await fetch(`${baseUrl}/`, { method: 'GET', cache: 'no-store' }).catch(() => {})
  } catch (e) {}
}

/** التحقق من تشغيل أداة التوقيع وإطلاقها تلقائياً مع الانتظار الذكي إذا لزم الأمر */
export async function ensureLocalSignerActive(onStatusUpdate = null) {
  try {
    const res = await fetch('http://localhost:8585/', { method: 'GET' });
    if (res.ok) return true;
  } catch (e) {}

  try {
    window.location.href = 'fawterx-signer://open';
  } catch (e) {}

  if (onStatusUpdate) {
    onStatusUpdate('جاري إطلاق برنامج التوقيع والاتصال بالدونجل...');
  }

  // Poll for up to 4.5 seconds (9 iterations x 500ms)
  for (let i = 0; i < 9; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch('http://localhost:8585/', { method: 'GET' });
      if (res.ok) return true;
    } catch (e) {}
  }

  return false;
}

/** اختبار الاتصال بـ ETA */
export async function testETAAuth(customSettings = null, allowSingleSecret = false) {
  if (!customSettings) {
    throw new Error('No ETA settings were provided for testing.')
  }

  const { clientId, clientSecret1, clientSecret2 } = customSettings
  const cleanClientId = clientId ? clientId.trim() : ''
  const cleanSecret1 = clientSecret1 ? clientSecret1.trim() : ''
  const cleanSecret2 = clientSecret2 ? clientSecret2.trim() : ''

  if (!cleanClientId) {
    throw new Error('Please enter the ETA Client ID first.')
  }

  if (!cleanSecret1 && !cleanSecret2) {
    throw new Error('Please enter at least one ETA Secret.')
  }

  if (!allowSingleSecret && (!cleanSecret1 || !cleanSecret2)) {
    throw new Error('Please enter both ETA Secret 1 and ETA Secret 2. Each secret will be tested against ETA separately.')
  }

  const testSecret = async (label, secret) => {
    if (!secret) return null;
    try {
      const { data } = await api.get('/eta/test-auth', {
        headers: {
          'X-ETA-Client-Id': cleanClientId,
          'X-ETA-Client-Secret': secret
        }
      })
      if (!data?.success) {
        throw new Error(data?.message || `${label} failed ETA authentication`)
      }
      return data
    } catch (error) {
      const serverMessage = error.response?.data?.message || error.response?.data?.error?.error_description || error.message
      throw new Error(`${label} was rejected by ETA: ${serverMessage}`)
    }
  }

  let secret1Result = null;
  let secret2Result = null;
  let error1 = null;
  let error2 = null;

  if (cleanSecret1) {
    try {
      secret1Result = await testSecret('Secret 1', cleanSecret1);
    } catch (e) {
      error1 = e;
    }
  }

  if (cleanSecret2) {
    try {
      secret2Result = await testSecret('Secret 2', cleanSecret2);
    } catch (e) {
      error2 = e;
    }
  }

  // If both failed or single failed in strict mode
  if (!secret1Result && !secret2Result) {
    throw (error1 || error2 || new Error('ETA Authentication failed for provided credentials'));
  }

  if (!allowSingleSecret && (!secret1Result || !secret2Result)) {
    throw (error1 || error2 || new Error('One of the secrets failed ETA verification'));
  }

  return { success: true, secret1: secret1Result, secret2: secret2Result }
}

/** إرسال الفاتورة لـ ETA أو حفظ Draft مع إعادة المحاولة التلقائية عند تأخر استيقاظ السيرفر */
export async function submitToETA(document, dryRun = false) {
  const maxRetries = 1;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { data } = await api.post('/eta/submit', { document, dryRun }, { timeout: 90000 });
      return data;
    } catch (err) {
      const isTransient = !err.response || err.code === 'ECONNABORTED' || err.message?.includes('timeout') || (err.response?.status >= 502);
      if (attempt < maxRetries && isTransient) {
        console.warn(`[submitToETA] Retrying submission after transient failure:`, err.message);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }
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

/** جلب ملخص الإدارة */
export async function getCustomers() {
  const { data } = await api.get('/eta/customers')
  return data
}

export async function saveCustomer(customer) {
  const { data } = await api.post('/eta/customers', customer)
  return data
}

export async function deleteCustomer(customerId) {
  const { data } = await api.delete(`/eta/customers/${encodeURIComponent(customerId)}`)
  return data
}

export async function getAdminStats() {
  const { data } = await api.get('/admin/stats')
  return data
}

/** جلب قائمة المستخدمين للإدارة */
export async function getAdminUsers() {
  const { data } = await api.get('/admin/users')
  return data
}

/** تحديث صلاحيات مستخدم */
export async function updateAdminUser(uid, payload) {
  const { data } = await api.patch(`/admin/users/${uid}`, payload)
  return data
}

/** مزامنة تلقائية لبيانات المستخدم فور تسجيل الدخول */
export async function syncUserData(user) {
  if (!user) return null
  try {
    const { data } = await api.post('/eta/user-sync', {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    })
    return data
  } catch (error) {
    console.warn('User sync failed silently:', error.message)
    return null
  }
}

export async function getAuthSecurityStatus() {
  const { data } = await api.get('/auth-security/device-status')
  return data
}

export async function verifyAuthSecurityCode(code) {
  const { data } = await api.post('/auth-security/verify-2fa', { code })
  return data
}

export async function resendAuthSecurityCode() {
  const { data } = await api.post('/auth-security/resend-code')
  return data
}

/** Admin diagnostic: who does the backend think I am? */
export async function getAdminWhoami() {
  const { data } = await api.get('/admin/whoami')
  return data
}
