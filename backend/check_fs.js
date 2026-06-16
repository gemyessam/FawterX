const admin = require('./src/services/firebaseAdmin');

async function check() {
  const db = admin.firestore();
  const snapshot = await db.collection('users').get();
  console.log("Total users:", snapshot.size);
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log("User:", doc.id);
    console.log("Company Settings:", data.companySettings ? "EXISTS" : "MISSING");
    if (data.companySettings) {
       console.log("Keys:", Object.keys(data.companySettings));
    }
    console.log("----------------------");
  });
}
check().catch(console.error).finally(() => process.exit(0));
