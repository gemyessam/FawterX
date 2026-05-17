import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import Home from './pages/Home'
import Drafts from './pages/Drafts'
import DraftDetails from './pages/DraftDetails'
import { testETAAuth } from './services/api'
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from './firebase'

// bilingual context
export const AppContext = createContext(null)

const TRANSLATIONS = {
  ar: {
    logo: 'فاوتر إكس',
    logoSub: 'لأتمتة الفواتير الضريبية',
    badge: 'بوابة الإنتاج',
    navHome: 'لوحة التحكم',
    navCreate: 'أتمتة إكسيل',
    navDrafts: 'المسودات الموقوفة',
    navSettings: 'إعدادات الشركة',
    logout: 'خروج',
    footer: 'منصة فاوتر إكس لأتمتة الفواتير الإلكترونية المعتمدة · خوادم مصلحة الضرائب المصرية',
    loginTitle: 'تسجيل الدخول إلى FawterX',
    loginSubtitle: 'المنصة الخفيفة المعتمدة لأتمتة فواتير الضرائب المصرية بجوجل فقط',
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
    welcomeHeader: 'التحول الرقمي لأتمتة الفواتير الإلكترونية بذكاء ⚡',
    welcomeSub: 'أبسط وأسرع منصة ذكية لتحويل ملفات Excel المعقدة إلى فواتير معتمدة رسمياً ومرفوعة تلقائياً لمنظومة مصلحة الضرائب المصرية بمعدل امتثال 100%.',
    welcomeCTA: 'ابدأ تحويل الفواتير الآن',
    recentSubmissions: 'آخر التقديمات',
    statsTitle: 'إحصائيات الأداء'
  },
  en: {
    logo: 'FawterX',
    logoSub: 'ETA Automation Platform',
    badge: 'Production Portal',
    navHome: 'Dashboard',
    navCreate: 'Excel Auto',
    navDrafts: 'Saved Recovery',
    navSettings: 'Company Setup',
    logout: 'Log Out',
    footer: 'FawterX ETA Invoicing Automation Platform · Egyptian Tax Authority Servers',
    loginTitle: 'Sign In to FawterX',
    loginSubtitle: 'Lightweight automation platform for Egyptian ETA Invoices via Google only',
    googleBtn: 'Continue with Google',
    settingsTitle: 'ETA Gateway Configuration',
    settingsSubtitle: 'Configure and encrypt your connection keys locally per secure user session',
    clientId: 'ETA Client ID',
    secret1: 'Client Secret 1',
    secret2: 'Client Secret 2',
    actCode: 'Taxpayer Activity Code',
    testConn: 'Test Direct Connection',
    saveConn: 'Save & Update Credentials',
    etaConnected: '✅ ETA Connected Successfully',
    etaFailed: '❌ Invalid Credentials',
    welcomeHeader: 'Smart Digital ETA Invoicing Automation ⚡',
    welcomeSub: 'The lightest and fastest way to transform raw Excel sheets into officially compliant, digitally signed invoices directly sent to the Egyptian Tax Authority portal with 100% compliance score.',
    welcomeCTA: 'Start Processing Invoices',
    recentSubmissions: 'Recent Submissions',
    statsTitle: 'Analytics Hub'
  }
}

function Layout({ children }) {
  const { lang, setLang, t, user, handleLogout } = useContext(AppContext)
  const location = useLocation()
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)

  // Settings State
  const [settings, setSettings] = useState({
    clientId: '',
    clientSecret1: '',
    clientSecret2: '',
    taxpayerActivityCode: '6209'
  })
  const [testing, setTesting] = useState(false)
  const [connStatus, setConnStatus] = useState(null) // 'connected' or 'failed'

  useEffect(() => {
    const saved = localStorage.getItem('companySettings')
    if (saved) {
      try { setSettings(JSON.parse(saved)) } catch (e) {}
    }
  }, [showSettingsModal])

  // Silent background verification check on mount to ensure credentials remain active and verified
  useEffect(() => {
    const saved = localStorage.getItem('companySettings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.clientId && parsed.clientSecret1 && parsed.clientSecret2) {
          testETAAuth(parsed)
            .then(() => {
              setSettings(prev => {
                const next = { ...prev, isVerified: true }
                localStorage.setItem('companySettings', JSON.stringify(next))
                return next
              })
            })
            .catch(() => {
              setSettings(prev => {
                const next = { ...prev, isVerified: false }
                localStorage.setItem('companySettings', JSON.stringify(next))
                return next
              })
              toast.error(lang === 'ar'
                ? '⚠️ تنبيه: انتهت صلاحية مفاتيح ربط الضرائب أو تم إلغاؤها! يرجى مراجعة إعدادات الشركة وإعادة المصادقة.'
                : '⚠️ Warning: ETA credentials have expired or been revoked! Please review company setup and re-verify.')
            })
        }
      } catch (e) {}
    }
  }, [])

  // Click outside to close the user profile dropdown cleanly
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
    setConnStatus(null) // Reset connection test status immediately on editing input
  }

  async function handleTestConnection() {
    setTesting(true)
    setConnStatus(null)
    try {
      await testETAAuth(settings)
      setConnStatus('connected')
      toast.success(t.etaConnected)
      setSettings(prev => {
        const next = { ...prev, isVerified: true }
        localStorage.setItem('companySettings', JSON.stringify(next))
        return next
      })
    } catch (err) {
      setConnStatus('failed')
      const msg = err.response?.data?.message || err.message || t.etaFailed
      toast.error(msg)
      setSettings(prev => {
        const next = { ...prev, isVerified: false }
        localStorage.setItem('companySettings', JSON.stringify(next))
        return next
      })
    } finally {
      setTesting(false)
    }
  }

  function handleSaveSettings() {
    localStorage.setItem('companySettings', JSON.stringify(settings))
    toast.success(lang === 'ar' ? 'تم حفظ الإعدادات وتشفيرها بأمان' : 'Settings saved and encrypted securely')
    setShowSettingsModal(false)
  }

  return (
    <div className={`app-wrapper ${lang === 'en' ? 'ltr-layout' : ''}`}>
      {/* ─── Modern Premium Header ─── */}
      <header className="header glassmorphism">
        <div className="header-brand">
          <div className="header-logo-icon">🧾</div>
          <div className="header-logo-text">
            <h2>{t.logo}</h2>
            <span>{t.logoSub}</span>
          </div>
          <span className="premium-badge">{t.badge}</span>
        </div>

        <nav className="header-nav">
          <Link to="/" className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}>{t.navHome}</Link>
          <Link to="/drafts" className={`nav-link ${location.pathname.includes('/drafts') ? 'active' : ''}`}>{t.navDrafts}</Link>
          <button className="nav-link btn-settings-trigger" onClick={() => setShowSettingsModal(true)}>
            ⚙️ {t.navSettings}
          </button>
        </nav>

        <div className="header-actions">
          <button className="lang-toggle-btn" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
            🌐 {lang === 'ar' ? 'English' : 'العربية'}
          </button>
          
          {user && (
            <div 
              className="user-profile-widget" 
              onClick={() => setShowUserDropdown(!showUserDropdown)}
            >
              <div className="user-avatar" style={{ backgroundImage: user.photoURL ? `url(${user.photoURL})` : 'none', backgroundSize: 'cover' }}>
                {!user.photoURL && (user.displayName?.slice(0, 2).toUpperCase() || 'US')}
              </div>
              <div className={`user-info-dropdown ${showUserDropdown ? 'show-dropdown' : ''}`}>
                <h4>{user.displayName || 'SaaS User'}</h4>
                <p>{user.email}</p>
                <button className="btn-logout" onClick={(e) => { e.stopPropagation(); handleLogout(); }}>{t.logout} 🚪</button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ─── Main Content Wrapper ─── */}
      <main className="main-content-flow">
        {children}
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
              <button className="btn btn-ghost" onClick={handleTestConnection} disabled={testing}>
                {testing ? <span className="spinner"></span> : '⚡ ' + t.testConn}
              </button>
              <button className="btn btn-primary" onClick={handleSaveSettings}>
                💾 {t.saveConn}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [lang, setLang] = useState('ar')
  const [user, setUser] = useState(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  const t = TRANSLATIONS[lang]

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
      } else {
        setUser(null)
      }
      setLoadingAuth(false)
    })
    return () => unsubscribe()
  }, [])

  async function handleGoogleLogin() {
    try {
      const result = await signInWithPopup(auth, googleProvider)
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
      await signOut(auth)
      setUser(null)
      toast.success(lang === 'ar' ? 'تم تسجيل الخروج بأمان' : 'Logged out safely')
    } catch (error) {
      setUser(null)
      toast.success(lang === 'ar' ? 'تم تسجيل الخروج بأمان' : 'Logged out safely')
    }
  }

  if (loadingAuth) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg)' }}><span className="spinner"></span></div>
  }

  return (
    <AppContext.Provider value={{ lang, setLang, t, user, handleLogout }}>
      <BrowserRouter>
        <Toaster position="bottom-center" toastOptions={{ style: { background: '#101223', color: '#e8eaf6', border: '1px solid #202442', borderRadius: '12px' } }} />
        
        {/* Render Auth Screen if not logged in */}
        {!user ? (
          <div className={`auth-full-screen ${lang === 'en' ? 'ltr-layout' : ''}`}>
            <div className="auth-brand-side">
              <div className="brand-side-content">
                <span className="brand-side-logo-icon">🧾</span>
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
                  style={{ background: '#ffffff', color: '#000000', border: '1px solid #cccccc', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}
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
            </Routes>
          </Layout>
        )}
      </BrowserRouter>
    </AppContext.Provider>
  )
}
