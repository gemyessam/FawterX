const fs = require('fs');
let c = fs.readFileSync('src/pages/Home.jsx', 'utf8');

const target1 = `                  🔑 {lang === 'ar' ? 'برنامج التوقيع المحلي' : 'Local E-Signer Bridge'}
                </h4>`;

const replacement1 = `                  🔑 {lang === 'ar' ? 'أداة التوقيع FawterX Signer' : 'Local E-Signer Bridge'}
                  <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--accent)', color: '#000', marginLeft: '0.5rem' }}>v1.7.8</span>
                </h4>`;

const target2 = `                <a href={\`/FawterX-Signer.zip?t=\${Date.now()}\`} download className="btn btn-accent btn-block btn-sm" style={{ textDecoration: 'none', textAlign: 'center', display: 'block' }}>
                  📥 {lang === 'ar' ? 'تحميل برنامج التوقيع (ZIP)' : 'Download Signer (ZIP)'}
                </a>`;

const replacement2 = `                <a href={\`/FawterX-Signer.zip?t=\${Date.now()}\`} download className="btn btn-accent btn-block btn-sm" style={{ textDecoration: 'none', textAlign: 'center', display: 'block' }}>
                  📥 {lang === 'ar' ? 'تحميل أحدث إصدار v1.7.8 (ZIP)' : 'Download Latest v1.7.8 (ZIP)'}
                </a>`;

c = c.replace(/\r\n/g, '\n');
c = c.replace(target1.replace(/\r\n/g, '\n'), replacement1.replace(/\r\n/g, '\n'));
c = c.replace(target2.replace(/\r\n/g, '\n'), replacement2.replace(/\r\n/g, '\n'));

fs.writeFileSync('src/pages/Home.jsx', c);
console.log("Updated Home.jsx to display signer v1.7.8");
