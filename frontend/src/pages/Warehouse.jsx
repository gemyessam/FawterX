import { useState, useEffect, useContext, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { AppContext } from '../App'
import { uploadExcel } from '../services/api'
import {
  getWarehouseProjects,
  createWarehouseProject,
  getProjectStock,
  processWarehouseInvoice,
  getWarehouseUsers,
  updateWarehouseUserAccess,
} from '../services/warehouseApi'

export default function Warehouse() {
  const { lang, user, isAdmin } = useContext(AppContext)
  const isAr = lang === 'ar'

  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('stock') // 'stock' | 'upload' | 'users' | 'projects'

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')

  // Access Control (Admin)
  const [warehouseUsers, setWarehouseUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Upload & Review State
  const [uploading, setUploading] = useState(false)
  const [movementType, setMovementType] = useState('inbound') // 'inbound' | 'outbound'
  const [parsedMeta, setParsedMeta] = useState({ invoiceNumber: '', supplier: 'Canex', currency: 'EGP', movementType: 'inbound' })
  const [reviewLines, setReviewLines] = useState([])
  const [savingInvoice, setSavingInvoice] = useState(false)

  // New Project Form
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectCode, setNewProjectCode] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (selectedProjectId) {
      loadStock(selectedProjectId)
    }
  }, [selectedProjectId])

  useEffect(() => {
    if (activeTab === 'users' && isAdmin) {
      loadUsers()
    }
  }, [activeTab, isAdmin])

  async function loadProjects() {
    setLoading(true)
    try {
      const fetchPromise = getWarehouseProjects()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Server response timeout')), 10000)
      )

      const res = await Promise.race([fetchPromise, timeoutPromise])
      if (res && res.success && Array.isArray(res.projects) && res.projects.length > 0) {
        setProjects(res.projects)
        setSelectedProjectId((prev) => prev || res.projects[0].id)
      } else {
        const defaultProj = { id: 'default_canex', name: 'Canex Stock', code: 'CANEX', description: 'المخزن الرئيسي لقطاعات وإكسسوارات كانكس' }
        setProjects([defaultProj])
        setSelectedProjectId((prev) => prev || defaultProj.id)
      }
    } catch (err) {
      console.warn('Warehouse projects loading timeout/error:', err)
      const defaultProj = { id: 'default_canex', name: 'Canex Stock', code: 'CANEX', description: 'المخزن الرئيسي لقطاعات وإكسسوارات كانكس' }
      setProjects([defaultProj])
      setSelectedProjectId((prev) => prev || defaultProj.id)
    } finally {
      setLoading(false)
    }
  }

  async function loadStock(projectId) {
    try {
      const res = await getProjectStock(projectId)
      if (res.success && res.stock) {
        setStock(res.stock)
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحميل رصيد المخزن' : 'Failed to load stock data')
    }
  }

  async function loadUsers() {
    setLoadingUsers(true)
    try {
      const res = await getWarehouseUsers()
      if (res.success && res.users) {
        setWarehouseUsers(res.users)
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحميل قائمة الصلاحيات' : 'Failed to load access control list')
    } finally {
      setLoadingUsers(false)
    }
  }

  async function handleToggleUserAccess(targetUid, currentStatus) {
    try {
      const newStatus = !currentStatus
      const res = await updateWarehouseUserAccess(targetUid, {
        warehouseEnabled: newStatus,
        warehouseRole: newStatus ? 'warehouse_operator' : 'disabled',
      })
      if (res.success) {
        toast.success(
          isAr
            ? newStatus ? 'تم تفعيل صلاحية المخزن للمستخدم' : 'تم إلغاء صلاحية المخزن للمستخدم'
            : newStatus ? 'Warehouse access enabled' : 'Warehouse access disabled'
        )
        setWarehouseUsers((prev) =>
          prev.map((u) => (u.uid === targetUid ? { ...u, warehouseEnabled: newStatus } : u))
        )
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحديث الصلاحية' : 'Failed to update access')
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const res = await uploadExcel(file, 'template')
      if (res.success) {
        const rows = res.rows || []
        const parsed = rows.map((r, idx) => {
          const rawDesc = String(r.description || r.itemDescription || r.item || r.name || '').trim()
          const itemCode = String(r.itemCode || r.code || r.internalCode || `ITEM-${idx + 1}`).trim()
          const finish = String(r.finish || r.color || r.powderCoating || 'STD').trim()
          const lengthMm = Number(r.lengthMm || r.length || 6000)
          const qtyBar = Number(r.quantity || r.qty || r.quantityBar || 0)
          const unitPrice = Number(r.unitPrice || r.price || 0)
          const isService = /مصاريف|شحن|نقل|تغليف|خدمة|ضريبة|tax|freight|packing/i.test(rawDesc)

          return {
            id: `line_${idx}`,
            itemCode,
            description: rawDesc || `Glazing Bead / Profile ${itemCode}`,
            finish,
            lengthMm,
            unit: 'BAR',
            quantityBar: qtyBar,
            quantityLm: (qtyBar * lengthMm) / 1000,
            quantityKg: Number(r.weightKg || qtyBar * 1.5),
            unitPrice,
            netTotal: qtyBar * unitPrice,
            isService,
            ignored: isService,
          }
        })

        setParsedMeta({
          invoiceNumber: res.metadata?.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
          supplier: res.metadata?.supplier || 'Schüco',
          currency: 'EGP',
          fileName: file.name,
          movementType: movementType,
        })
        setReviewLines(parsed)
        setActiveTab('upload')
        toast.success(isAr ? 'تم تحليل الفاتورة بنجاح! يرجى مراجعة البنود قبل الحفظ' : 'Invoice parsed! Review lines before saving.')
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحليل الفاتورة' : 'Failed to parse invoice')
    } finally {
      setUploading(false)
    }
  }

  function updateReviewLine(index, field, value) {
    setReviewLines((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      if (field === 'quantityBar' || field === 'lengthMm' || field === 'unitPrice') {
        const bar = Number(copy[index].quantityBar || 0)
        const len = Number(copy[index].lengthMm || 6000)
        const price = Number(copy[index].unitPrice || 0)
        copy[index].quantityLm = (bar * len) / 1000
        copy[index].netTotal = bar * price
      }
      return copy
    })
  }

  async function handleSaveInboundInvoice() {
    if (!selectedProjectId) {
      toast.error(isAr ? 'يرجى اختيار المشروع أولاً' : 'Please select a project first')
      return
    }

    const validLines = reviewLines.filter((l) => !l.ignored && !l.isService && Number(l.quantityBar) > 0)
    if (validLines.length === 0) {
      toast.error(isAr ? 'لا توجد بنود مخزنية صالحة للحفظ' : 'No valid stock lines to save')
      return
    }

    setSavingInvoice(true)
    try {
      const payloadMeta = { ...parsedMeta, movementType: movementType }
      const res = await processWarehouseInvoice(selectedProjectId, payloadMeta, validLines)
      if (res.success) {
        const isOut = movementType === 'outbound'
        const msgAr = isOut
          ? `تم خصم البنود من المخزن بنجاح! (-${res.movementsCount} أصناف)`
          : `تم إضافة البنود إلى المخزن بنجاح! (+${res.movementsCount} أصناف)`
        const msgEn = isOut
          ? `Stock deducted successfully! (-${res.movementsCount} items)`
          : `Stock added successfully! (+${res.movementsCount} items)`
        toast.success(isAr ? msgAr : msgEn)
        setReviewLines([])
        loadStock(selectedProjectId)
        setActiveTab('stock')
      }
    } catch (err) {
      toast.error(isAr ? 'فشل حفظ حركة المخزن' : 'Failed to process warehouse movements')
    } finally {
      setSavingInvoice(false)
    }
  }

  async function handleCreateProject(e) {
    e.preventDefault()
    if (!newProjectName.trim()) return

    setCreatingProject(true)
    try {
      const res = await createWarehouseProject({
        name: newProjectName,
        code: newProjectCode,
        description: newProjectDesc,
      })
      if (res.success && res.project) {
        toast.success(isAr ? 'تم إنشاء المشروع بنجاح' : 'Project created successfully')
        setProjects((prev) => [...prev, res.project])
        setSelectedProjectId(res.project.id)
        setNewProjectName('')
        setNewProjectCode('')
        setNewProjectDesc('')
        setActiveTab('stock')
      }
    } catch (err) {
      toast.error(isAr ? 'فشل إنشاء المشروع' : 'Failed to create project')
    } finally {
      setCreatingProject(false)
    }
  }

  // Filter Stock List
  const filteredStock = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return stock
    return stock.filter(
      (item) =>
        String(item.itemCode || '').toLowerCase().includes(q) ||
        String(item.description || '').toLowerCase().includes(q) ||
        String(item.finish || '').toLowerCase().includes(q) ||
        String(item.itemKey || '').toLowerCase().includes(q)
    )
  }, [stock, searchQuery])

  // Aggregate Stats
  const stats = useMemo(() => {
    let totalSKUs = stock.length
    let totalBar = 0
    let totalLm = 0
    let totalKg = 0
    stock.forEach((item) => {
      totalBar += Number(item.quantityBar || 0)
      totalLm += Number(item.quantityLm || 0)
      totalKg += Number(item.quantityKg || 0)
    })
    return { totalSKUs, totalBar, totalLm, totalKg }
  }, [stock])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: '1rem' }}>
        <span className="spinner"></span>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          {isAr ? 'جاري الاتصال بالسيرفر وجلب بيانات المخزن...' : 'Connecting to server and loading warehouse data...'}
        </p>
        <button className="btn btn-secondary" onClick={() => loadProjects()} style={{ marginTop: '0.5rem' }}>
          {isAr ? 'إعادة المحاولة الأن' : 'Retry Now'}
        </button>
      </div>
    )
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  return (
    <div className={`warehouse-container fade-in ${!isAr ? 'ltr-layout' : ''}`} style={{ padding: '1.5rem 0' }}>
      {/* ─── Hero Header & Project Selector ─── */}
      <div className="card glassmorphism" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              📦 {isAr ? 'إدارة المخازن والمشاريع' : 'Project Warehouse Management'}
            </h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.95rem' }}>
              {isAr
                ? 'تتبع رصيد قطاعات الألومنيوم والإكسسوارات، تحويل الفواتير إلى حركات، وإدارة الصلاحيات'
                : 'Track aluminum profiles & accessories stock, process invoice movements, and control access permissions'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#e8eaf6' }}>
              {isAr ? 'المشروع الحالي:' : 'Active Project:'}
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{
                background: '#161b33',
                color: '#00e0a1',
                border: '1px solid #00e0a1',
                padding: '0.5rem 1rem',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ─── KPI Stats Grid ─── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginTop: '1.5rem',
          }}
        >
          <div className="card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', padding: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAr ? 'عدد الأصناف (SKU)' : 'Total SKUs'}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ffffff', marginTop: '0.2rem' }}>{stats.totalSKUs}</div>
          </div>
          <div className="card" style={{ background: 'rgba(0, 224, 161, 0.05)', border: '1px solid rgba(0, 224, 161, 0.2)', padding: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#00e0a1' }}>{isAr ? 'إجمالي الأعواد (BAR)' : 'Total Bars (BAR)'}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#00e0a1', marginTop: '0.2rem' }}>{stats.totalBar.toLocaleString()}</div>
          </div>
          <div className="card" style={{ background: 'rgba(255, 215, 0, 0.05)', border: '1px solid rgba(255, 215, 0, 0.2)', padding: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#FFD700' }}>{isAr ? 'الأمتار الطولية (LM)' : 'Linear Meters (LM)'}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#FFD700', marginTop: '0.2rem' }}>{stats.totalLm.toLocaleString(undefined, { maximumFractionDigits: 1 })} m</div>
          </div>
          <div className="card" style={{ background: 'rgba(100, 181, 246, 0.05)', border: '1px solid rgba(100, 181, 246, 0.2)', padding: '1rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#64b5f6' }}>{isAr ? 'الوزن الإجمالي (KG)' : 'Total Weight (KG)'}</div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#64b5f6', marginTop: '0.2rem' }}>{stats.totalKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</div>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs ─── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'stock' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('stock')}
        >
          📦 {isAr ? 'رصيد أصناف المخزن' : 'Stock Balance'}
        </button>
        <button
          className={`btn ${activeTab === 'upload' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('upload')}
        >
          🧾 {isAr ? 'حركات الفواتير (إضافة / خصم)' : 'Invoice Movements (In / Out)'}
        </button>
        {isAdmin && (
          <button
            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('users')}
          >
            ⚙️ {isAr ? 'إدارة صلاحيات المستخدمين' : 'Access Control'}
          </button>
        )}
        <button
          className={`btn ${activeTab === 'projects' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('projects')}
        >
          📁 {isAr ? 'إدارة المشاريع' : 'Projects Manager'}
        </button>
      </div>

      {/* ─── TAB 1: Stock Balance ─── */}
      {activeTab === 'stock' && (
        <div className="card fade-in" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {isAr ? `رصيد المخزن لمشروع: ${selectedProject?.name || ''}` : `Stock Inventory: ${selectedProject?.name || ''}`}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {isAr ? 'يتم التحديث تلقائياً من حركات التوريد والصرف المؤكدة' : 'Auto-updated from confirmed inbound and outbound movements'}
              </p>
            </div>
            <input
              type="search"
              placeholder={isAr ? 'ابحث برقم الصنف، الوصف، أو الدهان...' : 'Search item code, description, finish...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                minWidth: '280px',
                background: '#101223',
                border: '1px solid var(--border)',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                color: '#fff',
              }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', textAlign: isAr ? 'right' : 'left' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'كود الصنف' : 'Item Code'}</th>
                  <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'بيان الصنف' : 'Description'}</th>
                  <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'نوع الدهان/اللون' : 'Finish/Color'}</th>
                  <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'الطول (mm)' : 'Length (mm)'}</th>
                  <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'الأعواد (BAR)' : 'Bars (BAR)'}</th>
                  <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'الأمتار (LM)' : 'Meters (LM)'}</th>
                  <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'الوزن (KG)' : 'Weight (KG)'}</th>
                  <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'آخر سعر توريد' : 'Last Cost'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length > 0 ? (
                  filteredStock.map((item) => (
                    <tr key={item.itemKey} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#00e0a1' }}>{item.itemCode}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{item.description}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span className="badge" style={{ background: 'rgba(255,215,0,0.1)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)' }}>
                          {item.finish || 'STD'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>{item.lengthMm} mm</td>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#ffffff' }}>{item.quantityBar}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{item.quantityLm ? item.quantityLm.toFixed(1) : '—'} m</td>
                      <td style={{ padding: '0.75rem 1rem' }}>{item.quantityKg ? item.quantityKg.toFixed(1) : '—'} kg</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64b5f6' }}>
                        {item.lastUnitCost ? `${item.lastUnitCost} ${item.currency || 'EGP'}` : '—'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      {isAr ? 'لا توجد أصناف مسجلة في هذا المشروع حتى الآن' : 'No items recorded in this project yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: Upload & Review Invoice Movements ─── */}
      {activeTab === 'upload' && (
        <div className="card fade-in" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.2rem' }}>
                {movementType === 'outbound'
                  ? (isAr ? '📤 رفع ومراجعة فاتورة صرف (خصم من الرصيد)' : 'Outbound Invoice (Stock Deduction)')
                  : (isAr ? '📥 رفع ومراجعة فاتورة توريد (إضافة رصيد)' : 'Inbound Purchase Invoice (Stock Addition)')}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {isAr
                  ? 'اختر نوع الحركة (إضافة أو خصم) ثم ارفع ملف الفاتورة لمراجعته واعتماده تلقائياً'
                  : 'Select movement type (Addition or Deduction), then upload invoice to review and confirm'}
              </p>
            </div>

            {/* Movement Type Toggle */}
            <div style={{ display: 'flex', gap: '0.5rem', background: '#101223', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <button
                type="button"
                className={`btn btn-sm ${movementType === 'inbound' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => {
                  setMovementType('inbound')
                  setParsedMeta((p) => ({ ...p, movementType: 'inbound' }))
                }}
                style={{ borderRadius: '7px', fontWeight: 700 }}
              >
                📥 {isAr ? 'إذن إضافة (توريد)' : 'Inbound (+ Add)'}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setMovementType('outbound')
                  setParsedMeta((p) => ({ ...p, movementType: 'outbound' }))
                }}
                style={{
                  borderRadius: '7px',
                  fontWeight: 700,
                  background: movementType === 'outbound' ? '#ff4d4f' : 'transparent',
                  borderColor: movementType === 'outbound' ? '#ff4d4f' : 'transparent',
                  color: '#fff',
                }}
              >
                📤 {isAr ? 'إذن صرف (مبيعات / خصم)' : 'Outbound (- Deduct)'}
              </button>
            </div>
          </div>

          {reviewLines.length === 0 ? (
            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: '12px',
                padding: '3rem',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.01)',
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📁</div>
              <h4 style={{ marginBottom: '0.5rem' }}>{isAr ? 'اختر فاتورة المورد (Excel أو PDF)' : 'Select Supplier Invoice (Excel or PDF)'}</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                {isAr ? 'يدعم فواتير Canex، Schüco، وفواتير التوريد العامة' : 'Supports Canex, Schüco, and general purchase invoices'}
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                id="warehouse-file-input"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <label htmlFor="warehouse-file-input" className="btn btn-primary" style={{ cursor: 'pointer' }}>
                {uploading ? <span className="spinner"></span> : isAr ? 'رفع ملف الفاتورة' : 'Select Invoice File'}
              </label>
            </div>
          ) : (
            <div>
              {/* Invoice Metadata Header */}
              <div
                style={{
                  display: 'flex',
                  gap: '1rem',
                  marginBottom: '1rem',
                  padding: '1rem',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'رقم الفاتورة:' : 'Invoice No:'}</span>
                  <input
                    type="text"
                    value={parsedMeta.invoiceNumber}
                    onChange={(e) => setParsedMeta((p) => ({ ...p, invoiceNumber: e.target.value }))}
                    style={{ background: '#101223', border: '1px solid var(--border)', padding: '0.3rem 0.6rem', color: '#fff', borderRadius: '4px', display: 'block', marginTop: '0.2rem' }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'المورد:' : 'Supplier:'}</span>
                  <input
                    type="text"
                    value={parsedMeta.supplier}
                    onChange={(e) => setParsedMeta((p) => ({ ...p, supplier: e.target.value }))}
                    style={{ background: '#101223', border: '1px solid var(--border)', padding: '0.3rem 0.6rem', color: '#fff', borderRadius: '4px', display: 'block', marginTop: '0.2rem' }}
                  />
                </div>
              </div>

              {/* Review Table */}
              <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.5rem' }}>{isAr ? 'تجاهل' : 'Ignore'}</th>
                      <th style={{ padding: '0.5rem' }}>{isAr ? 'كود الصنف' : 'Item Code'}</th>
                      <th style={{ padding: '0.5rem' }}>{isAr ? 'البيان' : 'Description'}</th>
                      <th style={{ padding: '0.5rem' }}>{isAr ? 'الدهان' : 'Finish'}</th>
                      <th style={{ padding: '0.5rem' }}>{isAr ? 'الطول mm' : 'Length mm'}</th>
                      <th style={{ padding: '0.5rem' }}>{isAr ? 'أعواد BAR' : 'Bars'}</th>
                      <th style={{ padding: '0.5rem' }}>{isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
                      <th style={{ padding: '0.5rem' }}>{isAr ? 'الإجمالي' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewLines.map((line, idx) => (
                      <tr
                        key={line.id}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          opacity: line.ignored ? 0.4 : 1,
                          background: line.isService ? 'rgba(255, 77, 79, 0.05)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={line.ignored}
                            onChange={(e) => updateReviewLine(idx, 'ignored', e.target.checked)}
                          />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="text"
                            value={line.itemCode}
                            onChange={(e) => updateReviewLine(idx, 'itemCode', e.target.value)}
                            style={{ background: '#101223', border: '1px solid var(--border)', color: '#00e0a1', padding: '0.2rem 0.4rem', borderRadius: '4px', width: '110px' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="text"
                            value={line.description}
                            onChange={(e) => updateReviewLine(idx, 'description', e.target.value)}
                            style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.2rem 0.4rem', borderRadius: '4px', width: '220px' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="text"
                            value={line.finish}
                            onChange={(e) => updateReviewLine(idx, 'finish', e.target.value)}
                            style={{ background: '#101223', border: '1px solid var(--border)', color: '#FFD700', padding: '0.2rem 0.4rem', borderRadius: '4px', width: '90px' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="number"
                            value={line.lengthMm}
                            onChange={(e) => updateReviewLine(idx, 'lengthMm', e.target.value)}
                            style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.2rem 0.4rem', borderRadius: '4px', width: '70px' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="number"
                            value={line.quantityBar}
                            onChange={(e) => updateReviewLine(idx, 'quantityBar', e.target.value)}
                            style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.2rem 0.4rem', borderRadius: '4px', width: '70px', fontWeight: 700 }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          <input
                            type="number"
                            value={line.unitPrice}
                            onChange={(e) => updateReviewLine(idx, 'unitPrice', e.target.value)}
                            style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.2rem 0.4rem', borderRadius: '4px', width: '80px' }}
                          />
                        </td>
                        <td style={{ padding: '0.5rem', fontWeight: 700, color: '#64b5f6' }}>
                          {line.netTotal ? line.netTotal.toLocaleString() : 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Save Controls */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setReviewLines([])}>
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  className="btn"
                  onClick={handleSaveInboundInvoice}
                  disabled={savingInvoice}
                  style={{
                    background: movementType === 'outbound' ? '#ff4d4f' : 'var(--primary)',
                    borderColor: movementType === 'outbound' ? '#ff4d4f' : 'var(--primary)',
                    color: '#fff',
                    fontWeight: 700,
                  }}
                >
                  {savingInvoice ? (
                    <span className="spinner"></span>
                  ) : movementType === 'outbound' ? (
                    isAr ? '📤 اعتماد وخصم البنود من رصيد المخزن (-)' : 'Confirm & Deduct Stock (-)'
                  ) : (
                    isAr ? '📥 اعتماد وإضافة البنود إلى رصيد المخزن (+)' : 'Confirm & Add Stock (+)'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: Access Control (Admin Only) ─── */}
      {activeTab === 'users' && isAdmin && (
        <div className="card fade-in" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            ⚙️ {isAr ? 'إدارة صلاحيات الوصول للمخزن' : 'Warehouse Access Control'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            {isAr
              ? 'تفعيل أو إلغاء تفعيل إمكانية رؤية واستخدام موديول المخازن لكل مستخدم في النظام'
              : 'Enable or disable Warehouse module visibility and usage per registered user'}
          </p>

          {loadingUsers ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}><span className="spinner"></span></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'المستخدم' : 'User'}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'البريد الإلكتروني' : 'Email'}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'صلاحية المخزن' : 'Warehouse Status'}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'الإجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {warehouseUsers.map((u) => (
                    <tr key={u.uid} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{u.displayName || u.email}</td>
                      <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{u.email}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {u.warehouseEnabled ? (
                          <span className="badge badge-valid">✅ {isAr ? 'مفعل' : 'Enabled'}</span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(255,77,79,0.1)', color: '#ff4d4f', border: '1px solid rgba(255,77,79,0.3)' }}>
                            🚫 {isAr ? 'معطل' : 'Disabled'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {u.email === 'gemy.essam.ge@gmail.com' ? (
                          <span style={{ fontSize: '0.8rem', color: '#FFD700' }}>👑 Master Admin</span>
                        ) : (
                          <button
                            className={`btn ${u.warehouseEnabled ? 'btn-ghost' : 'btn-primary'} btn-sm`}
                            onClick={() => handleToggleUserAccess(u.uid, u.warehouseEnabled)}
                          >
                            {u.warehouseEnabled ? (isAr ? 'إلغاء التفعيل' : 'Disable Access') : (isAr ? 'تفعيل الوصول' : 'Grant Access')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 4: Project Settings ─── */}
      {activeTab === 'projects' && (
        <div className="card fade-in" style={{ padding: '1.5rem', maxWidth: '600px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            📁 {isAr ? 'إضافة مشروع مخزن جديد' : 'Create New Warehouse Project'}
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            {isAr ? 'مثل: Canex Stock, Schuco Project A, Export Project B' : 'e.g. Canex Stock, Schuco Project A'}
          </p>

          <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>{isAr ? 'اسم المشروع:' : 'Project Name:'}</label>
              <input
                type="text"
                required
                placeholder="e.g. Schuco Villa Project A"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.6rem 0.9rem', borderRadius: '8px', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>{isAr ? 'كود المشروع المختصر:' : 'Project Code:'}</label>
              <input
                type="text"
                placeholder="e.g. SCHUCO_A"
                value={newProjectCode}
                onChange={(e) => setNewProjectCode(e.target.value)}
                style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.6rem 0.9rem', borderRadius: '8px', color: '#fff' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>{isAr ? 'وصف المشروع:' : 'Description:'}</label>
              <textarea
                rows="3"
                placeholder={isAr ? 'وصف اختياري للمشروع والمقع' : 'Optional project details'}
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.6rem 0.9rem', borderRadius: '8px', color: '#fff' }}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={creatingProject} style={{ alignSelf: 'flex-start' }}>
              {creatingProject ? <span className="spinner"></span> : isAr ? '➕ إنشاء المشروع' : 'Create Project'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
