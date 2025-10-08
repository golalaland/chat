// ---------- FIREBASE IMPORTS ----------
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbKz4ef_eUDlCukjmnK38sOwueYuzqoao",
  authDomain: "metaverse-1010.firebaseapp.com",
  projectId: "metaverse-1010",
  storageBucket: "metaverse-1010.firebasestorage.app",
  messagingSenderId: "1044064238233",
  appId: "1:1044064238233:web:2fbdfb811cb0a3ba349608",
  measurementId: "G-S77BMC266C"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- ELEMENTS ----------
const spinner = document.getElementById('shopSpinner');
const productsGrid = document.getElementById('productsGrid');
const addProductBtn = document.getElementById('addProductBtn');
const modal = document.getElementById('productModal');
const closeModal = document.getElementById('closeProductModal');
const saveProductBtn = document.getElementById('saveProductBtn');

// ---------- SPINNER ----------
function showSpinner(show = true) {
  spinner.classList.toggle('active', show);
}

// ---------- LOAD PRODUCTS ----------
async function loadProducts() {
  showSpinner(true);
  const snap = await getDocs(collection(db, "products"));
  productsGrid.innerHTML = '';
  snap.forEach(docSnap => {
    const d = docSnap.data();
    productsGrid.innerHTML += `
      <div class="product-card">
        <img src="${d.image || ''}" alt="">
        <h3>${d.name}</h3>
        <p>${d.description || ''}</p>
        <div>${d.priceStars} ⭐ or ₦${d.priceCash}</div>
        <div class="admin-btns">
          <button class="edit-btn" onclick="editProduct('${docSnap.id}')">Edit</button>
          <button class="delete-btn" onclick="deleteProduct('${docSnap.id}')">Delete</button>
        </div>
      </div>
    `;
  });
  showSpinner(false);
}

// ---------- ADD / EDIT PRODUCT ----------
let editingId = null;

window.editProduct = async function (id) {
  editingId = id;
  const ref = doc(db, "products", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return alert("Product not found");
  const d = snap.data();

  document.getElementById('modalTitle').innerText = 'Edit Product';
  document.getElementById('productName').value = d.name;
  document.getElementById('productDesc').value = d.description;
  document.getElementById('productStars').value = d.priceStars;
  document.getElementById('productCash').value = d.priceCash;
  document.getElementById('productImage').value = d.image;
  document.getElementById('productAvailable').checked = d.available;
  modal.classList.remove('hidden');
};

window.deleteProduct = async function (id) {
  if (!confirm('Delete product?')) return;
  await deleteDoc(doc(db, "products", id));
  loadProducts();
};

addProductBtn.onclick = () => {
  editingId = null;
  document.getElementById('modalTitle').innerText = 'Add Product';
  document.querySelectorAll('#productModal input, #productModal textarea').forEach(el => el.value = '');
  document.getElementById('productAvailable').checked = true;
  modal.classList.remove('hidden');
};

closeModal.onclick = () => modal.classList.add('hidden');

saveProductBtn.onclick = async () => {
  const product = {
    name: document.getElementById('productName').value.trim(),
    description: document.getElementById('productDesc').value.trim(),
    priceStars: Number(document.getElementById('productStars').value),
    priceCash: Number(document.getElementById('productCash').value),
    image: document.getElementById('productImage').value.trim(),
    available: document.getElementById('productAvailable').checked,
    updatedAt: serverTimestamp()
  };

  if (!product.name) return alert('Product name required');

  showSpinner(true);
  if (editingId) {
    await updateDoc(doc(db, "products", editingId), product);
  } else {
    await addDoc(collection(db, "products"), { ...product, createdAt: serverTimestamp() });
  }
  modal.classList.add('hidden');
  showSpinner(false);
  loadProducts();
};

// ---------- LOAD ORDERS ----------
async function loadOrders() {
  showSpinner(true);
  const ordersList = document.getElementById('ordersList');
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  ordersList.innerHTML = '';
  snap.forEach(docSnap => {
    const o = docSnap.data();
    ordersList.innerHTML += `
      <div class="order-item">
        <p><strong>${o.userId}</strong> bought <em>${o.productName || o.productId}</em></p>
        <p>Payment: ${o.paymentType === 'stars' ? o.amount + ' ⭐' : '₦' + o.amount}</p>
        <p>Status: <b>${o.status}</b></p>
        <div class="order-actions">
          <button class="fulfill-btn" onclick="markFulfilled('${docSnap.id}')">Fulfill</button>
          <button class="refund-btn" onclick="issueRefund('${docSnap.id}', '${o.userId}', '${o.paymentType}', ${o.amount})">Refund</button>
        </div>
      </div>
    `;
  });
  showSpinner(false);
}

// ---------- FULFILL / REFUND ----------
window.markFulfilled = async function (id) {
  await updateDoc(doc(db, "orders", id), {
    status: "fulfilled",
    fulfilledAt: serverTimestamp()
  });
  loadOrders();
};

// 🧾 Refund logic with auto-detect for stars or cash
window.issueRefund = async function (orderId, userId, paymentType, amount) {
  if (!confirm('Refund this order?')) return;

  const orderRef = doc(db, "orders", orderId);
  const userRef = doc(db, "users", userId);

  showSpinner(true);

  if (paymentType === 'stars') {
    // Refund in stars
    await updateDoc(userRef, {
      stars: increment(amount)
    });
  } else if (paymentType === 'cash') {
    // You could also log a cash refund manually to your records
    await addDoc(collection(db, "refunds"), {
      userId,
      amount,
      method: "cash",
      orderId,
      createdAt: serverTimestamp()
    });
  }

  await updateDoc(orderRef, { status: "refunded", refundedAt: serverTimestamp() });
  showSpinner(false);
  loadOrders();
};

// ---------- TAB SWITCHING ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', e => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    document.querySelectorAll('.tab-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`${e.target.dataset.tab}-section`).classList.add('active');
    if (e.target.dataset.tab === 'products') loadProducts();
    if (e.target.dataset.tab === 'orders') loadOrders();
  });
});

// ---------- INITIAL LOAD ----------
loadProducts();