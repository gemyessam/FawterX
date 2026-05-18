const admin = require("./src/services/firebaseAdmin");

async function test() {
  console.log("=== Testing Firebase Connection ===");
  try {
    const db = admin.firestore();
    console.log("Firestore obtained. Writing test doc...");
    const ref = db.collection("users").doc("choco-egypt-uid-custom-bypass");
    await ref.set({
      testField: "Hello World",
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log("Test doc written successfully!");
    
    console.log("Reading test doc...");
    const snap = await ref.get();
    console.log("Test doc read successfully! Data:", snap.data());
    
    console.log("=== Firebase Connection Succeeded perfectly! ===");
    process.exit(0);
  } catch (error) {
    console.error("=== Firebase Connection Failed! ===", error);
    process.exit(1);
  }
}

test();
