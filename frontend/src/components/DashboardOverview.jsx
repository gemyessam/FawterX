import { Link } from 'react-router-dom'
import { ArrowUpLeft, ArrowUpRight, UploadCloud, FileCheck2, CircleAlert, Files, FileSpreadsheet, Download, ArrowRight, BookOpen, KeyRound, Clock3, MoreHorizontal } from 'lucide-react'
import { MotionRegion, PageHeading, EmptyIllustration } from './DesignSystem'
import { InvoicePipeline } from './LoginExperience'

export default function DashboardOverview({ lang, user, stats, operations, usage, usageReady, usageLimit, usageUsed, usageRemaining, usageProgress, onStart, onPricing, onGuide }) {
  const ar = lang === 'ar'
  const text = (a, e) => ar ? a : e
  const Arrow = ar ? ArrowUpLeft : ArrowUpRight
  const metrics = [
    [UploadCloud, stats.uploaded, text('إجمالي الفواتير المرفوعة', 'Total uploaded invoices'), 'violet'],
    [FileCheck2, stats.accepted, text('المستندات المقبولة', 'Accepted documents'), 'green'],
    [CircleAlert, stats.rejected, text('المستندات المرفوضة', 'Rejected documents'), 'rose'],
    [Files, stats.drafts, text('المسودات المحفوظة', 'Saved drafts'), 'amber'],
  ]
  return <MotionRegion className="fx-dashboard">
    <PageHeading eyebrow="OVERVIEW / 01" title={text('كل شغلك، في نظرة.', 'Your work, at a glance.')} description={text(`أهلاً ${user?.displayName?.split(' ')[0] || 'بك'}، دي مساحة متابعة فواتيرك وخطوتك الجاية.`, `Welcome ${user?.displayName?.split(' ')[0] || 'back'}. Here’s your invoice workspace.`)}>
      <button className="btn btn-ghost" onClick={onGuide}><BookOpen size={17} />{text('دليل البداية', 'Getting started')}</button>
    </PageHeading>
    <section className="fx-metrics" aria-label={text('إحصائيات الفواتير', 'Invoice statistics')}>
      {metrics.map(([Icon, value, label, tone], i) => <article className={`fx-metric tone-${tone}`} data-enter key={label}><div><span className="fx-metric-icon"><Icon size={20} strokeWidth={1.6} /></span><span className="fx-metric-index">0{i + 1}</span></div><strong>{value}</strong><span>{label}</span></article>)}
    </section>
    <section className="fx-dashboard-launch">
      <article className="fx-launch-card" data-enter><div className="fx-launch-copy"><span className="fx-eyebrow">{text('من ملفك، لخطوتك الجاية', 'FROM YOUR FILE TO YOUR NEXT STEP')}</span><h2>{text('فاتورتك الجاية', 'Your next invoice')}<br /><em>{text('تبدأ من هنا.', 'starts here.')}</em></h2><p>{text('ارفع ملف إكسيل وراجع بياناته، وبعدها كمّل خطوات الفاتورة الإلكترونية.', 'Upload an Excel file, review its data, and continue your electronic invoice workflow.')}</p><button className="btn btn-accent fx-launch-button" onClick={onStart}><FileSpreadsheet size={20} />{text('ابدأ رفع فواتيرك', 'Start uploading invoices')}<Arrow size={19} /></button><div className="fx-launch-footnote"><span>01 {text('رفع', 'Upload')}</span><i /><span>02 {text('مراجعة', 'Review')}</span><i /><span>03 {text('إرسال', 'Submit')}</span></div></div><InvoicePipeline lang={lang} /></article>
      <article className="fx-quota-card" data-enter><div className="fx-card-heading"><span className="fx-eyebrow">ACCOUNT / USAGE</span><MoreHorizontal size={20} /></div><h3>{text('مساحة إنجازك اليوم', 'Your daily workspace')}</h3><p>{!usageReady ? text('جارٍ التحقق من حالة الحساب…', 'Checking account status…') : usage.isSubscribed ? text('اشتراك نشط · إرسال غير محدود', 'Active subscription · Unlimited submissions') : text('تابع استخدامك اليومي قبل بدء الرفع.', 'Track today’s usage before uploading.')}</p><div className="fx-quota-number"><strong>{!usageReady ? '—' : usage.isSubscribed ? '∞' : usageRemaining}</strong><span>{text('فاتورة متاحة', 'invoices available')}</span></div><div className="fx-quota-track"><span style={{ width: `${usageProgress}%` }} /></div><div className="fx-quota-meta"><span>{text('المستخدم', 'Used')} <b>{usageReady ? usageUsed : '—'}</b></span><span>{text('الحد اليومي', 'Daily limit')} <b>{!usageReady ? '—' : usage.isSubscribed ? '∞' : usageLimit}</b></span></div>{usageReady && !usage.isSubscribed && <button className="btn btn-ghost btn-block" onClick={onPricing}>{text('استعرض خيارات الاشتراك', 'Explore subscription options')}<Arrow size={16} /></button>}</article>
    </section>
    <section className="fx-activity-layout">
      <article className="fx-activity-card" data-enter><div className="fx-section-heading"><div><span className="fx-eyebrow">ACTIVITY / RECENT</span><h3>{text('آخر حركة لفواتيرك', 'Your recent invoice activity')}</h3></div><Link to="/drafts" className="fx-text-link">{text('المسودات', 'Drafts')}<Arrow size={16} /></Link></div>
        {operations.length === 0 ? <div className="fx-empty-state"><EmptyIllustration /><h4>{text('لسه الرحلة في أولها.', 'Your journey starts here.')}</h4><p>{text('عملياتك هتظهر هنا بمجرد إرسال أول فاتورة.', 'Your activity will appear here after your first submission.')}</p><button className="fx-text-link" onClick={onStart}>{text('ارفع أول ملف', 'Upload your first file')}<Arrow size={15} /></button></div> : <div className="table-wrapper"><table><thead><tr><th>{text('الفاتورة', 'Invoice')}</th><th>{text('العميل', 'Customer')}</th><th>{text('الإجمالي', 'Total')}</th><th>{text('الحالة', 'Status')}</th><th>{text('التاريخ', 'Date')}</th></tr></thead><tbody>{operations.slice(0, 10).map((op, idx) => <tr key={op.operationId || idx}><td><b>{op.internalID || 'N/A'}</b></td><td>{op.receiverName || '—'}</td><td>{op.totalAmount ? `${op.totalAmount.toLocaleString()} EGP` : '—'}</td><td>{op.status === 'accepted' ? <span className="badge badge-valid">{text('مقبولة', 'Accepted')}</span> : op.status === 'rejected' || op.status === 'error' ? <span className="badge badge-invalid">{op.status === 'error' ? text('خطأ', 'Error') : text('مرفوضة', 'Rejected')}</span> : <span className="badge">{op.status || '—'}</span>}</td><td>{op.timestamp ? new Date(op.timestamp).toLocaleDateString(ar ? 'ar-EG' : 'en-US') : '—'}</td></tr>)}</tbody></table></div>}
      </article>
      <aside className="fx-tool-stack" data-enter><div className="fx-tool-card"><span className="fx-tool-icon"><KeyRound size={24} strokeWidth={1.5} /></span><small>DESKTOP COMPANION / v1.8.9</small><h3>{text('التوقيع في مكانه.', 'Signing, connected.')}</h3><p>{text('حمّل FawterX Signer، وافتح نافذته أثناء التوقيع الإلكتروني.', 'Download FawterX Signer and keep its window open while signing.')}</p><a className="btn btn-ghost btn-block" href={`/FawterX-Signer.zip?t=${Date.now()}`} download><Download size={16} />{text('تحميل أداة التوقيع', 'Download signer')}</a></div><Link className="fx-recovery-card" to="/drafts"><Clock3 size={24} /><div><b>{text('كمّل من حيث وقفت', 'Pick up where you left off')}</b><span>{text('استعرض المسودات المحفوظة', 'Browse saved drafts')}</span></div><ArrowRight size={17} /></Link></aside>
    </section>
  </MotionRegion>
}
