import { useState, useEffect, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { getWarehouseDispatches, updateDispatchStage, deleteWarehouseDispatch } from '../services/warehouseApi'

export default function DispatchesTrackerView({
  projectId,
  projectName,
  isAdmin = false,
  isAr = true,
  onOpenManualModal,
}) {
  const [dispatches, setDispatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'completed'
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedDispatchId, setExpandedDispatchId] = useState(null)

  // Stage Transition Modal State
  const [transitioningDispatch, setTransitioningDispatch] = useState(null)
  const [customerReceivedBy, setCustomerReceivedBy] = useState('')
  const [transitionNotes, setTransitionNotes] = useState('')
  const [savingTransition, setSavingTransition] = useState(false)

  const loadDispatches = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const res = await getWarehouseDispatches(projectId)
      if (res && res.success && Array.isArray(res.dispatches)) {
        setDispatches(res.dispatches)
      } else {
        setDispatches([])
      }
    } catch (err) {
      console.error('Error fetching dispatches:', err)
      toast.error(isAr ? 'فشل تحميل سجل مراحل الصرف' : 'Failed to load dispatches')
      setDispatches([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDispatches()
  }, [projectId])

  // Filtered dispatches
  const filteredDispatches = useMemo(() => {
    let list = dispatches

    if (statusFilter === 'active') {
      list = list.filter((d) => !d.isCompleted && d.currentStage !== 'closed')
    } else if (statusFilter === 'completed') {
      list = list.filter((d) => d.isCompleted || d.currentStage === 'closed' || d.currentStage === 'delivered_to_customer')
    }

    const q = searchQuery.trim().toLowerCase()
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean)
      list = list.filter((d) => {
        const fullText = [
          d.dispatchNumber,
          d.deliveryNote,
          d.coatingSupplier,
          d.targetFinish,
          d.customerName,
          d.projectNameOrSite,
          d.notes,
          d.dispatchedByName,
          d.currentStage,
          ...(Array.isArray(d.items) ? d.items.map((i) => `${i.itemCode} ${i.description} ${i.finish}`) : []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return terms.every((t) => fullText.includes(t))
      })
    }

    return list
  }, [dispatches, statusFilter, searchQuery])

  // Summary KPI stats
  const kpiStats = useMemo(() => {
    const active = dispatches.filter((d) => !d.isCompleted && d.currentStage !== 'closed')
    const completed = dispatches.filter((d) => d.isCompleted || d.currentStage === 'closed' || d.currentStage === 'delivered_to_customer')

    const activeBars = active.reduce((acc, d) => acc + Number(d.totalQuantityBar || 0), 0)
    const activeLm = active.reduce((acc, d) => acc + Number(d.totalQuantityLm || 0), 0)
    const completedBars = completed.reduce((acc, d) => acc + Number(d.totalQuantityBar || 0), 0)

    return {
      totalCount: dispatches.length,
      activeCount: active.length,
      activeBars,
      activeLm,
      completedCount: completed.length,
      completedBars,
    }
  }, [dispatches])

  // Open delivery modal for finishing a dispatch
  const handleOpenDeliverModal = (dispatch) => {
    setTransitioningDispatch(dispatch)
    setCustomerReceivedBy('')
    setTransitionNotes('')
  }

  // Commit delivery to final customer
  const handleConfirmDeliverToCustomer = async (e) => {
    e.preventDefault()
    if (!transitioningDispatch) return

    setSavingTransition(true)
    try {
      const res = await updateDispatchStage(projectId, transitioningDispatch.id, {
        stage: 'delivered_to_customer',
        notes: transitionNotes,
        customerReceivedBy,
      })

      if (res && res.success) {
        toast.success(
          isAr
            ? `🏁 تم تسليم أمر الصرف (${transitioningDispatch.dispatchNumber}) للعميل النهائي (${transitioningDispatch.customerName}) وإتمام الدورة بنجاح!`
            : `Order ${transitioningDispatch.dispatchNumber} marked as delivered & completed!`
        )
        setTransitioningDispatch(null)
        loadDispatches()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل تحديث مرحلة التسليم' : 'Failed to update stage'))
    } finally {
      setSavingTransition(false)
    }
  }

  // Delete dispatch
  const handleDeleteDispatch = async (dispatch) => {
    if (!isAdmin) return
    const confirmMsg = isAr
      ? `هل تريد حذف سجل أمر الصرف والتتبع (${dispatch.dispatchNumber})؟\n\n(ملاحظة: هذا يحذف بطاقة التتبع فقط ولا يلغي الحركات المسجلة بالمخزن).`
      : `Delete dispatch record (${dispatch.dispatchNumber})?`

    if (!window.confirm(confirmMsg)) return

    try {
      const res = await deleteWarehouseDispatch(projectId, dispatch.id)
      if (res && res.success) {
        toast.success(isAr ? 'تم حذف سجل أمر الصرف' : 'Dispatch deleted')
        loadDispatches()
      }
    } catch (err) {
      toast.error(isAr ? 'فشل حذف سجل أمر الصرف' : 'Failed to delete dispatch')
    }
  }

  return (
    <div className="card fade-in" style={{ padding: '1.5rem' }}>
      {/* Header & Quick Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            🚚 {isAr ? 'تتبع مراحل الصرف والتشغيل الخارجي (Lifecycle Tracker)' : 'Dispatch & Painting Lifecycle Tracker'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.3rem 0 0' }}>
            {isAr
              ? 'متابعة حية للقطاعات المنصرفة لموردي الدهان ومواقع العملاء حتى إتمام الدورة والتسليم النهائي'
              : 'Live tracking of dispatched profiles at coating suppliers and customer site deliveries'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={loadDispatches}
            disabled={loading}
            style={{ borderRadius: '8px', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            🔄 {isAr ? 'تحديث' : 'Refresh'}
          </button>

          {onOpenManualModal && (
            <button
              className="btn"
              onClick={() => onOpenManualModal('outbound')}
              style={{
                background: 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)',
                color: '#fff',
                border: 'none',
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(255, 71, 87, 0.35)',
              }}
            >
              📤 {isAr ? 'إذن صرف جديد بمراحل' : 'New Dispatch Order'}
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(255, 215, 0, 0.08)', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#FFD700', fontWeight: 600 }}>
            🟡 {isAr ? 'قيد الدهان والمعالجة (المرحلة 1)' : 'In Coating / Processing'}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FFD700', marginTop: '0.2rem' }}>
            {kpiStats.activeCount} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{isAr ? 'أوامر جارية' : 'active orders'}</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#fff', opacity: 0.9, marginTop: '0.2rem' }}>
            {kpiStats.activeBars} BAR ({kpiStats.activeLm.toFixed(1)} m) {isAr ? 'تحت الدهان حالياً' : 'at painters'}
          </div>
        </div>

        <div style={{ background: 'rgba(0, 224, 161, 0.08)', border: '1px solid rgba(0, 224, 161, 0.3)', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#00e0a1', fontWeight: 600 }}>
            🟢 {isAr ? 'تم التسليم للعميل النهائي (المرحلة 2)' : 'Delivered to Final Customer'}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#00e0a1', marginTop: '0.2rem' }}>
            {kpiStats.completedCount} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{isAr ? 'أوامر منتهية' : 'completed orders'}</span>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#00e0a1', opacity: 0.9, marginTop: '0.2rem' }}>
            {kpiStats.completedBars} BAR {isAr ? 'تم إغلاقها بالكامل' : 'total delivered'}
          </div>
        </div>

        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            📦 {isAr ? 'إجمالي حركات الصرف المسجلة' : 'Total Dispatches Logged'}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', marginTop: '0.2rem' }}>
            {kpiStats.totalCount} <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{isAr ? 'أمر صرف' : 'dispatches'}</span>
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', background: '#101223', padding: '3px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button
            type="button"
            className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter('all')}
            style={{ borderRadius: '6px', fontSize: '0.8rem' }}
          >
            {isAr ? 'الكل' : 'All'} ({dispatches.length})
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setStatusFilter('active')}
            style={{
              borderRadius: '6px',
              fontSize: '0.8rem',
              background: statusFilter === 'active' ? '#FFD700' : 'transparent',
              color: statusFilter === 'active' ? '#000' : '#FFD700',
              fontWeight: 700,
            }}
          >
            🟡 {isAr ? 'قيد الدهان (جاري)' : 'In Coating'} ({kpiStats.activeCount})
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setStatusFilter('completed')}
            style={{
              borderRadius: '6px',
              fontSize: '0.8rem',
              background: statusFilter === 'completed' ? '#00e0a1' : 'transparent',
              color: statusFilter === 'completed' ? '#000' : '#00e0a1',
              fontWeight: 700,
            }}
          >
            🟢 {isAr ? 'مكتمل ومسلّم' : 'Completed'} ({kpiStats.completedCount})
          </button>
        </div>

        <input
          type="search"
          placeholder={isAr ? 'ابحث برقم الإذن، المورد، العميل، اللون، كود القطاع...' : 'Search dispatch #, supplier, customer, color, item code...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            minWidth: '280px',
            background: '#101223',
            border: '1px solid var(--border)',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '0.85rem',
          }}
        />
      </div>

      {/* Dispatches List Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          ⏳ {isAr ? 'جاري تحميل سجل مراحل الصرف...' : 'Loading dispatches...'}
        </div>
      ) : filteredDispatches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', color: 'var(--text-muted)' }}>
          📭 {isAr ? 'لا توجد أوامر صرف وتتبع تطابق البحث الحالي' : 'No dispatches found matching your search.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredDispatches.map((disp) => {
            const isCompleted = disp.isCompleted || disp.currentStage === 'delivered_to_customer' || disp.currentStage === 'closed'
            const isExpanded = expandedDispatchId === disp.id
            const dateFormatted = disp.dispatchedAt ? new Date(disp.dispatchedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US') : '—'

            return (
              <div
                key={disp.id}
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: `1px solid ${isCompleted ? 'rgba(0, 224, 161, 0.25)' : 'rgba(255, 215, 0, 0.35)'}`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Dispatch Card Header Row */}
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                    background: isCompleted ? 'rgba(0, 224, 161, 0.03)' : 'rgba(255, 215, 0, 0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <span
                      className="badge"
                      style={{
                        background: isCompleted ? 'rgba(0, 224, 161, 0.15)' : 'rgba(255, 215, 0, 0.15)',
                        color: isCompleted ? '#00e0a1' : '#FFD700',
                        border: `1px solid ${isCompleted ? 'rgba(0, 224, 161, 0.3)' : 'rgba(255, 215, 0, 0.4)'}`,
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        padding: '4px 10px',
                      }}
                    >
                      {isCompleted ? (isAr ? '🟢 المرحلة 2: مسلّم نهائي ومكتمل' : '🟢 Delivered & Completed') : (isAr ? '🟡 المرحلة 1: قيد الدهان والمعالجة' : '🟡 In Coating')}
                    </span>

                    <div>
                      <strong style={{ fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📄 {disp.dispatchNumber || disp.deliveryNote || disp.id}
                      </strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {isAr ? 'تاريخ الصرف:' : 'Date:'} {dateFormatted} | {isAr ? 'المسؤول:' : 'By:'} {disp.dispatchedByName || 'مستخدم'}
                      </span>
                    </div>
                  </div>

                  {/* Summary Badges & Quick Action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: isAr ? 'left' : 'right', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{isAr ? 'الكمية:' : 'Qty:'} </span>
                      <strong style={{ color: '#64b5f6' }}>{disp.totalQuantityBar || 0} BAR</strong>
                      <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>|</span>
                      <strong style={{ color: '#a29bfe' }}>{(disp.totalQuantityLm || 0).toFixed(1)} m</strong>
                    </div>

                    {!isCompleted && (
                      <button
                        className="btn btn-sm"
                        onClick={() => handleOpenDeliverModal(disp)}
                        style={{
                          background: 'linear-gradient(135deg, #00e0a1 0%, #00b894 100%)',
                          color: '#000',
                          border: 'none',
                          fontWeight: 700,
                          padding: '0.45rem 0.9rem',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          boxShadow: '0 4px 10px rgba(0, 224, 161, 0.3)',
                        }}
                      >
                        🚀 {isAr ? 'نقل للعميل النهائي وإتمام الدورة' : 'Deliver to Customer'}
                      </button>
                    )}

                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setExpandedDispatchId(isExpanded ? null : disp.id)}
                      style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                    >
                      {isExpanded ? (isAr ? '▲ إخفاء التفاصيل' : '▲ Less') : (isAr ? '▼ عرض التفاصيل والبنود' : '▼ Details')}
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteDispatch(disp)}
                        style={{ background: 'transparent', border: 'none', color: '#ff4757', cursor: 'pointer', fontSize: '0.9rem' }}
                        title={isAr ? 'حذف سجل أمر الصرف' : 'Delete'}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {/* Details Section */}
                <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>🏭 {isAr ? 'مورد الدهان / الورشة:' : 'Coating Supplier:'} </span>
                    <strong style={{ color: '#FFD700' }}>{disp.coatingSupplier || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>🎨 {isAr ? 'اللون / التشطيب المطلوب:' : 'Target Finish:'} </span>
                    <strong style={{ color: '#64b5f6' }}>{disp.targetFinish || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>👤 {isAr ? 'العميل النهائي:' : 'Customer:'} </span>
                    <strong style={{ color: '#00e0a1' }}>{disp.customerName || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>🏢 {isAr ? 'الموقع / المشروع:' : 'Project / Site:'} </span>
                    <strong style={{ color: '#fff' }}>{disp.projectNameOrSite || '—'}</strong>
                  </div>
                </div>

                {/* Expanded Line Items & Stage Timeline */}
                {isExpanded && (
                  <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)' }}>
                    <h5 style={{ margin: '0 0 0.6rem 0', color: '#fff', fontSize: '0.9rem' }}>
                      📋 {isAr ? 'تفاصيل القطاعات المنصرفة في هذا الأمر:' : 'Dispatched Profile Items:'}
                    </h5>

                    <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border)', textAlign: isAr ? 'right' : 'left' }}>
                            <th style={{ padding: '0.5rem 0.75rem' }}>#</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>{isAr ? 'كود الصنف' : 'Item Code'}</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>{isAr ? 'بيان الصنف' : 'Description'}</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>{isAr ? 'الدهان الأصلي' : 'Original Finish'}</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>{isAr ? 'الطول' : 'Length'}</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>{isAr ? 'الأعواد' : 'Bars'}</th>
                            <th style={{ padding: '0.5rem 0.75rem' }}>{isAr ? 'الأمتار' : 'Meters'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.isArray(disp.items) && disp.items.length > 0 ? (
                            disp.items.map((it, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#00e0a1' }}>{it.itemCode}</td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{it.description}</td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>{it.finish || 'STD'}</td>
                                <td style={{ padding: '0.5rem 0.75rem' }}><span dir="ltr">{it.lengthMm} mm</span></td>
                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: '#fff' }}>{it.quantityBar}</td>
                                <td style={{ padding: '0.5rem 0.75rem', color: '#64b5f6' }}>
                                  <span dir="ltr">{(it.quantityLm || 0).toFixed(1)} m</span>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                {isAr ? 'لا توجد بنود تفصيلية مسجلة' : 'No items recorded'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Timeline History */}
                    <h5 style={{ margin: '0 0 0.6rem 0', color: '#FFD700', fontSize: '0.9rem' }}>
                      ⏱️ {isAr ? 'سجل تتبع خط السير والمراحل (Timeline):' : 'Stage History Timeline:'}
                    </h5>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {Array.isArray(disp.stageHistory) && disp.stageHistory.length > 0 ? (
                        disp.stageHistory.map((hist, hIdx) => (
                          <div
                            key={hIdx}
                            style={{
                              background: 'rgba(255,255,255,0.02)',
                              borderLeft: isAr ? 'none' : '3px solid #00e0a1',
                              borderRight: isAr ? '3px solid #00e0a1' : 'none',
                              padding: '0.5rem 0.85rem',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ color: '#fff' }}>{hist.label || hist.stage}</strong>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                {hist.timestamp ? new Date(hist.timestamp).toLocaleString(isAr ? 'ar-EG' : 'en-US') : ''}
                              </span>
                            </div>
                            {hist.notes && <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>{hist.notes}</div>}
                            <div style={{ color: '#8ab4ff', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                              {isAr ? 'المسؤول:' : 'By:'} {hist.user || 'نظام'}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {isAr ? 'تم إنشاء الأمر بنجاح' : 'Order initialized'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ─── STAGE COMPLETION MODAL ─── */}
      {transitioningDispatch && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#121629',
              border: '1px solid rgba(0, 224, 161, 0.4)',
              borderRadius: '16px',
              maxWidth: '550px',
              width: '100%',
              overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
            }}
          >
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0, 224, 161, 0.08)' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#00e0a1', fontWeight: 800 }}>
                🚀 {isAr ? 'إتمام تسليم القطاعات للعميل النهائي' : 'Complete Delivery to Final Customer'}
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {isAr
                  ? `أمر الصرف: ${transitioningDispatch.dispatchNumber} | العميل: ${transitioningDispatch.customerName}`
                  : `Order: ${transitioningDispatch.dispatchNumber} | Customer: ${transitioningDispatch.customerName}`}
              </p>
            </div>

            <form onSubmit={handleConfirmDeliverToCustomer} style={{ padding: '1.5rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.85rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>{isAr ? 'الكمية المنصرفة:' : 'Dispatched Qty:'} </span>
                  <strong style={{ color: '#00e0a1' }}>{transitioningDispatch.totalQuantityBar} BAR</strong>
                  <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>|</span>
                  <strong style={{ color: '#64b5f6' }}>{(transitioningDispatch.totalQuantityLm || 0).toFixed(1)} m</strong>
                </div>
                <div style={{ marginTop: '0.3rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{isAr ? 'الدهان المنفذ:' : 'Finished Coating:'} </span>
                  <strong style={{ color: '#FFD700' }}>{transitioningDispatch.targetFinish}</strong>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#fff', marginBottom: '0.4rem', fontWeight: 600 }}>
                  👤 {isAr ? 'اسم المستلم في موقع العميل (اختياري)' : 'Received By (Optional)'}
                </label>
                <input
                  type="text"
                  value={customerReceivedBy}
                  onChange={(e) => setCustomerReceivedBy(e.target.value)}
                  placeholder={isAr ? 'مثال: م/ أحمد إبراهيم (مدير الموقع)...' : 'e.g. Site supervisor...'}
                  style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.55rem 0.75rem', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#fff', marginBottom: '0.4rem', fontWeight: 600 }}>
                  📝 {isAr ? 'ملاحظات التسليم والإغلاق' : 'Closing Notes'}
                </label>
                <textarea
                  rows="3"
                  value={transitionNotes}
                  onChange={(e) => setTransitionNotes(e.target.value)}
                  placeholder={isAr ? 'تم استلام القطاعات بحالة ممتازة ومطابقة للمواصفات...' : 'Received in good condition...'}
                  style={{ width: '100%', background: '#0d1020', color: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.55rem 0.75rem', fontSize: '0.85rem', resize: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={savingTransition}
                  onClick={() => setTransitioningDispatch(null)}
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={savingTransition}
                  style={{
                    background: 'linear-gradient(135deg, #00e0a1 0%, #00b894 100%)',
                    color: '#000',
                    border: 'none',
                    padding: '0.55rem 1.5rem',
                    borderRadius: '8px',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  {savingTransition ? '...' : (isAr ? '🏁 تأكيد التسليم وإغلاق الدورة' : 'Confirm Delivery')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
