const fs = require('fs');
let c = fs.readFileSync('signer.cs', 'utf8');

// 1. Add PInvoke declarations at the top of FawterXSigner class
const pinvokeTarget = `    class FawterXSigner
    {`;
const pinvokeReplacement = `    class FawterXSigner
    {
        [System.Runtime.InteropServices.DllImport("kernel32.dll")]
        static extern IntPtr GetConsoleWindow();

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        [return: System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.Bool)]
        static extern bool SetForegroundWindow(IntPtr hWnd);`;
c = c.replace(pinvokeTarget, pinvokeReplacement);

// 2. Add ForceForeground method
const forceForegroundMethod = `
        private static void ForceForeground()
        {
            try
            {
                IntPtr hWnd = GetConsoleWindow();
                if (hWnd != IntPtr.Zero)
                {
                    SetForegroundWindow(hWnd);
                }
            }
            catch { }
        }
`;
c = c.replace(`        private static X509Certificate2 _cachedCert = null;`, forceForegroundMethod + `\n        private static X509Certificate2 _cachedCert = null;`);

// 3. Force foreground before SelectCertificate UI
const selectCertTarget = `            X509Store store = new X509Store(StoreName.My, StoreLocation.CurrentUser);`;
const selectCertReplacement = `            ForceForeground();\n            X509Store store = new X509Store(StoreName.My, StoreLocation.CurrentUser);`;
c = c.replace(selectCertTarget, selectCertReplacement);

// 4. Force foreground before ComputeSignature
const computeSigTarget = `            // Compute signature (Windows automatically prompts the user for PIN if required by USB CSP)
            try
            {
                signedCms.ComputeSignature(cmsSigner, false);
            }`;
const computeSigReplacement = `            // Compute signature (Windows automatically prompts the user for PIN if required by USB CSP)
            try
            {
                ForceForeground();
                signedCms.ComputeSignature(cmsSigner, false);
            }`;
c = c.replace(computeSigTarget, computeSigReplacement);

// 5. Restore ExcludeRoot instead of EndCertOnly (since EndCertOnly might be causing issues and ExcludeRoot worked in v1.7.7)
const endCertOnlyTarget = `            // Set IncludeOption to EndCertOnly to avoid blocking online CRL checks.
            // Intermediate certificates are manually embedded anyway.
            cmsSigner.IncludeOption = X509IncludeOption.EndCertOnly;`;
const endCertOnlyReplacement = `            cmsSigner.IncludeOption = X509IncludeOption.ExcludeRoot;`;
c = c.replace(endCertOnlyTarget, endCertOnlyReplacement);

// 6. Update Version to v1.8.3
c = c.replace(/v1\.8\.2/g, 'v1.8.3');

fs.writeFileSync('signer.cs', c);
console.log("SUCCESSFULLY PATCHED signer.cs to v1.8.3 with ForceForeground!");
