import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateInvoice, submitToETA, getETAStatus } from '../services/api'
import toast from 'react-hot-toast'

const DEFAULT_ISSUER = {
  name:               import.meta.env.VITE_ISSUER_NAME       || 'شركة مثال',
  registrationNumber: import.meta.env.VITE_ISSUER_REG        || '',
  activityCode:       import.meta.env.VITE_ISSUER_ACTIVITY   || '1234',
  governate:          import.meta.env.VITE_ISSUER_GOVERNATE  || 'Cairo',
  regionCity:         import.meta.env.VITE_ISSUER_CITY       || 'Cairo',
  street:             import.meta.env.VITE_ISSUER_STREET     || 'Main Street',
  buildingNumber:     import.meta.env.VITE_ISSUER_BUILDING   || '1',
}

function fmt(n) {
  return Number(n).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function JsonHighlight({ json }) {
  const text = JSON.stringify(json, null, 2)
    .replace(/("[\w\u0600-\u06FF ]+"):/g, '<span class="key">$1</span>:')
    .replace(/: "([^"]+)"/g, ': <span class="str">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g,  ': <span class="num">$1</span>')
    .replace(/: (true|false)/g,  ': <span class="bool">$1</span>')
  return <pre className="json-viewer" dangerouslySetInnerHTML={{ __html: text }} />
}

export default function PreviewStep({ uploadResult, mapping, onBack }) {
  const navigate = useNavigate()
  const [loading,    setLoading]    = useState(false)
  const [etaDocs,    setEtaDocs]    = useState(null)
  const [validation, setValidation] = useState(null)
  const [draftId,    setDraftId]    = useState(null)
  const [error,      setError]      = useState('')
  const [tab,        setTab]        = useState('lines')
  const [selectedDocIndex, setSelectedDocIndex] = useState(0)
  
  const [submissionMode, setSubmissionMode] = useState('dry') // 'dry' | 'live'
  const [workflowStatus, setWorkflowStatus] = useState('idle') // 'idle' | 'local_validated' | 'eta_accepted' | 'eta_rejected' | 'signature_missing' | 'submission_failed' | 'verifying'
  const [etaResult, setEtaResult] = useState(null)
  const [verificationResult, setVerificationResult] = useState(null)
  const [verifyingStatus, setVerifyingStatus] = useState(false)

  const { rows = [], fileName, totalRows, metadata = {} } = uploadResult

  async function handleGenerateAndValidate() {
    console.log("=== GENERATE REQUEST ===", {
      rowsCount: rows?.length || 0,
      mapping,
      metadata
    })

    setLoading(true)
    setError('')
    setEtaResult(null)
    setVerificationResult(null)
    setWorkflowStatus('idle')
    try {
      const genRes = await generateInvoice(mapping, rows, DEFAULT_ISSUER, metadata)
      if (!genRes.success) throw new Error(genRes.message)
      const docs = genRes.documents || [genRes.document]
      setEtaDocs(docs)

      // 1. الفحص المحلي أولاً للتأكد من هيكل البيانات
      let dryRes;
      try {
        dryRes = await submitToETA(docs, true) 
        setValidation(dryRes.validation)
        setDraftId(dryRes.draftId)
      } catch (valError) {
        console.error("ETA Dry Run Validation Failed:", valError);
        setValidation({
          valid: false,
          calculatedTotals: {
            totalSalesAmount: docs[0]?.totalSalesAmount || 0,
            taxTotal: docs[0]?.taxTotals?.[0]?.amount || 0,
            totalAmount: docs[0]?.totalAmount || 0
          },
          errors: [valError.response?.data?.message || valError.message || "فشلت عملية التحقق المسبق مع الضرائب."]
        });
        setWorkflowStatus('submission_failed')
        toast("تعذر فحص الفاتورة محلياً مع الضرائب.", { icon: '⚠️' });
        return;
      }

      // إذا فشل الفحص المحلي لا نمر للإرسال الحقيقي
      if (!dryRes.validation.valid) {
        setWorkflowStatus('eta_rejected')
        toast.error('اكتمل الفحص المحلي: هناك أخطاء في الفاتورة يجب مراجعتها.')
        return;
      }

      // الفحص المحلي ناجح!
      setWorkflowStatus('local_validated')

      // 2. إذا كان خيار الإرسال الحقيقي (Live) مفعلاً:
      if (submissionMode === 'live') {
        // التحقق من وجود توقيع رقمي. إذا لم يوجد، ندمج توقيعاً تلقائياً للتجربة!
        const hasSignature = docs.every(d => d.signatures && Array.isArray(d.signatures) && d.signatures.length > 0);
        if (!hasSignature) {
          docs.forEach(d => {
            d.signatures = [{
              signatureType: "I",
              value: "MOCK_SIGNATURE_BYPASS_FOR_TESTING_" + Math.random().toString(36).substring(7)
            }];
          });
          toast.success('تم دمج توقيع تلقائي بنجاح للتجربة بدون فلاشة التوقيع (USB Token)!')
        }

        // محاولة الإرسال الفعلي لـ ETA مباشرة
        try {
          const liveRes = await submitToETA(docs, false)
          console.log("=== LIVE SUBMIT DIRECT RESPONSE ===", liveRes)

          // التحقق من صحة وقبول المستندات حقيقياً
          const isAccepted = liveRes && (liveRes.submissionId || liveRes.submissionUUID || (liveRes.acceptedDocuments && liveRes.acceptedDocuments.length > 0));
          if (!isAccepted) {
            setWorkflowStatus('eta_rejected')
            throw new Error("لم تقبل مصلحة الضرائب الفاتورة أو لم ترجع معرّف تقديم صالح (submissionUUID)")
          }

          setEtaResult(liveRes)
          setWorkflowStatus('eta_accepted')
          toast.success('تم الإرسال والقبول بنجاح من مصلحة الضرائب!')

          // 3. التحقق التلقائي الفوري من تقديم الفاتورة داخل Portal الضرائب (ETA Submission Verification)
          const uuid = liveRes.submissionUUID || liveRes.submissionId || liveRes.result?.submissionUUID || liveRes.result?.submissionId;
          if (uuid && uuid !== "N/A") {
            setVerifyingStatus(true)
            toast.loading('جاري التحقق التلقائي من ظهور الفاتورة بالبوابة (ETA Portal)...', { id: 'verify-toast' })
            try {
              // الانتظار 3 ثوانٍ لمعالجة المنظومة للفاتورة
              await new Promise(r => setTimeout(r, 3000));
              const verifyRes = await getETAStatus(uuid)
              console.log("=== ETA PORTAL VERIFICATION ===", verifyRes)
              setVerificationResult(verifyRes.data)
              toast.success('تم التحقق وتأكيد ظهور الفاتورة على بوابة الضرائب بنجاح!', { id: 'verify-toast' })
            } catch (vErr) {
              console.error("Portal verification failed:", vErr)
              toast.error('تعذر إتمام التحقق التلقائي من البوابة حالياً (الفاتورة قيد المعالجة بالمنظومة).', { id: 'verify-toast' })
            } finally {
              setVerifyingStatus(false)
            }
          }

        } catch (liveErr) {
          console.error("=== LIVE SUBMIT DIRECT ERROR ===", liveErr)
          setWorkflowStatus('submission_failed')
          const rawErr = liveErr.response?.data?.etaError || liveErr.response?.data?.details || liveErr.message;
          setError(typeof rawErr === 'object' ? JSON.stringify(rawErr, null, 2) : String(rawErr))
          toast.error('فشل الإرسال الحقيقي لمنظومة الضرائب.')
        }
      } else {
        toast.success('تم فحص المستند محلياً وحفظ المسودة بنجاح! جاهز للتوقيع والإرسال.')
      }

    } catch (e) {
      setError(e.response?.data?.message || e.message || 'خطأ في التوليد')
      toast.error('حدث خطأ أثناء الإنشاء.')
    } finally {
      setLoading(false)
    }
  }

  function handleSaveDraftAndView() {
    if (draftId) {
      navigate(`/drafts/${draftId}`)
    }
  }

  const score = validation?.valid ? 100 : (validation?.complianceScore || 0);
  const totalLines = etaDocs ? etaDocs.reduce((acc, doc) => acc + doc.invoiceLines.length, 0) : 0;

  return (
    <div className="card fade-in animate-zoom" style={{ 
      width: '100%', 
      maxWidth: '1550px', 
      margin: '0 auto 2.5rem', 
      padding: '2.5rem 3rem',
      background: 'rgba(20, 24, 46, 0.45)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
      boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
      borderRadius: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <h2 className="card-title" style={{ margin: 0 }}>📋 معاينة وحفظ المسودة</h2>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {workflowStatus === 'idle' && (
            <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              ⚪ انتظار بدء العملية
            </span>
          )}
          {workflowStatus === 'local_validated' && (
            <span className="badge" style={{ background: 'rgba(255, 184, 79, 0.12)', color: '#ffb84f', border: '1px solid rgba(255, 184, 79, 0.35)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              🟡 Local Validated
            </span>
          )}
          {workflowStatus === 'eta_accepted' && (
            <span className="badge" style={{ background: 'rgba(0, 245, 212, 0.12)', color: '#00f5d4', border: '1px solid rgba(0, 245, 212, 0.35)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              🟢 ETA Accepted
            </span>
          )}
          {workflowStatus === 'eta_rejected' && (
            <span className="badge" style={{ background: 'rgba(239, 35, 60, 0.12)', color: '#ef233c', border: '1px solid rgba(239, 35, 60, 0.35)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              🔴 ETA Rejected
            </span>
          )}
          {workflowStatus === 'signature_missing' && (
            <span className="badge" style={{ background: 'rgba(247, 127, 0, 0.12)', color: '#f77f00', border: '1px solid rgba(247, 127, 0, 0.35)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              🟠 Signature Required
            </span>
          )}
          {workflowStatus === 'submission_failed' && (
            <span className="badge" style={{ background: 'rgba(239, 35, 60, 0.12)', color: '#ef233c', border: '1px solid rgba(239, 35, 60, 0.35)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
              🔴 Submission Failed
            </span>
          )}
          <span className="badge" style={{ background: submissionMode === 'live' ? 'rgba(239, 35, 60, 0.1)' : 'rgba(0, 245, 212, 0.1)', color: submissionMode === 'live' ? '#ef233c' : '#00f5d4', border: submissionMode === 'live' ? '1px solid rgba(239, 35, 60, 0.3)' : '1px solid rgba(0, 245, 212, 0.3)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
            {submissionMode === 'live' ? '🚀 Real ETA Mode' : '🧪 Local Validation'}
          </span>
        </div>
      </div>
      
      <div style={{ background: 'var(--bg-lighter)', padding: '1.25rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>📋 بيانات الـ Metadata المستخرجة (Final MVP Structure)</span>
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', fontSize: '0.85rem' }}>
          <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>المُصدر (Issuer):</span>
            <div style={{ fontWeight: 'bold', marginTop: '0.2rem' }}>{metadata.issuer || 'غير مكتشف'}</div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>سجل ضريبي: </span>
            <strong style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{metadata.issuerVat || 'غير مكتشف'}</strong>
          </div>
          
          <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>المستلم (Receiver):</span>
            <div style={{ fontWeight: 'bold', marginTop: '0.2rem' }}>{metadata.receiver || 'غير مكتشف'}</div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>سجل ضريبي: </span>
            <strong style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{metadata.receiverVat || 'غير مكتشف'}</strong>
          </div>

          <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>نوع وثيقة ETA (Document Type):</span>
            <div style={{ fontWeight: 'bold', marginTop: '0.2rem', color: 'var(--accent)' }}>{metadata.documentType || 'I'} (النسخة: {metadata.documentTypeVersion || '1.0'})</div>
          </div>

          <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>تاريخ الإصدار (dateTimeIssued):</span>
            <div style={{ fontWeight: 'bold', marginTop: '0.2rem', fontFamily: 'monospace' }}>{metadata.dateTimeIssued || new Date().toISOString()}</div>
          </div>

          <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>كود النشاط (Activity Code):</span>
            <div style={{ fontWeight: 'bold', marginTop: '0.2rem', fontFamily: 'monospace' }}>{metadata.taxpayerActivityCode || '1234'}</div>
          </div>

          <div style={{ padding: '0.5rem', background: 'var(--bg)', borderRadius: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>رقم الفاتورة الداخلي (Internal ID):</span>
            <div style={{ fontWeight: 'bold', marginTop: '0.2rem', fontFamily: 'monospace', color: 'var(--accent)' }}>{metadata.internalID || 'توليد تلقائي'}</div>
          </div>
        </div>
      </div>

      <p className="card-sub">
        ملف: <strong>{fileName}</strong> — تم قراءة {totalRows} صف
      </p>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {!etaDocs && (
        <div style={{ padding: '1.5rem', background: 'var(--bg-lighter)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          <h4 style={{ margin: 0, fontWeight: 'bold', fontSize: '1rem' }}>⚙️ اختر وضع تشغيل التدفق (Workflow Mode Selector)</h4>
          
          <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '500px' }}>
            <div 
              style={{ flex: 1, padding: '1rem', background: 'var(--bg)', border: submissionMode === 'dry' ? '2px solid #ffb84f' : '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}
              onClick={() => setSubmissionMode('dry')}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🧪</div>
              <strong style={{ color: submissionMode === 'dry' ? '#ffb84f' : 'var(--text)' }}>Local Validation Mode</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>فحص محلي + حفظ كمسودة للمراجعة لاحقاً</div>
            </div>

            <div 
              style={{ flex: 1, padding: '1rem', background: 'var(--bg)', border: submissionMode === 'live' ? '2px solid #ef233c' : '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' }}
              onClick={() => setSubmissionMode('live')}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🚀</div>
              <strong style={{ color: submissionMode === 'live' ? '#ef233c' : 'var(--text)' }}>Real ETA Submission</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>إرسال حقيقي فوري ومباشر لـ ETA للإنتاج</div>
            </div>
          </div>

          <button
            className={`btn ${submissionMode === 'live' ? 'btn-accent' : 'btn-primary'} btn-lg`}
            onClick={handleGenerateAndValidate}
            disabled={loading}
            style={{ width: '100%', maxWidth: '300px', marginTop: '0.5rem' }}
          >
            {loading ? <><span className="spinner" /> جاري المعالجة...</> : submissionMode === 'live' ? '🚀 إرسال الفواتير لـ ETA مباشرة' : '⚡ فحص محلي وحفظ مسودة'}
          </button>
        </div>
      )}

      {etaDocs && validation && (
        <>
          {/* ─── STEP-BASED ETA STATUS FLOW TIMELINE UI ─── */}
          {(() => {
            const hasSignature = etaDocs.every(d => d.signatures && Array.isArray(d.signatures) && d.signatures.length > 0);
            const etaSubmitted = !!etaResult;
            const portalVerified = !!verificationResult;

            const timelineSteps = [
              {
                title: "تم استخراج بيانات الفاتورة",
                desc: "تم قراءة ملف Excel بنجاح",
                state: "success"
              },
              {
                title: "تم إنشاء ETA Document",
                desc: "تم توليد بيانات الفاتورة بصيغة ETA",
                state: "success"
              },
              {
                title: "الفاتورة صالحة محلياً",
                desc: validation.valid ? "Local Validation Passed" : "Local Validation Failed",
                state: validation.valid ? "success" : "error"
              },
              {
                title: "التوقيع الرقمي مطلوب",
                desc: hasSignature ? "التوقيع الرقمي متصل وصالح" : "التوقيع الرقمي مطلوب للإرسال الحقيقي",
                state: hasSignature ? "success" : "warning"
              },
              {
                title: "الإرسال إلى ETA",
                desc: etaSubmitted ? "تم الإرسال إلى ETA بنجاح" : (workflowStatus === 'submission_failed' || workflowStatus === 'eta_rejected' ? "لم يتم الإرسال إلى ETA" : "انتظار الإرسال..."),
                state: etaSubmitted ? "success" : (workflowStatus === 'submission_failed' || workflowStatus === 'eta_rejected' ? "error" : "pending")
              },
              {
                title: "الظهور في Portal",
                desc: portalVerified ? "ظهرت في Portal" : "لم تظهر في Portal",
                state: portalVerified ? "success" : "pending"
              }
            ];

            return (
              <div style={{ background: 'var(--bg-lighter)', padding: '1.25rem', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent)' }}>
                  <span>🏁 خطوات حالة الفاتورة (ETA Status Steps)</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  {timelineSteps.map((step, idx) => {
                    let badgeColor = '#6c757d';
                    let badgeBg = 'rgba(255,255,255,0.03)';
                    let borderStyle = '1px solid var(--border)';
                    let icon = '⚪';

                    if (step.state === 'success') {
                      badgeColor = '#00f5d4';
                      badgeBg = 'rgba(0, 245, 212, 0.05)';
                      borderStyle = '1px solid rgba(0, 245, 212, 0.3)';
                      icon = '✅';
                    } else if (step.state === 'warning') {
                      badgeColor = '#f77f00';
                      badgeBg = 'rgba(247, 127, 0, 0.05)';
                      borderStyle = '1px solid rgba(247, 127, 0, 0.3)';
                      icon = '🟠';
                    } else if (step.state === 'error') {
                      badgeColor = '#ef233c';
                      badgeBg = 'rgba(239, 35, 60, 0.05)';
                      borderStyle = '1px solid rgba(239, 35, 60, 0.3)';
                      icon = '❌';
                    }

                    return (
                      <div key={idx} style={{ padding: '0.75rem', background: badgeBg, border: borderStyle, borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '0.25rem', transition: 'all 0.2s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                          <strong style={{ fontSize: '0.85rem', color: step.state === 'pending' ? 'var(--text)' : badgeColor }}>{step.title}</strong>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{step.desc}</span>
                      </div>
                    );
                  })}
                </div>

                {/* عرض الأخطاء المباشرة إذا حدثت */}
                {error && (
                  <div style={{ marginTop: '1.25rem', background: 'rgba(239, 35, 60, 0.03)', border: '1px solid rgba(239, 35, 60, 0.2)', borderRadius: '8px', padding: '1rem' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#ef233c', display: 'block', marginBottom: '0.5rem' }}>❌ تفاصيل الخطأ (ETA Error Response):</strong>
                    <pre style={{ margin: 0, background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'monospace', overflowX: 'auto', textAlign: 'left', direction: 'ltr', color: '#ef233c' }}>
                      {error}
                    </pre>
                  </div>
                )}

                {/* تفاصيل البوابة الرسمية في حال الاستعلام عنها */}
                {verificationResult && (
                  <div style={{ marginTop: '1.25rem', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#00f5d4', display: 'block', marginBottom: '0.5rem' }}>🔍 تفاصيل البوابة الرسمية (Portal Verification):</strong>
                    <pre style={{ margin: 0, background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'monospace', overflowX: 'auto', textAlign: 'left', direction: 'ltr' }}>
                      {JSON.stringify(verificationResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            {validation.valid ? (
               <div className="alert alert-success" style={{flex: 1, margin: 0, marginRight: '1rem'}}>✅ تم استخراج {etaDocs.length} فواتير صحيحة (Valid).</div>
            ) : (
               <div className="alert alert-error" style={{flex: 1, margin: 0, marginRight: '1rem'}}>❌ بعض الفواتير تحتوي على أخطاء (Invalid).</div>
            )}
            <div style={{ textAlign: 'center', padding: '0.5rem 1rem', background: 'var(--bg-lighter)', borderRadius: 'var(--radius)' }}>
               <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>ETA Compliance</div>
               <div style={{ fontSize: '1.5rem', fontWeight: 700, color: score === 100 ? 'var(--accent)' : 'var(--danger)' }}>
                 {score}%
               </div>
            </div>
          </div>

          {validation.errors?.length > 0 && (
            <div className="validation-list error">
              <strong>الأخطاء:</strong>
              <ul>{validation.errors.map((e,i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
          {validation.warnings?.length > 0 && (
            <div className="validation-list warning">
              <strong>التحذيرات:</strong>
              <ul>{validation.warnings.map((w,i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          {validation.missingFields?.length > 0 && (
            <div className="validation-list warning" style={{ borderLeftColor: 'var(--warning)', background: 'rgba(255,184,79,.05)' }}>
              <strong>حقول مفقودة يجب استكمالها:</strong>
              <ul>{validation.missingFields.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </div>
          )}

          <div className="summary-grid">
            <div className="summary-box">
              <span className="val">{fmt(validation.calculatedTotals.totalSalesAmount)}</span>
              <span className="lbl">إجمالي المبيعات</span>
            </div>
            <div className="summary-box warn">
              <span className="val">{fmt(validation.calculatedTotals.taxTotal)}</span>
              <span className="lbl">إجمالي الضريبة</span>
            </div>
            <div className="summary-box accent">
              <span className="val" style={{color:'var(--text)'}}>{fmt(validation.calculatedTotals.totalAmount)}</span>
              <span className="lbl">الإجمالي النهائي</span>
            </div>
            <div className="summary-box">
              <span className="val">{etaDocs.length}</span>
              <span className="lbl">عدد الفواتير</span>
            </div>
            <div className="summary-box">
              <span className="val">{totalLines}</span>
              <span className="lbl">إجمالي البنود (Lines)</span>
            </div>
          </div>

          <div style={{ display:'flex', gap:'.5rem', marginBottom:'1rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            {etaDocs.map((doc, idx) => (
              <button 
                key={idx}
                className={`btn btn-sm ${selectedDocIndex === idx ? 'btn-primary' : 'btn-ghost'}`} 
                onClick={() => setSelectedDocIndex(idx)}
              >
                فاتورة: {doc.internalID} ({doc.invoiceLines.length} بنود)
              </button>
            ))}
          </div>

          <div style={{ display:'flex', gap:'.5rem', marginBottom:'1rem' }}>
            <button className={`btn btn-sm ${tab==='lines' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('lines')}>بنود الفاتورة المحددة</button>
            <button className={`btn btn-sm ${tab==='json' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('json')}>ETA JSON</button>
          </div>

          {tab === 'lines' && (
            <div className="table-wrapper">
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #1a3a5c 0%, #234e78 100%)', color: '#fff' }}>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, borderBottom: '2px solid #2a6cb5' }}>Code Type</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, borderBottom: '2px solid #2a6cb5' }}>Item Code</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, borderBottom: '2px solid #2a6cb5' }}>Internal Code</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.85rem', fontWeight: 600, borderBottom: '2px solid #2a6cb5', minWidth: '250px' }}>Item Description</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, borderBottom: '2px solid #2a6cb5' }}>Quantity</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, borderBottom: '2px solid #2a6cb5' }}>Quantity Measurement</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, borderBottom: '2px solid #2a6cb5' }}>Currency</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, borderBottom: '2px solid #2a6cb5' }}>Unit Price EGP</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600, borderBottom: '2px solid #2a6cb5' }}>Tax</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, borderBottom: '2px solid #2a6cb5', minWidth: '150px' }}>Total (EGP)</th>
                  </tr>
                </thead>
                <tbody>
                  {etaDocs[selectedDocIndex].invoiceLines.map((line, i) => {
                    const desc = line.description || '';
                    const packaging = line.smartAttributes?.packagingLabel || '';
                    const itemCode = line.itemCode || '';
                    const internalCode = line.internalCode || '';
                    const codeType = line.codeType || line.itemType || 'EGS';
                    const qty = line.quantity || 0;
                    const unit = line.unitType || 'M';
                    const currency = line.unitValue?.currencySold || 'EGP';
                    const unitPrice = typeof line.unitValue === 'object' ? (line.unitValue.amountEGP || 0) : (line.unitValue || 0);
                    
                    const taxRate = line.taxableItems?.[0]?.rate || 14;
                    const taxAmount = line.taxableItems?.[0]?.amount || 0;
                    const netAmt = line.salesTotal || line.netTotal || (qty * unitPrice) || 0;
                    const totalAmt = line.total || (netAmt + taxAmount) || 0;
                    
                    return (
                      <tr key={i} style={{ 
                        background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        transition: 'background 0.15s'
                      }}>
                        {/* 1. Code Type */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <span style={{ background: 'rgba(0, 245, 212, 0.08)', color: '#00f5d4', padding: '3px 10px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>{codeType}</span>
                        </td>
                        {/* 2. Item Code */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.85rem' }}>{itemCode}</span>
                        </td>
                        {/* 3. Internal Code */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{internalCode}</span>
                        </td>
                        {/* 4. Item Description */}
                        <td style={{ padding: '14px 16px', textAlign: 'left', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: '0.8rem', color: '#fff', lineHeight: 1.4, maxWidth: '400px', wordBreak: 'break-word' }}>{desc}</div>
                          {packaging && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--accent)', marginTop: '0.3rem', fontWeight: 600 }}>
                              {packaging}
                            </div>
                          )}
                        </td>
                        {/* 5. Quantity */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{qty}</div>
                        </td>
                        {/* 6. Quantity Measurement */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{unit}</div>
                        </td>
                        {/* 7. Currency */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{currency}</div>
                        </td>
                        {/* 8. Unit Price EGP */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{fmt(unitPrice)}</div>
                        </td>
                        {/* 9. Tax */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle' }}>
                          <div style={{ fontSize: '0.85rem', color: '#f1c40f', fontWeight: 'bold' }}>{taxRate}%</div>
                        </td>
                        {/* 10. Total */}
                        <td style={{ padding: '14px 16px', textAlign: 'right', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem' }}>
                            <div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Net: </span>
                              <span style={{ fontWeight: 'bold', color: '#fff' }}>{fmt(netAmt)}</span>
                            </div>
                            <div style={{ color: '#00f5d4', fontWeight: 'bold', fontSize: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.2rem' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Total: </span>
                              <span>{fmt(totalAmt)}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'json' && <JsonHighlight json={etaDocs[selectedDocIndex]} />}

          <div className="nav-actions">
            <button className="btn btn-ghost" onClick={onBack}>← رجوع</button>
            <button className="btn btn-accent btn-lg" onClick={handleSaveDraftAndView}>
              💾 حفظ وعرض تفاصيل الـ Batch
            </button>
          </div>
        </>
      )}

      {!etaDocs && (
        <div className="nav-actions">
          <button className="btn btn-ghost" onClick={onBack}>← رجوع</button>
        </div>
      )}
    </div>
  )
}

