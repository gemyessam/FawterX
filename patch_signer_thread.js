const fs = require('fs');
let c = fs.readFileSync('signer.cs', 'utf8');

const targetRegex = /Thread staThread = new Thread\(\(\) =>[\s\S]*?staThread\.Join\(\);/;

const replacement = `X509Certificate2 cert = null;
                        
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

c = c.replace(targetRegex, replacement);
c = c.replace(/v1\.7\.9/g, 'v1.8.0');

fs.writeFileSync('signer.cs', c);
console.log("Updated signer.cs to separate STA and MTA threads and bumped to v1.8.0");
