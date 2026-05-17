import { useState, useEffect, useContext } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { AppContext } from '../App'
import { getDraftById, submitDraft, getETAStatus } from '../services/api'
import toast from 'react-hot-toast'

function fmt(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function DraftDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { lang, t } = useContext(AppContext)

  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedDocIndex, setSelectedDocIndex] = useState(0)

  // PIN modal entry
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')

  // Submit Result logs
  const [etaResult, setEtaResult] = useState(null)
  const [etaError, setEtaError] = useState(null)
  const [verificationResult, setVerificationResult] = useState(null)
  const [verifyingStatus, setVerifyingStatus] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    async function fetchDraft() {
      try {
        const res = await getDraftById(id)
        setDraft(res.draft)
      } catch (e) {
        toast.error(lang === 'ar' ? 'لم يتم العثور على المسودة' : 'Saved draft session not found')
        navigate('/drafts')
      } finally {
        setLoading(false)
      }
    }
    fetchDraft()
  }, [id, navigate])

  function handleTriggerSubmit() {
    setShowPinModal(true)
  }

  async function handleLiveSubmit(e) {
    e.preventDefault()
    if (!pin) {
      toast.error(lang === 'ar' ? 'أدخل رقم الـ PIN' : 'Security PIN required')
      return
    }

    setShowPinModal(false)
    setSubmitting(true)
    setEtaResult(null)
    setEtaError(null)
    setVerificationResult(null)

    toast.loading(lang === 'ar' ? 'جاري توقيع المستندات والتوصيل بمنظومة الضرائب...' : 'Cryptographically signing and submitting to ETA...', { id: 'draft-submit' })
    
    try {
      const res = await submitDraft(id)
      console.log("Draft Submit Success:", res)
      setEtaResult(res)
      toast.success(lang === 'ar' ? 'تم إرسال وقبول المستندات بنجاح من الضرائب!' : 'Documents successfully accepted by ETA!', { id: 'draft-submit' })

      const uuid = res.requestId || res.result?.submissionUUID || res.result?.submissionId || res.result?.requestId;
      if (uuid && uuid !== "N/A") {
        setVerifyingStatus(true)
        toast.loading(lang === 'ar' ? 'جاري التحقق التلقائي من البوابة...' : 'Directly verifying on Portal...', { id: 'draft-verify' })
        
        await new Promise(r => setTimeout(r, 3000))
        try {
          const verifyRes = await getETAStatus(uuid)
          setVerificationResult(verifyRes.data)
          toast.success(lang === 'ar' ? 'تم تأكيد ظهور الفاتورة بالبوابة!' : 'Invoice appearance confirmed in Portal!', { id: 'draft-verify' })
        } catch (vErr) {
          toast.error(lang === 'ar' ? 'بوابة الضرائب تقوم بمعالجة المستند حالياً' : 'Document currently processing by ETA index', { id: 'draft-verify' })
        } finally {
          setVerifyingStatus(false)
        }
      }
    } catch (e) {
      console.error(e)
      const rawError = e.response?.data?.etaError || e.response?.data?.details || e.message;
      setEtaError({
        statusCode: e.response?.status || 400,
        message: e.response?.data?.message || e.message || 'Error occurred',
        raw: rawError
      })
      toast.error(lang === 'ar' ? 'فشل الإرسال لمنظومة الضرائب' : 'ETA submission failed', { id: 'draft-submit' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '5rem' }}><span className="spinner"></span></div>
  if (!draft) return null

  const { validationResult, document: docPayload, status } = draft
  const isValid = status === 'valid'
  const score = isValid ? 100 : (validationResult?.complianceScore || 0)
  const docs = Array.isArray(docPayload) ? docPayload : (docPayload._batchDocuments || [docPayload])

  return (
    <div className="card fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <h2 className="card-title" style={{ margin: 0 }}>📄 {lang === 'ar' ? 'استعراض المسودة ومعدل المطابقة' : 'Saved Draft Details'}</h2>
            <span className="premium-badge">{lang === 'ar' ? 'وضع الاسترجاع الذكي' : 'Recovery Sandbox'}</span>
          </div>
          <p className="card-sub" style={{ marginBottom: 0 }}>
            {lang === 'ar' ? 'معرف الجلسة:' : 'Session Draft ID:'} <span style={{ fontFamily: 'monospace' }}>{draft.draftId}</span>
          </p>
        </div>
        <div style={{ textAlign: lang === 'en' ? 'right' : 'left' }}>
          {isValid ? <span className="badge badge-valid">✓ {lang === 'ar' ? 'مسودة صالحة' : 'Compliant'}</span> : <span className="badge badge-invalid">✕ {lang === 'ar' ? 'أخطاء مطابقة' : 'Errors'}</span>}
          <div style={{ marginTop: '.5rem', fontSize: '.85rem', fontWeight: 'bold' }}>
            Compliance Score: <span style={{ color: score === 100 ? 'var(--accent)' : 'var(--danger)' }}>{score}%</span>
          </div>
        </div>
      </div>

      {/* Timeline flow display */}
      {(() => {
        const hasSignature = docs.every(d => d.signatures && Array.isArray(d.signatures) && d.signatures.length > 0);
        const etaSubmitted = !!etaResult;
        const portalVerified = !!verificationResult;

        const timelineSteps = [
          {
            title: lang === 'ar' ? 'توليد ملفات ETA' : 'Generate ETA JSON',
            desc: lang === 'ar' ? 'تم تحويل البيانات' : 'Format compliant payload',
            state: "success"
          },
          {
            title: lang === 'ar' ? 'الفحص المسبق محلياً' : 'Pre-flight Validation',
            desc: isValid ? (lang === 'ar' ? 'مطابق ومكتمل' : 'Passed') : (lang === 'ar' ? 'يوجد أخطاء' : 'Local errors'),
            state: isValid ? "success" : "error"
          },
          {
            title: lang === 'ar' ? 'التوقيع الرقمي' : 'Digital Signature',
            desc: hasSignature ? (lang === 'ar' ? 'تم التوقيع بنجاح' : 'Signed') : (lang === 'ar' ? 'يلزم إدخال PIN' : 'PIN input required'),
            state: hasSignature ? "success" : "warning"
          },
          {
            title: lang === 'ar' ? 'الإرسال للضرائب' : 'Push to ETA Portal',
            desc: etaSubmitted ? (lang === 'ar' ? 'مقبول بالبوابة' : 'Accepted') : (etaError ? (lang === 'ar' ? 'مرفوض' : 'Rejected') : (lang === 'ar' ? 'انتظار...' : 'Pending')),
            state: etaSubmitted ? "success" : (etaError ? "error" : "pending")
          }
        ];

        return (
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem', border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
              🏁 {lang === 'ar' ? 'خطوات التحقق الفوري لـ ETA' : 'ETA Portal Submission Timeline'}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              {timelineSteps.map((step, idx) => {
                let badgeColor = '#6c757d';
                let badgeBg = 'rgba(255,255,255,0.02)';
                let borderStyle = '1px solid var(--border)';
                let icon = '⚪';

                if (step.state === 'success') {
                  badgeColor = 'var(--accent)';
                  badgeBg = 'rgba(0, 224, 161, 0.04)';
                  borderStyle = '1px solid rgba(0, 224, 161, 0.25)';
                  icon = '✅';
                } else if (step.state === 'warning') {
                  badgeColor = 'var(--warning)';
                  badgeBg = 'rgba(255, 184, 79, 0.04)';
                  borderStyle = '1px solid rgba(255, 184, 79, 0.25)';
                  icon = '⚠️';
                } else if (step.state === 'error') {
                  badgeColor = 'var(--danger)';
                  badgeBg = 'rgba(255, 79, 106, 0.04)';
                  borderStyle = '1px solid rgba(255, 79, 106, 0.25)';
                  icon = '❌';
                }

                return (
                  <div key={idx} style={{ padding: '1rem', background: badgeBg, border: borderStyle, borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontSize: '1rem' }}>{icon}</span>
                      <strong style={{ fontSize: '0.85rem', color: badgeColor }}>{step.title}</strong>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{step.desc}</span>
                  </div>
                )
              })}
            </div>

            {/* Render Technical Errors */}
            {etaError && (
              <div style={{ marginTop: '1.5rem', background: 'rgba(255, 79, 106, 0.03)', border: '1px solid rgba(255, 79, 106, 0.2)', borderRadius: '8px', padding: '1.25rem', textAlign: 'right' }}>
                <strong style={{ color: 'var(--danger)', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>❌ {lang === 'ar' ? 'تفاصيل أخطاء البوابة:' : 'ETA Portal Response Error:'}</strong>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status: {etaError.statusCode} | {etaError.message}</p>
                {etaError.raw && (
                  <pre style={{ background: '#090b14', padding: '1rem', borderRadius: '6px', overflowX: 'auto', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.5rem', textAlign: 'left', direction: 'ltr' }}>
                    {typeof etaError.raw === 'object' ? JSON.stringify(etaError.raw, null, 2) : String(etaError.raw)}
                  </pre>
                )}
                {JSON.stringify(etaError).includes('signature') && (
                  <p style={{ color: 'var(--warning)', fontSize: '0.82rem', marginTop: '0.5rem' }}>
                    ⚠️ ETA requires digital signature for final submission (يلزم وجود توقيع رقمي إلكتروني صالح للفاتورة قبل الإرسال الحقيقي)
                  </p>
                )}
              </div>
            )}

            {/* Portal Live Verification box */}
            {verificationResult && (
              <div style={{ marginTop: '1.5rem', background: 'rgba(0, 224, 161, 0.02)', border: '1px solid rgba(0, 224, 161, 0.2)', borderRadius: '8px', padding: '1.25rem' }}>
                <strong style={{ color: 'var(--accent)', fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>🔍 {lang === 'ar' ? 'تأكيد البحث الفوري بـ Portal الضرائب:' : 'ETA portal active indexing confirmed:'}</strong>
                <pre style={{ background: '#090b14', padding: '1rem', borderRadius: '6px', overflowX: 'auto', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'left', direction: 'ltr' }}>
                  {JSON.stringify(verificationResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )
      })()}

      {/* Validation warning logs */}
      {!isValid && validationResult?.errors?.length > 0 && (
        <div className="validation-list error" style={{ marginBottom: '1.5rem', textAlign: 'right' }}>
          <strong>{lang === 'ar' ? 'أخطاء امتثال تمنع الإرسال:' : 'Compliance issues blocking submission:'}</strong>
          <ul>{validationResult.errors.map((e, idx) => <li key={idx}>{e}</li>)}</ul>
        </div>
      )}

      {/* Totals Summary grid */}
      <div className="summary-grid" style={{ marginBottom: '2rem' }}>
        <div className="summary-box">
          <span className="val">{fmt(validationResult?.calculatedTotals?.totalSalesAmount || docs[0]?.totalSalesAmount || 0)}</span>
          <span className="lbl">{lang === 'ar' ? 'المبيعات' : 'Sales amount'}</span>
        </div>
        <div className="summary-box warn">
          <span className="val">{fmt(validationResult?.calculatedTotals?.taxTotal || docs[0]?.taxTotals?.[0]?.amount || 0)}</span>
          <span className="lbl">{lang === 'ar' ? 'الضريبة' : 'Tax total'}</span>
        </div>
        <div className="summary-box accent">
          <span className="val">{fmt(validationResult?.calculatedTotals?.totalAmount || docs[0]?.totalAmount || 0)}</span>
          <span className="lbl">{lang === 'ar' ? 'الإجمالي العام' : 'Invoice Total (EGP)'}</span>
        </div>
      </div>

      {/* Multiple invoice tabs inside recovery session */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
        {docs.map((doc, idx) => (
          <button 
            key={idx}
            className={`btn btn-sm ${selectedDocIndex === idx ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => setSelectedDocIndex(idx)}
          >
            {lang === 'ar' ? 'فاتورة' : 'Invoice'}: {doc.internalID} ({doc.invoiceLines?.length || 0} {lang === 'ar' ? 'بنود' : 'lines'})
          </button>
        ))}
      </div>

      <div className="table-wrapper" style={{ marginBottom: '2rem' }}>
        <table>
          <thead>
            <tr>
              <th>{lang === 'ar' ? 'الكود' : 'Item Code'}</th>
              <th>{lang === 'ar' ? 'المنتج والوصف' : 'Description'}</th>
              <th>{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
              <th>{lang === 'ar' ? 'الوحدة' : 'Unit'}</th>
              <th>{lang === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
              <th>{lang === 'ar' ? 'الإجمالي الفرعي' : 'Line Total'}</th>
            </tr>
          </thead>
          <tbody>
            {docs[selectedDocIndex]?.invoiceLines?.map((line, i) => (
              <tr key={i}>
                <td style={{ fontFamily: 'monospace' }}>{line.itemCode}</td>
                <td style={{ whiteSpace: 'pre-wrap' }}>{line.description}</td>
                <td>{line.quantity}</td>
                <td>{line.unitType}</td>
                <td>{fmt(line.unitValue?.amountEGP || line.valueDifference)} EGP</td>
                <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{fmt(line.totalAmount || line.total)} EGP</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Advanced developers accordion (simplification requirement) */}
      <div className="expandable-advanced" style={{ marginBottom: '2.5rem' }}>
        <div className="advanced-toggle-header" onClick={() => setShowAdvanced(!showAdvanced)}>
          <span>🛠️ {lang === 'ar' ? 'عرض تفاصيل ومخرجات الـ JSON الفنية' : 'Advanced Developers JSON Schema'}</span>
          <span>{showAdvanced ? '▲' : '▼'}</span>
        </div>
        {showAdvanced && (
          <div className="advanced-body-content animate-zoom">
            <pre style={{ background: '#090b14', padding: '1.5rem', borderRadius: '8px', color: '#8fa0dd', overflowX: 'auto', fontFamily: 'monospace', fontSize: '0.8rem', textAlign: 'left', direction: 'ltr' }}>
              {JSON.stringify(docs[selectedDocIndex], null, 2)}
            </pre>
          </div>
        )}
      </div>

      <div className="nav-actions">
        <Link to="/drafts" className="btn btn-ghost">← {lang === 'ar' ? 'رجوع للمسودات' : 'Back to Drafts'}</Link>
        <button 
          className="btn btn-accent btn-lg" 
          disabled={!isValid || submitting}
          onClick={handleTriggerSubmit}
        >
          {submitting ? <span className="spinner"></span> : null}
          {submitting ? (lang === 'ar' ? 'جاري الإرسال...' : 'Submitting...') : `🚀 ${lang === 'ar' ? 'توقيع وإرسال لـ ETA' : 'Sign & Submit Session'}`}
        </button>
      </div>

      {/* SECURE USB TOKEN PIN ENTRY MODAL FOR DRAFT SUBMIT */}
      {showPinModal && (
        <div className="modal-backdrop glassmorphism-heavy">
          <form className="modal-card animate-zoom" onSubmit={handleLiveSubmit}>
            <div className="modal-header">
              <h3>🔑 {lang === 'ar' ? 'التوقيع الإلكتروني للمسودة' : 'Sign Draft Session'}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowPinModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛡️</div>
              <h4>{lang === 'ar' ? 'أدخل رقم الـ PIN الخاص بـ USB Token' : 'Enter USB Token Security PIN'}</h4>
              <p className="modal-desc-sub" style={{ margin: '0.5rem auto 1.5rem', maxWidth: '400px' }}>
                {lang === 'ar' ? 'الرجاء إدخال رقم المرور السري للتوقيع الفوري. لا يتم حفظ الـ PIN نهائياً في قواعد البيانات لأمانك.' : 'Enter your HSM/USB Token PIN to sign the document payload immediately. Your PIN is never saved in our database.'}
              </p>

              <div className="input-field-wrapper" style={{ maxWidth: '280px', margin: '0 auto' }}>
                <input
                  type="password"
                  required
                  autoFocus
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••••••"
                  style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '1.5rem' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowPinModal(false)}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
              <button type="submit" className="btn btn-primary">
                ⚡ {lang === 'ar' ? 'تأكيد التوقيع والإرسال' : 'Verify & Submit'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
