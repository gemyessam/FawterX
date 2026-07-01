import React, { useState, useEffect, useContext } from 'react'
import { SettingsContext } from '../App'
import UploadStep from './UploadStep'
import { generateInvoice, submitToETA, getETAStatus } from '../services/api'
import toast from 'react-hot-toast'

// Helper function equivalent to cleanObject in Home.jsx
function cleanObject(obj) {
  if (Array.isArray(obj)) {
    const arr = obj.map(item => cleanObject(item)).filter(item => {
      if (item === null || item === undefined || item === '') return false
      if (typeof item === 'object' && Object.keys(item).length === 0) return false
      return true
    })
    return arr.length > 0 ? arr : undefined
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj = {}
    Object.entries(obj).forEach(([key, value]) => {
      const cleanedValue = cleanObject(value)
      if (cleanedValue !== undefined && cleanedValue !== null && cleanedValue !== '') {
        newObj[key] = cleanedValue
      }
    })
    return Object.keys(newObj).length > 0 ? newObj : undefined
  }
  return obj
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

export default function BatchWorkflow({ lang, t, fetchUsage }) {
  const settings = useContext(SettingsContext);
  const [step, setStep] = useState(1) // 1: Upload, 2: Processing, 3: Review
  const [invoices, setInvoices] = useState([]) // Array of generated ETA docs
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submissionResults, setSubmissionResults] = useState([])

  async function handleBatchUploadSuccess(resultsArray) {
    setStep(2)
    toast.loading(lang === 'ar' ? 'جاري توليد الفواتير ومطابقتها...' : 'Generating and mapping invoices...', { id: 'batch-gen' })
    
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

      const smartMapping = {
        invoiceNumber: 'invoiceNumber', itemCode: 'itemCode', codeType: 'codeType', internalCode: 'internalCode',
        description: 'description', quantity: 'quantity', unitType: 'unitType', currency: 'currency',
        unitValue: 'unitValue', taxPercent: 'taxPercent'
      }

      const generatedDocs = []

      // Generate invoice for each uploaded file's result
      for (const res of resultsArray) {
        if (!res.success) {
          toast.error(`Failed to parse file: ${res.fileName}`)
          continue
        }
        
        try {
          const genRes = await generateInvoice(smartMapping, res.rows || [], issuer, res.metadata || {})
          if (genRes.success) {
            const docs = genRes.documents || [genRes.document]
            const cleanedDocs = docs.map(d => cleanObject(d))
            // Save the original filename to display in the sidebar
            cleanedDocs[0]._fileName = res.fileName 
            generatedDocs.push(cleanedDocs[0])
          }
        } catch (genErr) {
          console.error("Error generating doc for", res.fileName, genErr)
          toast.error(`Failed to generate ETA doc for ${res.fileName}`)
        }
      }

      setInvoices(generatedDocs)
      toast.success(lang === 'ar' ? `تم تحضير ${generatedDocs.length} فاتورة بنجاح` : `Prepared ${generatedDocs.length} invoices successfully`, { id: 'batch-gen' })
      setStep(3)
    } catch (e) {
      console.error(e)
      toast.error(lang === 'ar' ? 'حدث خطأ أثناء معالجة الفواتير' : 'Error processing invoices', { id: 'batch-gen' })
      setStep(1)
    }
  }

  async function handleBatchSubmit() {
    if (invoices.length === 0) return

    setSubmitting(true)
    toast.loading(lang === 'ar' ? 'جاري التحقق من أداة التوقيع وتوقيع الفواتير...' : 'Signing and submitting batch...', { id: 'batch-submit' })
    
    let signedDocs = []
    
    try {
      // 1. Health check to local signer
      let localSignerActive = false;
      try {
        const pingRes = await fetch("http://localhost:8585/", { method: "GET" });
        if (pingRes.ok) localSignerActive = true;
      } catch (pingErr) {}

      if (!localSignerActive) {
        toast.dismiss('batch-submit');
        setSubmitting(false);
        toast.error(
          lang === 'ar' 
            ? '⚠️ لم يتم العثور على نافذة أداة التوقيع! يرجى فتح FawterX Signer وترك النافذة ظاهرة مع توصيل الدونجل.' 
            : '⚠️ Local signer window not detected! Please open FawterX Signer and keep its window visible with your USB Token plugged in.',
          { duration: 7000 }
        );
        return;
      }

      // 2. Sign each document locally
      const safeDate = new Date();
      safeDate.setMinutes(safeDate.getMinutes() - 5);
      const fallbackIsoTime = safeDate.toISOString().replace(/\.\d{3}Z$/, 'Z');
      for (const doc of invoices) {
        // Remove internal _fileName before signing and submitting
        const { _fileName, ...pureDoc } = doc
        if (pureDoc.dateTimeIssued) {
          const parsed = new Date(pureDoc.dateTimeIssued);
          if (!isNaN(parsed.getTime())) {
            pureDoc.dateTimeIssued = parsed.toISOString().replace(/\.\d{3}Z$/, 'Z');
          } else {
            pureDoc.dateTimeIssued = fallbackIsoTime;
          }
        } else {
          pureDoc.dateTimeIssued = fallbackIsoTime;
        }
        const cleanedDoc = cleanObject(pureDoc)
        const canonicalString = serializeToken(cleanedDoc)
        
        const signRes = await fetch("http://localhost:8585/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ canonicalString })
        });
        
        if (!signRes.ok) throw new Error('Local signing request failed.');
        const signData = await signRes.json();
        if (!signData.success) throw new Error(signData.error || 'Unknown signing error');
        
        signedDocs.push({
          ...cleanedDoc,
          signatures: [{ signatureType: "I", value: signData.signature }]
        })
      }

      // 3. Submit the entire signed batch to ETA (The backend supports array of documents)
      toast.loading(lang === 'ar' ? 'تم التوقيع بنجاح! جاري إرسال الدفعة لمنظومة الضرائب...' : 'Signed successfully! Submitting batch to ETA...', { id: 'batch-submit' })
      
      const res = await submitToETA(signedDocs, false)
      toast.success(lang === 'ar' ? 'تم إرسال جميع الفواتير بنجاح لـ ETA!' : 'Batch sent successfully to ETA!', { id: 'batch-submit' })
      
      // Auto verify if a UUID is returned
      const uuid = res.requestId || res.result?.submissionUUID || res.result?.submissionId || res.result?.requestId;
      if (uuid && uuid !== "N/A") {
        toast(
          lang === 'ar'
            ? 'الدفعة وصلت، وبوابة الضرائب تتحقق منها الآن.'
            : 'The batch has been sent and ETA Portal is verifying it now.',
          { id: 'verify-batch', icon: '⏳' }
        )
        await new Promise(r => setTimeout(r, 3000));
        try {
          await getETAStatus(uuid)
          toast.success(lang === 'ar' ? 'تم تأكيد وصول الدفعة بالبوابة!' : 'Batch appearance verified in Portal!', { id: 'verify-batch' })
        } catch (vErr) {
          toast(
            lang === 'ar'
              ? 'بوابة الضرائب ما زالت تعالج الدفعة، وسيظهر التأكيد بعد قليل.'
              : 'ETA Portal is still processing the batch and confirmation will appear shortly.',
            { id: 'verify-batch', icon: '⏳' }
          )
        } finally {
          if (fetchUsage) fetchUsage()
        }
      }

      // Show results
      setSubmissionResults(signedDocs)
    } catch (err) {
      console.error(err)
      toast.error(lang === 'ar' ? 'فشل إرسال الدفعة' : 'Batch submission failed', { id: 'batch-submit' })
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 1) {
    return (
      <div className="card fade-in">
        <UploadStep onSuccess={handleBatchUploadSuccess} />
      </div>
    )
  }

  if (step === 2) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <div className="spinner" style={{ width: '3rem', height: '3rem', margin: '0 auto 1rem' }}></div>
        <h2>{lang === 'ar' ? 'جاري معالجة الدفعة...' : 'Processing Batch...'}</h2>
      </div>
    )
  }

  // REVIEW AND SUBMIT STEP
  const selectedDoc = invoices[selectedIdx]

  return (
    <div className="card fade-in" style={{ padding: '0', overflow: 'hidden' }}>
      <div style={{ padding: '1.5rem', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>📑 {lang === 'ar' ? 'مراجعة الدفعة (Batch Review)' : 'Batch Review'}</h2>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-dim)' }}>
            {lang === 'ar' ? `تم تجهيز ${invoices.length} فواتير للإرسال` : `${invoices.length} invoices ready for submission`}
          </p>
        </div>
        <button 
          className="btn btn-accent btn-lg" 
          onClick={handleBatchSubmit}
          disabled={submitting || invoices.length === 0}
        >
          {submitting ? <span className="spinner" /> : null}
          🚀 {lang === 'ar' ? 'إرسال الكل لـ ETA' : 'Submit All to ETA'}
        </button>
      </div>

      <div style={{ display: 'flex', minHeight: '600px' }}>
        {/* Sidebar */}
        <div style={{ width: '300px', borderRight: lang === 'en' ? '1px solid var(--border)' : 'none', borderLeft: lang === 'ar' ? '1px solid var(--border)' : 'none', background: 'var(--bg)', overflowY: 'auto', padding: '1rem' }}>
          {invoices.map((inv, idx) => (
            <div 
              key={idx}
              onClick={() => setSelectedIdx(idx)}
              style={{
                padding: '1rem',
                marginBottom: '0.5rem',
                borderRadius: '8px',
                background: selectedIdx === idx ? 'rgba(0, 224, 161, 0.1)' : 'var(--card-bg)',
                border: selectedIdx === idx ? '1px solid var(--accent)' : '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                {inv.internalID || `Invoice #${idx + 1}`}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                👤 {inv.receiver?.name || (lang === 'ar' ? 'بدون اسم' : 'No Name')}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                📄 {inv._fileName}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 'bold', marginTop: '0.25rem' }}>
                {inv.totalAmount?.toLocaleString()} EGP
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, padding: '2rem', background: 'var(--card-bg)', overflowY: 'auto' }}>
          {selectedDoc ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                  <h3 style={{ margin: 0, color: 'var(--accent)' }}>{selectedDoc.internalID}</h3>
                  <p style={{ margin: '0.5rem 0 0', color: 'var(--text-dim)' }}>{selectedDoc.dateTimeIssued}</p>
                </div>
                <div style={{ textAlign: lang === 'ar' ? 'left' : 'right' }}>
                  <h4 style={{ margin: 0 }}>{selectedDoc.receiver?.name}</h4>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    {selectedDoc.receiver?.id}
                  </p>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '5%' }}>#</th>
                      <th style={{ width: '15%' }}>{lang === 'ar' ? 'الكود' : 'Item Code'}</th>
                      <th style={{ width: '50%' }}>{lang === 'ar' ? 'الوصف' : 'Description'}</th>
                      <th style={{ width: '10%' }}>{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                      <th style={{ width: '10%' }}>{lang === 'ar' ? 'السعر' : 'Price'}</th>
                      <th style={{ width: '10%' }}>{lang === 'ar' ? 'الإجمالي' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDoc.invoiceLines?.map((line, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{line.itemCode}</td>
                        <td>{line.description}</td>
                        <td>{line.quantity} {line.unitType}</td>
                        <td>{line.unitValue?.amountEGP?.toLocaleString()}</td>
                        <td style={{ fontWeight: 'bold', color: 'var(--accent)' }}>
                          {line.total?.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Invoice Summary */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                <div style={{ width: '350px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', color: 'var(--text-dim)', fontSize: '1.05rem' }}>
                    <span>{lang === 'ar' ? 'الإجمالي بدون ضريبة:' : 'Subtotal:'}</span>
                    <span>{selectedDoc.totalSalesAmount?.toLocaleString()} EGP</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.25rem', color: 'var(--text-dim)', fontSize: '1.05rem' }}>
                    <span>{lang === 'ar' ? 'قيمة الضريبة المضافة (VAT):' : 'Total VAT:'}</span>
                    <span>{(selectedDoc.taxTotals?.[0]?.amount || 0)?.toLocaleString()} EGP</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.4rem', color: 'var(--accent)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                    <span>{lang === 'ar' ? 'الإجمالي النهائي:' : 'Total Amount:'}</span>
                    <span>{selectedDoc.totalAmount?.toLocaleString()} EGP</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem 0' }}>
              {lang === 'ar' ? 'اختر فاتورة من القائمة الجانبية لمعاينتها' : 'Select an invoice from the sidebar to preview'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
