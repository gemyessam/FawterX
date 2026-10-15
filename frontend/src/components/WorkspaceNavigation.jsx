import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, Files, Package, UsersRound, Settings2, BookOpen, History, LogOut, Menu, X, Globe2, ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react'
import { Brand } from './DesignSystem'
import ThemeToggle from './ThemeToggle'

export default function WorkspaceNavigation({ lang, setLang, theme, onToggleTheme, user, isAdmin, hasWarehouseAccess, onHome, onSettings, onGuide, onReleases, onLogout, open, setOpen, version }) {
  const { pathname } = useLocation()
  const ar = lang === 'ar'
  const text = (a, e) => ar ? a : e
  useEffect(() => {
    if (!open) return
    const escape = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [open, setOpen])
  const links = [
    { to: '/', icon: LayoutDashboard, label: text('نظرة عامة', 'Overview') },
    { to: '/drafts', icon: Files, label: text('مسودات الفواتير', 'Invoice drafts') },
    ...(hasWarehouseAccess ? [{ to: '/warehouse', icon: Package, label: text('مساحة المخزون', 'Inventory workspace') }] : []),
    ...(isAdmin ? [{ to: '/admin', icon: UsersRound, label: text('إدارة الحسابات', 'Administration') }] : []),
  ]
  const current = links.find(item => item.to === '/' ? pathname === '/' : pathname.startsWith(item.to))
  const action = callback => { callback(); setOpen(false) }
  return <>
    <a className="fx-skip" href="#workspace-content">{text('انتقل للمحتوى', 'Skip to content')}</a>
    <div className="fx-mobile-bar"><Link to="/" onClick={onHome}><Brand compact /></Link><button type="button" className="fx-icon-button" aria-expanded={open} aria-controls="workspace-navigation" aria-label={text('القائمة الرئيسية', 'Main navigation')} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button></div>
    <aside id="workspace-navigation" className={`fx-sidebar ${open ? 'is-open' : ''}`}>
      <Link to="/" className="fx-sidebar-brand" onClick={onHome}><Brand /></Link>
      <div className="fx-workspace-label"><span className="fx-workspace-avatar">FX</span><div><b>{text('مساحة العمل', 'Workspace')}</b><small>{text('إدارة الفواتير الإلكترونية', 'Electronic invoicing')}</small></div><ChevronLeft size={15} /></div>
      <nav aria-label={text('التنقل الرئيسي', 'Main navigation')}>
        <span className="fx-nav-caption">{text('مساحة عملك', 'YOUR WORKSPACE')}</span>
        {links.map(({ to, icon: Icon, label }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
          return <Link key={to} to={to} aria-current={active ? 'page' : undefined} className={`fx-nav-item ${active ? 'active' : ''}`} onClick={(e) => { setOpen(false); if (to === '/') onHome?.(e); }}><Icon size={19} strokeWidth={1.7} /><span>{label}</span>{active && <i />}</Link>
        })}
        <span className="fx-nav-caption">{text('الأدوات والمساعدة', 'TOOLS & SUPPORT')}</span>
        {import.meta.env.DEV && <Link className="fx-nav-item" to="/design-showcase"><LayoutDashboard size={19} /><span>{text('معرض كل الشاشات', 'All screens showcase')}</span></Link>}
        <button className="fx-nav-item" onClick={() => action(onSettings)}><Settings2 size={19} /><span>{text('إعدادات الشركة', 'Company settings')}</span></button>
        <button className="fx-nav-item" onClick={() => action(onGuide)}><BookOpen size={19} /><span>{text('دليل الاستخدام', 'Getting started')}</span></button>
        <button className="fx-nav-item" onClick={() => action(onReleases)}><History size={19} /><span>{text('سجل التحديثات', 'Release history')}</span></button>
      </nav>
      <div className="fx-sidebar-bottom">
        <div className="fx-sidebar-note"><ArrowUpRight size={22} /><b>{text('كل مستند في مكانه.', 'Everything in its place.')}</b><p>{text('من الرفع إلى المتابعة، رحلة واحدة واضحة.', 'One clear journey, from upload to tracking.')}</p><button onClick={() => action(onGuide)}>{text('اكتشف خطوات العمل', 'Explore the workflow')} <ChevronLeft size={14} /></button></div>
        <div className="fx-account"><span className="fx-account-avatar">{user?.displayName?.slice(0, 1) || 'F'}</span><div><b title={user?.email}>{user?.displayName || text('حسابك', 'Your account')}</b><small>{version}</small></div><button className="fx-icon-button" onClick={onLogout} aria-label={text('تسجيل الخروج', 'Sign out')}><LogOut size={18} /></button></div>
      </div>
    </aside>
    <header className="fx-topbar"><div className="fx-breadcrumb"><span>{text('مساحة العمل', 'Workspace')}</span>{ar ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}<b>{current?.label || text('تفاصيل المستند', 'Document details')}</b></div><div className="fx-topbar-actions"><ThemeToggle theme={theme} onToggle={onToggleTheme} lang={lang} /><span className="fx-environment">{import.meta.env.DEV ? text('نسخة محلية', 'Local preview') : 'FawterX'}</span><button className="fx-icon-button fx-language" onClick={() => setLang(ar ? 'en' : 'ar')}><Globe2 size={17} />{ar ? 'EN' : 'عربي'}</button></div></header>
  </>
}
