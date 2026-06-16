const fs = require('fs');
let c = fs.readFileSync('signer.cs', 'utf8');

const target1 = `            CmsSigner cmsSigner = new CmsSigner(SubjectIdentifierType.IssuerAndSerialNumber, cert);
            cmsSigner.IncludeOption = X509IncludeOption.ExcludeRoot;`;

const replacement1 = `            CmsSigner cmsSigner = new CmsSigner(SubjectIdentifierType.IssuerAndSerialNumber, cert);
            // Use EndCertOnly to prevent .NET from doing slow CRL checks which cause hangs.
            // We already manually embed the intermediate certificates below.
            cmsSigner.IncludeOption = X509IncludeOption.EndCertOnly;`;

c = c.replace(/\r\n/g, '\n');
c = c.replace(target1.replace(/\r\n/g, '\n'), replacement1.replace(/\r\n/g, '\n'));

fs.writeFileSync('signer.cs', c);
console.log("Updated signer.cs to use EndCertOnly");
