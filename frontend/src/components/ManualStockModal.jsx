import { useState, useMemo, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { processManualStockMovement, getWarehouseInvoices, getInvoiceMovements } from '../services/warehouseApi'

export default function ManualStockModal({
  isOpen,
  onClose,
  initialMode = 'inbound', // 'inbound' | 'outbound'
  projectId,
  projectName,
  projects = [],
  onSelectProject,
  stock = [],
  preselectedItems = [],
  onSuccess,
  isAr = true,
}) {
  if (!isOpen) return null

  const [activeProjectId, setActiveProjectId] = useState(projectId)
  const [mode, setMode] = useState(initialMode) // 'inbound' | 'outbound'
  const [sourceType, setSourceType] = useState('manual') // 'manual' | 'invoice'
  const [dispatchType, setDispatchType] = useState('coating_then_customer') // 'coating_then_customer' | 'direct_customer'
  const [submitting, setSubmitting] = useState(false)

  // Dispatch / Lifecycle metadata (Only coatingSupplier is mandatory for coating)
  const [coatingSupplier, setCoatingSupplier] = useState('شركة كانكس للدهانات الحديثة (Canex Coating)')
  const [targetFinish, setTargetFinish] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [projectNameOrSite, setProjectNameOrSite] = useState('')
  const [deliveryNote, setDeliveryNote] = useState('')
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  // Inbound metadata
  const [inboundSupplier, setInboundSupplier] = useState('CANEX')
  const [salesOrder, setSalesOrder] = useState('')
  const [customerRef, setCustomerRef] = useState('')
  const [docNumber, setDocNumber] = useState('')

  // Invoice-based selection state
  const [inboundInvoicesList, setInboundInvoicesList] = useState([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [loadingInvoiceLines, setLoadingInvoiceLines] = useState(false)
  const [lineSearchFilter, setLineSearchFilter] = useState('')

  // Manual Lines to process
  const [lines, setLines] = useState(() => {
    if (preselectedItems && preselectedItems.length > 0) {
      return preselectedItems.map((item) => ({
        selected: true,
        itemKey: item.itemKey,
        itemCode: item.itemCode,
        customerCode: item.customerCode || '',
        description: item.description || '',
        finish: item.finish || 'STD',
        lengthMm: item.lengthMm || 6000,
        quantityBar: item.quantityBar > 0 ? 1 : 1,
        availableBar: item.quantityBar || 0,
        quantityLm: ((item.lengthMm || 6000) * 1) / 1000,
        quantityKg: item.quantityKg || 0,
        unitPrice: item.lastUnitCost || 0,
        supplier: item.supplier || 'CANEX',
      }))
    }
    return [
      {
        selected: true,
        itemKey: '',
        itemCode: '',
        customerCode: '',
        description: '',
        finish: 'STD',
        lengthMm: 6000,
        quantityBar: 1,
        availableBar: 0,
        quantityLm: 6.0,
        quantityKg: 0,
        unitPrice: 0,
        supplier: 'CANEX',
      },
    ]
  })

  // Keep active project in sync
  useEffect(() => {
    if (projectId) setActiveProjectId(projectId)
  }, [projectId])

  // Load Inbound Invoices when Switching to 'invoice' source
  useEffect(() => {
    if (sourceType === 'invoice' && activeProjectId) {
      setLoadingInvoices(true)
      getWarehouseInvoices(activeProjectId)
        .then((res) => {
          const invs = res.invoices || []
          // Filter to inbound invoices or show all
          setInboundInvoicesList(invs.filter((i) => !i.movementType || i.movementType === 'inbound'))
        })
        .catch((err) => {
          console.error('Failed to load invoices:', err)
          toast.error(isAr ? 'تعذر جلب قائمة الفواتير السابقة' : 'Failed to load invoices')
        })
        .finally(() => setLoadingInvoices(false))
    }
  }, [sourceType, activeProjectId, isAr])

  // Fetch movements of selected invoice and populate lines
  const handleSelectInvoice = async (invId) => {
    setSelectedInvoiceId(invId)
    if (!invId) return

    setLoadingInvoiceLines(true)
    try {
      const res = await getInvoiceMovements(activeProjectId, invId)
      const movements = res.movements || []

      // Map invoice movements to lines with available stock check
      const mappedLines = movements.map((m) => {
        const foundStock = stock.find((s) => s.itemKey === m.itemKey || (s.itemCode === m.itemCode && s.finish === m.finish))
        const avail = foundStock ? Number(foundStock.quantityBar || 0) : 0
        const invQty = Number(m.quantityBar || m.quantity || 1)
        const len = Number(m.lengthMm || (foundStock ? foundStock.lengthMm : 6000) || 6000)
        const defaultQty = Math.max(1, avail > 0 ? Math.min(invQty, avail) : invQty)

        return {
          selected: true,
          itemKey: m.itemKey || (foundStock ? foundStock.itemKey : ''),
          itemCode: m.itemCode || (foundStock ? foundStock.itemCode : 'CODE'),
          customerCode: m.customerCode || (foundStock ? foundStock.customerCode : '') || '',
          description: m.description || (foundStock ? foundStock.description : '') || '',
          finish: m.finish || (foundStock ? foundStock.finish : 'STD') || 'STD',
          lengthMm: len,
          invoicedBar: invQty,
          availableBar: avail,
          quantityBar: defaultQty,
          quantityLm: (defaultQty * len) / 1000,
          quantityKg: m.quantityKg || (foundStock ? foundStock.quantityKg : 0) || 0,
          unitPrice: m.unitPrice || (foundStock ? foundStock.lastUnitCost : 0) || 0,
          supplier: m.supplier || (foundStock ? foundStock.supplier : 'CANEX') || 'CANEX',
        }
      })

      // Robust Stock Reconciliation: Check if any stock items are tied to this invoice number
      const selectedInv = inboundInvoicesList.find((i) => i.id === invId)
      const selectedInvNum = String(selectedInv?.invoiceNumber || '').trim().toLowerCase()

      if (selectedInvNum && Array.isArray(stock)) {
        const existingCodes = new Set(mappedLines.map((l) => String(l.itemCode || '').trim().toLowerCase()))
        stock.forEach((s) => {
          const sCode = String(s.itemCode || '').trim().toLowerCase()
          if (existingCodes.has(sCode)) return

          const invList = Array.isArray(s.invoiceNumbers)
            ? s.invoiceNumbers
            : [s.lastInvoiceNumber, s.invoiceNumber].filter(Boolean)

          const matchesInv = invList.some((n) => String(n || '').trim().toLowerCase() === selectedInvNum)
          if (matchesInv) {
            const avail = Number(s.quantityBar || 0)
            const len = Number(s.lengthMm || 6000)
            const defaultQty = Math.max(1, avail)
            mappedLines.push({
              selected: true,
              itemKey: s.itemKey,
              itemCode: s.itemCode,
              customerCode: s.customerCode || '',
              description: s.description || '',
              finish: s.finish || 'STD',
              lengthMm: len,
              invoicedBar: avail,
              availableBar: avail,
              quantityBar: defaultQty,
              quantityLm: (defaultQty * len) / 1000,
              quantityKg: s.quantityKg || 0,
              unitPrice: s.lastUnitCost || 0,
              supplier: s.supplier || 'CANEX',
            })
            existingCodes.add(sCode)
          }
        })
      }

      if (mappedLines.length === 0) {
        toast.error(isAr ? 'لا توجد بنود مسجلة لهذه الفاتورة' : 'No line items found for this invoice')
        return
      }

      setLines(mappedLines)
      toast.success(
        isAr
          ? `تم استيراد ${mappedLines.length} بند من الفاتورة. يمكنك صرفها كاملة أو تحديد بنود معينة.`
          : `Loaded ${mappedLines.length} invoice items. You can dispense all or select specific items.`
      )
    } catch (err) {
      console.error('Error fetching invoice movements:', err)
      toast.error(isAr ? 'فشل جلب تفاصيل الفاتورة' : 'Failed to fetch invoice details')
    } finally {
      setLoadingInvoiceLines(false)
    }
  }

  // Common quick finishing options
  const FINISH_SUGGESTIONS = [
    'RAL 9005 Matt Black (أسود مط)',
    'RAL 9016 White (أبيض ناصع)',
    'RAL 7016 Anthracite Grey (رمادي فحمي)',
    'RAL 7024 Graphite (جرافيت)',
    'RAL 8019 Grey Brown (بني محروق)',
    'RAL 1013 Oyster White (أوف وايت / بيج)',
    'Silver Anodized (أنودايز فضي طبيعي)',
    'Champagne Anodized (أنودايز شامبين)',
    'Bronze Anodized (أنودايز برونزي)',
    'Wood Finish (تأثير خشب)',
    'Mill Finish / Raw (خام غير مدهون)',
  ]

  const COATING_SUPPLIERS = [
    'شركة كانكس للدهانات الحديثة (Canex Coating)',
    'الورشة الفنية للدهان الإلكتروستاتيك (Modern Electrostatic)',
    'مصنع الأهرام للطلاء والأنودايز (Al-Ahram Anodizing)',
    'شركة تكنوكوت الدولية (TechnoCoat Powder)',
    'المصرية لدهانات الألومنيوم (Egyptian Powder Coating)',
    'أخرى / مورد خارجي',
  ]

  // Handler to select an existing item for a line
  const handleSelectStockItem = (index, selectedItemKey) => {
    const found = stock.find((s) => s.itemKey === selectedItemKey)
    if (!found) return

    setLines((prev) => {
      const copy = [...prev]
      const len = found.lengthMm || 6000
      const currentBar = copy[index].quantityBar || 1
      copy[index] = {
        ...copy[index],
        itemKey: found.itemKey,
        itemCode: found.itemCode,
        customerCode: found.customerCode || '',
        description: found.description || '',
        finish: found.finish || 'STD',
        lengthMm: len,
        availableBar: found.quantityBar || 0,
        quantityBar: currentBar,
        quantityLm: (currentBar * len) / 1000,
        quantityKg: found.quantityKg || 0,
        unitPrice: found.lastUnitCost || 0,
        supplier: found.supplier || 'CANEX',
      }
      return copy
    })
  }

  const handleUpdateLine = (index, field, value) => {
    setLines((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }

      const len = Number(copy[index].lengthMm || 6000)
      const bar = Number(copy[index].quantityBar || 0)

      if (field === 'quantityBar' || field === 'lengthMm') {
        copy[index].quantityLm = (bar * len) / 1000
      }
      return copy
    })
  }

  const handleToggleSelectAll = (checked) => {
    setLines((prev) => prev.map((l) => ({ ...l, selected: checked })))
  }

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        selected: true,
        isManualAdd: true,
        itemKey: '',
        itemCode: '',
        customerCode: '',
        description: '',
        finish: 'STD',
        lengthMm: 6000,
        quantityBar: 1,
        availableBar: 0,
        quantityLm: 6.0,
        quantityKg: 0,
        unitPrice: 0,
        supplier: 'CANEX',
      },
    ])
  }

  const handleRemoveLine = (index) => {
    if (lines.length <= 1) {
      toast.error(isAr ? 'يجب الإبقاء على بند واحد على الأقل' : 'Keep at least one item')
      return
    }
    setLines((prev) => prev.filter((_, idx) => idx !== index))
  }

  // Aggregates for selected lines
  const activeSelectedLines = useMemo(() => {
    if (sourceType === 'invoice') {
      return lines.filter((l) => l.selected && Number(l.quantityBar || 0) > 0)
    }
    return lines
  }, [lines, sourceType])

  // Filtered lines based on user search query in modal (preserves originalIndex for accurate updates)
  const filteredLines = useMemo(() => {
    const q = lineSearchFilter.trim().toLowerCase()
    if (!q) return lines.map((line, originalIndex) => ({ line, originalIndex }))

    return lines
      .map((line, originalIndex) => ({ line, originalIndex }))
      .filter(({ line }) => {
        const text = [
          line.itemCode,
          line.customerCode,
          line.description,
          line.finish,
          line.lengthMm,
          line.supplier,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return text.includes(q)
      })
  }, [lines, lineSearchFilter])

  const totalBars = useMemo(() => {
    return activeSelectedLines.reduce((acc, curr) => acc + Number(curr.quantityBar || 0), 0)
  }, [activeSelectedLines])

  const totalLm = useMemo(() => {
    return activeSelectedLines.reduce((acc, curr) => acc + Number(curr.quantityLm || 0), 0)
  }, [activeSelectedLines])

  const totalEstimatedCost = useMemo(() => {
    return activeSelectedLines.reduce((acc, curr) => acc + Number(curr.quantityBar || 0) * Number(curr.unitPrice || 0), 0)
  }, [activeSelectedLines])

  const allSelected = useMemo(() => {
    return lines.length > 0 && lines.every((l) => l.selected)
  }, [lines])

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!activeProjectId) {
      toast.error(isAr ? 'يرجى تحديد المشروع أو المستودع' : 'Please select project')
      return
    }

    const validLines = activeSelectedLines.filter((l) => l.itemCode && Number(l.quantityBar) > 0)

    if (validLines.length === 0) {
      toast.error(isAr ? 'يرجى تحديد الأصناف والكميات المراد تنفيذ الحركة عليها' : 'Please select items and valid quantities')
      return
    }

    // Outbound Validations
    if (mode === 'outbound') {
      for (const line of validLines) {
        if (line.availableBar !== undefined && Number(line.quantityBar) > Number(line.availableBar)) {
          toast.error(
            isAr
              ? `الكمية المطلوبة للصنف (${line.itemCode}) [${line.quantityBar} عود] تتجاوز الرصيد المتاح بالمخزن [${line.availableBar} عود]`
              : `Requested quantity for (${line.itemCode}) exceeds available stock (${line.availableBar})`
          )
          return
        }
      }

      // Only coating supplier is mandatory if coating stage
      if (dispatchType === 'coating_then_customer' && !coatingSupplier.trim()) {
        toast.error(isAr ? 'يرجى تحديد اسم مورد / ورشة الدهان (إجباري)' : 'Please specify coating supplier (mandatory)')
        return
      }
    }

    setSubmitting(true)
    try {
      const resolvedCustomerName = customerName.trim() || (isAr ? 'عميل عام / قيد التحديد' : 'General Customer / TBD')
      const resolvedTargetFinish = targetFinish.trim() || (isAr ? 'حسب أمر التشغيل / قياسي' : 'Standard / As per Order')

      const payload = {
        movementType: mode,
        lines: validLines,
        meta: {
          supplier: mode === 'inbound' ? inboundSupplier : 'CANEX',
          salesOrder,
          customerReference: customerRef,
          docNumber: deliveryNote || docNumber || (selectedInvoiceId ? `FROM-INV-${selectedInvoiceId}` : ''),
          notes,
        },
        dispatchDetails:
          mode === 'outbound'
            ? {
                dispatchType,
                coatingSupplier: dispatchType === 'coating_then_customer' ? coatingSupplier : 'تسليم مباشر',
                targetFinish: dispatchType === 'coating_then_customer' ? resolvedTargetFinish : 'تسليم فوري',
                customerName: resolvedCustomerName,
                projectNameOrSite: projectNameOrSite || (isAr ? 'الموقع العام' : 'General Site'),
                deliveryNote: deliveryNote || `DSP-${Date.now().toString().slice(-6)}`,
                dispatchDate,
                notes,
              }
            : null,
      }

      const res = await processManualStockMovement(activeProjectId, payload)
      if (res && res.success) {
        const isOut = mode === 'outbound'
        const msgAr = isOut
          ? dispatchType === 'coating_then_customer'
            ? `✅ تم صرف ${totalBars} عود بنجاح وإرسالها لمرحلة الدهان لدى (${coatingSupplier})!`
            : `✅ تم صرف وتسليم ${totalBars} عود للعميل النهائي (${resolvedCustomerName}) مباشرة وإغلاق العملية!`
          : `✅ تم توريد ${totalBars} عود بنجاح وإضافتها لرصيد المخزن!`

        const msgEn = isOut
          ? `Dispatched ${totalBars} bars successfully!`
          : `Added ${totalBars} bars to stock successfully!`

        toast.success(isAr ? msgAr : msgEn)
        if (onSuccess) onSuccess(res)
        onClose()
      } else {
        toast.error(res?.message || (isAr ? 'فشلت معالجة الحركة اليدوية' : 'Failed to process movement'))
      }
    } catch (err) {
      console.error('Manual movement error:', err)
      toast.error(err.response?.data?.message || err.message || (isAr ? 'حدث خطأ أثناء تنفيذ الحركة' : 'Error processing movement'))
    } finally {
      setSubmitting(false)
    }
  }

  const activeProjectObject = projects.find((p) => p.id === activeProjectId) || { name: projectName || 'المستودع الرئيسي' }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#121629',
          border: `1px solid ${mode === 'outbound' ? 'rgba(255, 71, 87, 0.4)' : 'rgba(0, 224, 161, 0.4)'}`,
          borderRadius: '16px',
          maxWidth: '1100px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.1rem 1.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: mode === 'outbound' ? 'linear-gradient(90deg, rgba(255,71,87,0.1) 0%, rgba(18,22,41,0.5) 100%)' : 'linear-gradient(90deg, rgba(0,224,161,0.1) 0%, rgba(18,22,41,0.5) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.6rem' }}>{mode === 'outbound' ? '📤' : '📥'}</span>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                {mode === 'outbound'
                  ? (isAr ? 'صرف وتتبع مراحل القطاعات (Outbound Dispatch)' : 'Outbound Profile Dispatch')
                  : (isAr ? 'توريد يدوي للقطاعات (Manual Stock Supply)' : 'Manual Stock Supply')}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {isAr ? 'المستودع / المشروع:' : 'Warehouse / Project:'}
                </span>
                {projects && projects.length > 1 ? (
                  <select
                    value={activeProjectId}
                    onChange={(e) => {
                      setActiveProjectId(e.target.value)
                      if (onSelectProject) onSelectProject(e.target.value)
                    }}
                    style={{
                      background: '#1a1f3a',
                      color: '#00e0a1',
                      border: '1px solid rgba(0, 224, 161, 0.4)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code || 'CODE'})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="badge" style={{ background: 'rgba(0, 224, 161, 0.15)', color: '#00e0a1', border: '1px solid rgba(0, 224, 161, 0.3)', fontSize: '0.8rem' }}>
                    {activeProjectObject.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {/* Mode Switcher */}
            <div style={{ display: 'flex', background: '#0a0d1a', padding: '0.25rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <button
                type="button"
                className={`btn btn-sm ${mode === 'inbound' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setMode('inbound')}
                style={{ borderRadius: '7px', fontWeight: 700 }}
              >
                📥 {isAr ? 'توريد (+)' : 'Inbound'}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setMode('outbound')}
                style={{
                  borderRadius: '7px',
                  fontWeight: 700,
                  background: mode === 'outbound' ? '#ff4757' : 'transparent',
                  borderColor: mode === 'outbound' ? '#ff4757' : 'transparent',
                  color: '#fff',
                }}
              >
                📤 {isAr ? 'صرف بمراحل (-)' : 'Outbound'}
              </button>
            </div>

            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: '0.4rem 0.75rem', borderRadius: '50%', color: 'var(--text-muted)' }}
              title={isAr ? 'إغلاق' : 'Close'}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
          <form id="manual-stock-form" onSubmit={handleSubmit}>
            
            {/* ─── SOURCE PICKER: Manual Profile vs From Inbound Invoice ─── */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                {isAr ? 'طريقة اختيار البنود:' : 'Item Selection Source:'}
              </span>
              <button
                type="button"
                className={`btn btn-sm ${sourceType === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSourceType('manual')}
                style={{ borderRadius: '8px', fontWeight: 700, fontSize: '0.82rem' }}
              >
                📋 {isAr ? 'اختيار وتحديد يدوي للقطاعات' : 'Manual Profile Entry'}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${sourceType === 'invoice' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSourceType('invoice')}
                style={{
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  background: sourceType === 'invoice' ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'transparent',
                  borderColor: sourceType === 'invoice' ? '#3b82f6' : 'var(--border)',
                  color: '#fff',
                }}
              >
                🧾 {isAr ? 'استيراد وصرف من فاتورة واردة مسجلة' : 'From Recorded Inbound Invoice'}
              </button>
            </div>

            {/* If Source Type === Invoice: Invoice Selector Card */}
            {sourceType === 'invoice' && (
              <div
                className="fade-in"
                style={{
                  background: 'rgba(59, 130, 246, 0.06)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '1.1rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <label style={{ fontWeight: 800, color: '#60a5fa', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    🧾 {isAr ? 'اختر الفاتورة الواردة المراد صرفها (أو جزء منها):' : 'Select Inbound Invoice to Dispense:'}
                  </label>
                  {loadingInvoices && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>⏳ {isAr ? 'جاري جلب الفواتير...' : 'Loading invoices...'}</span>}
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => handleSelectInvoice(e.target.value)}
                    disabled={loadingInvoices || loadingInvoiceLines}
                    style={{
                      flex: 1,
                      minWidth: '280px',
                      background: '#101426',
                      color: '#ffffff',
                      border: '1px solid #3b82f6',
                      padding: '0.6rem 1rem',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">-- {isAr ? 'اختر فاتورة من القائمة...' : 'Select an invoice...'} --</option>
                    {inboundInvoicesList.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber || inv.id} | {inv.supplier || 'CANEX'} | {(inv.totalQuantityBar || 0).toLocaleString()} عود | {inv.salesOrder ? `SO: ${inv.salesOrder}` : ''} | {inv.issueDate || ''}
                      </option>
                    ))}
                  </select>

                  {selectedInvoiceId && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleSelectInvoice(selectedInvoiceId)}
                      disabled={loadingInvoiceLines}
                      style={{ padding: '0.6rem 0.9rem', borderRadius: '8px' }}
                    >
                      {loadingInvoiceLines ? <span className="spinner"></span> : '🔄 ' + (isAr ? 'إعادة تحميل البنود' : 'Reload Lines')}
                    </button>
                  )}
                </div>

                {selectedInvoiceId && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#93c5fd', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <span>💡 {isAr ? 'تم جلب كافة بنود الفاتورة. يمكنك الضغط على "تحديد الكل" لصرف الفاتورة بأكملها، أو تعديل كمية أي بند تريده.' : 'Loaded all invoice items. You can select all to dispense the entire invoice or tweak specific quantities.'}</span>
                  </div>
                )}
              </div>
            )}

            {/* ─── OUTBOUND LIFECYCLE & STAGE SELECTOR (Only in Outbound Mode) ─── */}
            {mode === 'outbound' && (
              <div
                style={{
                  background: 'rgba(255, 71, 87, 0.05)',
                  border: '1px solid rgba(255, 71, 87, 0.25)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#ff6b81', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🎨 {isAr ? 'حدد خط سير ومراحل صرف القطاعات:' : 'Dispatch Workflow & Lifecycle:'}
                </div>

                {/* Workflow Selector Radios */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                  {/* Option 1: 2 Stages (Coating -> Customer) */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '1rem',
                      background: dispatchType === 'coating_then_customer' ? 'rgba(0, 224, 161, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${dispatchType === 'coating_then_customer' ? '#00e0a1' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="dispatchType"
                      value="coating_then_customer"
                      checked={dispatchType === 'coating_then_customer'}
                      onChange={() => setDispatchType('coating_then_customer')}
                      style={{ marginTop: '0.25rem', accentColor: '#00e0a1' }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.95rem' }}>
                        1️⃣ {isAr ? 'مرحلتين (مورد دهان ⬅️ ثم عميل نهائي)' : '2 Stages (Coating Supplier ➡️ Customer)'}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        {isAr
                          ? 'تخرج القطاعات من رصيد المخزن الخام وتبقى قيد المتابعة لدى مورد الدهان حتى إتمام تسليمها للعميل.'
                          : 'Profiles leave raw stock and remain tracked at coating supplier until final customer delivery.'}
                      </div>
                    </div>
                  </label>

                  {/* Option 2: 1 Stage (Direct Delivery) */}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '1rem',
                      background: dispatchType === 'direct_customer' ? 'rgba(0, 224, 161, 0.08)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${dispatchType === 'direct_customer' ? '#00e0a1' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="dispatchType"
                      value="direct_customer"
                      checked={dispatchType === 'direct_customer'}
                      onChange={() => setDispatchType('direct_customer')}
                      style={{ marginTop: '0.25rem', accentColor: '#00e0a1' }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, color: '#ffffff', fontSize: '0.95rem' }}>
                        2️⃣ {isAr ? 'مرحلة واحدة (تسليم مباشر للعميل النهائي)' : '1 Stage (Direct Customer Delivery)'}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                        {isAr
                          ? 'صرف فوري ومباشر لقطاعات جاهزة ومدهونة لموقع العميل وإغلاق العملية مباشرة.'
                          : 'Immediate delivery for ready/finished profiles directly to customer site.'}
                      </div>
                    </div>
                  </label>
                </div>

                {/* Stage 1 Fields: Coating Details (Only coatingSupplier is mandatory) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  {dispatchType === 'coating_then_customer' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: '#ff6b81' }}>
                        🏭 {isAr ? 'مورد / ورشة الدهان * (إجباري)' : 'Coating Supplier * (Mandatory)'}
                      </label>
                      <input
                        type="text"
                        list="coating-suppliers-list"
                        value={coatingSupplier}
                        onChange={(e) => setCoatingSupplier(e.target.value)}
                        placeholder={isAr ? 'اختر أو اكتب اسم الورشة...' : 'Workshop or painter name...'}
                        required
                        style={{
                          width: '100%',
                          background: '#101223',
                          border: '1px solid #ff4757',
                          padding: '0.55rem 0.85rem',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                      />
                      <datalist id="coating-suppliers-list">
                        {COATING_SUPPLIERS.map((s) => (
                          <option key={s} value={s} />
                        ))}
                      </datalist>
                    </div>
                  )}

                  {dispatchType === 'coating_then_customer' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: '#fff' }}>
                        🎨 {isAr ? 'اللون / التشطيب المطلوب (اختياري)' : 'Target Finish / RAL (Optional)'}
                      </label>
                      <input
                        type="text"
                        list="target-finish-list"
                        value={targetFinish}
                        onChange={(e) => setTargetFinish(e.target.value)}
                        placeholder={isAr ? 'مثال: RAL 9005 أسود مط...' : 'e.g. RAL 9005 Matt Black'}
                        style={{
                          width: '100%',
                          background: '#101223',
                          border: '1px solid var(--border)',
                          padding: '0.55rem 0.85rem',
                          borderRadius: '8px',
                          color: '#fff',
                        }}
                      />
                      <datalist id="target-finish-list">
                        {FINISH_SUGGESTIONS.map((f) => (
                          <option key={f} value={f} />
                        ))}
                      </datalist>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: '#fff' }}>
                      👤 {isAr ? 'اسم العميل النهائي (اختياري)' : 'Customer Name (Optional)'}
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={isAr ? 'اسم العميل أو جهة التسليم...' : 'Customer or receiver name...'}
                      style={{
                        width: '100%',
                        background: '#101223',
                        border: '1px solid var(--border)',
                        padding: '0.55rem 0.85rem',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: '#fff' }}>
                      🏢 {isAr ? 'المشروع / وجهة التسليم (اختياري)' : 'Project / Destination Site'}
                    </label>
                    <input
                      type="text"
                      value={projectNameOrSite}
                      onChange={(e) => setProjectNameOrSite(e.target.value)}
                      placeholder={isAr ? 'مثال: مول التجمع / برج الياسمين...' : 'e.g. Site name...'}
                      style={{
                        width: '100%',
                        background: '#101223',
                        border: '1px solid var(--border)',
                        padding: '0.55rem 0.85rem',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: '#fff' }}>
                      📄 {isAr ? 'رقم إذن الصرف اليدوي' : 'Delivery Note / DSP #'}
                    </label>
                    <input
                      type="text"
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder={isAr ? 'مثال: DSP-104...' : 'e.g. DSP-104'}
                      style={{
                        width: '100%',
                        background: '#101223',
                        border: '1px solid var(--border)',
                        padding: '0.55rem 0.85rem',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: '#fff' }}>
                      📅 {isAr ? 'تاريخ الصرف والخروج' : 'Dispatch Date'}
                    </label>
                    <input
                      type="date"
                      value={dispatchDate}
                      onChange={(e) => setDispatchDate(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#101223',
                        border: '1px solid var(--border)',
                        padding: '0.55rem 0.85rem',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─── INBOUND METADATA (Only in Inbound Mode) ─── */}
            {mode === 'inbound' && (
              <div
                style={{
                  background: 'rgba(0, 224, 161, 0.05)',
                  border: '1px solid rgba(0, 224, 161, 0.2)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#00e0a1', marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📥 {isAr ? 'بيانات التوريد والإذن:' : 'Inbound Supply Details:'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: '#fff' }}>
                      🏭 {isAr ? 'المورد / المصنع' : 'Supplier'}
                    </label>
                    <input
                      type="text"
                      value={inboundSupplier}
                      onChange={(e) => setInboundSupplier(e.target.value)}
                      placeholder="CANEX"
                      style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.55rem 0.85rem', borderRadius: '8px', color: '#fff' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: '#fff' }}>
                      📋 {isAr ? 'أمر البيع (Sales Order)' : 'Sales Order (SO)'}
                    </label>
                    <input
                      type="text"
                      value={salesOrder}
                      onChange={(e) => setSalesOrder(e.target.value)}
                      placeholder={isAr ? 'مثال: SO-10928...' : 'e.g. SO-10928'}
                      style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.55rem 0.85rem', borderRadius: '8px', color: '#fff' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: '#fff' }}>
                      🏷️ {isAr ? 'مرجع العميل (Customer Ref)' : 'Customer Ref'}
                    </label>
                    <input
                      type="text"
                      value={customerRef}
                      onChange={(e) => setCustomerRef(e.target.value)}
                      placeholder={isAr ? 'مثال: CUST-44...' : 'e.g. CUST-44'}
                      style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.55rem 0.85rem', borderRadius: '8px', color: '#fff' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.4rem', color: '#fff' }}>
                      📄 {isAr ? 'رقم إذن الاستلام / الفاتورة' : 'Receipt / Doc #'}
                    </label>
                    <input
                      type="text"
                      value={docNumber}
                      onChange={(e) => setDocNumber(e.target.value)}
                      placeholder={isAr ? 'مثال: REC-9921...' : 'e.g. REC-9921'}
                      style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.55rem 0.85rem', borderRadius: '8px', color: '#fff' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─── LINES TABLE ─── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📑 {isAr ? 'بنود القطاعات المراد تنفيذ الحركة عليها:' : 'Line Items:'}
                <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                  {activeSelectedLines.length} {isAr ? 'بند محدد' : 'selected'}
                </span>
                {lineSearchFilter && (
                  <span className="badge" style={{ background: 'rgba(96, 165, 250, 0.15)', color: '#93c5fd' }}>
                    {filteredLines.length} {isAr ? 'مطابق' : 'matches'}
                  </span>
                )}
              </div>

              {/* Real-time Search by Item Code, Customer Code, or Description */}
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', minWidth: '220px', maxWidth: '340px', flex: 1 }}>
                <input
                  type="search"
                  value={lineSearchFilter}
                  onChange={(e) => setLineSearchFilter(e.target.value)}
                  placeholder={isAr ? '🔍 بحث بكود الصنف، كود العميل، أو البيان...' : '🔍 Search item / customer code...'}
                  style={{
                    width: '100%',
                    background: '#101426',
                    border: '1px solid var(--border)',
                    color: '#fff',
                    padding: '0.38rem 0.7rem',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                  }}
                />
                {lineSearchFilter && (
                  <button
                    type="button"
                    onClick={() => setLineSearchFilter('')}
                    style={{ background: 'transparent', border: 'none', color: '#ff4d4f', cursor: 'pointer', fontSize: '0.9rem', padding: '0.2rem' }}
                    title={isAr ? 'إلغاء البحث' : 'Clear search'}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {sourceType === 'invoice' && lines.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleToggleSelectAll(!allSelected)}
                    style={{ borderRadius: '8px', fontSize: '0.8rem' }}
                  >
                    {allSelected ? (isAr ? '❌ إلغاء تحديد الكل' : 'Deselect All') : (isAr ? '✅ تحديد وصرف الكل' : 'Select All')}
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddLine}
                  style={{
                    background: 'rgba(0, 224, 161, 0.15)',
                    color: '#00e0a1',
                    border: '1px solid rgba(0, 224, 161, 0.3)',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}
                >
                  ➕ {isAr ? (sourceType === 'invoice' ? 'إضافة قطاع إضافي' : 'إضافة قطاع آخر') : 'Add Profile'}
                </button>
              </div>
            </div>

            <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', textAlign: isAr ? 'right' : 'left' }}>
                    {sourceType === 'invoice' && (
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center', width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          style={{ accentColor: '#00e0a1', cursor: 'pointer' }}
                        />
                      </th>
                    )}
                    <th style={{ padding: '0.65rem 0.5rem', width: '30px' }}>#</th>
                    <th style={{ padding: '0.65rem 0.5rem', minWidth: sourceType === 'manual' ? '180px' : '110px' }}>
                      {sourceType === 'invoice' ? (isAr ? 'كود الصنف' : 'Item Code') : (isAr ? 'اختيار من رصيد المخزن' : 'Select From Stock')}
                    </th>
                    {sourceType === 'manual' && (
                      <th style={{ padding: '0.65rem 0.5rem', minWidth: '100px' }}>{isAr ? 'كود الصنف' : 'Item Code'}</th>
                    )}
                    <th style={{ padding: '0.65rem 0.5rem', minWidth: '110px' }}>
                      <span style={{ color: '#60a5fa' }}>🏷️ {isAr ? 'كود العميل' : 'Customer Code'}</span>
                    </th>
                    <th style={{ padding: '0.65rem 0.5rem', minWidth: '130px' }}>{isAr ? 'بيان الصنف' : 'Description'}</th>
                    <th style={{ padding: '0.65rem 0.5rem', width: '80px' }}>{isAr ? 'الدهان' : 'Finish'}</th>
                    <th style={{ padding: '0.65rem 0.5rem', width: '70px' }}>{isAr ? 'الطول (mm)' : 'Length'}</th>
                    {sourceType === 'invoice' && (
                      <th style={{ padding: '0.65rem 0.5rem', width: '80px', color: '#60a5fa' }}>{isAr ? 'كمية الفاتورة' : 'Inv Qty'}</th>
                    )}
                    {mode === 'outbound' && (
                      <th style={{ padding: '0.65rem 0.5rem', width: '80px', color: '#FFD700' }}>{isAr ? 'المتاح' : 'Available'}</th>
                    )}
                    <th style={{ padding: '0.65rem 0.5rem', width: '90px' }}>
                      {mode === 'outbound' ? (isAr ? 'المنصرف (BAR)' : 'Dispensed (BAR)') : (isAr ? 'الوارد (BAR)' : 'Inbound (BAR)')}
                    </th>
                    <th style={{ padding: '0.65rem 0.5rem', width: '80px' }}>{isAr ? 'الأمتار (LM)' : 'Meters'}</th>
                    {mode === 'inbound' && (
                      <th style={{ padding: '0.65rem 0.5rem', width: '90px' }}>{isAr ? 'سعر الوحدة' : 'Unit Cost'}</th>
                    )}
                    <th style={{ padding: '0.65rem 0.5rem', width: '40px', textAlign: 'center' }}>-</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.length === 0 ? (
                    <tr>
                      <td colSpan={13} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        🔍 {isAr ? 'لا توجد بنود تطابق البحث' : 'No line items match your search'}
                      </td>
                    </tr>
                  ) : (
                    filteredLines.map(({ line, originalIndex: idx }) => {
                      const isSelectedLine = sourceType !== 'invoice' || line.selected
                      const isOverStock = mode === 'outbound' && line.availableBar !== undefined && Number(line.quantityBar) > Number(line.availableBar)

                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: !isSelectedLine ? 'rgba(0,0,0,0.3)' : isOverStock ? 'rgba(255, 71, 87, 0.12)' : 'transparent',
                            opacity: !isSelectedLine ? 0.5 : 1,
                          }}
                        >
                          {sourceType === 'invoice' && (
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={Boolean(line.selected)}
                                onChange={(e) => handleUpdateLine(idx, 'selected', e.target.checked)}
                                style={{ accentColor: '#00e0a1', cursor: 'pointer' }}
                              />
                            </td>
                          )}
                          <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>{idx + 1}</td>

                          {/* Selection Column (Stock picker for manual or added lines, static code for invoice lines) */}
                          <td style={{ padding: '0.5rem' }}>
                            {sourceType === 'manual' || line.isManualAdd ? (
                              <select
                                value={line.itemKey || ''}
                                onChange={(e) => handleSelectStockItem(idx, e.target.value)}
                                style={{
                                  width: '100%',
                                  background: '#101223',
                                  border: '1px solid var(--border)',
                                  color: '#fff',
                                  padding: '0.4rem 0.6rem',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                }}
                              >
                                <option value="">-- {isAr ? 'اختر قطاع من المخزن --' : 'Select from Stock --'}</option>
                                {stock.map((s) => (
                                  <option key={s.itemKey} value={s.itemKey}>
                                    {s.itemCode} {s.customerCode ? `[عميل: ${s.customerCode}]` : ''} | {s.finish} | {s.quantityBar} عود ({s.description?.slice(0, 25) || ''})
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span style={{ fontWeight: 800, color: '#ffffff', letterSpacing: '0.5px' }}>{line.itemCode}</span>
                            )}
                          </td>

                          {/* Item Code (Manual Only) */}
                          {sourceType === 'manual' && (
                            <td style={{ padding: '0.5rem' }}>
                              <input
                                type="text"
                                value={line.itemCode}
                                onChange={(e) => handleUpdateLine(idx, 'itemCode', e.target.value)}
                                placeholder="184060"
                                style={{
                                  width: '100%',
                                  background: '#101223',
                                  border: '1px solid var(--border)',
                                  color: '#fff',
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: '6px',
                                }}
                              />
                            </td>
                          )}

                          {/* Customer Code (Dedicated Column) */}
                          <td style={{ padding: '0.5rem' }}>
                            {sourceType === 'invoice' && !line.isManualAdd ? (
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.25rem 0.6rem',
                                  borderRadius: '6px',
                                  background: 'rgba(96, 165, 250, 0.15)',
                                  color: '#93c5fd',
                                  fontWeight: 700,
                                  fontSize: '0.85rem',
                                  border: '1px solid rgba(96, 165, 250, 0.3)',
                                }}
                              >
                                {line.customerCode || '—'}
                              </span>
                            ) : (
                              <input
                                type="text"
                                value={line.customerCode || ''}
                                onChange={(e) => handleUpdateLine(idx, 'customerCode', e.target.value)}
                                placeholder={isAr ? 'كود العميل...' : 'Customer Code...'}
                                style={{
                                  width: '100%',
                                  background: '#101223',
                                  border: '1px solid rgba(96, 165, 250, 0.3)',
                                  color: '#93c5fd',
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: '6px',
                                  fontWeight: 600,
                                }}
                              />
                            )}
                          </td>

                          {/* Description */}
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="text"
                              value={line.description}
                              onChange={(e) => handleUpdateLine(idx, 'description', e.target.value)}
                              placeholder={isAr ? 'بيان الصنف...' : 'Description...'}
                              disabled={sourceType === 'invoice' && !line.isManualAdd}
                              style={{
                                width: '100%',
                                background: '#101223',
                                border: '1px solid var(--border)',
                                color: '#fff',
                                padding: '0.4rem 0.5rem',
                                borderRadius: '6px',
                              }}
                            />
                          </td>

                          {/* Finish */}
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="text"
                              value={line.finish}
                              onChange={(e) => handleUpdateLine(idx, 'finish', e.target.value)}
                              placeholder="STD"
                              disabled={sourceType === 'invoice' && !line.isManualAdd}
                              style={{
                                width: '100%',
                                background: '#101223',
                                border: '1px solid var(--border)',
                                color: '#fff',
                                padding: '0.4rem 0.5rem',
                                borderRadius: '6px',
                                textAlign: 'center',
                              }}
                            />
                          </td>

                          {/* Length */}
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="number"
                              value={line.lengthMm}
                              onChange={(e) => handleUpdateLine(idx, 'lengthMm', e.target.value)}
                              disabled={sourceType === 'invoice' && !line.isManualAdd}
                              style={{
                                width: '100%',
                                background: '#101223',
                                border: '1px solid var(--border)',
                                color: '#fff',
                                padding: '0.4rem 0.5rem',
                                borderRadius: '6px',
                                textAlign: 'center',
                              }}
                            />
                          </td>

                          {/* Invoiced Quantity if invoice source */}
                          {sourceType === 'invoice' && (
                            <td style={{ padding: '0.5rem', textAlign: 'center', color: '#60a5fa', fontWeight: 700 }}>
                              {line.invoicedBar || 0} عود
                            </td>
                          )}

                          {/* Available Stock */}
                          {mode === 'outbound' && (
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              <span
                                style={{
                                  color: (line.availableBar || 0) > 0 ? '#00e0a1' : '#ff4757',
                                  fontWeight: 700,
                                }}
                              >
                                {line.availableBar || 0} عود
                              </span>
                            </td>
                          )}

                          {/* Quantity to Move */}
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="number"
                              min="1"
                              value={line.quantityBar}
                              onChange={(e) => handleUpdateLine(idx, 'quantityBar', Number(e.target.value))}
                              style={{
                                width: '100%',
                                background: '#101223',
                                border: `1px solid ${isOverStock ? '#ff4757' : '#00e0a1'}`,
                                color: '#fff',
                                padding: '0.4rem 0.5rem',
                                borderRadius: '6px',
                                fontWeight: 800,
                                textAlign: 'center',
                              }}
                            />
                          </td>

                          {/* Meters */}
                          <td style={{ padding: '0.5rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            <span dir="ltr">{(Number(line.quantityLm) || 0).toFixed(1)} m</span>
                          </td>

                          {/* Unit Price (for Inbound) */}
                          {mode === 'inbound' && (
                            <td style={{ padding: '0.5rem' }}>
                              <input
                                type="number"
                                step="0.01"
                                value={line.unitPrice}
                                onChange={(e) => handleUpdateLine(idx, 'unitPrice', Number(e.target.value))}
                                style={{
                                  width: '100%',
                                  background: '#101223',
                                  border: '1px solid var(--border)',
                                  color: '#fff',
                                  padding: '0.4rem 0.5rem',
                                  borderRadius: '6px',
                                  textAlign: 'center',
                                }}
                              />
                            </td>
                          )}

                          {/* Actions */}
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ff4757',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                opacity: lines.length <= 1 ? 0.3 : 1,
                              }}
                              disabled={lines.length <= 1}
                              title={isAr ? 'حذف البند' : 'Remove item'}
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>


            {/* Optional Notes */}
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={isAr ? 'ملاحظات إضافية على أمر الحركة...' : 'Additional notes...'}
                style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.55rem 0.85rem', borderRadius: '8px', color: '#fff' }}
              />
            </div>

            {/* Total Summary Footer Strip */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255,255,255,0.03)',
                padding: '0.85rem 1.25rem',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.06)',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{isAr ? 'إجمالي الأعواد:' : 'Total Bars:'} </span>
                  <strong style={{ color: mode === 'outbound' ? '#ff6b81' : '#00e0a1', fontSize: '1.1rem' }}>
                    {totalBars.toLocaleString()} BAR
                  </strong>
                </div>
                <div style={{ fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{isAr ? 'إجمالي الأمتار:' : 'Total Meters:'} </span>
                  <strong style={{ color: '#ffffff' }}>
                    {totalLm.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m
                  </strong>
                </div>
                {mode === 'inbound' && totalEstimatedCost > 0 && (
                  <div style={{ fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{isAr ? 'إجمالي القيمة التقديرية:' : 'Est. Total Value:'} </span>
                    <strong style={{ color: '#FFD700' }}>
                      {totalEstimatedCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP
                    </strong>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={submitting}
                  style={{ padding: '0.55rem 1.2rem', borderRadius: '8px' }}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={submitting || totalBars <= 0}
                  style={{
                    background: mode === 'outbound' ? 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)' : 'linear-gradient(135deg, #00e0a1 0%, #00b894 100%)',
                    color: mode === 'outbound' ? '#fff' : '#000',
                    border: 'none',
                    padding: '0.55rem 1.75rem',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    cursor: submitting || totalBars <= 0 ? 'not-allowed' : 'pointer',
                    boxShadow: mode === 'outbound' ? '0 4px 14px rgba(255, 71, 87, 0.35)' : '0 4px 14px rgba(0, 224, 161, 0.35)',
                  }}
                >
                  {submitting ? (
                    <span className="spinner"></span>
                  ) : mode === 'outbound' ? (
                    isAr ? `🚀 تأكيد الصرف (${totalBars} عود)` : `Confirm Outbound (${totalBars} Bars)`
                  ) : (
                    isAr ? `📥 تأكيد التوريد (+${totalBars} عود)` : `Confirm Inbound (+${totalBars} Bars)`
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
