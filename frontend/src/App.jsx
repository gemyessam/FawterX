import { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import Home from './pages/Home'
import LoginExperience from './components/LoginExperience'
import WorkspaceNavigation from './components/WorkspaceNavigation'
import { MotionRegion } from './components/DesignSystem'
import Drafts from './pages/Drafts'
import DraftDetails from './pages/DraftDetails'
import AdminPanel from './pages/AdminPanel'
import ReleaseNotesModal from './components/ReleaseNotesModal'
import Security2FAModal from './components/Security2FAModal'
import StepGuideModal from './components/StepGuideModal'
import { testETAAuth, getCompanySettings, saveCompanySettings, syncUserData, getAuthSecurityStatus, warmUpServer } from './services/api'
import { getWarehouseAccess } from './services/warehouseApi'
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from './firebase'
import ErrorBoundary from './components/ErrorBoundary'
import packageInfo from '../package.json'
import { readTheme, saveTheme, nextTheme, startThemeTransition } from './utils/theme.mjs'
import { googleLoginError } from './utils/authError.mjs'

export const CURRENT_APP_VERSION = `v${packageInfo.version}`

// bilingual context
export const AppContext = createContext(null)
export const SettingsContext = createContext(null)

export const TRANSLATIONS = {
  ar: {
    logo: `فاوتر إكس ${CURRENT_APP_VERSION}`,
    logoSub: 'بديل ERP system لرفع الفواتير',
    badge: 'بوابة الإنتاج',
    navHome: 'لوحة التحكم',
    navCreate: 'رفع ملفات إكسيل',
    navDrafts: 'المسودات الموقوفة',
    navSettings: 'إعدادات الشركة',
    navWarehouse: 'المخزون',
    navAdmin: 'لوحة الأدمن',
    logout: 'خروج',
    footer: 'منصة فاوتر إكس لرفع الفواتير الإلكترونية المعتمدة · خوادم مصلحة الضرائب المصرية',
    loginTitle: 'تسجيل الدخول إلى FawterX',
    loginSubtitle: 'المنصة الخفيفة المعتمدة لرفع فواتير الضرائب المصرية بجوجل فقط',
    googleBtn: 'المتابعة باستخدام Google',
    settingsTitle: 'إعدادات ربط شركة الضرائب (ETA)',
    settingsSubtitle: 'أدخل مفاتيح الربط لتشفيرها وحفظها محلياً لكل مستخدم للاتصال المباشر',
    clientId: 'معرف العميل (Client ID)',
    secret1: 'السر الأول المعتمد (Secret 1)',
    secret2: 'السر الثاني المعتمد (Secret 2)',
    saveBtn: 'حفظ الإعدادات في حسابي',
    testBtn: 'اختبار الاتصال',
    verifiedBadge: 'المفاتيح معتمدة وشغالة 100%',
    unverifiedBadge: 'المفاتيح غير مختبرة أو لم تُحفظ',
    testingBadge: 'جاري اختبار المفاتيح مع ETA...',
    errEmpty: 'يرجى إدخال جميع الحقول بما فيها المفتاحين الأول والثاني',
    errConnect: 'فشل الاتصال: تأكد من صحة Client ID و السر 1 و السر 2 ومن اتصالك بالإنترنت',
    successSave: 'تم حفظ الإعدادات بنجاح وتفعيل التشفير لحسابك!',
    successTest: 'تم الاتصال بخوادم مصلحة الضرائب بنجاح!',
    securitySection: 'حماية وأمان الحساب (المصادقة الثنائية 2FA)',
    securitySubtitle: 'تأمين الحساب برمز تحقق إضافي يرسل عبر البريد الإلكتروني لمنع الوصول غير المصرح به',
    twoFactorStatus: 'حالة المصادقة الثنائية (2FA)',
    twoFactorActive: 'مفعلة ونشطة',
    twoFactorDisabled: 'معطلة',
    disable2FABtn: 'تعطيل المصادقة الثنائية',
    enable2FABtn: 'تفعيل المصادقة الثنائية',
    sendCodeBtn: 'إرسال رمز التفعيل',
    verifyCodeBtn: 'تأكيد الرمز والتفعيل',
    otpPlaceholder: 'أدخل رمز الـ OTP المكون من 6 أرقام',
  },
  en: {
    logo: `FawterX ${CURRENT_APP_VERSION}`,
    logoSub: 'Fast ERP Alternative for Tax Invoices',
    badge: 'Production Portal',
    navHome: 'Dashboard',
    navCreate: 'Batch Excel Upload',
    navDrafts: 'Suspended Drafts',
    navSettings: 'Company Settings',
    navWarehouse: 'Warehouse',
    navAdmin: 'Admin Panel',
    logout: 'Logout',
    footer: 'FawterX Platform for Official E-Invoicing · Egyptian Tax Authority Servers',
    loginTitle: 'Sign In to FawterX',
    loginSubtitle: 'Lightweight Certified Tax Invoice Platform with Google Auth',
    googleBtn: 'Continue with Google',
    settingsSubtitle: 'Store your encrypted portal secrets locally for direct secure API submissions',
    clientId: 'Client ID',
    secret1: 'Client Secret 1',
    secret2: 'Client Secret 2',
    actCode: 'Taxpayer Activity Code',
    testConn: 'Test Direct Connection',
    saveConn: 'Save & Encrypt Keys',
    etaConnected: '✅ ETA Authorization Connected',
    etaFailed: '❌ Authorization Failed: Check Keys',
    welcomeHeader: 'Smart Digital ETA Invoicing Automation ⚡',
    welcomeSub: 'The lightest and fastest way to transform raw Excel sheets into officially compliant, digitally signed invoices directly sent to the Egyptian Tax Authority portal with 100% compliance score.',
    welcomeCTA: 'Start Processing Invoices',
    recentSubmissions: 'Recent Submissions',
    statsTitle: 'Analytics Hub'
  }
}

export function Layout({ children }) {
  const { lang, setLang, theme, toggleTheme, t, user, isAdmin, hasWarehouseAccess, handleLogout, triggerReset, showTutorialModal, setShowTutorialModal } = useContext(AppContext)
  const location = useLocation()
  const navigate = useNavigate()
  const handleLogoClick = (e) => {
    if (e?.preventDefault) e.preventDefault();
    setMobileMenuOpen(false);
    triggerReset?.();
    if (location.pathname !== '/') {
      navigate('/');
    }
  };
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showReleaseNotesModal, setShowReleaseNotesModal] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Settings State
  const [settings, setSettings] = useState({
    clientId: '',
    clientSecret1: '',
    clientSecret2: '',
    taxpayerActivityCode: '6209'
  })
  const [testing, setTesting] = useState(false)
  const [connStatus, setConnStatus] = useState(null) // 'connected' or 'failed'
  const [saving, setSaving] = useState(false)

  // Load settings immediately from local storage for fast UI, then sync with Firestore
  useEffect(() => {
    if (!user) {
      setSettings({
        clientId: '',
        clientSecret1: '',
        clientSecret2: '',
        taxpayerActivityCode: '6209'
      })
      return
    }

    const saved = localStorage.getItem('companySettings')
    if (saved) {
      try { setSettings(JSON.parse(saved)) } catch (e) { }
    }

    getCompanySettings()
      .then((res) => {
        let finalSettings = null;
        if (res && res.success && res.settings) {
          finalSettings = res.settings;
          setSettings(res.settings)
          localStorage.setItem('companySettings', JSON.stringify(res.settings))
        } else if (saved) {
          try { finalSettings = JSON.parse(saved); } catch (e) { }
        }

        if (finalSettings && finalSettings.clientId && (finalSettings.clientSecret1 || finalSettings.clientSecret2)) {
          testETAAuth(finalSettings, true)
            .then(() => {
              setSettings(prev => {
                const next = { ...finalSettings, isVerified: true }
                localStorage.setItem('companySettings', JSON.stringify(next))
                return next
              })
            })
            .catch((err) => {
              console.warn('Background ETA verification check completed.', err?.message || err)
            })
        }
      })
      .catch(() => { })
  }, [user])

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value, isVerified: false }))
    setConnStatus(null)
  }

  async function handleTestConnection() {
    setTesting(true)
    setConnStatus(null)
    try {
      await testETAAuth(settings)
      setConnStatus('connected')
      toast.success(t.etaConnected)
      setSettings(prev => ({ ...prev, isVerified: true }))
    } catch (err) {
      setConnStatus('failed')
      const msg = err.response?.data?.message || err.message || t.etaFailed
      toast.error(msg)
      setSettings(prev => ({ ...prev, isVerified: false }))
    } finally {
      setTesting(false)
    }
  }

  async function handleSaveSettings() {
    if (!settings.isVerified) {
      toast.error(lang === 'ar' ? 'يجب اختبار Client ID و Secret 1 و Secret 2 بنجاح قبل حفظ الإعدادات.' : 'Please successfully test the Client ID, Secret 1, and Secret 2 before saving.')
      return
    }
    setSaving(true)
    try {
      localStorage.setItem('companySettings', JSON.stringify(settings))
      if (user) {
        await saveCompanySettings(settings)
      }
      toast.success(lang === 'ar' ? 'تم حفظ وتزامن إعداداتك بأمان في حسابك' : 'Settings saved and synced securely in your account')
      setShowSettingsModal(false)
    } catch (e) {
      toast.error(lang === 'ar' ? 'فشل حفظ الإعدادات في الحساب' : 'Failed to save settings to account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`app-wrapper ${lang === 'en' ? 'ltr-layout' : ''}`}>
      <WorkspaceNavigation
        lang={lang} setLang={setLang} theme={theme} onToggleTheme={toggleTheme} user={user} isAdmin={isAdmin}
        hasWarehouseAccess={hasWarehouseAccess} onHome={handleLogoClick}
        onSettings={() => setShowSettingsModal(true)}
        onGuide={() => setShowTutorialModal(true)}
        onReleases={() => setShowReleaseNotesModal(true)} onLogout={handleLogout}
        open={mobileMenuOpen} setOpen={setMobileMenuOpen} version={CURRENT_APP_VERSION}
      />
      {/* ─── Main Content Wrapper ─── */}
      <main id="workspace-content" className="main-content-flow" tabIndex={-1}>
        {import.meta.env.DEV && import.meta.env.VITE_ACCOUNT_PREVIEW === '1' && <div className="fx-preview-banner" role="status">{lang === 'ar' ? 'تجربة محلية بحساب حقيقي · البيانات من حسابك · قراءة فقط بدون حفظ أو إرسال' : 'Local real-account preview · Your account data · Read-only, saving and submissions disabled'}</div>}
        {import.meta.env.DEV && import.meta.env.VITE_ACCOUNT_PREVIEW !== '1' && import.meta.env.VITE_DESIGN_PREVIEW === '1' && <div className="fx-preview-banner" role="status">{lang === 'ar' ? 'معاينة تصميم محلية · كل الأرصدة بيانات تجريبية · الحفظ والإرسال غير متاحين' : 'Local design preview · All balances are sample data · Saving and submissions are disabled'}</div>}
        <SettingsContext.Provider value={settings}>
          <MotionRegion key={location.pathname} className="fx-route-content" motionKey={location.pathname}>{children}</MotionRegion>
        </SettingsContext.Provider>
      </main>

      {/* ─── Breathtaking Footer ─── */}
      <footer className="main-footer">
        <div className="footer-gradient-bar"></div>
        <p>{t.footer}</p>
      </footer>

      {/* ─── Premium Settings Modal ─── */}
      {showSettingsModal && (
        <div className="modal-backdrop glassmorphism-heavy">
          <div className="modal-card animate-zoom">
            <div className="modal-header">
              <h3>⚙️ {t.settingsTitle}</h3>
              <button className="btn-close-modal" onClick={() => setShowSettingsModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p className="modal-desc-sub">{t.settingsSubtitle}</p>

              <div className="form-group-grid">
                <div className="input-field-wrapper">
                  <label>{t.clientId}</label>
                  <input
                    type="text"
                    value={settings.clientId}
                    onChange={(e) => updateSetting('clientId', e.target.value)}
                    placeholder="e.g. c892db2c-8aa8..."
                  />
                </div>

                <div className="input-field-wrapper">
                  <label>{t.secret1}</label>
                  <input
                    type="password"
                    value={settings.clientSecret1}
                    onChange={(e) => updateSetting('clientSecret1', e.target.value)}
                    placeholder="••••••••••••••••"
                  />
                </div>

                <div className="input-field-wrapper">
                  <label>{t.secret2}</label>
                  <input
                    type="password"
                    value={settings.clientSecret2}
                    onChange={(e) => updateSetting('clientSecret2', e.target.value)}
                    placeholder="••••••••••••••••"
                  />
                </div>

                <div className="input-field-wrapper">
                  <label>{t.actCode}</label>
                  <input
                    type="text"
                    value={settings.taxpayerActivityCode}
                    onChange={(e) => updateSetting('taxpayerActivityCode', e.target.value)}
                    placeholder="e.g. 6209"
                  />
                </div>
              </div>

              {connStatus === 'connected' && (
                <div className="status-banner success-banner">
                  {t.etaConnected}
                </div>
              )}

              {connStatus === 'failed' && (
                <div className="status-banner error-banner">
                  {t.etaFailed}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={handleTestConnection} disabled={testing || saving}>
                {testing ? <span className="spinner"></span> : '⚡ ' + t.testConn}
              </button>
              <button className="btn btn-primary" onClick={handleSaveSettings} disabled={testing || saving}>
                {saving ? <span className="spinner"></span> : '💾 ' + t.saveConn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Release Notes Modal */}
      <ReleaseNotesModal
        isOpen={showReleaseNotesModal}
        onClose={() => setShowReleaseNotesModal(false)}
        lang={lang}
        hasWarehouseAccess={hasWarehouseAccess || isAdmin}
      />

      {/* Step Guide Modal (Global Access) */}
      <StepGuideModal
        isOpen={showTutorialModal}
        onClose={() => setShowTutorialModal(false)}
        lang={lang}
      />
    </div>
  )
}

const Warehouse = lazy(() => import('./pages/Warehouse'))
const DesignShowcase = lazy(() => import('./pages/DesignShowcase'))
export default function App() {
  if (import.meta.env.DEV && window.location.pathname === '/design-showcase') {
    return <Suspense fallback={<div className="card">جاري تحميل معرض الشاشات…</div>}><DesignShowcase translations={TRANSLATIONS} /></Suspense>
  }
  return <AccountApp />
}

function AccountApp() {
  const [loginError, setLoginError] = useState('')
  const [lang, setLang] = useState('ar')
  const [theme, setTheme] = useState(() => readTheme())
  const toggleTheme = (event) => {
    startThemeTransition(event)
    setTheme(current => nextTheme(current))
  }
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    saveTheme(theme)
  }, [theme])
  const [user, setUser] = useState(null)
  const [hasWarehouseAccess, setHasWarehouseAccess] = useState(false)
  const [loadingAuth, setLoadingAuth] = useState(true)
  const [resetTrigger, setResetTrigger] = useState(0)
  const triggerReset = () => setResetTrigger(prev => prev + 1)
  const [show2FAModal, setShow2FAModal] = useState(false)
  const [totpSetup, setTotpSetup] = useState({ needsSetup: false, qrCode: '', secretText: '' })
  const [showTutorialModal, setShowTutorialModal] = useState(() => {
    return !localStorage.getItem('fawterx_tutorial_seen')
  })

  const t = TRANSLATIONS[lang]
  const isAdmin = (user?.email || '').toLowerCase() === 'gemy.essam.ge@gmail.com'

  useEffect(() => {
    // 2FA temporarily disabled for seamless direct login
    setShow2FAModal(false)
  }, [user])

  useEffect(() => {
    if (user) {
      if (isAdmin) {
        setHasWarehouseAccess(true)
      } else {
        getWarehouseAccess()
          .then((res) => setHasWarehouseAccess(!!(res && res.enabled)))
          .catch(() => setHasWarehouseAccess(false))
      }
    } else {
      setHasWarehouseAccess(false)
    }
  }, [user, isAdmin])

  useEffect(() => {
    const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || import.meta.env.DEV)
    const hasDevBypass = isLocalDev && import.meta.env.VITE_ACCOUNT_PREVIEW !== '1' && localStorage.getItem('fawterx_dev_bypass') === 'true'

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken()
          localStorage.setItem('fawterx_id_token', token)
        } catch (err) {
          console.warn('Could not cache Firebase auth token:', err.message)
        }
        setUser(currentUser)
        syncUserData(currentUser)
      } else if (hasDevBypass) {
        setUser({
          uid: 'dev-local-master-user',
          displayName: 'Gemy (Dev Master)',
          email: 'gemy.essam.ge@gmail.com',
          photoURL: ''
        })
      } else {
        localStorage.removeItem('fawterx_id_token')
        setUser(null)
      }
      setLoadingAuth(false)
    })
    return () => unsubscribe()
  }, [])

  async function handleGoogleLogin() {
    setLoginError('')
    try {
      localStorage.removeItem('fawterx_dev_bypass')
      localStorage.removeItem('useQuickLogin')
      const result = await signInWithPopup(auth, googleProvider)
      await syncUserData(result.user)
      toast.success(lang === 'ar' ? `مرحباً بك ${result.user.displayName}` : `Welcome ${result.user.displayName}`)
    } catch (error) {
      console.error(error)
      const message = googleLoginError(error, lang)
      setLoginError(message)
      toast.error(message, { duration: 8000 })
    }
  }

  async function handleLogout() {
    try {
      localStorage.removeItem('fawterx_dev_bypass')
      localStorage.removeItem('companySettings')
      await signOut(auth)
      setUser(null)
      toast.success(lang === 'ar' ? 'تم تسجيل الخروج بأمان' : 'Logged out safely')
    } catch (error) {
      localStorage.removeItem('fawterx_dev_bypass')
      localStorage.removeItem('companySettings')
      setUser(null)
      toast.success(lang === 'ar' ? 'تم تسجيل الخروج بأمان' : 'Logged out safely')
    }
  }

  if (loadingAuth) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg)' }}><span className="spinner"></span></div>
  }

  return (
    <AppContext.Provider value={{ lang, setLang, theme, toggleTheme, t, user, isAdmin, hasWarehouseAccess, handleLogout, resetTrigger, triggerReset, showTutorialModal, setShowTutorialModal }}>
      <BrowserRouter>
        <Security2FAModal
          isOpen={show2FAModal}
          userEmail={user?.email || ''}
          needsTotpSetup={totpSetup.needsSetup}
          qrCode={totpSetup.qrCode}
          secretText={totpSetup.secretText}
          onLogout={handleLogout}
          onVerifySuccess={() => {
            setShow2FAModal(false)
            toast.success(lang === 'ar' ? 'تم توثيق الجهاز وتأكيد المصادقة بنجاح! 🛡️' : 'Device trusted successfully! 🛡️')
          }}
          lang={lang}
        />
        <Toaster position="bottom-center" toastOptions={{ style: { background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '12px' } }} />

        {!user ? (
          <LoginExperience loginError={loginError} lang={lang} setLang={setLang} theme={theme} onToggleTheme={toggleTheme} t={t} onLogin={handleGoogleLogin}
            onDevLogin={() => {
              const devUser = {
                uid: 'dev-local-master-user', displayName: 'Gemy (Dev Master)',
                email: 'gemy.essam.ge@gmail.com', photoURL: ''
              }
              localStorage.setItem('fawterx_dev_bypass', 'true')
              setUser(devUser)
              toast.success(lang === 'ar' ? 'تم تخطي الدخول كمسؤول للتطوير المحلي 🛠️' : 'Dev Master Bypass Activated 🛠️')
            }}
          />
        ) : (
          <Layout>
            <ErrorBoundary isAr={lang === 'ar'}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/drafts" element={<Drafts />} />
              <Route path="/drafts/:id" element={<DraftDetails />} />
              <Route path="/warehouse" element={hasWarehouseAccess ? <Suspense fallback={<div className="card" role="status">{lang === 'ar' ? 'جاري تحميل المخزون…' : 'Loading warehouse…'}</div>}><Warehouse /></Suspense> : (
                <div className="card fade-in" style={{ padding: '2rem' }}>
                  <h2 className="card-title">{lang === 'ar' ? 'غير مصرح بالوصول' : 'Access Denied'}</h2>
                  <p className="card-sub" style={{ marginBottom: 0 }}>
                    {lang === 'ar'
                      ? 'صفحة المخازن مخصصة للمسؤولين والمستخدمين المصرح لهم فقط.'
                      : 'Warehouse access is restricted to authorized users.'}
                  </p>
                </div>
              )} />
              {import.meta.env.DEV && <Route path="/design-showcase" element={<Suspense fallback={<div className="card">جاري تحميل معرض الشاشات…</div>}><DesignShowcase translations={TRANSLATIONS} /></Suspense>} />}
              <Route path="/admin" element={isAdmin ? <AdminPanel /> : (
                <div className="card fade-in" style={{ padding: '2rem' }}>
                  <h2 className="card-title">Access Denied</h2>
                  <p className="card-sub" style={{ marginBottom: 0 }}>
                    {lang === 'ar'
                      ? 'هذه الصفحة محجوبة لحساب الإدارة المعتمد فقط.'
                      : 'This page is restricted to the approved administrator account only.'}
                  </p>
                </div>
              )} />
            </Routes>
            </ErrorBoundary>
          </Layout>
        )}
      </BrowserRouter>
    </AppContext.Provider>
  )
}
