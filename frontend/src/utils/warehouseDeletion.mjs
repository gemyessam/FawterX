export function acquireStockDeletionLock(ref) {
  if (ref.current) return null
  ref.current = true
  return () => { ref.current = false }
}

export async function deleteAndVerifyStock(projectId, itemKey, deleteItem, readStock) {
  const result = await deleteItem(projectId, itemKey)
  if (result?.success !== true || result.deleted !== true || result.itemKey !== itemKey || result.deletionContractVersion !== 2) {
    throw new Error('خادم المخزن لم يؤكد الحذف بالإصدار المطلوب. أعد المحاولة بعد تحديث الخادم.')
  }
  const snapshot = await readStock(projectId, { fresh: true })
  if (snapshot?.success !== true || snapshot.stockReadVersion !== 2 || !Array.isArray(snapshot.stock)) {
    throw new Error('تعذر التحقق من رصيد المخزن بعد الحذف. حدّث الجدول وأعد المحاولة.')
  }
  if (snapshot.stock.some(item => item.itemKey === itemKey)) {
    throw new Error('الصنف ما زال موجودًا على الخادم؛ لم يتم تأكيد حذفه.')
  }
  return snapshot.stock
}
