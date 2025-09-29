// shop.js

import { getFirestore, doc, collection, onSnapshot, addDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Assumes app.js already initialized Firebase
const db = getFirestore();

const usernameEl = document.getElementById('username');
const starsEl = document.getElementById('stars-balance');
const cashEl = document.getElementById('cash-balance');
const shopItemsEl = document.getElementById('shop-items');

let currentUserListener = null;

// Example shop items
const shopItems = [
  { id: "vip-pass", name: "VIP Pass", cost: 50, img: "https://via.placeholder.com/150", available: 12 },
  { id: "glow-badge", name: "Glow Badge", cost: 20, img: "https://via.placeholder.com/150", available: 8 },
  { id: "emoji-pack", name: "Special Emoji Pack", cost: 10, img: "https://via.placeholder.com/150", available: 15 }
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

async function buyItem(item) {
  if (!window.currentUser) {
    alert("Please log in first!");
    return;
  }

  const userRef = doc(db, "users", window.currentUser.uid);
  const userSnap = await userRef.get?.() || await getDoc(userRef);
  const userData = userSnap.data();

  if ((userData.stars || 0) < item.cost) {
    alert("Not enough stars to buy this item!");
    return;
  }

  // Deduct stars
  await updateDoc(userRef, { stars: (userData.stars || 0) - item.cost });

  // Log order
  await addDoc(collection(db, "shopOrders"), {
    uid: window.currentUser.uid,
    email: window.currentUser.email,
    itemId: item.id,
    itemName: item.name,
    cost: item.cost,
    timestamp: serverTimestamp(),
    fulfilled: false
  });

  alert(`Purchased ${item.name}!`);
}

// Update user display reactively
function listenToCurrentUser() {
  if (!window.currentUser) return;

  const userRef = doc(db, "users", window.currentUser.uid);

  if (currentUserListener) currentUserListener(); // remove old listener
  currentUserListener = onSnapshot(userRef, snap => {
    const data = snap.data() || {};
    usernameEl.innerText = data.chatId || "Guest";
    starsEl.innerText = `Stars: ${data.stars || 0} ⭐️`;
    cashEl.innerText = `Cash: ₦${data.cash || 0}`;
  });
}

// Wait a tiny moment to ensure app.js has set window.currentUser
const waitForUser = setInterval(() => {
  if (window.currentUser) {
    clearInterval(waitForUser);
    listenToCurrentUser();
    renderShop();
  }
}, 200);