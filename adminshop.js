// adminshop.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ------------------- Firebase Config ------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyDbKz4ef_eUDlCukjmnK38sOwueYuzqoao",
  authDomain: "metaverse-1010.firebaseapp.com",
  projectId: "metaverse-1010",
  storageBucket: "metaverse-1010.appspot.com",
  messagingSenderId: "1044064238233",
  appId: "1:1044064238233:web:2fbdfb811cb0a3ba349608",
  databaseURL: "https://metaverse-1010-default-rtdb.firebaseio.com/"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ------------------- DOM References ------------------- */
const loginPage = document.getElementById('loginPage');
const adminEmailInput = document.getElementById('adminEmail');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const loginMsg = document.getElementById('loginMsg');

const dashboard = document.getElementById('dashboard');
const logoutBtn = document.getElementById('logoutBtn');
const spinner = document.getElementById('spinner');
const alertMsg = document.getElementById('alertMsg');

const usersList = document.getElementById('usersList');
const productsList = document.getElementById('productsList');
const ordersList = document.getElementById('ordersList');

const addProductBtn = document.getElementById('addProductBtn');
const productModal = document.getElementById('productModal');
const closeProductModalBtn = document.getElementById('closeProductModal');

const prodName = document.getElementById('prodName');
const prodImg = document.getElementById('prodImg');
const prodStars = document.getElementById('prodStars');
const prodCash = document.getElementById('prodCash');
const prodQty = document.getElementById('prodQty');

/* Extra field for description */
let prodDescInput = document.createElement('textarea');
prodDescInput.id = 'prodDesc';
prodDescInput.placeholder = "Product Description";
prodDescInput.style.width = '100%';
prodDescInput.style.height = '60px';
prodDescInput.style.marginBottom = '10px';
productModal.querySelector('.modal').insertBefore(prodDescInput, productModal.querySelector('#saveProductBtn'));

let editingProductId = null;

/* ------------------- Helper Functions ------------------- */
const showSpinner = () => spinner.style.display = 'block';
const hideSpinner = () => spinner.style.display = 'none';
const showAlert = (msg, duration = 2500) => {
  alertMsg.textContent = msg;
  alertMsg.style.display = 'block';
  setTimeout(() => alertMsg.style.display = 'none', duration);
};
const resetProductModal = () => {
  prodName.value = '';
  prodImg.value = '';
  prodStars.value = '';
  prodCash.value = '';
  prodQty.value = '';
  prodDescInput.value = '';
  editingProductId = null;
};

/* ------------------- Admin Login ------------------- */
adminLoginBtn.addEventListener('click', async () => {
  const email = adminEmailInput.value.trim();
  if (!email) return showAlert("Enter admin email");

  showSpinner();
  loginMsg.textContent = '';
  try {
    const q = query(collection(db, 'admins'), where('email', '==', email));
    const snap = await getDocs(q);
    if (!snap.empty) {
      // Success
      loginPage.classList.add('hidden');
      dashboard.classList.remove('hidden');
      loadDashboard();
    } else {
      loginMsg.textContent = 'Access denied';
    }
  } catch (e) {
    console.error(e);
    loginMsg.textContent = 'Login error';
  } finally {
    hideSpinner();
  }
});

/* ------------------- Logout ------------------- */
logoutBtn.addEventListener('click', () => {
  dashboard.classList.add('hidden');
  loginPage.classList.remove('hidden');
  adminEmailInput.value = '';
});

/* ------------------- Load Dashboard ------------------- */
async function loadDashboard() {
  await loadUsers();
  await loadProducts();
  await loadOrders();
}

/* ------------------- Users ------------------- */
async function loadUsers() {
  showSpinner();
  try {
    const snap = await getDocs(collection(db, 'users'));
    if (snap.empty) { usersList.innerHTML = 'No users'; return; }

    let html = `<table>
      <tr><th>Email</th><th>Stars</th><th>Cash</th></tr>`;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      html += `<tr>
        <td>${data.email || ''}</td>
        <td>${data.stars || 0}</td>
        <td>₦${data.cash || 0}</td>
      </tr>`;
    });
    html += `</table>`;
    usersList.innerHTML = html;
  } catch (e) { console.error(e); usersList.innerHTML = 'Failed to load users'; }
  finally { hideSpinner(); }
}

/* ------------------- Products ------------------- */
addProductBtn.addEventListener('click', () => {
  resetProductModal();
  productModal.style.display = 'flex';
});

closeProductModalBtn.addEventListener('click', () => productModal.style.display = 'none');

async function loadProducts() {
  showSpinner();
  try {
    const snap = await getDocs(collection(db, 'shopItems'));
    if (snap.empty) { productsList.innerHTML = 'No products'; return; }

    let html = `<table>
      <tr><th>Name</th><th>Stars</th><th>Cash</th><th>Qty</th><th>Actions</th></tr>`;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const id = docSnap.id;
      html += `<tr>
        <td><span class="prodName" data-id="${id}" style="cursor:pointer;color:#0077cc;">${data.name}</span></td>
        <td>${data.cost || 0}</td>
        <td>₦${data.cashReward || 0}</td>
        <td>${data.available || 0}</td>
        <td>
          <button class="editProdBtn" data-id="${id}">Edit</button>
          <button class="deleteProdBtn" data-id="${id}">Delete</button>
        </td>
      </tr>`;
    });
    html += `</table>`;
    productsList.innerHTML = html;

    // Add event listeners for edit, delete, and description modal
    document.querySelectorAll('.editProdBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const docSnap = await getDoc(doc(db, 'shopItems', id));
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        prodName.value = data.name || '';
        prodImg.value = data.img || '';
        prodStars.value = data.cost || '';
        prodCash.value = data.cashReward || '';
        prodQty.value = data.available || '';
        prodDescInput.value = data.description || '';
        editingProductId = id;
        productModal.style.display = 'flex';
      });
    });

    document.querySelectorAll('.deleteProdBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (!confirm('Delete this product?')) return;
        try { await deleteDoc(doc(db, 'shopItems', id)); showAlert('Product deleted'); await loadProducts(); } 
        catch(e){ console.error(e); showAlert('Delete failed'); }
      });
    });

    document.querySelectorAll('.prodName').forEach(span => {
      span.addEventListener('click', async () => {
        const id = span.dataset.id;
        const docSnap = await getDoc(doc(db, 'shopItems', id));
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        alert(`Description:\n\n${data.description || 'No description yet.'}`);
      });
    });

  } catch (e) { console.error(e); productsList.innerHTML = 'Failed to load products'; }
  finally { hideSpinner(); }
}

/* ------------------- Save Product ------------------- */
document.getElementById('saveProductBtn').addEventListener('click', async () => {
  const name = prodName.value.trim();
  const img = prodImg.value.trim();
  const cost = Number(prodStars.value) || 0;
  const cashReward = Number(prodCash.value) || 0;
  const available = Number(prodQty.value) || 0;
  const description = prodDescInput.value.trim();

  if (!name) return showAlert('Product name required');
  showSpinner();

  try {
    if (editingProductId) {
      // update
      await updateDoc(doc(db, 'shopItems', editingProductId), { name, img, cost, cashReward, available, description });
      showAlert('Product updated');
    } else {
      // create
      const newDoc = doc(collection(db, 'shopItems'));
      await setDoc(newDoc, { name, img, cost, cashReward, available, description, createdAt: serverTimestamp() });
      showAlert('Product added');
    }
    productModal.style.display = 'none';
    await loadProducts();
  } catch (e) {
    console.error(e);
    showAlert('Failed to save product');
  } finally { hideSpinner(); }
});

/* ------------------- Orders ------------------- */
async function loadOrders() {
  showSpinner();
  try {
    const snap = await getDocs(collection(db, 'purchases'));
    if (snap.empty) { ordersList.innerHTML = 'No orders'; return; }

    let html = `<table>
      <tr><th>User</th><th>Product</th><th>Stars</th><th>Cash</th><th>Timestamp</th><th>Action</th></tr>`;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const ts = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : '';
      html += `<tr>
        <td>${data.email || ''}</td>
        <td>${data.productName || ''}</td>
        <td>${data.cost || 0}</td>
        <td>₦${data.cashReward || data.redeemedCash || 0}</td>
        <td>${ts}</td>
        <td><button class="refundBtn" data-id="${docSnap.id}">Refund</button></td>
      </tr>`;
    });
    html += `</table>`;
    ordersList.innerHTML = html;

    document.querySelectorAll('.refundBtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (!confirm('Refund this order?')) return;
        showSpinner();
        try {
          const orderRef = doc(db, 'purchases', id);
          await runTransaction(db, async (t) => {
            const orderSnap = await t.get(orderRef);
            if (!orderSnap.exists()) throw new Error('Order not found');
            const data = orderSnap.data();

            // Refund stars/cash to user
            const userRef = doc(db, 'users', data.userId);
            const userSnap = await t.get(userRef);
            if (!userSnap.exists()) throw new Error('User not found');
            const userData = userSnap.data();
            const newStars = (Number(userData.stars) || 0) + (Number(data.cost) || 0);
            const newCash = (Number(userData.cash) || 0) + (Number(data.redeemedCash || data.cashReward) || 0);
            t.update(userRef, { stars: newStars, cash: newCash });

            // Restore product quantity
            const prodRef = doc(db, 'shopItems', data.productId);
            const prodSnap = await t.get(prodRef);
            if (prodSnap.exists()) {
              const newQty = (Number(prodSnap.data().available) || 0) + 1;
              t.update(prodRef, { available: newQty });
            }

            // Delete order
            t.delete(orderRef);
          });
          showAlert('Order refunded');
          await loadOrders();
          await loadProducts();
          await loadUsers();
        } catch (e) { console.error(e); showAlert('Refund failed'); }
        finally { hideSpinner(); }
      });
    });

  } catch (e) { console.error(e); ordersList.innerHTML = 'Failed to load orders'; }
  finally { hideSpinner(); }
}