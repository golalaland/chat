// adminshop.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc, setDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ------------------ Firebase ------------------ */
const firebaseConfig = {
  apiKey: "AIzaSyDbKz4ef_eUDlCukjmnK38sOwueYuzqoao",
  authDomain: "metaverse-1010.firebaseapp.com",
  projectId: "metaverse-1010",
  storageBucket: "metaverse-1010.appspot.com",
  messagingSenderId: "1044064238233",
  appId: "1:1044064238233:web:2fbdfb811cb0a3ba349608",
  measurementId: "G-S77BMC266C",
  databaseURL: "https://metaverse-1010-default-rtdb.firebaseio.com/"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ------------------ DOM ------------------ */
const loginPage = document.getElementById('loginPage');
const dashboard = document.getElementById('dashboard');
const loginBtn = document.getElementById('adminLoginBtn');
const loginMsg = document.getElementById('loginMsg');
const adminEmailInput = document.getElementById('adminEmail');
const logoutBtn = document.getElementById('logoutBtn');
const usersList = document.getElementById('usersList');
const productsList = document.getElementById('productsList');
const ordersList = document.getElementById('ordersList');
const addProductBtn = document.getElementById('addProductBtn');
const productModal = document.getElementById('productModal');
const closeProductModal = document.getElementById('closeProductModal');
const saveProductBtn = document.getElementById('saveProductBtn');
const prodName = document.getElementById('prodName');
const prodImg = document.getElementById('prodImg');
const prodStars = document.getElementById('prodStars');
const prodCash = document.getElementById('prodCash');
const prodQty = document.getElementById('prodQty');
const spinner = document.getElementById('spinner');
const alertMsg = document.getElementById('alertMsg');

/* ------------------ Helpers ------------------ */
function showSpinner() { spinner.style.display = 'block'; }
function hideSpinner() { spinner.style.display = 'none'; }
function showAlert(msg, duration = 2500) {
  alertMsg.textContent = msg;
  alertMsg.style.display = 'block';
  setTimeout(() => alertMsg.style.display = 'none', duration);
}

/* ------------------ Admin Login ------------------ */
loginBtn.addEventListener('click', async () => {
  const email = adminEmailInput.value.trim().toLowerCase();
  if (!email) return showAlert('Enter your admin email!');

  showSpinner();
  try {
    const adminsSnap = await getDocs(collection(db, 'admins'));
    const emails = adminsSnap.docs.map(d => (d.data().email || '').trim().toLowerCase());

    if (!emails.includes(email)) {
      showAlert('Access Denied! You are not an admin.');
      return;
    }

    // Login successful
    loginPage.style.display = 'none';
    dashboard.style.display = 'block';
    loadDashboard();
  } catch (e) {
    console.error(e);
    showAlert('Failed to verify admin!');
  } finally {
    hideSpinner();
  }
});

/* ------------------ Logout ------------------ */
logoutBtn.addEventListener('click', () => {
  dashboard.style.display = 'none';
  loginPage.style.display = 'flex';
  adminEmailInput.value = '';
});

/* ------------------ Load Dashboard ------------------ */
async function loadDashboard() {
  await loadUsers();
  await loadProducts();
  await loadOrders();
}

/* ------------------ Users ------------------ */
async function loadUsers() {
  showSpinner();
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      usersList.innerHTML = '<div>No users found.</div>';
      return;
    }
    let html = `<table>
      <tr><th>Email</th><th>Stars</th><th>Cash</th></tr>`;
    usersSnap.forEach(docSnap => {
      const u = docSnap.data();
      html += `<tr>
        <td>${u.email || '-'}</td>
        <td>${u.stars || 0}</td>
        <td>₦${u.cash || 0}</td>
      </tr>`;
    });
    html += `</table>`;
    usersList.innerHTML = html;
  } catch (e) {
    console.error(e);
    usersList.innerHTML = '<div>Failed to load users.</div>';
  } finally { hideSpinner(); }
}

/* ------------------ Products ------------------ */
async function loadProducts() {
  showSpinner();
  try {
    const productsSnap = await getDocs(collection(db, 'shopItems'));
    if (productsSnap.empty) {
      productsList.innerHTML = '<div>No products found.</div>';
      return;
    }
    let html = `<table>
      <tr><th>Name</th><th>Stars</th><th>Cash</th><th>Qty</th></tr>`;
    productsSnap.forEach(docSnap => {
      const p = docSnap.data();
      html += `<tr>
        <td>${p.name || '-'}</td>
        <td>${p.cost || 0}</td>
        <td>₦${p.cashReward || 0}</td>
        <td>${p.available || 0}</td>
      </tr>`;
    });
    html += `</table>`;
    productsList.innerHTML = html;
  } catch (e) {
    console.error(e);
    productsList.innerHTML = '<div>Failed to load products.</div>';
  } finally { hideSpinner(); }
}

/* ------------------ Orders ------------------ */
async function loadOrders() {
  showSpinner();
  try {
    const ordersSnap = await getDocs(collection(db, 'purchases'));
    if (ordersSnap.empty) {
      ordersList.innerHTML = '<div>No orders found.</div>';
      return;
    }
    let html = `<table>
      <tr><th>User</th><th>Product</th><th>Stars</th><th>Cash</th><th>Date</th></tr>`;
    ordersSnap.forEach(docSnap => {
      const o = docSnap.data();
      const date = o.timestamp?.toDate ? o.timestamp.toDate().toLocaleString() : '-';
      html += `<tr>
        <td>${o.email || '-'}</td>
        <td>${o.productName || '-'}</td>
        <td>${o.cost || 0}</td>
        <td>₦${o.cashReward || 0}</td>
        <td>${date}</td>
      </tr>`;
    });
    html += `</table>`;
    ordersList.innerHTML = html;
  } catch (e) {
    console.error(e);
    ordersList.innerHTML = '<div>Failed to load orders.</div>';
  } finally { hideSpinner(); }
}

/* ------------------ Add Product Modal ------------------ */
addProductBtn.addEventListener('click', () => productModal.style.display = 'flex');
closeProductModal.addEventListener('click', () => productModal.style.display = 'none');

/* ------------------ Save Product ------------------ */
saveProductBtn.addEventListener('click', async () => {
  const name = prodName.value.trim();
  if (!name) return showAlert('Enter product name!');
  const cost = Number(prodStars.value) || 0;
  const cash = Number(prodCash.value) || 0;
  const qty = Number(prodQty.value) || 0;
  const img = prodImg.value.trim() || 'https://via.placeholder.com/300';

  showSpinner();
  try {
    const newDoc = doc(collection(db, 'shopItems'));
    await setDoc(newDoc, { name, cost, cashReward: cash, available: qty, img });
    showAlert('Product added!');
    productModal.style.display = 'none';
    prodName.value = prodImg.value = prodStars.value = prodCash.value = prodQty.value = '';
    await loadProducts();
  } catch (e) {
    console.error(e);
    showAlert('Failed to add product!');
  } finally { hideSpinner(); }
});