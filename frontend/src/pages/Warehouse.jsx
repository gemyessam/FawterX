import { useState, useEffect, useContext, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import { AppContext } from '../App'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import {
  getWarehouseAccess,
  getWarehouseProjects,
  createWarehouseProject,
  deleteWarehouseProject,
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
  getWarehouseAuditLogs,
  getProjectRestorePoints,
  createProjectRestorePoint,
  restoreProjectToPoint,
  deleteProjectRestorePoint,
  rollbackWarehouseInvoice,
  getProjectItemAliases,
  saveProjectItemAlias,
  deleteProjectItemAlias,
} from '../services/warehouseApi'
import ManualStockModal from '../components/ManualStockModal'
import DispatchesTrackerView from '../components/DispatchesTrackerView'

function buildStockCheckResult(matchedItem, availableBar, reqBar, diff, viaAlias, aliasInfo, line) {
  const isDelmarCovered = Boolean(line.delmarCovered)
  const delmarMode = line.delmarMode || (isDelmarCovered ? 'shortage' : null)

  let remainingAfter = 0
  let delmarDispatched = 0
  let warehouseDispatched = 0

  if (isDelmarCovered) {
    if (delmarMode === 'full') {
      delmarDispatched = reqBar
      warehouseDispatched = 0
      remainingAfter = availableBar // Main warehouse untouched!
    } else {
      // shortage coverage only
      warehouseDispatched = Math.min(availableBar, reqBar)
      delmarDispatched = Math.max(0, reqBar - availableBar)
      remainingAfter = Math.max(0, availableBar - reqBar)
    }
  } else {
    warehouseDispatched = reqBar
    delmarDispatched = 0
    remainingAfter = availableBar - reqBar
  }

  if (!matchedItem) {
    if (isDelmarCovered) {
      return {
        status: 'sufficient',
        availableBar: 0,
        reqBar,
        diff: 0,
        remainingAfter: 0,
        matchedItem: null,
        viaAlias: false,
        delmarCovered: true,
        delmarMode,
        delmarDispatched,
        warehouseDispatched,
        delmarShortage: reqBar,
      }
    }
    return {
      status: 'missing',
      availableBar: 0,
      reqBar,
      diff: -reqBar,
      remainingAfter: -reqBar,
      matchedItem: null,
      viaAlias: false,
      delmarCovered: false,
      delmarMode: null,
      delmarDispatched: 0,
      warehouseDispatched: reqBar,
    }
  }

  if (isDelmarCovered) {
    return {
      status: 'sufficient',
      availableBar,
      reqBar,
      diff: 0,
      remainingAfter,
      matchedItem,
      viaAlias,
      aliasInfo,
      delmarCovered: true,
      delmarMode,
      delmarDispatched,
      warehouseDispatched,
      delmarShortage: Math.max(0, Math.abs(diff)),
    }
  }

  return {
    status: diff >= 0 ? 'sufficient' : 'shortage',
    availableBar,
    reqBar,
    diff,
    remainingAfter,
    matchedItem,
    viaAlias,
    aliasInfo,
    delmarCovered: false,
    delmarMode: null,
    delmarDispatched: 0,
    warehouseDispatched: reqBar,
  }
}

function checkStockAvailability(line, stock = [], aliasesMap = {}) {
  if (!line || (!line.itemCode && !line.customerCode)) {
    return {
      status: 'missing',
      availableBar: 0,
      reqBar: 0,
      diff: 0,
      remainingAfter: 0,
      matchedItem: null,
      viaAlias: false,
      delmarCovered: false,
      delmarMode: null,
    }
  }
  const reqBar = Number(line.quantityBar || line.bars || line.quantity || 0)
  const cleanCode = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '')
  let lineItemNorm = cleanCode(line.itemCode)
  let lineCustNorm = cleanCode(line.customerCode)

  let viaAlias = false
  let aliasInfo = null

  // 0. Check project aliases dictionary (match against both itemCode and customerCode)
  const mappedAlias = aliasesMap[lineItemNorm] || (lineCustNorm && aliasesMap[lineCustNorm])
  if (mappedAlias) {
    viaAlias = true
    aliasInfo = mappedAlias
    if (mappedAlias.targetItemKey) {
      const matchKey = stock.find((s) => s.itemKey === mappedAlias.targetItemKey)
      if (matchKey) {
        const availableBar = Number(matchKey.quantityBar || 0)
        const diff = availableBar - reqBar
        return buildStockCheckResult(matchKey, availableBar, reqBar, diff, true, aliasInfo, line)
      }
    }
    if (mappedAlias.targetItemCode) {
      lineItemNorm = cleanCode(mappedAlias.targetItemCode)
    }
  }

  // 1. Exact match on itemCode OR customerCode across warehouse stock
  let match = stock.find((s) => {
    const sItem = cleanCode(s.itemCode)
    const sCust = cleanCode(s.customerCode)
    if (lineItemNorm && (sItem === lineItemNorm || sCust === lineItemNorm)) return true
    if (lineCustNorm && (sItem === lineCustNorm || sCust === lineCustNorm)) return true
    return false
  })

  // 2. Match where warehouse item has this code in its aliases array
  if (!match) {
    match = stock.find((s) => {
      if (Array.isArray(s.aliases) && s.aliases.length > 0) {
        return s.aliases.some(
          (a) =>
            (lineItemNorm && cleanCode(a) === lineItemNorm) ||
            (lineCustNorm && cleanCode(a) === lineCustNorm)
        )
      }
      return false
    })
    if (match) viaAlias = true
  }

  // 3. Substring match (min 4 chars) to catch codes with suffixes
  if (!match) {
    match = stock.find((s) => {
      const sItem = cleanCode(s.itemCode)
      const sCust = cleanCode(s.customerCode)
      return (
        (lineItemNorm && lineItemNorm.length >= 4 && (sItem.includes(lineItemNorm) || sCust.includes(lineItemNorm))) ||
        (lineCustNorm && lineCustNorm.length >= 4 && (sItem.includes(lineCustNorm) || sCust.includes(lineCustNorm)))
      )
    })
  }

  const availableBar = match ? Number(match.quantityBar || 0) : 0
  const diff = availableBar - reqBar

  return buildStockCheckResult(match, availableBar, reqBar, diff, viaAlias, aliasInfo, line)
}

function findSmartFuzzyMatch(line, stock = [], aliasesMap = {}) {
  if (!line || !line.itemCode || !Array.isArray(stock) || stock.length === 0) return null
  if (line.rejectedSuggestion) return null

  const cleanCode = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '')
  const queryCode = cleanCode(line.itemCode)
  if (queryCode.length < 4) return null

  // If already mapped in aliases, no suggestion needed
  if (aliasesMap[queryCode]) return null

  const queryDesc = String(line.description || '').toLowerCase()
  let bestCandidate = null
  let bestScore = 0

  for (const item of stock) {
    const itemCode = cleanCode(item.itemCode)
    const custCode = cleanCode(item.customerCode)
    const itemDesc = String(item.description || '').toLowerCase()

    let codeScore = 0
    if (itemCode && queryCode) {
      if (itemCode.length === queryCode.length) {
        let matchingChars = 0
        for (let i = 0; i < queryCode.length; i++) {
          if (queryCode[i] === itemCode[i]) matchingChars++
        }
        if (matchingChars >= queryCode.length - 1 && matchingChars >= 4) {
          codeScore = 95 // 1 digit difference on a 6+ char code (e.g. 515750 vs 515756)
        } else if (matchingChars >= queryCode.length - 2 && matchingChars >= 4) {
          codeScore = 80
        }
      }
    }

    if (custCode && queryCode) {
      if (custCode.length === queryCode.length) {
        let matchingChars = 0
        for (let i = 0; i < queryCode.length; i++) {
          if (queryCode[i] === custCode[i]) matchingChars++
        }
        if (matchingChars >= queryCode.length - 1 && matchingChars >= 4) {
          codeScore = Math.max(codeScore, 95)
        }
      }
    }

    let descScore = 0
    if (queryDesc && itemDesc) {
      const words = queryDesc.split(/[\s,()/-]+/).filter((w) => w.length >= 3 && !/ral|5800|6000|bar|kg|lm/i.test(w))
      let matchedWords = 0
      for (const w of words) {
        if (itemDesc.includes(w)) matchedWords++
      }
      if (words.length > 0) {
        descScore = Math.round((matchedWords / words.length) * 50)
      }
    }

    const totalScore = codeScore > 0 ? (codeScore >= 90 ? codeScore : codeScore + descScore * 0.3) : descScore
    if (totalScore > bestScore && totalScore >= 75) {
      bestScore = totalScore
      bestCandidate = {
        item,
        score: Math.round(totalScore),
        reason: codeScore >= 90 ? 'تشابه رقمي فائق (اختلاف رقم واحد فقط)' : 'تطابق في مواصفات ووصف القطاع',
      }
    }
  }

  return bestCandidate
}

function isCoatedItem(line) {
  if (!line) return false
  const finish = String(line.finish || line.color || '').trim().toUpperCase()
  const desc = String(line.description || '').toUpperCase()

  // Explicit mill finish or raw is not coated
  if (/^(MF|MILL|RAW|خام|MILL\s*FINISH)$/i.test(finish)) {
    return false
  }

  // Paint / coating indicators (RAL, Anodized, SD, Powder, etc.)
  if (/RAL|ANODIZ|SD|POWDER|COAT|دهان|الوان/i.test(finish) || /RAL|ANODIZ|دهان/i.test(desc)) {
    return true
  }

  if (finish && finish !== 'MF' && finish !== 'MILL' && finish !== 'RAW') {
    return true
  }

  return false
}

export default function Warehouse() {
  const { lang, user, isAdmin } = useContext(AppContext)
  const isAr = lang === 'ar'

  // Dynamic live verification on mount
  useEffect(() => {
    if (user && !isAdmin) {
      getWarehouseAccess()
        .then((res) => {
          if (!res || !res.enabled) {
            toast.error(isAr ? 'تم سحب صلاحية الوصول للمخزن لحسابك من قبل الإدارة' : 'Warehouse access has been revoked for your account')
            setTimeout(() => {
              window.location.href = '/'
            }, 1000)
          }
        })
        .catch(() => {
          window.location.href = '/'
        })
    }
  }, [user, isAdmin])

  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('fawterx_cached_projects')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch (e) {}
    return []
  })

  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    try {
      return localStorage.getItem('fawterx_selected_project_id') || ''
    } catch (e) {
      return ''
    }
  })

  const [stock, setStock] = useState(() => {
    try {
      const savedProj = localStorage.getItem('fawterx_selected_project_id')
      if (savedProj) {
        const cachedStock = localStorage.getItem(`fawterx_stock_cache_${savedProj}`)
        if (cachedStock) {
          const parsed = JSON.parse(cachedStock)
          if (Array.isArray(parsed)) return parsed
        }
      }
    } catch (e) {}
    return []
  })

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId)
    try {
      localStorage.setItem('fawterx_selected_project_id', projectId)
    } catch (e) {}
    try {
      const cachedStock = localStorage.getItem(`fawterx_stock_cache_${projectId}`)
      if (cachedStock) {
        setStock(JSON.parse(cachedStock))
      } else {
        setStock([])
      }
    } catch (e) {}
  }

  // Item Cross-Reference Aliases (e.g. Schüco 515750 <=> Canex 515756)
  const [projectAliases, setProjectAliases] = useState([])
  const aliasesMap = useMemo(() => {
    const map = {}
    const clean = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '')
    projectAliases.forEach((a) => {
      if (a.aliasCode) {
        map[clean(a.aliasCode)] = a
      }
    })
    return map
  }, [projectAliases])

  const loadProjectAliases = async (pId) => {
    if (!pId) return
    try {
      const res = await getProjectItemAliases(pId)
      if (res && Array.isArray(res.aliases)) {
        setProjectAliases(res.aliases)
      }
    } catch (e) {
      console.warn('Failed loading project aliases:', e)
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectAliases(selectedProjectId)
    }
  }, [selectedProjectId])

  const [linkModalData, setLinkModalData] = useState(null)
  const [aliasSearchQuery, setAliasSearchQuery] = useState('')

  const handleQuickLinkAlias = async (batchId, lineIndex, sourceCode, targetItem) => {
    if (!selectedProjectId || !targetItem) return

    // 1. Update line in batch
    setBatchInvoices((prev) =>
      prev.map((batch) => {
        if (batch.id !== batchId) return batch
        const copyLines = [...batch.reviewLines]
        copyLines[lineIndex] = {
          ...copyLines[lineIndex],
          itemCode: targetItem.itemCode,
          customerCode: copyLines[lineIndex].customerCode || sourceCode,
          targetItemKey: targetItem.itemKey,
          targetItemCode: targetItem.itemCode,
        }
        return { ...batch, reviewLines: copyLines }
      })
    )

    // 2. Save alias permanently to project
    try {
      await saveProjectItemAlias(selectedProjectId, {
        aliasCode: sourceCode,
        targetItemCode: targetItem.itemCode,
        targetItemKey: targetItem.itemKey,
        targetDescription: targetItem.description || '',
      })
      toast.success(isAr ? `✅ تم ربط الكود (${sourceCode}) بالصنف (${targetItem.itemCode}) واعتمد في القاموس!` : `Linked ${sourceCode} to ${targetItem.itemCode}!`)
      loadProjectAliases(selectedProjectId)
    } catch (err) {
      console.error('Error saving alias:', err)
      toast.error(isAr ? 'فشل حفظ الربط في القاموس' : 'Failed to save alias')
    }
  }

  const handleConfirmManualLink = async () => {
    if (!linkModalData || !linkModalData.selectedItemKey) {
      toast.error(isAr ? 'يرجى اختيار الصنف من المخزن' : 'Please select an item')
      return
    }

    const { batchId, lineIndex, sourceCode, selectedItemKey, rememberAlways } = linkModalData
    const targetItem = stock.find((s) => s.itemKey === selectedItemKey)
    if (!targetItem) {
      toast.error(isAr ? 'الصنف المختار غير موجود بالمخزن' : 'Item not found in stock')
      return
    }

    setBatchInvoices((prev) =>
      prev.map((batch) => {
        if (batch.id !== batchId) return batch
        const copyLines = [...batch.reviewLines]
        copyLines[lineIndex] = {
          ...copyLines[lineIndex],
          itemCode: targetItem.itemCode,
          customerCode: copyLines[lineIndex].customerCode || sourceCode,
          targetItemKey: targetItem.itemKey,
          targetItemCode: targetItem.itemCode,
        }
        return { ...batch, reviewLines: copyLines }
      })
    )

    if (rememberAlways && selectedProjectId) {
      try {
        await saveProjectItemAlias(selectedProjectId, {
          aliasCode: sourceCode,
          targetItemCode: targetItem.itemCode,
          targetItemKey: targetItem.itemKey,
          targetDescription: targetItem.description || '',
        })
        toast.success(isAr ? `✅ تم حفظ الربط الدائم للكود (${sourceCode} 🔁 ${targetItem.itemCode}) في القاموس!` : `Saved alias permanently!`)
        loadProjectAliases(selectedProjectId)
      } catch (e) {
        console.warn('Failed saving alias:', e)
      }
    } else {
      toast.success(isAr ? 'تم تعديل كود البند لهذه الفاتورة' : 'Updated line item code')
    }

    setLinkModalData(null)
  }

  const handleSetDelmarMode = (batchId, lineIndex, mode) => {
    setBatchInvoices((prev) =>
      prev.map((batch) => {
        if (batch.id !== batchId) return batch
        const copy = [...batch.reviewLines]
        if (!mode) {
          copy[lineIndex] = { ...copy[lineIndex], delmarCovered: false, delmarMode: null }
        } else {
          copy[lineIndex] = { ...copy[lineIndex], delmarCovered: true, delmarMode: mode }
        }
        return { ...batch, reviewLines: copy }
      })
    )
    toast.success(
      isAr
        ? mode === 'full'
          ? '✅ تم تعيين الصرف بالكامل من مخزن دلمار (رصيد المستودع محفوظ بالكامل)'
          : mode === 'shortage'
            ? '✅ تم تعيين تغطية عجز الأعواد من مخزن دلمار'
            : 'تم إلغاء التغطية من دلمار'
        : 'Delmar status updated'
    )
  }

  const handleToggleDelmarCover = (batchId, lineIndex) => {
    setBatchInvoices((prev) =>
      prev.map((batch) => {
        if (batch.id !== batchId) return batch
        const copy = [...batch.reviewLines]
        const current = !!copy[lineIndex].delmarCovered
        copy[lineIndex] = {
          ...copy[lineIndex],
          delmarCovered: !current,
          delmarMode: !current ? 'shortage' : null,
        }
        return { ...batch, reviewLines: copy }
      })
    )
    toast.success(isAr ? '✅ تم تحديث حالة الصرف من دلمار' : 'Delmar status updated')
  }

  const handleCoverAllDelmar = (batchId, mode = 'shortage') => {
    setBatchInvoices((prev) =>
      prev.map((batch) => {
        if (batch.id !== batchId) return batch
        const updated = (batch.reviewLines || []).map((l) => {
          if (!l.ignored && !l.isService) {
            if (mode === 'full') {
              return { ...l, delmarCovered: true, delmarMode: 'full' }
            } else {
              const chk = checkStockAvailability(l, stock, aliasesMap)
              if (chk.status !== 'sufficient' || (chk.diff !== undefined && chk.diff < 0)) {
                return { ...l, delmarCovered: true, delmarMode: 'shortage' }
              }
            }
          }
          return l
        })
        return { ...batch, reviewLines: updated }
      })
    )
    toast.success(
      isAr
        ? mode === 'full'
          ? '✅ تم اعتماد صرف كافة بنود الإذن بالكامل من مخزن دلمار (أرصدة المستودع محفوظة)!'
          : '✅ تم اعتماد تغطية كافة فروق الأعواد بالصرف من مخزن دلمار!'
        : 'Delmar batch status updated!'
    )
  }

  const handleClearAllDelmar = (batchId) => {
    setBatchInvoices((prev) =>
      prev.map((batch) => {
        if (batch.id !== batchId) return batch
        const updated = (batch.reviewLines || []).map((l) => ({
          ...l,
          delmarCovered: false,
          delmarMode: null,
        }))
        return { ...batch, reviewLines: updated }
      })
    )
    toast.info(isAr ? 'تم إلغاء التغطية وإعادة كافة البنود للمستودع الرئيسي' : 'Reset to main warehouse')
  }

  const handleRejectSuggestion = (batchId, lineIndex) => {
    setBatchInvoices((prev) =>
      prev.map((batch) => {
        if (batch.id !== batchId) return batch
        const copy = [...batch.reviewLines]
        copy[lineIndex] = { ...copy[lineIndex], rejectedSuggestion: true }
        return { ...batch, reviewLines: copy }
      })
    )
    toast.info(isAr ? 'تم رفض الاقتراح. يمكنك كتابة الكود الصحيح بالمخزن في الخانة أدناه' : 'Suggestion rejected. You can enter the correct code below')
  }

  const handleManualLinkByCode = async (batchId, lineIndex, sourceCode, targetCodeInput) => {
    if (!targetCodeInput || !String(targetCodeInput).trim()) {
      toast.error(isAr ? 'يرجى كتابة كود الصنف أولاً' : 'Please enter target item code')
      return
    }
    const clean = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]/gi, '')
    const cleanTarget = clean(targetCodeInput)
    const targetItem = stock.find(
      (s) => clean(s.itemCode) === cleanTarget || clean(s.customerCode) === cleanTarget || clean(s.itemCode).includes(cleanTarget)
    )

    const finalTargetCode = targetItem ? targetItem.itemCode : String(targetCodeInput).trim()
    const finalTargetKey = targetItem ? targetItem.itemKey : null

    // 1. Update line in batch
    setBatchInvoices((prev) =>
      prev.map((batch) => {
        if (batch.id !== batchId) return batch
        const copyLines = [...batch.reviewLines]
        copyLines[lineIndex] = {
          ...copyLines[lineIndex],
          itemCode: finalTargetCode,
          customerCode: copyLines[lineIndex].customerCode || sourceCode,
          targetItemKey: finalTargetKey,
          targetItemCode: finalTargetCode,
          manualTargetCode: '',
          rejectedSuggestion: true,
        }
        return { ...batch, reviewLines: copyLines }
      })
    )

    // 2. Save alias permanently
    if (selectedProjectId) {
      try {
        await saveProjectItemAlias(selectedProjectId, {
          aliasCode: sourceCode,
          targetItemCode: finalTargetCode,
          targetItemKey: finalTargetKey,
          targetDescription: targetItem?.description || '',
        })
        toast.success(
          isAr
            ? `✅ تم ربط كود شوكو (${sourceCode}) بكود كانكس (${finalTargetCode}) واعتمد في القاموس للأبد!`
            : `Permanently linked ${sourceCode} to ${finalTargetCode}!`
        )
        loadProjectAliases(selectedProjectId)
      } catch (e) {
        console.warn('Error saving alias:', e)
      }
    }
  }

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('stock') // 'stock' | 'history' | 'upload' | 'dispatches' | 'users' | 'projects'

  // Manual Stock Movement & Multi-Stage Dispatches Modal State
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualModalMode, setManualModalMode] = useState('inbound') // 'inbound' | 'outbound'
  const [manualPreselectedItems, setManualPreselectedItems] = useState([])

  const handleOpenManualModal = (m = 'inbound', preselected = []) => {
    setManualModalMode(m)
    setManualPreselectedItems(preselected)
    setShowManualModal(true)
  }

  const handleOpenOutboundForSelected = () => {
    if (selectedStockKeys.length === 0) return
    const selectedItems = stock.filter((s) => selectedStockKeys.includes(s.itemKey))
    handleOpenManualModal('outbound', selectedItems)
  }

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

  // User Permissions Access State
  const [usersList, setUsersList] = useState([])
  const [loadingPermissionsList, setLoadingPermissionsList] = useState(false)
  const [updatingUserUid, setUpdatingUserUid] = useState(null)
  const [permissionsSearchQuery, setPermissionsSearchQuery] = useState('')
  const [expandedUserUid, setExpandedUserUid] = useState(null)

  const sortedAndFilteredWarehouseUsers = useMemo(() => {
    const SUPER_ADMIN_EMAIL = 'gemy.essam.ge@gmail.com'
    const q = (permissionsSearchQuery || '').trim().toLowerCase()
    
    let list = usersList
    if (q) {
      list = list.filter((usr) =>
        (usr.displayName || '').toLowerCase().includes(q) ||
        (usr.email || '').toLowerCase().includes(q) ||
        (usr.uid || '').toLowerCase().includes(q)
      )
    }

    return [...list].sort((a, b) => {
      const aIsSuper = (a.email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL
      const bIsSuper = (b.email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL
      if (aIsSuper && !bIsSuper) return -1
      if (!aIsSuper && bIsSuper) return 1

      const aHasAccess = Boolean(a.warehouseEnabled || a.warehouseRole === 'admin' || a.role === 'admin')
      const bHasAccess = Boolean(b.warehouseEnabled || b.warehouseRole === 'admin' || b.role === 'admin')
      if (aHasAccess && !bHasAccess) return -1
      if (!aHasAccess && bHasAccess) return 1

      const aName = (a.displayName || a.email || '').toLowerCase()
      const bName = (b.displayName || b.email || '').toLowerCase()
      return aName.localeCompare(bName)
    })
  }, [usersList, permissionsSearchQuery])

  const loadWarehouseUsers = async () => {
    if (!isAdmin) return
    setLoadingPermissionsList(true)
    try {
      const data = await getWarehouseUsers()
      if (data && data.success && Array.isArray(data.users)) {
        setUsersList(data.users)
      }
    } catch (err) {
      console.error('Error fetching warehouse users:', err)
      toast.error(isAr ? 'فشل جلب قائمة المستخدمين والصلاحيات' : 'Failed to fetch users and permissions')
    } finally {
      setLoadingPermissionsList(false)
    }
  }

  const handleSaveUserPermissions = async (userItem) => {
    setUpdatingUserUid(userItem.uid)
    try {
      const payload = {
        warehouseEnabled: Boolean(userItem.warehouseEnabled),
        warehouseRole: userItem.warehouseEnabled ? (userItem.warehouseRole || 'warehouse_operator') : 'disabled',
        allowedProjects: userItem.allowedProjects || ['*'],
        canDelete: userItem.canDelete ?? true,
        canEdit: userItem.canEdit ?? true,
        canUpload: userItem.canUpload ?? true,
        canDispatch: userItem.canDispatch ?? true,
        canManual: userItem.canManual ?? true,
      }
      const res = await updateWarehouseUserAccess(userItem.uid, payload)
      if (res && res.success) {
        toast.success(isAr ? `تم حفظ وتطبيق صلاحيات ${userItem.displayName || userItem.email} بنجاح` : `Updated access for ${userItem.displayName || userItem.email}`)
        loadWarehouseUsers()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل حفظ الصلاحيات' : 'Failed to save permissions'))
    } finally {
      setUpdatingUserUid(null)
    }
  }

  const handleQuickToggleAccess = async (userItem, newEnabledStatus) => {
    setUpdatingUserUid(userItem.uid)
    try {
      const payload = {
        warehouseEnabled: Boolean(newEnabledStatus),
        warehouseRole: newEnabledStatus
          ? (userItem.warehouseRole === 'disabled' || !userItem.warehouseRole ? 'warehouse_operator' : userItem.warehouseRole)
          : 'disabled',
        allowedProjects: userItem.allowedProjects || ['*'],
        canDelete: userItem.canDelete ?? true,
        canEdit: userItem.canEdit ?? true,
        canUpload: userItem.canUpload ?? true,
        canDispatch: userItem.canDispatch ?? true,
        canManual: userItem.canManual ?? true,
      }
      setUsersList(prev => prev.map(u => u.uid === userItem.uid ? { ...u, ...payload } : u))

      const res = await updateWarehouseUserAccess(userItem.uid, payload)
      if (res && res.success) {
        toast.success(
          isAr
            ? newEnabledStatus
              ? `✅ تم تفعيل وصول المستخدم (${userItem.displayName || userItem.email}) للمخزن`
              : `🚫 تم إلغاء وحظر وصول المستخدم (${userItem.displayName || userItem.email}) للمخزن فوراً`
            : newEnabledStatus
              ? `Granted warehouse access to ${userItem.displayName || userItem.email}`
              : `Revoked warehouse access for ${userItem.displayName || userItem.email}`
        )
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل تحديث الصلاحية' : 'Failed to update access'))
      loadWarehouseUsers()
    } finally {
      setUpdatingUserUid(null)
    }
  }

  useEffect(() => {
    if (activeTab === 'projects' && isAdmin) {
      loadWarehouseUsers()
    }
  }, [activeTab, isAdmin])

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

  // Batch Upload & Review State
  const [batchInvoices, setBatchInvoices] = useState([])
  const [savingBatch, setSavingBatch] = useState(false)

  // New Project Form
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectCode, setNewProjectCode] = useState('')
  const [newProjectDesc, setNewProjectDesc] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)

  // Audit Trail State (Admin Only)
  const [auditLogs, setAuditLogs] = useState([])
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false)
  const [auditSearchQuery, setAuditSearchQuery] = useState('')

  // Restore Points State
  const [restorePoints, setRestorePoints] = useState([])
  const [loadingRestorePoints, setLoadingRestorePoints] = useState(false)
  const [newPointName, setNewPointName] = useState('')
  const [newPointDesc, setNewPointDesc] = useState('')
  const [creatingRestorePoint, setCreatingRestorePoint] = useState(false)
  const [restoringPointId, setRestoringPointId] = useState(null)
  const [restoreFilter, setRestoreFilter] = useState('all')
  const [rollingBackInvoiceId, setRollingBackInvoiceId] = useState(null)

  const filteredRestorePoints = useMemo(() => {
    if (restoreFilter === 'auto') return restorePoints.filter((p) => p.isAuto)
    if (restoreFilter === 'manual') return restorePoints.filter((p) => !p.isAuto)
    return restorePoints
  }, [restorePoints, restoreFilter])

  // Stock Item Admin Management State
  const [editingStockKey, setEditingStockKey] = useState(null)
  const [editingStockData, setEditingStockData] = useState({})
  const [savingStockEdit, setSavingStockEdit] = useState(false)
  const [selectedStockKeys, setSelectedStockKeys] = useState([])
  const [deletingBulk, setDeletingBulk] = useState(false)

  const handleStartStockEdit = (item) => {
    setEditingStockKey(item.itemKey)
    setEditingStockData({
      customerCode: item.customerCode || '',
      description: item.description || '',
      finish: item.finish || 'STD',
      lastSalesOrder: item.lastSalesOrder || item.salesOrder || '',
      lastCustomerRef: item.lastCustomerRef || item.customerReference || '',
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

  const [deletingProjectId, setDeletingProjectId] = useState(null)

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
      if (res.success) {
        toast.success(isAr ? 'تم إنشاء مشروع المخزن بنجاح!' : 'Warehouse project created successfully!')
        setNewProjectName('')
        setNewProjectCode('')
        setNewProjectDesc('')
        await loadProjects()
        if (res.project?.id) {
          setSelectedProjectId(res.project.id)
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل إنشاء المشروع' : 'Failed to create project'))
    } finally {
      setCreatingProject(false)
    }
  }

  async function handleDeleteProject(proj) {
    if (!isAdmin) {
      toast.error(isAr ? 'صلاحية الأدمن مطلوبة لحذف المشاريع' : 'Admin role required to delete projects')
      return
    }
    if (!proj || !proj.id) return

    if (projects.length <= 1) {
      toast.error(isAr ? 'لا يمكن حذف المشروع الوحيد المتبقي في النظام' : 'Cannot delete the only remaining project')
      return
    }

    const confirmMsg = isAr
      ? `⚠️ تحذير خطير جداً!\n\nهل أنت تأكد من رغبتك في حذف مشروع المخزن بالكامل ("${proj.name || proj.id}")؟\n\nسيتم حذف جميع الأرصدة، الفواتير، وحركات التوريد الصادرة/الواردة ونقاط الحفظ التابعة لهذا المشروع نهائياً ولا يمكن استعادتها!`
      : `⚠️ Critical Warning!\n\nAre you sure you want to PERMANENTLY DELETE project ("${proj.name || proj.id}")?\n\nAll inventory stock, invoices, movements, audit logs, and restore points for this project will be permanently erased!`

    if (!window.confirm(confirmMsg)) return

    setDeletingProjectId(proj.id)
    try {
      const res = await deleteWarehouseProject(proj.id)
      if (res.success) {
        toast.success(res.message || (isAr ? `تم حذف المشروع ${proj.name} بنجاح` : `Project ${proj.name} deleted successfully`))

        const updatedProjects = projects.filter((p) => p.id !== proj.id && p.code !== proj.code)
        setProjects(updatedProjects)

        if (selectedProjectId === proj.id) {
          const nextId = updatedProjects[0]?.id || ''
          setSelectedProjectId(nextId)
          try {
            localStorage.setItem('fawterx_selected_project_id', nextId)
          } catch (e) {}
        }
        loadProjects()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل حذف المشروع' : 'Failed to delete project'))
    } finally {
      setDeletingProjectId(null)
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

  useEffect(() => {
    if (activeTab === 'audit' && isAdmin && selectedProjectId) {
      loadAuditLogs(selectedProjectId)
    }
  }, [activeTab, isAdmin, selectedProjectId])

  useEffect(() => {
    if (activeTab === 'restore_points' && selectedProjectId) {
      loadRestorePoints(selectedProjectId)
    }
  }, [activeTab, selectedProjectId])

  async function loadRestorePoints(projectId) {
    setLoadingRestorePoints(true)
    try {
      const res = await getProjectRestorePoints(projectId)
      if (res.success && res.points) {
        setRestorePoints(res.points)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل تحميل نقاط الحفظ' : 'Failed to load restore points'))
    } finally {
      setLoadingRestorePoints(false)
    }
  }

  async function handleCreateRestorePoint(e) {
    e.preventDefault()
    if (!selectedProjectId) return
    setCreatingRestorePoint(true)
    try {
      const res = await createProjectRestorePoint(selectedProjectId, {
        name: newPointName,
        description: newPointDesc,
      })
      if (res.success) {
        toast.success(isAr ? 'تم إنشاء نقطة الحفظ بنجاح!' : 'Restore point created successfully!')
        setNewPointName('')
        setNewPointDesc('')
        loadRestorePoints(selectedProjectId)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل إنشاء نقطة الحفظ' : 'Failed to create restore point'))
    } finally {
      setCreatingRestorePoint(false)
    }
  }

  async function handleRestoreToPoint(point) {
    if (!selectedProjectId || !point) return
    const confirmMsg = isAr
      ? `⚠️ تحذير مهم جداً!\n\nهل أنت تأكد من استعادة أرصدة المخزن لنقطة الحفظ ("${point.name}")؟\n\nسيتم استبدال رصيد المخزن الحالي بهذا Snapshot وتوثيق العملية في سجل التدقيق.`
      : `⚠️ Important Warning!\n\nAre you sure you want to restore the stock balance to point ("${point.name}")?\n\nCurrent inventory will be overwritten with this snapshot.`

    if (!window.confirm(confirmMsg)) return

    setRestoringPointId(point.id)
    try {
      const res = await restoreProjectToPoint(selectedProjectId, point.id)
      if (res.success) {
        toast.success(isAr ? `تمت استعادة نقطة الحفظ (${point.name}) بنجاح!` : `Restored to point (${point.name}) successfully!`)
        loadStock(selectedProjectId)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل استعادة نقطة الحفظ' : 'Failed to restore point'))
    } finally {
      setRestoringPointId(null)
    }
  }

  async function handleDeleteRestorePoint(point) {
    if (!selectedProjectId || !point) return
    if (!window.confirm(isAr ? `هل تريد حذف نقطة الحفظ (${point.name})؟` : `Delete restore point (${point.name})?`)) return
    try {
      setRestorePoints((prev) => prev.filter((p) => p.id !== point.id))
      await deleteProjectRestorePoint(selectedProjectId, point.id)
      toast.success(isAr ? 'تم حذف نقطة الحفظ' : 'Restore point deleted')
      loadRestorePoints(selectedProjectId)
    } catch (err) {
      toast.error(isAr ? 'فشل حذف نقطة الحفظ' : 'Failed to delete restore point')
      loadRestorePoints(selectedProjectId)
    }
  }

  async function handleRollbackInvoice(inv) {
    if (!selectedProjectId || !inv) return
    const isOut = inv.movementType === 'outbound'
    const actionText = isOut
      ? (isAr ? 'إعادة الكميات المصروفة إلى رصيد المخزن' : 'return dispensed quantities back to inventory')
      : (isAr ? 'خصم الكميات المورّدة من رصيد المخزن' : 'deduct received quantities from inventory')

    const confirmMsg = isAr
      ? `👑 تأكيد التراجع عن الفاتورة (صلاحية الإدارة العليا):\n\nهل أنت متأكد من إلغاء الفاتورة رقم (${inv.invoiceNumber || inv.id})؟\n\n⚙️ سيقوم النظام تلقائياً بما يلي:\n1. ${actionText}.\n2. إلغاء أثر حركاتها وتوثيقها في سجل التدقيق (Audit Log).\n3. حفظ نقطة استرجاع تلقائية قبل الإلغاء لضمان الأمان التام.`
      : `👑 Confirm Invoice Rollback (Admin Only):\n\nAre you sure you want to rollback invoice (${inv.invoiceNumber || inv.id})?\n\nThis will automatically ${actionText} and record the audit trail.`

    if (!window.confirm(confirmMsg)) return

    setRollingBackInvoiceId(inv.id)
    try {
      const res = await rollbackWarehouseInvoice(selectedProjectId, inv.id)
      if (res.success) {
        toast.success(isAr ? `تم التراجع عن الفاتورة (${inv.invoiceNumber}) وعكس أرصدة المخزن بنجاح!` : `Invoice (${inv.invoiceNumber}) rolled back successfully!`)
        loadStock(selectedProjectId)
        loadInvoices(selectedProjectId)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل التراجع عن الفاتورة' : 'Failed to rollback invoice'))
    } finally {
      setRollingBackInvoiceId(null)
    }
  }

  async function handleDeleteStockItem(item) {
    if (!selectedProjectId || !item) return
    const confirmMsg = isAr
      ? `هل أنت تأكد من حذف الصنف (${item.itemCode}) نهائياً من أرصدة المخزن؟`
      : `Are you sure you want to delete item (${item.itemCode}) from stock?`
    if (!window.confirm(confirmMsg)) return

    try {
      console.log('[DeleteStockItem] Deleting itemKey:', item.itemKey, 'project:', selectedProjectId)
      setStock((prev) => prev.filter((i) => i.itemKey !== item.itemKey))

      const res = await deleteStockItem(selectedProjectId, item.itemKey)
      if (res && res.success !== false) {
        toast.success(isAr ? 'تم حذف الصنف من المخزن بنجاح' : 'Item deleted from stock successfully')
      } else {
        toast.error(res?.message || (isAr ? 'فشل حذف الصنف' : 'Failed to delete item'))
      }
      loadStock(selectedProjectId)
    } catch (err) {
      console.error('[DeleteStockItem Error]:', err)
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل حذف الصنف' : 'Failed to delete item'))
      loadStock(selectedProjectId)
    }
  }

  const handleToggleSelectAllStock = (items) => {
    const currentKeys = items.map((i) => i.itemKey)
    const isAllSelected = currentKeys.length > 0 && currentKeys.every((k) => selectedStockKeys.includes(k))
    if (isAllSelected) {
      setSelectedStockKeys((prev) => prev.filter((k) => !currentKeys.includes(k)))
    } else {
      setSelectedStockKeys((prev) => Array.from(new Set([...prev, ...currentKeys])))
    }
  }

  const handleToggleSelectStockKey = (key) => {
    setSelectedStockKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleBulkDeleteStockItems = async () => {
    if (!selectedProjectId || selectedStockKeys.length === 0) return
    const count = selectedStockKeys.length
    const confirmMsg = isAr
      ? `هل أنت تأكد من حذف (${count}) أصناف المحددة من المخزن نهائياً؟`
      : `Are you sure you want to delete (${count}) selected items from stock?`
    if (!window.confirm(confirmMsg)) return

    setDeletingBulk(true)
    try {
      console.log('[BulkDeleteStockItems] Deleting keys:', selectedStockKeys, 'project:', selectedProjectId)
      
      // Optimistic update
      setStock((prev) => prev.filter((i) => !selectedStockKeys.includes(i.itemKey)))

      const results = await Promise.allSettled(
        selectedStockKeys.map((key) => deleteStockItem(selectedProjectId, key))
      )

      const successCount = results.filter((r) => r.status === 'fulfilled' && r.value && r.value.success !== false).length

      toast.success(
        isAr
          ? `تم حذف ${successCount} من أصل ${count} أصناف من المخزن بنجاح`
          : `Successfully deleted ${successCount} of ${count} items from stock`
      )

      setSelectedStockKeys([])
      loadStock(selectedProjectId)
    } catch (err) {
      console.error('[BulkDeleteStockItems Error]:', err)
      toast.error(isAr ? 'حدث خطأ أثناء الحذف المجمع' : 'Error performing bulk delete')
      loadStock(selectedProjectId)
    } finally {
      setDeletingBulk(false)
    }
  }

  async function loadAuditLogs(projectId) {
    setLoadingAuditLogs(true)
    try {
      const res = await getWarehouseAuditLogs(projectId)
      if (res.success && res.logs) {
        setAuditLogs(res.logs)
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || (isAr ? 'فشل تحميل سجل التدقيق' : 'Failed to load audit logs'))
    } finally {
      setLoadingAuditLogs(false)
    }
  }

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
      const res = await getWarehouseProjects()
      if (res && res.success && Array.isArray(res.projects) && res.projects.length > 0) {
        setProjects(res.projects)
        try {
          localStorage.setItem('fawterx_cached_projects', JSON.stringify(res.projects))
        } catch (e) {}

        setSelectedProjectId((prev) => {
          const saved = localStorage.getItem('fawterx_selected_project_id')
          const candidate = prev || saved || ''
          const exists = res.projects.some((p) => p.id === candidate)
          const nextId = exists ? candidate : res.projects[0].id
          try {
            localStorage.setItem('fawterx_selected_project_id', nextId)
          } catch (e) {}
          return nextId
        })
      } else {
        if (projects.length === 0) {
          const defaultProj = { id: 'default_canex', name: 'Canex Stock', code: 'CANEX', description: 'المخزن الرئيسي لقطاعات وإكسسوارات كانكس' }
          setProjects([defaultProj])
          setSelectedProjectId((prev) => {
            const nextId = prev || defaultProj.id
            try {
              localStorage.setItem('fawterx_selected_project_id', nextId)
            } catch (e) {}
            return nextId
          })
        }
      }
    } catch (err) {
      console.warn('Warehouse projects loading error:', err)
      if (projects.length === 0) {
        const defaultProj = { id: 'default_canex', name: 'Canex Stock', code: 'CANEX', description: 'المخزن الرئيسي لقطاعات وإكسسوارات كانكس' }
        setProjects([defaultProj])
        setSelectedProjectId((prev) => {
          const nextId = prev || defaultProj.id
          try {
            localStorage.setItem('fawterx_selected_project_id', nextId)
          } catch (e) {}
          return nextId
        })
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadStock(projectId) {
    if (!projectId) return
    try {
      const res = await getProjectStock(projectId)
      if (res && res.success && Array.isArray(res.stock)) {
        setStock(res.stock)
        try {
          localStorage.setItem(`fawterx_stock_cache_${projectId}`, JSON.stringify(res.stock))
        } catch (e) {}
      }
    } catch (err) {
      console.error('Failed to load stock data:', err)
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
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploading(true)
    let parsedCount = 0
    const newBatchItems = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
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

          const invoiceMeta = {
            invoiceNumber: res.metadata?.invoiceNumber || `INV-${Date.now().toString().slice(-6)}_${i + 1}`,
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
            movementType: res.metadata?.movementType || movementType,
          }

          newBatchItems.push({
            id: `batch_inv_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
            fileName: file.name,
            movementType: res.metadata?.movementType || movementType,
            parsedMeta: invoiceMeta,
            reviewLines: parsed,
            status: 'ready', // 'ready' | 'saving' | 'saved' | 'error'
            errorMessage: null,
            expanded: true,
          })
          parsedCount++
        }
      } catch (err) {
        toast.error(`${file.name}: ${err.response?.data?.message || (isAr ? 'فشل تحليل الفاتورة' : 'Failed to parse invoice')}`)
      }
    }

    if (newBatchItems.length > 0) {
      setBatchInvoices((prev) => [...prev, ...newBatchItems])
      setActiveTab('upload')
      toast.success(
        isAr
          ? `تم تحليل ${parsedCount} فاتورة بنجاح! يرجى مراجعة البنود وإتمام الحفظ`
          : `Parsed ${parsedCount} invoice(s) successfully! Review items before saving.`
      )
    }

    setUploading(false)
    e.target.value = ''
  }

  function updateBatchInvoiceMeta(batchId, field, value) {
    setBatchInvoices((prev) =>
      prev.map((item) =>
        item.id === batchId
          ? { ...item, parsedMeta: { ...item.parsedMeta, [field]: value } }
          : item
      )
    )
  }

  function updateBatchInvoiceMovementType(batchId, mType) {
    setBatchInvoices((prev) =>
      prev.map((item) =>
        item.id === batchId
          ? { ...item, movementType: mType, parsedMeta: { ...item.parsedMeta, movementType: mType } }
          : item
      )
    )
  }

  function setAllBatchMovementType(mType) {
    setMovementType(mType)
    setBatchInvoices((prev) =>
      prev.map((item) => ({
        ...item,
        movementType: mType,
        parsedMeta: { ...item.parsedMeta, movementType: mType },
      }))
    )
  }

  function toggleBatchInvoiceExpand(batchId) {
    setBatchInvoices((prev) =>
      prev.map((item) => (item.id === batchId ? { ...item, expanded: !item.expanded } : item))
    )
  }

  function handleDelmarDecision(batchId, decision) {
    setBatchInvoices((prev) =>
      prev.map((batch) => {
        if (batch.id !== batchId) return batch
        const updatedLines = (batch.reviewLines || []).map((l) => {
          if (isCoatedItem(l)) {
            return { ...l, ignored: decision === 'exclude' }
          }
          return l
        })
        return {
          ...batch,
          reviewLines: updatedLines,
          delmarDecision: decision,
        }
      })
    )
    if (decision === 'delmar') {
      toast.success(isAr ? '✅ تم اعتماد كافة بنود دهان دلمار للصرف' : 'Coated items approved for Delmar dispatch')
    } else {
      toast.info(isAr ? '🚫 تم استبعاد كافة بنود دهان دلمار من الصرف' : 'Coated items excluded from dispatch')
    }
  }

  function removeBatchInvoice(batchId) {
    setBatchInvoices((prev) => prev.filter((item) => item.id !== batchId))
  }

  function updateBatchInvoiceLine(batchId, index, field, value) {
    setBatchInvoices((prev) =>
      prev.map((batch) => {
        if (batch.id !== batchId) return batch
        const copyLines = [...batch.reviewLines]
        copyLines[index] = { ...copyLines[index], [field]: value }
        if (
          field === 'quantityBar' ||
          field === 'quantityLm' ||
          field === 'lengthMm' ||
          field === 'unitPrice' ||
          field === 'barPrice' ||
          field === 'priceUnit'
        ) {
          const bar = Number(copyLines[index].quantityBar || 0)
          const len = Number(copyLines[index].lengthMm || 6000)
          if (field === 'quantityBar' || field === 'lengthMm') {
            copyLines[index].quantityLm = (bar * len) / 1000
          }
          const lm = Number(copyLines[index].quantityLm || 0)
          const priceUnit = String(copyLines[index].priceUnit || 'M').toUpperCase()
          const unitPrice = Number(copyLines[index].unitPrice || 0)
          const barPrice = Number(copyLines[index].barPrice || 0)
          copyLines[index].netTotal = priceUnit === 'BAR' ? bar * (barPrice || unitPrice) : lm * unitPrice
        }
        return { ...batch, reviewLines: copyLines }
      })
    )
  }

  async function handleSaveSingleBatchInvoice(batchId, options = {}) {
    if (!selectedProjectId) {
      toast.error(isAr ? 'يرجى اختيار المشروع أولاً' : 'Please select a project first')
      return
    }

    const batch = batchInvoices.find((b) => b.id === batchId)
    if (!batch) return

    const validLines = (batch.reviewLines || []).filter(
      (l) => !l.ignored && !l.isService && Number(l.quantityBar || l.quantity || l.qtyBar || l.bars || 0) > 0
    )
    if (validLines.length === 0) {
      toast.error(isAr ? 'لا توجد بنود مخزنية صالحة للحفظ' : 'No valid stock lines to save')
      return
    }

    const soVal = String(batch.parsedMeta?.salesOrder || '').trim()
    const crVal = String(batch.parsedMeta?.customerReference || '').trim()
    if (!soVal || !crVal) {
      toast.error(
        isAr
          ? `⚠️ يرجى إدخال ${!soVal && !crVal ? 'أمر البيع (SO) ومرجع العميل' : !soVal ? 'أمر البيع (SO #)' : 'مرجع العميل (Customer Ref)'} للفاتورة (${batch.parsedMeta?.invoiceNumber || batch.fileName}) قبل الحفظ!`
          : `Please enter ${!soVal && !crVal ? 'Sales Order and Customer Ref' : !soVal ? 'Sales Order #' : 'Customer Ref'} for invoice (${batch.parsedMeta?.invoiceNumber || batch.fileName}) before saving!`
      )
      setBatchInvoices((prev) => prev.map((b) => (b.id === batchId ? { ...b, expanded: true } : b)))
      return
    }

    // Check stock availability if outbound
    if (batch.movementType === 'outbound') {
      const shortages = validLines
        .map((l) => ({ line: l, chk: checkStockAvailability(l, stock, aliasesMap) }))
        .filter((x) => x.chk.status !== 'sufficient')

      if (shortages.length > 0) {
        const issuesSummary = shortages
          .slice(0, 6)
          .map(
            (x) =>
              `• [${x.line.itemCode}]: مطلوب ${x.line.quantityBar} عود (المتاح بالمخزن: ${x.chk.availableBar} عود)`
          )
          .join('\n')
        const moreTxt = shortages.length > 6 ? `\n... وعدد (${shortages.length - 6}) بنود أخرى بها عجز` : ''
        const confirmMsg = isAr
          ? `⚠️ تحذير فحص المخزون قبل الصرف!\nيوجد عدد (${shortages.length}) بند غير متوفرة بالكامل في رصيد المخزن الحالي:\n\n${issuesSummary}${moreTxt}\n\nصرف هذه الفاتورة سيجعل رصيد هذه البنود سالباً!\nهل تريد المتابعة والصرف بالرغم من ذلك؟`
          : `Warning: ${shortages.length} items have insufficient stock in the warehouse!\n\n${issuesSummary}${moreTxt}\n\nDo you still wish to proceed with dispatch?`

        if (!window.confirm(confirmMsg)) {
          toast.info(isAr ? 'تم إيقاف عملية الصرف لمراجعة الكميات' : 'Dispatch stopped for review')
          setBatchInvoices((prev) => prev.map((b) => (b.id === batchId ? { ...b, expanded: true } : b)))
          return
        }
      }
    }

    setBatchInvoices((prev) =>
      prev.map((item) => (item.id === batchId ? { ...item, status: 'saving', errorMessage: null } : item))
    )

    try {
      const hasDelmarActive = batch.movementType === 'outbound' && validLines.some((l) => isCoatedItem(l))
      const payloadMeta = {
        ...batch.parsedMeta,
        movementType: batch.movementType,
        coatingSupplier: hasDelmarActive
          ? 'مصنع دلمار للألومنيوم والدهان (Delmar Industrial Coating)'
          : batch.parsedMeta.supplier || 'المستودع',
        delmarAllocated: hasDelmarActive,
        forceSave: options.forceSave !== undefined ? options.forceSave : true,
      }
      console.log('[BatchSingleSave] Processing invoice:', payloadMeta.invoiceNumber, payloadMeta)
      const res = await processWarehouseInvoice(selectedProjectId, payloadMeta, validLines)
      if (res.success) {
        if (res.isDuplicate) {
          toast.info(res.message || (isAr ? 'تم تحديث بيانات الفاتورة المسجلة سابقاً' : 'Updated duplicate invoice metadata'))
        } else {
          const isOut = batch.movementType === 'outbound'
          toast.success(
            isAr
              ? `تم ${isOut ? 'خصم' : 'إضافة'} الفاتورة (${batch.parsedMeta.invoiceNumber}) بنجاح!`
              : `Invoice ${batch.parsedMeta.invoiceNumber} processed successfully!`
          )
        }
        setBatchInvoices((prev) =>
          prev.map((item) =>
            item.id === batchId ? { ...item, status: 'saved', isDuplicate: res.isDuplicate } : item
          )
        )
        loadStock(selectedProjectId)
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || (isAr ? 'فشل الحفظ' : 'Failed to save')
      console.error('[BatchSingleSave Error]:', err)
      toast.error(errMsg)
      setBatchInvoices((prev) =>
        prev.map((item) => (item.id === batchId ? { ...item, status: 'error', errorMessage: errMsg } : item))
      )
    }
  }

  async function handleSaveBatchInvoices(options = {}) {
    if (!selectedProjectId) {
      toast.error(isAr ? 'يرجى اختيار المشروع أولاً' : 'Please select a project first')
      return
    }

    const pendingInvoices = batchInvoices.filter((b) => b.status !== 'saved')
    if (pendingInvoices.length === 0) {
      toast.info(isAr ? 'جميع الفواتير في القائمة تم حفظها بالفعل' : 'All batch invoices have already been saved')
      return
    }

    // Strictly validate that each pending invoice has salesOrder and customerReference filled
    for (const inv of pendingInvoices) {
      const so = String(inv.parsedMeta?.salesOrder || '').trim()
      const cr = String(inv.parsedMeta?.customerReference || '').trim()
      if (!so || !cr) {
        toast.error(
          isAr
            ? `⚠️ لا يمكن الحفظ: الفاتورة (${inv.parsedMeta?.invoiceNumber || inv.fileName}) ينقصها ${!so && !cr ? 'أمر البيع ومرجع العميل' : !so ? 'أمر البيع (SO #)' : 'مرجع العميل (Customer Ref)'}. يرجى إدخالهما أولاً!`
            : `Cannot save: Invoice (${inv.parsedMeta?.invoiceNumber || inv.fileName}) is missing ${!so && !cr ? 'Sales Order and Customer Ref' : !so ? 'Sales Order #' : 'Customer Ref'}. Please enter them first!`
        )
        setBatchInvoices((prev) => prev.map((b) => (b.id === inv.id ? { ...b, expanded: true } : b)))
        return
      }
    }

    // Check if any pending outbound invoice has stock shortages
    const outboundWithIssues = pendingInvoices.filter((inv) => {
      if (inv.movementType !== 'outbound') return false
      const valid = (inv.reviewLines || []).filter(
        (l) => !l.ignored && !l.isService && Number(l.quantityBar || l.bars || 0) > 0
      )
      return valid.some((l) => checkStockAvailability(l, stock, aliasesMap).status !== 'sufficient')
    })

    if (outboundWithIssues.length > 0) {
      const confirmMsg = isAr
        ? `⚠️ تنبيه فحص المخزون قبل حفظ الدفعة!\nيوجد عدد (${outboundWithIssues.length}) فاتورة صرف بها بنود غير متوفرة بالكامل في رصيد المخزن.\nصرف هذه الفواتير سيؤدي لتحويل رصيد بعض البنود إلى السالب!\n\nهل تريد بالرغم من ذلك إتمام الحفظ والصرف؟`
        : `Warning: ${outboundWithIssues.length} outbound invoices contain items with insufficient stock! Proceed anyway?`
      if (!window.confirm(confirmMsg)) {
        toast.info(isAr ? 'تم إيقاف حفظ الدفعة لمراجعة الأرصدة' : 'Batch save stopped for review')
        return
      }
    }

    setSavingBatch(true)
    let newSavedCount = 0
    let duplicateCount = 0
    let errorCount = 0

    const forceSave = options.forceSave !== undefined ? options.forceSave : true

    for (let i = 0; i < batchInvoices.length; i++) {
      const inv = batchInvoices[i]
      if (inv.status === 'saved') continue

      console.log(`[BatchSave ${i + 1}/${batchInvoices.length}] Processing invoice:`, inv.parsedMeta?.invoiceNumber)

      setBatchInvoices((prev) =>
        prev.map((item) => (item.id === inv.id ? { ...item, status: 'saving', errorMessage: null } : item))
      )

      const validLines = (inv.reviewLines || []).filter(
        (l) => !l.ignored && !l.isService && Number(l.quantityBar || l.quantity || l.qtyBar || l.bars || 0) > 0
      )
      if (validLines.length === 0) {
        setBatchInvoices((prev) =>
          prev.map((item) =>
            item.id === inv.id
              ? { ...item, status: 'error', errorMessage: isAr ? 'لا توجد بنود صالحة' : 'No valid lines' }
              : item
          )
        )
        errorCount++
        continue
      }

      try {
        const payloadMeta = { ...inv.parsedMeta, movementType: inv.movementType, forceSave }
        const res = await processWarehouseInvoice(selectedProjectId, payloadMeta, validLines)
        console.log(`[BatchSave Response ${inv.parsedMeta?.invoiceNumber}]:`, res)
        if (res.success) {
          if (res.isDuplicate) {
            duplicateCount++
          } else {
            newSavedCount++
          }
          setBatchInvoices((prev) =>
            prev.map((item) =>
              item.id === inv.id ? { ...item, status: 'saved', isDuplicate: res.isDuplicate } : item
            )
          )
        } else {
          errorCount++
          setBatchInvoices((prev) =>
            prev.map((item) =>
              item.id === inv.id
                ? { ...item, status: 'error', errorMessage: res.message || (isAr ? 'فشل الحفظ' : 'Failed to save') }
                : item
            )
          )
        }
      } catch (err) {
        errorCount++
        console.error(`[BatchSave Error ${inv.parsedMeta?.invoiceNumber}]:`, err)
        const errMsg = err.response?.data?.message || err.message || (isAr ? 'فشل الحفظ' : 'Failed to save')
        setBatchInvoices((prev) =>
          prev.map((item) => (item.id === inv.id ? { ...item, status: 'error', errorMessage: errMsg } : item))
        )
      }
    }

    setSavingBatch(false)
    await loadStock(selectedProjectId)

    const totalProcessed = newSavedCount + duplicateCount
    if (errorCount === 0) {
      toast.success(
        isAr
          ? `✅ تم إدخال وحفظ جميع الفواتير (${totalProcessed}) بنجاح في رصيد المخزن!`
          : `✅ Successfully inserted all ${totalProcessed} invoice(s) into warehouse stock!`
      )
      setTimeout(() => {
        setBatchInvoices([])
        setActiveTab('stock')
      }, 1200)
    } else {
      toast.warning(
        isAr
          ? `تم إدخال ${totalProcessed} فاتورة في المخزن، وحدثت أخطاء في ${errorCount} فاتورة. يرجى المراجعة.`
          : `Processed ${totalProcessed} invoice(s), ${errorCount} failed. Please review errors.`
      )
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
        const updatedProjects = [...projects, res.project]
        setProjects(updatedProjects)
        try {
          localStorage.setItem('fawterx_cached_projects', JSON.stringify(updatedProjects))
        } catch (e) {}
        handleSelectProject(res.project.id)
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
        { header: isAr ? 'أمر البيع (SO)' : 'Sales Order #', key: 'salesOrder', width: 20 },
        { header: isAr ? 'مرجع العميل' : 'Customer Ref', key: 'customerRef', width: 22 },
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
          salesOrder: item.lastSalesOrder || item.salesOrder || '—',
          customerRef: item.lastCustomerRef || item.customerReference || '—',
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

          if ((colNumber >= 1 && colNumber <= 4) || colNumber === 6 || colNumber === 7 || colNumber === 8) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          } else if (colNumber === 5) {
            cell.alignment = { horizontal: 'left', vertical: 'middle' }
          } else if (colNumber === 12 && cell.value === '-') {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          } else {
            cell.alignment = { horizontal: 'right', vertical: 'middle' }
            cell.numFmt = colNumber === 9 ? '#,##0' : '#,##0.00'
          }
        })
      })

      const lastDataRow = 1 + filteredStock.length

      // Enable Excel AutoFilter on all columns so filtering adjusts totals dynamically
      worksheet.autoFilter = `A1:N${lastDataRow}`

      // Add Grand Total Summary Row using Excel SUBTOTAL(9, ...) formula for dynamic filter calculation
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
        salesOrder: '',
        customerRef: '',
        lengthMm: '',
        quantityBar: { formula: `SUBTOTAL(9,J2:J${lastDataRow})`, result: totalBars },
        quantityLm: { formula: `SUBTOTAL(9,K2:K${lastDataRow})`, result: totalLm },
        quantityKg: { formula: `SUBTOTAL(9,L2:L${lastDataRow})`, result: totalKg },
        lastUnitCost: '',
        totalValue: { formula: `SUBTOTAL(9,N2:N${lastDataRow})`, result: grandTotalVal }
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
        } else if (colNumber === 10) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' }
          cell.numFmt = '#,##0'
        } else if (colNumber === 11 || colNumber === 12 || colNumber === 14) {
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

      const lastDataRow = 1 + filteredInvoices.length
      worksheet.autoFilter = `A1:M${lastDataRow}`

      const totalItemsCount = filteredInvoices.reduce((acc, i) => acc + Number(i.lineItemsCount || 0), 0)
      const totalBars = filteredInvoices.reduce((acc, i) => acc + Number(i.totalQuantityBar || 0), 0)
      const totalLm = filteredInvoices.reduce((acc, i) => acc + Number(i.totalQuantityLm || 0), 0)
      const totalAmount = filteredInvoices.reduce((acc, i) => acc + Number(i.totalAmount || 0), 0)

      const summaryRow = worksheet.addRow({
        idx: '',
        invoiceNo: isAr ? 'الإجمالي الكلي' : 'GRAND TOTAL',
        salesOrder: '',
        customerReference: '',
        movementType: '',
        supplier: '',
        fileName: `${isAr ? 'عدد الفواتير:' : 'Total Invoices:'} ${filteredInvoices.length}`,
        lineItemsCount: { formula: `SUBTOTAL(9,H2:H${lastDataRow})`, result: totalItemsCount },
        totalQuantityBar: { formula: `SUBTOTAL(9,I2:I${lastDataRow})`, result: totalBars },
        totalQuantityLm: { formula: `SUBTOTAL(9,J2:J${lastDataRow})`, result: totalLm },
        totalAmount: { formula: `SUBTOTAL(9,K2:K${lastDataRow})`, result: totalAmount },
        invoiceDate: '',
        recordedAt: ''
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

        if (colNumber === 2) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        } else if (colNumber === 7) {
          cell.alignment = { horizontal: 'left', vertical: 'middle' }
        } else if (colNumber === 8 || colNumber === 9) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' }
          cell.numFmt = '#,##0'
        } else if (colNumber === 10 || colNumber === 11) {
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
              onChange={(e) => handleSelectProject(e.target.value)}
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
        <button
          className={`btn ${activeTab === 'dispatches' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('dispatches')}
        >
          🚚 {isAr ? 'تتبع مراحل الصرف والدهان' : 'Dispatches Tracker'}
        </button>
        {isAdmin && (
          <button
            className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('users')}
          >
            ⚙️ {isAr ? 'إدارة صلاحيات المستخدمين' : 'Access Control'}
          </button>
        )}
        {isAdmin && (
          <button
            className={`btn ${activeTab === 'audit' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('audit')}
          >
            🛡️ {isAr ? 'سجل التدقيق والتغييرات' : 'Audit Trail Logs'}
          </button>
        )}
        <button
          className={`btn ${activeTab === 'projects' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('projects')}
        >
          📁 {isAr ? 'إدارة المشاريع' : 'Projects Manager'}
        </button>
        <button
          className={`btn ${activeTab === 'restore_points' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('restore_points')}
        >
          💾 {isAr ? 'نقاط الحفظ والنسخ الاحتياطية' : 'Restore Points & Snapshots'}
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
                placeholder={isAr ? 'ابحث بكود الصنف، كود العميل، الوصف، الدهان، أو الفاتورة...' : 'Search by item code, customer code, description, finish, or invoice...'}
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
                onClick={() => handleOpenManualModal('inbound')}
                style={{
                  background: 'linear-gradient(135deg, #00e0a1 0%, #00b894 100%)',
                  color: '#000',
                  border: 'none',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 224, 161, 0.25)',
                }}
                title={isAr ? 'إضافة وتوريد قطاعات جديدة أو رصيد يدوي' : 'Manual stock supply'}
              >
                📥 {isAr ? 'توريد يدوي (+)' : 'Manual Supply'}
              </button>

              <button
                className="btn"
                onClick={() => handleOpenManualModal('outbound')}
                style={{
                  background: 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.55rem 1.1rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(255, 71, 87, 0.25)',
                }}
                title={isAr ? 'صرف قطاعات وتتبع مراحل الدهان والتسليم' : 'Manual dispatch with stages'}
              >
                📤 {isAr ? 'صرف بمراحل (-)' : 'Dispatch with Stages'}
              </button>

              {selectedStockKeys.length > 0 && (
                <button
                  className="btn"
                  onClick={handleOpenOutboundForSelected}
                  style={{
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                    color: '#000',
                    border: 'none',
                    padding: '0.55rem 1.1rem',
                    borderRadius: '8px',
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(255, 215, 0, 0.4)',
                  }}
                  title={isAr ? `صرف (${selectedStockKeys.length}) قطاعات محددة وتتبع مراحلها` : `Dispatch (${selectedStockKeys.length}) selected items`}
                >
                  🚀 {isAr ? `صرف المحدد بمراحل (${selectedStockKeys.length})` : `Dispatch Selected (${selectedStockKeys.length})`}
                </button>
              )}

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

              {isAdmin && selectedStockKeys.length > 0 && (
                <button
                  className="btn"
                  disabled={deletingBulk}
                  onClick={handleBulkDeleteStockItems}
                  style={{
                    background: 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)',
                    color: '#fff',
                    border: 'none',
                    padding: '0.55rem 1.2rem',
                    borderRadius: '8px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(255, 71, 87, 0.4)',
                  }}
                  title={isAr ? `حذف ${selectedStockKeys.length} أصناف من المخزن نهائياً` : `Delete ${selectedStockKeys.length} selected items`}
                >
                  🗑️ {deletingBulk ? '...' : (isAr ? `حذف المحدد (${selectedStockKeys.length})` : `Delete Selected (${selectedStockKeys.length})`)}
                </button>
              )}

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
                  {isAdmin && (
                    <th style={{ padding: '0.75rem 0.5rem', width: '40px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={filteredStock.length > 0 && filteredStock.every((i) => selectedStockKeys.includes(i.itemKey))}
                        onChange={() => handleToggleSelectAllStock(filteredStock)}
                        style={{ accentColor: '#ff4757', width: '16px', height: '16px', cursor: 'pointer' }}
                        title={isAr ? 'تحديد الكل / إلغاء تحديد الكل' : 'Select All / Deselect All'}
                      />
                    </th>
                  )}
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
                      <tr key={item.itemKey} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: selectedStockKeys.includes(item.itemKey) ? 'rgba(255, 71, 87, 0.1)' : isEditing ? 'rgba(0, 224, 161, 0.05)' : 'transparent' }}>
                        {isAdmin && (
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedStockKeys.includes(item.itemKey)}
                              onChange={() => handleToggleSelectStockKey(item.itemKey)}
                              style={{ accentColor: '#ff4757', width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                          </td>
                        )}
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
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingStockData.lastSalesOrder || ''}
                                onChange={(e) => setEditingStockData({ ...editingStockData, lastSalesOrder: e.target.value })}
                                style={{ width: '100px', background: '#101223', color: '#fff', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px' }}
                              />
                            ) : (
                              item.lastSalesOrder || item.salesOrder || '—'
                            )}
                          </td>
                        )}
                        {stockColumns.customerRef && (
                          <td style={{ padding: '0.75rem 1rem', color: '#ffb74d', fontWeight: 600 }}>
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingStockData.lastCustomerRef || ''}
                                onChange={(e) => setEditingStockData({ ...editingStockData, lastCustomerRef: e.target.value })}
                                style={{ width: '100px', background: '#101223', color: '#fff', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px' }}
                              />
                            ) : (
                              item.lastCustomerRef || item.customerReference || '—'
                            )}
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
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv, idx) => {
                    const isOut = inv.movementType === 'outbound'
                    const isCancelled = inv.status === 'cancelled' || inv.isCancelled
                    return (
                      <tr
                        key={inv.id || idx}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: isCancelled ? 'rgba(255,71,87,0.04)' : 'transparent',
                          opacity: isCancelled ? 0.75 : 1,
                        }}
                      >
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#64b5f6' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span>{inv.invoiceNumber || '—'}</span>
                            {isCancelled && (
                              <span
                                className="badge"
                                style={{
                                  background: 'rgba(255, 71, 87, 0.2)',
                                  color: '#ff4757',
                                  border: '1px solid rgba(255, 71, 87, 0.4)',
                                  fontSize: '0.75rem',
                                  padding: '1px 6px',
                                  fontWeight: 700,
                                }}
                              >
                                ⚠️ {isAr ? 'ملغاة (تم التراجع)' : 'Cancelled'}
                              </span>
                            )}
                          </div>
                        </td>
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
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                            <button
                              className="btn btn-sm"
                              onClick={() => handleViewInvoiceDetails(inv)}
                              style={{ background: 'rgba(0, 168, 255, 0.15)', color: '#70a1ff', border: '1px solid rgba(0, 168, 255, 0.3)' }}
                            >
                              👁️ {isAr ? 'عرض' : 'View'}
                            </button>
                            {isAdmin && !isCancelled && (
                              <button
                                className="btn btn-sm"
                                onClick={() => handleRollbackInvoice(inv)}
                                disabled={rollingBackInvoiceId === inv.id}
                                title={isAr ? '👑 خاص بالإدارة العليا: التراجع عن الفاتورة وعكس رصيد المخزن' : 'Rollback invoice & reverse stock balance'}
                                style={{
                                  background: 'rgba(255, 71, 87, 0.15)',
                                  color: '#ff6b81',
                                  border: '1px solid rgba(255, 71, 87, 0.4)',
                                  fontWeight: 600,
                                  fontSize: '0.8rem',
                                  padding: '0.25rem 0.6rem',
                                  cursor: 'pointer',
                                }}
                              >
                                {rollingBackInvoiceId === inv.id ? (
                                  <span className="spinner"></span>
                                ) : (
                                  isAr ? '⏪ تراجع' : 'Rollback'
                                )}
                              </button>
                            )}
                          </div>
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

      {/* ─── TAB 2: Upload & Review Invoice Movements (Single & Batch) ─── */}
      {activeTab === 'upload' && (
        <div className="card fade-in" style={{ padding: '1.5rem' }}>
          {/* Header Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🧾 {isAr ? 'رفع ومعالجة الفواتير (فردي أو دفعة واحدة)' : 'Upload & Process Invoices (Single or Batch)'}
                {batchInvoices.length > 0 && (
                  <span className="badge" style={{ background: 'rgba(0,224,161,0.15)', color: '#00e0a1', border: '1px solid rgba(0,224,161,0.3)', borderRadius: '12px' }}>
                    {batchInvoices.length} {isAr ? 'فواتير في الدفعة' : 'invoices in queue'}
                  </span>
                )}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {isAr
                  ? 'يمكنك اختيار فاتورة واحدة أو عدة فواتير معا للتوريد (+) أو الصرف (-) ومراجعتها ثم اعتمادها في خطوة واحدة'
                  : 'Select single or multiple invoices for inbound (+) or outbound (-) movement, review, and commit at once'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Quick Manual Actions */}
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => handleOpenManualModal('inbound')}
                style={{
                  background: 'linear-gradient(135deg, #00e0a1 0%, #00b894 100%)',
                  color: '#000',
                  fontWeight: 700,
                  borderRadius: '8px',
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.82rem',
                }}
              >
                📥 {isAr ? 'توريد يدوي مباشر' : 'Manual Inbound'}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => handleOpenManualModal('outbound')}
                style={{
                  background: 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)',
                  color: '#fff',
                  fontWeight: 700,
                  borderRadius: '8px',
                  padding: '0.45rem 0.9rem',
                  fontSize: '0.82rem',
                }}
              >
                📤 {isAr ? 'صرف يدوي وتتبع مراحل' : 'Manual Outbound'}
              </button>

              {/* Global Movement Mode Switcher */}
              <div style={{ display: 'flex', gap: '0.5rem', background: '#101223', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  className={`btn btn-sm ${movementType === 'inbound' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setAllBatchMovementType('inbound')}
                  style={{ borderRadius: '7px', fontWeight: 700 }}
                >
                  📥 {isAr ? 'تعيين الكل: توريد (+)' : 'Set All: Inbound (+)'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setAllBatchMovementType('outbound')}
                  style={{
                    borderRadius: '7px',
                    fontWeight: 700,
                    background: movementType === 'outbound' ? '#ff4d4f' : 'transparent',
                    borderColor: movementType === 'outbound' ? '#ff4d4f' : 'transparent',
                    color: '#fff',
                  }}
                >
                  📤 {isAr ? 'تعيين الكل: صرف (-)' : 'Set All: Outbound (-)'}
                </button>
              </div>
            </div>
          </div>

          {/* Upload Dropzone (always available or when queue empty) */}
          {batchInvoices.length === 0 ? (
            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: '12px',
                padding: '3rem',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.01)',
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (e.dataTransfer.files?.length > 0) {
                  handleFileUpload({ target: { files: e.dataTransfer.files } })
                }
              }}
            >
              <div style={{ fontSize: '2.8rem', marginBottom: '0.5rem' }}>📁</div>
              <h4 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>
                {isAr ? 'اختر فواتير الموردين (يمكن اختيار كذا فاتورة سوا)' : 'Select Supplier Invoices (Select multiple files at once)'}
              </h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                {isAr ? 'يدعم فواتير Excel و PDF لشركة Canex و Schüco والتوريدات العامة' : 'Supports Excel & PDF files for Canex, Schüco, and general suppliers'}
              </p>
              <input
                type="file"
                multiple
                accept=".xlsx,.xls,.csv,.pdf"
                id="warehouse-file-input"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <label htmlFor="warehouse-file-input" className="btn btn-primary" style={{ cursor: 'pointer', padding: '0.7rem 1.8rem', fontSize: '1rem', fontWeight: 700 }}>
                {uploading ? <span className="spinner"></span> : isAr ? '📂 اختيار ملفات الفواتير (تحديد متعدد)' : '📂 Choose Invoice Files (Multi-Select)'}
              </label>
            </div>
          ) : (
            <div>
              {/* Batch Action Toolbar */}
              <div
                style={{
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(0, 224, 161, 0.05)',
                  border: '1px solid rgba(0, 224, 161, 0.2)',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.5rem',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: '#00e0a1', fontSize: '1.05rem' }}>
                    📦 {isAr ? `دفعة المعالجة: ${batchInvoices.length} فواتير` : `Batch Queue: ${batchInvoices.length} Invoices`}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    ({batchInvoices.filter((b) => b.status === 'saved').length} {isAr ? 'تم حفظها' : 'saved'}, {batchInvoices.filter((b) => b.status !== 'saved').length} {isAr ? 'متبقية' : 'pending'})
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    multiple
                    accept=".xlsx,.xls,.csv,.pdf"
                    id="warehouse-file-input-more"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <label htmlFor="warehouse-file-input-more" className="btn btn-sm btn-ghost" style={{ cursor: 'pointer', border: '1px solid var(--border)' }}>
                    ➕ {isAr ? 'إضافة فواتير أخرى' : 'Add More Files'}
                  </label>

                  <button
                    className="btn btn-sm"
                    onClick={() => setBatchInvoices([])}
                    style={{ background: 'rgba(255, 77, 79, 0.15)', color: '#ff4757', border: '1px solid rgba(255, 77, 79, 0.3)' }}
                  >
                    🗑️ {isAr ? 'مسح القائمة' : 'Clear Queue'}
                  </button>

                  <button
                    className="btn"
                    onClick={handleSaveBatchInvoices}
                    disabled={savingBatch || batchInvoices.filter((b) => b.status !== 'saved').length === 0}
                    style={{
                      background: 'linear-gradient(135deg, #00e0a1 0%, #00b884 100%)',
                      color: '#000',
                      fontWeight: 800,
                      padding: '0.6rem 1.4rem',
                      borderRadius: '8px',
                      boxShadow: '0 4px 15px rgba(0, 224, 161, 0.3)',
                    }}
                  >
                    {savingBatch ? (
                      <span className="spinner"></span>
                    ) : (
                      `💾 ${isAr ? `حفظ وإتمام كافة الفواتير (${batchInvoices.filter((b) => b.status !== 'saved').length})` : `Save & Process All (${batchInvoices.filter((b) => b.status !== 'saved').length})`}`
                    )}
                  </button>
                </div>
              </div>

              {/* Batch Invoices Accordion List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {batchInvoices.map((batch, bIdx) => {
                  const isOut = batch.movementType === 'outbound'
                  const validLinesCount = batch.reviewLines.filter((l) => !l.ignored && !l.isService && Number(l.quantityBar) > 0).length
                  const totalBars = batch.reviewLines.reduce((acc, l) => acc + (l.ignored ? 0 : Number(l.quantityBar || 0)), 0)

                  return (
                    <div
                      key={batch.id}
                      style={{
                        background: 'rgba(18, 22, 41, 0.95)',
                        border: `1px solid ${batch.status === 'saved' ? '#00e0a1' : batch.status === 'error' ? '#ff4757' : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: '12px',
                        overflow: 'hidden',
                        transition: 'all 0.2s ease-in-out',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                      }}
                    >
                      {/* Invoice Card Header */}
                      <div
                        style={{
                          padding: '1rem 1.25rem',
                          background: batch.status === 'saved' ? 'rgba(0,224,161,0.06)' : 'rgba(255,255,255,0.02)',
                          display: 'flex',
                          justify: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '1rem',
                          borderBottom: batch.expanded ? '1px solid rgba(255,255,255,0.08)' : 'none',
                        }}
                      >
                        {/* Title & Metadata fields */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap', flex: 1 }}>
                          <button
                            onClick={() => toggleBatchInvoiceExpand(batch.id)}
                            style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.1rem', cursor: 'pointer', padding: 0 }}
                          >
                            {batch.expanded ? '▼' : '►'}
                          </button>

                          <span style={{ fontWeight: 800, color: '#fff', fontSize: '1rem' }}>
                            #{bIdx + 1}
                          </span>

                          {/* Editable Invoice No */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'رقم الفاتورة:' : 'Inv #:'}</span>
                            <input
                              type="text"
                              value={batch.parsedMeta.invoiceNumber || ''}
                              onChange={(e) => updateBatchInvoiceMeta(batch.id, 'invoiceNumber', e.target.value)}
                              style={{ background: '#101223', border: '1px solid var(--border)', color: '#64b5f6', fontWeight: 700, padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.88rem', width: '140px' }}
                            />
                          </div>

                          {/* Editable SO # with validation alert */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.75rem', color: !batch.parsedMeta.salesOrder ? '#ff4757' : 'var(--text-muted)', fontWeight: !batch.parsedMeta.salesOrder ? 800 : 400 }}>
                              SO #: {!batch.parsedMeta.salesOrder && <span style={{ color: '#ff4757' }}>*</span>}
                            </span>
                            <input
                              type="text"
                              value={batch.parsedMeta.salesOrder || ''}
                              onChange={(e) => updateBatchInvoiceMeta(batch.id, 'salesOrder', e.target.value)}
                              placeholder="SO-10023"
                              style={{
                                background: '#101223',
                                border: batch.parsedMeta.salesOrder ? '1px solid var(--border)' : '1.5px solid #ff4757',
                                color: '#00e0a1',
                                fontWeight: 700,
                                padding: '0.3rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.88rem',
                                width: '130px',
                                boxShadow: !batch.parsedMeta.salesOrder ? '0 0 8px rgba(255, 71, 87, 0.35)' : 'none',
                              }}
                            />
                          </div>

                          {/* Editable Customer Ref in Header with validation alert */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ fontSize: '0.75rem', color: !batch.parsedMeta.customerReference ? '#ff4757' : 'var(--text-muted)', fontWeight: !batch.parsedMeta.customerReference ? 800 : 400 }}>
                              {isAr ? 'المرجع:' : 'Ref:'} {!batch.parsedMeta.customerReference && <span style={{ color: '#ff4757' }}>*</span>}
                            </span>
                            <input
                              type="text"
                              value={batch.parsedMeta.customerReference || ''}
                              onChange={(e) => updateBatchInvoiceMeta(batch.id, 'customerReference', e.target.value)}
                              placeholder="Q-00235 / SP-001"
                              style={{
                                background: '#101223',
                                border: batch.parsedMeta.customerReference ? '1px solid var(--border)' : '1.5px solid #ff4757',
                                color: '#ffb74d',
                                fontWeight: 700,
                                padding: '0.3rem 0.6rem',
                                borderRadius: '6px',
                                fontSize: '0.88rem',
                                width: '130px',
                                boxShadow: !batch.parsedMeta.customerReference ? '0 0 8px rgba(255, 71, 87, 0.35)' : 'none',
                              }}
                            />
                          </div>

                          {/* Movement Type Badge Toggle per Invoice */}
                          <select
                            value={batch.movementType}
                            onChange={(e) => updateBatchInvoiceMovementType(batch.id, e.target.value)}
                            style={{
                              background: isOut ? '#ff4757' : '#00e0a1',
                              color: '#000',
                              border: 'none',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '8px',
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                            }}
                          >
                            <option value="inbound">{isAr ? '📥 توريد (إضافة +)' : '📥 Inbound (+)'}</option>
                            <option value="outbound">{isAr ? '📤 صرف (خصم -)' : '📤 Outbound (-)'}</option>
                          </select>

                          {/* Badges */}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            📄 {batch.fileName}
                          </span>
                          <span className="badge" style={{ background: 'rgba(255, 215, 0, 0.1)', color: '#FFD700', border: '1px solid rgba(255, 215, 0, 0.3)', fontSize: '0.8rem' }}>
                            {validLinesCount} {isAr ? 'بنود صالحة' : 'valid lines'}
                          </span>
                          <span className="badge" style={{ background: 'rgba(100, 181, 246, 0.1)', color: '#64b5f6', border: '1px solid rgba(100, 181, 246, 0.3)', fontSize: '0.8rem' }}>
                            {totalBars} BAR
                          </span>
                        </div>

                        {/* Status & Single Save/Remove controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          {batch.status === 'saved' ? (
                            <span className="badge badge-valid" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                              ✅ {batch.isDuplicate ? (isAr ? 'مدمجة (تحديث بيانات)' : 'Merged Duplicate') : (isAr ? 'تم الحفظ' : 'Saved')}
                            </span>
                          ) : batch.status === 'saving' ? (
                            <span className="badge" style={{ background: 'rgba(255,215,0,0.15)', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)', fontSize: '0.85rem' }}>
                              ⏳ {isAr ? 'جاري الحفظ...' : 'Saving...'}
                            </span>
                          ) : batch.status === 'error' ? (
                            <span className="badge" style={{ background: 'rgba(255,77,79,0.15)', color: '#ff4757', border: '1px solid rgba(255,77,79,0.3)', fontSize: '0.85rem' }} title={batch.errorMessage}>
                              ❌ {batch.errorMessage || (isAr ? 'خطأ' : 'Error')}
                            </span>
                          ) : (
                            <span className="badge" style={{ background: 'rgba(255,255,255,0.08)', color: '#ccc', border: '1px solid rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>
                              🟡 {isAr ? 'جاهز للمراجعة' : 'Ready'}
                            </span>
                          )}

                          {batch.status !== 'saved' && (
                            <button
                              className="btn btn-sm btn-primary"
                              disabled={batch.status === 'saving'}
                              onClick={() => handleSaveSingleBatchInvoice(batch.id)}
                              style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem', fontWeight: 700 }}
                            >
                              💾 {isAr ? 'حفظ هذه الفاتورة' : 'Save Invoice'}
                            </button>
                          )}

                          <button
                            className="btn btn-sm"
                            onClick={() => removeBatchInvoice(batch.id)}
                            style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#ff7875', border: '1px solid rgba(255,255,255,0.1)', padding: '0.35rem 0.6rem' }}
                            title={isAr ? 'حذف من الدفعة' : 'Remove from batch'}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Card Expanded Content: Editable Fields & Line Items */}
                      {batch.expanded && (
                        <div style={{ padding: '1.25rem' }}>
                          {/* Invoice Metadata Row */}
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                              gap: '0.8rem',
                              marginBottom: '1.25rem',
                              background: 'rgba(0,0,0,0.2)',
                              padding: '0.85rem 1rem',
                              borderRadius: '8px',
                              border: '1px solid rgba(255,255,255,0.05)',
                            }}
                          >
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'مرجع العميل (Ref):' : 'Customer Ref:'}</span>
                              <input
                                type="text"
                                value={batch.parsedMeta.customerReference || ''}
                                onChange={(e) => updateBatchInvoiceMeta(batch.id, 'customerReference', e.target.value)}
                                style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.4rem 0.6rem', color: '#ffb74d', borderRadius: '6px', fontSize: '0.85rem', marginTop: '0.2rem' }}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'اسم المورد:' : 'Supplier:'}</span>
                              <input
                                type="text"
                                value={batch.parsedMeta.supplier || 'Canex'}
                                onChange={(e) => updateBatchInvoiceMeta(batch.id, 'supplier', e.target.value)}
                                style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.4rem 0.6rem', color: '#fff', borderRadius: '6px', fontSize: '0.85rem', marginTop: '0.2rem' }}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'تاريخ الفاتورة:' : 'Invoice Date:'}</span>
                              <input
                                type="date"
                                value={batch.parsedMeta.invoiceDate || ''}
                                onChange={(e) => updateBatchInvoiceMeta(batch.id, 'invoiceDate', e.target.value)}
                                style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.4rem 0.6rem', color: '#fff', borderRadius: '6px', fontSize: '0.85rem', marginTop: '0.2rem' }}
                              />
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isAr ? 'تاريخ الاستلام:' : 'Receipt Date:'}</span>
                              <input
                                type="date"
                                value={batch.parsedMeta.receiptDate || ''}
                                onChange={(e) => updateBatchInvoiceMeta(batch.id, 'receiptDate', e.target.value)}
                                style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.4rem 0.6rem', color: '#fff', borderRadius: '6px', fontSize: '0.85rem', marginTop: '0.2rem' }}
                              />
                            </div>
                          </div>

                          {/* Outbound Stock Availability Banner */}
                          {batch.movementType === 'outbound' && (() => {
                            const validLines = (batch.reviewLines || []).filter(
                              (l) => !l.ignored && !l.isService && Number(l.quantityBar || l.bars || 0) > 0
                            )
                            let sufficient = 0
                            let shortage = 0
                            let missing = 0
                            validLines.forEach((l) => {
                              const res = checkStockAvailability(l, stock, aliasesMap)
                              if (res.status === 'sufficient') sufficient++
                              else if (res.status === 'shortage') shortage++
                              else missing++
                            })
                            const hasIssues = shortage + missing > 0

                            return (
                              <div
                                style={{
                                  background: hasIssues ? 'rgba(255, 71, 87, 0.1)' : 'rgba(0, 224, 161, 0.1)',
                                  border: `1px solid ${hasIssues ? 'rgba(255, 71, 87, 0.35)' : 'rgba(0, 224, 161, 0.35)'}`,
                                  borderRadius: '10px',
                                  padding: '0.85rem 1.15rem',
                                  marginBottom: '1.15rem',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '0.75rem',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <span style={{ fontSize: '1.4rem' }}>{hasIssues ? '⚠️' : '✅'}</span>
                                  <div>
                                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: hasIssues ? '#ff4757' : '#00e0a1' }}>
                                      {isAr
                                        ? hasIssues
                                          ? `تنبيه فحص المخزون قبل الصرف: يوجد عدد (${shortage + missing}) بنود غير متوفرة بالكامل!`
                                          : 'فحص المخزون ممتاز: كافة بنود إذن الصرف متوفرة بالمخزن وجاهزة للصرف فوراً!'
                                        : hasIssues
                                          ? `Stock Shortage Alert: ${shortage + missing} items are insufficient!`
                                          : 'All items are in stock and ready for dispatch!'}
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                      {isAr
                                        ? `🟢 متوفر بالكامل: (${sufficient}) | 🔴 عجز بالرصيد: (${shortage}) | ⚪ غير مسجل بالمخزن: (${missing}) من إجمالي (${validLines.length}) بند`
                                        : `🟢 Sufficient: (${sufficient}) | 🔴 Shortage: (${shortage}) | ⚪ Missing: (${missing}) of (${validLines.length}) items`}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleCoverAllDelmar(batch.id, 'full')}
                                    className="btn btn-sm"
                                    style={{
                                      background: '#00e0a1',
                                      color: '#000',
                                      border: 'none',
                                      fontWeight: 800,
                                      padding: '0.4rem 0.85rem',
                                      borderRadius: '8px',
                                      fontSize: '0.82rem',
                                      cursor: 'pointer',
                                    }}
                                    title={isAr ? 'صرف جميع بنود هذا الإذن بالكامل من مخزن دلمار وحفظ رصيد المستودع الرئيسي بدون خصم' : 'Dispatch all lines from Delmar, preserve warehouse stock'}
                                  >
                                    🏭 {isAr ? 'صرف الإذن بالكامل من دلمار' : 'Full Delmar'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCoverAllDelmar(batch.id, 'shortage')}
                                    className="btn btn-sm"
                                    style={{
                                      background: 'rgba(245, 158, 11, 0.2)',
                                      color: '#fbbf24',
                                      border: '1px solid #fbbf24',
                                      fontWeight: 800,
                                      padding: '0.4rem 0.85rem',
                                      borderRadius: '8px',
                                      fontSize: '0.82rem',
                                      cursor: 'pointer',
                                    }}
                                    title={isAr ? 'صرف المتاح بالمستودع وتغطية كافة الفروق والعجز فقط من مخزن دلمار' : 'Cover shortages from Delmar'}
                                  >
                                    ⚖️ {isAr ? 'تغطية العجز من دلمار' : 'Cover Shortages'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleClearAllDelmar(batch.id)}
                                    className="btn btn-sm"
                                    style={{
                                      background: 'rgba(255, 255, 255, 0.08)',
                                      color: '#aaa',
                                      border: '1px solid rgba(255, 255, 255, 0.15)',
                                      fontWeight: 600,
                                      padding: '0.4rem 0.75rem',
                                      borderRadius: '8px',
                                      fontSize: '0.8rem',
                                      cursor: 'pointer',
                                    }}
                                    title={isAr ? 'إعادة تعيين للصرف من المستودع الرئيسي فقط' : 'Reset to main warehouse'}
                                  >
                                    🔄 {isAr ? 'إعادة للمستودع' : 'Reset'}
                                  </button>
                                </div>
                              </div>
                            )
                          })()}

                          {/* Delmar Coating Decision & Allocation Card */}
                          {batch.movementType === 'outbound' && (() => {
                            const allCoated = (batch.reviewLines || []).filter((l) => !l.isService && isCoatedItem(l))
                            if (allCoated.length === 0) return null

                            const rawLines = (batch.reviewLines || []).filter((l) => !l.isService && !isCoatedItem(l))
                            const coatedBars = allCoated.reduce((acc, l) => acc + Number(l.quantityBar || l.bars || 0), 0)
                            const rawBars = rawLines.reduce((acc, l) => acc + Number(l.quantityBar || l.bars || 0), 0)
                            const activeCoated = allCoated.filter((l) => !l.ignored)
                            const excludedCoated = allCoated.filter((l) => l.ignored)

                            return (
                              <div
                                style={{
                                  background: 'rgba(245, 158, 11, 0.08)',
                                  border: '1px solid rgba(245, 158, 11, 0.35)',
                                  borderRadius: '10px',
                                  padding: '1rem 1.25rem',
                                  marginBottom: '1.25rem',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: '1rem',
                                }}
                              >
                                <div style={{ flex: '1 1 350px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🏭</span>
                                    <span style={{ fontWeight: 800, fontSize: '0.98rem', color: '#fbbf24' }}>
                                      {isAr ? 'بنود الدهان الخاصة بأمر التسليم (مخزن دلمار - بتدهن):' : 'Coating Items for Delivery (Delmar Warehouse):'}
                                    </span>
                                    <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid #fbbf24', fontSize: '0.75rem' }}>
                                      {allCoated.length} {isAr ? 'بند دهان' : 'coated items'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '0.84rem', color: '#e2e8f0', lineHeight: 1.5 }}>
                                    {isAr ? (
                                      <>
                                        • تم رصد <strong>{allCoated.length} بند دهان</strong> بإجمالي <strong>{coatedBars.toLocaleString()} عود</strong> تخص التسليم (موجودة في <strong>مخزن دلمار بتدهن</strong>).<br />
                                        • يوجد <strong>{rawLines.length} بند خام (MF)</strong> بالمستودع الرئيسي.<br />
                                        • الحالة الحالية: <span style={{ color: activeCoated.length > 0 ? '#00e0a1' : '#ff4757', fontWeight: 800 }}>({activeCoated.length} بند معتمد للصرف من دلمار)</span> و <span style={{ color: 'var(--text-muted)' }}>({excludedCoated.length} بند مستبعد)</span>.
                                      </>
                                    ) : (
                                      <>
                                        Detected {allCoated.length} coated items ({coatedBars.toLocaleString()} bars) in Delmar Warehouse for delivery.<br />
                                        Current: {activeCoated.length} approved for dispatch from Delmar | {excludedCoated.length} excluded.
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* Owner Decision Buttons */}
                                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24' }}>
                                    {isAr ? 'قرار المالك:' : 'Owner Decision:'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDelmarDecision(batch.id, 'delmar')}
                                    className="btn btn-sm"
                                    style={{
                                      background: activeCoated.length === allCoated.length ? '#00e0a1' : 'rgba(0, 224, 161, 0.15)',
                                      color: activeCoated.length === allCoated.length ? '#000' : '#00e0a1',
                                      border: '1px solid #00e0a1',
                                      fontWeight: 800,
                                      padding: '0.4rem 0.85rem',
                                      borderRadius: '8px',
                                      fontSize: '0.82rem',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    ✅ {isAr ? 'البنود تبعنا (صرف من مخزن دلمار)' : 'Ours (Dispatch from Delmar)'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelmarDecision(batch.id, 'exclude')}
                                    className="btn btn-sm"
                                    style={{
                                      background: excludedCoated.length === allCoated.length ? '#ff4757' : 'rgba(255, 71, 87, 0.15)',
                                      color: excludedCoated.length === allCoated.length ? '#fff' : '#ff4757',
                                      border: '1px solid #ff4757',
                                      fontWeight: 800,
                                      padding: '0.4rem 0.85rem',
                                      borderRadius: '8px',
                                      fontSize: '0.82rem',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    🚫 {isAr ? 'ليست تبعنا (استبعاد بنود دلمار)' : 'Not Ours (Exclude Delmar)'}
                                  </button>
                                </div>
                              </div>
                            )
                          })()}

                          {/* Line Items Table */}
                          <div style={{ overflowX: 'auto', marginBottom: '0.5rem' }}>
                            <table style={{ minWidth: batch.movementType === 'outbound' ? '2450px' : '1950px', width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', tableLayout: 'fixed' }}>
                              <colgroup>
                                <col style={{ width: '45px' }} />
                                <col style={{ width: '55px' }} />
                                <col style={{ width: '130px' }} />
                                <col style={{ width: '130px' }} />
                                {batch.movementType === 'outbound' && (
                                  <>
                                    <col style={{ width: '270px' }} />
                                    <col style={{ width: '270px' }} />
                                  </>
                                )}
                                <col style={{ width: '420px' }} /> {/* Description */}
                                <col style={{ width: '100px' }} /> {/* Bars (الأعواد) - Right After Description! */}
                                <col style={{ width: '110px' }} /> {/* Finish */}
                                <col style={{ width: '90px' }} />  {/* Length */}
                                <col style={{ width: '110px' }} /> {/* Total LM */}
                                <col style={{ width: '110px' }} /> {/* Total KG */}
                                <col style={{ width: '110px' }} /> {/* Meter Price */}
                                <col style={{ width: '110px' }} /> {/* Bar Price */}
                                <col style={{ width: '130px' }} /> {/* Total */}
                              </colgroup>
                              <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                                  <th style={{ padding: '0.6rem 0.4rem', textAlign: 'center' }}>#</th>
                                  <th style={{ padding: '0.6rem 0.4rem' }}>{isAr ? 'تجاهل' : 'Ignore'}</th>
                                  <th style={{ padding: '0.6rem 0.4rem' }}>{isAr ? 'كود الصنف' : 'Item'}</th>
                                  <th style={{ padding: '0.6rem 0.4rem', color: '#8ab4ff' }}>{isAr ? 'كود العميل' : 'Customer Code'}</th>
                                  {batch.movementType === 'outbound' && (
                                    <>
                                      <th style={{ padding: '0.6rem 0.4rem', color: '#00e0a1' }}>{isAr ? '📦 رصيد المستودع والمتبقي' : '📦 Warehouse Stock & Remaining'}</th>
                                      <th style={{ padding: '0.6rem 0.4rem', color: '#fbbf24' }}>{isAr ? '🏭 مخزن دلمار والتغطية' : '🏭 Delmar Warehouse & Coverage'}</th>
                                    </>
                                  )}
                                  <th style={{ padding: '0.6rem 0.4rem' }}>{isAr ? 'وصف الصنف / القطاع' : 'Description'}</th>
                                  <th style={{ padding: '0.6rem 0.4rem', color: '#00e0a1', fontWeight: 800 }}>{isAr ? 'الأعواد (Bars)' : 'Bars'}</th>
                                  <th style={{ padding: '0.6rem 0.4rem' }}>{isAr ? 'التشطيب' : 'Finish'}</th>
                                  <th style={{ padding: '0.6rem 0.4rem' }}>{isAr ? 'الطول mm' : 'Length mm'}</th>
                                  <th style={{ padding: '0.6rem 0.4rem' }}>{isAr ? 'إجمالي الأمتار' : 'Total LM'}</th>
                                  <th style={{ padding: '0.6rem 0.4rem' }}>{isAr ? 'إجمالي الوزن' : 'Total KG'}</th>
                                  <th style={{ padding: '0.6rem 0.4rem' }}>{isAr ? 'سعر المتر' : 'Meter Price'}</th>
                                  <th style={{ padding: '0.6rem 0.4rem' }}>{isAr ? 'سعر العود' : 'Bar Price'}</th>
                                  <th style={{ padding: '0.6rem 0.4rem' }}>{isAr ? 'الإجمالي' : 'Total'}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {batch.reviewLines.map((line, idx) => {
                                  const isCoated = isCoatedItem(line)
                                  return (
                                  <tr
                                    key={line.id}
                                    style={{
                                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                                      opacity: line.ignored ? 0.4 : 1,
                                      background: line.isService ? 'rgba(255, 77, 79, 0.05)' : isCoated ? 'rgba(245, 158, 11, 0.02)' : 'transparent',
                                    }}
                                  >
                                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                                      {idx + 1}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.4rem', textAlign: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={line.ignored}
                                        onChange={(e) => updateBatchInvoiceLine(batch.id, idx, 'ignored', e.target.checked)}
                                      />
                                    </td>
                                    <td style={{ padding: '0.5rem 0.4rem' }}>
                                      <input
                                        type="text"
                                        value={line.itemCode}
                                        onChange={(e) => updateBatchInvoiceLine(batch.id, idx, 'itemCode', e.target.value)}
                                        style={{ background: '#101223', border: '1px solid var(--border)', color: '#00e0a1', padding: '0.35rem 0.45rem', borderRadius: '4px', width: '100%' }}
                                      />
                                    </td>
                                    <td style={{ padding: '0.5rem 0.4rem' }}>
                                      <input
                                        type="text"
                                        value={line.customerCode || ''}
                                        onChange={(e) => updateBatchInvoiceLine(batch.id, idx, 'customerCode', e.target.value)}
                                        style={{ background: '#101223', border: '1px solid var(--border)', color: '#8ab4ff', padding: '0.35rem 0.45rem', borderRadius: '4px', width: '100%' }}
                                      />
                                    </td>
                                    {batch.movementType === 'outbound' && (
                                      <td style={{ padding: '0.5rem 0.4rem', verticalAlign: 'top' }}>
                                        {(() => {
                                          const chk = checkStockAvailability(line, stock, aliasesMap)
                                          const isDelmarCovered = Boolean(line.delmarCovered)
                                          const isFullDelmar = isDelmarCovered && line.delmarMode === 'full'
                                          const isShortageDelmar = isDelmarCovered && line.delmarMode !== 'full'

                                          return (
                                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                              {/* Detailed Quantities Box */}
                                              <div style={{
                                                background: 'rgba(0,0,0,0.35)',
                                                border: `1px solid ${chk.status === 'shortage' && !isDelmarCovered ? 'rgba(255, 71, 87, 0.4)' : 'rgba(255,255,255,0.08)'}`,
                                                borderRadius: '6px',
                                                padding: '0.35rem 0.5rem',
                                                fontSize: '0.74rem',
                                                lineHeight: 1.4,
                                                width: '100%',
                                              }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#e2e8f0' }}>
                                                  <span>{isAr ? 'رصيد المستودع الحالي:' : 'Current Stock:'}</span>
                                                  <strong style={{ color: chk.availableBar > 0 ? '#00e0a1' : '#ff4757' }}>{chk.availableBar} عود</strong>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                                                  <span>{isAr ? 'المطلوب صرفه:' : 'Requested:'}</span>
                                                  <strong style={{ color: '#fff' }}>{chk.reqBar} عود</strong>
                                                </div>
                                                <div style={{
                                                  borderTop: '1px dashed rgba(255,255,255,0.1)',
                                                  marginTop: '0.25rem',
                                                  paddingTop: '0.25rem',
                                                  display: 'flex',
                                                  justifyContent: 'space-between',
                                                  fontWeight: 800,
                                                }}>
                                                  {isFullDelmar ? (
                                                    <>
                                                      <span style={{ color: '#00e0a1' }}>{isAr ? 'المتبقي بالمستودع:' : 'Remaining:'}</span>
                                                      <span style={{ color: '#00e0a1' }}>🟢 {chk.availableBar} عود (محفوظ لم يُمس)</span>
                                                    </>
                                                  ) : isShortageDelmar ? (
                                                    <>
                                                      <span style={{ color: '#00e0a1' }}>{isAr ? 'المتبقي بالمستودع:' : 'Remaining:'}</span>
                                                      <span style={{ color: '#00e0a1' }}>🟢 {chk.remainingAfter} عود (مغطى من دلمار)</span>
                                                    </>
                                                  ) : chk.status === 'sufficient' ? (
                                                    <>
                                                      <span style={{ color: '#00e0a1' }}>{isAr ? 'يتبقى بعد الصرف:' : 'Remaining:'}</span>
                                                      <span style={{ color: '#00e0a1' }}>🟢 {chk.remainingAfter} عود متبقي</span>
                                                    </>
                                                  ) : chk.status === 'shortage' ? (
                                                    <>
                                                      <span style={{ color: '#ff4757' }}>{isAr ? 'عجز بالمستودع:' : 'Shortage:'}</span>
                                                      <span style={{ color: '#ff4757' }}>🔴 {Math.abs(chk.diff)} عود (المتبقي: 0)</span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <span style={{ color: '#94a3b8' }}>{isAr ? 'المتبقي بالمستودع:' : 'Remaining:'}</span>
                                                      <span style={{ color: '#94a3b8' }}>⚪ غير مسجل (0)</span>
                                                    </>
                                                  )}
                                                </div>
                                              </div>

                                              {/* Alias Badge if Matched */}
                                              {chk.viaAlias && (
                                                <span
                                                  className="badge"
                                                  style={{
                                                    background: 'rgba(138, 180, 248, 0.18)',
                                                    color: '#8ab4ff',
                                                    border: '1px solid rgba(138, 180, 248, 0.35)',
                                                    fontSize: '0.67rem',
                                                    padding: '0.1rem 0.35rem',
                                                  }}
                                                  title={isAr ? `مطابق عبر الكود البديل: ${chk.matchedItem?.itemCode}` : `Matched via alias: ${chk.matchedItem?.itemCode}`}
                                                >
                                                  🔗 {isAr ? `بديل لـ (${chk.matchedItem?.itemCode})` : `Alias: ${chk.matchedItem?.itemCode}`}
                                                </span>
                                              )}

                                              {/* Missing Item: Search & Direct Code Input */}
                                              {chk.status === 'missing' && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100%' }}>
                                                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', width: '100%' }}>
                                                    <input
                                                      type="text"
                                                      placeholder={isAr ? 'اكتب كود الصنف بالمخزن (515756)...' : 'Type stock code...'}
                                                      value={line.manualTargetCode || ''}
                                                      onChange={(e) => updateBatchInvoiceLine(batch.id, idx, 'manualTargetCode', e.target.value)}
                                                      onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                          handleManualLinkByCode(batch.id, idx, line.itemCode, line.manualTargetCode)
                                                        }
                                                      }}
                                                      style={{
                                                        background: '#0d1117',
                                                        border: '1px solid #3b82f6',
                                                        borderRadius: '4px',
                                                        color: '#fff',
                                                        fontSize: '0.72rem',
                                                        padding: '0.2rem 0.4rem',
                                                        flex: '1 1 auto',
                                                        minWidth: '100px',
                                                      }}
                                                    />
                                                    <button
                                                      type="button"
                                                      onClick={() => handleManualLinkByCode(batch.id, idx, line.itemCode, line.manualTargetCode)}
                                                      style={{
                                                        background: '#2563eb',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        fontSize: '0.7rem',
                                                        fontWeight: 800,
                                                        padding: '0.2rem 0.45rem',
                                                        cursor: 'pointer',
                                                        whiteSpace: 'nowrap',
                                                      }}
                                                      title={isAr ? 'ربط هذا الكود بالصنف في المخزن وحفظه دائماً' : 'Link code'}
                                                    >
                                                      🔗 {isAr ? 'ربط' : 'Link'}
                                                    </button>
                                                  </div>

                                                  {/* Fuzzy Suggestion */}
                                                  {(() => {
                                                    const fuzzy = findSmartFuzzyMatch(line, stock, aliasesMap)
                                                    if (!fuzzy || line.rejectedSuggestion) return null
                                                    return (
                                                      <div
                                                        style={{
                                                          background: 'rgba(96, 165, 250, 0.1)',
                                                          border: '1px solid rgba(96, 165, 250, 0.3)',
                                                          borderRadius: '6px',
                                                          padding: '0.3rem 0.45rem',
                                                          display: 'flex',
                                                          flexDirection: 'column',
                                                          gap: '0.2rem',
                                                          width: '100%',
                                                        }}
                                                      >
                                                        <div style={{ fontSize: '0.67rem', color: '#93c5fd', lineHeight: 1.25 }}>
                                                          💡 {isAr ? 'اقتراح ذكي:' : 'Smart Match:'} هل تقصد <strong>{fuzzy.item.itemCode}</strong>؟
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                                          <button
                                                            type="button"
                                                            onClick={() => handleQuickLinkAlias(batch.id, idx, line.itemCode, fuzzy.item)}
                                                            style={{
                                                              background: '#00e0a1',
                                                              color: '#000',
                                                              border: 'none',
                                                              borderRadius: '4px',
                                                              fontSize: '0.66rem',
                                                              fontWeight: 800,
                                                              padding: '0.15rem 0.4rem',
                                                              cursor: 'pointer',
                                                            }}
                                                          >
                                                            ✅ {isAr ? 'اعتماد' : 'Apply'}
                                                          </button>
                                                          <button
                                                            type="button"
                                                            onClick={() => handleRejectSuggestion(batch.id, idx)}
                                                            style={{
                                                              background: 'rgba(255, 71, 87, 0.15)',
                                                              color: '#ff4757',
                                                              border: '1px solid rgba(255, 71, 87, 0.3)',
                                                              borderRadius: '4px',
                                                              fontSize: '0.66rem',
                                                              fontWeight: 700,
                                                              padding: '0.15rem 0.4rem',
                                                              cursor: 'pointer',
                                                            }}
                                                          >
                                                            ❌ {isAr ? 'رفض' : 'Reject'}
                                                          </button>
                                                        </div>
                                                      </div>
                                                    )
                                                  })()}
                                                </div>
                                              )}
                                            </div>
                                          )
                                        })()}
                                      </td>
                                    )}

                                    {/* ─── COLUMN 2: DELMAR WAREHOUSE & COVERAGE ─── */}
                                    {batch.movementType === 'outbound' && (
                                      <td style={{ padding: '0.5rem 0.4rem', verticalAlign: 'top' }}>
                                        {(() => {
                                          const chk = checkStockAvailability(line, stock, aliasesMap)
                                          const isDelmarCovered = Boolean(line.delmarCovered)
                                          const isFullDelmar = isDelmarCovered && line.delmarMode === 'full'
                                          const isShortageDelmar = isDelmarCovered && line.delmarMode !== 'full'
                                          const hasShortage = chk.diff < 0

                                          if (isFullDelmar) {
                                            return (
                                              <div style={{
                                                background: 'rgba(0, 224, 161, 0.12)',
                                                border: '1px solid #00e0a1',
                                                borderRadius: '8px',
                                                padding: '0.4rem 0.55rem',
                                                fontSize: '0.73rem',
                                                lineHeight: 1.35,
                                                width: '100%',
                                              }}>
                                                <div style={{ fontWeight: 800, color: '#00e0a1', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                  <span>🏭</span>
                                                  <span>{isAr ? `صرف من دلمار بالكامل (${chk.reqBar} عود)` : `Full Delmar (${chk.reqBar})`}</span>
                                                </div>
                                                <div style={{ fontSize: '0.67rem', color: '#e2e8f0', marginTop: '0.2rem' }}>
                                                  {isAr ? `✅ رصيد المستودع محفوظ (${chk.availableBar} عود لم يُمس)` : `Warehouse preserved (${chk.availableBar} bars)`}
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => handleSetDelmarMode(batch.id, idx, null)}
                                                  style={{
                                                    marginTop: '0.3rem',
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#ff6b81',
                                                    fontSize: '0.67rem',
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline',
                                                    padding: 0,
                                                  }}
                                                >
                                                  {isAr ? '❌ إلغاء الصرف من دلمار' : 'Undo Delmar'}
                                                </button>
                                              </div>
                                            )
                                          }

                                          if (isShortageDelmar) {
                                            return (
                                              <div style={{
                                                background: 'rgba(59, 130, 246, 0.12)',
                                                border: '1px solid #3b82f6',
                                                borderRadius: '8px',
                                                padding: '0.4rem 0.55rem',
                                                fontSize: '0.73rem',
                                                lineHeight: 1.35,
                                                width: '100%',
                                              }}>
                                                <div style={{ fontWeight: 800, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                  <span>🏭</span>
                                                  <span>{isAr ? `تغطية العجز من دلمار (${chk.delmarShortage} عود)` : `Shortage covered (${chk.delmarShortage})`}</span>
                                                </div>
                                                <div style={{ fontSize: '0.67rem', color: '#e2e8f0', marginTop: '0.2rem' }}>
                                                  {isAr ? `✅ سيتم صرف (${chk.warehouseDispatched} عود) من المستودع` : `Dispatching ${chk.warehouseDispatched} from wh`}
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => handleSetDelmarMode(batch.id, idx, null)}
                                                  style={{
                                                    marginTop: '0.3rem',
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#ff6b81',
                                                    fontSize: '0.67rem',
                                                    cursor: 'pointer',
                                                    textDecoration: 'underline',
                                                    padding: 0,
                                                  }}
                                                >
                                                  {isAr ? '❌ إلغاء التغطية' : 'Undo Delmar'}
                                                </button>
                                              </div>
                                            )
                                          }

                                          // Not Covered State: Two clear buttons
                                          return (
                                            <div style={{
                                              background: 'rgba(245, 158, 11, 0.06)',
                                              border: '1px solid rgba(245, 158, 11, 0.25)',
                                              borderRadius: '8px',
                                              padding: '0.4rem 0.55rem',
                                              fontSize: '0.73rem',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              gap: '0.3rem',
                                              width: '100%',
                                            }}>
                                              <div style={{ color: '#fbbf24', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                                <span>🏭</span>
                                                <span>{isAr ? 'مخزن دلمار (بتدهن / تشغيل)' : 'Delmar Warehouse'}</span>
                                              </div>

                                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => handleSetDelmarMode(batch.id, idx, 'full')}
                                                  style={{
                                                    background: 'rgba(0, 224, 161, 0.15)',
                                                    color: '#00e0a1',
                                                    border: '1px solid rgba(0, 224, 161, 0.4)',
                                                    borderRadius: '5px',
                                                    fontSize: '0.68rem',
                                                    fontWeight: 800,
                                                    padding: '0.25rem 0.4rem',
                                                    cursor: 'pointer',
                                                    textAlign: isAr ? 'right' : 'left',
                                                  }}
                                                  title={isAr ? 'صرف هذا البند بالكامل من مخزن دلمار لحفظ رصيد المستودع' : 'Full dispatch from Delmar'}
                                                >
                                                  ✅ {isAr ? `صرف من دلمار بالكامل (${chk.reqBar} عود)` : `Full Delmar (${chk.reqBar} b)`}
                                                </button>

                                                {hasShortage && (
                                                  <button
                                                    type="button"
                                                    onClick={() => handleSetDelmarMode(batch.id, idx, 'shortage')}
                                                    style={{
                                                      background: 'rgba(245, 158, 11, 0.15)',
                                                      color: '#fbbf24',
                                                      border: '1px solid rgba(245, 158, 11, 0.4)',
                                                      borderRadius: '5px',
                                                      fontSize: '0.68rem',
                                                      fontWeight: 800,
                                                      padding: '0.25rem 0.4rem',
                                                      cursor: 'pointer',
                                                      textAlign: isAr ? 'right' : 'left',
                                                    }}
                                                    title={isAr ? `صرف ${chk.availableBar} من المستودع وتغطية العجز (${Math.abs(chk.diff)} عود) من دلمار` : 'Cover shortage only'}
                                                  >
                                                    ⚖️ {isAr ? `تغطية العجز فقط (${Math.abs(chk.diff)} عود)` : `Cover short (${Math.abs(chk.diff)} b)`}
                                                  </button>
                                                )}
                                              </div>
                                            </div>
                                          )
                                        })()}
                                      </td>
                                    )}

                                    {/* Description */}
                                    <td style={{ padding: '0.5rem 0.4rem' }}>
                                      <textarea
                                        value={line.description}
                                        rows={Math.max(1, Math.ceil(String(line.description || '').length / 65))}
                                        onChange={(e) => updateBatchInvoiceLine(batch.id, idx, 'description', e.target.value)}
                                        style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.35rem 0.45rem', borderRadius: '4px', width: '100%', resize: 'vertical', lineHeight: 1.35 }}
                                      />
                                    </td>

                                    {/* Bars (الأعواد) - Right After Description! */}
                                    <td style={{ padding: '0.5rem 0.4rem' }}>
                                      <input
                                        type="number"
                                        value={line.quantityBar}
                                        onChange={(e) => updateBatchInvoiceLine(batch.id, idx, 'quantityBar', e.target.value)}
                                        style={{ background: '#101223', border: '1px solid #00e0a1', color: '#00e0a1', padding: '0.35rem 0.45rem', borderRadius: '4px', width: '100%', fontWeight: 800, fontSize: '0.95rem' }}
                                      />
                                    </td>

                                    {/* Finish */}
                                    <td style={{ padding: '0.5rem 0.4rem' }}>
                                      <input
                                        type="text"
                                        value={line.finish}
                                        onChange={(e) => updateBatchInvoiceLine(batch.id, idx, 'finish', e.target.value)}
                                        style={{ background: '#101223', border: '1px solid var(--border)', color: '#FFD700', padding: '0.35rem 0.45rem', borderRadius: '4px', width: '100%' }}
                                      />
                                    </td>

                                    {/* Length mm */}
                                    <td style={{ padding: '0.5rem 0.4rem' }}>
                                      <input type="number" value={line.lengthMm} onChange={(e) => updateBatchInvoiceLine(batch.id, idx, 'lengthMm', e.target.value)} style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.35rem 0.45rem', borderRadius: '4px', width: '100%' }} />
                                    </td>

                                    {/* Total LM */}
                                    <td style={{ padding: '0.5rem 0.4rem' }}>
                                      <input type="number" step="0.001" value={line.quantityLm} onChange={(e) => updateBatchInvoiceLine(batch.id, idx, 'quantityLm', e.target.value)} style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.35rem 0.45rem', borderRadius: '4px', width: '100%', fontWeight: 700 }} />
                                    </td>

                                    {/* Total KG */}
                                    <td style={{ padding: '0.5rem 0.4rem' }}>
                                      <input type="number" step="0.001" value={line.quantityKg} onChange={(e) => updateBatchInvoiceLine(batch.id, idx, 'quantityKg', e.target.value)} style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.35rem 0.45rem', borderRadius: '4px', width: '100%' }} />
                                    </td>

                                    {/* Unit Price */}
                                    <td style={{ padding: '0.5rem 0.4rem' }}>
                                      <input type="number" step="0.0001" value={line.unitPrice} onChange={(e) => updateBatchInvoiceLine(batch.id, idx, 'unitPrice', e.target.value)} style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.35rem 0.45rem', borderRadius: '4px', width: '100%' }} />
                                    </td>

                                    {/* Bar Price */}
                                    <td style={{ padding: '0.5rem 0.4rem' }}>
                                      <input type="number" step="0.0001" value={line.barPrice || ''} onChange={(e) => updateBatchInvoiceLine(batch.id, idx, 'barPrice', e.target.value)} style={{ background: '#101223', border: '1px solid var(--border)', color: '#fff', padding: '0.35rem 0.45rem', borderRadius: '4px', width: '100%' }} />
                                    </td>

                                    {/* Total */}
                                    <td style={{ padding: '0.5rem 0.4rem', fontWeight: 700, color: '#64b5f6', whiteSpace: 'nowrap' }}>
                                      {Number(line.netTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                )
                              })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: Dispatches & Lifecycle Tracker ─── */}
      {activeTab === 'dispatches' && (
        <DispatchesTrackerView
          projectId={selectedProjectId}
          projectName={selectedProject?.name}
          isAdmin={isAdmin}
          isAr={isAr}
          onOpenManualModal={handleOpenManualModal}
        />
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

      {/* ─── TAB 5: Audit Log Trail (Admin Only) ─── */}
      {activeTab === 'audit' && isAdmin && (
        <div className="card fade-in" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🛡️ {isAr ? 'سجل التدقيق والتغييرات (Audit Trail Logs)' : 'System Audit Trail Logs'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {isAr
                  ? 'تسجيل تفصيلي لكافة التعديلات والإضافات والخصومات (المستخدم، نوع وتاريخ الحركة، والتغيرات)'
                  : 'Detailed tracking of all modifications, additions, and deductions (who, what, when)'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder={isAr ? 'بحث في السجل...' : 'Search audit log...'}
                value={auditSearchQuery}
                onChange={(e) => setAuditSearchQuery(e.target.value)}
                style={{
                  background: '#101223',
                  color: '#fff',
                  border: '1px solid var(--border)',
                  padding: '0.5rem 0.9rem',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  width: '240px',
                }}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => loadAuditLogs(selectedProjectId)}
                disabled={loadingAuditLogs}
              >
                🔄 {isAr ? 'تحديث' : 'Refresh'}
              </button>
            </div>
          </div>

          {loadingAuditLogs ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}><span className="spinner"></span></div>
          ) : auditLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              {isAr ? 'لا توجد سجلات تدقيق حتى الآن لهذا المشروع' : 'No audit records found for this project'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', color: '#8ab4ff' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'التاريخ والوقت' : 'Timestamp'}</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'المستخدم' : 'User'}</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'نوع العملية' : 'Action'}</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: isAr ? 'right' : 'left' }}>{isAr ? 'تفاصيل الحركة والتغييرات' : 'Details & Changes'}</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs
                    .filter((log) => {
                      if (!auditSearchQuery.trim()) return true
                      const q = auditSearchQuery.toLowerCase()
                      const txt = `${log.userName} ${log.userEmail} ${log.action} ${JSON.stringify(log.details)}`.toLowerCase()
                      return txt.includes(q)
                    })
                    .map((log) => {
                      let actionBadge = null
                      switch (log.action) {
                        case 'PROCESS_INVOICE':
                          actionBadge = (
                            <span className="badge" style={{ background: 'rgba(0, 224, 161, 0.15)', color: '#00e0a1', border: '1px solid rgba(0, 224, 161, 0.3)' }}>
                              🧾 {log.details?.movementType === 'outbound' ? (isAr ? 'فاتورة خصم' : 'Outbound Invoice') : (isAr ? 'فاتورة إضافة' : 'Inbound Invoice')}
                            </span>
                          )
                          break
                        case 'UPDATE_INVOICE_META':
                          actionBadge = (
                            <span className="badge" style={{ background: 'rgba(255, 183, 77, 0.15)', color: '#ffb74d', border: '1px solid rgba(255, 183, 77, 0.3)' }}>
                              ✏️ {isAr ? 'تعديل بيانات فاتورة' : 'Edit Invoice Meta'}
                            </span>
                          )
                          break
                        case 'EDIT_STOCK_ITEM':
                          actionBadge = (
                            <span className="badge" style={{ background: 'rgba(100, 181, 246, 0.15)', color: '#64b5f6', border: '1px solid rgba(100, 181, 246, 0.3)' }}>
                              ⚙️ {isAr ? 'تعديل صنف بالمخزن' : 'Edit Stock Item'}
                            </span>
                          )
                          break
                        case 'DELETE_STOCK_ITEM':
                          actionBadge = (
                            <span className="badge" style={{ background: 'rgba(255, 77, 79, 0.15)', color: '#ff4d4f', border: '1px solid rgba(255, 77, 79, 0.3)' }}>
                              🗑️ {isAr ? 'حذف صنف من المخزن' : 'Delete Stock Item'}
                            </span>
                          )
                          break
                        default:
                          actionBadge = <span className="badge">{log.action}</span>
                      }

                      return (
                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            {log.timestamp ? new Date(log.timestamp).toLocaleString(isAr ? 'ar-EG' : 'en-US') : '—'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 700, color: '#ffffff' }}>{log.userName || 'Unknown User'}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{log.userEmail}</div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{actionBadge}</td>
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.85rem' }}>
                            {log.action === 'PROCESS_INVOICE' && (
                              <div>
                                <span>{isAr ? 'الفاتورة:' : 'Invoice:'} <strong>{log.details?.invoiceNumber}</strong></span>
                                {log.details?.salesOrder && <span style={{ marginRight: '10px', marginLeft: '10px', color: '#00e0a1' }}>SO: {log.details.salesOrder}</span>}
                                {log.details?.customerReference && <span style={{ color: '#ffb74d' }}>Ref: {log.details.customerReference}</span>}
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  {isAr ? `عدد البنود: ${log.details?.movementsCount || 0}` : `Items count: ${log.details?.movementsCount || 0}`}
                                  {log.details?.isDuplicate && <span style={{ color: '#ffb74d', marginLeft: '8px', marginRight: '8px' }}>(تحديث فاتورة سابقة)</span>}
                                </div>
                              </div>
                            )}

                            {log.action === 'UPDATE_INVOICE_META' && (
                              <div>
                                <div>{isAr ? 'الفاتورة:' : 'Invoice:'} <strong>{log.details?.invoiceNumber}</strong></div>
                                {log.details?.oldMeta && log.details?.newMeta && (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {log.details.oldMeta.salesOrder !== log.details.newMeta.salesOrder && (
                                      <div>SO: <span style={{ textDecoration: 'line-through' }}>{log.details.oldMeta.salesOrder || '—'}</span> ➔ <strong style={{ color: '#00e0a1' }}>{log.details.newMeta.salesOrder}</strong></div>
                                    )}
                                    {log.details.oldMeta.customerReference !== log.details.newMeta.customerReference && (
                                      <div>Customer Ref: <span style={{ textDecoration: 'line-through' }}>{log.details.oldMeta.customerReference || '—'}</span> ➔ <strong style={{ color: '#ffb74d' }}>{log.details.newMeta.customerReference}</strong></div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {log.action === 'EDIT_STOCK_ITEM' && (
                              <div>
                                <div>{isAr ? 'كود الصنف:' : 'Item Code:'} <strong>{log.details?.itemCode}</strong></div>
                                {log.details?.changes && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {Object.entries(log.details.changes).map(([k, v]) => (
                                      <span key={k} style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                                        {k}: <span style={{ textDecoration: 'line-through' }}>{String(v.old ?? '—')}</span> ➔ <strong style={{ color: '#00e0a1' }}>{String(v.new ?? '—')}</strong>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {log.action === 'DELETE_STOCK_ITEM' && (
                              <div>
                                <div>{isAr ? 'كود الصنف المحذوف:' : 'Deleted Item Code:'} <strong style={{ color: '#ff4d4f' }}>{log.details?.itemCode}</strong></div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{log.details?.description}</div>
                              </div>
                            )}
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

      {/* ─── TAB 4: Project Settings & Management ─── */}
      {activeTab === 'projects' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Projects Overview List */}
          <div className="card glassmorphism" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📁 {isAr ? 'إدارة مشاريع المخازن' : 'Warehouse Projects Management'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                  {isAr
                    ? 'عرض المشاريع الحالية وإدارتها أو حذف المشروع بالكامل مع كافة أصنافه وسجلاته (متاح للمديرين فقط)'
                    : 'Manage existing warehouse projects or delete complete project data (Admin only)'}
                </p>
              </div>
              <button
                className="btn"
                onClick={loadProjects}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  borderRadius: '8px',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                🔄 {isAr ? 'تحديث المشاريع' : 'Refresh Projects'}
              </button>
            </div>

            <div className="table-responsive">
              <table className="stock-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'center', width: '50px' }}>#</th>
                    <th>{isAr ? 'اسم المشروع' : 'Project Name'}</th>
                    <th>{isAr ? 'الكود (Code)' : 'Code'}</th>
                    <th>{isAr ? 'الوصف' : 'Description'}</th>
                    <th style={{ textAlign: 'center' }}>{isAr ? 'الحالة والنشاط' : 'Status'}</th>
                    <th style={{ textAlign: 'center', width: '180px' }}>{isAr ? 'التحكم والحذف' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((proj, idx) => {
                    const isSelected = selectedProjectId === proj.id
                    const isDeleting = deletingProjectId === proj.id
                    return (
                      <tr key={proj.id} style={{ background: isSelected ? 'rgba(0, 224, 161, 0.06)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ fontWeight: 700, color: '#ffffff' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>{proj.name}</span>
                            {isSelected && (
                              <span className="badge" style={{ background: 'rgba(0, 224, 161, 0.2)', color: '#00e0a1', border: '1px solid #00e0a1', fontSize: '0.75rem' }}>
                                {isAr ? 'المحدد حالياً' : 'Active'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="badge" style={{ background: 'rgba(138, 180, 255, 0.15)', color: '#8ab4ff' }}>
                            {proj.code || 'MAIN'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{proj.description || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="badge" style={{ background: 'rgba(76, 217, 100, 0.15)', color: '#4cd964' }}>
                            {isAr ? 'نشط' : 'Active'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap' }}>
                            {!isSelected && (
                              <button
                                className="btn btn-secondary"
                                onClick={() => setSelectedProjectId(proj.id)}
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', whiteSpace: 'nowrap', borderRadius: '6px' }}
                              >
                                {isAr ? 'اختيار' : 'Select'}
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                className="btn"
                                onClick={() => handleDeleteProject(proj)}
                                disabled={isDeleting || projects.length <= 1}
                                style={{
                                  padding: '0.35rem 0.65rem',
                                  fontSize: '0.78rem',
                                  whiteSpace: 'nowrap',
                                  borderRadius: '6px',
                                  background: projects.length <= 1 ? 'rgba(255,255,255,0.04)' : 'rgba(255, 71, 87, 0.15)',
                                  color: projects.length <= 1 ? 'var(--text-muted)' : '#ff4757',
                                  border: projects.length <= 1 ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255, 71, 87, 0.35)',
                                  cursor: projects.length <= 1 ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  fontWeight: 600,
                                }}
                                title={projects.length <= 1 ? (isAr ? 'لا يمكن حذف المشروع الوحيد' : 'Cannot delete sole project') : (isAr ? 'حذف المشروع بالكامل' : 'Delete Project')}
                              >
                                {isDeleting ? <span className="spinner"></span> : isAr ? '🗑️ حذف' : '🗑️ Delete'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Warehouse Access & Permissions Management Section ─── */}
          {isAdmin && (
            <div className="card glassmorphism fade-in" style={{ padding: '1.5rem', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    ⚙️ {isAr ? 'إدارة صلاحيات الوصول للمخزن' : 'Warehouse Access & Project Permissions'}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
                    {isAr
                      ? 'تحديد المستخدمين المصرح لهم بالدخول للمخزن، واختيار المشاريع المسموح بها وتخصيص صلاحيات التعديل والحذف والتوريد'
                      : 'Control which users can access the warehouse, assign specific allowed projects, and grant fine-grained permissions'}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {/* Search Input Box */}
                  <div style={{ minWidth: '240px' }}>
                    <input
                      type="text"
                      placeholder={isAr ? '🔍 بحث بالإيميل أو الاسم...' : '🔍 Search user by email or name...'}
                      value={permissionsSearchQuery}
                      onChange={(e) => setPermissionsSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#101223',
                        color: '#ffffff',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '0.45rem 0.85rem',
                        fontSize: '0.82rem',
                      }}
                    />
                  </div>

                  <button
                    className="btn"
                    onClick={loadWarehouseUsers}
                    disabled={loadingPermissionsList}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#ffffff',
                      borderRadius: '8px',
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    {loadingPermissionsList ? <span className="spinner"></span> : '🔄 ' + (isAr ? 'تحديث الصلاحيات' : 'Refresh Permissions')}
                  </button>
                </div>
              </div>

              {loadingPermissionsList ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <span className="spinner" style={{ width: '24px', height: '24px', marginBottom: '0.5rem' }}></span>
                  <div>{isAr ? 'جاري تحميل قائمة المستخدمين والصلاحيات...' : 'Loading users & permissions...'}</div>
                </div>
              ) : sortedAndFilteredWarehouseUsers.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
                  {isAr ? 'لا يوجد مستخدمون مطابقون للبحث' : 'No matching users found.'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {sortedAndFilteredWarehouseUsers.map((usr) => {
                    const SUPER_ADMIN_EMAIL = 'gemy.essam.ge@gmail.com'
                    const isFounderSuperAdmin = (usr.email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
                    const isUserAdmin = usr.role === 'admin' || usr.warehouseRole === 'admin'
                    const isSaving = updatingUserUid === usr.uid
                    const isExpanded = expandedUserUid === usr.uid

                    return (
                      <div
                        key={usr.uid}
                        style={{
                          background: isFounderSuperAdmin
                            ? 'rgba(255, 71, 87, 0.05)'
                            : usr.warehouseEnabled ? 'rgba(0, 224, 161, 0.03)' : 'rgba(0, 0, 0, 0.25)',
                          border: isExpanded
                            ? '1px solid var(--accent)'
                            : isFounderSuperAdmin
                            ? '1px solid rgba(255, 71, 87, 0.4)'
                            : usr.warehouseEnabled ? '1px solid rgba(0, 224, 161, 0.2)' : '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {/* Compact Header Bar */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.85rem 1.1rem',
                            cursor: 'pointer',
                            userSelect: 'none',
                          }}
                          onClick={() => setExpandedUserUid(isExpanded ? null : usr.uid)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: isFounderSuperAdmin ? 'rgba(255, 71, 87, 0.2)' : usr.warehouseEnabled ? 'rgba(0, 224, 161, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                              color: isFounderSuperAdmin ? '#ff4757' : usr.warehouseEnabled ? '#00e0a1' : 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justify: 'center',
                              fontWeight: 800,
                              fontSize: '1rem'
                            }}>
                              {(usr.displayName || usr.email || 'U').charAt(0).toUpperCase()}
                            </div>

                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span>{usr.displayName || usr.email}</span>
                                {isFounderSuperAdmin ? (
                                  <span className="badge" style={{ background: 'rgba(255, 71, 87, 0.2)', color: '#ff4757', border: '1px solid rgba(255, 71, 87, 0.4)', fontSize: '0.72rem', fontWeight: 800 }}>
                                    ⚡ {isAr ? 'العملاق المؤسس (Super Admin)' : 'Super Admin'}
                                  </span>
                                ) : isUserAdmin ? (
                                  <span className="badge" style={{ background: 'rgba(255, 183, 77, 0.2)', color: '#ffb74d', border: '1px solid rgba(255, 183, 77, 0.4)', fontSize: '0.72rem' }}>
                                    👑 {isAr ? 'مدير مخزن' : 'Warehouse Admin'}
                                  </span>
                                ) : usr.warehouseEnabled ? (
                                  <span className="badge badge-valid" style={{ fontSize: '0.72rem' }}>
                                    ✅ {isAr ? 'مُصرّح له' : 'Access Granted'}
                                  </span>
                                ) : (
                                  <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                                    🚫 {isAr ? 'معطّل' : 'Disabled'}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{usr.email}</div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }} onClick={(e) => e.stopPropagation()}>
                            {/* Fast Access Checkbox (Auto-Saved) */}
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: (isFounderSuperAdmin || updatingUserUid === usr.uid) ? 'not-allowed' : 'pointer', fontSize: '0.82rem', fontWeight: 600, color: usr.warehouseEnabled ? '#00e0a1' : 'var(--text-muted)' }}>
                              <input
                                type="checkbox"
                                checked={Boolean(usr.warehouseEnabled)}
                                disabled={isFounderSuperAdmin || updatingUserUid === usr.uid}
                                onChange={(e) => {
                                  handleQuickToggleAccess(usr, e.target.checked)
                                }}
                                style={{ width: '16px', height: '16px', accentColor: '#00e0a1', cursor: (isFounderSuperAdmin || updatingUserUid === usr.uid) ? 'not-allowed' : 'pointer' }}
                              />
                              <span style={{ display: 'inline-block' }}>
                                {updatingUserUid === usr.uid ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'السماح بالوصول' : 'Allow Access')}
                              </span>
                            </label>

                            {/* Expand Permissions Toggle Button */}
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setExpandedUserUid(isExpanded ? null : usr.uid)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                fontSize: '0.78rem',
                                padding: '0.35rem 0.65rem',
                                background: isExpanded ? 'rgba(0, 224, 161, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                color: isExpanded ? '#00e0a1' : '#ffffff',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '6px',
                              }}
                            >
                              <span>⚙️ {isAr ? 'الصلاحيات' : 'Permissions'}</span>
                              <span style={{ fontSize: '0.7rem' }}>{isExpanded ? '▲' : '▼'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Permissions Detail Panel */}
                        {isExpanded && (
                          <div style={{
                            padding: '1.1rem 1.25rem',
                            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                            background: 'rgba(0, 0, 0, 0.2)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>{isAr ? 'دور المستخدم في المخزن:' : 'Warehouse Role:'}</span>
                                <select
                                  value={usr.warehouseRole || 'warehouse_operator'}
                                  disabled={!usr.warehouseEnabled || isFounderSuperAdmin}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setUsersList(prev => prev.map(u => {
                                      if (u.uid === usr.uid) {
                                        if (val === 'admin') {
                                          return { ...u, warehouseRole: val, canDelete: true, canEdit: true, canUpload: true, allowedProjects: ['*'] }
                                        }
                                        return { ...u, warehouseRole: val }
                                      }
                                      return u
                                    }))
                                  }}
                                  style={{
                                    background: '#101223',
                                    color: '#ffffff',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    padding: '0.35rem 0.65rem',
                                    fontSize: '0.82rem',
                                    opacity: (!usr.warehouseEnabled || isFounderSuperAdmin) ? 0.7 : 1,
                                    cursor: (!usr.warehouseEnabled || isFounderSuperAdmin) ? 'not-allowed' : 'pointer',
                                  }}
                                >
                                  <option value="warehouse_operator">{isAr ? '👷 مشغّل مخزن (كامل العمليات)' : 'Warehouse Operator'}</option>
                                  <option value="warehouse_viewer">{isAr ? '👁️ مستعرض (قراءة فقط)' : 'Warehouse Viewer (Read Only)'}</option>
                                  <option value="admin">{isAr ? '👑 مدير مخزن (Admin)' : 'Warehouse Admin'}</option>
                                </select>
                              </div>
                            </div>

                            {usr.warehouseEnabled && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', alignItems: 'start' }}>
                                {/* Allowed Projects Selection */}
                                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.6rem', color: '#8ab4ff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    📂 {isAr ? 'المشاريع المسموح بالوصول إليها:' : 'Allowed Projects Scope:'}
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: isFounderSuperAdmin ? 'not-allowed' : 'pointer', color: (usr.allowedProjects || []).includes('*') ? '#00e0a1' : '#fff' }}>
                                      <input
                                        type="checkbox"
                                        checked={(usr.allowedProjects || ['*']).includes('*')}
                                        disabled={isFounderSuperAdmin}
                                        onChange={(e) => {
                                          const isChecked = e.target.checked
                                          setUsersList(prev => prev.map(u => {
                                            if (u.uid === usr.uid) {
                                              return { ...u, allowedProjects: isChecked ? ['*'] : [] }
                                            }
                                            return u
                                          }))
                                        }}
                                        style={{ accentColor: '#00e0a1' }}
                                      />
                                      <strong>🌐 {isAr ? 'جميع المشاريع (All Projects)' : 'All Projects'}</strong>
                                    </label>

                                    {!(usr.allowedProjects || ['*']).includes('*') && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginRight: '1rem', marginTop: '0.3rem' }}>
                                        {projects.map((p) => {
                                          const isProjChecked = (usr.allowedProjects || []).includes(p.id)
                                          return (
                                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', cursor: isFounderSuperAdmin ? 'not-allowed' : 'pointer' }}>
                                              <input
                                                type="checkbox"
                                                checked={isProjChecked}
                                                disabled={isFounderSuperAdmin}
                                                onChange={(e) => {
                                                  const checked = e.target.checked
                                                  setUsersList(prev => prev.map(u => {
                                                    if (u.uid === usr.uid) {
                                                      const current = (u.allowedProjects || []).filter(x => x !== '*')
                                                      const updated = checked ? [...current, p.id] : current.filter(x => x !== p.id)
                                                      return { ...u, allowedProjects: updated.length === 0 ? ['*'] : updated }
                                                    }
                                                    return u
                                                  }))
                                                }}
                                                style={{ accentColor: '#00e0a1' }}
                                              />
                                              {p.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({p.code || 'CODE'})</span>
                                            </label>
                                          )
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Granular Action Rights */}
                                <div style={{ background: 'rgba(0,0,0,0.25)', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.6rem', color: '#ffb74d', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    🛡️ {isAr ? 'الأذونات والتحكم التفصيلي:' : 'Action Permissions & Restrictions:'}
                                  </div>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: isFounderSuperAdmin ? 'not-allowed' : 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={usr.canDelete ?? true}
                                        disabled={isFounderSuperAdmin}
                                        onChange={(e) => {
                                          const val = e.target.checked
                                          setUsersList(prev => prev.map(u => u.uid === usr.uid ? { ...u, canDelete: val } : u))
                                        }}
                                        style={{ accentColor: '#ff4757' }}
                                      />
                                      <span>🗑️ {isAr ? 'صلاحية حذف الأصناف والفواتير (Can Delete)' : 'Can Delete Items & Invoices'}</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: isFounderSuperAdmin ? 'not-allowed' : 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={usr.canEdit ?? true}
                                        disabled={isFounderSuperAdmin}
                                        onChange={(e) => {
                                          const val = e.target.checked
                                          setUsersList(prev => prev.map(u => u.uid === usr.uid ? { ...u, canEdit: val } : u))
                                        }}
                                        style={{ accentColor: '#00e0a1' }}
                                      />
                                      <span>✏️ {isAr ? 'صلاحية تعديل الكميات والبيانات (Can Edit)' : 'Can Edit Quantities & Metadata'}</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: isFounderSuperAdmin ? 'not-allowed' : 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={usr.canUpload ?? true}
                                        disabled={isFounderSuperAdmin}
                                        onChange={(e) => {
                                          const val = e.target.checked
                                          setUsersList(prev => prev.map(u => u.uid === usr.uid ? { ...u, canUpload: val } : u))
                                        }}
                                        style={{ accentColor: '#8ab4ff' }}
                                      />
                                      <span>📥 {isAr ? 'صلاحية رفع واعتماد الفواتير (Can Upload/Process)' : 'Can Process Invoices'}</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: isFounderSuperAdmin ? 'not-allowed' : 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={usr.canManual ?? true}
                                        disabled={isFounderSuperAdmin}
                                        onChange={(e) => {
                                          const val = e.target.checked
                                          setUsersList(prev => prev.map(u => u.uid === usr.uid ? { ...u, canManual: val } : u))
                                        }}
                                        style={{ accentColor: '#00e0a1' }}
                                      />
                                      <span>📦 {isAr ? 'صلاحية التوريد والصرف اليدوي (Can Manual Movement)' : 'Can Manual Movement'}</span>
                                    </label>

                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', cursor: isFounderSuperAdmin ? 'not-allowed' : 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={usr.canDispatch ?? true}
                                        disabled={isFounderSuperAdmin}
                                        onChange={(e) => {
                                          const val = e.target.checked
                                          setUsersList(prev => prev.map(u => u.uid === usr.uid ? { ...u, canDispatch: val } : u))
                                        }}
                                        style={{ accentColor: '#ff4757' }}
                                      />
                                      <span>🚚 {isAr ? 'صلاحية صرف وتتبع مراحل القطاعات (Can Dispatch & Track)' : 'Can Dispatch & Track'}</span>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Save Action Bar */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                              <button
                                className="btn btn-primary"
                                onClick={() => handleSaveUserPermissions(usr)}
                                disabled={isSaving || isFounderSuperAdmin}
                                style={{
                                  padding: '0.4rem 1rem',
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  borderRadius: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  opacity: isFounderSuperAdmin ? 0.6 : 1,
                                  cursor: isFounderSuperAdmin ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {isSaving ? <span className="spinner"></span> : '💾 ' + (isAr ? 'حفظ الصلاحيات' : 'Save Permissions')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Create New Project Form */}
          <div className="card glassmorphism" style={{ padding: '1.5rem', maxWidth: '650px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#00e0a1' }}>
              ➕ {isAr ? 'إضافة مشروع مخزن جديد' : 'Create New Warehouse Project'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {isAr ? 'أدخل تفاصيل المشروع الجديد لبدء تسجيل أرصدة وفواتير منفصلة له' : 'Enter new project details to maintain segregated inventory stock'}
            </p>

            <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>{isAr ? 'اسم المشروع:' : 'Project Name:'}</label>
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
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>{isAr ? 'كود المشروع المختصر:' : 'Project Code:'}</label>
                <input
                  type="text"
                  placeholder="e.g. SCHUCO_A"
                  value={newProjectCode}
                  onChange={(e) => setNewProjectCode(e.target.value)}
                  style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.6rem 0.9rem', borderRadius: '8px', color: '#fff' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>{isAr ? 'وصف المشروع:' : 'Description:'}</label>
                <textarea
                  rows="3"
                  placeholder={isAr ? 'وصف اختياري للمشروع والموقع' : 'Optional project details'}
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
        </div>
      )}

      {/* ─── TAB 5: Restore Points & Snapshots ─── */}
      {activeTab === 'restore_points' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header & Create Point Form */}
          <div className="card glassmorphism" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  💾 {isAr ? 'نقاط الحفظ والنسخ الاحتياطية للمشروع' : 'Project Stock Restore Points & Snapshots'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                  {isAr
                    ? `تسمح لك نقاط الحفظ بحفظ حالة أرصدة مخزن (${selectedProject?.name || ''}) والرجوع إليها في أي وقت دون التأثير على المخازن الأخرى.`
                    : `Restore points capture the inventory snapshot for (${selectedProject?.name || ''}) allowing seamless rollback.`}
                </p>
              </div>

              <button
                className="btn btn-secondary"
                onClick={() => loadRestorePoints(selectedProjectId)}
                disabled={loadingRestorePoints}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                🔄 {isAr ? 'تحديث القائمة' : 'Refresh'}
              </button>
            </div>

            <form onSubmit={handleCreateRestorePoint} style={{ background: 'rgba(255,255,255,0.03)', padding: '1.25rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#00e0a1' }}>
                ➕ {isAr ? 'إنشاء نقطة حفظ جديدة الآن (Save New Restore Point)' : 'Save New Restore Point'}
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    {isAr ? 'اسم نقطة الحفظ (مثال: قبل خصم طلبية المشروع):' : 'Restore Point Name:'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isAr ? 'مثال: رصيد بداية شهر أغسطس 2026' : 'e.g. Pre-Invoice Deduction Snapshot'}
                    value={newPointName}
                    onChange={(e) => setNewPointName(e.target.value)}
                    style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.6rem 0.9rem', borderRadius: '8px', color: '#fff' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                    {isAr ? 'ملاحظات / وصف نقطة الحفظ (اختياري):' : 'Notes / Description (Optional):'}
                  </label>
                  <input
                    type="text"
                    placeholder={isAr ? 'ملاحظات توضيحية لسبب أخذ نقطة الحفظ' : 'Optional notes regarding snapshot reason'}
                    value={newPointDesc}
                    onChange={(e) => setNewPointDesc(e.target.value)}
                    style={{ width: '100%', background: '#101223', border: '1px solid var(--border)', padding: '0.6rem 0.9rem', borderRadius: '8px', color: '#fff' }}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={creatingRestorePoint}>
                {creatingRestorePoint ? <span className="spinner"></span> : isAr ? '💾 حفظ نقطة جديدة الآن' : 'Save Snapshot Now'}
              </button>
            </form>
          </div>

          {/* Saved Restore Points List */}
          <div className="card glassmorphism" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📋 {isAr ? 'نقاط الحفظ المسجلة لهذا المخزن' : 'Saved Restore Points for This Warehouse'}
              <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)' }}>({restorePoints.length})</span>
            </h4>

            {/* Filter tabs: All / Auto / Manual */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {isAr ? 'تصفية النقاط:' : 'Filter:'}
              </span>
              <button
                type="button"
                className={`btn btn-sm ${restoreFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setRestoreFilter('all')}
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}
              >
                {isAr ? 'الكل' : 'All'} ({restorePoints.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${restoreFilter === 'auto' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setRestoreFilter('auto')}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.3rem 0.8rem',
                  background: restoreFilter === 'auto' ? '#00e0a1' : 'rgba(0, 224, 161, 0.1)',
                  color: restoreFilter === 'auto' ? '#000' : '#00e0a1',
                  border: '1px solid rgba(0, 224, 161, 0.3)',
                }}
              >
                🔄 {isAr ? 'تلقائي قبل الحركات' : 'Auto Snapshots'} ({restorePoints.filter((p) => p.isAuto).length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${restoreFilter === 'manual' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setRestoreFilter('manual')}
                style={{
                  fontSize: '0.8rem',
                  padding: '0.3rem 0.8rem',
                  background: restoreFilter === 'manual' ? '#64b5f6' : 'rgba(100, 181, 246, 0.1)',
                  color: restoreFilter === 'manual' ? '#000' : '#64b5f6',
                  border: '1px solid rgba(100, 181, 246, 0.3)',
                }}
              >
                💾 {isAr ? 'نقاط يدوية' : 'Manual'} ({restorePoints.filter((p) => !p.isAuto).length})
              </button>
            </div>

            {loadingRestorePoints ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <span className="spinner"></span> {isAr ? 'جاري تحميل نقاط الحفظ...' : 'Loading restore points...'}
              </div>
            ) : filteredRestorePoints.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>💾</div>
                <p>{isAr ? 'لا توجد نقاط حفظ مسجلة تطابق التصفية الحالية.' : 'No restore points matching current filter.'}</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                  {isAr ? 'يتم إنشاء نقاط الحفظ التلقائية مع كل حركة توريد أو صرف، ويمكنك إنشاء نقطة يدوية بالأعلى في أي وقت.' : 'Auto snapshots are created on every stock movement.'}
                </p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', width: '50px' }}>#</th>
                      <th>{isAr ? 'اسم نقطة الحفظ والملاحظات' : 'Point Name & Notes'}</th>
                      <th style={{ textAlign: 'center' }}>{isAr ? 'التاريخ والمنشئ' : 'Date & Creator'}</th>
                      <th style={{ textAlign: 'center' }}>{isAr ? 'عدد الأصناف (SKU)' : 'Total SKUs'}</th>
                      <th style={{ textAlign: 'center' }}>{isAr ? 'إجمالي الأعواد (BAR)' : 'Total Bars'}</th>
                      <th style={{ textAlign: 'center' }}>{isAr ? 'الأمتار (LM)' : 'Total Meters'}</th>
                      <th style={{ textAlign: 'center' }}>{isAr ? 'الوزن (KG)' : 'Total Weight'}</th>
                      <th style={{ textAlign: 'center', width: '180px' }}>{isAr ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRestorePoints.map((pt, idx) => (
                      <tr key={pt.id}>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '0.95rem' }}>{pt.name}</span>
                            {pt.isAuto ? (
                              <span
                                className="badge"
                                style={{
                                  background: 'rgba(0, 224, 161, 0.15)',
                                  color: '#00e0a1',
                                  border: '1px solid rgba(0, 224, 161, 0.35)',
                                  fontSize: '0.72rem',
                                  padding: '1px 6px',
                                  fontWeight: 700,
                                }}
                              >
                                🔄 {isAr ? 'حفظ تلقائي قبل حركة' : 'Auto'}
                              </span>
                            ) : (
                              <span
                                className="badge"
                                style={{
                                  background: 'rgba(100, 181, 246, 0.15)',
                                  color: '#64b5f6',
                                  border: '1px solid rgba(100, 181, 246, 0.35)',
                                  fontSize: '0.72rem',
                                  padding: '1px 6px',
                                  fontWeight: 700,
                                }}
                              >
                                💾 {isAr ? 'حفظ يدوي' : 'Manual'}
                              </span>
                            )}
                          </div>
                          {pt.description && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{pt.description}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.82rem' }}>
                          <div>{pt.createdAt ? new Date(pt.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US') : '—'}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{pt.createdByName || pt.createdByEmail || pt.createdBy}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#00e0a1' }}>{pt.totalItems ?? 0}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#FFD700' }}>{(pt.totalQuantityBar ?? 0).toLocaleString()}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>{(pt.totalQuantityLm ?? 0).toLocaleString()} m</td>
                        <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>{(pt.totalQuantityKg ?? 0).toLocaleString()} kg</td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleRestoreToPoint(pt)}
                              disabled={restoringPointId === pt.id}
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', background: '#e65100', borderColor: '#ff9800', color: '#fff' }}
                              title={isAr ? 'استعادة أرصدة المخزن لهذه النقطة' : 'Restore stock to this point'}
                            >
                              {restoringPointId === pt.id ? <span className="spinner"></span> : isAr ? '⏪ استعادة' : 'Restore'}
                            </button>
                            <button
                              className="btn btn-ghost"
                              onClick={() => handleDeleteRestorePoint(pt)}
                              style={{ padding: '0.35rem 0.65rem', fontSize: '0.8rem', color: '#ff4d4f' }}
                              title={isAr ? 'حذف نقطة الحفظ' : 'Delete point'}
                            >
                              🗑️
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
        </div>
      )}

      {/* ─── MANUAL STOCK MOVEMENT & MULTI-STAGE OUTBOUND MODAL ─── */}
      <ManualStockModal
        isOpen={showManualModal}
        onClose={() => {
          setShowManualModal(false)
          setManualPreselectedItems([])
        }}
        initialMode={manualModalMode}
        projectId={selectedProjectId}
        projectName={selectedProject?.name}
        projects={projects}
        onSelectProject={handleSelectProject}
        stock={stock}
        preselectedItems={manualPreselectedItems}
        isAr={isAr}
        onSuccess={() => {
          loadStock(selectedProjectId)
          setSelectedStockKeys([])
        }}
      />

      {/* ─── LINK ITEM ALIAS MODAL (شوكو <=> كانكس) ─── */}
      {linkModalData && linkModalData.isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            style={{
              background: '#16192b',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '540px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
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
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.4rem' }}>🔗</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#8ab4ff' }}>
                    {isAr ? 'ربط كود الفاتورة بصنف بديل من المخزن' : 'Link Item Code to Stock Profile'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {isAr ? 'حل مشكلة اختلاف أكواد شوكو وكانكس والتعرف التلقائي عليها' : 'Resolve code discrepancies (e.g. Schüco vs Canex)'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLinkModalData(null)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isAr ? 'كود الصنف في الفاتورة الحالية:' : 'Invoice Profile Code:'}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fbbf24', marginTop: '0.2rem' }}>
                  {linkModalData.sourceCode} <span style={{ fontSize: '0.85rem', fontWeight: 400, color: '#aaa' }}>({linkModalData.sourceDesc || '—'})</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, display: 'block', marginBottom: '0.4rem' }}>
                  {isAr ? 'اختر الصنف المطابق له من المخزن (كانكس / شوكو):' : 'Select Matching Profile in Warehouse Stock:'}
                </label>
                <input
                  type="text"
                  placeholder={isAr ? '🔍 ابحث برقم الكود أو الوصف...' : 'Search by code or description...'}
                  value={aliasSearchQuery}
                  onChange={(e) => setAliasSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: '#101223',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.8rem',
                    color: '#fff',
                    fontSize: '0.85rem',
                    marginBottom: '0.6rem',
                  }}
                />

                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                  {stock
                    .filter((s) => {
                      if (!aliasSearchQuery.trim()) return true
                      const q = aliasSearchQuery.toLowerCase()
                      return (
                        String(s.itemCode || '').toLowerCase().includes(q) ||
                        String(s.customerCode || '').toLowerCase().includes(q) ||
                        String(s.description || '').toLowerCase().includes(q)
                      )
                    })
                    .slice(0, 40)
                    .map((item) => {
                      const isSelected = linkModalData.selectedItemKey === item.itemKey
                      return (
                        <div
                          key={item.itemKey}
                          onClick={() => setLinkModalData((prev) => ({ ...prev, selectedItemKey: item.itemKey }))}
                          style={{
                            padding: '0.6rem 0.8rem',
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            background: isSelected ? 'rgba(138, 180, 248, 0.18)' : 'transparent',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: isSelected ? '#8ab4ff' : '#fff', fontSize: '0.88rem' }}>
                              {item.itemCode} {item.customerCode && <span style={{ color: '#aaa', fontSize: '0.78rem' }}>({item.customerCode})</span>}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {item.description} | {item.finish}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span className="badge" style={{ background: 'rgba(0, 224, 161, 0.15)', color: '#00e0a1', border: '1px solid rgba(0, 224, 161, 0.3)', fontSize: '0.75rem' }}>
                              {item.quantityBar} {isAr ? 'عود' : 'bars'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Remember Checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', background: 'rgba(0, 224, 161, 0.05)', border: '1px solid rgba(0, 224, 161, 0.2)', padding: '0.7rem 0.9rem', borderRadius: '8px' }}>
                <input
                  type="checkbox"
                  checked={linkModalData.rememberAlways}
                  onChange={(e) => setLinkModalData((prev) => ({ ...prev, rememberAlways: e.target.checked }))}
                  style={{ width: '17px', height: '17px' }}
                />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0' }}>
                  {isAr
                    ? '☑️ تذكر هذا الربط دائماً وحفظه في قاموس الأكواد المترادفة للمشروع (لن تسألك عنه ثانية)'
                    : 'Remember this mapping permanently in project aliases dictionary'}
                </span>
              </label>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '1rem 1.5rem',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.8rem',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setLinkModalData(null)}
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleConfirmManualLink}
                disabled={!linkModalData.selectedItemKey}
                style={{ background: '#3b82f6', color: '#fff', fontWeight: 700 }}
              >
                🔗 {isAr ? 'اعتماد الربط وتحديث الرصيد' : 'Confirm Link & Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
