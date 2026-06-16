import { useState, useRef } from 'react'
import { uploadExcelBatch } from '../services/api' // Using a new batch function

export default function UploadStep({ onSuccess }) {
  const [dragging, setDragging] = useState(false)
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()

  function handleFiles(newFiles) {
    if (!newFiles || newFiles.length === 0) return
    const validFiles = []
    let hasError = false
    Array.from(newFiles).forEach(f => {
      const ext = f.name.split('.').pop().toLowerCase()
      if (['xlsx','xls','csv','pdf'].includes(ext)) {
        validFiles.push(f)
      } else {
        hasError = true
      }
    })
    
    if (hasError) {
      setError('بعض الملفات غير مدعومة. يجب أن تكون بصيغة .xlsx أو .xls أو .csv أو .pdf')
    } else {
      setError('')
    }

    if (validFiles.length > 0) {
      setFiles(prev => {
        const combined = [...prev, ...validFiles]
        if (combined.length > 25) {
          setError('الحد الأقصى هو 25 ملف في الرفعة الواحدة')
          return combined.slice(0, 25)
        }
        return combined
      })
    }
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function handleUpload() {
    if (files.length === 0) return
    setLoading(true)
    setError('')
    try {
      // Call the batch upload API
      const result = await uploadExcelBatch(files)
      console.log("=== BATCH UPLOAD RESPONSE ===", result)
      
      if (result && result.success === false) {
        setError(result.message || 'خطأ في معالجة الملفات')
      } else {
        // onSuccess should handle an array of results now
        onSuccess(result.results || [result])
      }
    } catch (e) {
      console.error("=== UPLOAD ERROR ===", e)
      setError(e.response?.data?.message || e.message || 'خطأ في رفع الملفات')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2 className="card-title">📂 رفع فواتير (Batch Upload)</h2>
      <p className="card-sub">ارفع حتى 25 فاتورة (PDF أو Excel) ليتم قراءتها ومعالجتها معاً</p>

      {error && (
        <div className="alert alert-error" role="alert">
          ⚠️ {error}
        </div>
      )}

      <div
        id="upload-zone"
        className={`upload-zone ${dragging ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.csv,.pdf"
          id="file-input"
          onChange={e => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        <span className="upload-icon">📊</span>
        <h3>{dragging ? 'أفلت الملفات هنا' : 'اسحب وأفلت أو انقر لاختيار الفواتير'}</h3>
        <p>يدعم PDF و Excel — حتى 25 فاتورة كحد أقصى</p>
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h4>الملفات المحددة ({files.length}):</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            {files.map((f, i) => (
              <div key={i} className="file-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>📄</span>
                  <div>
                    <div className="file-info-name">{f.name}</div>
                    <div className="file-info-meta">{(f.size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
                <button onClick={() => removeFile(i)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                  ✖
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="nav-actions">
        <span />
        <button
          id="btn-upload"
          className="btn btn-primary btn-lg"
          onClick={handleUpload}
          disabled={files.length === 0 || loading}
        >
          {loading ? <span className="spinner" /> : null}
          {loading ? 'جاري رفع الفواتير...' : `رفع ومعالجة (${files.length}) فاتورة ←`}
        </button>
      </div>
    </div>
  )
}
