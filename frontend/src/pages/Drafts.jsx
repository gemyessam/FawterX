import { useState, useEffect, useContext } from 'react'
import { Link } from 'react-router-dom'
import { AppContext } from '../App'
import { getDrafts, deleteDraft } from '../services/api'
import toast from 'react-hot-toast'

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
      setDrafts(res.drafts || [])
    } catch (e) {
      toast.error(lang === 'ar' ? 'فشل جلب المسودات' : 'Failed to fetch saved drafts')
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
    <div className="card fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 className="card-title">📁 {lang === 'ar' ? 'نظام استرجاع المسودات (Recovery Drafts)' : 'Saved Recovery Drafts'}</h2>
          <p className="card-sub" style={{ marginBottom: 0 }}>
            {lang === 'ar' ? 'المسودات الموقوفة التي تم فحصها محلياً ولم تكتمل بالبوابة بعد.' : 'Invoices stored in local cache representing saved recovery sessions.'}
          </p>
        </div>
        <Link to="/" className="btn btn-accent">
          ➕ {lang === 'ar' ? 'أتمتة ملف إكسيل جديد' : 'New Excel Sheet'}
        </Link>
      </div>

      {drafts.length === 0 ? (
        <div className="empty-state" style={{ padding: '5rem 2rem' }}>
          <span className="empty-icon" style={{ fontSize: '3.5rem' }}>📭</span>
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
                  <td style={{ fontWeight: 700 }}>{d.internalID || 'N/A'}</td>
                  <td>
                    {d.status === 'uploaded' ? (
                      <span className="badge badge-valid" style={{ background: 'rgba(0, 224, 161, 0.15)', color: '#00e0a1', border: '1px solid #00e0a1' }}>
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
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
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
    </div>
  )
}
