// admin-payfeed.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Firebase config ----------
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

// ---------- DOM elements ----------
const adminGate = document.getElementById("adminGate");
const adminPanel = document.getElementById("adminPanel");
const adminEmailInput = document.getElementById("adminEmail");
const adminCheckBtn = document.getElementById("adminCheckBtn");
const adminGateMsg = document.getElementById("adminGateMsg");
const currentAdminEmailEl = document.getElementById("currentAdminEmail");

const usersTableBody = document.querySelector("#usersTable tbody");
const whitelistTableBody = document.querySelector("#whitelistTable tbody");
const userSearch = document.getElementById("userSearch");
const exportCsvBtn = document.getElementById("exportCsv");
const logoutBtn = document.getElementById("logoutBtn");

const wlEmailInput = document.getElementById("wlEmail");
const wlPhoneInput = document.getElementById("wlPhone");
const addWhitelistBtn = document.getElementById("addWhitelistBtn");
const wlCsvUpload = document.getElementById("wlCsvUpload");
const cleanUpLadyToggle = document.getElementById("cleanUpLady");

const loaderOverlay = document.getElementById("loaderOverlay");
const loaderText = document.getElementById("loaderText");

// ---------- Helpers ----------
function showLoader(text = "Processing...") {
  loaderText.textContent = text;
  loaderOverlay.style.display = "flex";
}

function hideLoader() {
  loaderOverlay.style.display = "none";
}

function downloadCSV(filename, rows) {
  const csvContent = rows.map(r => r.map(v => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function createToggleCheckbox(value) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = value || false;
  return input;
}

// ---------- Admin login ----------
let currentAdmin = null;

async function checkAdmin(email) {
  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const data = snap.docs[0].data();
  if (data.isAdmin) return { email, id: snap.docs[0].id };
  return null;
}

adminCheckBtn.addEventListener("click", async () => {
  const email = adminEmailInput.value.trim().toLowerCase();
  if (!email) { adminGateMsg.textContent = "Enter email"; return; }
  showLoader("Checking admin...");
  const admin = await checkAdmin(email);
  hideLoader();
  if (!admin) { adminGateMsg.textContent = "Not authorized"; return; }
  currentAdmin = admin;
  currentAdminEmailEl.textContent = email;
  adminGate.classList.add("hidden");
  adminPanel.classList.remove("hidden");
  loadUsers();
  loadWhitelist();
});

// Logout
logoutBtn.addEventListener("click", () => {
  currentAdmin = null;
  adminPanel.classList.add("hidden");
  adminGate.classList.remove("hidden");
  adminEmailInput.value = "";
});

// ---------- Users ----------
let usersCache = [];

async function loadUsers() {
  usersTableBody.innerHTML = "";
  const snap = await getDocs(collection(db, "users"));
  usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderUsers(usersCache);
}

function renderUsers(users) {
  usersTableBody.innerHTML = "";
  users.forEach(u => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${u.email || ""}</td>
      <td>${u.phone || ""}</td>
      <td>${u.chatId || ""}</td>
      <td><input type="number" min="0" value="${u.stars || 0}" style="width:60px" /></td>
      <td><input type="number" min="0" value="${u.cash || 0}" style="width:60px" /></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td><button class="btn btn-primary">Enter</button></td>
    `;

    // Toggles
    const isVIP = createToggleCheckbox(u.isVIP);
    tr.children[5].appendChild(isVIP);

    const isAdmin = createToggleCheckbox(u.isAdmin);
    tr.children[6].appendChild(isAdmin);

    const isHost = createToggleCheckbox(u.isHost);
    tr.children[7].appendChild(isHost);

    const subscriptionActive = createToggleCheckbox(u.subscriptionActive);
    tr.children[8].appendChild(subscriptionActive);

    // Enter button
    tr.children[9].querySelector("button").addEventListener("click", async () => {
      showLoader("Updating user...");
      try {
        await updateDoc(doc(db, "users", u.id), {
          stars: Number(tr.children[3].querySelector("input").value),
          cash: Number(tr.children[4].querySelector("input").value),
          isVIP: isVIP.checked,
          isAdmin: isAdmin.checked,
          isHost: isHost.checked,
          subscriptionActive: subscriptionActive.checked
        });

        // Subscription toggle affects whitelist
        const wlRef = doc(db, "whitelist", u.email);
        if (subscriptionActive.checked) {
          await setDoc(wlRef, { email: u.email, phone: u.phone, subscriptionActive: true }, { merge: true });
        } else {
          await updateDoc(wlRef, { subscriptionActive: false }).catch(()=>{});
        }
        hideLoader();
        alert("User updated successfully!");
      } catch (err) { hideLoader(); console.error(err); alert("Update failed"); }
    });

    usersTableBody.appendChild(tr);
  });
}

// Search filter
userSearch.addEventListener("input", () => {
  const val = userSearch.value.toLowerCase();
  renderUsers(usersCache.filter(u => u.email.toLowerCase().includes(val) || (u.chatId||"").toLowerCase().includes(val)));
});

// Export CSV
exportCsvBtn.addEventListener("click", () => {
  const rows = [
    ["Email","Phone","ChatId","Stars","Cash","VIP","Admin","Host","Subscription"]
  ];
  usersCache.forEach(u => rows.push([
    u.email, u.phone, u.chatId, u.stars||0, u.cash||0,
    u.isVIP||false, u.isAdmin||false, u.isHost||false, u.subscriptionActive||false
  ]));
  downloadCSV("users_export.csv", rows);
});

// ---------- Whitelist ----------
async function loadWhitelist() {
  whitelistTableBody.innerHTML = "";
  const snap = await getDocs(collection(db, "whitelist"));
  snap.docs.forEach(d => {
    const w = d.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${w.email || ""}</td>
      <td>${w.phone || ""}</td>
      <td>${w.subscriptionActive ? "YES" : "NO"}</td>
      <td><button class="btn btn-danger">Remove</button></td>
    `;
    tr.querySelector("button").addEventListener("click", async () => {
      showLoader("Removing whitelist...");
      await deleteDoc(doc(db, "whitelist", w.email));
      hideLoader();
      loadWhitelist();
    });
    whitelistTableBody.appendChild(tr);
  });
}

// Add single whitelist
addWhitelistBtn.addEventListener("click", async () => {
  const email = wlEmailInput.value.trim().toLowerCase();
  const phone = wlPhoneInput.value.trim();
  if (!email || !phone) return alert("Enter email & phone");
  showLoader("Adding to whitelist...");
  const userSnap = await getDocs(query(collection(db,"users"), where("email","==",email)));
  let userId = null;
  if (userSnap.empty) {
    // create new user if not exists
    userId = email;
    await setDoc(doc(db,"users",userId), { email, phone, subscriptionActive: true });
  } else {
    userId = userSnap.docs[0].id;
    await updateDoc(doc(db,"users",userId), { subscriptionActive: true });
  }
  // Add to whitelist
  await setDoc(doc(db,"whitelist",email), { email, phone, subscriptionActive: true }, { merge:true });
  hideLoader();
  loadWhitelist();
  loadUsers();
});

// CSV upload
wlCsvUpload.addEventListener("change", async e => {
  const file = e.target.files[0];
  if (!file) return;
  showLoader("Processing CSV...");
  const text = await file.text();
  const lines = text.split("\n").map(l => l.trim()).filter(l=>l);
  const batchEmails = [];
  for (let line of lines) {
    const [email, phone] = line.split(",");
    if (!email) continue;
    batchEmails.push(email.toLowerCase());
    const userSnap = await getDocs(query(collection(db,"users"), where("email","==",email)));
    if (userSnap.empty) {
      await setDoc(doc(db,"users",email), { email, phone, subscriptionActive: true });
    } else {
      await updateDoc(userSnap.docs[0].ref, { subscriptionActive: true, subscriptionCount: (userSnap.docs[0].data().subscriptionCount||0)+1 });
    }
    await setDoc(doc(db,"whitelist",email), { email, phone, subscriptionActive: true }, { merge:true });
  }

  // Cleanup Lady
  if (cleanUpLadyToggle.checked) {
    const wlSnap = await getDocs(collection(db,"whitelist"));
    for (let docSnap of wlSnap.docs) {
      if (!batchEmails.includes(docSnap.id)) {
        await updateDoc(doc(db,"whitelist",docSnap.id), { subscriptionActive: false });
      }
    }
  }

  hideLoader();
  loadWhitelist();
  loadUsers();
});