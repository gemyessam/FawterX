const fs = require('fs');
let c = fs.readFileSync('signer.cs', 'utf8');

const target = `                        X509Certificate2 cert = null;
                        
                        Thread staThread = new Thread(() =>
                        {
                            try
                            {
                                cert = SelectCertificate();
                            }
                            catch (Exception ex)
                            {
                                errorMsg = ex.Message;
                            }
                        });
                        
                        staThread.SetApartmentState(ApartmentState.STA);
                        staThread.Start();
                        staThread.Join();

                        if (cert == null && string.IsNullOrEmpty(errorMsg))
                        {
                            errorMsg = "User cancelled certificate selection or no valid token was found.";
                        }

                        if (cert != null)
                        {
                            try
                            {
                                Console.WriteLine("[SIGNING] Using Certificate: " + cert.Subject);
                                // Execute signing on the MTA ThreadPool thread to prevent CSP deadlocks
                                signatureBase64 = SignDocument(canonicalString, cert);
                            }
                            catch (Exception ex)
                            {
                                errorMsg = ex.Message;
                            }
                        }`;

const replacement = `                        Thread staThread = new Thread(() =>
                        {
                            try
                            {
                                X509Certificate2 cert = SelectCertificate();
                                if (cert == null)
                                {
                                    errorMsg = "User cancelled certificate selection or no valid token was found.";
                                    return;
                                }

                                Console.WriteLine("[SIGNING] Using Certificate: " + cert.Subject);
                                signatureBase64 = SignDocument(canonicalString, cert);
                            }
                            catch (Exception ex)
                            {
                                errorMsg = ex.Message;
                            }
                        });
                        
                        staThread.SetApartmentState(ApartmentState.STA);
                        staThread.Start();
                        staThread.Join();`;

c = c.replace(/\r\n/g, '\n');
if (c.indexOf(target.replace(/\r\n/g, '\n')) === -1) {
    console.error("TARGET NOT FOUND!");
    process.exit(1);
}
c = c.replace(target.replace(/\r\n/g, '\n'), replacement.replace(/\r\n/g, '\n'));

c = c.replace(/v1\.8\.1/g, 'v1.8.2');

fs.writeFileSync('signer.cs', c);
console.log("SUCCESSFULLY PATCHED signer.cs to v1.8.2 and restored STA thread signing!");
