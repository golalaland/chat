// adminshop.js
// Admin dashboard: auth, Firestore CRUD for shopItems, purchases management, CSV export.

// ---------------- FIREBASE IMPORTS ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  increment,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------------- CONFIG - REPLACE WITH YOURS ----------------
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---------------- DOM ----------------
const spinner = document.getElementById('shopSpinner');
const mainApp = document.getElementById('mainApp');
const loginPanel = document.getElementById('loginPanel');
const adminEmailEl = document.getElementById('adminEmail');

const productsGrid = document.getElementById('productsGrid');
const addProductBtn = document.getElementById('addProductBtn');
const productModal = document.getElementById('productModal');
const closeProductModal = document.getElementById('closeProductModal');
const saveProductBtn = document.getElementById('saveProductBtn');

const ordersList = document.getElementById('ordersList');
const exportCsvBtn = document.getElementById('exportCsvBtn');

const signOutBtn = document.getElementById('signOutBtn');
const signInBtn = document.getElementById('signInBtn');
const tryDevBtn = document.getElementById('tryDevBtn');

const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');

const modalTitle = document.getElementById('modalTitle');
const productName = document.getElementById('productName');
const productImage = document.getElementById('productImage');
const productCost = document.getElementById('productCost');
const productCashReward = document.getElementById('productCashReward');
const productAvailable = document.getElementById('productAvailable');
const productDescription = document.getElementById('productDescription');

let editingId = null;
let currentUser = null;

// ---------------- Helpers ----------------
function showSpinner(show = true) {
  spinner.classList.toggle('active', show);
}

function showToast(msg) {
  // simple toast fallback - use alert for reliability
  console.log("TOAST:", msg);
  // consider adding a on-page toast element if desired
  alert(msg);
}

// ---------------- AUTH ----------------
signOutBtn.onclick = async () => {
  await signOut(auth);
};

signInBtn.onclick = async () => {
  const email = loginEmail.value.trim();
  const pw = loginPassword.value;
  if (!email || !pw) return showToast("Enter email & password");
  showSpinner(true);
  try {
    await signInWithEmailAndPassword(auth, email, pw);
    // auth state listener handles UI load
  } catch (err) {
    console.error(err);
    showToast("Sign in failed: " + err.message);
  } finally {
    showSpinner(false);
  }
};

// Optional dev helper: create a firebase user and a Firestore admin doc.
// NOTE: remove in production or restrict.
tryDevBtn.onclick = async () => {
  const email = loginEmail.value.trim() || `admin${Date.now()}@example.com`;
  const pw = loginPassword.value || "SuperSecret123!";
  showSpinner(true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    // create users doc with isAdmin:true
    await addDoc(collection(db, "users"), {
      uid: cred.user.uid,
      email,
      isAdmin: true,
      createdAt: serverTimestamp()
    });
    showToast("Dev admin created. Sign in now.");
  } catch (e) {
    console.error(e);
    showToast("Dev create failed: " + e.message);
  } finally { showSpinner(false); }
};

// Auth listener: ensure user doc has isAdmin:true
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (!user) {
    // show login
    mainApp.style.display = "none";
    loginPanel.style.display = "block";
    return;
  }

  // check user doc: we look in `users` collection for document with uid === user.uid
  // You might store user docs with uid as doc id; support both patterns:
  showSpinner(true);
  try {
    // Try doc with uid as ID first
    let userDocRef = doc(db, "users", user.uid);
    let userSnap = await getDoc(userDocRef);
    if (!userSnap.exists()) {
      // fallback: query users collection for a doc where uid === user.uid
      const q = query(collection(db, "users"), where("uid", "==", user.uid));
      const results = await getDocs(q);
      if (!results.empty) {
        userSnap = results.docs[0];
      }
    }

    if (!userSnap || !userSnap.exists()) {
      showToast("No user record found in 'users' collection. Create a user doc with isAdmin:true.");
      await signOut(auth);
      return;
    }

    const data = userSnap.data();
    if (!data.isAdmin) {
      showToast("Access denied: user is not an admin.");
      await signOut(auth);
      return;
    }

    // success: show main app
    adminEmailEl.textContent = user.email || data.email || "Admin";
    loginPanel.style.display = "none";
    mainApp.style.display = "block";

    // initial load
    loadProducts();
    loadPurchases();
  } catch (err) {
    console.error(err);
    showToast("Auth check failed: " + err.message);
    await signOut(auth);
  } finally {
    showSpinner(false);
  }
});

// ---------------- TABS ----------------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    const tab = e.target.dataset.tab;
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    document.getElementById(tab + '-section').classList.add('active');
    if (tab === 'products') loadProducts();
    if (tab === 'orders') loadPurchases();
  });
});

// ---------------- PRODUCTS CRUD ----------------
addProductBtn.onclick = () => {
  editingId = null;
  modalTitle.innerText = "Add Product";
  productName.value = "";
  productImage.value = "";
  productCost.value = "";
  productCashReward.value = "";
  productAvailable.value = "";
  productDescription.value = "";
  productModal.style.display = "flex";
};

closeProductModal.onclick = () => productModal.style.display = "none";

saveProductBtn.onclick = async () => {
  const docData = {
    name: productName.value.trim(),
    img: productImage.value.trim() || "",
    cost: Number(productCost.value) || 0,
    cashReward: Number(productCashReward.value) || 0,
    available: Number(productAvailable.value) || 0,
    description: productDescription.value.trim(),
    updatedAt: serverTimestamp()
  };

  if (!docData.name) return showToast("Name required");

  showSpinner(true);
  try {
    if (editingId) {
      await updateDoc(doc(db, "shopItems", editingId), docData);
      showToast("Product updated");
    } else {
      // If your current shopItems require numeric `id` field, auto-calc next id (optional)
      // we will create a doc and leave `id` if you prefer manual numeric ids
      await addDoc(collection(db, "shopItems"), { ...docData, createdAt: serverTimestamp() });
      showToast("Product added");
    }
    productModal.style.display = "none";
    loadProducts();
  } catch (err) {
    console.error(err);
    showToast("Save failed: " + err.message);
  } finally { showSpinner(false); }
};

async function loadProducts() {
  showSpinner(true);
  productsGrid.innerHTML = "";
  try {
    const snap = await getDocs(collection(db, "shopItems"));
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const docId = docSnap.id;
      productsGrid.insertAdjacentHTML('beforeend', productCardHTML(docId, d));
    });
  } catch (err) {
    console.error(err);
    showToast("Load products failed: " + err.message);
  } finally { showSpinner(false); }
}

function productCardHTML(id, d) {
  return `
    <div class="product-card" data-id="${id}">
      <img src="${escapeHtml(d.img || '')}" alt="${escapeHtml(d.name || '')}">
      <h3>${escapeHtml(d.name || '')}</h3>
      <div class="meta">Cost: ${Number(d.cost || 0)} ⭐ • ₦${Number(d.cashReward || 0)}</div>
      <div class="meta">Available: ${Number(d.available || 0)}</div>
      <div class="user-details">${escapeHtml(d.description || '')}</div>
      <div class="admin-btns">
        <button class="edit-btn" onclick="window.__editProduct('${id}')">Edit</button>
        <button class="delete-btn" onclick="window.__deleteProduct('${id}')">Delete</button>
      </div>
    </div>
  `;
}

// expose global edit/delete for the rendered HTML buttons
window.__editProduct = async function(id) {
  showSpinner(true);
  try {
    const snap = await getDoc(doc(db, "shopItems", id));
    if (!snap.exists()) return showToast("Product not found");
    const d = snap.data();
    editingId = id;
    modalTitle.innerText = "Edit Product";
    productName.value = d.name || "";
    productImage.value = d.img || "";
    productCost.value = d.cost || "";
    productCashReward.value = d.cashReward || "";
    productAvailable.value = d.available || "";
    productDescription.value = d.description || "";
    productModal.style.display = "flex";
  } catch (err) {
    console.error(err);
    showToast("Failed to open edit: " + err.message);
  } finally { showSpinner(false); }
};

window.__deleteProduct = async function(id) {
  if (!confirm("Delete this product?")) return;
  showSpinner(true);
  try {
    await deleteDoc(doc(db, "shopItems", id));
    showToast("Product deleted");
    loadProducts();
  } catch (err) {
    console.error(err);
    showToast("Delete failed: " + err.message);
  } finally { showSpinner(false); }
};

// ---------------- PURCHASES ----------------
async function loadPurchases() {
  showSpinner(true);
  ordersList.innerHTML = "";
  try {
    const q = query(collection(db, "purchases"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    if (snap.empty) {
      ordersList.innerHTML = `<div class="small muted">No purchases yet</div>`;
      return;
    }
    // Build rows
    for (const docSnap of snap.docs) {
      const o = docSnap.data();
      const id = docSnap.id;
      // fetch purchaser user details if exist
      let userDetails = { email: o.userEmail || o.user || '—' };
      try {
        // attempt to load users doc by uid or email
        if (o.userId) {
          const udoc = await getDoc(doc(db, "users", o.userId));
          if (udoc.exists()) userDetails = udoc.data();
          else {
            // fallback query by email
            const q2 = query(collection(db, "users"), where("email", "==", o.userEmail || o.user || ""));
            const res = await getDocs(q2);
            if (!res.empty) userDetails = res.docs[0].data();
          }
        } else if (o.userEmail) {
          const q2 = query(collection(db, "users"), where("email", "==", o.userEmail));
          const res = await getDocs(q2);
          if (!res.empty) userDetails = res.docs[0].data();
        }
      } catch(e){ console.warn("user lookup failed", e) }

      ordersList.insertAdjacentHTML('beforeend', purchaseRowHTML(id, o, userDetails));
    }
  } catch (err) {
    console.error(err);
    showToast("Load purchases failed: " + err.message);
  } finally { showSpinner(false); }
}

function purchaseRowHTML(id, o, user) {
  const status = o.status || 'pending';
  const paymentDesc = (o.paymentType === 'stars') ? `${o.amount} ⭐` : `₦${o.amount}`;
  const userInfo = `
    <div class="user-details">
      <div><strong>${escapeHtml(user.displayName || user.email || o.userEmail || o.user || '—')}</strong></div>
      <div class="small muted">Email: ${escapeHtml(user.email || o.userEmail || '—')}</div>
      <div class="small muted">Stars: ${Number(user.stars || 0)} • Cash: ₦${Number(user.cash || 0)}</div>
    </div>
  `;

  return `
    <div class="order-item" data-id="${id}">
      <div class="order-row">
        <div style="flex:1">
          <div><strong>${escapeHtml(o.productName || o.productId || '—')}</strong> • <span class="small muted">${new Date(o.createdAt?.toDate ? o.createdAt.toDate() : o.createdAt || Date.now()).toLocaleString()}</span></div>
          <div class="small muted">Buyer: ${escapeHtml(o.userEmail || o.user || o.userId || '—')}</div>
          <div class="small muted">Payment: ${escapeHtml(paymentDesc)}</div>
          <div class="small muted">Status: <span class="badge">${escapeHtml(status)}</span></div>
          ${userInfo}
        </div>
        <div style="display:flex;flex-direction:column;justify-content:center">
          <div>
            <button class="fulfill-btn" onclick="window.__fulfillPurchase('${id}')">Fulfill</button>
            <button class="refund-btn" onclick="window.__refundPurchase('${id}')">Refund</button>
          </div>
          <div style="margin-top:10px">
            <button class="themed-btn ghost" onclick="window.__viewPurchase('${id}')">View Raw</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// expose view raw (simple alert)
window.__viewPurchase = async function(id) {
  const snap = await getDoc(doc(db, "purchases", id));
  if (!snap.exists()) return showToast("Purchase not found");
  alert(JSON.stringify(snap.data(), null, 2));
};

// fulfill
window.__fulfillPurchase = async function(id) {
  if (!confirm("Mark as fulfilled?")) return;
  showSpinner(true);
  try {
    await updateDoc(doc(db, "purchases", id), { status: "fulfilled", fulfilledAt: serverTimestamp() });
    showToast("Marked fulfilled");
    loadPurchases();
  } catch (err) {
    console.error(err);
    showToast("Fulfill failed: " + err.message);
  } finally { showSpinner(false); }
};

// refund
window.__refundPurchase = async function(id) {
  if (!confirm("Issue refund for this purchase?")) return;
  showSpinner(true);
  try {
    const psnap = await getDoc(doc(db, "purchases", id));
    if (!psnap.exists()) throw new Error("Purchase not found");
    const p = psnap.data();

    // determine payment type (stars or cash)
    const type = p.paymentType || (p.amount && p.currency === 'NGN' ? 'cash' : 'stars');
    const amount = Number(p.amount || p.cost || 0);
    const userId = p.userId || null;
    const userEmail = p.userEmail || null;

    if (type === 'stars') {
      if (!userId) {
        // try find user doc by email and get doc id
        if (!userEmail) throw new Error("No user reference to refund stars");
        const q = query(collection(db, "users"), where("email", "==", userEmail));
        const res = await getDocs(q);
        if (res.empty) throw new Error("User record not found for email");
        // update first match
        const udoc = res.docs[0];
        await updateDoc(doc(db, "users", udoc.id), { stars: increment(amount) });
      } else {
        await updateDoc(doc(db, "users", userId), { stars: increment(amount) });
      }
    } else { // cash
      // log cash refund in /refunds for manual processing
      await addDoc(collection(db, "refunds"), {
        orderId: id,
        userId: userId || null,
        userEmail: userEmail || null,
        amount,
        method: "cash",
        createdAt: serverTimestamp()
      });
    }

    await updateDoc(doc(db, "purchases", id), { status: "refunded", refundedAt: serverTimestamp(), refundMethod: type });
    showToast("Refund issued (stars returned or cash refund logged)");
    loadPurchases();
  } catch (err) {
    console.error(err);
    showToast("Refund failed: " + err.message);
  } finally { showSpinner(false); }
};

// ---------------- CSV EXPORT ----------------
exportCsvBtn.onclick = async () => {
  showSpinner(true);
  try {
    const rows = [];
    const snap = await getDocs(query(collection(db, "purchases"), orderBy("createdAt", "desc")));
    if (snap.empty) return showToast("No purchases to export");

    // header
    rows.push(["purchaseId","createdAt","userId","userEmail","productId","productName","amount","paymentType","status","fulfilledAt","refundedAt"].join(","));

    for (const docSnap of snap.docs) {
      const o = docSnap.data();
      const createdAt = o.createdAt?.toDate ? o.createdAt.toDate().toISOString() : (o.createdAt || "");
      const fulfilledAt = o.fulfilledAt?.toDate ? o.fulfilledAt.toDate().toISOString() : "";
      const refundedAt = o.refundedAt?.toDate ? o.refundedAt.toDate().toISOString() : "";
      const row = [
        `"${docSnap.id}"`,
        `"${createdAt}"`,
        `"${(o.userId||'')}"`,
        `"${(o.userEmail||'')}"`,
        `"${(o.productId||'')}"`,
        `"${(o.productName||'')}"`,
        `"${(o.amount||'')}"`,
        `"${(o.paymentType||'')}"`,
        `"${(o.status||'')}"`,
        `"${fulfilledAt}"`,
        `"${refundedAt}"`
      ].join(",");
      rows.push(row);
    }

    const csvString = rows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchases_${(new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("CSV exported");
  } catch (err) {
    console.error(err);
    showToast("CSV export failed: " + err.message);
  } finally { showSpinner(false); }
};

// ---------------- Utilities ----------------
function escapeHtml(s) {
  if (!s) return "";
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'", "&#039;");
}