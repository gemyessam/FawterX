const fs = require('fs');
let c = fs.readFileSync('signer.cs', 'utf8');

const target1 = `        private static X509Certificate2 SelectCertificate()
        {
            X509Store store = new X509Store(StoreName.My, StoreLocation.CurrentUser);`;

const replacement1 = `        private static X509Certificate2 _cachedCert = null;

        private static X509Certificate2 SelectCertificate()
        {
            if (_cachedCert != null) return _cachedCert;

            X509Store store = new X509Store(StoreName.My, StoreLocation.CurrentUser);`;

const target2 = `            if (selectedCollection.Count > 0)
            {
                return selectedCollection[0];
            }`;

const replacement2 = `            if (selectedCollection.Count > 0)
            {
                _cachedCert = selectedCollection[0];
                return _cachedCert;
            }`;

c = c.replace(/\r\n/g, '\n');
c = c.replace(target1.replace(/\r\n/g, '\n'), replacement1.replace(/\r\n/g, '\n'));
c = c.replace(target2.replace(/\r\n/g, '\n'), replacement2.replace(/\r\n/g, '\n'));

fs.writeFileSync('signer.cs', c);
console.log("Updated signer.cs to cache X509Certificate2");
