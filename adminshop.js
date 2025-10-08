import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, getDocs, runTransaction, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {

  /* ------------------ Firebase ------------------ */
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

  /* ------------------ DOM ------------------ */
  const loginPage = document.getElementById('loginPage');
  const dashboard = document.getElementById('dashboard');
  const adminEmailInput = document.getElementById('adminEmail');
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const loginMsg = document.getElementById('loginMsg');
  const logoutBtn = document.getElementById('logoutBtn');

  const usersList = document.getElementById('usersList');
  const productsList = document.getElementById('productsList');
  const ordersList = document.getElementById('ordersList');

  const addProductBtn = document.getElementById('addProductBtn');
  const productModal = document.getElementById('productModal');
  const closeProductModal = document.getElementById('closeProductModal');
  const prodName = document.getElementById('prodName');
  const prodImg = document.getElementById('prodImg');
  const prodStars = document.getElementById('prodStars');
  const prodCash = document.getElementById('prodCash');
  const prodQty = document.getElementById('prodQty');
  const saveProductBtn = document.getElementById('saveProductBtn');

  const userSearch = document.getElementById('userSearch');

  /* ------------------ State ------------------ */
  let currentAdmin = null;
  let editingProductId = null;

  const formatNumber = n => n ? new Intl.NumberFormat('en-NG').format(Number(n)) : '0';

  /* ------------------ Admin Login ------------------ */
  adminLoginBtn.addEventListener('click', async () => {
    const email = adminEmailInput.value.trim().toLowerCase();
    if (!email) return loginMsg.textContent = 'Enter admin email.';

    loginMsg.textContent = 'Checking...';

    try {
      const adminRef = doc(db, 'admins', email);
      const snap = await getDoc(adminRef);
      if (!snap.exists()) return loginMsg.textContent = 'Access denied.';

      currentAdmin = email;
      loginPage.classList.add('hidden');
      dashboard.classList.remove('hidden');
      loginMsg.textContent = '';
      adminEmailInput.value = '';

      await renderUsers();
      await renderProducts();
      await renderOrders();
    } catch (e) {
      console.error(e);
      loginMsg.textContent = 'Error checking admin.';
    }
  });

  logoutBtn.addEventListener('click', () => {
    currentAdmin = null;
    loginPage.classList.remove('hidden');
    dashboard.classList.add('hidden');
  });

  /* ------------------ Users ------------------ */
  async function renderUsers() {
    usersList.innerHTML = 'Loading...';
    try {
      const snap = await getDocs(collection(db, 'users'));
      const users = snap.docs.map(d => d.data()).sort((a,b)=>a.email?.localeCompare(b.email));

      const search = userSearch.value.trim().toLowerCase();
      const filtered = users.filter(u => !search || u.email?.toLowerCase().includes(search));

      usersList.innerHTML = '';
      filtered.forEach(u => {
        const div = document.createElement('div');
        div.className = 'user-card';
        div.innerHTML = `<span>${u.email}</span> <span>⭐ ${formatNumber(u.stars)} | ₦ ${formatNumber(u.cash)}</span>`;
        usersList.appendChild(div);
      });
    } catch (e) {
      console.error(e);
      usersList.innerHTML = 'Failed to load users.';
    }
  }
  userSearch.addEventListener('input', renderUsers);

  /* ------------------ Products ------------------ */
  addProductBtn.addEventListener('click', () => {
    editingProductId = null;
    prodName.value = prodImg.value = '';
    prodStars.value = prodCash.value = prodQty.value = '';
    productModal.classList.remove('hidden');
  });

  closeProductModal.addEventListener('click', () => productModal.classList.add('hidden'));

  saveProductBtn.addEventListener('click', async () => {
    const name = prodName.value.trim();
    const img = prodImg.value.trim();
    const stars = Number(prodStars.value) || 0;
    const cash = Number(prodCash.value) || 0;
    const qty = Number(prodQty.value) || 0;

    if (!name) return alert('Enter product name.');

    try {
      if (editingProductId) {
        await updateDoc(doc(db, 'shopItems', editingProductId), { name, img, cost: stars, cashReward: cash, available: qty });
      } else {
        const newDoc = doc(collection(db, 'shopItems'));
        await setDoc(newDoc, { name, img, cost: stars, cashReward: cash, available: qty });
      }
      productModal.classList.add('hidden');
      await renderProducts();
    } catch (e) {
      console.error(e);
      alert('Failed to save product.');
    }
  });

  async function renderProducts() {
    productsList.innerHTML = 'Loading...';
    try {
      const snap = await getDocs(collection(db, 'shopItems'));
      const products = snap.docs.map(d => ({ id:d.id, ...d.data() }));

      productsList.innerHTML = '';
      products.forEach(p => {
        const div = document.createElement('div');
        div.className = 'product-card';
        div.innerHTML = `<span>${p.name} ⭐${p.cost} | ₦${formatNumber(p.cashReward)} | ${p.available} left</span>
                         <div>
                           <button data-edit="${p.id}">Edit</button>
                           <button data-delete="${p.id}">Delete</button>
                         </div>`;
        productsList.appendChild(div);

        div.querySelector('button[data-edit]')?.addEventListener('click', () => {
          editingProductId = p.id;
          prodName.value = p.name || '';
          prodImg.value = p.img || '';
          prodStars.value = p.cost || 0;
          prodCash.value = p.cashReward || 0;
          prodQty.value = p.available || 0;
          productModal.classList.remove('hidden');
        });

        div.querySelector('button[data-delete]')?.addEventListener('click', async () => {
          if (confirm('Delete product?')) {
            await deleteDoc(doc(db, 'shopItems', p.id));
            renderProducts();
          }
        });
      });
    } catch (e) {
      console.error(e);
      productsList.innerHTML = 'Failed to load products.';
    }
  }

  /* ------------------ Orders ------------------ */
  async function renderOrders() {
    ordersList.innerHTML = 'Loading...';
    try {
      const snap = await getDocs(collection(db, 'purchases'));
      const orders = snap.docs.map(d => ({ id:d.id, ...d.data() }));

      ordersList.innerHTML = '';
      orders.forEach(o => {
        const div = document.createElement('div');
        div.className = 'order-card';
        div.innerHTML = `<span>${o.productName} by ${o.email} ⭐${o.cost} | ₦${formatNumber(o.cashReward)}</span>
                         <button data-refund="${o.id}">Refund</button>`;
        ordersList.appendChild(div);

        div.querySelector('button[data-refund]')?.addEventListener('click', async () => {
          if (!confirm('Refund this order?')) return;
          try {
            const orderRef = doc(db, 'purchases', o.id);
            const userRef = doc(db, 'users', o.userId);

            await runTransaction(db, async t => {
              const uSnap = await t.get(userRef);
              if (!uSnap.exists()) throw new Error('User not found');
              const uData = uSnap.data();

              const newStars = Number(uData.stars || 0) + Number(o.cost || 0);
              const newCash = Number(uData.cash || 0) + Number(o.redeemedCash || 0 || o.cashReward || 0);

              t.update(userRef, { stars: newStars, cash: newCash });
              t.delete(orderRef);
            });
            renderOrders();
            renderUsers();
            alert('Refund successful.');
          } catch (e) {
            console.error(e);
            alert('Refund failed.');
          }
        });
      });
    } catch (e) {
      console.error(e);
      ordersList.innerHTML = 'Failed to load orders.';
    }
  }

});