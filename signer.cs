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
            Console.Title = "FawterX Digital Signer Bridge v1.5.3 🔑";
            
            Console.WriteLine("===================================================");
            Console.WriteLine("    FawterX Digital Signer Bridge v1.5.3 (Egypt ETA)  ");
            Console.WriteLine("    [STATUS] Offline Chain Embedding: Active (Custom None) ");
            Console.WriteLine("===================================================");
            Console.WriteLine();
            
            try
            {
                listener = new HttpListener();
                listener.Prefixes.Add(PREFIX);
                listener.Start();
                
                Console.WriteLine("[INFO] Local signer is active and listening on " + PREFIX);
                Console.WriteLine("[INFO] Version 1.5.3 (Custom Offline Chain Embedding Active)");
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
                    responseString = "{\"success\":true,\"status\":\"ready\",\"version\":\"1.1.0\",\"message\":\"FawterX local signer v1.1.0 is running with Chain Bypass!\"}";
                    byte[] buffer = Encoding.UTF8.GetBytes(responseString);
                    response.ContentLength64 = buffer.Length;
                    response.OutputStream.Write(buffer, 0, buffer.Length);
                }
                else if (request.HttpMethod == "POST" && request.Url.AbsolutePath == "/sign")
                {
                    response.ContentType = "application/json; charset=utf-8";
                    
                    // Read request body
                    string requestBody = "";
                    using (var reader = new StreamReader(request.InputStream, request.ContentEncoding))
                    {
                        requestBody = reader.ReadToEnd();
                    }

                    // Simple JSON extraction to avoid external JSON parser dependency
                    string canonicalString = ExtractJsonValue(requestBody, "canonicalString");

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
                "FawterX Smart Signer Bridge 🔑",
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
            
            // Setup ContentInfo for detached signature (which Egypt ETA requires)
            ContentInfo contentInfo = new ContentInfo(dataToSign);
            SignedCms signedCms = new SignedCms(contentInfo, true); // true = detached signature

            CmsSigner cmsSigner = new CmsSigner(cert);
            cmsSigner.IncludeOption = X509IncludeOption.None; // Bypass all chain-building exceptions!

            // Add the leaf certificate manually
            cmsSigner.Certificates.Add(cert);

            // Programmatically gather all Egypt Trust / ITIDA certificates from local Windows stores and manually embed them!
            try
            {
                StoreName[] storeNames = { StoreName.My, StoreName.CertificateAuthority, StoreName.Root };
                StoreLocation[] storeLocations = { StoreLocation.CurrentUser, StoreLocation.LocalMachine };

                foreach (var location in storeLocations)
                {
                    foreach (var name in storeNames)
                    {
                        try
                        {
                            using (X509Store store = new X509Store(name, location))
                            {
                                store.Open(OpenFlags.ReadOnly);
                                foreach (X509Certificate2 c in store.Certificates)
                                {
                                    string subject = c.Subject.ToLower();
                                    string issuer = c.Issuer.ToLower();

                                    // Match Egypt Trust, EgyptTrust, and ITIDA certificates
                                    if (subject.Contains("egypt trust") || subject.Contains("egypttrust") || 
                                        issuer.Contains("egypt trust") || issuer.Contains("egypttrust") ||
                                        subject.Contains("itida") || issuer.Contains("itida"))
                                    {
                                        if (c.Thumbprint != cert.Thumbprint)
                                        {
                                            Console.WriteLine("[INFO] Embedding intermediate certificate in signature store: " + c.Subject);
                                            cmsSigner.Certificates.Add(c);
                                        }
                                    }
                                }
                            }
                        }
                        catch { /* Ignore inaccessible stores */ }
                    }
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

            // Compute signature (Windows automatically prompts the user for PIN if required by USB CSP)
            signedCms.ComputeSignature(cmsSigner, false); // false = do not prompt if already cached, but will prompt PIN if needed by hardware token

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

        // Lightweight helper to extract JSON values without external libraries
        private static string ExtractJsonValue(string json, string key)
        {
            string searchKey = "\"" + key + "\"";
            int keyIndex = json.IndexOf(searchKey);
            if (keyIndex == -1) return null;

            int colonIndex = json.IndexOf(":", keyIndex + searchKey.Length);
            if (colonIndex == -1) return null;

            int startIndex = json.IndexOf("\"", colonIndex + 1);
            if (startIndex == -1) return null;

            int endIndex = json.IndexOf("\"", startIndex + 1);
            while (endIndex != -1 && json[endIndex - 1] == '\\') // handle escaped quotes
            {
                endIndex = json.IndexOf("\"", endIndex + 1);
            }

            if (endIndex == -1) return null;

            string value = json.Substring(startIndex + 1, endIndex - startIndex - 1);
            return value.Replace("\\\"", "\"").Replace("\\\\", "\\").Replace("\\n", "\n").Replace("\\r", "\r");
        }

        private static string EscapeString(string str)
        {
            if (string.IsNullOrEmpty(str)) return "";
            return str.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "\\r");
        }
    }
}
