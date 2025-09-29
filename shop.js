/// --------- FIREBASE SETUP ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, onSnapshot, collection, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase config
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

// DOM elements
const usernameEl = document.getElementById('username');
const starsEl = document.getElementById('stars-balance');
const cashEl = document.getElementById('cash-balance');
const shopItemsEl = document.getElementById('shop-items');
const homeBtn = document.getElementById('home-btn');

// Deep link: ?uid=USER_ID
const uid = new URLSearchParams(window.location.search).get('uid');
if (!uid) {
  alert("No user ID detected!");
}

// Firestore refs
const userRef = doc(db, "users", uid);
const ordersRef = collection(db, "orders"); // new collection for purchases

// Random color for username
function randomColor() {
  const colors = ['#ff33cc','#33ffcc','#ffcc33','#66f','#f66','#3f3'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Load user info
async function loadUser() {
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    usernameEl.innerText = "Guest";
    starsEl.innerText = "Stars: 0 ⭐️";
    cashEl.innerText = "Cash: ₦0";
    return;
  }
  const data = snap.data();
  usernameEl.innerText = data.chatId || "Guest";
  usernameEl.style.color = data.usernameColor || "#ffffff";
  starsEl.innerText = `Stars: ${data.stars || 0} ⭐️`;
  cashEl.innerText = `Cash: ₦${data.cash || 0}`;
}

// Watch for live changes to user stars & cash
onSnapshot(userRef, snap => {
  if (!snap.exists()) return;
  const data = snap.data();
  starsEl.innerText = `Stars: ${data.stars || 0} ⭐️`;
  cashEl.innerText = `Cash: ₦${data.cash || 0}`;
});

// Shop items
const shopItems = [
  { id: 1, name: "VIP Pass", cost: 50, img: "https://via.placeholder.com/150", available: 12 },
  { id: 2, name: "Glow Badge", cost: 20, img: "https://via.placeholder.com/150", available: 8 },
  { id: 3, name: "Special Emoji Pack", cost: 10, img: "https://via.placeholder.com/150", available: 15 }
];

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
  card.querySelector('.buy-btn').addEventListener('click', () => buyItem(item));
  return card;
}

function renderShop() {
  shopItemsEl.innerHTML = '';
  shopItems.forEach(item => shopItemsEl.appendChild(createProductCard(item)));
}

// Purchase logic
async function buyItem(item) {
  const snap = await getDoc(userRef);
  if (!snap.exists()) return alert("User not found!");
  
  const data = snap.data();
  const userStars = data.stars || 0;
  
  if (userStars < item.cost) return alert("Not enough stars!");
  
  // Deduct stars
  await updateDoc(userRef, { stars: userStars - item.cost });
  
  // Log order
  await addDoc(ordersRef, {
    userId: uid,
    itemId: item.id,
    itemName: item.name,
    cost: item.cost,
    timestamp: new Date(),
    fulfilled: false
  });
  
  alert(`Purchased ${item.name}!`);
}

// Initialize
loadUser();
renderShop();

// Home button
homeBtn.addEventListener('click', () => window.location.href='/');