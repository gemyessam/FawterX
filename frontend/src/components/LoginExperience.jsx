import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ArrowUpLeft, ArrowUpRight, FileSpreadsheet, ScanLine, Send, ShieldCheck, Globe2, Layers3, Terminal, Check, ChevronLeft } from 'lucide-react'
import { Brand, MotionRegion } from './DesignSystem'
import ThemeToggle from './ThemeToggle'

export function InvoicePipeline({ lang }) {
  const root = useRef(null)
  const ar = lang === 'ar'
  useLayoutEffect(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.to('.fx-doc-main', { y: -12, rotate: -2, duration: 3.4, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      gsap.to('.fx-doc-sheet', { y: 10, rotate: -3, duration: 4, repeat: -1, yoyo: true, ease: 'sine.inOut' })
      gsap.to('.fx-pipeline-token', { x: 120, opacity: 0, duration: 2.8, repeat: -1, repeatDelay: 1, ease: 'power1.inOut' })
      gsap.fromTo('.fx-doc-scan', { y: 0, opacity: 0 }, { y: 180, opacity: .7, duration: 3, repeat: -1, repeatDelay: 1, ease: 'power1.inOut' })
    }, root)
    return () => media.revert()
  }, [])
  return <div className="fx-pipeline" ref={root} aria-hidden="true">
    <div className="fx-pipeline-grid" />
    <svg className="fx-pipeline-lines" viewBox="0 0 560 350" fill="none"><path d="M90 220H180Q200 220 200 200V120Q200 100 220 100H460" stroke="currentColor" strokeDasharray="4 6" /><path d="M100 80H320Q340 80 340 100V240Q340 260 360 260H485" stroke="currentColor" strokeDasharray="4 6" /></svg>
    <div className="fx-doc-sheet"><div><FileSpreadsheet size={23} /><b>EXCEL</b></div><div className="fx-sheet-cells">{Array.from({ length: 20 }, (_, i) => <i key={i} />)}</div><span>.xlsx</span></div>
    <div className="fx-doc-main"><div className="fx-doc-heading"><Brand compact /><span>INVOICE</span></div><div className="fx-doc-lines"><i /><i /></div><div className="fx-doc-rows"><span /><span /><span /></div><div className="fx-doc-summary"><span>{ar ? 'فاتورة إلكترونية' : 'E-invoice'}</span><b>EGP</b></div><div className="fx-doc-scan" /></div>
    <span className="fx-pipeline-token"><Layers3 size={19} /></span>
    <div className="fx-pipeline-tag tag-input"><FileSpreadsheet size={15} />{ar ? 'بياناتك تبدأ هنا' : 'Your data starts here'}</div>
    <div className="fx-pipeline-tag tag-output"><span><Check size={14} /></span>{ar ? 'رحلة واحدة. خطوات واضحة.' : 'One journey. Clear steps.'}</div>
    <div className="fx-pipeline-caption"><span>01 / IMPORT</span><span>02 / REVIEW</span><span>03 / SUBMIT</span></div>
  </div>
}

export default function LoginExperience({ lang, setLang, theme, onToggleTheme, onLogin, onDevLogin, t, loginError }) {
  const ar = lang === 'ar'
  const text = (a, e) => ar ? a : e
  return <MotionRegion className={`fx-login ${!ar ? 'ltr-layout' : ''}`}>
    <header className="fx-login-header" data-enter><Brand /><div><ThemeToggle theme={theme} onToggle={onToggleTheme} lang={lang} /><span className="fx-login-edition">{text('منصة الفواتير الإلكترونية', 'Electronic invoice platform')}</span><button className="fx-icon-button" onClick={() => setLang(ar ? 'en' : 'ar')}><Globe2 size={18} />{ar ? 'English' : 'العربية'}</button></div></header>
    <main className="fx-login-main">
      <section className="fx-login-story">
        <span className="fx-eyebrow" data-enter><i />{text('شغل أقل. وضوح أكثر.', 'LESS FRICTION. MORE CLARITY.')}</span>
        <h1 data-enter>{text('مش مجرد فاتورة.', 'More than an invoice.')}<br /><span>{text('شغلك كله، مترتّب.', 'Your work, in order.')}</span></h1>
        <p className="fx-login-description" data-enter>{text('حوّل ملفات إكسيل لمسار عمل واضح. ارفع، راجع، وتابع فواتيرك الإلكترونية من مكان واحد مصمّم لشغلك.', 'Turn Excel files into a clear workflow. Upload, review, and track electronic invoices in one place designed for your work.')}</p>
        <div data-enter><InvoicePipeline lang={lang} /></div>
        <div className="fx-login-capabilities" data-enter>{[[FileSpreadsheet, text('استيراد إكسيل', 'Excel import')], [ScanLine, text('مراجعة البيانات', 'Data review')], [Send, text('متابعة الإرسال', 'Submission tracking')]].map(([Icon, label], i) => <div key={label}><span>0{i + 1}</span><Icon size={19} /><b>{label}</b></div>)}</div>
      </section>
      <section className="fx-login-access" data-enter>
        <div className="fx-access-card">
          <span className="fx-access-icon"><ArrowUpRight size={28} /></span><span className="fx-eyebrow">{text('مساحة عملك جاهزة', 'YOUR WORKSPACE AWAITS')}</span>
          <h2>{text('خلّينا نبدأ.', 'Let’s get started.')}</h2><p>{text('سجّل دخولك للوصول لفواتيرك ومسوداتك وإعدادات شركتك.', 'Sign in to access your invoices, drafts, and company settings.')}</p>
          <button type="button" className="fx-google-button" onClick={onLogin}><svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>{t.googleBtn}{ar ? <ArrowUpLeft size={18} /> : <ArrowUpRight size={18} />}</button>
          <div className="fx-access-note"><ShieldCheck size={17} /><span>{text('الدخول بحساب Google الخاص بك', 'Sign in with your own Google account')}</span></div>
          {loginError && <div className="alert alert-error" role="alert">{loginError}{window.location.hostname === '127.0.0.1' && <p><a href={`http://localhost:${window.location.port || '3000'}${window.location.pathname}`}>{text('افتح النسخة المحلية بعنوان localhost', 'Open the local preview on localhost')}</a></p>}</div>}
          <div className="fx-access-divider" />
          <div className="fx-access-guide"><span>01 — 03</span><b>{text('ملفك. مراجعتك. فاتورتك.', 'Your file. Your review. Your invoice.')}</b><p>{text('أكمل إعداد شركتك، ثم ابدأ برفع أول ملف.', 'Complete your company setup, then upload your first file.')}</p></div>
          {import.meta.env.VITE_ACCOUNT_PREVIEW === '1' && <p className="fx-access-note">{text('تجربة محلية بحسابك الحقيقي · البيانات للقراءة فقط', 'Local preview with your real account · Read-only data')}</p>}
          {import.meta.env.VITE_ACCOUNT_PREVIEW !== '1' && (import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(window.location.hostname)) && <button type="button" className="fx-dev-button" onClick={onDevLogin}><Terminal size={16} />{text('دخول وضع التطوير المحلي', 'Enter local development mode')}<ChevronLeft size={15} /></button>}
        </div>
        <span className="fx-access-caption">FAWTERX / BUILT FOR YOUR WORKFLOW</span>
        {import.meta.env.DEV && <a className="btn btn-ghost" href="/design-showcase">{text('استعرض كل الشاشات', 'Explore all screens')}</a>}
      </section>
    </main>
    <footer className="fx-login-footer"><span>© FawterX</span><span>{text('من أول ملف، لآخر خطوة.', 'From the first file to the final step.')}</span><span>EXCEL → E-INVOICE</span></footer>
  </MotionRegion>
}
