using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Security.Cryptography;
using System.Security.Cryptography.Pkcs;
using System.Security.Cryptography.X509Certificates;
using System.Windows.Forms;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;

namespace FawterXSigner
{
    class Program
    {
        private static HttpListener listener;
        private static readonly string PREFIX = "http://localhost:8585/";

        [STAThread]
        static void Main(string[] args)
        {
            Console.OutputEncoding = Encoding.UTF8;
            Console.Title = "FawterX Digital Signer Bridge v1.8.4 ≡ƒöæ";
            
            Console.WriteLine("===================================================");
            Console.WriteLine("    FawterX Digital Signer Bridge v1.8.4 (Egypt ETA)  ");
            Console.WriteLine("    [STATUS] CAdES-BES Exact Chain (No Roots/Duplicates): Active ");
            Console.WriteLine("===================================================");
            Console.WriteLine();
            
            try
            {
                listener = new HttpListener();
                listener.Prefixes.Add(PREFIX);
                listener.Start();
                
                Console.WriteLine("[INFO] Local signer is active and listening on " + PREFIX);
                Console.WriteLine("[INFO] Version 1.7.7 (CAdES-BES Minimal Profile + Exact Chain No-Root Support Active)");
                Console.WriteLine("[INFO] Keep this window open while signing invoices online!");
                Console.WriteLine("===================================================");
                Console.WriteLine();

                // Start request loop in a background thread
                ThreadPool.QueueUserWorkItem((o) =>
                {
                    while (listener.IsListening)
                    {
                        try
                        {
                            HttpListenerContext context = listener.GetContext();
                            ThreadPool.QueueUserWorkItem((c) => HandleRequest((HttpListenerContext)c), context);
                        }
                        catch (Exception ex)
                        {
                            if (!listener.IsListening) break;
                            Console.WriteLine("[ERROR] Request loop error: " + ex.Message);
                        }
                    }
                });

                // Keep main thread alive
                Console.WriteLine("Press [Ctrl+C] or close this window to exit.");
                while (true)
                {
                    Thread.Sleep(1000);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[CRITICAL] Failed to start HTTP server: " + ex.Message);
                Console.WriteLine("Make sure no other application is using port 8585.");
                Console.ReadLine();
            }
        }

        private static void HandleRequest(HttpListenerContext context)
        {
            HttpListenerRequest request = context.Request;
            HttpListenerResponse response = context.Response;

            // Enforce CORS headers
            response.Headers.Add("Access-Control-Allow-Origin", "*");
            response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization, x-eta-client-id, x-eta-client-secret");

            // Handle Pre-flight OPTIONS request
            if (request.HttpMethod == "OPTIONS")
            {
                response.StatusCode = (int)HttpStatusCode.OK;
                response.Close();
                return;
            }

            string responseString = "";
            try
            {
                if (request.HttpMethod == "GET" && request.Url.AbsolutePath == "/")
                {
                    response.ContentType = "application/json; charset=utf-8";
                    responseString = "{\"success\":true,\"status\":\"ready\",\"version\":\"1.7.7\",\"message\":\"FawterX local signer v1.8.4 is running with Exact Certificate Chain embedding (No Roots/Duplicates) and UTF-8 Unicode support!\"}";
                    byte[] buffer = Encoding.UTF8.GetBytes(responseString);
                    response.ContentLength64 = buffer.Length;
                    response.OutputStream.Write(buffer, 0, buffer.Length);
                }
                else if (request.HttpMethod == "POST" && request.Url.AbsolutePath == "/sign")
                {
                    response.ContentType = "application/json; charset=utf-8";
                    
                    // Read request body forcing UTF-8 to prevent Arabic character corruption
                    string requestBody = "";
                    using (var reader = new StreamReader(request.InputStream, Encoding.UTF8))
                    {
                        requestBody = reader.ReadToEnd();
                    }

                    // Parse JSON safely to preserve the exact canonical payload bytes received from the browser
                    string canonicalString = ExtractCanonicalString(requestBody);

                    if (string.IsNullOrEmpty(canonicalString))
                    {
                        responseString = "{\"success\":false,\"error\":\"Missing or empty 'canonicalString' parameter.\"}";
                    }
                    else
                    {
                        Console.WriteLine("\n[SIGN REQUEST] Received sign request at " + DateTime.Now.ToString("HH:mm:ss"));
                        
                        // Execute certificate selection and signing in an STA Thread
                        string signatureBase64 = "";
                        string errorMsg = "";
                        
                        Thread staThread = new Thread(() =>
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
                        staThread.Join();

                        if (!string.IsNullOrEmpty(errorMsg))
                        {
                            Console.WriteLine("[FAIL] Signing failed: " + errorMsg);
                            responseString = "{\"success\":false,\"error\":\"" + EscapeString(errorMsg) + "\"}";
                        }
                        else
                        {
                            Console.WriteLine("[SUCCESS] Signature generated successfully!");
                            responseString = "{\"success\":true,\"signature\":\"" + signatureBase64 + "\"}";
                        }
                    }

                    byte[] buffer = Encoding.UTF8.GetBytes(responseString);
                    response.ContentLength64 = buffer.Length;
                    response.OutputStream.Write(buffer, 0, buffer.Length);
                }
                else
                {
                    response.StatusCode = (int)HttpStatusCode.NotFound;
                }
            }
            catch (Exception ex)
            {
                response.StatusCode = (int)HttpStatusCode.InternalServerError;
                response.ContentType = "application/json; charset=utf-8";
                responseString = "{\"success\":false,\"error\":\"" + EscapeString(ex.Message) + "\"}";
                byte[] buffer = Encoding.UTF8.GetBytes(responseString);
                response.ContentLength64 = buffer.Length;
                response.OutputStream.Write(buffer, 0, buffer.Length);
            }
            finally
            {
                response.Close();
            }
        }

        private static X509Certificate2 SelectCertificate()
        {
            X509Store store = new X509Store(StoreName.My, StoreLocation.CurrentUser);
            store.Open(OpenFlags.ReadOnly | OpenFlags.OpenExistingOnly);
            
            X509Certificate2Collection collection = store.Certificates;
            X509Certificate2Collection validCerts = new X509Certificate2Collection();
            
            // Filter only valid certificates with private keys (typical for USB tokens)
            foreach (X509Certificate2 c in collection)
            {
                if (c.HasPrivateKey && DateTime.Now >= c.NotBefore && DateTime.Now <= c.NotAfter)
                {
                    validCerts.Add(c);
                }
            }

            if (validCerts.Count == 0)
            {
                throw new Exception("No valid electronic certificates with private keys found in User Certificate Store. Please make sure your USB Token is plugged in and drivers are installed.");
            }

            // Pop up native Windows Certificate Selection dialog
            X509Certificate2Collection selectedCollection = X509Certificate2UI.SelectFromCollection(
                validCerts,
                "FawterX Smart Signer Bridge ≡ƒöæ",
                "Choose the Egypt Trust or Misr El-Maqasa certificate associated with your E-Invoicing USB Token / Dongle:",
                X509SelectionFlag.SingleSelection
            );

            store.Close();

            if (selectedCollection.Count > 0)
            {
                return selectedCollection[0];
            }
            
            return null;
        }

        private static string SignDocument(string canonicalString, X509Certificate2 cert)
        {
            byte[] dataToSign = Encoding.UTF8.GetBytes(canonicalString);
            
            // Log the SHA-256 hash of the canonical string for auditing/tracing
            byte[] hash;
            using (var sha256 = SHA256.Create())
            {
                hash = sha256.ComputeHash(dataToSign);
            }
            Console.WriteLine("[SIGNING] SHA-256 Hash (hex): " + BitConverter.ToString(hash).Replace("-", "").ToLower());
            
            // Setup ContentInfo with DigestData OID for detached CAdES-BES signature
            // CRITICAL FIX: Pass the RAW canonical string bytes 'dataToSign' instead of the pre-hashed 'hash'.
            // This ensures SHA-256 is computed only ONCE by the .NET CMS library to create the message-digest attribute,
            // while still correctly specifying the mandatory 1.2.840.113549.1.7.5 (DigestData) OID!
            Oid digestDataOid = new Oid("1.2.840.113549.1.7.5"); // DigestData
            ContentInfo contentInfo = new ContentInfo(digestDataOid, dataToSign);
            SignedCms signedCms = new SignedCms(contentInfo, true); // true = detached signature

            CmsSigner cmsSigner = new CmsSigner(cert);
            cmsSigner.SignerIdentifierType = SubjectIdentifierType.IssuerAndSerialNumber;
            cmsSigner.IncludeOption = X509IncludeOption.ExcludeRoot;

            // Dynamically build the exact certificate chain for the signer
            try
            {
                X509Chain chain = new X509Chain();
                chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
                chain.Build(cert);

                foreach (X509ChainElement element in chain.ChainElements)
                {
                    // Exclude the leaf certificate itself (it is embedded automatically)
                    if (element.Certificate.Thumbprint == cert.Thumbprint) continue;

                    // Exclude the Root CA (self-signed)
                    if (element.Certificate.Subject == element.Certificate.Issuer) continue;

                    cmsSigner.Certificates.Add(element.Certificate);
                    Console.WriteLine("[INFO] Embedding intermediate certificate: " + element.Certificate.Subject);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[WARN] Manual chain embedding note: " + ex.Message);
            }
            
            // Specify SHA-256 for the digest hashing algorithm (ETA Mandatory)
            cmsSigner.DigestAlgorithm = new Oid("2.16.840.1.101.3.4.2.1"); // SHA-256 Oid

            // Include signing time attribute
            cmsSigner.SignedAttributes.Add(new Pkcs9SigningTime(DateTime.UtcNow));

            // Add mandatory ESS-Signing-Certificate-V2 attribute (OID 1.2.840.113549.1.9.16.2.47) for CAdES-BES compliance
            try
            {
                byte[] signingCertV2Der = ConstructSigningCertificateV2Der(cert);
                Oid oid = new Oid("1.2.840.113549.1.9.16.2.47");
                AsnEncodedData asnEncodedData = new AsnEncodedData(oid, signingCertV2Der);
                CryptographicAttributeObject attr = new CryptographicAttributeObject(oid, new AsnEncodedDataCollection(asnEncodedData));
                cmsSigner.SignedAttributes.Add(attr);
                Console.WriteLine("[INFO] Successfully injected mandatory ESS-Signing-Certificate-V2 (CAdES-BES) attribute!");
            }
            catch (Exception ex)
            {
                Console.WriteLine("[WARN] Failed to inject ESS-Signing-Certificate-V2 attribute: " + ex.Message);
            }

            // Compute signature (Windows automatically prompts the user for PIN if required by USB CSP)
            try
            {
                signedCms.ComputeSignature(cmsSigner, false);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[WARN] ExcludeRoot chain building failed: " + ex.Message + ". Falling back to leaf certificate only.");
                cmsSigner.IncludeOption = X509IncludeOption.EndCertOnly;
                signedCms.ComputeSignature(cmsSigner, false);
            }

            byte[] encodedSignature = signedCms.Encode();
            return Convert.ToBase64String(encodedSignature);
        }

        private static void AutoChaseAndInstallChain(X509Certificate2 cert)
        {
            try
            {
                X509Chain chain = new X509Chain();
                chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
                chain.Build(cert);

                // If chain is fully trusted, nothing to do!
                if (chain.ChainStatus.Length == 0) return;

                string aiaUrl = null;
                foreach (var ext in cert.Extensions)
                {
                    if (ext.Oid.Value == "1.3.6.1.5.5.7.1.1") // AIA Extension OID
                    {
                        AsnEncodedData asnData = new AsnEncodedData(ext.Oid, ext.RawData);
                        string formattedData = asnData.Format(true);
                        var match = Regex.Match(formattedData, @"URL=(http[^\s\r\n\x00-\x1F]+)", RegexOptions.IgnoreCase);
                        if (match.Success)
                        {
                            aiaUrl = match.Groups[1].Value.Trim();
                            break;
                        }
                    }
                }

                if (!string.IsNullOrEmpty(aiaUrl))
                {
                    Console.WriteLine("[INFO] Bypassing chain validation by downloading issuer certificate from AIA: " + aiaUrl);
                    byte[] certBytes;
                    using (WebClient wc = new WebClient())
                    {
                        certBytes = wc.DownloadData(aiaUrl);
                    }

                    if (certBytes != null && certBytes.Length > 0)
                    {
                        X509Certificate2 parentCert = new X509Certificate2(certBytes);
                        
                        // Silently register intermediate CA into Current User Intermediate Store (requires no prompt!)
                        using (X509Store store = new X509Store(StoreName.CertificateAuthority, StoreLocation.CurrentUser))
                        {
                            store.Open(OpenFlags.ReadWrite);
                            store.Add(parentCert);
                            Console.WriteLine("[INFO] Automatically imported Intermediate CA: " + parentCert.Subject);
                        }

                        // Recursively chase the chain for parent certs
                        AutoChaseAndInstallChain(parentCert);
                    }
                }
                else
                {
                    // Fallback to direct ITIDA Root CA download
                    string fallbackRootUrl = "http://rootca.itida.gov.eg/home_files/EgyptRootCAG1.cer";
                    Console.WriteLine("[INFO] Downloading fallback Egyptian Root CA: " + fallbackRootUrl);
                    byte[] rootBytes;
                    using (WebClient wc = new WebClient())
                    {
                        rootBytes = wc.DownloadData(fallbackRootUrl);
                    }
                    if (rootBytes != null && rootBytes.Length > 0)
                    {
                        X509Certificate2 rootCert = new X509Certificate2(rootBytes);
                        using (X509Store store = new X509Store(StoreName.Root, StoreLocation.CurrentUser))
                        {
                            store.Open(OpenFlags.ReadWrite);
                            store.Add(rootCert);
                            Console.WriteLine("[INFO] Automatically imported fallback Root CA: " + rootCert.Subject);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("[WARN] Chain chasing and trust installation note: " + ex.Message);
            }
        }

        private static byte[] ConstructSigningCertificateV2Der(X509Certificate2 cert)
        {
            // Compute SHA-256 of the certificate
            byte[] certHash;
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                certHash = sha256.ComputeHash(cert.RawData);
            }

            // Create DER structure manually with absent parameters for SHA-256 OID:
            // Under DER encoding rules, if SHA-256 algorithm parameters are absent, they must not be NULL (05 00).
            // SigningCertificateV2 ::= SEQUENCE { certs SEQUENCE OF ESSCertIDv2 }
            // ESSCertIDv2 ::= SEQUENCE { hashAlgorithm AlgorithmIdentifier, certHash Hash }
            // AlgorithmIdentifier ::= SEQUENCE { algorithm OBJECT IDENTIFIER (SHA-256) } -- parameters omitted!
            
            byte[] hashAlgoOid = { 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01 };

            // Total AlgorithmIdentifier content = 11 bytes (OID TLV)
            // AlgorithmIdentifier SEQUENCE header = 30 0B (length 11)
            // Total AlgorithmIdentifier TLV = 13 bytes
            
            // Total ESSCertIDv2 content = 13 (AlgorithmIdentifier TLV) + 34 (certHash TLV) = 47 bytes
            // ESSCertIDv2 SEQUENCE header = 30 2F (length 47 = 0x2F)
            // Total ESSCertIDv2 TLV = 49 bytes
            
            // Total certs content = 49 bytes (ESSCertIDv2 TLV)
            // certs SEQUENCE header = 30 31 (length 49 = 0x31)
            // Total certs TLV = 51 bytes

            // Total SigningCertificateV2 content = 51 bytes (certs TLV)
            // SigningCertificateV2 SEQUENCE header = 30 33 (length 51 = 0x33)
            // Total SigningCertificateV2 TLV = 53 bytes

            byte[] der = new byte[53];
            
            // SigningCertificateV2 header
            der[0] = 0x30;
            der[1] = 0x33; // Length 51
            
            // certs header
            der[2] = 0x30;
            der[3] = 0x31; // Length 49
            
            // ESSCertIDv2 header
            der[4] = 0x30;
            der[5] = 0x2F; // Length 47
            
            // hashAlgorithm SEQUENCE header (AlgorithmIdentifier)
            der[6] = 0x30;
            der[7] = 0x0B; // Length 11 (OID TLV only, parameters omitted)
            
            // hashAlgorithm OID
            Array.Copy(hashAlgoOid, 0, der, 8, 11);
            
            // certHash OCTET STRING header
            der[19] = 0x04; // Tag: OCTET STRING
            der[20] = 0x20; // Length 32
            
            // certHash value
            Array.Copy(certHash, 0, der, 21, 32);

            return der;
        }

        // Safe JSON parsing for the canonical string to avoid escaping drift / digest mismatches
        private static string ExtractCanonicalString(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;

            try
            {
                var serializer = new JavaScriptSerializer();
                var dict = serializer.DeserializeObject(json) as System.Collections.Generic.Dictionary<string, object>;
                if (dict == null || !dict.ContainsKey("canonicalString") || dict["canonicalString"] == null)
                {
                    return null;
                }
                return dict["canonicalString"].ToString();
            }
            catch
            {
                string searchKey = "\"canonicalString\"";
                int keyIndex = json.IndexOf(searchKey);
                if (keyIndex == -1) return null;

                int colonIndex = json.IndexOf(":", keyIndex + searchKey.Length);
                if (colonIndex == -1) return null;

                int startIndex = json.IndexOf("\"", colonIndex + 1);
                if (startIndex == -1) return null;

                int endIndex = json.IndexOf("\"", startIndex + 1);
                while (endIndex != -1 && json[endIndex - 1] == '\\')
                {
                    endIndex = json.IndexOf("\"", endIndex + 1);
                }

                if (endIndex == -1) return null;

                string value = json.Substring(startIndex + 1, endIndex - startIndex - 1);
                try
                {
                    return System.Text.RegularExpressions.Regex.Unescape(value);
                }
                catch
                {
                    return value.Replace("\\\"", "\"").Replace("\\\\", "\\").Replace("\\n", "\n").Replace("\\r", "\r").Replace("\\t", "\t").Replace("\\f", "\f").Replace("\\b", "\b");
                }
            }
        }

        private static string EscapeString(string str)
        {
            if (string.IsNullOrEmpty(str)) return "";
            return str.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
        }
    }
}
