import { useState, useEffect, useContext } from 'react'
import { Link } from 'react-router-dom'
import { AppContext } from '../App'
import { getDrafts, deleteDraft } from '../services/api'
import toast from 'react-hot-toast'
import { MotionRegion, PageHeading, EmptyIllustration } from '../components/DesignSystem'
import { Plus, Files } from 'lucide-react'

export default function Drafts() {
  const { lang } = useContext(AppContext)
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDrafts()
  }, [])

  async function fetchDrafts() {
    try {
      const res = await getDrafts()
      setDrafts(res?.drafts || [])
    } catch (e) {
      console.warn('Drafts fetch notice:', e)
      setDrafts([])
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذه المسودة؟' : 'Are you sure you want to delete this recovery draft?')) return
    try {
      await deleteDraft(id)
      toast.success(lang === 'ar' ? 'تم الحذف بنجاح' : 'Deleted successfully')
      fetchDrafts()
    } catch (e) {
      toast.error(lang === 'ar' ? 'فشل الحذف' : 'Failed to delete')
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '5rem' }}><span className="spinner"></span></div>

  return (
    <MotionRegion className="fx-drafts-page">
      <PageHeading eyebrow="DOCUMENTS / DRAFTS" title={lang === 'ar' ? 'شغلك محفوظ. كمّل رحلتك.' : 'Saved work. Ready to continue.'} description={lang === 'ar' ? 'استعرض المسودات التي لم تكتمل، وتابع حالة مستنداتك.' : 'Review unfinished drafts and track document status.'}>
        <Link to="/" className="btn btn-accent">
          <Plus size={18} />{lang === 'ar' ? 'رفع ملف جديد' : 'New upload'}
        </Link>
      </PageHeading>
      <section className="fx-document-panel" data-enter>
      <div className="fx-document-toolbar"><span><Files size={19} />{lang === 'ar' ? 'مكتبة المسودات' : 'Draft library'}</span><span className="fx-count-pill">{drafts.length} {lang === 'ar' ? 'مسودة' : 'drafts'}</span></div>

      {drafts.length === 0 ? (
        <div className="fx-empty-state">
          <EmptyIllustration />
          <p style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-muted)' }}>
            {lang === 'ar' ? 'لا يوجد أي مسودات محفوظة حالياً.' : 'No active recovery drafts found.'}
          </p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{lang === 'ar' ? 'رقم المسودة' : 'Draft ID'}</th>
                <th>{lang === 'ar' ? 'رقم الفاتورة' : 'Internal ID'}</th>
                <th>{lang === 'ar' ? 'حالة الامتثال / الرفع' : 'Status'}</th>
                <th>{lang === 'ar' ? 'المبلغ الإجمالي' : 'Total Amount'}</th>
                <th>{lang === 'ar' ? 'تاريخ التعديل' : 'Last Modified'}</th>
                <th>{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map(d => (
                <tr key={d.draftId}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{d.draftId}</td>
                  <td style={{ fontWeight: 700 }}>
                    <Link to={`/drafts/${d.draftId}`} style={{ color: 'var(--accent, #38bdf8)', textDecoration: 'underline' }}>
                      {d.internalID || 'N/A'}
                    </Link>
                  </td>
                  <td>
                    {d.status === 'uploaded' ? (
                      <span className="badge badge-valid" style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', border: '1px solid #00e0a1' }}>
                        ✓ {lang === 'ar' ? 'تم الرفع للبوابة' : 'Uploaded'}
                      </span>
                    ) : d.status === 'valid' ? (
                      <span className="badge badge-valid">✓ {lang === 'ar' ? 'مطابق' : 'Compliant'}</span>
                    ) : (
                      <span className="badge badge-invalid" title={d.errorMessage || ''}>
                        ✕ {lang === 'ar' ? (d.errorMessage ? `غير مرفوع: ${d.errorMessage}` : 'به أخطاء') : (d.errorMessage || 'Failed')}
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--accent)', fontWeight: 700 }}>
                    {Number(d.totalAmount || 0).toLocaleString()} EGP
                  </td>
                  <td style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
                    {new Date(d.createdAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-US')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <Link to={`/drafts/${d.draftId}`} className="btn btn-sm btn-secondary" style={{ textDecoration: 'none', padding: '0.25rem 0.6rem' }}>
                        👁️ {lang === 'ar' ? 'معاينة' : 'View'}
                      </Link>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d.draftId)}>
                        {lang === 'ar' ? 'حذف' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </section>
    </MotionRegion>
  )
}
