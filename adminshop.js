import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  getDocs,
  runTransaction,
  setDoc,
  updateDoc,
  serverTimestamp
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

/* ---------------- Spinner Helpers ---------------- */
const showSpinner = () => document.querySelector('.shop-spinner')?.classList.add('active');
const hideSpinner = () => document.querySelector('.shop-spinner')?.classList.remove('active');

/* ---------------- Admin login ---------------- */
const ADMIN_CREDENTIALS = { email:'admin@example.com', password:'SuperSecure123' };

const loginBtn = document.getElementById('adminLoginBtn');
const loginMsg = document.getElementById('loginMsg');
const loginDiv = document.getElementById('adminLogin');
const dashboardDiv = document.getElementById('adminDashboard');

loginBtn.addEventListener('click', () => {
  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value.trim();

  if(email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password){
    loginDiv.style.display = 'none';
    dashboardDiv.style.display = 'block';
    renderAdminTab('orders');
  } else {
    loginMsg.textContent = 'Invalid credentials!';
  }
});

/* ---------------- Tabs ---------------- */
const adminTabs = document.getElementById('adminTabs');
const adminContent = document.getElementById('adminContent');

adminTabs.addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  adminTabs.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderAdminTab(btn.dataset.tab);
});

/* ---------------- Confirm Modal ---------------- */
const DOM = {
  confirmModal: document.getElementById('confirmModal'),
  confirmTitle: document.getElementById('confirmTitle'),
  confirmText: document.getElementById('confirmText'),
  confirmYes: document.getElementById('confirmYes'),
  confirmNo: document.getElementById('confirmNo')
};
let _themedTimeout = null;
const closeModal = () => {
  if(DOM.confirmModal) DOM.confirmModal.style.display='none';
  if(DOM.confirmYes) DOM.confirmYes.onclick = null;
  if(DOM.confirmNo) DOM.confirmNo.onclick = null;
};

const showConfirmModal = (title, text, onYes) => {
  DOM.confirmTitle.textContent = title;
  DOM.confirmText.textContent = text;
  DOM.confirmModal.style.display = 'flex';
  DOM.confirmYes.onclick = async ()=>{ closeModal(); if(onYes) await onYes(); };
  DOM.confirmNo.onclick = closeModal;
};

/* ---------------- Admin render ---------------- */
async function renderAdminTab(tab){
  if(!adminContent) return;
  adminContent.innerHTML = '<div style="text-align:center;">Loading...</div>';
  showSpinner();

  if(tab==='orders'){
    const snap = await getDocs(collection(db,'purchases'));
    const orders = snap.docs.map(d=>({id:d.id,...d.data()}))
                           .sort((a,b)=>b.timestamp?.toDate()-a.timestamp?.toDate());
    adminContent.innerHTML='';
    orders.forEach(order=>{
      const div=document.createElement('div'); div.className='order-card';
      div.innerHTML=`
        <strong>${order.productName}</strong> - ${order.cost} ⭐
        ${order.cashReward?`- ₦${order.cashReward}`:''}<br>
        <small>${order.timestamp?.toDate()?.toLocaleString()||''}</small>
        <button class="refundBtn" data-id="${order.id}">Refund</button>
      `;
      adminContent.appendChild(div);
    });
    adminContent.querySelectorAll('.refundBtn').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id=btn.dataset.id;
        const orderRef=doc(db,'purchases',id);
        const orderSnap=await getDoc(orderRef);
        if(!orderSnap.exists()) return alert('Order not found');

        showConfirmModal('Refund Order','Refund this order?', async ()=>{
          await runTransaction(db, async t=>{
            const orderData = orderSnap.data();
            const userRef = doc(db,'users',orderData.userId);
            const productRef = doc(db,'shopItems',orderData.productId);

            const [userSnap, productSnap] = await Promise.all([t.get(userRef), t.get(productRef)]);
            if(!userSnap.exists() || !productSnap.exists()) throw new Error('Missing user/product');

            const userData=userSnap.data();
            const productData=productSnap.data();
            const newStars = (Number(userData.stars)||0) + Number(orderData.cost||0);
            const newCash = (Number(userData.cash)||0) + Number(orderData.redeemedCash||0);

            t.update(userRef,{stars:newStars, cash:newCash});
            t.update(productRef,{available:(Number(productData.available)||0)+1});
            t.delete(orderRef);
          });
          renderAdminTab('orders');
        });
      });
    });

  } else if(tab==='products'){
    const snap = await getDocs(collection(db,'shopItems'));
    adminContent.innerHTML='';
    snap.forEach(docSnap=>{
      const p = docSnap.data(); p.id=docSnap.id;
      const div=document.createElement('div'); div.className='product-admin-card';
      div.innerHTML=`
        <input value="${p.name}" placeholder="Name"/>
        <input type="number" value="${p.cost}" placeholder="Stars"/>
        <input type="number" value="${p.cashReward||0}" placeholder="Cash"/>
        <input type="number" value="${p.available||0}" placeholder="Stock"/>
        <button class="updateBtn">Update</button>
      `;
      adminContent.appendChild(div);
      div.querySelector('.updateBtn').addEventListener('click', async ()=>{
        const [name,cost,cash,avail]=Array.from(div.querySelectorAll('input')).map(i=>i.value);
        await updateDoc(doc(db,'shopItems',p.id),{
          name, cost:Number(cost), cashReward:Number(cash), available:Number(avail)
        });
        alert('Updated!');
      });
    });

    const addBtn=document.createElement('button'); addBtn.textContent='Add New Product'; addBtn.style.marginTop='12px';
    adminContent.appendChild(addBtn);
    addBtn.addEventListener('click', async ()=>{
      const newRef=doc(collection(db,'shopItems'));
      await setDoc(newRef,{name:'New Item', cost:0, cashReward:0, available:0, img:''});
      renderAdminTab('products');
    });

  } else if(tab==='users'){
    const snap=await getDocs(collection(db,'users'));
    adminContent.innerHTML='';
    snap.forEach(docSnap=>{
      const u=docSnap.data();
      const div=document.createElement('div'); div.className='user-card';
      div.innerHTML=`<strong>${u.chatId||u.email}</strong> - ⭐${u.stars} - ₦${u.cash||0}`;
      adminContent.appendChild(div);
    });

  } else if(tab==='analytics'){
    const snap=await getDocs(collection(db,'purchases'));
    const totalStars = snap.docs.reduce((a,d)=>a+(Number(d.data().cost)||0),0);
    const totalCash = snap.docs.reduce((a,d)=>a+(Number(d.data().cashReward)||0),0);
    adminContent.innerHTML=`
      <div>Total Stars Redeemed: ${totalStars} ⭐</div>
      <div>Total Cash Redeemed: ₦${totalCash.toLocaleString()}</div>
      <div>Total Orders: ${snap.size}</div>
    `;
  }
  hideSpinner();
}

/* ---------------- Theme Toggle ---------------- */
const themeBtn = document.getElementById('themeToggle');
themeBtn?.addEventListener('click', ()=>{
  const isDark = document.body.classList.toggle('dark');
  themeBtn.textContent = isDark?'🌙':'☀️';
});