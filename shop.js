// --------- FIREBASE SETUP ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --------- DOM ELEMENTS ----------
const usernameEl = document.getElementById('username');
const starsEl = document.getElementById('stars-balance');
const cashEl = document.getElementById('cash-balance');
const shopItemsEl = document.getElementById('shop-items');
const homeBtn = document.getElementById('home-btn');

// --------- GET UID FROM URL ----------
const uid = new URLSearchParams(window.location.search).get('uid');
if (!uid) {
  alert("No user ID detected!");
}

// --------- HELPER FUNCTIONS ----------
function randomColor() {
  const colors = ['#ff33cc','#33ffcc','#ffcc33','#66f','#f66','#3f3','#ffa500','#00ced1'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// --------- LOAD USER DATA ----------
let currentUserRef = doc(db, "users", uid);

async function loadUser() {
  const snap = await getDoc(currentUserRef);
  if (!snap.exists()) {
    usernameEl.innerText = "Guest";
    starsEl.innerText = "Stars: 0 ⭐️";
    cashEl.innerText = "Cash: ₦0";
    return;
  }

  const data = snap.data();
  usernameEl.innerText = data.chatId || "Guest";
  usernameEl.style.color = data.usernameColor || randomColor();
  starsEl.innerText = `Stars: ${data.stars || 0} ⭐️`;
  cashEl.innerText = `Cash: ₦${data.cash || 0}`;
}

// --------- LIVE UPDATES ----------
onSnapshot(currentUserRef, (snap) => {
  if (!snap.exists()) return;
  const data = snap.data();
  usernameEl.innerText = data.chatId || "Guest";
  usernameEl.style.color = data.usernameColor || randomColor();
  starsEl.innerText = `Stars: ${data.stars || 0} ⭐️`;
  cashEl.innerText = `Cash: ₦${data.cash || 0}`;
});

// --------- SHOP ITEMS ----------
const shopItems = [
  { id: "VIP_PASS_1", name: "VIP Pass", cost: 50, img: "https://via.placeholder.com/150", available: 12 },
  { id: "GLOW_BADGE_1", name: "Glow Badge", cost: 20, img: "https://via.placeholder.com/150", available: 8 },
  { id: "EMOJI_PACK_1", name: "Special Emoji Pack", cost: 10, img: "https://via.placeholder.com/150", available: 15 }
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
  card.querySelector('.buy-btn').addEventListener('click', () => buyItem(item, card));
  return card;
}

function renderShop() {
  shopItemsEl.innerHTML = '';
  shopItems.forEach(item => shopItemsEl.appendChild(createProductCard(item)));
}

// --------- BUY LOGIC ----------
async function buyItem(item, card) {
  const snap = await getDoc(currentUserRef);
  const data = snap.data();
  if ((data.stars || 0) < item.cost) {
    alert(`Not enough stars to buy ${item.name}`);
    return;
  }

  // Deduct stars
  await updateDoc(currentUserRef, {
    stars: (data.stars || 0) - item.cost
  });

  // Log purchase in a subcollection
  const purchaseRef = collection(currentUserRef, "purchases");
  await addDoc(purchaseRef, {
    itemId: item.id,
    itemName: item.name,
    cost: item.cost,
    timestamp: serverTimestamp()
  });

  alert(`Purchased ${item.name}!`);
}

// --------- INITIAL LOAD ---------
loadUser();
renderShop();

// --------- HOME BUTTON ----------
homeBtn.addEventListener('click', () => window.location.href='/');