import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import Home from './pages/Home'
import Drafts from './pages/Drafts'
import DraftDetails from './pages/DraftDetails'
import AdminPanel from './pages/AdminPanel'
import Warehouse from './pages/Warehouse'
import ReleaseNotesModal from './components/ReleaseNotesModal'
import Security2FAModal from './components/Security2FAModal'
import StepGuideModal from './components/StepGuideModal'
import { testETAAuth, getCompanySettings, saveCompanySettings, syncUserData, getAuthSecurityStatus } from './services/api'
import { getWarehouseAccess } from './services/warehouseApi'
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from './firebase'

// bilingual context
export const AppContext = createContext(null)
export const SettingsContext = createContext(null)

const TRANSLATIONS = {
  ar: {
    logo: 'فاوتر إكس v2.27.21',
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
    actCode: 'نشاط الشركة (Taxpayer Activity Code)',
    testConn: 'اختبار الاتصال المباشر',
    saveConn: 'حفظ المفاتيح والتحديث',
    etaConnected: '✅ متصل بـ ETA بنجاح',
    etaFailed: '❌ بيانات الربط غير صالحة',
    welcomeHeader: 'التحول الرقمي لرفع الفواتير الإلكترونية بذكاء ⚡',
    welcomeSub: 'أبسط وأسرع منصة ذكية لتحويل ملفات Excel المعقدة إلى فواتير معتمدة رسمياً ومرفوعة تلقائياً لمنظومة مصلحة الضرائب المصرية بمعدل امتثال 100%.',
    welcomeCTA: 'ابدأ تحويل الفواتير الآن',
    recentSubmissions: 'آخر التقديمات',
    statsTitle: 'إحصائيات الأداء'
  },
  en: {
    logo: 'FawterX v2.27.21',
    logoSub: 'ERP Alternative for ETA Invoices',
    badge: 'Production Portal',
    navHome: 'Dashboard',
    navCreate: 'Excel Auto',
    navDrafts: 'Saved Recovery',
    navSettings: 'Tax Settings',
    navWarehouse: 'Warehouse',
    navAdmin: 'Admin Panel',
    logout: 'Logout',
    footer: 'FawterX Automation Platform · Egyptian Tax Authority Server Compliant',
    loginTitle: 'Sign in to FawterX Portal',
    loginSubtitle: 'Official lightweight platform for ETA compliance with 1-click Google auth',
    googleBtn: 'Continue with Google',
    settingsTitle: 'Egyptian Tax Authority (ETA) Credentials',
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

function Layout({ children }) {
  const { lang, setLang, t, user, isAdmin, hasWarehouseAccess, handleLogout, triggerReset, showTutorialModal, setShowTutorialModal } = useContext(AppContext)
  const location = useLocation()
  const handleLogoClick = (e) => {
    e.preventDefault();
    window.location.href = '/';
  };
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [showReleaseNotesModal, setShowReleaseNotesModal] = useState(false)

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
      try { setSettings(JSON.parse(saved)) } catch (e) {}
    }

    getCompanySettings()
      .then((res) => {
        let finalSettings = null;
        if (res && res.success && res.settings) {
          finalSettings = res.settings;
          setSettings(res.settings)
          localStorage.setItem('companySettings', JSON.stringify(res.settings))
        } else if (saved) {
          try { finalSettings = JSON.parse(saved); } catch (e) {}
        }

        if (finalSettings && finalSettings.clientId && finalSettings.clientSecret1 && finalSettings.clientSecret2) {
          testETAAuth(finalSettings)
            .then(() => {
              setSettings(prev => {
                const next = { ...finalSettings, isVerified: true }
                localStorage.setItem('companySettings', JSON.stringify(next))
                return next
              })
            })
            .catch((err) => {
              console.warn('Background ETA verification failed or timed out. Keeping existing verified status.', err)
            })
        }
      })
      .catch(() => {})
  }, [user])

  useEffect(() => {
    if (!showUserDropdown) return;
    const closeDropdown = (e) => {
      if (!e.target.closest('.user-profile-widget')) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('click', closeDropdown);
    return () => document.removeEventListener('click', closeDropdown);
  }, [showUserDropdown]);

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
      {/* ─── Modern Premium Header ─── */}
      <header className="header glassmorphism">
        <Link to="/" onClick={handleLogoClick} style={{ textDecoration: 'none', color: '#fff', display: 'flex', alignItems: 'center' }}>
          <div className="header-brand" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="header-logo-icon" style={{ display: 'flex', alignItems: 'center' }}>
              <img src="/Logo.png" alt="Logo" style={{ height: '36px', objectFit: 'contain' }} />
            </div>
            <div className="header-logo-text">
              <h2>{t.logo}</h2>
              <span>{t.logoSub}</span>
            </div>
            <span className="premium-badge">{t.badge}</span>

            {/* Permanent Green Slogan Badge & Changelog Trigger */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowReleaseNotesModal(true)
              }}
              style={{
                background: 'rgba(0, 224, 161, 0.08)',
                color: '#00e0a1',
                border: '1px solid rgba(0, 224, 161, 0.25)',
                borderRadius: '20px',
                padding: '0.2rem 0.65rem',
                fontSize: '0.76rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                marginLeft: '0.5rem',
                boxShadow: '0 0 12px rgba(0, 224, 161, 0.12)'
              }}
              title={lang === 'ar' ? 'اضغط لعرض سجل التحديثات والإصدارات' : 'Click to view version release history'}
            >
              <span>⚡ {lang === 'ar' ? 'منصة رفع الفواتير الرقمية المعتمدة' : 'Certified ETA Invoice Platform'}</span>
              <span style={{ background: 'rgba(0, 224, 161, 0.2)', color: '#00e0a1', padding: '0.1rem 0.4rem', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 800 }}>
                v2.27.21 ✨
              </span>
            </button>
          </div>
        </Link>

        <nav className="header-nav">
          <Link to="/" onClick={handleLogoClick} className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>{t.navHome}</Link>
          <Link to="/drafts" className={`nav-link ${location.pathname.includes('/drafts') ? 'active' : ''}`}>{t.navDrafts}</Link>
          {hasWarehouseAccess && (
            <Link to="/warehouse" className={`nav-link ${location.pathname.includes('/warehouse') ? 'active' : ''}`}>
              📦 {t.navWarehouse || (lang === 'ar' ? 'المخزون' : 'Warehouse')}
            </Link>
          )}
          {isAdmin && (
            <Link to="/admin" className={`nav-link ${location.pathname.includes('/admin') ? 'active' : ''}`}>{t.navAdmin || (lang === 'ar' ? 'لوحة الأدمن' : 'Admin Panel')}</Link>
          )}
          <button type="button" className="nav-link" onClick={() => setShowTutorialModal(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.5rem 0.75rem', fontWeight: 600 }}>
            💡 {lang === 'ar' ? 'دليل الخطوات' : 'Step Guide'}
          </button>
          <button className="nav-link btn-settings-trigger" onClick={() => setShowSettingsModal(true)}>
            ⚙️ {t.navSettings}
          </button>
        </nav>

        <div className="header-actions">
          <button className="lang-toggle-btn" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
            🌐 {lang === 'ar' ? 'English' : 'العربية'}
          </button>
          
          {user && (() => {
            const isMaster = user.email === 'gemy.essam.ge@gmail.com';
            return (
              <div 
                className={`user-profile-widget ${isMaster ? 'master-gm-widget' : ''}`}
                onClick={() => setShowUserDropdown(!showUserDropdown)}
              >
                <div 
                  className={`user-avatar ${isMaster ? 'master-gm-avatar' : ''}`}
                  style={{ 
                    backgroundImage: user.photoURL ? `url(${user.photoURL})` : 'none', 
                    backgroundSize: 'cover',
                    position: 'relative'
                  }}
                >
                  {!user.photoURL && (user.displayName?.slice(0, 2).toUpperCase() || 'US')}
                  {isMaster && (
                    <span className="master-crown-icon">
                      👑
                    </span>
                  )}
                </div>
                <div className={`user-info-dropdown ${showUserDropdown ? 'show-dropdown' : ''}`}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#ffffff', whiteSpace: 'nowrap' }}>
                      {user.displayName || 'SaaS User'}
                    </h4>
                    {isMaster && (
                      <span className="master-gm-badge">
                        MASTER GM 👑
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255, 215, 0, 0.85)', marginBottom: '0.85rem' }}>
                    {user.email}
                  </p>
                  <button className="btn-logout" onClick={(e) => { e.stopPropagation(); handleLogout(); }}>{t.logout} 🚪</button>
                </div>
              </div>
            );
          })()}
        </div>
      </header>

      {/* ─── Main Content Wrapper ─── */}
      <main className="main-content-flow">
        <SettingsContext.Provider value={settings}>
          {children}
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

export default function App() {
  const [lang, setLang] = useState('ar')
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
      } else {
        localStorage.removeItem('fawterx_id_token')
        setUser(null)
      }
      setLoadingAuth(false)
    })
    return () => unsubscribe()
  }, [])

  async function handleGoogleLogin() {
    try {
      const result = await signInWithPopup(auth, googleProvider)
      await syncUserData(result.user)
      toast.success(lang === 'ar' ? `مرحباً بك ${result.user.displayName}` : `Welcome ${result.user.displayName}`)
    } catch (error) {
      console.error(error)
      toast.error(lang === 'ar' 
        ? 'فشل تسجيل الدخول بواسطة Google: يرجى التحقق من إعدادات المتصفح أو الاتصال بالدعم' 
        : 'Sign in failed via Google: Please verify your browser popup block settings')
    }
  }

  async function handleLogout() {
    try {
      localStorage.removeItem('companySettings')
      await signOut(auth)
      setUser(null)
      toast.success(lang === 'ar' ? 'تم تسجيل الخروج بأمان' : 'Logged out safely')
    } catch (error) {
      localStorage.removeItem('companySettings')
      setUser(null)
      toast.success(lang === 'ar' ? 'تم تسجيل الخروج بأمان' : 'Logged out safely')
    }
  }

  if (loadingAuth) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg)' }}><span className="spinner"></span></div>
  }

  return (
    <AppContext.Provider value={{ lang, setLang, t, user, isAdmin, hasWarehouseAccess, handleLogout, resetTrigger, triggerReset, showTutorialModal, setShowTutorialModal }}>
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
        <Toaster position="bottom-center" toastOptions={{ style: { background: '#101223', color: '#e8eaf6', border: '1px solid #202442', borderRadius: '12px' } }} />
        
        {!user ? (
          <div className={`auth-full-screen ${lang === 'en' ? 'ltr-layout' : ''}`}>
            <div className="auth-brand-side">
              <div className="brand-side-content">
                <div className="brand-side-logo-icon">
                  <img src="/Logo.png" alt="Logo" style={{ height: '70px', objectFit: 'contain', marginBottom: '1rem' }} />
                </div>
                <h1>{t.logo}</h1>
                <p>{t.welcomeSub}</p>
                <div className="brand-side-features">
                  <div className="feature-item">
                    <span>⚡</span>
                    <div>
                      <h4>Direct Excel Auto-parsing</h4>
                      <p>Import sheets directly without mapping twice</p>
                    </div>
                  </div>
                  <div className="feature-item">
                    <span>🔑</span>
                    <div>
                      <h4>Encrypted Token Security</h4>
                      <p>Your portal keys remain locked in your browser</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="auth-form-side">
              <div className="lang-toggle-auth">
                <button className="lang-toggle-btn" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
                  🌐 {lang === 'ar' ? 'English' : 'العربية'}
                </button>
              </div>

              <div className="auth-form animate-fade-in" style={{ textAlign: 'center' }}>
                <h2 style={{ marginBottom: '1rem' }}>{t.loginTitle}</h2>
                <p className="form-sub-desc" style={{ marginBottom: '2.5rem' }}>{t.loginSubtitle}</p>
                
                <button 
                  type="button" 
                  className="btn btn-primary btn-block btn-lg" 
                  onClick={handleGoogleLogin}
                  style={{ background: '#ffffff', color: '#000000', border: '1px solid #cccccc', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1rem' }}
                >
                  <svg width="24" height="24" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  {t.googleBtn}
                </button>

              </div>
            </div>
          </div>
        ) : (
          <Layout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/drafts" element={<Drafts />} />
              <Route path="/drafts/:id" element={<DraftDetails />} />
              <Route path="/warehouse" element={hasWarehouseAccess ? <Warehouse /> : (
                <div className="card fade-in" style={{ padding: '2rem' }}>
                  <h2 className="card-title">{lang === 'ar' ? 'غير مصرح بالوصول' : 'Access Denied'}</h2>
                  <p className="card-sub" style={{ marginBottom: 0 }}>
                    {lang === 'ar'
                      ? 'صفحة المخازن مخصصة للمسؤولين والمستخدمين المصرح لهم فقط.'
                      : 'Warehouse access is restricted to authorized users.'}
                  </p>
                </div>
              )} />
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
          </Layout>
        )}
      </BrowserRouter>
    </AppContext.Provider>
  )
}
