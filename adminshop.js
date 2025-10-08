import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------------- FIREBASE ---------------- */
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

/* ---------------- HELPERS ---------------- */
function sanitizeEmail(email) { return email.replace(/[.#$[\]]/g, ','); }
const showSpinner = () => document.querySelector('.shop-spinner')?.classList.add('active');
const hideSpinner = () => document.querySelector('.shop-spinner')?.classList.remove('active');

/* ---------------- LOGIN ---------------- */
const loginDiv = document.getElementById('adminLoginDiv');
const dashboardDiv = document.getElementById('adminDashboard');
document.getElementById('adminLoginBtn').addEventListener('click', async () => {
  const email = document.getElementById('adminEmail').value.trim();
  if (!email) return alert('Enter email');
  showSpinner();
  try {
    const adminCol = collection(db, 'admins');
    const adminDocs = await getDocs(adminCol);
    const allowed = adminDocs.docs.some(d => d.id === sanitizeEmail(email));
    if (!allowed) return alert('Access Denied');

    // show dashboard
    loginDiv.style.display = 'none';
    dashboardDiv.style.display = 'block';
    renderAdminTab('orders');
  } catch(e) { console.error(e); alert('Error verifying admin'); }
  finally { hideSpinner(); }
});

/* ---------------- TABS ---------------- */
const tabs = document.querySelectorAll('.tab-btn');
tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(t=>t.classList.remove('active'));
  tab.classList.add('active');

  const name = tab.dataset.tab;
  document.querySelectorAll('.tabContent').forEach(c => c.classList.remove('active'));
  document.getElementById(name+'Tab').classList.add('active');

  renderAdminTab(name);
}));

/* ---------------- RENDER ADMIN TABS ---------------- */
async function renderAdminTab(tab){
  if(tab==='orders') await renderOrders();
  else if(tab==='products') await renderProducts();
  else if(tab==='users') await renderUsers();
}

/* ---------------- RENDER ORDERS ---------------- */
async function renderOrders(){
  showSpinner();
  try {
    const ordersTable = document.querySelector('#ordersTable tbody');
    ordersTable.innerHTML = '';
    const snap = await getDocs(collection(db,'purchases'));
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${docSnap.id}</td>
        <td>${data.email||''}</td>
        <td>${data.productName||''}</td>
        <td>${data.cost||0}</td>
        <td>${data.cashReward||0}</td>
        <td>${data.timestamp?.toDate?.().toLocaleString()||''}</td>
        <td><button class="action-btn refund">Refund</button></td>
      `;
      tr.querySelector('.refund').addEventListener('click', async()=>{
        if(!confirm('Confirm refund?')) return;
        await refundOrder(docSnap.id, data);
      });
      ordersTable.appendChild(tr);
    });
  } catch(e){ console.error(e); }
  finally{ hideSpinner(); }
}

async function refundOrder(id, data){
  showSpinner();
  try{
    await runTransaction(db, async t=>{
      const userRef = doc(db,'users',sanitizeEmail(data.email||''));
      const userSnap = await t.get(userRef);
      if(!userSnap.exists()) return;
      const uData = userSnap.data();
      t.update(userRef, { 
        stars: (uData.stars||0) + (data.cost||0), 
        cash: (uData.cash||0) + (data.cashReward||0) 
      });
      const purchaseRef = doc(db,'purchases',id);
      t.update(purchaseRef, { refunded:true });
      const productRef = doc(db,'shopItems',data.productId);
      const pSnap = await t.get(productRef);
      if(pSnap.exists()){
        t.update(productRef,{ available: (pSnap.data().available||0)+1 });
      }
    });
    alert('Refund successful!');
    renderOrders();
    renderProducts();
  }catch(e){ console.error(e); alert('Refund failed'); }
  finally{ hideSpinner(); }
}

/* ---------------- RENDER PRODUCTS ---------------- */
async function renderProducts(){
  showSpinner();
  try {
    const productsTable = document.querySelector('#productsTable tbody');
    productsTable.innerHTML='';
    const snap = await getDocs(collection(db,'shopItems'));
    snap.forEach(docSnap=>{
      const data = docSnap.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${docSnap.id}</td>
        <td>${data.name||''}</td>
        <td>${data.cost||0}</td>
        <td>${data.cashReward||0}</td>
        <td>${data.available||0}</td>
        <td><button class="action-btn update">Update</button></td>
      `;
      tr.querySelector('.update').addEventListener('click', ()=>{
        document.getElementById('productName').value = data.name;
        document.getElementById('productCost').value = data.cost||0;
        document.getElementById('productCash').value = data.cashReward||0;
        document.getElementById('productAvailable').value = data.available||0;
        document.getElementById('productImage').value = data.img||'';
      });
      productsTable.appendChild(tr);
    });
  }catch(e){ console.error(e); }
  finally{ hideSpinner(); }
}

/* ---------------- ADD / UPDATE PRODUCT ---------------- */
document.getElementById('productForm').addEventListener('submit', async e=>{
  e.preventDefault();
  const name = document.getElementById('productName').value.trim();
  const cost = Number(document.getElementById('productCost').value) || 0;
  const cashReward = Number(document.getElementById('productCash').value) || 0;
  const available = Number(document.getElementById('productAvailable').value) || 0;
  const img = document.getElementById('productImage').value.trim() || '';

  showSpinner();
  try {
    const shopCol = collection(db,'shopItems');
    // Use product name as ID for simplicity
    const prodRef = doc(db, 'shopItems', name.replace(/\s+/g,'_'));
    await setDoc(prodRef, { name, cost, cashReward, available, img }, { merge:true });
    alert('Product added/updated!');
    renderProducts();
  } catch(e){ console.error(e); alert('Failed to add/update product'); }
  finally{ hideSpinner(); }
});

/* ---------------- RENDER USERS ---------------- */
async function renderUsers(){
  showSpinner();
  try{
    const usersTable = document.querySelector('#usersTable tbody');
    usersTable.innerHTML='';
    const snap = await getDocs(collection(db,'users'));
    snap.forEach(docSnap=>{
      const data = docSnap.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${docSnap.id}</td>
        <td>${data.email||''}</td>
        <td>${data.stars||0}</td>
        <td>${data.cash||0}</td>
        <td>${data.isVIP? 'Yes':'No'}</td>
        <td>${data.isHost? 'Yes':'No'}</td>
      `;
      usersTable.appendChild(tr);
    });
  }catch(e){ console.error(e); }
  finally{ hideSpinner(); }
}