// ---------- Firebase imports ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, query, where, doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Firebase config ----------
const firebaseConfig = {
  apiKey: "AIzaSyDbKz4ef_eUDlCukjmnK38sOwueYuzqoao",
  authDomain: "metaverse-1010.firebaseapp.com",
  projectId: "metaverse-1010",
  storageBucket: "metaverse-1010.firebasestorage.app",
  messagingSenderId: "1044064238233",
  appId: "1:1044064238233:web:2fbdfb811cb0a3ba349608",
  measurementId: "G-S77BMC266C"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- DOM ----------
const adminGate = document.getElementById("adminGate");
const adminPanel = document.getElementById("adminPanel");
const adminEmailInput = document.getElementById("adminEmail");
const adminCheckBtn = document.getElementById("adminCheckBtn");
const adminGateMsg = document.getElementById("adminGateMsg");
const currentAdminEmailEl = document.getElementById("currentAdminEmail");

const usersTableBody = document.querySelector("#usersTable tbody");
const userSearch = document.getElementById("userSearch");
const logoutBtn = document.getElementById("logoutBtn");

const productsTableBody = document.querySelector("#productsTable tbody");
const productModal = document.getElementById("productModal");
const modalProductName = document.getElementById("modalProductName");
const modalProductDesc = document.getElementById("modalProductDesc");
const productModalClose = document.getElementById("productModalClose");

const loaderOverlay = document.getElementById("loaderOverlay");
const loaderText = document.getElementById("loaderText");

// ---------- HELPERS ----------
function showLoader(text = "Loading...") {
  loaderText.textContent = text;
  loaderOverlay.style.display = "flex";
}
function hideLoader() {
  loaderOverlay.style.display = "none";
}

// ---------- ADMIN LOGIN ----------
let currentAdmin = null;

async function checkAdmin(emailRaw) {
  const email = String(emailRaw || "").trim().toLowerCase();
  if (!email) return null;

  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;

  const data = snap.docs[0].data() || {};
  return data.isAdmin === true ? { email, id: snap.docs[0].id } : null;
}

adminCheckBtn.addEventListener("click", async () => {
  adminGateMsg.textContent = "";
  const emailRaw = (adminEmailInput.value || "").trim();
  if (!emailRaw) { adminGateMsg.textContent = "Enter admin email"; return; }

  showLoader("Checking admin...");
  try {
    const admin = await checkAdmin(emailRaw);
    hideLoader();
    if (!admin) { adminGateMsg.textContent = "Access denied"; return; }
    currentAdmin = admin;
    currentAdminEmailEl.textContent = admin.email;
    adminGate.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    await loadUsers();
    await loadProducts();
  } catch (err) {
    hideLoader();
    console.error(err);
    adminGateMsg.textContent = "Error checking admin";
  }
});

adminEmailInput.addEventListener("keydown", e => { if (e.key === "Enter") adminCheckBtn.click(); });
logoutBtn.addEventListener("click", () => {
  currentAdmin = null;
  adminPanel.classList.add("hidden");
  adminGate.classList.remove("hidden");
  adminEmailInput.value = "";
});

// ---------- USERS ----------
let usersCache = [];

async function loadUsers() {
  showLoader("Loading users...");
  try {
    const snap = await getDocs(collection(db, "users"));
    usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsers(usersCache);
  } catch (err) {
    console.error(err);
    usersTableBody.innerHTML = `<tr><td colspan="7">Failed to load users</td></tr>`;
  } finally {
    hideLoader();
  }
}

function renderUsers(users) {
  usersTableBody.innerHTML = "";
  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.email || ""}</td>
      <td>${u.phone || ""}</td>
      <td>${u.stars || 0}</td>
      <td>${u.cash || 0}</td>
      <td>${u.isVIP ? "✅" : "❌"}</td>
      <td>${u.isAdmin ? "✅" : "❌"}</td>
      <td class="actions">
        <button class="btn" style="background:#007bff;color:#fff;">View</button>
      </td>
    `;
    tr.querySelector("button").addEventListener("click", () => {
      alert(`Selected user: ${u.email}`);
    });
    usersTableBody.appendChild(tr);
  });
}

userSearch.addEventListener("input", () => {
  const q = (userSearch.value || "").toLowerCase();
  renderUsers(usersCache.filter(u =>
    (u.email || "").toLowerCase().includes(q) ||
    (u.id || "").toLowerCase().includes(q)
  ));
});

// ---------- PRODUCTS ----------
let productsCache = [
  { name: "Product A", price: "$10", stars: 50, desc: "This is a description for Product A." },
  { name: "Product B", price: "$15", stars: 75, desc: "This is a description for Product B." },
  { name: "Product C", price: "$25", stars: 120, desc: "This is a description for Product C." }
];

async function loadProducts() {
  renderProducts(productsCache);
}

function renderProducts(products) {
  productsTableBody.innerHTML = "";
  products.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="productName" style="color:#007bff;cursor:pointer;">${p.name}</td>
      <td>${p.price}</td>
      <td>${p.stars}</td>
    `;
    tr.querySelector(".productName").addEventListener("click", () => {
      modalProductName.textContent = p.name;
      modalProductDesc.textContent = p.desc;
      productModal.style.display = "flex";
    });
    productsTableBody.appendChild(tr);
  });
}

// ---------- PRODUCT MODAL ----------
productModalClose.addEventListener("click", () => { productModal.style.display = "none"; });
productModal.addEventListener("click", e => { if (e.target === productModal) productModal.style.display = "none"; });