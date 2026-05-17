import { useState, useRef } from 'react'
import { uploadExcel } from '../services/api'

export default function UploadStep({ onSuccess }) {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const inputRef = useRef()

  async function handleFile(f) {
    if (!f) return
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['xlsx','xls','csv'].includes(ext)) {
      setError('يجب أن يكون الملف بصيغة .xlsx أو .xls أو .csv')
      return
    }
    setFile(f)
    setError('')
  }

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const result = await uploadExcel(file)
      console.log("=== UPLOAD RESPONSE ===", result)
      
      if (result && result.success === false) {
        setError(result.message || 'خطأ في معالجة ملف الإكسيل')
      } else {
        onSuccess(result)
      }
    } catch (e) {
      console.error("=== UPLOAD ERROR ===", e)
      setError(e.response?.data?.message || e.message || 'خطأ في رفع الملف')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2 className="card-title">📂 رفع ملف Excel</h2>
      <p className="card-sub">ارفع ملف الفاتورة (Excel أو CSV) ليتم قراءة البيانات تلقائيًا</p>

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
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          id="file-input"
          onChange={e => handleFile(e.target.files[0])}
          style={{ display: 'none' }}
        />
        <span className="upload-icon">📊</span>
        <h3>{dragging ? 'أفلت الملف هنا' : 'اسحب وأفلت أو انقر لاختيار الملف'}</h3>
        <p>Excel (.xlsx, .xls) أو CSV — حتى 10 ميجا</p>
      </div>

      {file && (
        <div className="file-info">
          <span style={{ fontSize: '1.5rem' }}>📄</span>
          <div>
            <div className="file-info-name">{file.name}</div>
            <div className="file-info-meta">{(file.size / 1024).toFixed(1)} KB</div>
          </div>
        </div>
      )}

      <div className="nav-actions">
        <span />
        <button
          id="btn-upload"
          className="btn btn-primary btn-lg"
          onClick={handleUpload}
          disabled={!file || loading}
        >
          {loading ? <span className="spinner" /> : null}
          {loading ? 'جاري الرفع...' : 'رفع وقراءة الملف ←'}
        </button>
      </div>
    </div>
  )
}
