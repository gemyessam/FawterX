import { useState, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { processManualStockMovement } from '../services/warehouseApi'

export default function ManualStockModal({
  isOpen,
  onClose,
  initialMode = 'inbound', // 'inbound' | 'outbound'
  projectId,
  projectName,
  stock = [],
  preselectedItems = [],
  onSuccess,
  isAr = true,
}) {
  if (!isOpen) return null

  const [mode, setMode] = useState(initialMode) // 'inbound' | 'outbound'
  const [dispatchType, setDispatchType] = useState('coating_then_customer') // 'coating_then_customer' | 'direct_customer'
  const [submitting, setSubmitting] = useState(false)

  // Dispatch / Lifecycle metadata
  const [coatingSupplier, setCoatingSupplier] = useState('شركة كانكس للدهانات الحديثة')
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

  // Lines to process
  const [lines, setLines] = useState(() => {
    if (preselectedItems && preselectedItems.length > 0) {
      return preselectedItems.map((item) => ({
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

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
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
      toast.error(isAr ? 'يجب أن يحتوي الأمر على بند واحد على الأقل' : 'At least one line is required')
      return
    }
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  const totalBars = useMemo(() => lines.reduce((acc, l) => acc + Number(l.quantityBar || 0), 0), [lines])
  const totalLm = useMemo(() => lines.reduce((acc, l) => acc + Number(l.quantityLm || 0), 0), [lines])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!projectId) {
      toast.error(isAr ? 'يرجى اختيار المشروع أولاً' : 'Please select a project')
      return
    }

    // Validation
    const validLines = lines.filter((l) => (l.itemCode || l.itemKey) && Number(l.quantityBar) > 0)
    if (validLines.length === 0) {
      toast.error(isAr ? 'يرجى ملء بيانات كود القطاع وعدد الأعواد' : 'Please enter item codes and bar quantities')
      return
    }

    if (mode === 'outbound') {
      // Check stock availability
      for (const line of validLines) {
        if (line.availableBar !== undefined && Number(line.quantityBar) > line.availableBar) {
          toast.error(
            isAr
              ? `الكمية المطلوبة للصنف (${line.itemCode}) [${line.quantityBar} عود] تتجاوز الرصيد المتاح بالمخزن [${line.availableBar} عود]`
              : `Requested quantity for (${line.itemCode}) exceeds available stock (${line.availableBar})`
          )
          return
        }
      }

      if (dispatchType === 'coating_then_customer' && !coatingSupplier.trim()) {
        toast.error(isAr ? 'يرجى تحديد اسم مورد الدهان' : 'Please specify coating supplier')
        return
      }
      if (!customerName.trim()) {
        toast.error(isAr ? 'يرجى تحديد اسم العميل النهائي أو المشروع' : 'Please specify customer or project name')
        return
      }
    }

    setSubmitting(true)
    try {
      const payload = {
        movementType: mode,
        lines: validLines,
        meta: {
          supplier: mode === 'inbound' ? inboundSupplier : 'CANEX',
          salesOrder,
          customerReference: customerRef,
          docNumber: deliveryNote || docNumber,
          notes,
        },
        dispatchDetails:
          mode === 'outbound'
            ? {
                dispatchType,
                coatingSupplier: dispatchType === 'coating_then_customer' ? coatingSupplier : 'تسليم مباشر',
                targetFinish: dispatchType === 'coating_then_customer' ? (targetFinish || 'حسب المواصفات') : 'تسليم فوري',
                customerName,
                projectNameOrSite,
                deliveryNote: deliveryNote || `DSP-${Date.now().toString().slice(-6)}`,
                dispatchDate,
                notes,
              }
            : null,
      }

      const res = await processManualStockMovement(projectId, payload)
      if (res && res.success) {
        const isOut = mode === 'outbound'
        const msgAr = isOut
          ? dispatchType === 'coating_then_customer'
            ? `✅ تم صرف ${totalBars} عود بنجاح وإرسالها لمرحلة الدهان لدى (${coatingSupplier})!`
            : `✅ تم صرف وتسليم ${totalBars} عود للعميل النهائي (${customerName}) مباشرة وإغلاق العملية!`
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
          maxWidth: '1000px',
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
            padding: '1.2rem 1.5rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: mode === 'outbound' ? 'rgba(255, 71, 87, 0.08)' : 'rgba(0, 224, 161, 0.08)',
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1.25rem',
                color: mode === 'outbound' ? '#ff6b81' : '#00e0a1',
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                fontWeight: 800,
              }}
            >
              {mode === 'outbound' ? '📤 صرف قطاعات وتتبع المراحل (دهان ⬅️ عميل نهائي)' : '📥 توريد يدوي مباشر للقطاعات (+)'}
            </h3>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isAr ? `مشروع المخزن: ${projectName || projectId}` : `Warehouse: ${projectName || projectId}`}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Mode Switcher */}
            <div style={{ display: 'flex', background: '#0a0d18', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <button
                type="button"
                className={`btn btn-sm ${mode === 'inbound' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setMode('inbound')}
                style={{ borderRadius: '6px', fontSize: '0.8rem', padding: '4px 12px' }}
              >
                📥 {isAr ? 'توريد (+)' : 'Inbound'}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setMode('outbound')}
                style={{
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  padding: '4px 12px',
                  background: mode === 'outbound' ? '#ff4757' : 'transparent',
                  color: '#fff',
                  border: 'none',
                }}
              >
                📤 {isAr ? 'صرف بمراحل (-)' : 'Outbound'}
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                fontSize: '1.2rem',
                cursor: 'pointer',
                borderRadius: '50%',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
            {/* Outbound Stages Selector Banner */}
            {mode === 'outbound' && (
              <div
                style={{
                  background: 'rgba(255, 215, 0, 0.05)',
                  border: '1px solid rgba(255, 215, 0, 0.25)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ fontWeight: 700, color: '#FFD700', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                  🎯 {isAr ? 'حدد خط سير ومراحل صرف القطاعات:' : 'Select Dispatch Workflow:'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.75rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      background: dispatchType === 'coating_then_customer' ? 'rgba(0, 224, 161, 0.12)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${dispatchType === 'coating_then_customer' ? '#00e0a1' : 'rgba(255,255,255,0.1)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="dispatchType"
                      checked={dispatchType === 'coating_then_customer'}
                      onChange={() => setDispatchType('coating_then_customer')}
                      style={{ marginTop: '0.2rem', accentColor: '#00e0a1' }}
                    />
                    <div>
                      <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block' }}>
                        1️⃣ {isAr ? 'مرحلتين (مورد دهان ⬅️ ثم عميل نهائي)' : '2 Stages (Coating ➡️ Customer)'}
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {isAr
                          ? 'تخرج القطاعات من رصيد المخزن الخام وتبقى قيد المتابعة لدى مورد الدهان حتى إتمام تسليمها للعميل.'
                          : 'Items deducted from raw stock and tracked at coating supplier until final delivery.'}
                      </span>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      background: dispatchType === 'direct_customer' ? 'rgba(0, 224, 161, 0.12)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${dispatchType === 'direct_customer' ? '#00e0a1' : 'rgba(255,255,255,0.1)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="dispatchType"
                      checked={dispatchType === 'direct_customer'}
                      onChange={() => setDispatchType('direct_customer')}
                      style={{ marginTop: '0.2rem', accentColor: '#00e0a1' }}
                    />
                    <div>
                      <strong style={{ color: '#fff', fontSize: '0.9rem', display: 'block' }}>
                        2️⃣ {isAr ? 'مرحلة واحدة (تسليم مباشر للعميل النهائي)' : '1 Stage (Direct Customer Delivery)'}
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {isAr
                          ? 'صرف فوري ومباشر لقطاعات جاهزة ومدهونة لموقع العميل وإغلاق العملية مباشرة.'
                          : 'Direct dispatch to customer site and immediate order completion.'}
                      </span>
                    </div>
                  </label>
                </div>

                {/* Workflow Metadata Inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginTop: '1rem' }}>
                  {dispatchType === 'coating_then_customer' && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#FFD700', marginBottom: '0.3rem', fontWeight: 600 }}>
                          🏭 {isAr ? 'مورد / ورشة الدهان' : 'Coating Supplier'} *
                        </label>
                        <input
                          type="text"
                          list="coating-suppliers-list"
                          value={coatingSupplier}
                          onChange={(e) => setCoatingSupplier(e.target.value)}
                          placeholder={isAr ? 'اختر أو اكتب اسم مورد الدهان...' : 'Coating supplier name...'}
                          required
                          style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                        />
                        <datalist id="coating-suppliers-list">
                          {COATING_SUPPLIERS.map((s, idx) => (
                            <option key={idx} value={s} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: '#64b5f6', marginBottom: '0.3rem', fontWeight: 600 }}>
                          🎨 {isAr ? 'اللون / التشطيب المطلوب (RAL Code)' : 'Target Finish / Color'} *
                        </label>
                        <input
                          type="text"
                          list="finish-suggestions-list"
                          value={targetFinish}
                          onChange={(e) => setTargetFinish(e.target.value)}
                          placeholder={isAr ? 'مثال: RAL 9005 أسود مط...' : 'e.g. RAL 9005 Black...'}
                          required
                          style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                        />
                        <datalist id="finish-suggestions-list">
                          {FINISH_SUGGESTIONS.map((f, idx) => (
                            <option key={idx} value={f} />
                          ))}
                        </datalist>
                      </div>
                    </>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#00e0a1', marginBottom: '0.3rem', fontWeight: 600 }}>
                      👤 {isAr ? 'اسم العميل النهائي' : 'Final Customer'} *
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={isAr ? 'اسم العميل / المستلم...' : 'Customer name...'}
                      required
                      style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: '#a29bfe', marginBottom: '0.3rem', fontWeight: 600 }}>
                      🏢 {isAr ? 'المشروع / وجهة التسليم' : 'Project / Destination'}
                    </label>
                    <input
                      type="text"
                      value={projectNameOrSite}
                      onChange={(e) => setProjectNameOrSite(e.target.value)}
                      placeholder={isAr ? 'مثال: مول التجمع / برج الياسمين...' : 'e.g. Site or project name...'}
                      style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                      📄 {isAr ? 'رقم إذن الصرف اليدوي' : 'Delivery Note #'}
                    </label>
                    <input
                      type="text"
                      value={deliveryNote}
                      onChange={(e) => setDeliveryNote(e.target.value)}
                      placeholder={isAr ? 'مثال: DSP-104...' : 'e.g. DSP-104...'}
                      style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                      📅 {isAr ? 'تاريخ الصرف والخروج' : 'Dispatch Date'}
                    </label>
                    <input
                      type="date"
                      value={dispatchDate}
                      onChange={(e) => setDispatchDate(e.target.value)}
                      style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Inbound Metadata Fields */}
            {mode === 'inbound' && (
              <div
                style={{
                  background: 'rgba(0, 224, 161, 0.05)',
                  border: '1px solid rgba(0, 224, 161, 0.2)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.5rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '0.85rem',
                }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#00e0a1', marginBottom: '0.3rem', fontWeight: 600 }}>
                    🏭 {isAr ? 'المورد / جهة التوريد' : 'Supplier'}
                  </label>
                  <input
                    type="text"
                    value={inboundSupplier}
                    onChange={(e) => setInboundSupplier(e.target.value)}
                    placeholder="CANEX"
                    style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#8ab4ff', marginBottom: '0.3rem' }}>
                    📦 {isAr ? 'أمر البيع (SO)' : 'Sales Order #'}
                  </label>
                  <input
                    type="text"
                    value={salesOrder}
                    onChange={(e) => setSalesOrder(e.target.value)}
                    placeholder={isAr ? 'مثال: SO-8940...' : 'SO number...'}
                    style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#ffb74d', marginBottom: '0.3rem' }}>
                    👤 {isAr ? 'مرجع العميل (Customer Ref)' : 'Customer Ref'}
                  </label>
                  <input
                    type="text"
                    value={customerRef}
                    onChange={(e) => setCustomerRef(e.target.value)}
                    placeholder={isAr ? 'مرجع أو كود العميل...' : 'Customer reference...'}
                    style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                    📄 {isAr ? 'رقم إذن الاستلام / الفاتورة اليدوية' : 'Receipt / Doc #'}
                  </label>
                  <input
                    type="text"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value)}
                    placeholder={isAr ? 'مثال: REC-2026-01...' : 'Receipt number...'}
                    style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            )}

            {/* Line Items Table */}
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📋 {isAr ? 'بنود القطاعات المراد تنفيذ الحركة عليها:' : 'Stock Line Items:'}
                <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                  {lines.length} {isAr ? 'بند' : 'items'}
                </span>
              </h4>

              <button
                type="button"
                className="btn btn-sm"
                onClick={handleAddLine}
                style={{
                  background: 'rgba(0, 224, 161, 0.15)',
                  color: '#00e0a1',
                  border: '1px solid rgba(0, 224, 161, 0.3)',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                }}
              >
                ➕ {isAr ? 'إضافة قطاع آخر' : 'Add Item'}
              </button>
            </div>

            <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.25)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', textAlign: isAr ? 'right' : 'left' }}>
                    <th style={{ padding: '0.65rem 0.8rem', width: '35px' }}>#</th>
                    <th style={{ padding: '0.65rem 0.8rem', minWidth: '180px' }}>{isAr ? 'اختيار من رصيد المخزن' : 'Select From Stock'}</th>
                    <th style={{ padding: '0.65rem 0.8rem', width: '110px' }}>{isAr ? 'كود الصنف' : 'Item Code'}</th>
                    <th style={{ padding: '0.65rem 0.8rem', minWidth: '180px' }}>{isAr ? 'بيان الصنف' : 'Description'}</th>
                    <th style={{ padding: '0.65rem 0.8rem', width: '90px' }}>{isAr ? 'الدهان' : 'Finish'}</th>
                    <th style={{ padding: '0.65rem 0.8rem', width: '85px' }}>{isAr ? 'الطول (mm)' : 'Length'}</th>
                    <th style={{ padding: '0.65rem 0.8rem', width: '100px' }}>{isAr ? 'الأعواد (BAR)' : 'Bars'}</th>
                    {mode === 'outbound' && <th style={{ padding: '0.65rem 0.8rem', width: '90px', color: '#FFD700' }}>{isAr ? 'المتاح' : 'Available'}</th>}
                    <th style={{ padding: '0.65rem 0.8rem', width: '90px' }}>{isAr ? 'الأمتار (LM)' : 'Meters'}</th>
                    {mode === 'inbound' && <th style={{ padding: '0.65rem 0.8rem', width: '100px' }}>{isAr ? 'السعر (EGP)' : 'Unit Cost'}</th>}
                    <th style={{ padding: '0.65rem 0.8rem', width: '45px', textAlign: 'center' }}>-</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, idx) => {
                    const isExceeding = mode === 'outbound' && line.availableBar !== undefined && Number(line.quantityBar) > line.availableBar
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: isExceeding ? 'rgba(255, 71, 87, 0.1)' : 'transparent' }}>
                        <td style={{ padding: '0.65rem 0.8rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '0.65rem 0.8rem' }}>
                          <select
                            value={line.itemKey || ''}
                            onChange={(e) => handleSelectStockItem(idx, e.target.value)}
                            style={{
                              width: '100%',
                              background: '#0d1020',
                              color: '#fff',
                              border: '1px solid var(--border)',
                              borderRadius: '6px',
                              padding: '0.4rem 0.5rem',
                              fontSize: '0.8rem',
                            }}
                          >
                            <option value="">{isAr ? '-- اختر قطاع من المخزن --' : '-- Choose stock item --'}</option>
                            {stock.map((s) => (
                              <option key={s.itemKey} value={s.itemKey}>
                                {s.itemCode} | {s.description ? s.description.slice(0, 24) : ''} ({s.quantityBar || 0} عود)
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '0.65rem 0.8rem' }}>
                          <input
                            type="text"
                            value={line.itemCode}
                            onChange={(e) => handleUpdateLine(idx, 'itemCode', e.target.value)}
                            placeholder="184060"
                            required
                            style={{ width: '100%', background: '#0d1020', color: '#00e0a1', fontWeight: 700, border: '1px solid var(--border)', borderRadius: '6px', padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.65rem 0.8rem' }}>
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => handleUpdateLine(idx, 'description', e.target.value)}
                            placeholder={isAr ? 'بيان الصنف...' : 'Description...'}
                            style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.65rem 0.8rem' }}>
                          <input
                            type="text"
                            value={line.finish}
                            onChange={(e) => handleUpdateLine(idx, 'finish', e.target.value)}
                            placeholder="STD"
                            style={{ width: '100%', background: '#0d1020', color: '#FFD700', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.65rem 0.8rem' }}>
                          <input
                            type="number"
                            value={line.lengthMm}
                            onChange={(e) => handleUpdateLine(idx, 'lengthMm', Number(e.target.value))}
                            placeholder="6000"
                            style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                          />
                        </td>
                        <td style={{ padding: '0.65rem 0.8rem' }}>
                          <input
                            type="number"
                            min="1"
                            value={line.quantityBar}
                            onChange={(e) => handleUpdateLine(idx, 'quantityBar', Number(e.target.value))}
                            required
                            style={{
                              width: '100%',
                              background: '#0d1020',
                              color: isExceeding ? '#ff4757' : mode === 'outbound' ? '#ff6b81' : '#00e0a1',
                              fontWeight: 800,
                              border: `1px solid ${isExceeding ? '#ff4757' : 'var(--border)'}`,
                              borderRadius: '6px',
                              padding: '0.4rem 0.5rem',
                              fontSize: '0.85rem',
                            }}
                          />
                        </td>
                        {mode === 'outbound' && (
                          <td style={{ padding: '0.65rem 0.8rem', fontWeight: 700, color: line.availableBar > 0 ? '#FFD700' : '#ff4757' }}>
                            {line.availableBar !== undefined ? `${line.availableBar} عود` : '—'}
                          </td>
                        )}
                        <td style={{ padding: '0.65rem 0.8rem', color: '#64b5f6' }}>
                          <span dir="ltr">{(line.quantityLm || 0).toFixed(1)} m</span>
                        </td>
                        {mode === 'inbound' && (
                          <td style={{ padding: '0.65rem 0.8rem' }}>
                            <input
                              type="number"
                              step="0.1"
                              value={line.unitPrice}
                              onChange={(e) => handleUpdateLine(idx, 'unitPrice', Number(e.target.value))}
                              placeholder="0"
                              style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                            />
                          </td>
                        )}
                        <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: '1rem' }}
                            title={isAr ? 'حذف البند' : 'Remove'}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Total Summary Footer */}
            <div
              style={{
                marginTop: '1.25rem',
                display: 'flex',
                gap: '1.5rem',
                flexWrap: 'wrap',
                background: 'rgba(255,255,255,0.03)',
                padding: '0.75rem 1.25rem',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.06)',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAr ? 'إجمالي الأعواد:' : 'Total Bars:'} </span>
                  <strong style={{ color: mode === 'outbound' ? '#ff6b81' : '#00e0a1', fontSize: '1.1rem' }}>
                    {totalBars} BAR
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAr ? 'إجمالي الأمتار:' : 'Total Meters:'} </span>
                  <strong style={{ color: '#64b5f6', fontSize: '1.1rem' }}>
                    {totalLm.toFixed(1)} m
                  </strong>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={isAr ? 'ملاحظات إضافية على أمر الحركة...' : 'Additional notes...'}
                  style={{ width: '320px', maxWidth: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.45rem 0.75rem', fontSize: '0.8rem' }}
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              padding: '1rem 1.5rem',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(0,0,0,0.2)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              disabled={submitting}
              onClick={onClose}
              style={{ padding: '0.55rem 1.25rem' }}
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              className="btn"
              disabled={submitting}
              style={{
                background: mode === 'outbound' ? 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)' : 'linear-gradient(135deg, #00e0a1 0%, #00b894 100%)',
                color: mode === 'outbound' ? '#fff' : '#000',
                border: 'none',
                padding: '0.55rem 1.75rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                boxShadow: mode === 'outbound' ? '0 4px 14px rgba(255, 71, 87, 0.35)' : '0 4px 14px rgba(0, 224, 161, 0.35)',
              }}
            >
              {submitting ? '...' : mode === 'outbound' ? (isAr ? '🚀 تأكيد الصرف وتتبع المراحل' : 'Confirm Outbound') : (isAr ? '💾 تأكيد التوريد وإضافة للرصيد' : 'Confirm Inbound')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
