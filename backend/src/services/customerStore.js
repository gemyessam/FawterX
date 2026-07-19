const admin = require("./firebaseAdmin");

function getDb() {
  try {
    if (admin && admin.apps && admin.apps.length > 0) {
      return admin.firestore();
    }
  } catch (e) {}
  return null;
}

function clean(value) {
  return String(value || "").trim();
}

function customerIdFrom(value) {
  const id = clean(value).replace(/[^0-9A-Za-z]/g, "");
  return id || null;
}

function normalizeCustomer(payload = {}) {
  const receiver = payload.receiver || {};
  const address = payload.address || receiver.address || {};
  const id = customerIdFrom(payload.id || payload.registrationNumber || receiver.id);

  if (!id) {
    throw new Error("Receiver registration/VAT ID is required to save a customer.");
  }

  return {
    id,
    name: clean(payload.name || receiver.name),
    type: clean(payload.type || receiver.type || "B"),
    address: {
      country: clean(address.country || "EG"),
      street: clean(address.street || address.addressLine),
      buildingNumber: clean(address.buildingNumber || "1"),
      regionCity: clean(address.regionCity),
      governate: clean(address.governate),
    },
    note: clean(payload.note),
    updatedAt: new Date().toISOString(),
  };
}

async function listCustomers(userId) {
  const db = getDb();
  if (!db) throw new Error("Firestore is not available.");

  const snapshot = await db
    .collection("users")
    .doc(userId)
    .collection("customers")
    .orderBy("updatedAt", "desc")
    .limit(200)
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function saveCustomer(userId, payload) {
  const db = getDb();
  if (!db) throw new Error("Firestore is not available.");

  const customer = normalizeCustomer(payload);
  await db
    .collection("users")
    .doc(userId)
    .collection("customers")
    .doc(customer.id)
    .set({
      ...customer,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

  return customer;
}

async function deleteCustomer(userId, customerId) {
  const db = getDb();
  if (!db) throw new Error("Firestore is not available.");

  const id = customerIdFrom(customerId);
  if (!id) throw new Error("Customer ID is required.");

  await db
    .collection("users")
    .doc(userId)
    .collection("customers")
    .doc(id)
    .delete();

  return true;
}

module.exports = { listCustomers, saveCustomer, deleteCustomer };
