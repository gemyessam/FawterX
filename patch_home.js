const fs = require('fs');
let c = fs.readFileSync('frontend/src/pages/Home.jsx', 'utf8');

const target = `<button 
                  type="button"
                  style={{ 
                    flex: 1, 
                    padding: '0.75rem', 
                    borderRadius: '8px', 
                    border: 'none', 
                    background: parseMode === 'smart' ? 'linear-gradient(135deg, #7c4dff, #18ffff)' : 'transparent', 
                    color: parseMode === 'smart' ? '#0b0d19' : '#fff', 
                    cursor: 'pointer', 
                    fontWeight: 700, 
                    transition: 'all 0.25s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onClick={() => { setParseMode('smart'); setFile(null); }}
                >
                  🧠 {lang === 'ar' ? 'وضع الذكاء الاصطناعي الأذكى (PDF / Excel)' : 'AI Smart Auto-Parse (PDF / Excel)'}
                  <span style={{ 
                    fontSize: '0.62rem', 
                    background: parseMode === 'smart' ? 'rgba(11, 13, 25, 0.15)' : 'rgba(255, 255, 255, 0.15)', 
                    color: parseMode === 'smart' ? '#0b0d19' : 'var(--warning)',
                    padding: '0.15rem 0.5rem', 
                    borderRadius: '12px', 
                    marginLeft: '0.5rem', 
                    fontWeight: 800,
                    border: parseMode === 'smart' ? '1px solid rgba(11, 13, 25, 0.2)' : '1px solid rgba(255, 184, 79, 0.3)',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}>
                    {lang === 'ar' ? 'تحت التجربة والارتقاء 🧪' : 'Beta / Under Dev 🧪'}
                  </span>
                </button>`;

const replacement = target + `
                <button 
                  type="button"
                  style={{ 
                    flex: 1, 
                    padding: '0.75rem', 
                    borderRadius: '8px', 
                    border: 'none', 
                    background: parseMode === 'batch' ? 'var(--accent)' : 'transparent', 
                    color: parseMode === 'batch' ? '#0b0d19' : '#fff', 
                    cursor: 'pointer', 
                    fontWeight: 700, 
                    transition: 'all 0.25s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                  onClick={() => { setParseMode('batch'); setFile(null); }}
                >
                  📑 {lang === 'ar' ? 'الرفع المتعدد (Batch Upload)' : 'Batch Upload'}
                </button>`;

c = c.replace(/\r\n/g, '\n');
c = c.replace(target.replace(/\r\n/g, '\n'), replacement.replace(/\r\n/g, '\n'));

// Now render BatchWorkflow when parseMode === 'batch'
const target2 = `          {/* STEP 1: UPLOAD FILE */}
          {step === 1 && (`;

const replacement2 = `          {/* BATCH WORKFLOW */}
          {parseMode === 'batch' && (
            <BatchWorkflow lang={lang} t={t} fetchUsage={fetchUsage} />
          )}

          {/* STEP 1: UPLOAD FILE */}
          {step === 1 && parseMode !== 'batch' && (`;

c = c.replace(target2.replace(/\r\n/g, '\n'), replacement2.replace(/\r\n/g, '\n'));

// Now import BatchWorkflow at the top
const target3 = `import { uploadExcel, previewInvoice, generateInvoice, submitToETA, getETAStatus, getUsageStatus, getOperations } from '../services/api'`;
const replacement3 = target3 + `\nimport BatchWorkflow from '../components/BatchWorkflow'`;
c = c.replace(target3.replace(/\r\n/g, '\n'), replacement3.replace(/\r\n/g, '\n'));

fs.writeFileSync('frontend/src/pages/Home.jsx', c);
console.log("Updated Home.jsx for BatchWorkflow");
