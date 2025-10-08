// admin-chat.js
// NOTE: Simple admin gate implemented by checking user's doc for isAdmin flag.
// For production, use Firebase Auth + security rules or server-side protection.

// admin-chat.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, getDoc, setDoc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- Firebase config ---------- */
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

/* ---------- DOM refs ---------- */
const adminGate = document.getElementById("adminGate");
const adminPanel = document.getElementById("adminPanel");
const adminCheckBtn = document.getElementById("adminCheckBtn");
const adminEmailInput = document.getElementById("adminEmail");
const adminGateMsg = document.getElementById("adminGateMsg");
const currentAdminEmailEl = document.getElementById("currentAdminEmail");

const usersTableBody = document.querySelector("#usersTable tbody");
const messagesTableBody = document.querySelector("#messagesTable tbody");
const whitelistTableBody = document.querySelector("#whitelistTable tbody");

const userSearchInput = document.getElementById("userSearch");
const exportCsvBtn = document.getElementById("exportCsv");
const logoutBtn = document.getElementById("logoutBtn");

const clearChatBtn = document.getElementById("clearChatBtn");
const addWhitelistBtn = document.getElementById("addWhitelistBtn");
const wlEmailInput = document.getElementById("wlEmail");
const wlPhoneInput = document.getElementById("wlPhone");

/* ---------- State ---------- */
let currentAdmin = null;
let users = [];
let messages = [];
let whitelist = [];
let ROOM_ID = "room5"; // default room

/* ---------- Helpers ---------- */
function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}

function sanitizeKey(key) { return key.replace(/[.#$[\]]/g, ','); }

function downloadCSV(filename, rows) {
  const csvContent = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  link.click();
}

/* ---------- Admin login ---------- */
adminCheckBtn.addEventListener("click", async () => {
  const email = (adminEmailInput.value || "").trim().toLowerCase();
  if (!email) return adminGateMsg.textContent = "Enter an email";

  const uidKey = sanitizeKey(email);
  const userRef = doc(db, "users", uidKey);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return adminGateMsg.textContent = "Admin not found";
  const data = snap.data();
  if (!data.isAdmin) return adminGateMsg.textContent = "Not an admin";

  currentAdmin = { uid: uidKey, email };
  currentAdminEmailEl.textContent = email;
  adminGate.classList.add("hidden");
  adminPanel.classList.remove("hidden");

  loadAllUsers();
  loadAllMessages();
  loadWhitelist();
});

/* ---------- Logout ---------- */
logoutBtn.addEventListener("click", () => {
  currentAdmin = null;
  adminPanel.classList.add("hidden");
  adminGate.classList.remove("hidden");
  adminEmailInput.value = "";
});

/* ---------- Users ---------- */
async function loadAllUsers() {
  const q = query(collection(db, "users"), orderBy("chatId"));
  const snap = await getDocs(q);
  users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderUsers(users);
}

function renderUsers(list) {
  usersTableBody.innerHTML = "";
  list.forEach(u => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${u.email}</td>
      <td>${u.chatId || ""}</td>
      <td><input type="number" value="${u.stars || 0}" class="small starInput" style="width:60px"/></td>
      <td><input type="checkbox" class="vipToggle" ${u.isVIP?"checked":""}/></td>
      <td><input type="checkbox" class="adminToggle" ${u.isAdmin?"checked":""}/></td>
      <td class="actions">
        <button class="btn btn-primary cashBtn small">Add Cash</button>
        <button class="btn btn-danger deleteUserBtn small">Delete</button>
      </td>
    `;

    // Stars input
    const starInput = tr.querySelector(".starInput");
    starInput.addEventListener("change", async () => {
      const val = parseInt(starInput.value) || 0;
      await updateDoc(doc(db, "users", u.id), { stars: val });
      loadAllUsers();
    });

    // VIP toggle
    const vipToggle = tr.querySelector(".vipToggle");
    vipToggle.addEventListener("change", async () => {
      await updateDoc(doc(db, "users", u.id), { isVIP: vipToggle.checked });
      loadAllUsers();
    });

    // Admin toggle
    const adminToggle = tr.querySelector(".adminToggle");
    adminToggle.addEventListener("change", async () => {
      await updateDoc(doc(db, "users", u.id), { isAdmin: adminToggle.checked });
      loadAllUsers();
    });

    // Cash add
    const cashBtn = tr.querySelector(".cashBtn");
    cashBtn.addEventListener("click", async () => {
      const amount = parseInt(prompt("Enter cash amount to add:", "0")) || 0;
      await updateDoc(doc(db, "users", u.id), { cash: (u.cash||0) + amount });
      loadAllUsers();
    });

    // Delete
    const deleteBtn = tr.querySelector(".deleteUserBtn");
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete user?")) return;
      await deleteDoc(doc(db, "users", u.id));
      loadAllUsers();
    });

    usersTableBody.appendChild(tr);
  });
}

/* ---------- Messages ---------- */
async function loadAllMessages() {
  const q = query(collection(db, `messages_${ROOM_ID}`), orderBy("timestamp", "asc"));
  const snap = await getDocs(q);
  messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderMessages(messages);
}

function renderMessages(list) {
  messagesTableBody.innerHTML = "";
  list.forEach(m => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${m.chatId || ""}</td>
      <td>${m.content || ""}</td>
      <td>${m.highlight ? "Yes" : "No"}</td>
      <td>${formatDate(m.timestamp)}</td>
      <td><button class="btn btn-danger deleteMsgBtn small">Delete</button></td>
    `;
    const deleteBtn = tr.querySelector(".deleteMsgBtn");
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete this message?")) return;
      await deleteDoc(doc(db, `messages_${ROOM_ID}`, m.id));
      loadAllMessages();
    });
    messagesTableBody.appendChild(tr);
  });
}

/* ---------- Clear chat ---------- */
clearChatBtn.addEventListener("click", async () => {
  if (!confirm("Delete ALL messages in this room?")) return;
  const q = query(collection(db, `messages_${ROOM_ID}`));
  const snap = await getDocs(q);
  for (let d of snap.docs) {
    await deleteDoc(doc(db, `messages_${ROOM_ID}`, d.id));
  }
  loadAllMessages();
});

/* ---------- Whitelist ---------- */
async function loadWhitelist() {
  const q = query(collection(db, "whitelist"), orderBy("email"));
  const snap = await getDocs(q);
  whitelist = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderWhitelist(whitelist);
}

function renderWhitelist(list) {
  whitelistTableBody.innerHTML = "";
  list.forEach(w => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${w.email}</td>
      <td>${w.phone}</td>
      <td><button class="btn btn-danger deleteWlBtn small">Delete</button></td>
    `;
    const deleteBtn = tr.querySelector(".deleteWlBtn");
    deleteBtn.addEventListener("click", async () => {
      if (!confirm("Delete whitelist entry?")) return;
      await deleteDoc(doc(db, "whitelist", w.id));
      loadWhitelist();
    });
    whitelistTableBody.appendChild(tr);
  });
}

/* Add whitelist + auto-create user */
addWhitelistBtn.addEventListener("click", async () => {
  const email = (wlEmailInput.value||"").trim().toLowerCase();
  const phone = (wlPhoneInput.value||"").trim();
  if (!email || !phone) return alert("Enter email and phone");

  const wlRef = doc(db, "whitelist", sanitizeKey(email));
  await setDoc(wlRef, { email, phone });

  // Create Firestore user if not exists
  const userRef = doc(db, "users", sanitizeKey(email));
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      email,
      phone,
      stars: 0,
      cash: 0,
      isVIP: true,
      isAdmin: false,
      chatId: `GUEST${Math.floor(1000 + Math.random()*9000)}`,
      isHost: false
    });
  }

  wlEmailInput.value = "";
  wlPhoneInput.value = "";
  loadWhitelist();
  loadAllUsers();
});

/* ---------- Search users ---------- */
userSearchInput.addEventListener("input", () => {
  const q = userSearchInput.value.trim().toLowerCase();
  const filtered = users.filter(u => (u.email||"").toLowerCase().includes(q) || (u.chatId||"").toLowerCase().includes(q));
  renderUsers(filtered);
});

/* ---------- Export CSV ---------- */
exportCsvBtn.addEventListener("click", () => {
  const rows = [
    ["Email","ChatId","Stars","Cash","VIP","Admin","isHost"]
  ];
  users.forEach(u => {
    rows.push([u.email,u.chatId,u.stars||0,u.cash||0,u.isVIP,u.isAdmin,u.isHost||false]);
  });
  downloadCSV("users.csv", rows);
});