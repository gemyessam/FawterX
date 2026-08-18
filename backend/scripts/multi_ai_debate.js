const fs = require("fs");
const path = require("path");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

// Load relevant codebase files
const basePath = path.resolve(__dirname, "..");
const filesToReview = [
  "src/middleware/auth.js",
  "src/middleware/security.js",
  "src/routes/warehouse.js",
  "src/services/warehouseStore.js",
  "src/routes/admin.js",
  "src/services/adminStore.js",
  "src/routes/eta.js",
  "../frontend/src/App.jsx",
  "../frontend/src/pages/Warehouse.jsx"
];

let codebaseContext = "";
for (const rel of filesToReview) {
  const full = path.join(basePath, rel);
  if (fs.existsSync(full)) {
    codebaseContext += `\n\n=== FILE: ${rel} ===\n` + fs.readFileSync(full, "utf8");
  }
}

async function callOpenAI(messages) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.2,
      messages
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI API Error: ${data.error?.message || JSON.stringify(data)}`);
  }
  return data.choices[0].message.content;
}

async function runDebate() {
  console.log("🚀 Starting Autonomous Multi-Agent Security Debate between Gemini and OpenAI GPT-4o...\n");

  const conversationHistory = [
    {
      role: "system",
      content: `You are a Senior Principal Security Engineer and Multi-Tenant SaaS Architect. You are auditing the FawterX platform (an Egyptian Tax Authority ERP & Warehouse Management SaaS). You are in a technical dialectic debate with the Lead System Architect (Antigravity/Gemini). Your goal is to conduct an uncompromising, high-level security, authorization, multi-tenant isolation, and reliability audit of the codebase provided.`
    }
  ];

  // ——— ROUND 1: Gemini presents code & asks OpenAI to find all edge cases and vulnerabilities ———
  console.log("================================================================================");
  console.log("🗣️ ROUND 1: Gemini (Lead Architect) -> OpenAI GPT-4o (Security Red Team)");
  console.log("================================================================================");
  const promptRound1 = `Hello OpenAI! I am the Lead Architect for FawterX. We just patched an issue where revoking warehouse permissions wasn't taking effect immediately and hardened our cryptographic token verification.

Here is our active codebase context for Auth, RBAC, Admin, Warehouse, and ETA integration:
${codebaseContext.slice(0, 75000)}

Please review our codebase thoroughly. 
1. What edge-case vulnerabilities, authorization bypasses, or multi-tenant leaks could still exist?
2. What are the top 3-5 high-impact architectural security enhancements you recommend we implement right now?
Be extremely technical, specific (referencing functions/files), and concise.`;

  conversationHistory.push({ role: "user", content: promptRound1 });

  console.log("⏳ Awaiting GPT-4o's initial audit response...");
  const replyRound1 = await callOpenAI(conversationHistory);
  console.log("\n🤖 OpenAI GPT-4o (Round 1 Response):\n" + replyRound1 + "\n");
  conversationHistory.push({ role: "assistant", content: replyRound1 });

  // ——— ROUND 2: Gemini debates, refines solutions, and asks GPT-4o for consensus ———
  console.log("================================================================================");
  console.log("🗣️ ROUND 2: Gemini (Lead Architect) -> OpenAI GPT-4o (Refining & Solutions)");
  console.log("================================================================================");
  const promptRound2 = `Thank you for this thorough analysis! 

Let's reach an exact engineering consensus on addressing your points:
1. Regarding Instant Session / Status Invalidation: We plan to add a fast memory-cached or direct Firestore check in \`authMiddleware\` so if a user has \`status === 'suspended'\` or \`status === 'blocked'\`, they are immediately rejected with 403.
2. Regarding Secret Encryption at Rest: We plan to encrypt ETA Client Secrets using AES-256-GCM before writing to \`users/{uid}\` in Firestore using an \`ENCRYPTION_KEY\` env var.
3. Regarding Project-level Isolation & Fine-grained Mutations: We will verify that in all warehouse routes, \`req.warehouseAccess.allowedProjects\` is strictly checked against the target project document, and ensure users cannot access other tenants' documents.
4. Regarding Formula Injection (CSV/Excel): We will sanitize any cell starting with '=', '+', '-', '@' before Excel export/processing.

Do you agree with this concrete implementation plan? Are there any hidden flaws in these proposed fixes, or do we have full consensus to proceed?`;

  conversationHistory.push({ role: "user", content: promptRound2 });

  console.log("⏳ Awaiting GPT-4o's second round review...");
  const replyRound2 = await callOpenAI(conversationHistory);
  console.log("\n🤖 OpenAI GPT-4o (Round 2 Consensus Response):\n" + replyRound2 + "\n");
  conversationHistory.push({ role: "assistant", content: replyRound2 });

  // Save the full debate log
  fs.writeFileSync(
    path.join(basePath, "scripts", "debate_log.json"),
    JSON.stringify(conversationHistory, null, 2),
    "utf8"
  );

  console.log("✅ Debate completed and logged successfully!");
}

runDebate().catch(err => {
  console.error("❌ Debate error:", err.message);
  process.exit(1);
});
