// --------- SHOP.JS ----------
import { doc, getDoc, updateDoc, collection, addDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Grab UI elements
const usernameEl = document.getElementById('username');
const starsEl = document.getElementById('stars-balance');
const cashEl = document.getElementById('cash-balance');
const shopItemsEl = document.getElementById('shop-items');

// Example shop items (replace with Firestore later if you want)
const shopItems = [
  { id: 1, name: "VIP Pass", cost: 50, img: "https://via.placeholder.com/150", available: 12 },
  { id: 2, name: "Glow Badge", cost: 20, img: "https://via.placeholder.com/150", available: 8 },
  { id: 3, name: "Special Emoji Pack", cost: 10, img: "https://via.placeholder.com/150", available: 15 }
];

// Show current user info
function updateUserDisplay() {
  if (!window.currentUser) return;
  usernameEl.innerText = window.currentUser.chatId || "Guest";
  usernameEl.style.color = window.currentUser.usernameColor || "#fff";
  starsEl.innerText = `Stars: ${window.currentUser.stars || 0} ⭐️`;
  cashEl.innerText = `Cash: ₦${window.currentUser.cash || 0}`;
}

// Create a shop card
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

// Render all shop items
function renderShop() {
  shopItemsEl.innerHTML = '';
  shopItems.forEach(item => shopItemsEl.appendChild(createProductCard(item)));
}

// Buy logic
async function buyItem(item) {
  if (!window.currentUser) return alert("You must be logged in to buy!");
  if (window.currentUser.stars < item.cost) return alert("Not enough stars!");

  const userRef = doc(window.db, "users", window.currentUser.uid);

  // Deduct stars
  await updateDoc(userRef, { stars: increment(-item.cost) });

  // Log the purchase in Firestore
  await addDoc(collection(window.db, "purchases"), {
    uid: window.currentUser.uid,
    itemId: item.id,
    itemName: item.name,
    cost: item.cost,
    timestamp: new Date()
  });

  // Update local user display
  window.currentUser.stars -= item.cost;
  updateUserDisplay();
  alert(`✅ You purchased: ${item.name}`);
}

// Keep stars and cash live
function listenToCurrentUser(user) {
  const userRef = doc(window.db, "users", user.uid);
  onSnapshot(userRef, snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    window.currentUser.stars = data.stars || 0;
    window.currentUser.cash = data.cash || 0;
    updateUserDisplay();
  });
}

// Initialize shop once currentUser is ready
function initShop() {
  if (!window.currentUser) {
    console.warn("Shop: waiting for user...");
    setTimeout(initShop, 500); // wait and retry
    return;
  }
  updateUserDisplay();
  renderShop();
  listenToCurrentUser(window.currentUser);
}

// Start the shop
initShop();