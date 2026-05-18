import { useState, useEffect, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppContext } from '../App'
import { uploadExcel, previewInvoice, generateInvoice, submitToETA, getETAStatus, getUsageStatus } from '../services/api'
import toast from 'react-hot-toast'

export default function Home() {
  const { lang, t, user } = useContext(AppContext)
  
  // Dashboard & Workflow switching
  const [inWorkflow, setInWorkflow] = useState(false)
  const [step, setStep] = useState(1) // 1: Upload, 2: Mapping, 3: Preview/Summary, 4: ETA Submission Verification
  
  // Stats Mock / Live
  const [stats, setStats] = useState({
    uploaded: 1,
    accepted: 1,
    rejected: 0,
    drafts: 0
  })

  // Usage state from Backend
  const [usage, setUsage] = useState({ submissionsCount: 0, isSubscribed: false })

  // File Upload states
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [error, setError] = useState('')

  // ETA mapping fields constant
  const ETA_FIELDS = [
    { key: 'codeType',      labelAr: 'نوع الكود (Code Type EGS/GS1)', labelEn: 'Code Type EGS/GS1', required: false },
    { key: 'itemCode',      labelAr: 'كود المنتج (Item Code)', labelEn: 'Item Code', required: true },
    { key: 'internalCode',  labelAr: 'الكود الداخلي (Internal Code)', labelEn: 'Internal Code', required: false },
    { key: 'description',   labelAr: 'وصف المنتج (Item Description)', labelEn: 'Item Description', required: true },
    { key: 'quantity',      labelAr: 'الكمية (Quantity)', labelEn: 'Quantity', required: true },
    { key: 'unitType',      labelAr: 'وحدة القياس (Unit Type)', labelEn: 'Unit Type', required: false },
    { key: 'currency',      labelAr: 'العملة (Currency)', labelEn: 'Currency', required: false },
    { key: 'unitValue',     labelAr: 'سعر الوحدة بالجنيه (Price EGP)', labelEn: 'Price EGP', required: true },
    { key: 'taxPercent',    labelAr: 'نسبة الضريبة % (Tax %)', labelEn: 'Tax %', required: false },
  ]

  // Mapping states
  const [mapping, setMapping] = useState({
    invoiceNumber: '',
    receiverName: '',
    receiverId: '',
    codeType: '',
    itemCode: '',
    internalCode: '',
    description: '',
    quantity: '',
    unitType: '',
    currency: '',
    unitValue: '',
    taxPercent: ''
  })

  // Preview & Submit states
  const [etaDocs, setEtaDocs] = useState(null)
  const [validation, setValidation] = useState(null)
  const [draftId, setDraftId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [pin, setPin] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Real-time verification response states
  const [submissionResult, setSubmissionResult] = useState(null)
  const [verificationResult, setVerificationResult] = useState(null)
  const [verifying, setVerifying] = useState(false)

  // Fetch current user usage status
  async function fetchUsage() {
    try {
      const data = await getUsageStatus()
      if (data && data.usage) {
        setUsage(data.usage)
        setStats(prev => ({
          ...prev,
          uploaded: data.usage.submissionsCount,
          accepted: data.usage.submissionsCount
        }))
      }
    } catch (e) {
      console.error("Error fetching usage status:", e)
    }
  }

  useEffect(() => {
    if (user) {
      fetchUsage()
    }
  }, [user])

  // Auto mapping helper
  useEffect(() => {
    if (uploadResult && uploadResult.headers) {
      const autoMap = {
        invoiceNumber: '',
        receiverName: '',
        receiverId: '',
        codeType: '',
        itemCode: '',
        internalCode: '',
        description: '',
        quantity: '',
        unitType: '',
        currency: '',
        unitValue: '',
        taxPercent: ''
      }
      uploadResult.headers.forEach(h => {
        const lower = h.toLowerCase()
        if (lower === 'quantity' || lower === 'الكمية' || lower === 'qty') autoMap.quantity = h
        else if (lower.includes('desc') || lower.includes('product') || lower.includes('اسم الصنف') || lower.includes('وصف')) autoMap.description = h
        else if (lower.includes('price') || lower.includes('سعر')) autoMap.unitValue = h
        else if (lower.includes('tax') || lower.includes('vat') || lower.includes('ضريبة')) autoMap.taxPercent = h
        else if (lower.includes('code type') || lower.includes('نوع الكود')) autoMap.codeType = h
        else if (lower.includes('item code') || lower.includes('كود الصنف') || lower.includes('كود المنتج')) autoMap.itemCode = h
        else if (lower.includes('internal') || lower.includes('داخلي') || lower.includes('كود داخلي')) autoMap.internalCode = h
        else if (lower.includes('unit') || lower.includes('وحدة') || lower.includes('الواحدة') || lower.includes('مقياس') || lower.includes('قياس')) autoMap.unitType = h
        else if (lower.includes('currency') || lower.includes('عملة')) autoMap.currency = h
        else if (lower.includes('invoice') || lower.includes('رقم الفاتورة') || lower.includes('رقم الفاتوره')) autoMap.invoiceNumber = h
        else if (lower.includes('buyer') || lower.includes('receiver name') || lower.includes('اسم المشتري') || lower.includes('العميل')) autoMap.receiverName = h
        else if (lower.includes('buyer id') || lower.includes('receiver id') || lower.includes('رقم التسجيل') || lower.includes('الملف الضريبي')) autoMap.receiverId = h
      })
      setMapping(autoMap)
    }
  }, [uploadResult])

  // Drag & drop excel files
  function handleFileSelect(f) {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      toast.error(lang === 'ar' ? 'يرجى اختيار ملف إكسيل صالح (.xlsx أو .xls)' : 'Please select a valid Excel file (.xlsx or .xls)')
      return
    }
    setFile(f)
    setError('')
  }

  // Handle uploading Excel file (Step 1 -> 2)
  async function handleUploadExcel() {
    if (!file) return

    // Enforce configured ETA credentials check and successful connection verification before any file upload processing
    const saved = localStorage.getItem('companySettings')
    const config = saved ? JSON.parse(saved) : {}
    if (!config.clientId || !config.clientSecret1 || !config.clientSecret2 || !config.isVerified) {
      toast.error(lang === 'ar' 
        ? '⚠️ خطأ: يجب إدخال واختبار بيانات ربط مصلحة الضرائب (ETA) بنجاح أولاً من قائمة "إعدادات الشركة" قبل معالجة أي فواتير!' 
        : '⚠️ Error: You must enter and successfully test valid ETA connection credentials from "Company Setup" before processing invoices!')
      return
    }

    setUploadLoading(true)
    setError('')
    try {
      const res = await uploadExcel(file)
      setUploadResult(res)
      toast.success(lang === 'ar' ? 'تم رفع ملف الإكسيل بنجاح!' : 'Excel file uploaded successfully!')
      setStep(2) // Move to Mapping
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Error processing excel file')
      toast.error(lang === 'ar' ? 'فشل معالجة ملف الإكسيل' : 'Failed to parse Excel file')
    } finally {
      setUploadLoading(false)
    }
  }

  // Handle Mapping (Step 2 -> 3)
  async function handleConfirmMapping() {
    // Validate required fields are selected
    if (!mapping.quantity || !mapping.unitValue || !mapping.description) {
      toast.error(lang === 'ar' 
        ? '⚠️ خطأ: يرجى ربط الأعمدة الإلزامية: الكمية، سعر الوحدة، والوصف للمتابعة!' 
        : '⚠️ Error: Please map the required fields: Quantity, Unit Value, and Description to continue!');
      return;
    }

    setUploadLoading(true)
    try {
      const issuer = {
        name: 'الشركة العربية المتميزة للصناعة',
        registrationNumber: '477-840-515',
        activityCode: '6209',
        governate: 'Cairo',
        regionCity: 'Cairo',
        street: 'Main Street',
        buildingNumber: '1'
      }
      
      const genRes = await generateInvoice(mapping, uploadResult.rows || [], issuer, uploadResult.metadata || {})
      if (!genRes.success) throw new Error(genRes.message)
      const docs = genRes.documents || [genRes.document]
      setEtaDocs(docs)

      // Get local validation copy (Dry-run call)
      const dryRes = await submitToETA(docs, true)
      setValidation(dryRes.validation)
      setDraftId(dryRes.draftId)
      
      toast.success(lang === 'ar' ? 'تم الفحص والتوليد بنجاح!' : 'Validated and generated successfully!')
      setStep(3) // Move to Preview / Summary
    } catch (e) {
      console.error(e)
      toast.error(lang === 'ar' 
        ? 'فشل الاتصال بسيرفر فاوتر إكس. هل قمت بتشغيل الـ Backend؟' 
        : 'Connection failed to FawterX backend. Is the server running?')
    } finally {
      setUploadLoading(false)
    }
  }

  // Submit to ETA directly with automated cloud mock signature (no PIN modal required)
  async function handleTriggerETA() {
    setSubmitting(true)
    setSubmissionResult(null)
    setVerificationResult(null)
    
    toast.loading(lang === 'ar' ? 'جاري التحقق من أداة التوقيع المحلية...' : 'Checking local signer tool...', { id: 'submit-loader' })

    let updatedDocs = [];
    try {
      // 1. Health check to local signer at http://localhost:8585/
      let localSignerActive = false;
      try {
        const pingRes = await fetch("http://localhost:8585/", { method: "GET" });
        if (pingRes.ok) {
          localSignerActive = true;
        }
      } catch (pingErr) {
        console.warn("Local signer is not running:", pingErr);
      }

      if (!localSignerActive) {
        toast.dismiss('submit-loader');
        setSubmitting(false);
        // Show an explicit beautiful warning that they need to download/run the signer
        toast.error(
          lang === 'ar' 
            ? '⚠️ لم يتم الكشف عن أداة التوقيع! يرجى تحميل وتشغيل برنامج FawterX Signer أولاً والتأكد من توصيل الدونجل.' 
            : '⚠️ Local signer app not detected! Please download & run FawterX Signer and ensure your USB Token is plugged in.',
          { duration: 7000 }
        );
        return;
      }

      // 2. Local signer is active! Let's sign each document
      toast.loading(lang === 'ar' ? 'يرجى اختيار الشهادة وإدخال رقم الـ PIN في نافذة التوقيع...' : 'Please choose certificate & enter PIN in signer popup...', { id: 'submit-loader' });
      
      for (let i = 0; i < etaDocs.length; i++) {
        const doc = etaDocs[i];
        
        // Generate the canonical serialized string for this document
        const canonicalString = serializeToken(doc);
        
        // Request the local signer to sign the canonicalized string
        const signRes = await fetch("http://localhost:8585/sign", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ canonicalString })
        });
        
        if (!signRes.ok) {
          throw new Error(lang === 'ar' ? 'فشلت عملية التوقيع محلياً.' : 'Local signing request failed.');
        }
        
        const signData = await signRes.json();
        if (!signData.success) {
          throw new Error(signData.error || 'Unknown signing error');
        }
        
        updatedDocs.push({
          ...doc,
          signatures: [{
            signatureType: "I",
            value: signData.signature
          }]
        });
      }

      toast.loading(lang === 'ar' ? 'تم التوقيع بنجاح! جاري إرسال الفواتير لمنظومة الضرائب المصرية...' : 'Signed successfully! Submitting to ETA...', { id: 'submit-loader' })
      setStep(4) // Move to real-time verification screen

      const res = await submitToETA(updatedDocs, false)
      setSubmissionResult(res)
      toast.success(lang === 'ar' ? 'تم إرسال الفاتورة بنجاح لـ ETA!' : 'Invoices sent successfully to ETA!', { id: 'submit-loader' })

      // Auto verify appearance in tax portal
      const uuid = res.requestId || res.result?.submissionUUID || res.result?.submissionId || res.result?.requestId;
      if (uuid && uuid !== "N/A") {
        setVerifying(true)
        toast.loading(lang === 'ar' ? 'جاري التحقق الفوري من بوابة الضرائب...' : 'Verifying directly from ETA Portal...', { id: 'verify-loader' })
        
        await new Promise(r => setTimeout(r, 3000));
        try {
          const verifyRes = await getETAStatus(uuid)
          setVerificationResult(verifyRes.data)
          toast.success(lang === 'ar' ? 'تم تأكيد ظهور الفاتورة بالبوابة!' : 'Invoice appearance verified in Portal!', { id: 'verify-loader' })
        } catch (vErr) {
          toast.error(lang === 'ar' ? 'بوابة الضرائب تقوم بمعالجة المستند حالياً' : 'ETA Portal is processing document currently', { id: 'verify-loader' })
        } finally {
          setVerifying(false)
          fetchUsage()
        }
      }
    } catch (err) {
      console.error(err)
      toast.dismiss('submit-loader')
      const isLimitReached = err.response?.data?.limitReached === true;
      if (isLimitReached) {
        setShowPricingModal(true)
        setInWorkflow(false)
        setStep(1)
        return
      }

      const errData = err.response?.data;
      let errorStr = errData?.message || err.message;
      if (errData?.errors && Array.isArray(errData.errors)) {
        errorStr += "\n\n[قائمة الأخطاء المكتشفة في الفاتورة]:\n" + errData.errors.map((e, idx) => `${idx + 1}. ${e}`).join("\n");
      }
      if (errData?.result) {
        errorStr += "\n\n[ETA Rejection Details]:\n" + JSON.stringify(errData.result, null, 2);
      }
      setSubmissionResult({
        success: false,
        error: errorStr
      })
      toast.error(lang === 'ar' ? 'فشل الإرسال لـ ETA' : 'ETA submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  function handleResetFlow() {
    setFile(null)
    setUploadResult(null)
    setEtaDocs(null)
    setValidation(null)
    setDraftId(null)
    setSubmissionResult(null)
    setVerificationResult(null)
    setPin('')
    setStep(1)
    setInWorkflow(false)
  }

  return (
    <div className="home-dashboard-wrapper">
      {!inWorkflow ? (
        /* ─── PREMIUM SAAS DASHBOARD HUB ─── */
        <div className="dashboard-hub animate-fade-in">
          {/* Hero Welcome Banner */}
          <div className="dashboard-hero-card">
            <div className="hero-card-content">
              <h1>{lang === 'ar' ? 'أتمتة الفواتير الإلكترونية بذكاء لـ FawterX ⚡' : 'Smart ETA Invoicing Automation for FawterX ⚡'}</h1>
              <p>{t.welcomeSub}</p>
              
              {/* Usage Warning Banner */}
              <div style={{ margin: '1.5rem 0', padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>🎯</span>
                <strong style={{ fontSize: '0.9rem' }}>
                  {usage.isSubscribed 
                    ? (lang === 'ar' ? 'باقة FawterX نشطة: إرسال غير محدود للضرائب ✓' : 'FawterX Premium Active: Unlimited transmissions ✓')
                    : (usage.submissionsCount >= 1
                        ? (lang === 'ar' ? '⚠️ استهلكت التجربة المجانية (0 تجارب متبقية)' : '⚠️ Trial used (0 free submissions left)')
                        : (lang === 'ar' ? '🎁 باقة تجريبية: يتبقى لك 1 تجربة إرسال مجانية للضرائب' : '🎁 Free Trial: 1 free submission left to ETA')
                      )
                  }
                </strong>
                {!usage.isSubscribed && (
                  <button className="btn btn-accent btn-sm" style={{ marginLeft: '1rem' }} onClick={() => setShowPricingModal(true)}>
                    {lang === 'ar' ? 'ترقية الاشتراك 👑' : 'Upgrade Plan 👑'}
                  </button>
                )}
              </div>
              
              <br />
              <button 
                className="btn btn-accent btn-lg" 
                onClick={() => {
                  if (!usage.isSubscribed && usage.submissionsCount >= 1) {
                    setShowPricingModal(true)
                  } else {
                    setInWorkflow(true)
                  }
                }}
              >
                🚀 {t.welcomeCTA}
              </button>
            </div>
          </div>

          <h3 style={{ marginBottom: '1.25rem', fontWeight: 800 }}>📊 {t.statsTitle}</h3>
          
          <div className="dashboard-grid">
            {/* Stats widgets */}
            <div className="dashboard-main-strip">
              <div className="stats-summary-strip">
                <div className="stat-widget">
                  <span className="stat-val">{stats.uploaded}</span>
                  <span className="stat-lbl">{lang === 'ar' ? 'إجمالي المرفوع' : 'Total Uploaded'}</span>
                </div>
                <div className="stat-widget success">
                  <span className="stat-val">{stats.accepted}</span>
                  <span className="stat-lbl">{lang === 'ar' ? 'المستندات المقبولة' : 'Accepted Invoices'}</span>
                </div>
                <div className="stat-widget danger">
                  <span className="stat-val">{stats.rejected}</span>
                  <span className="stat-lbl">{lang === 'ar' ? 'المرفوضة بالبوابة' : 'Rejected Invoices'}</span>
                </div>
                <div className="stat-widget warning">
                  <span className="stat-val">{stats.drafts}</span>
                  <span className="stat-lbl">{lang === 'ar' ? 'المسودات النشطة' : 'Active Recovery'}</span>
                </div>
              </div>

              {/* Submissions Overview Card */}
              <div className="card" style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                  <h3 style={{ fontWeight: 800 }}>⚡ {t.recentSubmissions}</h3>
                  <Link to="/drafts" className="btn btn-ghost btn-sm">📁 {t.navDrafts}</Link>
                </div>

                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>{lang === 'ar' ? 'رقم الفاتورة' : 'Invoice ID'}</th>
                        <th>{lang === 'ar' ? 'اسم العميل' : 'Client / Receiver'}</th>
                        <th>{lang === 'ar' ? 'المبلغ الإجمالي' : 'Total Value'}</th>
                        <th>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 700 }}>INV-202303603</td>
                        <td>OMSI Group for Industry</td>
                        <td style={{ color: 'var(--accent)' }}>431,747.84 EGP</td>
                        <td><span className="badge badge-valid">Accepted ✓</span></td>
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 700 }}>INV-202303604</td>
                        <td>Egyptian Construction Corp</td>
                        <td style={{ color: 'var(--accent)' }}>85,400.00 EGP</td>
                        <td><span className="badge badge-valid">Accepted ✓</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar quick actions */}
            <div className="dashboard-side-strip">

              {/* FawterX Signer Download Card */}
              <div className="card" style={{ padding: '1.5rem', border: '1px solid rgba(0, 224, 161, 0.2)', background: 'rgba(0, 224, 161, 0.02)' }}>
                <h4 style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
                  🔑 {lang === 'ar' ? 'برنامج التوقيع المحلي' : 'Local E-Signer Bridge'}
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1.25rem' }}>
                  {lang === 'ar' 
                    ? 'يلزم تشغيل برنامج FawterX Signer للربط وتوقيع الفواتير بالدونجل (USB Token) الحقيقي الخاص بك.' 
                    : 'Download and run FawterX Signer to sign invoices using your E-Invoicing USB Token.'}
                </p>
                <a href={`/FawterX-Signer.zip?t=${Date.now()}`} download className="btn btn-accent btn-block btn-sm" style={{ textDecoration: 'none', textAlign: 'center', display: 'block' }}>
                  📥 {lang === 'ar' ? 'تحميل برنامج التوقيع (ZIP)' : 'Download Signer (ZIP)'}
                </a>
              </div>

              <div className="card" style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
                <h4>{lang === 'ar' ? 'نظام الاسترجاع الذكي' : 'Recovery Hub'}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1.25rem' }}>
                  {lang === 'ar' ? 'يتم حفظ تقدمك تلقائياً كمسودة محلياً في حال حدوث أي خطأ.' : 'Your work is auto-saved as draft in case of failure.'}
                </p>
                <Link to="/drafts" className="btn btn-primary btn-block btn-sm">
                  📁 {lang === 'ar' ? 'استعراض المسودات المحفوظة' : 'Browse Recovered Drafts'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ─── DYNAMIC 6-STEP SAAS WORKFLOW WIZARD ─── */
        <div className="workflow-wizard animate-fade-in">
          {/* stepper headers */}
          <div className="stepper">
            <div className={`step ${step === 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
              <div className="step-num">{step > 1 ? '✓' : '1'}</div>
              <div className="step-label">{lang === 'ar' ? 'رفع إكسيل' : 'Upload Excel'}</div>
            </div>
            <div className={`step ${step === 2 ? 'active' : ''} ${step > 2 ? 'done' : ''}`}>
              <div className="step-num">{step > 2 ? '✓' : '2'}</div>
              <div className="step-label">{lang === 'ar' ? 'ربط الأعمدة' : 'Map Columns'}</div>
            </div>
            <div className={`step ${step === 3 ? 'active' : ''} ${step > 3 ? 'done' : ''}`}>
              <div className="step-num">{step > 3 ? '✓' : '3'}</div>
              <div className="step-label">{lang === 'ar' ? 'المعاينة والامتثال' : 'Preview & Compliance'}</div>
            </div>
            <div className={`step ${step === 4 ? 'active' : ''}`}>
              <div className="step-num">4</div>
              <div className="step-label">{lang === 'ar' ? 'بوابة الضرائب' : 'ETA Submit'}</div>
            </div>
          </div>
 
          {/* STEP 1: UPLOAD FILE */}
          {step === 1 && (
            <div className="card fade-in">
              <h2 className="card-title">📂 {lang === 'ar' ? 'أتمتة ملف الإكسيل' : 'Process Excel Spreadsheet'}</h2>
              <p className="card-sub">{lang === 'ar' ? 'ارفع ملف المعاملات مباشرة لبدء فحص مصلحة الضرائب تلقائياً' : 'Drag & drop raw transactions sheets to start automated validation'}</p>

              {(() => {
                const settings = JSON.parse(localStorage.getItem('companySettings') || '{}')
                const hasKeys = settings.clientId && settings.clientSecret1 && settings.clientSecret2
                return !hasKeys || !settings.isVerified
              })() && (
                <div style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid var(--danger)', padding: '1rem', borderRadius: 'var(--radius)', color: '#fff', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'right' }}>
                  <div>
                    <strong>{lang === 'ar' ? '⚠️ يلزم تهيئة واختبار إعدادات الاتصال:' : '⚠️ Connection credentials validation required:'}</strong>
                    <span style={{ display: 'block', fontSize: '0.8rem', opacity: 0.85, marginTop: '0.2rem' }}>
                      {lang === 'ar' ? 'الرجاء الضغط على "إعدادات الشركة" في الشريط العلوي، وإدخال مفاتيح ربط مصلحة الضرائب (ETA)، ثم الضغط على "اختبار الاتصال المباشر" وحفظ الإعدادات بنجاح أولاً.' : 'Please open "Company Setup" at the top, enter your ETA keys, and click "Test Direct Connection" to successfully verify connection first.'}
                    </span>
                  </div>
                </div>
              )}

              <div
                className={`upload-zone ${dragging ? 'drag-over' : ''}`}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); handleFileSelect(e.dataTransfer.files[0]) }}
                onClick={() => document.getElementById('excel-file-pick').click()}
              >
                <input
                  id="excel-file-pick"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display: 'none' }}
                  onChange={e => handleFileSelect(e.target.files[0])}
                />
                <span className="upload-icon">📊</span>
                <h3>{dragging ? (lang === 'ar' ? 'أفلت الملف هنا' : 'Drop file here') : (lang === 'ar' ? 'اسحب وأفلت ملف الإكسيل هنا أو انقر للتصفح' : 'Drag & drop Excel here or click to browse')}</h3>
                <p>Excel (.xlsx, .xls) / CSV — Max 10MB</p>
              </div>

              {file && (
                <div className="file-info" style={{ marginTop: '1.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>📄</span>
                  <div>
                    <div className="file-info-name" style={{ color: 'var(--accent)', fontWeight: 700 }}>{file.name}</div>
                    <div className="file-info-meta">{(file.size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
              )}

              <div className="nav-actions" style={{ marginTop: '2rem' }}>
                <button className="btn btn-ghost" onClick={handleResetFlow}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</button>
                <button className="btn btn-primary" onClick={handleUploadExcel} disabled={!file || uploadLoading}>
                  {uploadLoading ? <span className="spinner"></span> : null}
                  {uploadLoading ? (lang === 'ar' ? 'جاري القراءة...' : 'Reading...') : (lang === 'ar' ? 'رفع وقراءة الملف ←' : 'Upload & Parse Excel →')}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING */}
          {step === 2 && uploadResult && (
            <div className="card fade-in">
              <h2 className="card-title">🔗 {lang === 'ar' ? 'ربط الأعمدة بالـ Schema الرسمية' : 'Schema Field Mapping'}</h2>
              <p className="card-sub">{lang === 'ar' ? 'قم بربط أعمدة ملف الإكسيل الخاص بك بالحقول الضريبية الإلزامية لتوليد الفاتورة.' : 'Review mapped Excel column titles dynamically associated with official invoice elements.'}</p>

              <div className="mapping-layout-container">
                {/* Left: Mapping grid cards */}
                <div>
                  <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', color: 'var(--primary)', textAlign: 'right' }}>
                    {lang === 'ar' ? '🛠️ ربط أعمدة الجدول:' : '🛠️ Table Field Mapping:'}
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                    {ETA_FIELDS.map(field => (
                      <div key={field.key} style={{ background: 'var(--bg-lighter)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{lang === 'ar' ? field.labelAr : field.labelEn}</span>
                          {field.required && <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>{lang === 'ar' ? 'إلزامي *' : 'Required *'}</span>}
                        </div>
                        <select
                          className="input"
                          style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem' }}
                          value={mapping[field.key] || ''}
                          onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                        >
                          <option value="">-- {lang === 'ar' ? 'تجاهل هذا العمود' : 'Ignore this Column'} --</option>
                          {uploadResult.headers?.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Extracted Document & Buyer Metadata Box */}
                <div className="card" style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border)', alignSelf: 'start', borderRadius: 'var(--radius)' }}>
                  <h3 style={{ marginBottom: '1.25rem', fontSize: '1.05rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'right' }}>
                    <span>📄</span>
                    {lang === 'ar' ? 'بيانات الفاتورة والعميل المستخرجة' : 'Extracted Invoice & Buyer Info'}
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'right' }}>
                    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>{lang === 'ar' ? 'رقم الفاتورة' : 'Invoice Number'}</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--text)', fontFamily: 'monospace' }}>{uploadResult.metadata?.internalID || 'INV-XXXX'}</strong>
                    </div>
                    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>{lang === 'ar' ? 'اسم المشتري' : 'Buyer Name'}</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--accent)' }}>{uploadResult.metadata?.receiver || uploadResult.metadata?.receiverName || 'N/A'}</strong>
                    </div>
                    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>{lang === 'ar' ? 'الرقم الضريبي للمشتري' : 'Buyer VAT/ID'}</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text)', fontFamily: 'monospace' }}>{uploadResult.metadata?.receiverVat || uploadResult.metadata?.receiverId || 'N/A'}</strong>
                    </div>
                    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>{lang === 'ar' ? 'تاريخ الإصدار' : 'Issue Date'}</span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{uploadResult.metadata?.dateTimeIssued ? new Date(uploadResult.metadata?.dateTimeIssued).toLocaleString() : 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>{lang === 'ar' ? 'اسم الشركة البائعة (المصدر)' : 'Seller Company Name'}</span>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{uploadResult.metadata?.issuer || 'الشركة العربية المتميزة'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="nav-actions" style={{ marginTop: '2.5rem' }}>
                <button className="btn btn-ghost" onClick={() => setStep(1)}>← {lang === 'ar' ? 'السابق' : 'Back'}</button>
                <button className="btn btn-primary" onClick={handleConfirmMapping} disabled={uploadLoading}>
                  {uploadLoading ? <span className="spinner"></span> : null}
                  {lang === 'ar' ? 'تحقق محلي وتوليد الفاتورة ←' : 'Local Validation & Generate →'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & SUMMARIES */}
          {step === 3 && etaDocs && (
            <div className="card fade-in">
              <h2 className="card-title">📋 {lang === 'ar' ? 'ملخص وتقرير الفحص المالي والمطابقة' : 'Invoice Pre-flight & Compliance Report'}</h2>
              <p className="card-sub">{lang === 'ar' ? 'تقييم فوري لمعدل الامتثال لشركتك وبيانات الضرائب المحلية.' : 'Immediate pre-send testing and tax validation compliance score'}</p>

              <div className="stats-summary-strip" style={{ marginBottom: '2rem' }}>
                <div className="stat-widget">
                  <span className="stat-val">{uploadResult.metadata?.issuer || 'FawterX Customer'}</span>
                  <span className="stat-lbl">{lang === 'ar' ? 'اسم المصدر' : 'Supplier Name'}</span>
                </div>
                <div className="stat-widget">
                  <span className="stat-val">{uploadResult.metadata?.issuerVat || '477-840-515'}</span>
                  <span className="stat-lbl">{lang === 'ar' ? 'الرقم الضريبي (VAT)' : 'Supplier VAT'}</span>
                </div>
                <div className="stat-widget success">
                  <span className="stat-val">{etaDocs.length}</span>
                  <span className="stat-lbl">{lang === 'ar' ? 'عدد الفواتير' : 'Invoices Count'}</span>
                </div>
                <div className="stat-widget success">
                  <span className="stat-val">{etaDocs[0]?.invoiceLines?.length || 0}</span>
                  <span className="stat-lbl">{lang === 'ar' ? 'إجمالي البنود' : 'Total Lines'}</span>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                {validation?.valid ? (
                  <div className="status-banner success-banner">
                    ✅ {lang === 'ar' ? 'اجتازت الفاتورة الفحص المحلي التلقائي بنجاح وجاهزة تماماً للإرسال.' : 'Local automated compliance validation succeeded. Fully ready to transmit.'}
                  </div>
                ) : (
                  <div className="status-banner error-banner">
                    ✕ {lang === 'ar' ? 'تنبيه: يحتوي المستند على أخطاء يجب معالجتها محلياً قبل التوقيع.' : 'Validation errors detected. Fix local inconsistencies before submitting.'}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontWeight: 800 }}>🧾 {lang === 'ar' ? 'معاينة بنود الفاتورة' : 'Invoice Items Preview'}</h4>
                <span className="badge badge-valid" style={{ background: 'rgba(0, 224, 161, 0.1)' }}>
                  {lang === 'ar' ? 'مجموع الفاتورة:' : 'Total Amount:'} {Number(etaDocs[0]?.totalAmount).toLocaleString()} EGP
                </span>
              </div>

              <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{lang === 'ar' ? 'كود الصنف' : 'Item Code'}</th>
                      <th>{lang === 'ar' ? 'الوصف' : 'Description'}</th>
                      <th>{lang === 'ar' ? 'الكمية' : 'Quantity'}</th>
                      <th>{lang === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                      <th>{lang === 'ar' ? 'الضريبة %' : 'Tax %'}</th>
                      <th>{lang === 'ar' ? 'الإجمالي' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {etaDocs[0]?.invoiceLines?.map((line, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td style={{ fontFamily: 'monospace' }}>{line.itemCode}</td>
                        <td>{line.description}</td>
                        <td>{line.quantity}</td>
                        <td>{line.unitValue?.amountEGP || line.valueDifference} EGP</td>
                        <td>{line.taxableItems?.[0]?.rate || 14}%</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 700 }}>{Number(line.total || line.totalAmount || 0).toLocaleString()} EGP</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="expandable-advanced">
                <div className="advanced-toggle-header" onClick={() => setShowAdvanced(!showAdvanced)}>
                  <span>🛠️ {lang === 'ar' ? 'عرض تفاصيل ومخرجات الـ JSON الفنية' : 'Advanced Developers JSON Schema'}</span>
                  <span>{showAdvanced ? '▲' : '▼'}</span>
                </div>
                {showAdvanced && (
                  <div className="advanced-body-content animate-zoom">
                    <pre style={{ background: '#090b14', padding: '1rem', borderRadius: '8px', color: '#8fa0dd', overflowX: 'auto', fontFamily: 'monospace', fontSize: '0.8rem', textAlign: 'left', direction: 'ltr' }}>
                      {JSON.stringify(etaDocs, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="nav-actions" style={{ marginTop: '2.5rem' }}>
                <button className="btn btn-ghost" onClick={() => setStep(2)}>← {lang === 'ar' ? 'السابق' : 'Back'}</button>
                <button className="btn btn-primary" onClick={handleTriggerETA} disabled={!validation?.valid}>
                  🚀 {lang === 'ar' ? 'توقيع وإرسال لـ ETA الحقيقي' : 'Sign & Submit Live to ETA'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REAL-TIME SUBMISSION */}
          {step === 4 && (
            <div className="card fade-in" style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>
                {submitting ? '⏳' : (submissionResult?.success !== false ? '✅' : '❌')}
              </div>

              <h2>
                {submitting 
                  ? (lang === 'ar' ? 'جاري الفحص المباشر والإرسال...' : 'Submitting to Egyptian Tax Authority...')
                  : (submissionResult?.success !== false 
                      ? (lang === 'ar' ? 'تم القبول والإرسال بنجاح!' : 'Accepted & Submitted Successfully!') 
                      : (lang === 'ar' ? 'فشل الإرسال وتأكيد المطابقة' : 'ETA Submission Rejection'))}
              </h2>
              
              <p className="card-sub" style={{ maxWidth: '600px', margin: '0.5rem auto 2.5rem' }}>
                {submitting 
                  ? (lang === 'ar' ? 'نقوم الآن بتشفير البيانات وإرسال الفاتورة لخوادم مصلحة الضرائب المصرية' : 'We are cryptographically signing and pushing the invoice directly to ETA servers')
                  : (submissionResult?.success !== false 
                      ? (lang === 'ar' ? 'استلمت بوابة الضرائب الفاتورة ووافقت عليها برمجياً.' : 'ETA production portal successfully recognized and approved your digital document payload.') 
                      : (lang === 'ar' ? 'رفضت منظومة الضرائب الفاتورة بسبب خلل في مطابقة البيانات.' : 'The official system rejected the document due to schema inconsistencies.'))}
              </p>

              {(verifying || verificationResult) && (
                <div className="card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', maxWidth: '550px', margin: '0 auto 2rem', padding: '1.5rem' }}>
                  <h4>🔍 {lang === 'ar' ? 'التحقق الفوري من ظهور الفاتورة بالبوابة (ETA Portal)' : 'Real-time Portal Verification'}</h4>
                  {verifying ? (
                    <div style={{ marginTop: '1rem' }}>
                      <span className="spinner"></span>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        {lang === 'ar' ? 'جاري البحث في بورتال الضرائب الفعلي...' : 'Searching live on ETA portal index...'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                      <div className="ltr-layout" style={{ fontSize: '0.85rem' }}>
                        <strong>UUID:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{verificationResult?.uuid || submissionResult?.requestId}</span><br />
                        <strong>Submission Date:</strong> {new Date().toLocaleString()}<br />
                        <strong>Compliance Status:</strong> <span className="badge badge-valid">🟢 Approved & Indexed</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {submissionResult?.success === false && (
                <div className="alert alert-error" style={{ maxWidth: '600px', margin: '0 auto 2rem', textAlign: 'right' }}>
                  <strong>{lang === 'ar' ? 'تفاصيل الخطأ الوارد من الضرائب:' : 'ETA Technical Error Details:'}</strong>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', fontFamily: 'monospace' }}>
                    {submissionResult.error}
                  </p>
                  {submissionResult.error?.includes('signature') && (
                    <p style={{ fontSize: '0.82rem', marginTop: '0.5rem', color: 'var(--warning)' }}>
                      💡 {lang === 'ar' ? 'ETA requires digital signature for final submission (يلزم وجود توقيع رقمي إلكتروني صالح للفاتورة قبل الإرسال الحقيقي)' : 'Digital signature is required by Egypt Tax Authority.'}
                    </p>
                  )}
                </div>
              )}

              <button className="btn btn-primary btn-lg" onClick={handleResetFlow}>
                🔄 {lang === 'ar' ? 'إنشاء فاتورة جديدة' : 'Start New Invoice Sheet'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── PREMIUM SAAS PRICING / UPGRADE SUBSCRIPTION MODAL ─── */}
      {showPricingModal && (
        <div className="modal-backdrop glassmorphism-heavy">
          <div className="modal-card animate-zoom" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h3>👑 {lang === 'ar' ? 'باقات ترقية حساب FawterX' : 'Upgrade FawterX Subscription Plan'}</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowPricingModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '2rem 1.5rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>💎</div>
              <h4>
                {lang === 'ar' 
                  ? 'لقد استهلكت تجربتك المجانية الأولى لـ FawterX!' 
                  : 'You have consumed your first free FawterX execution!'}
              </h4>
              <p className="modal-desc-sub" style={{ margin: '0.5rem auto 2rem', maxWidth: '500px' }}>
                {lang === 'ar' 
                  ? 'اختر إحدى الباقات الاحترافية التالية لفتح ميزات المعالجة غير المحدودة للفواتير والتحقق التلقائي والربط الآمن.' 
                  : 'Upgrade to one of our premium tiers below to unlock unlimited ETA submissions, live validation reports, and multi-user configurations.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginTop: '1rem' }}>
                {/* Plan 1 */}
                <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)', position: 'relative' }}>
                  <span className="premium-badge" style={{ position: 'absolute', top: '-10px', right: '10px' }}>PRO</span>
                  <h4 style={{ margin: 0, fontWeight: 800 }}>{lang === 'ar' ? 'فاوتر إكس برو' : 'FawterX Pro'}</h4>
                  <div style={{ margin: '1rem 0' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>$29</span>
                    <span style={{ color: 'var(--text-muted)' }}> / {lang === 'ar' ? 'شهرياً' : 'mo'}</span>
                  </div>
                  <ul style={{ textAlign: 'left', fontSize: '0.8rem', paddingLeft: '1.25rem', color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
                    <li>✓ {lang === 'ar' ? 'تقديم غير محدود للفواتير' : 'Unlimited ETA Submissions'}</li>
                    <li>✓ {lang === 'ar' ? 'الربط التلقائي الذكي للإكسيل' : 'Smart Auto-Excel Mapping'}</li>
                    <li>✓ {lang === 'ar' ? 'دعم التوقيع بالـ USB Token' : 'USB Token Signature Support'}</li>
                    <li>✓ {lang === 'ar' ? 'دعم فني متكامل 24/7' : '24/7 Technical Support'}</li>
                  </ul>
                  <button className="btn btn-accent btn-block btn-sm" onClick={() => toast.success(lang === 'ar' ? 'شكراً لاهتمامك! سيتم إطلاق بوابات الدفع قريباً.' : 'Payment gateways integration coming soon!')}>
                    {lang === 'ar' ? 'اشترك الآن' : 'Subscribe Now'}
                  </button>
                </div>

                {/* Plan 2 */}
                <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--accent)', background: 'rgba(0, 224, 161, 0.02)', position: 'relative' }}>
                  <span className="premium-badge" style={{ position: 'absolute', top: '-10px', right: '10px', background: 'var(--accent)' }}>POPULAR</span>
                  <h4 style={{ margin: 0, fontWeight: 800 }}>{lang === 'ar' ? 'فاوتر إكس للشركات' : 'FawterX Corporate'}</h4>
                  <div style={{ margin: '1rem 0' }}>
                    <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)' }}>$99</span>
                    <span style={{ color: 'var(--text-muted)' }}> / {lang === 'ar' ? 'شهرياً' : 'mo'}</span>
                  </div>
                  <ul style={{ textAlign: 'left', fontSize: '0.8rem', paddingLeft: '1.25rem', color: 'var(--text-dim)', marginBottom: '1.5rem' }}>
                    <li>✓ {lang === 'ar' ? 'كل ميزات الباقة الاحترافية' : 'All Pro Features included'}</li>
                    <li>✓ {lang === 'ar' ? 'ربط متعدد للشركات والفروع' : 'Multiple Corporate Workspaces'}</li>
                    <li>✓ {lang === 'ar' ? 'أكثر من محاسب على نفس الحساب' : 'Multi-Accountant Access'}</li>
                    <li>✓ {lang === 'ar' ? 'فحص امتثال ضريبي متقدم' : 'Advanced Audit & Compliance'}</li>
                  </ul>
                  <button className="btn btn-primary btn-block btn-sm" onClick={() => toast.success(lang === 'ar' ? 'شكراً لاهتمامك! سيتم إطلاق بوابات الدفع قريباً.' : 'Payment gateways integration coming soon!')}>
                    {lang === 'ar' ? 'اشترك الآن' : 'Subscribe Now'}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPricingModal(false)}>
                {lang === 'ar' ? 'إغلاق ومتابعة الاستعراض' : 'Close and Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SECURE USB TOKEN PIN ENTRY MODAL ─── */}
      {showPinModal && (
        <div className="modal-backdrop glassmorphism-heavy">
          <form className="modal-card animate-zoom" onSubmit={handleDirectSubmit}>
            <div className="modal-header">
              <h3>🔑 {lang === 'ar' ? 'التوقيع الإلكتروني الذكي' : 'Secure Digital Signature'}</h3>
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

function serializeToken(object) {
  let serialized = "";
  const keys = Object.keys(object).sort();
  for (const key of keys) {
    const val = object[key];
    if (key === "signatures" || val === null || val === undefined) {
      continue;
    }
    serialized += `"${key.toUpperCase()}"`;
    if (Array.isArray(val)) {
      for (const item of val) {
        serialized += `"${key.toUpperCase()}"`;
        if (typeof item === "object") {
          serialized += serializeToken(item);
        } else {
          serialized += `"${item.toString()}"`;
        }
      }
    } else if (typeof val === "object") {
      serialized += serializeToken(val);
    } else {
      serialized += `"${val.toString()}"`;
    }
  }
  return serialized;
}
