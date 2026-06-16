const fs = require('fs');
let c = fs.readFileSync('signer.cs', 'utf8');

const target = `            CmsSigner cmsSigner = new CmsSigner(cert);
            cmsSigner.SignerIdentifierType = SubjectIdentifierType.IssuerAndSerialNumber;
            cmsSigner.IncludeOption = X509IncludeOption.ExcludeRoot;`;

const replacement = `            CmsSigner cmsSigner = new CmsSigner(cert);
            cmsSigner.SignerIdentifierType = SubjectIdentifierType.IssuerAndSerialNumber;
            // Set IncludeOption to EndCertOnly to avoid blocking online CRL checks.
            // Intermediate certificates are manually embedded anyway.
            cmsSigner.IncludeOption = X509IncludeOption.EndCertOnly;`;

c = c.replace(/\r\n/g, '\n');
if (c.indexOf(target.replace(/\r\n/g, '\n')) === -1) {
    console.error("TARGET NOT FOUND!");
    process.exit(1);
}
c = c.replace(target.replace(/\r\n/g, '\n'), replacement.replace(/\r\n/g, '\n'));

c = c.replace(/v1\.8\.0/g, 'v1.8.1');

fs.writeFileSync('signer.cs', c);
console.log("SUCCESSFULLY PATCHED signer.cs to v1.8.1 and EndCertOnly!");
