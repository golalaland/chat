import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------- Firebase ---------------- */
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

/* ---------------- DOM ---------------- */
const loginPage = document.getElementById('loginPage');
const dashboard = document.getElementById('dashboard');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const adminEmailInput = document.getElementById('adminEmail');
const loginMsg = document.getElementById('loginMsg');
const logoutBtn = document.getElementById('logoutBtn');

const usersList = document.getElementById('usersList');
const productsList = document.getElementById('productsList');
const ordersList = document.getElementById('ordersList');

const userSearch = document.getElementById('userSearch');

const productModal = document.getElementById('productModal');
const closeProductModal = document.getElementById('closeProductModal');
const addProductBtn = document.getElementById('addProductBtn');

const prodName = document.getElementById('prodName');
const prodImg = document.getElementById('prodImg');
const prodStars = document.getElementById('prodStars');
const prodCash = document.getElementById('prodCash');
const prodQty = document.getElementById('prodQty');
const saveProductBtn = document.getElementById('saveProductBtn');

let currentAdmin = null;

/* ---------------- Admin Login ---------------- */
adminLoginBtn.addEventListener('click', async () => {
  const email = adminEmailInput.value.trim().toLowerCase();
  if (!email) return loginMsg.textContent = 'Enter email';
  loginMsg.textContent = 'Checking...';

  try {
    const adminCol = collection(db, 'admins');
    const adminDocs = await getDocs(adminCol);

    const allowed = adminDocs.docs.some(d => d.data().email.toLowerCase() === email);

    if (!allowed) return loginMsg.textContent = 'Access Denied';

    currentAdmin = email;
    loginPage.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loginMsg.textContent = '';

    loadUsers();
    loadProducts();
    loadOrders();

  } catch (err) {
    console.error(err);
    loginMsg.textContent = 'Error checking admin';
  }
});

logoutBtn.addEventListener('click', () => {
  currentAdmin = null;
  dashboard.classList.add('hidden');
  loginPage.classList.remove('hidden');
});

/* ---------------- Users ---------------- */
const loadUsers = async () => {
  const usersCol = collection(db, 'users');
  const snap = await getDocs(usersCol);
  renderUsers(snap.docs.map(d => ({ id:d.id, ...d.data() })));
};

const renderUsers = (users) => {
  usersList.innerHTML = '';
  const search = userSearch.value.trim().toLowerCase();
  users.filter(u => !search || (u.email && u.email.toLowerCase().includes(search)))
    .forEach(u => {
      const card = document.createElement('div');
      card.className = 'user-card';
      card.innerHTML = `<div>${u.email}</div><div>Stars: ${u.stars||0} ⭐ | Cash: ₦${u.cash||0}</div>`;
      usersList.appendChild(card);
    });
};

userSearch.addEventListener('input', () => loadUsers());

/* ---------------- Products ---------------- */
addProductBtn.addEventListener('click', () => productModal.classList.remove('hidden'));
closeProductModal.addEventListener('click', () => productModal.classList.add('hidden'));

saveProductBtn.addEventListener('click', async () => {
  const name = prodName.value.trim();
  if (!name) return alert('Enter product name');
  const docRef = doc(collection(db, 'shopItems'));
  await setDoc(docRef, {
    name,
    img: prodImg.value || '',
    cost: Number(prodStars.value) || 0,
    cashReward: Number(prodCash.value) || 0,
    available: Number(prodQty.value) || 0,
    timestamp: serverTimestamp()
  });
  productModal.classList.add('hidden');
  prodName.value=''; prodImg.value=''; prodStars.value=''; prodCash.value=''; prodQty.value='';
  loadProducts();
});

const loadProducts = async () => {
  const snap = await getDocs(collection(db, 'shopItems'));
  productsList.innerHTML = '';
  snap.docs.forEach(docSnap => {
    const p = docSnap.data();
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `<div>${p.name}</div>
                      <div>${p.cost} ⭐ | ₦${p.cashReward||0}</div>
                      <div>${p.available||0} left</div>`;
    productsList.appendChild(card);
  });
};

/* ---------------- Orders ---------------- */
const loadOrders = async () => {
  const snap = await getDocs(collection(db, 'purchases'));
  ordersList.innerHTML = '';
  snap.docs.forEach(docSnap => {
    const o = docSnap.data();
    const card = document.createElement('div');
    card.className = 'order-card';
    const ts = o.timestamp?.toDate ? o.timestamp.toDate().toLocaleString() : '';
    card.innerHTML = `<div>${o.productName} - ${o.cost} ⭐${o.cashReward? ' / ₦'+o.cashReward:''}</div>
                      <div>${o.email}</div>
                      <div>${ts}</div>`;
    ordersList.appendChild(card);
  });
};