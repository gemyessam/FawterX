const fs = require('fs');
let c = fs.readFileSync('src/components/BatchWorkflow.jsx', 'utf8');

const target1 = `<div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{lang === 'ar' ? 'الكود' : 'Item Code'}</th>
                      <th>{lang === 'ar' ? 'الوصف' : 'Description'}</th>
                      <th>{lang === 'ar' ? 'الكمية' : 'Qty'}</th>
                      <th>{lang === 'ar' ? 'السعر' : 'Price'}</th>
                      <th>{lang === 'ar' ? 'الإجمالي' : 'Total'}</th>
                    </tr>
                  </thead>`;

const replacement1 = `<div className="table-wrapper">
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
                  </thead>`;

const target2 = `                  </tbody>
                </table>
              </div>
            </div>`;

const replacement2 = `                  </tbody>
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
            </div>`;

c = c.replace(/\r\n/g, '\n');
c = c.replace(target1.replace(/\r\n/g, '\n'), replacement1.replace(/\r\n/g, '\n'));
c = c.replace(target2.replace(/\r\n/g, '\n'), replacement2.replace(/\r\n/g, '\n'));

fs.writeFileSync('src/components/BatchWorkflow.jsx', c);
console.log("Updated BatchWorkflow.jsx with table UI enhancements");
