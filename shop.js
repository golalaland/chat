// --------- FIREBASE SETUP ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, doc, getDoc, onSnapshot, collection, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDbKz4ef_eUDlCukjmnK38sOwueYuzqoao",
  authDomain: "metaverse-1010.firebaseapp.com",
  projectId: "metaverse-1010",
  storageBucket: "metaverse-1010.appspot.com",
  messagingSenderId: "1044064238233",
  appId: "1:1044064238233:web:2fbdfb811cb0a3ba349608",
  measurementId: "G-S77BMC266C",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

// --------- ELEMENTS ----------
const starsEl = document.getElementById('stars-count');
const cashEl = document.getElementById('cash-count');
const usernameEl = document.getElementById('username');
const shopGridEl = document.getElementById('shop-items');

// Get UID from URL param
const urlParams = new URLSearchParams(window.location.search);
const uid = urlParams.get('uid');
if (!uid) alert("User not signed in!");

// --------- UTILITY ----------
function randomColor() {
  const colors = ['#ff33cc','#33ffcc','#ffcc33','#66f','#f66','#3f3'];
  return colors[Math.floor(Math.random()*colors.length)];
}

// --------- LOAD USER ----------
async function loadUser() {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return alert("User data not found!");

  const data = snap.data();
  usernameEl.innerText = data.username || "Guest";
  usernameEl.style.color = randomColor();
  starsEl.innerText = `${data.stars || 0} ⭐️`;
  cashEl.innerText = `₦ ${data.cash || 0}`;

  // Listen for real-time balance updates
  onSnapshot(userRef, (docSnap) => {
    if (!docSnap.exists()) return;
    const d = docSnap.data();
    starsEl.innerText = `${d.stars || 0} ⭐️`;
    cashEl.innerText = `₦ ${d.cash || 0}`;
  });
}

// --------- RENDER SHOP ----------
function createProductCard(item) {
  const card = document.createElement('div');
  card.classList.add('product-card');
  card.innerHTML = `
    <img src="${item.img}" alt="${item.name}">
    <div class="availability-badge" id="stock-${item.id}">${item.available} left</div>
    <div class="product-info">
      <div class="product-name">${item.name}</div>
      <div class="product-cost">${item.cost} ⭐️</div>
      <button class="buy-btn">Buy</button>
    </div>
  `;

  // Buy button click
  const buyBtn = card.querySelector('.buy-btn');
  buyBtn.addEventListener('click', async () => {
    const userRef = doc(db, "users", uid);
    const shopRef = doc(db, "shopItems", item.id.toString());

    const [userSnap, shopSnap] = await Promise.all([getDoc(userRef), getDoc(shopRef)]);
    const userData = userSnap.data();
    const shopData = shopSnap.data();

    if (userData.stars < item.cost) return alert("Not enough stars!");
    if (shopData.available <= 0) return alert("Item out of stock!");

    // Deduct stars
    await updateDoc(userRef, { stars: userData.stars - item.cost });

    // Deduct stock
    await updateDoc(shopRef, { available: shopData.available - 1 });

    // Log order
    const ordersRef = collection(db, "orders");
    await addDoc(ordersRef, {
      uid,
      username: userData.username || "Guest",
      itemId: item.id,
      itemName: item.name,
      cost: item.cost,
      timestamp: new Date()
    });

    alert(`Purchased ${item.name}!`);
  });

  return card;
}

function renderShop(items) {
  shopGridEl.innerHTML = '';
  items.forEach(item => shopGridEl.appendChild(createProductCard(item)));
}

// --------- LISTEN TO SHOP ----------
function listenShop() {
  const shopCollectionRef = collection(db, "shopItems");
  onSnapshot(shopCollectionRef, snapshot => {
    const items = [];
    snapshot.forEach(doc => {
      items.push({ id: doc.id, ...doc.data() });
      // Update stock badge if already rendered
      const badge = document.getElementById(`stock-${doc.id}`);
      if(badge) badge.innerText = `${doc.data().available} left`;
    });
    renderShop(items);
  });
}

// --------- INIT ----------
loadUser();
listenShop();
