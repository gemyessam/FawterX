import { useState, useEffect, useContext, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { AppContext } from '../App'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import {
  getWarehouseProjects,
  createWarehouseProject,
  getProjectStock,
  parseWarehouseInvoice,
  processWarehouseInvoice,
  getWarehouseUsers,
  updateWarehouseUserAccess,
  updateStockItem,
  deleteStockItem,
  getWarehouseInvoices,
  getInvoiceMovements,
  getItemMovementsHistory,
  updateWarehouseInvoiceMetadata,
} from '../services/warehouseApi'

export default function Warehouse() {
  const { lang, user, isAdmin } = useContext(AppContext)
  const isAr = lang === 'ar'

  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [stock, setStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('stock') // 'stock' | 'history' | 'upload' | 'users' | 'projects'

  // Transaction History State
  const [invoices, setInvoices] = useState([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [invoiceMovements, setInvoiceMovements] = useState([])
  const [loadingMovements, setLoadingMovements] = useState(false)

  // Invoice Metadata Edit State
  const [editingMetadata, setEditingMetadata] = useState(false)
  const [editSalesOrder, setEditSalesOrder] = useState('')
  const [editCustomerRef, setEditCustomerRef] = useState('')
  const [savingMetadata, setSavingMetadata] = useState(false)

  // Item Movement History Modal State
  const [selectedStockItemHistory, setSelectedStockItemHistory] = useState(null)
  const [itemMovements, setItemMovements] = useState([])
  const [loadingItemMovements, setLoadingItemMovements] = useState(false)

  const handleViewItemHistory = async (item) => {
    setSelectedStockItemHistory(item)
    setLoadingItemMovements(true)
    try {
      const res = await getItemMovementsHistory(selectedProjectId, item.itemKey, item.itemCode)
      setItemMovements(res.movements || [])
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل جلب سجل حركات البند' : 'Failed to load item movement history'))
      setItemMovements([])
    } finally {
      setLoadingItemMovements(false)
    }
  }

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('')

  // Stock Table Column Toggle State (Persisted in localStorage)
  const DEFAULT_STOCK_COLUMNS = {
    index: true,
    itemCode: true,
    customerCode: true,
    description: true,
    finish: true,
    salesOrder: true,
    customerRef: true,
    lengthMm: true,
    quantityBar: true,
    quantityLm: true,
    quantityKg: true,
    lastUnitCost: true,
    totalValue: true,
    actions: true,
  }

  const [stockColumns, setStockColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('fawterx_stock_columns')
      if (saved) return { ...DEFAULT_STOCK_COLUMNS, ...JSON.parse(saved) }
    } catch (e) {
      console.warn('Failed to load column preferences:', e)
    }
    return DEFAULT_STOCK_COLUMNS
  })

  const [showColumnPicker, setShowColumnPicker] = useState(false)

  const toggleStockColumn = (colKey) => {
    setStockColumns((prev) => {
      const updated = { ...prev, [colKey]: !prev[colKey] }
      try {
        localStorage.setItem('fawterx_stock_columns', JSON.stringify(updated))
      } catch (e) {}
      return updated
    })
  }

  const resetStockColumns = () => {
    setStockColumns(DEFAULT_STOCK_COLUMNS)
    try {
      localStorage.setItem('fawterx_stock_columns', JSON.stringify(DEFAULT_STOCK_COLUMNS))
    } catch (e) {}
  }

  // Access Control (Admin)
  const [warehouseUsers, setWarehouseUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Upload & Review State
  const [uploading, setUploading] = useState(false)
  const [movementType, setMovementType] = useState('inbound') // 'inbound' | 'outbound'
  const [parsedMeta, setParsedMeta] = useState({ invoiceNumber: '', invoiceDate: '', receiptDate: '', supplier: 'Canex', currency: 'EGP', movementType: 'inbound' })
  const [reviewLines, setReviewLines] = useState([])
  const [savingInvoice, setSavingInvoice] = useState(false)

  // New Project Form
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectCode, setNewProjectCode] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)

  // Stock Item Admin Management State
  const [editingStockKey, setEditingStockKey] = useState(null)
  const [editingStockData, setEditingStockData] = useState({})
  const [savingStockEdit, setSavingStockEdit] = useState(false)

  const handleStartStockEdit = (item) => {
    setEditingStockKey(item.itemKey)
    setEditingStockData({
      customerCode: item.customerCode || '',
      description: item.description || '',
      finish: item.finish || 'STD',
      lengthMm: item.lengthMm || 6000,
      quantityBar: item.quantityBar || 0,
      quantityKg: item.quantityKg || 0,
      lastUnitCost: item.lastUnitCost || 0,
    })
  }

  const handleSaveStockEdit = async (itemKey) => {
    if (!selectedProjectId) return
    try {
      setSavingStockEdit(true)
      await updateStockItem(selectedProjectId, itemKey, editingStockData)
      toast.success(isAr ? 'تم تحديث بيانات الصنف والأعواد بنجاح' : 'Item updated successfully')
      setEditingStockKey(null)
      loadStock(selectedProjectId)
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل تحديث بيانات الصنف' : 'Failed to update item'))
    } finally {
      setSavingStockEdit(false)
    }
  }

  const handleDeleteStockItem = async (item) => {
    if (!selectedProjectId) return
    const confirmMsg = isAr
      ? `هل أنت تأكد من حذف الصنف (${item.itemCode}) نهائياً من أرصدة المخزن؟`
      : `Are you sure you want to delete item (${item.itemCode}) from stock?`
    if (!window.confirm(confirmMsg)) return

    try {
      await deleteStockItem(selectedProjectId, item.itemKey)
      toast.success(isAr ? 'تم حذف الصنف من المخزن' : 'Item deleted from stock')
      loadStock(selectedProjectId)
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل حذف الصنف' : 'Failed to delete item'))
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (selectedProjectId) {
      loadStock(selectedProjectId)
      if (activeTab === 'history') {
        loadInvoices(selectedProjectId)
      }
    }
  }, [selectedProjectId, activeTab])

  useEffect(() => {
    if (activeTab === 'users' && isAdmin) {
      loadUsers()
    }
  }, [activeTab, isAdmin])

  async function loadInvoices(projectId) {
    setLoadingInvoices(true)
    try {
      const res = await getWarehouseInvoices(projectId)
      if (res.success && res.invoices) {
        setInvoices(res.invoices)
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحميل سجل الحركات' : 'Failed to load transaction history')
    } finally {
      setLoadingInvoices(false)
    }
  }

  async function handleViewInvoiceDetails(inv) {
    setSelectedInvoice(inv)
    setEditSalesOrder(inv.salesOrder || '')
    setEditCustomerRef(inv.customerReference || '')
    setEditingMetadata(false)
    setLoadingMovements(true)
    try {
      const res = await getInvoiceMovements(selectedProjectId, inv.id)
      if (res.success && res.movements) {
        setInvoiceMovements(res.movements)
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحميل تفاصيل الحركة' : 'Failed to load movement details')
    } finally {
      setLoadingMovements(false)
    }
  }

  async function handleSaveInvoiceMetadata() {
    if (!selectedInvoice || !selectedProjectId) return
    setSavingMetadata(true)
    try {
      const res = await updateWarehouseInvoiceMetadata(selectedProjectId, selectedInvoice.id, {
        salesOrder: editSalesOrder,
        customerReference: editCustomerRef,
      })
      if (res.success) {
        toast.success(isAr ? 'تم تحديث بيانات الفاتورة بنجاح!' : 'Invoice metadata updated successfully!')
        const updatedInv = { ...selectedInvoice, salesOrder: editSalesOrder, customerReference: editCustomerRef }
        setSelectedInvoice(updatedInv)
        setInvoices((prev) => prev.map((inv) => (inv.id === selectedInvoice.id ? updatedInv : inv)))
        setEditingMetadata(false)
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحديث بيانات الفاتورة' : 'Failed to update invoice metadata')
    } finally {
      setSavingMetadata(false)
    }
  }

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
      const res = await parseWarehouseInvoice(file)
      if (res.success) {
        const parsed = (res.lines || []).map((line, idx) => ({
          id: line.id || `line_${idx + 1}`,
          itemCode: line.itemCode || `ITEM-${idx + 1}`,
          customerCode: line.customerCode || '',
          description: line.description || '',
          finish: line.finish || line.color || 'MF',
          color: line.color || line.finish || 'MF',
          lengthMm: Number(line.lengthMm || 6000),
          unit: line.unit || 'BAR',
          priceUnit: line.priceUnit || 'M',
          quantityBar: Number(line.quantityBar || 0),
          quantityLm: Number(line.quantityLm || 0),
          quantityKg: Number(line.quantityKg || 0),
          unitPrice: Number(line.unitPrice || 0),
          barPrice: Number(line.barPrice || 0),
          netTotal: Number(line.netTotal || 0),
          temper: line.temper || '',
          alloy: line.alloy || '',
          hsCode: line.hsCode || '',
          isService: Boolean(line.isService),
          ignored: Boolean(line.ignored || line.isService),
        }))

        setParsedMeta({
          invoiceNumber: res.metadata?.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
          salesOrder: res.metadata?.salesOrder || '',
          customerReference: res.metadata?.customerReference || '',
          invoiceDate: res.metadata?.invoiceDate || '',
          receiptDate: res.metadata?.receiptDate || res.metadata?.deliveryDate || '',
          supplier: res.metadata?.supplier || 'Canex',
          currency: res.metadata?.currency || 'EGP',
          totalAmount: res.metadata?.totalAmount || 0,
          invoiceAmount: res.metadata?.invoiceAmount || 0,
          taxAmount: res.metadata?.taxAmount || 0,
          fileName: file.name,
          movementType: movementType,
        })
        setReviewLines(parsed)
        setActiveTab('upload')
        toast.success(isAr ? 'تم تحليل الفاتورة بنجاح! يرجى مراجعة البنود قبل الحفظ' : 'Invoice parsed! Review lines before saving.')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'فشل تحليل الفاتورة' : 'Failed to parse invoice'))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function updateReviewLine(index, field, value) {
    setReviewLines((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      if (field === 'quantityBar' || field === 'quantityLm' || field === 'lengthMm' || field === 'unitPrice' || field === 'barPrice' || field === 'priceUnit') {
        const bar = Number(copy[index].quantityBar || 0)
        const len = Number(copy[index].lengthMm || 6000)
        if (field === 'quantityBar' || field === 'lengthMm') {
          copy[index].quantityLm = (bar * len) / 1000
        }
        const lm = Number(copy[index].quantityLm || 0)
        const priceUnit = String(copy[index].priceUnit || 'M').toUpperCase()
        const unitPrice = Number(copy[index].unitPrice || 0)
        const barPrice = Number(copy[index].barPrice || 0)
        copy[index].netTotal = priceUnit === 'BAR' ? bar * (barPrice || unitPrice) : lm * unitPrice
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
        if (res.isDuplicate) {
          toast.info(res.message || (isAr ? 'تم تحديث بيانات الفاتورة المسجلة سابقاً بدون تكرار الكميات' : 'Updated duplicate invoice metadata without duplicating stock'))
        } else {
          const isOut = movementType === 'outbound'
          const msgAr = isOut
            ? `تم خصم البنود من المخزن بنجاح! (-${res.movementsCount} أصناف)`
            : `تم إضافة البنود إلى المخزن بنجاح! (+${res.movementsCount} أصناف)`
          const msgEn = isOut
            ? `Stock deducted successfully! (-${res.movementsCount} items)`
            : `Stock added successfully! (+${res.movementsCount} items)`
          toast.success(isAr ? msgAr : msgEn)
        }
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

  // Filter Stock List (Comprehensive Search across all fields)
  const filteredStock = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return stock

    const searchTerms = q.split(/\s+/).filter(Boolean)

    return stock.filter((item) => {
      const invStr = Array.isArray(item.invoiceNumbers)
        ? item.invoiceNumbers.join(' ')
        : String(item.invoiceNumbers || '')

      const fullItemText = [
        item.itemCode,
        item.customerCode,
        item.description,
        item.finish,
        item.color,
        item.itemKey,
        item.lengthMm,
        item.lastSalesOrder || item.salesOrder,
        item.lastCustomerRef || item.customerReference,
        item.lastInvoiceNumber,
        invStr,
        item.supplier,
        item.supplierName,
        item.priceUnit,
        item.quantityBar,
        item.quantityLm,
        item.quantityKg,
        item.lastUnitCost,
        item.lastBarCost,
      ]
        .filter((val) => val !== undefined && val !== null && val !== '')
        .join(' ')
        .toLowerCase()

      return searchTerms.every((term) => fullItemText.includes(term))
    })
  }, [stock, searchQuery])

  // Filter Transaction History List
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return invoices

    const searchTerms = q.split(/\s+/).filter(Boolean)

    return invoices.filter((inv) => {
      const itemsText = Array.isArray(inv.items)
        ? inv.items
            .map((i) => `${i.itemCode || ''} ${i.customerCode || ''} ${i.description || ''} ${i.finish || ''} ${i.color || ''}`)
            .join(' ')
        : ''

      const fullInvText = [
        inv.invoiceNumber,
        inv.salesOrder,
        inv.customerReference,
        inv.supplier,
        inv.fileName,
        inv.movementType,
        inv.notes,
        inv.totalAmount,
        inv.lineItemsCount,
        itemsText,
      ]
        .filter((val) => val !== undefined && val !== null && val !== '')
        .join(' ')
        .toLowerCase()

      return searchTerms.every((term) => fullInvText.includes(term))
    })
  }, [invoices, searchQuery])

  // Item Financial Value Calculator
  const getItemValue = (item) => {
    const barCost = Number(item.lastBarCost || item.lastUnitCost || 0)
    if (barCost > 0) {
      return Number(item.quantityBar || 0) * barCost
    }
    if (item.lastUnitCost && Number(item.lastUnitCost) > 0) {
      if (String(item.priceUnit).toUpperCase() === 'M') {
        return Number(item.quantityLm || 0) * Number(item.lastUnitCost)
      }
      return Number(item.quantityBar || 0) * Number(item.lastUnitCost)
    }
    return 0
  }

  // Stock Totals for Cards and Excel Summary
  const stockTotals = useMemo(() => {
    let bars = 0
    let lm = 0
    let kg = 0
    let totalValue = 0

    filteredStock.forEach((item) => {
      bars += Number(item.quantityBar || 0)
      lm += Number(item.quantityLm || 0)
      kg += Number(item.quantityKg || 0)
      totalValue += getItemValue(item)
    })

    return {
      itemCount: filteredStock.length,
      bars,
      lm,
      kg,
      totalValue,
    }
  }, [filteredStock])

  // Export Stock to Excel (.xlsx) using ExcelJS for rich styling matching the user reference image
  const handleExportStockToExcel = async () => {
    if (!filteredStock || filteredStock.length === 0) {
      toast.error(isAr ? 'لا توجد بيانات أصناف للتصدير' : 'No stock items available to export')
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'FawterX Warehouse'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet(isAr ? 'المخزون' : 'Stock_Inventory', {
        views: [{ showGridLines: true }]
      })

      // Column Definitions
      const columns = [
        { header: isAr ? 'م' : '#', key: 'idx', width: 6 },
        { header: isAr ? 'رقم الفاتورة / الفواتير' : 'Invoice No', key: 'invoiceNo', width: 22 },
        { header: isAr ? 'كود الصنف' : 'Item Code', key: 'itemCode', width: 18 },
        { header: isAr ? 'كود العميل' : 'Customer Code', key: 'customerCode', width: 16 },
        { header: isAr ? 'بيان الصنف' : 'Description', key: 'description', width: 52 },
        { header: isAr ? 'نوع الدهان/اللون' : 'Finish/Color', key: 'finish', width: 18 },
        { header: isAr ? 'الطول (mm)' : 'Length (mm)', key: 'lengthMm', width: 15 },
        { header: isAr ? 'الأعواد (BAR)' : 'Bars (BAR)', key: 'quantityBar', width: 15 },
        { header: isAr ? 'الأمتار (LM)' : 'Meters (LM)', key: 'quantityLm', width: 15 },
        { header: isAr ? 'الوزن (KG)' : 'Weight (KG)', key: 'quantityKg', width: 14 },
        { header: isAr ? 'سعر التوريد (EGP)' : 'Last Unit Cost (EGP)', key: 'lastUnitCost', width: 22 },
        { header: isAr ? 'إجمالي قيمة البند (EGP)' : 'Total Item Value (EGP)', key: 'totalValue', width: 26 },
      ]

      worksheet.columns = columns

      // Style Header Row (Row 1) matching Image 2: Dark Blue background, bold white text, centered, thin grid borders
      const headerRow = worksheet.getRow(1)
      headerRow.height = 28
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2F5597' }
        }
        cell.font = {
          name: 'Calibri',
          size: 11,
          bold: true,
          color: { argb: 'FFFFFFFF' }
        }
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
        }
      })

      const borderStyle = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      }

      // Populate Data Rows
      filteredStock.forEach((item, idx) => {
        const val = getItemValue(item)
        const invNo = (Array.isArray(item.invoiceNumbers) && item.invoiceNumbers.length > 0)
          ? item.invoiceNumbers.join(', ')
          : (item.lastInvoiceNumber || item.invoiceNumber || '—')
        const kgVal = Number(item.quantityKg || 0)

        const row = worksheet.addRow({
          idx: idx + 1,
          invoiceNo: invNo,
          itemCode: item.itemCode,
          customerCode: item.customerCode || '—',
          description: item.description || '',
          finish: item.finish || 'STD',
          lengthMm: Number(item.lengthMm || 0),
          quantityBar: Number(item.quantityBar || 0),
          quantityLm: Number(item.quantityLm || 0),
          quantityKg: kgVal > 0 ? kgVal : '-',
          lastUnitCost: Number(item.lastUnitCost || 0),
          totalValue: Number(val || 0)
        })

        row.height = 20
        row.eachCell((cell, colNumber) => {
          cell.border = borderStyle
          cell.font = { name: 'Calibri', size: 10 }

          if (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 4 || colNumber === 6) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          } else if (colNumber === 5) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' }
          } else if (colNumber === 10 && cell.value === '-') {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          } else {
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
            cell.numFmt = '#,##0.00'
          }
        })
      })

      // Add Grand Total Summary Row
      const totalBars = filteredStock.reduce((acc, i) => acc + Number(i.quantityBar || 0), 0)
      const totalLm = filteredStock.reduce((acc, i) => acc + Number(i.quantityLm || 0), 0)
      const totalKg = filteredStock.reduce((acc, i) => acc + Number(i.quantityKg || 0), 0)
      const grandTotalVal = filteredStock.reduce((acc, i) => acc + getItemValue(i), 0)

      const summaryRow = worksheet.addRow({
        idx: '',
        invoiceNo: '',
        itemCode: isAr ? 'الإجمالي الكلي' : 'GRAND TOTAL',
        customerCode: '',
        description: `${isAr ? 'عدد الأصناف:' : 'Total Items:'} ${filteredStock.length}`,
        finish: '',
        lengthMm: '',
        quantityBar: totalBars,
        quantityLm: totalLm,
        quantityKg: totalKg > 0 ? totalKg : '-',
        lastUnitCost: '',
        totalValue: grandTotalVal
      })

      summaryRow.height = 24
      const summaryBorderStyle = {
        top: { style: 'thin', color: { argb: 'FF595959' } },
        bottom: { style: 'double', color: { argb: 'FF595959' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      }

      summaryRow.eachCell((cell, colNumber) => {
        cell.border = summaryBorderStyle
        cell.font = { name: 'Calibri', size: 10, bold: true }

        if (colNumber === 3) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        } else if (colNumber === 5) {
          cell.alignment = { horizontal: 'left', vertical: 'middle' }
        } else if (colNumber === 10 && cell.value === '-') {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        } else if (colNumber === 8 || colNumber === 9 || colNumber === 10 || colNumber === 12) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' }
          cell.numFmt = '#,##0.00'
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const selectedProjObj = projects.find((p) => p.id === selectedProjectId)
      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `Stock_Inventory_${selectedProjObj?.code || 'CANEX'}_${dateStr}.xlsx`

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)

      toast.success(isAr ? 'تم تصدير ملف Excel المنظم بنجاح!' : 'Exported to Excel with full styling successfully!')
    } catch (err) {
      console.error('Excel Export Error:', err)
      toast.error(isAr ? 'حدث خطأ أثناء تصدير ملف Excel' : 'Error exporting Excel file')
    }
  }

  // Export Transaction History to Excel
  const handleExportHistoryToExcel = async () => {
    if (!filteredInvoices || filteredInvoices.length === 0) {
      toast.error(isAr ? 'لا يوجد سجل حركات للتصدير' : 'No history transactions available to export')
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'FawterX Warehouse'
      workbook.created = new Date()

      const worksheet = workbook.addWorksheet(isAr ? 'سجل الحركات' : 'Transaction_History', {
        views: [{ showGridLines: true }]
      })

      const columns = [
        { header: isAr ? 'م' : '#', key: 'idx', width: 6 },
        { header: isAr ? 'رقم الفاتورة' : 'Invoice No', key: 'invoiceNo', width: 22 },
        { header: isAr ? 'أمر البيع (SO)' : 'Sales Order #', key: 'salesOrder', width: 20 },
        { header: isAr ? 'مرجع العميل' : 'Customer Ref', key: 'customerReference', width: 22 },
        { header: isAr ? 'نوع الحركة' : 'Movement Type', key: 'movementType', width: 24 },
        { header: isAr ? 'المورد / الجهة' : 'Supplier', key: 'supplier', width: 18 },
        { header: isAr ? 'اسم الملف' : 'File Name', key: 'fileName', width: 32 },
        { header: isAr ? 'عدد البنود' : 'Line Items', key: 'lineItemsCount', width: 14 },
        { header: isAr ? 'إجمالي الأعواد' : 'Total Bars', key: 'totalQuantityBar', width: 16 },
        { header: isAr ? 'إجمالي الأمتار' : 'Total LM', key: 'totalQuantityLm', width: 16 },
        { header: isAr ? 'إجمالي القيمة (EGP)' : 'Total Amount (EGP)', key: 'totalAmount', width: 22 },
        { header: isAr ? 'تاريخ الفاتورة' : 'Invoice Date', key: 'invoiceDate', width: 16 },
        { header: isAr ? 'تاريخ التسجيل' : 'Recorded At', key: 'recordedAt', width: 24 },
      ]

      worksheet.columns = columns

      const headerRow = worksheet.getRow(1)
      headerRow.height = 28
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2F5597' }
        }
        cell.font = {
          name: 'Calibri',
          size: 11,
          bold: true,
          color: { argb: 'FFFFFFFF' }
        }
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true
        }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
          right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
        }
      })

      const borderStyle = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
      }

      filteredInvoices.forEach((inv, idx) => {
        const row = worksheet.addRow({
          idx: idx + 1,
          invoiceNo: inv.invoiceNumber || '—',
          salesOrder: inv.salesOrder || '—',
          customerReference: inv.customerReference || '—',
          movementType: inv.movementType === 'outbound' ? (isAr ? 'صرف (خصم من المخزن)' : 'Outbound') : (isAr ? 'توريد (إضافة للمخزن)' : 'Inbound'),
          supplier: inv.supplier || 'Canex',
          fileName: inv.fileName || 'منفذ يدوياً',
          lineItemsCount: Number(inv.lineItemsCount || 0),
          totalQuantityBar: Number(inv.totalQuantityBar || 0),
          totalQuantityLm: Number(inv.totalQuantityLm || 0),
          totalAmount: Number(inv.totalAmount || 0),
          invoiceDate: inv.invoiceDate || '—',
          recordedAt: inv.createdAt ? new Date(inv.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US') : '—',
        })

        row.height = 20
        row.eachCell((cell, colNumber) => {
          cell.border = borderStyle
          cell.font = { name: 'Calibri', size: 10 }

          if (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 4 || colNumber === 10 || colNumber === 11) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          } else if (colNumber === 5) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' }
          } else {
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
            if (colNumber === 8 || colNumber === 9) {
              cell.numFmt = '#,##0.00'
            } else if (colNumber === 6 || colNumber === 7) {
              cell.numFmt = '#,##0'
            }
          }
        })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const selectedProjObj = projects.find((p) => p.id === selectedProjectId)
      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `Warehouse_History_${selectedProjObj?.code || 'CANEX'}_${dateStr}.xlsx`

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)

      toast.success(isAr ? 'تم تصدير سجل الحركات إلى Excel بنجاح!' : 'Exported history to Excel successfully!')
    } catch (err) {
      console.error('History Excel Export Error:', err)
      toast.error(isAr ? 'حدث خطأ أثناء تصدير سجل الحركات' : 'Error exporting history Excel file')
    }
  }

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
          className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('history')}
        >
          📜 {isAr ? 'سجل الحركات والتوريدات' : 'Transaction History'}
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
          {/* Summary Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                {isAr ? 'عدد الأصناف' : 'Total Items'}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>
                {stockTotals.itemCount}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                {isAr ? 'إجمالي عدد الأعواد' : 'Total Bars'}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#8ab4ff' }}>
                <span dir="ltr">{stockTotals.bars.toLocaleString()} BAR</span>
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                {isAr ? 'إجمالي الأمتار' : 'Total Meters'}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ffb74d' }}>
                <span dir="ltr">{stockTotals.lm.toLocaleString('en-US', { maximumFractionDigits: 1 })} m</span>
              </div>
            </div>
            <div style={{ background: 'rgba(0, 224, 161, 0.08)', border: '1px solid rgba(0, 224, 161, 0.3)', borderRadius: '10px', padding: '1rem' }}>
              <div style={{ color: '#00e0a1', fontSize: '0.8rem', marginBottom: '0.2rem', fontWeight: 600 }}>
                {isAr ? 'إجمالي قيمة المخزون الحالية' : 'Grand Total Stock Value'}
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#00e0a1' }}>
                <span dir="ltr">{stockTotals.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                {isAr ? `رصيد المخزن لمشروع: ${selectedProject?.name || ''}` : `Stock Inventory: ${selectedProject?.name || ''}`}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {isAr ? 'يتم التحديث تلقائياً من حركات التوريد والصرف المؤكدة' : 'Auto-updated from confirmed inbound and outbound movements'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="search"
                placeholder={isAr ? 'ابحث برقم الصنف، الوصف، أو الدهان...' : 'Search item code, description, finish...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  minWidth: '260px',
                  background: '#101223',
                  border: '1px solid var(--border)',
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <button
                className="btn"
                onClick={handleExportStockToExcel}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.55rem 1.2rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                }}
                title={isAr ? 'تصدير المخزون الحالي إلى ملف اكسيل مع إجمالي القيم' : 'Export inventory to Excel with values'}
              >
                📊 {isAr ? 'تصدير Excel' : 'Export Excel'}
              </button>

              <div style={{ position: 'relative' }}>
                <button
                  className="btn"
                  onClick={() => setShowColumnPicker(!showColumnPicker)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#fff',
                    border: '1px solid var(--border)',
                    padding: '0.55rem 1.1rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                  }}
                  title={isAr ? 'إظهار وإخفاء أعمدة جدول رصيد المخزن' : 'Show / Hide stock table columns'}
                >
                  ⚙️ {isAr ? 'تخصيص الأعمدة' : 'Columns'}
                </button>

                {showColumnPicker && (
                  <div
                    className="card fade-in"
                    style={{
                      position: 'absolute',
                      top: '110%',
                      left: isAr ? 0 : 'auto',
                      right: isAr ? 'auto' : 0,
                      zIndex: 900,
                      width: '260px',
                      background: '#161b33',
                      border: '1px solid #00e0a1',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      padding: '1rem',
                      borderRadius: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#00e0a1' }}>
                        ⚙️ {isAr ? 'تحديد أعمدة الجدول' : 'Select Columns'}
                      </span>
                      <button
                        onClick={resetStockColumns}
                        style={{ background: 'transparent', border: 'none', color: '#8ab4ff', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {isAr ? 'الافتراضي' : 'Reset'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
                      {[
                        { key: 'index', label: isAr ? '#' : '#' },
                        { key: 'itemCode', label: isAr ? 'كود الصنف' : 'Item Code' },
                        { key: 'customerCode', label: isAr ? 'كود العميل' : 'Customer Code' },
                        { key: 'description', label: isAr ? 'بيان الصنف' : 'Description' },
                        { key: 'finish', label: isAr ? 'نوع الدهان/اللون' : 'Finish/Color' },
                        { key: 'salesOrder', label: isAr ? 'أمر البيع (SO)' : 'Sales Order (SO)' },
                        { key: 'customerRef', label: isAr ? 'مرجع العميل (Ref)' : 'Customer Ref' },
                        { key: 'lengthMm', label: isAr ? 'الطول (mm)' : 'Length (mm)' },
                        { key: 'quantityBar', label: isAr ? 'الأعواد (BAR)' : 'Bars' },
                        { key: 'quantityLm', label: isAr ? 'الأمتار (LM)' : 'Meters' },
                        { key: 'quantityKg', label: isAr ? 'الوزن (KG)' : 'Weight' },
                        { key: 'lastUnitCost', label: isAr ? 'آخر سعر توريد' : 'Last Cost' },
                        { key: 'totalValue', label: isAr ? 'إجمالي القيمة' : 'Total Value' },
                        { key: 'actions', label: isAr ? 'السجل والتحكم' : 'Actions' },
                      ].map((col) => (
                        <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#e8eaf6', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={!!stockColumns[col.key]}
                            onChange={() => toggleStockColumn(col.key)}
                            style={{ accentColor: '#00e0a1', cursor: 'pointer' }}
                          />
                          {col.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', textAlign: isAr ? 'right' : 'left' }}>
                  {stockColumns.index && <th style={{ padding: '0.75rem 1rem', width: '45px' }}>#</th>}
                  {stockColumns.itemCode && <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'كود الصنف' : 'Item Code'}</th>}
                  {stockColumns.customerCode && <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'كود العميل' : 'Customer Code'}</th>}
                  {stockColumns.description && <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'بيان الصنف' : 'Description'}</th>}
                  {stockColumns.finish && <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'نوع الدهان/اللون' : 'Finish/Color'}</th>}
                  {stockColumns.salesOrder && <th style={{ padding: '0.75rem 1rem', color: '#00e0a1' }}>{isAr ? 'أمر البيع (SO)' : 'Sales Order #'}</th>}
                  {stockColumns.customerRef && <th style={{ padding: '0.75rem 1rem', color: '#ffb74d' }}>{isAr ? 'مرجع العميل' : 'Customer Ref'}</th>}
                  {stockColumns.lengthMm && <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'الطول (mm)' : 'Length (mm)'}</th>}
                  {stockColumns.quantityBar && <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'الأعواد (BAR)' : 'Bars (BAR)'}</th>}
                  {stockColumns.quantityLm && <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'الأمتار (LM)' : 'Meters (LM)'}</th>}
                  {stockColumns.quantityKg && <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'الوزن (KG)' : 'Weight (KG)'}</th>}
                  {stockColumns.lastUnitCost && <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'آخر سعر توريد' : 'Last Cost'}</th>}
                  {stockColumns.totalValue && <th style={{ padding: '0.75rem 1rem', color: '#00e0a1' }}>{isAr ? 'إجمالي القيمة' : 'Total Value'}</th>}
                  {stockColumns.actions && <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{isAr ? 'السجل والتحكم' : 'History & Actions'}</th>}
                </tr>
              </thead>
              <tbody>
                {filteredStock.length > 0 ? (
                  filteredStock.map((item, idx) => {
                    const isEditing = editingStockKey === item.itemKey
                    const itemVal = getItemValue(item)
                    return (
                      <tr key={item.itemKey} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isEditing ? 'rgba(0, 224, 161, 0.05)' : 'transparent' }}>
                        {stockColumns.index && <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>}
                        {stockColumns.itemCode && (
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>
                            <button
                              onClick={() => handleViewItemHistory(item)}
                              style={{ background: 'transparent', border: 'none', color: '#00e0a1', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontSize: '0.9rem' }}
                              title={isAr ? 'عرض سجل حركات هذا البند' : 'View item history'}
                            >
                              📜 {item.itemCode}
                            </button>
                          </td>
                        )}
                        {stockColumns.customerCode && (
                          <td style={{ padding: '0.75rem 1rem', color: '#8ab4ff', fontWeight: 600 }}>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingStockData.customerCode}
                                onChange={(e) => setEditingStockData({ ...editingStockData, customerCode: e.target.value })}
                                style={{ width: '90px', background: '#101223', color: '#fff', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px' }}
                              />
                            ) : (
                              item.customerCode || '—'
                            )}
                          </td>
                        )}
                        {stockColumns.description && (
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingStockData.description}
                                onChange={(e) => setEditingStockData({ ...editingStockData, description: e.target.value })}
                                style={{ width: '100%', minWidth: '220px', background: '#101223', color: '#fff', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px' }}
                              />
                            ) : (
                              item.description
                            )}
                          </td>
                        )}
                        {stockColumns.finish && (
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingStockData.finish}
                                onChange={(e) => setEditingStockData({ ...editingStockData, finish: e.target.value })}
                                style={{ width: '70px', background: '#101223', color: '#fff', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px' }}
                              />
                            ) : (
                              <span className="badge" style={{ background: 'rgba(255,215,0,0.1)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)' }}>
                                {item.finish || 'STD'}
                              </span>
                            )}
                          </td>
                        )}
                        {stockColumns.salesOrder && (
                          <td style={{ padding: '0.75rem 1rem', color: '#00e0a1', fontWeight: 600 }}>
                            {item.lastSalesOrder || item.salesOrder || '—'}
                          </td>
                        )}
                        {stockColumns.customerRef && (
                          <td style={{ padding: '0.75rem 1rem', color: '#ffb74d', fontWeight: 600 }}>
                            {item.lastCustomerRef || item.customerReference || '—'}
                          </td>
                        )}
                        {stockColumns.lengthMm && (
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {isEditing ? (
                              <input
                                type="number"
                                value={editingStockData.lengthMm}
                                onChange={(e) => setEditingStockData({ ...editingStockData, lengthMm: Number(e.target.value) })}
                                style={{ width: '80px', background: '#101223', color: '#fff', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px' }}
                              />
                            ) : (
                              <span dir="ltr">{item.lengthMm} mm</span>
                            )}
                          </td>
                        )}
                        {stockColumns.quantityBar && (
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#ffffff' }}>
                            {isEditing ? (
                              <input
                                type="number"
                                value={editingStockData.quantityBar}
                                onChange={(e) => setEditingStockData({ ...editingStockData, quantityBar: Number(e.target.value) })}
                                style={{ width: '90px', background: '#101223', color: '#00e0a1', fontWeight: 'bold', border: '1px solid #00e0a1', borderRadius: '4px', padding: '4px 6px' }}
                              />
                            ) : (
                              item.quantityBar
                            )}
                          </td>
                        )}
                        {stockColumns.quantityLm && (
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span dir="ltr">
                              {isEditing
                                ? `${(((editingStockData.quantityBar || 0) * (editingStockData.lengthMm || 6000)) / 1000).toFixed(1)} m`
                                : item.quantityLm ? `${item.quantityLm.toFixed(1)} m` : '—'}
                            </span>
                          </td>
                        )}
                        {stockColumns.quantityKg && (
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.1"
                                value={editingStockData.quantityKg}
                                onChange={(e) => setEditingStockData({ ...editingStockData, quantityKg: Number(e.target.value) })}
                                style={{ width: '80px', background: '#101223', color: '#fff', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px' }}
                              />
                            ) : (
                              <span dir="ltr">{item.quantityKg ? `${item.quantityKg.toFixed(1)} kg` : '—'}</span>
                            )}
                          </td>
                        )}
                        {stockColumns.lastUnitCost && (
                          <td style={{ padding: '0.75rem 1rem', color: '#64b5f6' }}>
                            <span dir="ltr">{item.lastUnitCost ? `${item.lastUnitCost} ${item.currency || 'EGP'}` : '—'}</span>
                          </td>
                        )}
                        {stockColumns.totalValue && (
                          <td style={{ padding: '0.75rem 1rem', color: '#00e0a1', fontWeight: 700 }}>
                            <span dir="ltr">
                              {itemVal > 0
                                ? `${itemVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EGP`
                                : '—'}
                            </span>
                          </td>
                        )}
                        {stockColumns.actions && (
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                              <button
                                className="btn btn-sm"
                                disabled={savingStockEdit}
                                onClick={() => handleSaveStockEdit(item.itemKey)}
                                style={{ background: '#00e0a1', color: '#000', padding: '2px 8px', fontSize: '0.8rem', fontWeight: 600 }}
                                title={isAr ? 'حفظ التعديلات' : 'Save'}
                              >
                                {savingStockEdit ? '...' : (isAr ? '💾 حفظ' : 'Save')}
                              </button>
                              <button
                                className="btn btn-sm"
                                onClick={() => setEditingStockKey(null)}
                                style={{ background: 'rgba(255,255,255,0.1)', color: '#ccc', padding: '2px 8px', fontSize: '0.8rem' }}
                                title={isAr ? 'إلغاء' : 'Cancel'}
                              >
                                {isAr ? 'إلغاء' : 'Cancel'}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                              <button
                                className="btn btn-sm"
                                onClick={() => handleViewItemHistory(item)}
                                style={{ background: 'rgba(255, 215, 0, 0.15)', color: '#FFD700', border: '1px solid rgba(255, 215, 0, 0.3)', padding: '2px 8px', fontSize: '0.8rem' }}
                                title={isAr ? 'عرض سجل حركات هذا البند' : 'View item history'}
                              >
                                📜 {isAr ? 'السجل' : 'History'}
                              </button>
                              {isAdmin && (
                                <>
                                  <button
                                    className="btn btn-sm"
                                    onClick={() => handleStartStockEdit(item)}
                                    style={{ background: 'rgba(0, 168, 255, 0.15)', color: '#70a1ff', border: '1px solid rgba(0, 168, 255, 0.3)', padding: '2px 8px', fontSize: '0.8rem' }}
                                    title={isAr ? 'تعديل الصنف أو عدد الأعواد' : 'Edit item'}
                                  >
                                    ✏️ {isAr ? 'تعديل' : 'Edit'}
                                  </button>
                                  <button
                                    className="btn btn-sm"
                                    onClick={() => handleDeleteStockItem(item)}
                                    style={{ background: 'rgba(255, 71, 87, 0.15)', color: '#ff4757', border: '1px solid rgba(255, 71, 87, 0.3)', padding: '2px 8px', fontSize: '0.8rem' }}
                                    title={isAr ? 'حذف من المخزن' : 'Delete item'}
                                  >
                                    🗑️ {isAr ? 'حذف' : 'Delete'}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      {isAr ? 'لا توجد أصناف مسجلة في هذا المشروع حتى الآن' : 'No items recorded in this project yet'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB: Transaction History (Audit Log) ─── */}
      {activeTab === 'history' && (
        <div className="card fade-in" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📜 {isAr ? 'سجل الحركات والتوريدات (Audit Trail)' : 'Transaction History & Audit Log'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {isAr
                  ? 'سجل زمني شامل لكافة حركات التوريد والصرف مع ربط الأصناف برقم الفاتورة والتفاصيل'
                  : 'Comprehensive chronological record of all stock additions and deductions per invoice'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="search"
                placeholder={isAr ? 'ابحث برقم الفاتورة، كود العميل، المورد، أو اسم الملف...' : 'Search by invoice #, customer code, supplier, filename...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  minWidth: '260px',
                  background: '#101223',
                  border: '1px solid var(--border)',
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <button
                className="btn"
                onClick={handleExportHistoryToExcel}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.55rem 1.2rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                }}
              >
                📊 {isAr ? 'تصدير سجل الحركات إلى Excel' : 'Export History to Excel'}
              </button>
            </div>
          </div>

          {loadingInvoices ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              ⏳ {isAr ? 'جاري تحميل سجل الحركات...' : 'Loading transaction history...'}
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              📭 {isAr ? 'لا توجد حركات مسجلة تطابق البحث' : 'No transactions found matching your search'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', textAlign: isAr ? 'right' : 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', width: '45px' }}>#</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'رقم الفاتورة' : 'Invoice No'}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'أمر البيع (SO)' : 'Sales Order #'}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'مرجع العميل' : 'Customer Ref'}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'نوع الحركة' : 'Movement'}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'المورد / الجهة' : 'Supplier'}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'اسم الملف المرفوع' : 'File Name'}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'عدد البنود' : 'Line Items'}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'الأعواد / القطاعات' : 'Bars / Profiles'}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'إجمالي الأمتار' : 'Total Meters'}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'إجمالي القيمة' : 'Total Amount'}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'تاريخ التسجيل' : 'Date & Time'}</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{isAr ? 'التفاصيل' : 'Details'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv, idx) => {
                    const isOut = inv.movementType === 'outbound'
                    return (
                      <tr key={inv.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#64b5f6' }}>{inv.invoiceNumber || '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#00e0a1' }}>{inv.salesOrder || '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#ffb74d' }}>{inv.customerReference || '—'}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            className="badge"
                            style={{
                              background: isOut ? 'rgba(255,71,87,0.15)' : 'rgba(0,224,161,0.15)',
                              color: isOut ? '#ff4757' : '#00e0a1',
                              border: `1px solid ${isOut ? 'rgba(255,71,87,0.3)' : 'rgba(0,224,161,0.3)'}`,
                              fontWeight: 700,
                            }}
                          >
                            {isOut ? (isAr ? '📤 صرف (-)' : 'Outbound (-)') : (isAr ? '📥 توريد (+)' : 'Inbound (+)')}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>{inv.supplier || 'Canex'}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{inv.fileName || 'يدوي'}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#FFD700' }}>
                          {inv.lineItemsCount || 0} {isAr ? 'بند' : 'items'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#64b5f6' }}>
                          <span dir="ltr">{inv.totalQuantityBar || 0} BAR</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#a29bfe' }}>
                          <span dir="ltr">{(inv.totalQuantityLm || 0).toFixed(1)} m</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#00e0a1' }}>
                          <span dir="ltr">{(inv.totalAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {inv.createdAt ? new Date(inv.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US') : '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          <button
                            className="btn btn-sm"
                            onClick={() => handleViewInvoiceDetails(inv)}
                            style={{ background: 'rgba(0, 168, 255, 0.15)', color: '#70a1ff', border: '1px solid rgba(0, 168, 255, 0.3)' }}
                          >
                            👁️ {isAr ? 'عرض البنود' : 'Items'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── MODAL: Invoice Movement Items Details ─── */}
      {selectedInvoice && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card fade-in" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', background: '#121629', border: '1px solid #00e0a1', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#00e0a1', margin: 0 }}>
                  🧾 {isAr ? `تفاصيل الفاتورة: ${selectedInvoice.invoiceNumber}` : `Invoice Details: ${selectedInvoice.invoiceNumber}`}
                </h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {isAr ? 'المورد:' : 'Supplier:'} {selectedInvoice.supplier || 'Canex'} | {isAr ? 'التاريخ:' : 'Date:'} {selectedInvoice.invoiceDate || '—'}
                  </span>
                  <span className="badge" style={{ background: 'rgba(0, 224, 161, 0.15)', color: '#00e0a1', border: '1px solid rgba(0, 224, 161, 0.3)', fontSize: '0.8rem' }}>
                    SO #: {selectedInvoice.salesOrder || '—'}
                  </span>
                  <span className="badge" style={{ background: 'rgba(255, 183, 77, 0.15)', color: '#ffb74d', border: '1px solid rgba(255, 183, 77, 0.3)', fontSize: '0.8rem' }}>
                    Ref: {selectedInvoice.customerReference || '—'}
                  </span>
                  {isAdmin && (
                    <button
                      className="btn btn-sm"
                      onClick={() => setEditingMetadata(!editingMetadata)}
                      style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.8rem', padding: '2px 8px' }}
                    >
                      ✏️ {editingMetadata ? (isAr ? 'إلغاء التعديل' : 'Cancel') : (isAr ? 'تعديل البيانات (SO / Customer Ref)' : 'Edit Metadata')}
                    </button>
                  )}
                </div>

                {editingMetadata && (
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', background: 'rgba(0,0,0,0.3)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#00e0a1', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>{isAr ? 'أمر البيع (Sales Order)' : 'Sales Order #'}</label>
                      <input
                        type="text"
                        value={editSalesOrder}
                        onChange={(e) => setEditSalesOrder(e.target.value)}
                        placeholder="e.g. SO-100234"
                        style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.75rem', color: '#ffb74d', display: 'block', marginBottom: '0.2rem', fontWeight: 600 }}>{isAr ? 'مرجع العميل (Customer Ref)' : 'Customer Ref'}</label>
                      <input
                        type="text"
                        value={editCustomerRef}
                        onChange={(e) => setEditCustomerRef(e.target.value)}
                        placeholder="e.g. CUST-REF-889"
                        style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem' }}
                      />
                    </div>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={savingMetadata}
                      onClick={handleSaveInvoiceMetadata}
                      style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      {savingMetadata ? '...' : (isAr ? '💾 حفظ التعديل' : 'Save Metadata')}
                    </button>
                  </div>
                )}
              </div>
              <button
                className="btn btn-sm"
                onClick={() => { setSelectedInvoice(null); setInvoiceMovements([]); setEditingMetadata(false); }}
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '1.1rem', padding: '4px 10px' }}
              >
                ✕
              </button>
            </div>

            {loadingMovements ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                ⏳ {isAr ? 'جاري تحميل بنود الحركة...' : 'Loading movement items...'}
              </div>
            ) : invoiceMovements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                📭 {isAr ? 'لا توجد تفاصيل بنود لهذه الحركة' : 'No movement details found for this transaction'}
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    gap: '1.25rem',
                    flexWrap: 'wrap',
                    marginBottom: '1rem',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '0.85rem 1.2rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.07)',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAr ? 'عدد البنود:' : 'Line Items:'} </span>
                    <strong style={{ color: '#FFD700', fontSize: '1rem' }}>{invoiceMovements.length} {isAr ? 'بند' : 'items'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAr ? 'إجمالي الأعواد / القطاعات:' : 'Total Bars:'} </span>
                    <strong style={{ color: '#64b5f6', fontSize: '1rem' }}>
                      {invoiceMovements.reduce((acc, m) => acc + Number(m.quantityBar || 0), 0)} BAR
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAr ? 'إجمالي الأمتار:' : 'Total Meters:'} </span>
                    <strong style={{ color: '#a29bfe', fontSize: '1rem' }}>
                      {invoiceMovements.reduce((acc, m) => acc + Number(m.quantityLm || 0), 0).toFixed(1)} m
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAr ? 'إجمالي القيمة:' : 'Total Value:'} </span>
                    <strong style={{ color: '#00e0a1', fontSize: '1rem' }}>
                      {invoiceMovements.reduce((acc, m) => acc + Number(m.netTotal || 0), 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP
                    </strong>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border)', textAlign: isAr ? 'right' : 'left' }}>
                      <th style={{ padding: '0.6rem 0.8rem', width: '40px' }}>#</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>{isAr ? 'كود الصنف' : 'Item Code'}</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>{isAr ? 'كود العميل' : 'Customer Code'}</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>{isAr ? 'بيان الصنف' : 'Description'}</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>{isAr ? 'الدهان' : 'Finish'}</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>{isAr ? 'الطول' : 'Length'}</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>{isAr ? 'الأعواد' : 'Bars'}</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>{isAr ? 'الأمتار' : 'Meters'}</th>
                      <th style={{ padding: '0.6rem 0.8rem' }}>{isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
                      <th style={{ padding: '0.6rem 0.8rem', color: '#00e0a1' }}>{isAr ? 'الإجمالي' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceMovements.map((mov, idx) => (
                      <tr key={mov.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '0.6rem 0.8rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700, color: '#00e0a1' }}>{mov.itemCode}</td>
                        <td style={{ padding: '0.6rem 0.8rem', color: '#8ab4ff' }}>{mov.customerCode || '—'}</td>
                        <td style={{ padding: '0.6rem 0.8rem' }}>{mov.description}</td>
                        <td style={{ padding: '0.6rem 0.8rem' }}>{mov.finish || 'STD'}</td>
                        <td style={{ padding: '0.6rem 0.8rem' }}><span dir="ltr">{mov.lengthMm} mm</span></td>
                        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700, color: '#fff' }}>{mov.quantityBar}</td>
                        <td style={{ padding: '0.6rem 0.8rem' }}><span dir="ltr">{(mov.quantityLm || 0).toFixed(1)} m</span></td>
                        <td style={{ padding: '0.6rem 0.8rem' }}><span dir="ltr">{mov.unitPrice || 0} EGP</span></td>
                        <td style={{ padding: '0.6rem 0.8rem', fontWeight: 700, color: '#00e0a1' }}>
                          <span dir="ltr">{(mov.netTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => { setSelectedInvoice(null); setInvoiceMovements([]); }}
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ITEM MOVEMENT HISTORY MODAL ─── */}
      {selectedStockItemHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: '#121629', border: '1px solid rgba(0, 224, 161, 0.3)', borderRadius: '16px', maxWidth: '1050px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            {/* Modal Header */}
            <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#00e0a1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📜 {isAr ? `سجل حركات وتتبع البند: ${selectedStockItemHistory.itemCode}` : `Movement History: ${selectedStockItemHistory.itemCode}`}
                </h3>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {selectedStockItemHistory.description} | {isAr ? 'الدهان' : 'Finish'}: <span style={{ color: '#FFD700' }}>{selectedStockItemHistory.finish || 'STD'}</span> | {isAr ? 'الطول' : 'Length'}: <span dir="ltr">{selectedStockItemHistory.lengthMm || 6000} mm</span> | {isAr ? 'كود العميل' : 'Cust Code'}: <span style={{ color: '#64b5f6' }}>{selectedStockItemHistory.customerCode || '—'}</span>
                </p>
              </div>
              <button
                onClick={() => { setSelectedStockItemHistory(null); setItemMovements([]) }}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Content Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              {/* Summary Stats Banner */}
              {(() => {
                const totalInBar = itemMovements.filter(m => m.movementType !== 'outbound').reduce((acc, m) => acc + Number(m.quantityBar || m.quantity || 0), 0)
                const totalInLm = itemMovements.filter(m => m.movementType !== 'outbound').reduce((acc, m) => acc + Number(m.quantityLm || 0), 0)
                const totalOutBar = itemMovements.filter(m => m.movementType === 'outbound').reduce((acc, m) => acc + Number(m.quantityBar || m.quantity || 0), 0)
                const totalOutLm = itemMovements.filter(m => m.movementType === 'outbound').reduce((acc, m) => acc + Number(m.quantityLm || 0), 0)

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: 'rgba(0, 224, 161, 0.08)', border: '1px solid rgba(0, 224, 161, 0.25)', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAr ? 'إجمالي التوريد (الوارد +)' : 'Total Inbound (+)'}</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#00e0a1', marginTop: '0.2rem' }}>
                        +{totalInBar} <span style={{ fontSize: '0.85rem' }}>{isAr ? 'عود / قطاع' : 'bars'}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#00e0a1', opacity: 0.8 }}>
                        +{totalInLm.toFixed(1)} m
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255, 71, 87, 0.08)', border: '1px solid rgba(255, 71, 87, 0.25)', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAr ? 'إجمالي الصرف (المنصرف -)' : 'Total Outbound (-)'}</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ff4757', marginTop: '0.2rem' }}>
                        -{totalOutBar} <span style={{ fontSize: '0.85rem' }}>{isAr ? 'عود / قطاع' : 'bars'}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#ff4757', opacity: 0.8 }}>
                        -{totalOutLm.toFixed(1)} m
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255, 215, 0, 0.08)', border: '1px solid rgba(255, 215, 0, 0.25)', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAr ? 'الرصيد المتبقي بالمخزن' : 'Current Net Stock'}</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#FFD700', marginTop: '0.2rem' }}>
                        {selectedStockItemHistory.quantityBar || 0} <span style={{ fontSize: '0.85rem' }}>{isAr ? 'عود' : 'bars'}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#FFD700', opacity: 0.8 }}>
                        {(selectedStockItemHistory.quantityLm || 0).toFixed(1)} m
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Movements Timeline Table */}
              {loadingItemMovements ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  ⏳ {isAr ? 'جاري تحميل سجل حركات البند...' : 'Loading item movement history...'}
                </div>
              ) : itemMovements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                  📭 {isAr ? 'لا توجد حركات تفصيلية مسجلة لهذا البند حتى الآن' : 'No movement history recorded for this item yet.'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid var(--border)', textAlign: isAr ? 'right' : 'left' }}>
                        <th style={{ padding: '0.75rem 1rem' }}>#</th>
                        <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                        <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'نوع الحركة' : 'Type'}</th>
                        <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'رقم الفاتورة' : 'Invoice #'}</th>
                        <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'أمر البيع (SO)' : 'Sales Order #'}</th>
                        <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'مرجع العميل' : 'Customer Ref'}</th>
                        <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'المورد / الجهة' : 'Supplier / Dest'}</th>
                        <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'الأعواد (BAR)' : 'Bars'}</th>
                        <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'الأمتار (LM)' : 'Meters'}</th>
                        <th style={{ padding: '0.75rem 1rem', color: '#FFD700' }}>{isAr ? 'الرصيد التراكمي' : 'Running Stock'}</th>
                        <th style={{ padding: '0.75rem 1rem' }}>{isAr ? 'سعر الوحدة' : 'Unit Cost'}</th>
                        <th style={{ padding: '0.75rem 1rem', color: '#00e0a1' }}>{isAr ? 'الإجمالي' : 'Total'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemMovements.map((m, idx) => {
                        const isOut = m.movementType === 'outbound'
                        const barQty = Number(m.quantityBar || m.quantity || 0)
                        const lmQty = Number(m.quantityLm || 0)
                        const dateStr = m.createdAt ? new Date(m.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US') : '—'
                        return (
                          <tr key={m.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                            <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{dateStr}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="badge" style={{ background: isOut ? 'rgba(255, 71, 87, 0.15)' : 'rgba(0, 224, 161, 0.15)', color: isOut ? '#ff4757' : '#00e0a1', border: `1px solid ${isOut ? 'rgba(255, 71, 87, 0.3)' : 'rgba(0, 224, 161, 0.3)'}` }}>
                                {isOut ? (isAr ? '📤 صرف (-)' : 'Outbound') : (isAr ? '📥 توريد (+)' : 'Inbound')}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span className="badge" style={{ background: 'rgba(100, 181, 246, 0.15)', color: '#64b5f6', border: '1px solid rgba(100, 181, 246, 0.3)' }}>
                                {m.invoiceNumber || m.invoiceId || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#00e0a1' }}>
                              {m.salesOrder || '—'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#ffb74d' }}>
                              {m.customerReference || '—'}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#fff' }}>{m.supplier || 'Canex'}</td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: isOut ? '#ff4757' : '#00e0a1' }}>
                              {isOut ? `-${barQty}` : `+${barQty}`}
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: isOut ? '#ff4757' : '#00e0a1' }}>
                              <span dir="ltr">{isOut ? `-${lmQty.toFixed(1)}` : `+${lmQty.toFixed(1)}`} m</span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#FFD700' }}>
                              <span dir="ltr">{m.runningBar !== undefined ? `${m.runningBar} BAR (${m.runningLm} m)` : '—'}</span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#8ab4ff' }}>
                              <span dir="ltr">{m.unitPrice ? `${m.unitPrice} EGP` : '—'}</span>
                            </td>
                            <td style={{ padding: '0.75rem 1rem', color: '#00e0a1', fontWeight: 700 }}>
                              <span dir="ltr">{m.netTotal ? `${Number(m.netTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })} EGP` : '—'}</span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => { setSelectedStockItemHistory(null); setItemMovements([]) }}
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
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
              {/* Review Header Stats & Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>
                    {isAr ? 'مراجعة بيانات البنود للفاتورة' : 'Review Invoice Lines'}
                  </h4>
                  <span className="badge" style={{ background: 'rgba(0, 224, 161, 0.15)', color: '#00e0a1', border: '1px solid rgba(0, 224, 161, 0.3)', padding: '0.3rem 0.75rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700 }}>
                    {isAr ? `إجمالي البنود: ${reviewLines.length}` : `Total Lines: ${reviewLines.length}`}
                  </span>
                </div>
              </div>

              {/* Invoice Metadata Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.9rem',
                  marginBottom: '1rem',
                  padding: '1rem',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                }}
              >
                {[
                  { key: 'invoiceNumber', label: isAr ? 'رقم الفاتورة' : 'Invoice No.' },
                  { key: 'salesOrder', label: isAr ? 'أمر البيع (Sales Order)' : 'Sales Order #' },
                  { key: 'customerReference', label: isAr ? 'مرجع العميل' : 'Customer Ref' },
                  { key: 'invoiceDate', label: isAr ? 'تاريخ الفاتورة' : 'Invoice Date', type: 'date' },
                  { key: 'receiptDate', label: isAr ? 'تاريخ الاستلام' : 'Receipt Date', type: 'date' },
                  { key: 'supplier', label: isAr ? 'اسم المورد' : 'Supplier' },
                  { key: 'currency', label: isAr ? 'العملة' : 'Currency' },
                ].map((field) => (
                  <div key={field.key}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{field.label}</span>
                    <input
                      type={field.type || 'text'}
                      value={parsedMeta[field.key] || ''}
                      onChange={(e) => setParsedMeta((p) => ({ ...p, [field.key]: e.target.value }))}
                      style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.45rem 0.65rem', color: '#fff', borderRadius: '6px', display: 'block', marginTop: '0.25rem' }}
                    />
                  </div>
                ))}
              </div>

              {/* Review Table */}
              <div style={{ overflowX: 'auto', marginBottom: '1.5rem', paddingBottom: '0.5rem' }}>
                <table style={{ minWidth: '2030px', width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: '50px' }} />
                    <col style={{ width: '60px' }} />
                    <col style={{ width: '150px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '580px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '105px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '110px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '130px' }} />
                    <col style={{ width: '145px' }} />
                  </colgroup>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>{isAr ? 'م' : '#'}</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>{isAr ? 'تجاهل' : 'Ignore'}</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>{isAr ? 'كود الصنف' : 'Item'}</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>{isAr ? 'كود العميل' : 'Customer Code'}</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>{isAr ? 'وصف الصنف / القطاع' : 'Description'}</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>{isAr ? 'التشطيب' : 'Finish'}</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>{isAr ? 'الطول mm' : 'Length mm'}</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>{isAr ? 'إجمالي الأمتار' : 'Total LM'}</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>{isAr ? 'إجمالي الوزن' : 'Total KG'}</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>{isAr ? 'الأعواد' : 'Bars'}</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>{isAr ? 'سعر المتر' : 'Meter Price'}</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>{isAr ? 'سعر العود' : 'Bar Price'}</th>
                      <th style={{ padding: '0.65rem 0.5rem' }}>{isAr ? 'الإجمالي' : 'Total'}</th>
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
                          verticalAlign: 'top',
                        }}
                      >
                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={line.ignored}
                            onChange={(e) => updateReviewLine(idx, 'ignored', e.target.checked)}
                          />
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <input
                            type="text"
                            value={line.itemCode}
                            onChange={(e) => updateReviewLine(idx, 'itemCode', e.target.value)}
                            style={{ background: '#101223', border: '1px solid var(--border)', color: '#00e0a1', padding: '0.4rem 0.5rem', borderRadius: '4px', width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <input
                            type="text"
                            value={line.customerCode || ''}
                            onChange={(e) => updateReviewLine(idx, 'customerCode', e.target.value)}
                            style={{ background: '#101223', border: '1px solid var(--border)', color: '#8ab4ff', padding: '0.4rem 0.5rem', borderRadius: '4px', width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <textarea
                            value={line.description}
                            rows={Math.max(2, Math.ceil(String(line.description || '').length / 70))}
                            onChange={(e) => updateReviewLine(idx, 'description', e.target.value)}
                            style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.45rem 0.55rem', borderRadius: '4px', width: '100%', minHeight: '54px', resize: 'vertical', lineHeight: 1.45 }}
                          />
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <input
                            type="text"
                            value={line.finish}
                            onChange={(e) => updateReviewLine(idx, 'finish', e.target.value)}
                            style={{ background: '#101223', border: '1px solid var(--border)', color: '#FFD700', padding: '0.4rem 0.5rem', borderRadius: '4px', width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <input type="number" value={line.lengthMm} onChange={(e) => updateReviewLine(idx, 'lengthMm', e.target.value)} style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.4rem 0.5rem', borderRadius: '4px', width: '100%' }} />
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <input type="number" step="0.001" value={line.quantityLm} onChange={(e) => updateReviewLine(idx, 'quantityLm', e.target.value)} style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.4rem 0.5rem', borderRadius: '4px', width: '100%', fontWeight: 700 }} />
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <input type="number" step="0.001" value={line.quantityKg} onChange={(e) => updateReviewLine(idx, 'quantityKg', e.target.value)} style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.4rem 0.5rem', borderRadius: '4px', width: '100%' }} />
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <input type="number" value={line.quantityBar} onChange={(e) => updateReviewLine(idx, 'quantityBar', e.target.value)} style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.4rem 0.5rem', borderRadius: '4px', width: '100%', fontWeight: 700 }} />
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <input type="number" step="0.0001" value={line.unitPrice} onChange={(e) => updateReviewLine(idx, 'unitPrice', e.target.value)} style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.4rem 0.5rem', borderRadius: '4px', width: '100%' }} />
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem' }}>
                          <input type="number" step="0.0001" value={line.barPrice || ''} onChange={(e) => updateReviewLine(idx, 'barPrice', e.target.value)} style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.4rem 0.5rem', borderRadius: '4px', width: '100%' }} />
                        </td>
                        <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, color: '#64b5f6', whiteSpace: 'nowrap' }}>
                          {Number(line.netTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
