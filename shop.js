// shop.js
import { doc, onSnapshot, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.addEventListener("DOMContentLoaded", async () => {
  if (!window.currentUser || !window.db) {
    console.warn("User not logged in or Firebase not ready yet.");
    return;
  }

  const user = window.currentUser;
  const db = window.db;

  const starCountEl = document.getElementById("starCount");
  const cashCountEl = document.getElementById("cashCount");

  // Live listener for stars/cash
  const userRef = doc(db, "users", user.uid);
  onSnapshot(userRef, snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    user.stars = data.stars || 0;
    user.cash = data.cash || 0;
    if (starCountEl) starCountEl.innerText = new Intl.NumberFormat('en-NG').format(user.stars);
    if (cashCountEl) cashCountEl.innerText = new Intl.NumberFormat('en-NG').format(user.cash);
  });

  // Handle purchases
  document.querySelectorAll(".shop-item button").forEach(btn => {
    btn.addEventListener("click", async () => {
      const cost = parseInt(btn.dataset.cost);
      if (user.stars < cost) return alert("Not enough stars!");
      await updateDoc(userRef, { stars: increment(-cost) });
      alert(`You purchased: ${btn.previousElementSibling.innerText}`);
    });
  });
});