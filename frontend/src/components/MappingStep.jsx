import { useState, useEffect } from 'react'
import { previewInvoice } from '../services/api'
import toast from 'react-hot-toast'

// حقول ETA المطلوبة للـ Mapping حسب طلب المستخدم
const ETA_FIELDS = [
  { key: 'codeType',      label: 'نوع الكود (Code Type EGS/GS1)', required: false },
  { key: 'itemCode',      label: 'كود المنتج (Item Code)', required: true },
  { key: 'internalCode',  label: 'الكود الداخلي (Internal Code)', required: false },
  { key: 'description',   label: 'وصف المنتج (Item Description)', required: true },
  { key: 'quantity',      label: 'الكمية (Quantity)', required: true },
  { key: 'unitType',      label: 'وحدة القياس (Quantity Measurement)', required: true },
  { key: 'currency',      label: 'العملة (Currency)', required: true },
  { key: 'unitValue',     label: 'سعر الوحدة بالجنيه (Unit Price EGP)', required: true },
  { key: 'taxPercent',    label: 'نسبة الضريبة % (Tax)', required: true },
]

export default function MappingStep({ uploadResult, onConfirm, onBack }) {
  const { headers, preview, rows = [], parserDebugInfo, metadata } = uploadResult

  const [mapping, setMapping] = useState({})
  const [loading, setLoading] = useState(false)
  const [previewData, setPreviewData] = useState(null)

  // Auto-detect mapping based on header names
  useEffect(() => {
    const autoMap = {}
    headers.forEach(h => {
      const lower = h.toLowerCase()
      if (lower === 'quantity' || lower === 'الكمية' || lower === 'qty') autoMap.quantity = h
      else if (lower.includes('invoice') || lower.includes('رقم الفاتورة')) autoMap.invoiceNumber = h
      else if (lower.includes('desc') || lower.includes('product') || lower.includes('اسم') || lower.includes('وصف')) autoMap.description = h
      else if (lower.includes('price') || lower.includes('سعر')) autoMap.unitValue = h
      else if (lower.includes('tax') || lower.includes('vat') || lower.includes('ضريبة')) autoMap.taxPercent = h
      else if (lower.includes('code type') || lower.includes('نوع الكود')) autoMap.codeType = h
      else if (lower.includes('item code') || lower.includes('كود الصنف')) autoMap.itemCode = h
      else if (lower.includes('internal') || lower.includes('داخلي')) autoMap.internalCode = h
      else if (lower.includes('unit') || lower.includes('وحدة') || lower.includes('measure')) autoMap.unitType = h
      else if (lower.includes('currency') || lower.includes('عملة')) autoMap.currency = h
    })
    setMapping(autoMap)
  }, [headers])

  function handleSelect(etaKey, headerValue) {
    setMapping(prev => ({ ...prev, [etaKey]: headerValue }))
  }

  async function handleTestMapping() {
    const missing = ETA_FIELDS.filter(f => f.required && !mapping[f.key])
    if (missing.length > 0) {
      toast.error(`يرجى ربط الحقول المطلوبة للمعاينة: ${missing.map(m => m.label).join('، ')}`)
      return
    }

    const payloadRows = rows.length > 0 ? rows : preview;

    console.log("=== FRONTEND REQUEST ===", {
      rows: payloadRows,
      mapping,
      metadata
    })

    console.log("Preview Payload:", {
      rows: payloadRows,
      mapping,
      metadata
    })

    setLoading(true)
    try {
      const res = await previewInvoice(mapping, payloadRows, metadata)
      setPreviewData(res.invoiceLines || res.documents?.[0]?.invoiceLines || [])
      toast.success('تمت المعاينة بنجاح')
    } catch (err) {
      toast.error('خطأ في معاينة البيانات')
    } finally {
      setLoading(false)
    }
  }

  function handleConfirm() {
    const missing = ETA_FIELDS.filter(f => f.required && !mapping[f.key])
    if (missing.length > 0) {
      toast.error(`يرجى ربط الحقول المطلوبة: ${missing.map(m => m.label).join('، ')}`)
      return
    }
    onConfirm(mapping)
  }

  const isMappingIncomplete = ETA_FIELDS.some(f => f.required && !mapping[f.key])
  const isPreviewEmpty = !preview || preview.length === 0

  return (
    <div className="card fade-in">
      <h2 className="card-title">🔗 ربط أعمدة الإكسيل (Mapping)</h2>
      <p className="card-sub">
        قم بربط أعمدة ملفك بالحقول المطلوبة لمنظومة الضرائب المصرية.
      </p>

      {parserDebugInfo && (
        <div style={{ background: 'var(--bg-lighter)', padding: '1rem', borderRadius: 'var(--radius)', marginBottom: '1.5rem', borderLeft: '4px solid ' + (parserDebugInfo.confidenceScore > 80 ? 'var(--accent)' : 'var(--warning)') }}>
          <h4 style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>🤖 Smart Parser Info</span>
            <span style={{ color: parserDebugInfo.confidenceScore > 80 ? 'var(--accent)' : 'var(--warning)' }}>
              Confidence: {parserDebugInfo.confidenceScore}%
            </span>
          </h4>
          <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, paddingLeft: '1.2rem' }}>
            <li>تم اكتشاف صف العناوين في الصف: <strong>{parserDebugInfo.detectedHeaderRow}</strong></li>
            <li>تم تجاهل <strong>{parserDebugInfo.ignoredMetadataRows}</strong> صف معلومات (Metadata).</li>
            <li>تم تجاهل <strong>{parserDebugInfo.ignoredFooterRows}</strong> صف إجماليات (Footer).</li>
            {parserDebugInfo.parsingWarnings.map((w, i) => <li key={i} style={{ color: 'var(--warning)' }}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="table-wrapper" style={{ marginBottom: '2rem' }}>
        <table>
          <thead>
            <tr>
              <th>حقل ETA (النظام)</th>
              <th>العمود المقابل في ملفك</th>
            </tr>
          </thead>
          <tbody>
            {ETA_FIELDS.map(field => (
              <tr key={field.key}>
                <td>
                  {field.label} {field.required && <span style={{ color: 'var(--danger)' }}>*</span>}
                </td>
                <td>
                  <select
                    className="input"
                    value={mapping[field.key] || ''}
                    onChange={(e) => handleSelect(field.key, e.target.value)}
                  >
                    <option value="">-- اختر عمود --</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="nav-actions">
        <button className="btn btn-ghost" onClick={onBack}>← رجوع</button>
        <button 
          className="btn btn-primary" 
          onClick={handleTestMapping} 
          disabled={loading || isMappingIncomplete || isPreviewEmpty}
        >
          {loading ? <span className="spinner" /> : '🔍 اختبار الربط (Preview)'}
        </button>
        <button 
          className="btn btn-accent" 
          onClick={handleConfirm}
          disabled={isMappingIncomplete || isPreviewEmpty}
        >
          متابعة ←
        </button>
      </div>

      {previewData && (
        <div className="fade-in" style={{ marginTop: '2rem', padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>معاينة أولية (أول {previewData.length} صفوف):</h3>
          <div className="table-wrapper">
            <table style={{ fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>الوصف</th>
                  <th>الكمية</th>
                  <th>الوحدة</th>
                  <th>السعر</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, i) => (
                  <tr key={i}>
                    <td>{row.itemCode}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{row.description}</td>
                    <td>{row.quantity}</td>
                    <td>{row.unitType}</td>
                    <td>{row.unitValue?.amountEGP}</td>
                    <td>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
