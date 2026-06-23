import { useState, useEffect, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppContext, SettingsContext } from '../App'
import { uploadExcel, previewInvoice, generateInvoice, submitToETA, getETAStatus, getUsageStatus, getOperations } from '../services/api'
import BatchWorkflow from '../components/BatchWorkflow'
import toast from 'react-hot-toast'

export default function Home() {
  const { lang, t, user, resetTrigger, showTutorialModal, setShowTutorialModal } = useContext(AppContext)
  const settings = useContext(SettingsContext)

  const TUTORIAL_STEPS = [
    {
      titleAr: "الخطوة 1: الدخول إلى بورتال الضرائب الخاص بك",
      titleEn: "Step 1: Access Your Official ETA Portal Account",
      descAr: "قم بتسجيل الدخول إلى حساب شركتك الخاص على بوابة مصلحة الضرائب المصرية الرسمية الفعالة (ETA Portal) باستخدام بيانات اعتمادك المؤمنة.",
      descEn: "Log in to your corporate business dashboard on the official Egyptian Tax Authority (ETA) Portal using your secured credentials."
    },
    {
      titleAr: "الخطوة 2: الانتقال لخيار ERP والتهيئة",
      titleEn: "Step 2: Navigate to ERP System Configuration",
      descAr: "انزل إلى أسفل القائمة الجانبية في بوابة الضرائب واضغط على خيار تسجيل نظام تخطيط موارد المؤسسات (ERP Systems) للبدء في ربط فاوتر إكس.",
      descEn: "Scroll down the sidebar menu in the official portal and select registration of ERP Systems to integrate FawterX."
    },
    {
      titleAr: "الخطوة 3: إضافة نظام ربط جديد",
      titleEn: "Step 3: Register a New Integration System",
      descAr: "قم بالضغط على خيار تسجيل نظام جديد (Register ERP / New) لبدء إدخال بيانات نظام التكامل التلقائي الخارجي.",
      descEn: "Click on 'Register ERP' or 'Register New' to initialize the external automated integration credentials client."
    },
    {
      titleAr: "الخطوة 4: تسجيل وتسمية نظام FawterX",
      titleEn: "Step 4: Name and Register Your Connection",
      descAr: "قم بإدخال الاسم الذي تفضله لنظام التكامل الجديد (مثال: FawterX) ثم اضغط على زر التسجيل الفوري (Register) لتوليد مفاتيح التشفير.",
      descEn: "Enter any friendly identifier name you prefer for this linkage (e.g. FawterX), then click the Register button to securely generate your keys."
    },
    {
      titleAr: "الخطوة 5: حفظ المفاتيح المستخرجة",
      titleEn: "Step 5: Save the Generated API Credentials",
      descAr: "قم بنسخ وحفظ البيانات السرية التي ظهرت لك على البوابة (Client ID & Client Secret 1 & 2) بعناية فائقة لاستخدامها وتفعيلها في فاوتر إكس.",
      descEn: "Safely copy and save the generated sensitive credentials (Client ID, Client Secret 1 & 2) immediately for the next step."
    },
    {
      titleAr: "الخطوة 6: فتح إعدادات الشركة في فاوتر إكس",
      titleEn: "Step 6: Open Company Setup in FawterX",
      descAr: "قم بالضغط على خيار 'إعدادات الشركة' المتواجد بأعلى منصة فاوتر إكس لفتح نافذة إدخال بيانات الارتباط والربط الإلكتروني.",
      descEn: "Click on 'Company Setup' at the top of the FawterX platform to open the integration credentials window."
    },
    {
      titleAr: "الخطوة 7: لصق البيانات وإجراء اختبار اتصال مباشر",
      titleEn: "Step 7: Paste Credentials and Test Connection",
      descAr: "قم بلصق بيانات الربط المستخرجة من بورتال الضرائب (Client ID & Client Secrets) في الخانات المخصصة لها، ثم اضغط على زر 'اختبار الاتصال المباشر' للتحقق الفوري من صحتها.",
      descEn: "Paste your generated Client ID and Client Secrets into their respective fields, then click the 'Test Direct Connection' button to verify real-time status."
    },
    {
      titleAr: "الخطوة 8: تأكيد الاتصال وحفظ المفاتيح بأمان",
      titleEn: "Step 8: Save & Update API Credentials",
      descAr: "بمجرد نجاح الاتصال وتأكيد ارتباط النظام ببوابة الضرائب بنجاح، قم بالضغط على زر 'حفظ وتحديث المفاتيح' لتثبيت بيانات شركتك بشكل آمن والبدء في الفوترة.",
      descEn: "Once the success indicator confirms a valid live connection to the ETA portal, click the 'Save & Update Credentials' button to finalize your setup securely."
    },
    {
      titleAr: "الخطوة 9: تحميل وتشغيل أداة التوقيع FawterX Signer",
      titleEn: "Step 9: Download and Run FawterX Signer Bridge",
      descAr: "قم بتحميل أداة العبور والتوقيع الإلكتروني (Signer Bridge) لتتيح للموقع الاتصال بدونجل التوقيع مباشرة، وتأكد من تركيب الـ USB Token بجهازك ليتم التوقيع والإرسال التلقائي.",
      descEn: "Download our local digital signing bridge utility to enable the platform to communicate directly with your USB Dongle. Ensure your USB Token is plugged into your PC."
    },
    {
      titleAr: "الخطوة 10: تهانينا! أنت الآن جاهز تماماً للبدء",
      titleEn: "Step 10: Congratulations! You Are Ready",
      descAr: "مبروك! لقد أتممت جميع خطوات إعداد وتهيئة الربط مع مصلحة الضرائب المصرية بنجاح كامل. أنت الآن جاهز لرفع فواتيرك وتوقيعها وإرسالها بلمح البصر!",
      descEn: "Congratulations! You have successfully completed all registration and integration steps. You are now fully ready to upload your Excel files, sign them, and submit them in seconds."
    }
  ];
  
  // Dashboard & Workflow switching
  const [inWorkflow, setInWorkflow] = useState(false)
  const [step, setStep] = useState(1) // 1: Upload, 2: Mapping, 3: Preview/Summary, 4: ETA Submission Verification
  
  // Stats Mock / Live
  const [stats, setStats] = useState({
    uploaded: 0,
    accepted: 0,
    rejected: 0,
    drafts: 0
  })

  // Operations history from Firestore
  const [operations, setOperations] = useState([])

  // Usage state from Backend
  const [usage, setUsage] = useState({ submissionsCount: 0, isSubscribed: false })

  // File Upload states
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [error, setError] = useState('')
  const [parseMode, setParseMode] = useState('template') // 'template' or 'smart'

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
  const [tipSlide, setTipSlide] = useState(0)
  const [isSlideFading, setIsSlideFading] = useState(false)

  const handleSlideChange = (newIdx) => {
    setIsSlideFading(true)
    setTimeout(() => {
      setTipSlide(newIdx)
      setIsSlideFading(false)
    }, 180)
  }

  useEffect(() => {
    if (showTutorialModal) {
      setTipSlide(0)
    }
  }, [showTutorialModal])

  // Fetch current user usage status
  async function fetchUsage() {
    try {
      const data = await getUsageStatus()
      if (data && data.usage) {
        const isMaster = user && user.email === 'gemy.essam.ge@gmail.com';
        setUsage({
          ...data.usage,
          isSubscribed: isMaster ? true : data.usage.isSubscribed
        })
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
      fetchOperations()
    }
  }, [user])

  useEffect(() => {
    if (resetTrigger > 0) {
      handleResetFlow()
    }
  }, [resetTrigger])

  // Fetch operations history from Firestore
  async function fetchOperations() {
    try {
      const data = await getOperations()
      if (data && data.operations) {
        setOperations(data.operations)
        const accepted = data.operations.filter(op => op.status === 'accepted').length
        const rejected = data.operations.filter(op => op.status === 'rejected' || op.status === 'error').length
        setStats(prev => ({
          ...prev,
          uploaded: data.operations.length,
          accepted,
          rejected
        }))
      }
    } catch (e) {
      console.error('Error fetching operations:', e)
    }
  }

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
        else if (lower.includes('unit') || lower.includes('وحدة') || lower.includes('الواحدة') || lower.includes('مقياس') || lower.includes('قياس') || lower.includes('quantity measurement') || lower.includes('measurement')) autoMap.unitType = h
        else if (lower.includes('currency') || lower.includes('عملة')) autoMap.currency = h
        else if (lower.includes('invoice') || lower.includes('رقم الفاتورة') || lower.includes('رقم الفاتوره')) autoMap.invoiceNumber = h
        else if (lower.includes('buyer') || lower.includes('receiver name') || lower.includes('اسم المشتري') || lower.includes('العميل')) autoMap.receiverName = h
        else if (lower.includes('buyer id') || lower.includes('receiver id') || lower.includes('رقم التسجيل') || lower.includes('الملف الضريبي')) autoMap.receiverId = h
      })
      setMapping(autoMap)
    }
  }, [uploadResult])

  useEffect(() => {
    const resizeDescriptions = () => {
      document.querySelectorAll('textarea[data-description-autosize="true"]').forEach((el) => {
        el.style.height = 'auto'
        el.style.height = `${Math.max(el.scrollHeight, 50)}px`
      })
    }

    resizeDescriptions()
    const raf = requestAnimationFrame(resizeDescriptions)
    return () => cancelAnimationFrame(raf)
  }, [etaDocs])

  // Drag & drop excel files
  function handleFileSelect(f) {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    const allowed = parseMode === 'smart' ? ['xlsx', 'xls', 'csv', 'pdf'] : ['xlsx', 'xls', 'csv']
    if (!allowed.includes(ext)) {
      toast.error(lang === 'ar' 
        ? `يرجى اختيار ملف صالح (${allowed.join(', ')})` 
        : `Please select a valid file (${allowed.join(', ')})`)
      return
    }
    setFile(f)
    setError('')
  }

  // Handle uploading Excel / PDF file (Step 1 -> 2 or 3)
  async function handleUploadExcel() {
    if (!file) return

    // Enforce configured ETA credentials check before any file upload processing
    const config = settings || {}
    if (!config.clientId || !config.clientSecret1 || !config.clientSecret2) {
      toast.error(lang === 'ar' 
        ? '⚠️ خطأ: يجب إدخال بيانات ربط مصلحة الضرائب (ETA) أولاً من قائمة "إعدادات الشركة" قبل معالجة أي فواتير!' 
        : '⚠️ Error: You must enter ETA connection credentials from "Company Setup" before processing invoices!')
      return
    }

    setUploadLoading(true)
    setError('')
    try {
      const res = await uploadExcel(file, parseMode)
      setUploadResult(res)
      toast.success(lang === 'ar' ? 'تم رفع وقراءة المستند بنجاح!' : 'Document uploaded and parsed successfully!')

      if (parseMode === 'smart') {
        // AI Smart mode: Bypass manual column mapping completely!
        const issuer = {
          name: config.companyName || 'الشركة العربية المتميزة للصناعة',
          registrationNumber: config.taxId || '477-840-515',
          activityCode: config.taxpayerActivityCode || '6209',
          governate: 'Cairo',
          regionCity: 'Cairo',
          street: 'Main Street',
          buildingNumber: '1'
        }

        const smartMapping = {
          invoiceNumber: 'invoiceNumber',
          itemCode: 'itemCode',
          codeType: 'codeType',
          internalCode: 'internalCode',
          description: 'description',
          quantity: 'quantity',
          unitType: 'unitType',
          currency: 'currency',
          unitValue: 'unitValue',
          taxPercent: 'taxPercent'
        }

        const genRes = await generateInvoice(smartMapping, res.rows || [], issuer, res.metadata || {})
        if (!genRes.success) throw new Error(genRes.message)
        const docs = genRes.documents || [genRes.document]
        setEtaDocs(docs)

        // Get local validation copy (Dry-run call)
        const dryRes = await submitToETA(docs, true)
        setValidation(dryRes.validation)
        setDraftId(dryRes.draftId)

        toast.success(lang === 'ar' ? 'تمت المطابقة والتحقق بالذكاء الاصطناعي بنجاح!' : 'AI Auto-Mapping and validation succeeded!')
        setStep(3) // Skip step 2, move straight to Preview!
      } else {
        setStep(2) // Standard template mode: Move to manual Mapping
      }
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Error processing document')
      toast.error(lang === 'ar' ? 'فشل تحليل ومعالجة المستند بالذكاء الاصطناعي' : 'Failed to parse document with AI')
    } finally {
      setUploadLoading(false)
    }
  }

  // تحديث بنود الفاتورة وإعادة احتساب الإجماليات والـ VAT والتحقق الفوري (Spreadsheet-like reactive updates)
  async function updateInvoiceLine(idx, field, val) {
    const nextDocs = JSON.parse(JSON.stringify(etaDocs))
    const line = nextDocs[0]?.invoiceLines?.[idx]
    if (!line) return

    if (field === 'description') {
      line.description = val
      line.name = val.split(" | ")[0] || val
    } else if (field === 'itemCode') {
      line.itemCode = val
    } else if (field === 'quantity') {
      line.quantity = parseFloat(parseFloat(val).toFixed(4)) || 0
    } else if (field === 'unitType') {
      line.unitType = val
    } else if (field === 'unitValue') {
      if (!line.unitValue) line.unitValue = { currencySold: "EGP" }
      const newAmount = parseFloat(parseFloat(val).toFixed(4)) || 0;
      const currency = line.unitValue.currencySold || "EGP";
      const exRate = line.unitValue.currencyExchangeRate || 1;
      
      if (currency !== "EGP") {
        line.unitValue.amountSold = newAmount;
        line.unitValue.amountEGP = parseFloat((newAmount * exRate).toFixed(5));
      } else {
        line.unitValue.amountEGP = newAmount;
        line.unitValue.amountSold = 0;
      }
    } else if (field === 'taxPercent') {
      const rate = parseFloat(parseFloat(val).toFixed(4)) || 0
      if (line.taxableItems && line.taxableItems[0]) {
        line.taxableItems[0].rate = rate
      }
    }

    // إعادة احتساب أرقام السطر المالي
    const qty = line.quantity || 0
    const unitPrice = line.unitValue?.amountEGP || 0
    const net = qty * unitPrice
    line.netTotal = net
    line.salesTotal = net
    
    const taxRate = line.taxableItems?.[0]?.rate || 14
    const taxAmt = net * (taxRate / 100)
    if (line.taxableItems && line.taxableItems[0]) {
      line.taxableItems[0].amount = taxAmt
    }
    line.total = net + taxAmt

    // إعادة احتساب إجماليات الفاتورة بالكامل (Grand Totals Recalculation)
    let totalSales = 0
    let totalTax = 0
    nextDocs[0].invoiceLines.forEach(l => {
      totalSales += l.netTotal || 0
      totalTax += (l.taxableItems?.[0]?.amount || 0)
    })

    nextDocs[0].totalSalesAmount = totalSales
    nextDocs[0].netAmount = totalSales
    nextDocs[0].taxTotals = [{
      taxType: "T1",
      amount: totalTax
    }]
    nextDocs[0].totalAmount = totalSales + totalTax

    setEtaDocs(nextDocs)

    // الفحص الصامت لضمان تحديث بنود مصلحة الضرائب على الخادم فورياً
    try {
      const dryRes = await submitToETA(nextDocs, true)
      setValidation(dryRes.validation)
    } catch (e) {
      console.warn("Silent revalidation failed:", e)
    }
  }

  // تحديث البيانات الفوقية للفاتورة (Invoice Header/Metadata)
  async function updateInvoiceMetadata(field, val) {
    if (!etaDocs || !etaDocs[0]) return
    const nextDocs = JSON.parse(JSON.stringify(etaDocs))
    const doc = nextDocs[0]

    if (field === 'internalID') {
      doc.internalID = val
    } else if (field === 'dateTimeIssued') {
      doc.dateTimeIssued = val
    } else if (field === 'documentType') {
      doc.documentType = val
    } else if (field === 'issuerName') {
      if (!doc.issuer) doc.issuer = {}
      doc.issuer.name = val
    } else if (field === 'issuerVat') {
      if (!doc.issuer) doc.issuer = {}
      doc.issuer.id = val
    } else if (field === 'receiverName') {
      if (!doc.receiver) doc.receiver = {}
      doc.receiver.name = val
    } else if (field === 'receiverVat') {
      if (!doc.receiver) doc.receiver = {}
      doc.receiver.id = val
    } else if (field === 'receiverType') {
      if (!doc.receiver) doc.receiver = {}
      doc.receiver.type = val
    } else if (field === 'receiverCountry') {
      if (!doc.receiver) doc.receiver = {}
      if (!doc.receiver.address) doc.receiver.address = {}
      doc.receiver.address.country = val
    } else if (field === 'taxpayerActivityCode') {
      doc.taxpayerActivityCode = val
    } else if (field === 'currency') {
      // currency sold updates on unitValue inside lines
      doc.invoiceLines.forEach(l => {
        if (l.unitValue) l.unitValue.currencySold = val
      })
    } else if (field === 'exchangeRate') {
      const exRate = parseFloat(val) || 1
      let totalSales = 0
      let totalTax = 0
      
      doc.invoiceLines.forEach(l => {
        if (l.unitValue && l.unitValue.currencySold && l.unitValue.currencySold !== 'EGP') {
          l.unitValue.currencyExchangeRate = exRate
          const amountSold = l.unitValue.amountSold || 0
          l.unitValue.amountEGP = parseFloat((amountSold * exRate).toFixed(5))
          
          const qty = l.quantity || 0
          const net = qty * l.unitValue.amountEGP
          l.netTotal = net
          l.salesTotal = net
          
          const taxRate = l.taxableItems?.[0]?.rate || 0
          const taxAmt = net * (taxRate / 100)
          if (l.taxableItems && l.taxableItems[0]) {
            l.taxableItems[0].amount = taxAmt
          }
          l.total = net + taxAmt
        }
        totalSales += l.netTotal || 0
        totalTax += (l.taxableItems?.[0]?.amount || 0)
      })
      
      doc.totalSalesAmount = totalSales
      doc.netAmount = totalSales
      doc.taxTotals = [{ taxType: "T1", amount: totalTax }]
      doc.totalAmount = totalSales + totalTax
    } else if (field === 'codeType') {
      doc.codeType = val // EGS / GS1
    }

    setEtaDocs(nextDocs)

    // Silent dry-run validation to update compliance check score
    try {
      const dryRes = await submitToETA(nextDocs, true)
      setValidation(dryRes.validation)
    } catch (e) {}
  }

  // إضافة صنف جديد للفاتورة ببيانات افتراضية
  async function addInvoiceLine() {
    if (!etaDocs || !etaDocs[0]) return
    const nextDocs = JSON.parse(JSON.stringify(etaDocs))
    
    const newLine = {
      description: "Aluminium | 111111 | قطاع ألومنيوم جديد | 0.00 KG | 0 mm",
      itemCode: "EG-111111-1111",
      quantity: 1,
      unitType: "M",
      unitValue: {
        currencySold: "EGP",
        amountEGP: 100
      },
      netTotal: 100,
      salesTotal: 100,
      valueDifference: 0,
      totalTaxableFees: 0,
      discount: { rate: 0, amount: 0 },
      taxableItems: [
        {
          taxType: "T1",
          amount: 14,
          subType: "V009",
          rate: 14
        }
      ],
      total: 114
    }

    nextDocs[0].invoiceLines.push(newLine)

    // إعادة احتساب إجماليات الفاتورة بالكامل
    let totalSales = 0
    let totalTax = 0
    nextDocs[0].invoiceLines.forEach(l => {
      totalSales += l.netTotal || 0
      totalTax += (l.taxableItems?.[0]?.amount || 0)
    })

    nextDocs[0].totalSalesAmount = totalSales
    nextDocs[0].netAmount = totalSales
    nextDocs[0].taxTotals = [{ taxType: "T1", amount: totalTax }]
    nextDocs[0].totalAmount = totalSales + totalTax

    setEtaDocs(nextDocs)
    toast.success(lang === 'ar' ? 'تم إضافة بند جديد للفاتورة!' : 'New item line added to invoice!')

    try {
      const dryRes = await submitToETA(nextDocs, true)
      setValidation(dryRes.validation)
    } catch (e) {}
  }

  // حذف صنف من الفاتورة بالكامل
  async function deleteInvoiceLine(idx) {
    if (!etaDocs || !etaDocs[0]) return
    const nextDocs = JSON.parse(JSON.stringify(etaDocs))
    
    if (nextDocs[0].invoiceLines.length <= 1) {
      toast.error(lang === 'ar' ? '⚠️ يجب أن تحتوي الفاتورة على بند واحد على الأعل!' : '⚠️ Invoice must contain at least one line!')
      return
    }

    nextDocs[0].invoiceLines.splice(idx, 1)

    // إعادة احتساب إجماليات الفاتورة بالكامل
    let totalSales = 0
    let totalTax = 0
    nextDocs[0].invoiceLines.forEach(l => {
      totalSales += l.netTotal || 0
      totalTax += (l.taxableItems?.[0]?.amount || 0)
    })

    nextDocs[0].totalSalesAmount = totalSales
    nextDocs[0].netAmount = totalSales
    nextDocs[0].taxTotals = [{ taxType: "T1", amount: totalTax }]
    nextDocs[0].totalAmount = totalSales + totalTax

    setEtaDocs(nextDocs)
    toast.success(lang === 'ar' ? 'تم حذف الصنف من الفاتورة!' : 'Item line deleted from invoice!')

    try {
      const dryRes = await submitToETA(nextDocs, true)
      setValidation(dryRes.validation)
    } catch (e) {}
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
      const config = settings || {}
      const issuer = {
        name: config.companyName || 'الشركة العربية المتميزة للصناعة',
        registrationNumber: config.taxId || '477-840-515',
        activityCode: config.taxpayerActivityCode || '6209',
        governate: 'Cairo',
        regionCity: 'Cairo',
        street: 'Main Street',
        buildingNumber: '1'
      }
      
      const genRes = await generateInvoice(mapping, uploadResult.rows || [], issuer, uploadResult.metadata || {})
      if (!genRes.success) throw new Error(genRes.message)
      const docs = genRes.documents || [genRes.document]
      // Clean all empty properties, arrays, and objects from the payload to guarantee 100% hash matching
      const cleanedDocs = docs.map(d => cleanObject(d))
      setEtaDocs(cleanedDocs)

      // Get local validation copy (Dry-run call)
      const dryRes = await submitToETA(cleanedDocs, true)
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
    if (validation && !validation.valid) {
      const errs = validation.errors || [];
      const errListStr = errs.map((e, idx) => `${idx + 1}. ${e}`).join("\n");
      toast.error(
        lang === 'ar'
          ? `⚠️ لا يمكن الإرسال لوجود أخطاء في الفاتورة:\n${errListStr || 'خطأ غير معروف في البيانات'}`
          : `⚠️ Cannot submit due to validation errors:\n${errListStr || 'Unknown validation error'}`,
        { duration: 8000 }
      );
      return;
    }

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
      
      const safeDate = new Date();
      safeDate.setMinutes(safeDate.getMinutes() - 5);
      const currentIsoTime = safeDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
      for (let i = 0; i < etaDocs.length; i++) {
        const doc = etaDocs[i];
        doc.dateTimeIssued = currentIsoTime;
        
        // Clean the document recursively to strip empty optional fields before canonicalization & submission
        const cleanedDoc = cleanObject(doc);
        const canonicalString = serializeToken(cleanedDoc);
        
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
          ...cleanedDoc,
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
      if (errData?.details) {
        errorStr += "\n\n[ETA Rejection Details]:\n" + JSON.stringify(errData.details, null, 2);
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
                    : (usage.submissionsCount >= 25
                        ? (lang === 'ar' ? '⚠️ استهلكت التجربة المجانية (0 تجارب متبقية)' : '⚠️ Trial used (0 free submissions left)')
                        : (lang === 'ar' ? `🎁 باقة تجريبية: يتبقى لك ${25 - usage.submissionsCount} تجربة إرسال مجانية للضرائب` : `🎁 Free Trial: ${25 - usage.submissionsCount} free submissions left to ETA`)
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
                  if (!usage.isSubscribed && usage.submissionsCount >= 25) {
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
                        <th>{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operations.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                            {lang === 'ar' ? 'لا توجد عمليات حتى الآن — ابدأ بإرسال أول فاتورة!' : 'No operations yet — submit your first invoice!'}
                          </td>
                        </tr>
                      ) : (
                        operations.slice(0, 10).map((op, idx) => (
                          <tr key={op.operationId || idx}>
                            <td style={{ fontWeight: 700 }}>{op.internalID || 'N/A'}</td>
                            <td>{op.receiverName || '—'}</td>
                            <td style={{ color: 'var(--accent)' }}>{op.totalAmount ? `${op.totalAmount.toLocaleString()} EGP` : '—'}</td>
                            <td>
                              {op.status === 'accepted' && <span className="badge badge-valid">{lang === 'ar' ? 'مقبولة ✓' : 'Accepted ✓'}</span>}
                              {op.status === 'rejected' && <span className="badge badge-invalid">{lang === 'ar' ? 'مرفوضة ✗' : 'Rejected ✗'}</span>}
                              {op.status === 'error' && <span className="badge badge-invalid">{lang === 'ar' ? 'خطأ ⚠' : 'Error ⚠'}</span>}
                            </td>
                            <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{op.timestamp ? new Date(op.timestamp).toLocaleDateString('ar-EG') : '—'}</td>
                          </tr>
                        ))
                      )}
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
                  🔑 {lang === 'ar' ? 'أداة التوقيع FawterX Signer' : 'Local E-Signer Bridge'}
                  <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--accent)', color: '#000', marginLeft: '0.5rem' }}>v1.8.4</span>
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.5rem 0 1.25rem' }}>
                  {lang === 'ar' 
                    ? 'يلزم تشغيل برنامج FawterX Signer للربط وتوقيع الفواتير بالدونجل (USB Token) الحقيقي الخاص بك.' 
                    : 'Download and run FawterX Signer to sign invoices using your E-Invoicing USB Token.'}
                </p>
                <a href={`/FawterX-Signer.zip?t=${Date.now()}`} download className="btn btn-accent btn-block btn-sm" style={{ textDecoration: 'none', textAlign: 'center', display: 'block' }}>
                  📥 {lang === 'ar' ? 'تحميل أحدث إصدار v1.8.4 (ZIP)' : 'Download Latest v1.8.4 (ZIP)'}
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
 
          {/* BATCH WORKFLOW */}
          {parseMode === 'batch' && (
            <BatchWorkflow lang={lang} t={t} fetchUsage={fetchUsage} />
          )}

          {/* STEP 1: UPLOAD FILE */}
          {step === 1 && parseMode !== 'batch' && (
            <div className="card fade-in">
              <h2 className="card-title">📂 {lang === 'ar' ? 'أتمتة الفواتير والمعاملات الذكية' : 'Intelligent Document Automation'}</h2>
              <p className="card-sub">{lang === 'ar' ? 'ارفع فواتيرك ومعاملاتك مباشرة ليتم تحليلها والتحقق من امتثالها فورياً مصلحة الضرائب' : 'Upload transaction spreadsheets or raw PDF invoices to parse and validate them instantly'}</p>

              {/* Premium Top Template Download Banner */}
              {parseMode === 'template' && (
                <div style={{
                  background: 'rgba(0, 224, 161, 0.06)',
                  border: '1px solid rgba(0, 224, 161, 0.2)',
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1.5rem',
                  marginBottom: '2rem',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                  flexDirection: lang === 'ar' ? 'row-reverse' : 'row'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexDirection: lang === 'ar' ? 'row-reverse' : 'row', textAlign: lang === 'ar' ? 'right' : 'left' }}>
                    <span style={{ fontSize: '2rem', filter: 'drop-shadow(0 2px 8px rgba(0, 224, 161, 0.4))' }}>📥</span>
                    <div>
                      <strong style={{ display: 'block', color: 'var(--accent)', fontSize: '1.05rem', fontWeight: 800 }}>
                        {lang === 'ar' ? 'تحميل قالب الإكسيل المعتمد لرفع الفواتير' : 'Download Approved Excel Template'}
                      </strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.25rem', display: 'block' }}>
                        {lang === 'ar' ? 'قم بتعبئة فواتيرك في هذا القالب الجاهز لضمان القراءة الآلية والمطابقة بنسبة 100%' : 'Fill your invoicing details in this prepared layout to ensure 100% automated mapping.'}
                      </span>
                    </div>
                  </div>
                  <a 
                    href="/ETA_Final_Template.xlsx" 
                    download 
                    className="btn btn-accent btn-lg" 
                    style={{ 
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      textDecoration: 'none',
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(0, 224, 161, 0.2)',
                      padding: '0.75rem 1.5rem'
                    }}
                  >
                    <span>{lang === 'ar' ? 'تحميل القالب المعتمد ⬇️' : 'Download Template ⬇️'}</span>
                  </a>
                </div>
              )}

              {/* Segmented Mode Selector */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem', background: '#090b14', padding: '0.4rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <button 
                  type="button"
                  style={{ 
                    flex: 1, 
                    padding: '0.75rem', 
                    borderRadius: '8px', 
                    border: 'none', 
                    background: parseMode === 'template' ? 'var(--primary)' : 'transparent', 
                    color: '#fff', 
                    cursor: 'pointer', 
                    fontWeight: 600, 
                    transition: 'all 0.25s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onClick={() => { setParseMode('template'); setFile(null); }}
                >
                  📊 {lang === 'ar' ? 'الوضع القياسي (Excel mapping)' : 'Standard Excel Template'}
                </button>
                <button 
                  type="button"
                  style={{ 
                    flex: 1, 
                    padding: '0.75rem', 
                    borderRadius: '8px', 
                    border: 'none', 
                    background: parseMode === 'smart' ? 'linear-gradient(135deg, #7c4dff, #18ffff)' : 'transparent', 
                    color: parseMode === 'smart' ? '#0b0d19' : '#fff', 
                    cursor: 'pointer', 
                    fontWeight: 700, 
                    transition: 'all 0.25s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onClick={() => { setParseMode('smart'); setFile(null); }}
                >
                  🧠 {lang === 'ar' ? 'وضع الذكاء الاصطناعي الأذكى (PDF / Excel)' : 'AI Smart Auto-Parse (PDF / Excel)'}
                  <span style={{ 
                    fontSize: '0.62rem', 
                    background: parseMode === 'smart' ? 'rgba(11, 13, 25, 0.15)' : 'rgba(255, 255, 255, 0.15)', 
                    color: parseMode === 'smart' ? '#0b0d19' : 'var(--warning)',
                    padding: '0.15rem 0.5rem', 
                    borderRadius: '12px', 
                    marginLeft: '0.5rem', 
                    fontWeight: 800,
                    border: parseMode === 'smart' ? '1px solid rgba(11, 13, 25, 0.2)' : '1px solid rgba(255, 184, 79, 0.3)',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}>
                    {lang === 'ar' ? 'تحت التجربة والارتقاء 🧪' : 'Beta / Under Dev 🧪'}
                  </span>
                </button>
                <button 
                  type="button"
                  style={{ 
                    flex: 1, 
                    padding: '0.75rem', 
                    borderRadius: '8px', 
                    border: 'none', 
                    background: parseMode === 'batch' ? 'var(--accent)' : 'transparent', 
                    color: parseMode === 'batch' ? '#0b0d19' : '#fff', 
                    cursor: 'pointer', 
                    fontWeight: 700, 
                    transition: 'all 0.25s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onClick={() => { setParseMode('batch'); setFile(null); }}
                >
                  📑 {lang === 'ar' ? 'الرفع المتعدد (Batch Upload)' : 'Batch Upload'}
                </button>
              </div>

              {(() => {
                const config = settings || {}
                const hasKeys = config.clientId && config.clientSecret1 && config.clientSecret2
                return !hasKeys
              })() && (
                <div style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid var(--danger)', padding: '1rem', borderRadius: 'var(--radius)', color: '#fff', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'right' }}>
                  <div>
                    <strong>{lang === 'ar' ? '⚠️ يلزم تهيئة إعدادات الاتصال:' : '⚠️ Connection credentials required:'}</strong>
                    <span style={{ display: 'block', fontSize: '0.8rem', opacity: 0.85, marginTop: '0.2rem' }}>
                      {lang === 'ar' ? 'الرجاء الضغط على "إعدادات الشركة" في الشريط العلوي، وإدخال مفاتيح ربط مصلحة الضرائب (ETA) وحفظ الإعدادات بنجاح أولاً.' : 'Please open "Company Setup" at the top, enter your ETA keys, and save the settings first.'}
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
                  accept={parseMode === 'smart' ? ".xlsx,.xls,.csv,.pdf" : ".xlsx,.xls,.csv"}
                  style={{ display: 'none' }}
                  onChange={e => handleFileSelect(e.target.files[0])}
                />
                <span className="upload-icon">{parseMode === 'smart' ? '🧠' : '📊'}</span>
                <h3>
                  {dragging 
                    ? (lang === 'ar' ? 'أفلت الملف هنا' : 'Drop file here') 
                    : (parseMode === 'smart'
                        ? (lang === 'ar' ? 'اسحب وأفلت فاتورة الـ PDF أو Excel هنا أو انقر للتصفح' : 'Drag & drop PDF or Excel invoice here or click to browse')
                        : (lang === 'ar' ? 'اسحب وأفلت ملف الإكسيل هنا أو انقر للتصفح' : 'Drag & drop Excel sheet here or click to browse'))}
                </h3>
                <p>{parseMode === 'smart' ? 'PDF / Excel (.xlsx, .xls, .csv) — Max 10MB' : 'Excel (.xlsx, .xls, .csv) — Max 10MB'}</p>
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
                  {uploadLoading 
                    ? (lang === 'ar' ? 'جاري التحليل واستخراج البيانات...' : 'Analyzing & extracting...') 
                    : (lang === 'ar' ? 'تحليل وقراءة المستند الذكي ←' : 'Parse & Process Document →')}
                </button>
              </div>


              {/* Premium Tutorial Reopen Banner */}
              <div style={{ 
                marginTop: '3.5rem', 
                padding: '1.5rem', 
                background: 'rgba(255, 255, 255, 0.02)', 
                border: '1px solid rgba(255,255,255,0.05)', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1.5rem',
                flexDirection: lang === 'ar' ? 'row-reverse' : 'row',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexDirection: lang === 'ar' ? 'row-reverse' : 'row', textAlign: lang === 'ar' ? 'right' : 'left' }}>
                  <span style={{ fontSize: '2rem' }}>📖</span>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text)', fontSize: '1.05rem', fontWeight: 800 }}>
                      {lang === 'ar' ? 'دليل الاستخدام والتشغيل السريع' : 'Platform Operations & Guide'}
                    </strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '0.25rem', display: 'block' }}>
                      {lang === 'ar' ? 'بحاجة إلى مساعدة؟ افتح الدليل السريع للتكامل مع الضرائب والتوقيع الإلكتروني.' : 'Need assistance? Browse step-by-step guidance on ETA integration & digital signing.'}
                    </span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setShowTutorialModal(true)} 
                  className="btn btn-ghost" 
                  style={{ border: '1px solid rgba(255,255,255,0.15)', whiteSpace: 'nowrap', fontWeight: 700 }}
                >
                  {lang === 'ar' ? 'افتح دليل الاستخدام ↗️' : 'Open User Guide ↗️'}
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
              <h2 className="card-title">📋 {lang === 'ar' ? 'ملخص وتقرير الفحص المالي والمطابقة' : 'Invoice Pre-flight & Compliance Report'}</h2>
              <p className="card-sub">{lang === 'ar' ? 'تقييم فوري لمعدل الامتثال لشركتك وبيانات الضرائب المحلية.' : 'Immediate pre-send testing and tax validation compliance score'}</p>

              <div className="stats-summary-strip" style={{ marginBottom: '3rem' }}>
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

              {uploadResult?.parserDebugInfo && (
                <div className="card animate-fade-in" style={{ 
                  padding: '1.5rem', 
                  background: 'rgba(124, 77, 255, 0.04)', 
                  border: '1px solid rgba(124, 77, 255, 0.15)', 
                  borderRadius: 'var(--radius)', 
                  marginBottom: '2.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2rem',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div style={{ fontSize: '2.5rem' }}>🧠</div>
                    <div style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>
                      <h4 style={{ color: '#fff', margin: 0, fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {lang === 'ar' ? 'محرك الفحص والاستخراج الصناعي بالذكاء الاصطناعي نشط' : 'AI Industrial Smart Extraction Active'}
                        <span className="badge badge-accent" style={{ background: 'linear-gradient(135deg, #7c4dff, #18ffff)', color: '#0b0d19', border: 'none', fontWeight: 800, padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                          {uploadResult.parserDebugInfo.mode}
                        </span>
                      </h4>
                      <p style={{ margin: '0.4rem 0 0', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                        {lang === 'ar' 
                          ? 'تم مطابقة قطاعات الألومنيوم وفهم علاقات الوزن (KG) والطول (mm) والامتثال الضريبي (ETA).' 
                          : 'Successfully segmented aluminium profiles, weights, lengths and Egyptian ETA unit scales.'}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        fontSize: '1.8rem', 
                        fontWeight: 900, 
                        color: uploadResult.parserDebugInfo.confidenceScore > 80 ? 'var(--accent)' : '#f1c40f' 
                      }}>
                        {uploadResult.parserDebugInfo.confidenceScore || 90}%
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {lang === 'ar' ? 'معدل ثقة الذكاء الاصطناعي' : 'Extraction Confidence'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {validation?.valid ? (
                  <div className="status-banner success-banner" style={{ padding: '1.25rem' }}>
                    ✅ {lang === 'ar' ? 'اجتازت الفاتورة الفحص المحلي التلقائي بنجاح وجاهزة تماماً للإرسال.' : 'Local automated compliance validation succeeded. Fully ready to transmit.'}
                  </div>
                ) : (
                  <div className="status-banner error-banner" style={{ padding: '1.25rem' }}>
                    ✕ {lang === 'ar' ? 'تنبيه: يحتوي المستند على أخطاء يجب معالجتها محلياً قبل التوقيع.' : 'Validation errors detected. Fix local inconsistencies before submitting.'}
                  </div>
                )}

                {/* Accountant Balancing Alerts */}
                {uploadResult?.parserDebugInfo && (
                  <div className={`status-banner ${uploadResult.parserDebugInfo.totalsMatched ? 'success-banner' : 'warning-banner'}`} style={{ 
                    padding: '1.25rem',
                    background: uploadResult.parserDebugInfo.totalsMatched ? 'rgba(0, 224, 161, 0.05)' : 'rgba(241, 196, 15, 0.05)',
                    border: uploadResult.parserDebugInfo.totalsMatched ? '1px solid rgba(0, 224, 161, 0.15)' : '1px solid rgba(241, 196, 15, 0.15)',
                    color: uploadResult.parserDebugInfo.totalsMatched ? '#00e0a1' : '#f1c40f'
                  }}>
                    {uploadResult.parserDebugInfo.totalsMatched ? (
                      <div>
                        🎯 <strong>{lang === 'ar' ? 'تقرير المحاسب الذكي: الحسابات متطابقة تماماً ✓' : 'Smart Accountant Audit: Calculations balance perfectly ✓'}</strong>
                        <span style={{ display: 'block', fontSize: '0.8rem', opacity: 0.8, marginTop: '0.25rem' }}>
                          {lang === 'ar' ? 'يتطابق مجموع قيم البنود مع إجمالي الفاتورة وقيم ضريبة القيمة المضافة المحسوبة.' : 'All item sums perfectly balance with declared invoice totals and VAT tax scales.'}
                        </span>
                      </div>
                    ) : (
                      <div>
                        ⚠️ <strong>{lang === 'ar' ? 'تقرير المحاسب الذكي: هناك فارق أو عدم اتساق مالي!' : 'Smart Accountant Audit: Mathematical Inconsistencies Detected!'}</strong>
                        {uploadResult.parserDebugInfo.debugWarnings?.map((w, wIdx) => (
                          <span key={wIdx} style={{ display: 'block', fontSize: '0.8rem', opacity: 0.9, marginTop: '0.35rem' }}>
                            • {w}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Gorgeous AI Review Mode vs Excel Mode Indicator */}
              <div className="card animate-fade-in" style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, rgba(124, 77, 255, 0.08) 0%, rgba(24, 255, 255, 0.02) 100%)',
                border: '1px solid rgba(124, 77, 255, 0.25)',
                borderRadius: 'var(--radius)',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '2rem' }}>🤖</span>
                  <div style={{ textAlign: lang === 'ar' ? 'right' : 'left' }}>
                    <h4 style={{ margin: 0, fontWeight: 900, color: '#fff', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {lang === 'ar' ? 'وضع المراجعة الذكية للـ PDF نشط' : 'AI PDF Accountant Review Mode Active'}
                      <span className="badge badge-accent" style={{ background: '#7c4dff', color: '#fff', border: 'none', fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
                        {lang === 'ar' ? 'مسودة موثوقة' : 'AI Draft'}
                      </span>
                    </h4>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {lang === 'ar'
                        ? 'تم استخلاص مسودة الفاتورة تلقائياً. يرجى مراجعة وتأكيد البيانات الفوقية والبنود أدناه قبل الإرسال.'
                        : 'Draft extracted. Please verify the metadata and invoice lines below for 100% compliance.'}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span className="badge" style={{ background: 'rgba(0, 224, 161, 0.1)', color: '#00e0a1', border: '1px solid rgba(0, 224, 161, 0.2)', padding: '0.4rem 0.8rem', fontWeight: 'bold' }}>
                    {lang === 'ar' ? 'دقة المدقق: محاسبية بالكامل' : 'Auditor logic: Strict Business Rules'}
                  </span>
                </div>
              </div>

              {/* SECTION A: INVOICE METADATA & COMPANY INFO REVIEW (HEADER SECTION) */}
              <div className="card animate-fade-in" style={{
                padding: '2rem',
                background: 'rgba(255, 255, 255, 0.01)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                marginBottom: '2.5rem',
                textAlign: lang === 'ar' ? 'right' : 'left'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h4 style={{ margin: 0, fontWeight: 900, color: 'var(--accent)', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🏢 {lang === 'ar' ? 'البيانات الفوقية ومعلومات الأطراف (القسم الرئيسي)' : 'Invoice Metadata & Parties (Header Section)'}
                  </h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {lang === 'ar' ? 'يرجى مراجعة وتعديل الحقول للتأكد من مطابقة الضرائب المصرية' : 'Review and correct fields to guarantee Egyptian ETA compliance'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                  
                  {/* Invoice Number */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🔢 {lang === 'ar' ? 'رقم الفاتورة' : 'Invoice Number'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={etaDocs[0]?.internalID || ''} 
                      onChange={(e) => updateInvoiceMetadata('internalID', e.target.value)} 
                    />
                  </div>

                  {/* Date Issued */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      📅 {lang === 'ar' ? 'تاريخ الإصدار' : 'Date Issued'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={etaDocs[0]?.dateTimeIssued || ''} 
                      onChange={(e) => updateInvoiceMetadata('dateTimeIssued', e.target.value)} 
                    />
                  </div>

                  {/* Invoice Type */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      📄 {lang === 'ar' ? 'نوع المستند' : 'Document Type'}
                    </label>
                    <select
                      className="input"
                      style={{ background: '#0b0d19', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={etaDocs[0]?.documentType || 'I'}
                      onChange={(e) => updateInvoiceMetadata('documentType', e.target.value)}
                    >
                      <option value="I">{lang === 'ar' ? 'فاتورة (Invoice)' : 'Invoice (I)'}</option>
                      <option value="C">{lang === 'ar' ? 'إشعار دائن (Credit Note)' : 'Credit Note (C)'}</option>
                      <option value="D">{lang === 'ar' ? 'إشعار مدين (Debit Note)' : 'Debit Note (D)'}</option>
                    </select>
                  </div>

                  {/* Currency */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      💵 {lang === 'ar' ? 'العملة' : 'Currency'}
                    </label>
                    <select
                      className="input"
                      style={{ background: '#0b0d19', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={etaDocs[0]?.invoiceLines?.[0]?.unitValue?.currencySold || 'EGP'}
                      onChange={(e) => updateInvoiceMetadata('currency', e.target.value)}
                    >
                      <option value="EGP">EGP (جنيه مصري)</option>
                      <option value="USD">USD (دولار أمريكي)</option>
                      <option value="EUR">EUR (يورو)</option>
                    </select>
                  </div>

                  {/* Code Type */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🔑 {lang === 'ar' ? 'نوع الكود الموحد' : 'ETA Code Type'}
                    </label>
                    <select
                      className="input"
                      style={{ background: '#0b0d19', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={etaDocs[0]?.codeType || 'EGS'}
                      onChange={(e) => updateInvoiceMetadata('codeType', e.target.value)}
                    >
                      <option value="EGS">EGS (المصري الموحد)</option>
                      <option value="GS1">GS1 (العالمي المشترك)</option>
                    </select>
                  </div>

                  {/* Taxpayer Activity Code */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      ⚡ {lang === 'ar' ? 'كود النشاط الضريبي' : 'Taxpayer Activity Code'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontFamily: 'monospace' }} 
                      value={etaDocs[0]?.taxpayerActivityCode || '2410'} 
                      onChange={(e) => updateInvoiceMetadata('taxpayerActivityCode', e.target.value)} 
                    />
                  </div>

                  {/* Issuer Name */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🏢 {lang === 'ar' ? 'اسم الشركة المصدرة (المورد)' : 'Issuer Company Name'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={etaDocs[0]?.issuer?.name || ''} 
                      onChange={(e) => updateInvoiceMetadata('issuerName', e.target.value)} 
                    />
                  </div>

                  {/* Issuer VAT */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🆔 {lang === 'ar' ? 'الرقم الضريبي للمصدر' : 'Issuer VAT ID'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontFamily: 'monospace' }} 
                      value={etaDocs[0]?.issuer?.id || ''} 
                      onChange={(e) => updateInvoiceMetadata('issuerVat', e.target.value)} 
                    />
                  </div>

                  {/* Receiver Name */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🤝 {lang === 'ar' ? 'اسم العميل (المشتري)' : 'Receiver Client Name'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={etaDocs[0]?.receiver?.name || ''} 
                      onChange={(e) => updateInvoiceMetadata('receiverName', e.target.value)} 
                    />
                  </div>

                  {/* Receiver VAT */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🆔 {lang === 'ar' ? 'الرقم الضريبي للمشتري' : 'Receiver VAT ID'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontFamily: 'monospace' }} 
                      value={etaDocs[0]?.receiver?.id || ''} 
                      onChange={(e) => updateInvoiceMetadata('receiverVat', e.target.value)} 
                    />
                  </div>

                  {/* Receiver Type */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      📋 {lang === 'ar' ? 'نوع المستلم' : 'Receiver Type'}
                    </label>
                    <select
                      className="input"
                      style={{ background: '#0b0d19', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem' }} 
                      value={etaDocs[0]?.receiver?.type || 'B'}
                      onChange={(e) => updateInvoiceMetadata('receiverType', e.target.value)}
                    >
                      <option value="B">{lang === 'ar' ? 'شركة / أعمال (B)' : 'Business (B)'}</option>
                      <option value="P">{lang === 'ar' ? 'شخص (P)' : 'Person (P)'}</option>
                      <option value="F">{lang === 'ar' ? 'أجنبي (F)' : 'Foreigner (F)'}</option>
                    </select>
                  </div>

                  {/* Receiver Country */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      🌍 {lang === 'ar' ? 'دولة المستلم (ISO Code)' : 'Receiver Country Code'}
                    </label>
                    <input 
                      type="text" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontFamily: 'monospace' }} 
                      value={etaDocs[0]?.receiver?.address?.country || 'EG'} 
                      onChange={(e) => updateInvoiceMetadata('receiverCountry', e.target.value)} 
                    />
                  </div>

                  {/* Exchange Rate */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 700 }}>
                      💱 {lang === 'ar' ? 'سعر الصرف' : 'Exchange Rate'}
                    </label>
                    <input 
                      type="number" 
                      className="input" 
                      style={{ background: 'rgba(9, 11, 20, 0.6)', border: '1px solid var(--border)', color: '#fff', borderRadius: '6px', padding: '0.5rem', fontFamily: 'monospace' }} 
                      value={etaDocs[0]?.invoiceLines?.[0]?.unitValue?.currencyExchangeRate || 1} 
                      onChange={(e) => updateInvoiceMetadata('exchangeRate', e.target.value)} 
                      min="1"
                      step="0.01"
                    />
                  </div>

                </div>
              </div>

              {/* SECTION B: INVOICE LINES SECTION (Editable Lines Grid) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h4 style={{ fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>🧾 {lang === 'ar' ? 'مراجعة وتعديل بنود الفاتورة (بيئة عمل تفاعلية)' : 'Accountant Invoice Workspace (Editable Grid)'}</h4>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <button type="button" className="btn btn-accent btn-sm" onClick={addInvoiceLine}>
                    ➕ {lang === 'ar' ? 'إضافة صنف جديد' : 'Add New Item'}
                  </button>
                  <span className="badge badge-valid" style={{ background: 'rgba(0, 224, 161, 0.1)', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
                    {lang === 'ar' ? 'رقم الفاتورة:' : 'Invoice ID:'} {etaDocs[0]?.internalID}
                  </span>
                </div>
              </div>

              <div className="table-wrapper" style={{ 
                maxHeight: '650px', 
                overflowX: 'auto', 
                overflowY: 'auto', 
                border: '1px solid rgba(255, 255, 255, 0.08)', 
                borderRadius: '16px', 
                marginBottom: '3rem',
                background: 'rgba(20, 24, 46, 0.35)',
                backdropFilter: 'blur(20px)',
                boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.5)',
                padding: '1.25rem'
              }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 12px', minWidth: '1300px' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', borderBottom: 'none', width: '40px' }}>#</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', borderBottom: 'none', width: '90px' }}>Code Type</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', borderBottom: 'none', width: '170px' }}>Item Code</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', borderBottom: 'none', width: '110px' }}>Internal Code</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: lang === 'ar' ? 'right' : 'left', borderBottom: 'none', width: '300px' }}>Item Description</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', borderBottom: 'none', width: '90px' }}>Quantity</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', borderBottom: 'none', width: '100px' }}>Qty Unit</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', borderBottom: 'none', width: '70px' }}>Currency</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', borderBottom: 'none', width: '110px' }}>Unit Price EGP</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: 'center', borderBottom: 'none', width: '100px' }}>Tax</th>
                      <th style={{ padding: '1.2rem 0.5rem', color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', textAlign: lang === 'ar' ? 'left' : 'right', borderBottom: 'none', width: '160px' }}>Total</th>
                      <th style={{ padding: '1.2rem 0.5rem', borderBottom: 'none', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {etaDocs[0]?.invoiceLines?.map((line, idx) => {
                      const rawRow = uploadResult?.rows?.[idx] || {};
                      const rowConfidence = rawRow.confidence || 90;
                      const rowWarnings = rawRow.warnings || [];
                      const rowMissing = rawRow.missingFields || [];
                      const packaging = rawRow.smartAttributes?.packagingLabel || '';

                      const isRowWarning = rowConfidence < 75 || rowWarnings.length > 0 || rowMissing.length > 0;

                      return (
                        <tr key={idx} className="animate-fade-in" style={{ 
                          background: isRowWarning ? 'rgba(241, 196, 15, 0.05)' : 'rgba(255, 255, 255, 0.015)',
                          borderLeft: isRowWarning ? '4px solid #f1c40f' : '1px solid rgba(255, 255, 255, 0.04)',
                          borderRadius: '12px',
                          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)'
                        }}>
                          {/* 1. Index Column */}
                          <td style={{ padding: '1.2rem 0.5rem', textAlign: 'center', fontWeight: 'bold', verticalAlign: 'middle', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>{idx + 1}</td>
                          
                          {/* 2. Code Type Column */}
                          <td style={{ padding: '1.2rem 0.5rem', textAlign: 'center', verticalAlign: 'middle', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <select
                              className="input"
                              style={{
                                background: '#0b0d19',
                                border: '1px solid var(--border)',
                                color: '#00f5d4',
                                padding: '0.3rem 0.4rem',
                                borderRadius: '6px',
                                fontWeight: 'bold',
                                outline: 'none',
                                cursor: 'pointer',
                                width: '100%',
                                fontSize: '0.8rem',
                                textAlign: 'center'
                              }}
                              value={line.codeType || 'EGS'}
                              onChange={(e) => updateInvoiceLine(idx, 'codeType', e.target.value)}
                            >
                              <option value="EGS">EGS</option>
                              <option value="GS1">GS1</option>
                            </select>
                          </td>

                          {/* 3. Item Code Column */}
                          <td style={{ padding: '1.2rem 0.5rem', textAlign: 'center', verticalAlign: 'middle', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <input 
                              type="text" 
                              className="input" 
                              style={{ 
                                background: 'rgba(9, 11, 20, 0.6)', 
                                border: '1px solid var(--border)', 
                                borderRadius: '6px', 
                                color: '#00e0a1', 
                                fontSize: '0.8rem', 
                                padding: '0.3rem 0.4rem', 
                                width: '100%', 
                                fontFamily: 'monospace',
                                fontWeight: 'bold',
                                outline: 'none',
                                textAlign: 'center'
                              }} 
                              value={line.itemCode || ''} 
                              onChange={(e) => updateInvoiceLine(idx, 'itemCode', e.target.value)} 
                            />
                          </td>

                          {/* 4. Internal Code Column */}
                          <td style={{ padding: '1.2rem 0.5rem', textAlign: 'center', verticalAlign: 'middle', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <input 
                              type="text" 
                              className="input" 
                              style={{ 
                                background: 'rgba(9, 11, 20, 0.6)', 
                                border: '1px solid var(--border)', 
                                borderRadius: '6px', 
                                color: '#fff', 
                                fontSize: '0.8rem', 
                                padding: '0.3rem 0.4rem', 
                                width: '100%', 
                                fontFamily: 'monospace',
                                outline: 'none',
                                textAlign: 'center'
                              }} 
                              value={line.internalCode || ''} 
                              onChange={(e) => updateInvoiceLine(idx, 'internalCode', e.target.value)} 
                            />
                          </td>

                          {/* 5. Item Description Column */}
                          <td style={{ padding: '1.2rem 0.5rem', verticalAlign: 'middle', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <textarea 
                              className="input" 
                              style={{ 
                                width: '100%', 
                                background: 'rgba(255, 255, 255, 0.015)', 
                                border: '1px solid rgba(0, 245, 212, 0.25)', 
                                color: '#fff', 
                                fontSize: '0.8rem', 
                                padding: '0.4rem 0.5rem', 
                                borderRadius: '6px',
                                outline: 'none',
                                resize: 'none',
                                overflowY: 'hidden',
                                minHeight: '50px',
                                lineHeight: '1.4',
                                fontFamily: 'inherit'
                              }} 
                              data-description-autosize="true"
                              value={line.description || ''} 
                              onChange={(e) => updateInvoiceLine(idx, 'description', e.target.value)}
                              onInput={(e) => {
                                e.currentTarget.style.height = 'auto'
                                e.currentTarget.style.height = `${Math.max(e.currentTarget.scrollHeight, 50)}px`
                              }} 
                              placeholder={lang === 'ar' ? 'الوصف...' : 'Description...'}
                            />
                            {packaging && (
                              <div dir="ltr" style={{ marginTop: '0.35rem', fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 700, unicodeBidi: 'plaintext' }}>
                                {packaging}
                              </div>
                            )}
                          </td>

                          {/* 6. Quantity Column */}
                          <td style={{ padding: '1.2rem 0.5rem', verticalAlign: 'middle', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <input 
                              type="number" 
                              className="input" 
                              style={{ 
                                width: '100%', 
                                background: 'rgba(255, 255, 255, 0.02)', 
                                border: '1px solid var(--border)', 
                                color: '#fff', 
                                padding: '0.35rem', 
                                borderRadius: '6px', 
                                textAlign: 'center', 
                                fontWeight: 'bold',
                                outline: 'none',
                                fontSize: '0.85rem'
                              }} 
                              value={line.quantity || 0} 
                              onChange={(e) => updateInvoiceLine(idx, 'quantity', e.target.value)} 
                            />
                          </td>

                          {/* 7. Quantity Measurement Column */}
                          <td style={{ padding: '1.2rem 0.5rem', verticalAlign: 'middle', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <select
                                className="input"
                                style={{ 
                                  background: '#0b0d19', 
                                  border: '1px solid var(--border)', 
                                  color: 'var(--accent)', 
                                  fontSize: '0.8rem',
                                  padding: '0.35rem 0.4rem', 
                                  borderRadius: '6px', 
                                  fontWeight: 'bold',
                                  outline: 'none',
                                  cursor: 'pointer',
                                  width: '100%',
                                  textAlign: 'center'
                                }}
                                value={['LM', 'M', 'KGM', 'EA', 'BAR', 'TNE'].includes(line.unitType) ? line.unitType : 'custom'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val !== 'custom') {
                                    updateInvoiceLine(idx, 'unitType', val);
                                  } else {
                                    updateInvoiceLine(idx, 'unitType', 'custom_unit');
                                  }
                                }}
                              >
                                <option value="LM">{lang === 'ar' ? 'LM (متر طولي)' : 'LM (Linear Meter)'}</option>
                                <option value="M">{lang === 'ar' ? 'متر (M)' : 'M (Meter)'}</option>
                                <option value="KGM">{lang === 'ar' ? 'كيلوجرام (KGM)' : 'KGM (Kilogram)'}</option>
                                <option value="EA">{lang === 'ar' ? 'وحدة (EA)' : 'EA (Each)'}</option>
                                <option value="BAR">{lang === 'ar' ? 'قضيب (BAR)' : 'BAR (Bar)'}</option>
                                <option value="TNE">{lang === 'ar' ? 'طن (TNE)' : 'TNE (Ton)'}</option>
                                <option value="custom">{lang === 'ar' ? '✍️ مخصص' : '✍️ Custom'}</option>
                              </select>

                              {(!['LM', 'M', 'KGM', 'EA', 'BAR', 'TNE'].includes(line.unitType) || line.unitType === 'custom_unit') && (
                                <input 
                                  type="text"
                                  className="input"
                                  style={{ 
                                    background: 'rgba(255, 255, 255, 0.02)', 
                                    border: '1px solid var(--border)', 
                                    color: 'var(--accent)', 
                                    fontSize: '0.75rem',
                                    padding: '0.2rem', 
                                    borderRadius: '4px',
                                    textAlign: 'center',
                                    outline: 'none',
                                    width: '100%'
                                  }}
                                  placeholder={lang === 'ar' ? 'اسم الوحدة' : 'Unit code'}
                                  value={line.unitType === 'custom_unit' ? '' : line.unitType}
                                  onChange={(e) => updateInvoiceLine(idx, 'unitType', e.target.value)}
                                />
                              )}
                            </div>
                          </td>

                          {/* 8. Currency Column */}
                          <td style={{ padding: '1.2rem 0.5rem', textAlign: 'center', verticalAlign: 'middle', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>{line.unitValue?.currencySold || 'EGP'}</span>
                          </td>

                          {/* 9. Unit Price Column */}
                          <td style={{ padding: '1.2rem 0.5rem', verticalAlign: 'middle', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <input 
                              type="number" 
                              className="input" 
                              style={{ 
                                width: '100%', 
                                background: 'rgba(255, 255, 255, 0.02)', 
                                border: '1px solid var(--border)', 
                                color: '#fff', 
                                padding: '0.35rem', 
                                borderRadius: '6px', 
                                textAlign: 'center', 
                                fontWeight: 'bold',
                                outline: 'none',
                                fontSize: '0.85rem'
                              }} 
                              value={line.unitValue?.currencySold && line.unitValue.currencySold !== 'EGP' ? (line.unitValue?.amountSold || 0) : (line.unitValue?.amountEGP || 0)} 
                              onChange={(e) => updateInvoiceLine(idx, 'unitValue', e.target.value)} 
                            />
                          </td>

                          {/* 10. Tax Column */}
                          <td style={{ padding: '1.2rem 0.5rem', verticalAlign: 'middle', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                              <select 
                                className="input" 
                                style={{ 
                                  background: '#0b0d19', 
                                  border: '1px solid var(--border)', 
                                  color: '#f1c40f', 
                                  padding: '0.35rem 0.4rem', 
                                  borderRadius: '6px', 
                                  fontWeight: 'bold',
                                  outline: 'none',
                                  cursor: 'pointer',
                                  width: '100%',
                                  textAlign: 'center',
                                  fontSize: '0.8rem'
                                }} 
                                value={line.taxableItems?.[0]?.rate || 14} 
                                onChange={(e) => updateInvoiceLine(idx, 'taxPercent', e.target.value)}
                              >
                                <option value="14">14%</option>
                                <option value="5">5%</option>
                                <option value="0">0%</option>
                              </select>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                                {Number(line.taxableItems?.[0]?.amount || 0).toLocaleString(undefined, {minimumFractionDigits:4, maximumFractionDigits:4})}
                              </span>
                            </div>
                          </td>

                          {/* 11. Total Column (Before tax and total for each line) */}
                          <td style={{ padding: '1.2rem 0.5rem', verticalAlign: 'middle', textAlign: lang === 'ar' ? 'left' : 'right', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.8rem' }}>
                              <div>
                                <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{lang === 'ar' ? 'قبل:' : 'Net:'} </span>
                            <span style={{ fontWeight: 'bold', color: '#fff' }}>{Number(line.netTotal || line.salesTotal || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})} EGP</span>
                              </div>
                              <div style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.85rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '0.2rem' }}>
                                <span style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>{lang === 'ar' ? 'الكلي:' : 'Total:'} </span>
                            <span>{Number(line.total || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})} EGP</span>
                              </div>
                            </div>
                          </td>

                          {/* 12. Actions Column */}
                          <td style={{ padding: '1.2rem 0.5rem', verticalAlign: 'middle', textAlign: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                            <button 
                              type="button" 
                              className="btn btn-ghost btn-sm" 
                              style={{ color: 'var(--danger)', fontSize: '1.1rem', padding: '0.2rem' }} 
                              onClick={() => deleteInvoiceLine(idx)}
                              title={lang === 'ar' ? 'حذف هذا الصنف' : 'Delete this item'}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Gorgeous Portal-Style Totals Panel */}
              <div style={{ 
                marginTop: '2.5rem', 
                marginBottom: '2.5rem', 
                padding: '2rem', 
                background: 'rgba(255, 255, 255, 0.015)', 
                border: '1px solid var(--border)', 
                borderRadius: 'var(--radius)',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '2.5rem',
                textAlign: lang === 'ar' ? 'right' : 'left'
              }}>
                <div style={{ borderLeft: lang === 'ar' ? '1px solid var(--border)' : 'none', borderRight: lang !== 'ar' ? '1px solid var(--border)' : 'none', paddingLeft: lang === 'ar' ? '2rem' : '0', paddingRight: lang !== 'ar' ? '2rem' : '0' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.5rem' }}>
                    {lang === 'ar' ? '💵 إجمالي المبيعات (قبل الضريبة)' : '💵 Total Sales (Before Tax)'}
                  </span>
                  <strong style={{ fontSize: '1.45rem', color: '#fff' }}>
                    {Number(etaDocs[0]?.netAmount || etaDocs[0]?.totalSalesAmount || 0).toLocaleString()} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>EGP</span>
                  </strong>
                </div>
                
                <div style={{ borderLeft: lang === 'ar' ? '1px solid var(--border)' : 'none', borderRight: lang !== 'ar' ? '1px solid var(--border)' : 'none', paddingLeft: lang === 'ar' ? '2rem' : '0', paddingRight: lang !== 'ar' ? '2rem' : '0' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.5rem' }}>
                    {lang === 'ar' ? '⚡ إجمالي ضريبة القيمة المضافة (T1)' : '⚡ Total Value Added Tax (VAT T1)'}
                  </span>
                  <strong style={{ fontSize: '1.45rem', color: '#f1c40f' }}>
                    {Number(etaDocs[0]?.taxTotals?.[0]?.amount || 0).toLocaleString()} <span style={{ fontSize: '0.9rem', color: 'var(--text-dim)' }}>EGP</span>
                  </strong>
                </div>

                <div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.5rem' }}>
                    {lang === 'ar' ? '🏆 الإجمالي الكلي للفاتورة (بالضريبة)' : '🏆 Grand Invoice Total (With VAT)'}
                  </span>
                  <strong style={{ fontSize: '1.8rem', color: 'var(--accent)', fontWeight: 800 }}>
                    {Number(etaDocs[0]?.totalAmount || 0).toLocaleString()} <span style={{ fontSize: '1.1rem', color: 'var(--text-dim)' }}>EGP</span>
                  </strong>
                </div>
              </div>

              <div className="expandable-advanced" style={{ marginTop: '2.5rem', marginBottom: '1.5rem' }}>
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

              <div className="nav-actions" style={{ marginTop: '4rem' }}>
                <button className="btn btn-ghost" onClick={() => setStep(2)}>← {lang === 'ar' ? 'السابق' : 'Back'}</button>
                <button 
                  className={`btn ${validation?.valid ? 'btn-primary' : 'btn-warning'}`} 
                  onClick={handleTriggerETA} 
                  disabled={submitting}
                  style={{
                    opacity: submitting ? 0.7 : 1,
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
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

      {/* ─── PREMIUM TUTORIAL POP-UP MODAL ─── */}
      {showTutorialModal && (
        <div className="modal-backdrop glassmorphism-heavy" style={{ zIndex: 20000 }}>
          <div className="modal-card animate-zoom" style={{ width: '850px', height: '760px', maxWidth: '95vw', maxHeight: '95vh', display: 'flex', flexDirection: 'column', background: '#090b14', border: '1px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)', padding: '2rem', borderRadius: '16px' }}>
            <div className="modal-header" style={{ flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexDirection: lang === 'ar' ? 'row-reverse' : 'row' }}>
              <h3 style={{ margin: 0, color: 'var(--accent)', fontWeight: 800, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📖 {lang === 'ar' ? 'دليل الاستخدام خطوة بخطوة' : 'Step-by-Step Operations Guide'}
              </h3>
              <button 
                type="button" 
                className="btn-close-modal" 
                onClick={() => {
                  setShowTutorialModal(false);
                  localStorage.setItem('fawterx_tutorial_seen', 'true');
                }}
                style={{ cursor: 'pointer', fontSize: '1.2rem', background: 'transparent', border: 'none', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 0.5rem' }}>
              {/* Smooth Fading Transition Container */}
              <div style={{ opacity: isSlideFading ? 0 : 1, transform: isSlideFading ? 'scale(0.98)' : 'scale(1)', transition: 'all 0.18s ease-in-out', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                {/* Step Title Indicator */}
                <div style={{ 
                  flexShrink: 0,
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '1.25rem',
                  flexDirection: lang === 'ar' ? 'row-reverse' : 'row'
                }}>
                  <h4 style={{ color: 'var(--text)', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
                    {lang === 'ar' ? TUTORIAL_STEPS[tipSlide].titleAr : TUTORIAL_STEPS[tipSlide].titleEn}
                  </h4>
                  <span style={{ 
                    background: 'rgba(0, 224, 161, 0.1)', 
                    color: 'var(--accent)', 
                    padding: '0.25rem 0.75rem', 
                    borderRadius: '20px', 
                    fontSize: '0.85rem', 
                    fontWeight: 700 
                  }}>
                    {lang === 'ar' ? `الخطوة ${tipSlide + 1} من 10` : `Step ${tipSlide + 1} of 10`}
                  </span>
                </div>

                {/* Active Step Image */}
                <div style={{ 
                  flexShrink: 0,
                  height: '300px',
                  position: 'relative', 
                  borderRadius: '12px', 
                  overflow: 'hidden', 
                  background: '#0b0d19', 
                  border: '1px solid rgba(255,255,255,0.05)', 
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <img 
                    src={tipSlide === 0 ? '/Step 1.png' : `/step ${tipSlide + 1}.png`} 
                    alt={`Step ${tipSlide + 1}`} 
                    style={{ 
                      maxHeight: '100%', 
                      maxWidth: '100%', 
                      objectFit: 'contain', 
                      display: 'block',
                      transition: 'opacity 0.3s ease'
                    }} 
                  />
                </div>

                {/* Step Description */}
                <p style={{ 
                  flex: 1,
                  overflowY: 'auto',
                  color: 'var(--text)', 
                  fontSize: '1.05rem', 
                  lineHeight: '1.75', 
                  textAlign: lang === 'ar' ? 'right' : 'left',
                  margin: '0 0 1.25rem 0',
                  maxHeight: '130px',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  {lang === 'ar' ? TUTORIAL_STEPS[tipSlide].descAr : TUTORIAL_STEPS[tipSlide].descEn}
                </p>
              </div>
            </div>

            <div className="modal-footer" style={{ 
              flexShrink: 0,
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              paddingTop: '1.25rem',
              flexDirection: lang === 'ar' ? 'row-reverse' : 'row'
            }}>
              {/* Previous Button */}
              <button 
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={tipSlide === 0}
                onClick={() => handleSlideChange(Math.max(0, tipSlide - 1))}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  opacity: tipSlide === 0 ? 0.4 : 1,
                  cursor: tipSlide === 0 ? 'not-allowed' : 'pointer',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '0.5rem 1rem'
                }}
              >
                {lang === 'ar' ? '← السابق' : '← Previous'}
              </button>

              {/* Dot Indicators */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {TUTORIAL_STEPS.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSlideChange(idx)}
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      border: 'none',
                      background: tipSlide === idx ? 'var(--accent)' : 'rgba(255, 255, 255, 0.2)',
                      boxShadow: tipSlide === idx ? '0 0 8px var(--accent)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease'
                    }}
                    title={`Go to Step ${idx + 1}`}
                  />
                ))}
              </div>

              {/* Next Button or Close CTA */}
              {tipSlide < 9 ? (
                <button 
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleSlideChange(Math.min(9, tipSlide + 1))}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '0.5rem 1rem'
                  }}
                >
                  {lang === 'ar' ? 'التالي →' : 'Next →'}
                </button>
              ) : (
                <button 
                  type="button"
                  className="btn btn-accent btn-sm"
                  onClick={() => {
                    setShowTutorialModal(false);
                    localStorage.setItem('fawterx_tutorial_seen', 'true');
                  }}
                  style={{ 
                    fontWeight: 700,
                    boxShadow: '0 4px 12px rgba(0, 224, 161, 0.2)',
                    padding: '0.5rem 1.25rem'
                  }}
                >
                  {lang === 'ar' ? '🚀 ابدأ التحويل الآن' : '🚀 Start Converting Now'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function cleanObject(obj) {
  if (typeof obj === 'number') {
    return parseFloat(obj.toFixed(5));
  }
  if (Array.isArray(obj)) {
    return obj
      .map(v => (v !== null && v !== undefined ? cleanObject(v) : v))
      .filter(v => v !== null && v !== undefined && v !== "");
  } else if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value === null || value === undefined || value === "") return acc;
      if (Array.isArray(value) && value.length === 0) return acc;
      
      const cleanedValue = cleanObject(value);
      
      if (typeof cleanedValue === 'object' && !Array.isArray(cleanedValue) && Object.keys(cleanedValue).length === 0) return acc;
      if (Array.isArray(cleanedValue) && cleanedValue.length === 0) return acc;

      acc[key] = cleanedValue;
      return acc;
    }, {});
  }
  return obj;
}

function escapeJsonString(str) {
  if (typeof str !== 'string') str = String(str);
  let result = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = str.charCodeAt(i);
    switch (char) {
      case '"': result += '\\"'; break;
      case '\\': result += '\\\\'; break;
      case '\n': result += '\\n'; break;
      case '\r': result += '\\r'; break;
      case '\t': result += '\\t'; break;
      case '\f': result += '\\f'; break;
      case '\b': result += '\\b'; break;
      default:
        if (code < 32) {
          result += '\\u' + code.toString(16).padStart(4, '0');
        } else {
          result += char;
        }
        break;
    }
  }
  return `"${result}"`;
}

function serializeToken(object) {
  let serialized = "";
  // ETA canonicalization follows the JSON property insertion order. Sorting keys changes
  // the byte stream that ETA recalculates and causes 4043 message-digest mismatches.
  const keys = Object.keys(object);
  for (const key of keys) {
    const val = object[key];
    if (key === "signatures" || val === null || val === undefined) {
      continue;
    }
    serialized += `"${key.toUpperCase()}"`;
    if (Array.isArray(val)) {
      for (const item of val) {
        serialized += `"${key.toUpperCase()}"`;
        if (item !== null && typeof item === "object") {
          serialized += serializeToken(item);
        } else {
          serialized += typeof item === "string" ? escapeJsonString(item) : `"${item.toString()}"`;
        }
      }
    } else if (typeof val === "object") {
      serialized += serializeToken(val);
    } else {
      serialized += typeof val === "string" ? escapeJsonString(val) : `"${val.toString()}"`;
    }
  }
  return serialized;
}
