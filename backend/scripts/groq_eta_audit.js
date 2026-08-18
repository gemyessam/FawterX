const fs = require("fs");
const path = require("path");

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

const basePath = path.resolve(__dirname, "..");
const filesToReview = [
  "src/routes/eta.js",
  "src/routes/excel.js",
  "src/routes/invoice.js",
  "src/services/draftStore.js",
  "src/services/customerStore.js",
  "src/routes/admin.js"
];

let codebaseContext = "";
for (const rel of filesToReview) {
  const full = path.join(basePath, rel);
  if (fs.existsSync(full)) {
    codebaseContext += `\n\n=== FILE: ${rel} ===\n` + fs.readFileSync(full, "utf8");
  }
}

async function callGroq(messages) {
  const modelsToTry = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"];
  let lastErr = null;

  for (const model of modelsToTry) {
    try {
      console.log(`[Groq API] Sending ETA & Invoice audit payload to ${model}...`);
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || JSON.stringify(data));
      }
      console.log(`[Groq API] ✅ Model ${model} responded successfully!`);
      return data.choices[0].message.content;
    } catch (err) {
      console.warn(`[Groq API] Model ${model} failed: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr;
}

async function runAudit() {
  console.log("🚀 Starting In-Depth ETA & Invoice System Audit with Groq AI...\n");

  const prompt = `You are a Senior Principal Enterprise Architect & Egyptian Tax Authority (ETA) e-Invoicing Specialist.
You are reviewing the core business modules of FawterX:
1. **ETA Integration** (\`src/routes/eta.js\`): Direct connection to Egyptian Tax Authority API (Production / Pre-Production), token caching, digital signatures, and invoice submission.
2. **Excel & Invoice Handling** (\`src/routes/excel.js\`, \`src/routes/invoice.js\`): Parsing uploaded invoices, tax lines (VAT 14%, Withholding Tax), and validation.
3. **Multi-Tenant Scoping** (\`src/services/draftStore.js\`, \`src/services/customerStore.js\`): Drafts and customer profiles isolated per \`userId\`.
4. **Admin Console** (\`src/routes/admin.js\`): Quota tracking, subscriptions, user management.

Here is the source code for these modules:
${codebaseContext.slice(0, 24000)}

Please provide your comprehensive analysis:
1. **What is working great** in the implementation?
2. **What potential edge cases, logic traps, or performance bottlenecks** do you see?
3. **What high-value improvements** (for ETA compliance, calculation precision, or scaling) do you recommend?
Be direct, structured, and insightful.`;

  const messages = [
    {
      role: "system",
      content: "You are an elite Senior Enterprise Architect specializing in Egyptian Tax Authority e-Invoicing and Node.js multi-tenant SaaS."
    },
    {
      role: "user",
      content: prompt
    }
  ];

  const response = await callGroq(messages);
  console.log("\n🤖 Groq AI Analysis:\n" + response);

  fs.writeFileSync(
    path.join(__dirname, "eta_audit_transcript.json"),
    JSON.stringify({ auditResponse: response }, null, 2),
    "utf8"
  );
}

runAudit().catch(err => {
  console.error("❌ Audit Error:", err.message);
  process.exit(1);
});
