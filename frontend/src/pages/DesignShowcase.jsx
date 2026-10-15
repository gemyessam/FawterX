import { useEffect, useState } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AppContext, SettingsContext } from '../App'
import Home from './Home'
import Drafts from './Drafts'
import DraftDetails from './DraftDetails'
import Warehouse from './Warehouse'
import AdminPanel from './AdminPanel'
import LoginExperience from '../components/LoginExperience'
import UploadStep from '../components/UploadStep'
import MappingStep from '../components/MappingStep'
import PreviewStep from '../components/PreviewStep'
import BatchWorkflow from '../components/BatchWorkflow'
import DispatchesTrackerView from '../components/DispatchesTrackerView'
import ManualStockModal from '../components/ManualStockModal'
import StepGuideModal from '../components/StepGuideModal'
import ReleaseNotesModal from '../components/ReleaseNotesModal'
import Security2FAModal from '../components/Security2FAModal'
import ErrorBoundary from '../components/ErrorBoundary'
import ThemeToggle from '../components/ThemeToggle'
import { EmptyIllustration } from '../components/DesignSystem'
import { readTheme, saveTheme, nextTheme, startThemeTransition } from '../utils/theme.mjs'
import { sampleDocument, sampleUpload, sampleValidation } from '../../showcase-data.mjs'
import { stock } from '../../design-preview.mjs'

export const showcaseScreens = [
  ['warehouse-history','سجل حركات المخزون'],['warehouse-upload','رفع فواتير المخزون'],['warehouse-projects','مشروعات المخزون'],['warehouse-users','صلاحيات المخزون'],['warehouse-audit','سجل المراجعة'],['warehouse-restore_points','نقاط الاستعادة'],
  ['dashboard','الرئيسية'],['login','تسجيل الدخول'],['upload','رفع الملفات'],['mapping','ربط الأعمدة'],['preview','معاينة الفاتورة'],['batch','مراجعة الدفعات'],['drafts','المسودات'],['details','تفاصيل المسودة'],['warehouse','المخزون'],['tracking','تتبع الصرف'],['inbound','نافذة التوريد'],['outbound','نافذة الصرف'],['admin','الإدارة'],['settings','إعدادات الشركة'],['guide','دليل الاستخدام'],['releases','سجل التحديثات'],['security','التحقق بخطوتين'],['empty','حالة فارغة'],['loading','حالة تحميل'],['error','حالة خطأ'],
]
const noop = () => {}
const screens = showcaseScreens
const demoUser = { uid:'design-showcase-user', email:'preview@example.invalid', displayName:'حساب تصميم تجريبي' }
const demoSettings = { clientId:'', clientSecret1:'', clientSecret2:'', taxpayerActivityCode:'6209', isVerified:false }

export default function DesignShowcase({ translations, initialScreen = 'dashboard' }) {
  const [screen, setScreen] = useState(initialScreen)
  const [theme, setTheme] = useState(readTheme)
  const [lang, setLang] = useState('ar')
  const close = () => setScreen('dashboard')
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; saveTheme(theme) }, [theme])
  const t = translations[lang]
  const context = { lang, setLang, theme, toggleTheme:(event) => { startThemeTransition(event); setTheme(nextTheme) }, t, user:demoUser, isAdmin:true, hasWarehouseAccess:true, resetTrigger:0, triggerReset:noop, showTutorialModal:false, setShowTutorialModal:noop, handleLogout:noop }
  const route = screen === 'details' ? '/drafts/design-draft' : '/'
  let content
  switch (screen) {
    case 'login': content = <LoginExperience lang={lang} setLang={setLang} theme={theme} onToggleTheme={context.toggleTheme} t={t} onLogin={noop} onDevLogin={noop} />; break
    case 'upload': content = <UploadStep onSuccess={noop} />; break
    case 'mapping': content = <MappingStep uploadResult={sampleUpload} onConfirm={noop} onBack={noop} />; break
    case 'preview': content = <PreviewStep uploadResult={sampleUpload} mapping={{}} onBack={noop} designPreview={{ documents:[sampleDocument], validation:sampleValidation }} />; break
    case 'batch': content = <BatchWorkflow lang={lang} t={t} fetchUsage={noop} designDocuments={[sampleDocument]} />; break
    case 'drafts': content = <Drafts />; break
    case 'details': content = <Routes><Route path="/drafts/:id" element={<DraftDetails />} /><Route path="/drafts" element={<Drafts />} /></Routes>; break
    case 'warehouse': content = <Warehouse />; break
    case 'warehouse-history': case 'warehouse-upload': case 'warehouse-projects': case 'warehouse-users': case 'warehouse-audit': case 'warehouse-restore_points': content = <Warehouse designTab={screen.replace('warehouse-','')} />; break
    case 'tracking': content = <DispatchesTrackerView projectId="design-demo" projectName="مشروع تجريبي" isAdmin isAr={lang === 'ar'} onOpenManualModal={noop} />; break
    case 'inbound': case 'outbound': content = <ManualStockModal isOpen onClose={close} initialMode={screen} projectId="design-demo" projectName="مشروع تجريبي" stock={stock} onSuccess={noop} isAr={lang === 'ar'} />; break
    case 'admin': content = <AdminPanel designPreview />; break
    case 'settings': content = <div className="modal-card"><header className="modal-header"><h3>إعدادات الشركة · بيانات تجريبية</h3></header><div className="modal-body">{['Client ID','Client Secret 1','Client Secret 2','Taxpayer Activity Code'].map(label => <div className="input-field-wrapper" key={label}><label>{label}</label><input placeholder="بيانات تجريبية فقط" /></div>)}</div><footer className="modal-footer"><button className="btn btn-ghost">اختبار الاتصال</button><button className="btn btn-primary">حفظ الإعدادات</button></footer></div>; break
    case 'guide': content = <StepGuideModal isOpen onClose={close} lang={lang} />; break
    case 'releases': content = <ReleaseNotesModal isOpen onClose={close} lang={lang} hasWarehouseAccess />; break
    case 'security': content = <Security2FAModal isOpen userEmail={demoUser.email} onVerifySuccess={noop} onLogout={close} lang={lang} />; break
    case 'empty': content = <div className="card" style={{ padding:60, textAlign:'center' }}><EmptyIllustration /><h2>لسه مفيش مستندات</h2><p className="card-sub">أول ملف هتضيفه هيظهر هنا، جاهز للمراجعة والمتابعة.</p><button className="btn btn-primary">إضافة أول ملف</button></div>; break
    case 'loading': content = <div className="card" style={{ padding:60, textAlign:'center' }}><span className="spinner" /><h2>بنجهّز مساحة العمل</h2><p className="card-sub">جاري تحميل المستندات والبيانات.</p></div>; break
    case 'error': content = <div className="card fx-error-state" style={{ textAlign:'center' }}><h2>تعذّر تحميل البيانات</h2><p className="card-sub">تحقق من اتصالك، ثم جرّب تاني.</p><button className="btn btn-secondary">إعادة المحاولة</button></div>; break
    default: content = <Home />
  }
  const interactiveGuide = screen === 'guide' || screen === 'releases'
  return <AppContext.Provider value={context}><SettingsContext.Provider value={demoSettings}>
    <div className="fx-showcase" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <header className="fx-showcase-toolbar"><div><span className="fx-eyebrow">DESIGN / SCREEN EXPLORER</span><h1>كل الشاشات، في مكان واحد.</h1><p>معاينة لوكال · بيانات تجريبية منفصلة · إجراءات الحفظ والتوقيع والإرسال معطّلة.</p></div><div style={{ display:'flex',gap:10 }}><ThemeToggle theme={theme} onToggle={context.toggleTheme} lang={lang} /><button className="btn btn-ghost" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'EN' : 'عربي'}</button><a className="btn btn-ghost" href="/" onClick={(e) => { e.preventDefault(); if (window.location.pathname !== '/') { window.history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); } }}>العودة للموقع</a></div></header>
      <div className="fx-showcase-layout"><nav className="fx-showcase-menu" aria-label="شاشات المعاينة">{screens.map(([id,label],idx) => <button key={id} aria-current={screen === id ? 'page' : undefined} onClick={() => setScreen(id)}>{String(idx+1).padStart(2,'0')} / {label}</button>)}</nav>
      <section className="fx-showcase-stage"><h2>{screens.find(([id]) => id === screen)?.[1]} <small>— معاينة</small></h2><MemoryRouter key={screen} initialEntries={[route]}><ErrorBoundary>{interactiveGuide ? content : <fieldset disabled className="fx-showcase-readonly">{content}</fieldset>}</ErrorBoundary></MemoryRouter>{['inbound','outbound','security'].includes(screen) && <button className="btn btn-secondary" style={{ position:'fixed', bottom:12, left:12, zIndex:100001 }} onClick={close}>إغلاق المعاينة</button>}</section></div>
    </div>
  </SettingsContext.Provider></AppContext.Provider>
}
