// --------- FIREBASE SETUP ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDbKz4ef_eUDlCukjmnK38sOwueYuzqoao",
  authDomain: "metaverse-1010.firebaseapp.com",
  projectId: "metaverse-1010",
  storageBucket: "metaverse-1010.appspot.com",
  messagingSenderId: "1044064238233",
  appId: "1:1044064238233:web:2fbdfb811cb0a3ba349608",
  measurementId: "G-S77BMC266C"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM Elements
const usernameEl = document.getElementById('username');
const starsEl = document.getElementById('stars-balance');
const cashEl = document.getElementById('cash-balance');
const shopItemsEl = document.getElementById('shop-items');
const homeBtn = document.getElementById('home-btn');

// Get UID from URL
const uid = new URLSearchParams(window.location.search).get('uid');
if (!uid) {
  alert("No user ID detected! Please login first.");
}

// Store current user data
let currentUser = null;

// Random color helper
function randomColor() {
  const colors = ['#ff33cc','#33ffcc','#ffcc33','#66f','#f66','#3f3'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Load user info
async function loadUser(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  
  if (!snap.exists()) {
    usernameEl.innerText = "Guest";
    starsEl.innerText = "Stars: 0 ⭐️";
    cashEl.innerText = "₦0";
    return;
  }

  const data = snap.data();
  currentUser = { uid, ...data };

  usernameEl.innerText = data.chatId || "Guest";
  usernameEl.style.color = data.usernameColor || randomColor();
  starsEl.innerText = `Stars: ${data.stars || 0} ⭐️`;
  cashEl.innerText = `₦${data.cash || 0}`;
}

// Example shop items
const shopItems = [
  { id: 1, name: "VIP Pass", cost: 50, img: "https://via.placeholder.com/150", available: 12 },
  { id: 2, name: "Glow Badge", cost: 20, img: "https://via.placeholder.com/150", available: 8 },
  { id: 3, name: "Special Emoji Pack", cost: 10, img: "https://via.placeholder.com/150", available: 15 }
];

// Create product card
function createProductCard(item) {
  const card = document.createElement('div');
  card.classList.add('product-card');
  card.innerHTML = `
    <img src="${item.img}" alt="${item.name}">
    <div class="availability-badge">${item.available} left</div>
    <div class="product-info">
      <div class="product-name">${item.name}</div>
      <div class="product-cost">${item.cost} ⭐️</div>
      <button class="buy-btn">Buy</button>
    </div>
  `;

  // Buy logic
  card.querySelector('.buy-btn').addEventListener('click', () => buyItem(item));
  return card;
}

// Render shop
function renderShop() {
  shopItemsEl.innerHTML = '';
  shopItems.forEach(item => shopItemsEl.appendChild(createProductCard(item)));
}

// Buy item
async function buyItem(item) {
  if (!currentUser) return alert("No user loaded.");

  if ((currentUser.stars || 0) < item.cost) {
    return alert(`Not enough stars to buy ${item.name}.`);
  }

  // Deduct stars in Firestore
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, { stars: currentUser.stars - item.cost });
  currentUser.stars -= item.cost;

  // Optionally, create an order record
  await addDoc(collection(db, "orders"), {
    uid: currentUser.uid,
    itemId: item.id,
    itemName: item.name,
    cost: item.cost,
    timestamp: serverTimestamp()
  });

  // Update UI
  starsEl.innerText = `Stars: ${currentUser.stars} ⭐️`;
  alert(`Successfully purchased ${item.name}!`);
}

// Initial load
if (uid) {
  loadUser(uid);
  renderShop();
}

// Home button
homeBtn?.addEventListener('click', () => window.location.href = '/');