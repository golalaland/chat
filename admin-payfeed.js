// admin-payfeed.js (revamped, with featuredHosts support, popupPhoto & videoUrl, and consistent mass actions)
// Font: 乂丨乂丨

// ---------- Firebase imports ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query, where
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
const whitelistTableBody = document.querySelector("#whitelistTable tbody");
const logoutBtn = document.getElementById("logoutBtn");
const loaderOverlay = document.getElementById("loaderOverlay");
const loaderText = document.getElementById("loaderText");

const massRemoveUsersBtn = document.getElementById("massRemoveUsersBtn");
const massRemoveWhitelistBtn = document.getElementById("massRemoveWhitelistBtn");
const copyToFeaturedBtn = document.getElementById("copyToFeaturedBtn");

// ---------- Loader Helpers ----------
function showLoader(text = "Processing...") {
  loaderText.textContent = text;
  loaderOverlay.style.display = "flex";
}
function hideLoader() { loaderOverlay.style.display = "none"; }

// ---------- Helpers ----------
function createToggleCheckbox(value) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!value;
  input.style.transform = "scale(1.2)";
  return input;
}

function showConfirmModal(title, message) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 3000, fontFamily: "'乂丨乂丨', monospace"
    });

    const card = document.createElement("div");
    Object.assign(card.style, {
      background: "#fff", padding: "18px", borderRadius: "10px",
      minWidth: "300px", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.12)"
    });

    card.innerHTML = `
      <h3 style="margin:0 0 8px">${title}</h3>
      <p style="margin:0 0 14px;color:#333">${message}</p>
      <div style="display:flex;justify-content:center;gap:10px">
        <button class="btn btn-primary" id="confirmYes">Confirm</button>
        <button class="btn btn-danger" id="confirmNo">Cancel</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.appendChild(card);
    card.querySelector("#confirmYes").onclick = () => { overlay.remove(); resolve(true); };
    card.querySelector("#confirmNo").onclick = () => { overlay.remove(); resolve(false); };
  });
}

// ---------- Admin login ----------
let currentAdmin = null;
async function checkAdmin(emailRaw) {
  const email = String(emailRaw || "").trim().toLowerCase();
  if (!email) return null;
  const snap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
  if (snap.empty) return null;
  const data = snap.docs[0].data() || {};
  return data.isAdmin === true ? { email, id: snap.docs[0].id } : null;
}

adminCheckBtn.addEventListener("click", async () => {
  adminGateMsg.textContent = "";
  const email = adminEmailInput.value.trim();
  if (!email) return adminGateMsg.textContent = "Enter admin email";
  showLoader("Checking admin...");
  const admin = await checkAdmin(email);
  hideLoader();
  if (!admin) return adminGateMsg.textContent = "Not authorized";
  currentAdmin = admin;
  currentAdminEmailEl.textContent = admin.email;
  adminGate.classList.add("hidden");
  adminPanel.classList.remove("hidden");
  await loadUsers(); await loadWhitelist();
});
logoutBtn.addEventListener("click", () => {
  currentAdmin = null;
  adminPanel.classList.add("hidden");
  adminGate.classList.remove("hidden");
  adminEmailInput.value = "";
});

// ---------- Load & Render Users ----------
let usersCache = [];
async function loadUsers() {
  try {
    usersTableBody.innerHTML = "";
    const snap = await getDocs(collection(db, "users"));
    usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsers(usersCache);
  } catch (e) {
    console.error(e);
    usersTableBody.innerHTML = `<tr><td colspan="13" class="muted">Failed to load users.</td></tr>`;
  }
}

function renderUsers(users) {
  usersTableBody.innerHTML = "";
  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.dataset.id = u.id;
    tr.style.fontFamily = "'乂丨乂丨', monospace";
    tr.innerHTML = `
      <td><input type="checkbox" class="row-select"/></td>
      <td>${u.email || ""}</td>
      <td>${u.phone || ""}</td>
      <td>${u.chatId || ""}</td>
      <td><input type="number" min="0" value="${u.stars || 0}" style="width:60px" /></td>
      <td><input type="number" min="0" value="${u.cash || 0}" style="width:60px" /></td>
      <td></td><td></td><td></td><td></td>
      <td><input type="checkbox" ${u.featuredHosts ? "checked" : ""}></td>
      <td><input type="text" placeholder="popup photo" value="${u.popupPhoto || ""}" style="width:120px"/></td>
      <td><input type="text" placeholder="video url" value="${u.videoUrl || ""}" style="width:120px"/></td>
      <td></td>
    `;

    const isVIP = createToggleCheckbox(u.isVIP);
    const isAdminToggle = createToggleCheckbox(u.isAdmin);
    const isHost = createToggleCheckbox(u.isHost);
    const subscriptionActive = createToggleCheckbox(u.subscriptionActive);

    tr.children[6].appendChild(isVIP);
    tr.children[7].appendChild(isAdminToggle);
    tr.children[8].appendChild(isHost);
    tr.children[9].appendChild(subscriptionActive);

    // Actions
    const actionsTd = tr.children[13];
    const enterBtn = document.createElement("button");
    enterBtn.className = "btn btn-primary small"; enterBtn.textContent = "Save";
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-danger small"; removeBtn.textContent = "Del";
    actionsTd.append(enterBtn, removeBtn);

    enterBtn.onclick = async () => {
      const confirmed = await showConfirmModal("Update user", `Apply changes for ${u.email}?`);
      if (!confirmed) return;
      showLoader("Updating...");
      try {
        const updates = {
          stars: Number(tr.children[4].querySelector("input").value || 0),
          cash: Number(tr.children[5].querySelector("input").value || 0),
          isVIP: isVIP.checked,
          isAdmin: isAdminToggle.checked,
          isHost: isHost.checked,
          subscriptionActive: subscriptionActive.checked,
          featuredHosts: tr.children[10].querySelector("input").checked,
          popupPhoto: tr.children[11].querySelector("input").value.trim(),
          videoUrl: tr.children[12].querySelector("input").value.trim()
        };
        await updateDoc(doc(db, "users", u.id), updates);
        hideLoader();
        alert("User updated successfully.");
      } catch (err) {
        console.error(err);
        hideLoader();
        alert("Failed to update user.");
      }
    };

    removeBtn.onclick = async () => {
      const confirmed = await showConfirmModal("Remove user", `Delete ${u.email}?`);
      if (!confirmed) return;
      showLoader("Removing...");
      try {
        await deleteDoc(doc(db, "users", u.id));
        hideLoader();
        await loadUsers();
        alert(`${u.email} removed.`);
      } catch (err) {
        hideLoader();
        console.error(err);
        alert("Failed to remove user.");
      }
    };

    usersTableBody.appendChild(tr);
  });
}

// ---------- Select All ----------
const selectAllUsers = document.getElementById("selectAllUsers");
if (selectAllUsers) {
  selectAllUsers.addEventListener("change", () => {
    const checked = selectAllUsers.checked;
    usersTableBody.querySelectorAll("input.row-select").forEach(cb => cb.checked = checked);
  });
}

function getCheckedRowIds() {
  return Array.from(usersTableBody.querySelectorAll("tr"))
    .filter(r => r.querySelector("input.row-select")?.checked)
    .map(r => r.dataset.id);
}

// ---------- Mass Remove ----------
massRemoveUsersBtn.addEventListener("click", async () => {
  const ids = getCheckedRowIds();
  if (!ids.length) return alert("No users selected.");
  const confirmed = await showConfirmModal("Remove Users", `Delete ${ids.length} users?`);
  if (!confirmed) return;
  showLoader("Removing...");
  try {
    for (const id of ids) await deleteDoc(doc(db, "users", id)).catch(() => {});
    hideLoader();
    await loadUsers();
    selectAllUsers.checked = false;
    alert(`${ids.length} users removed.`);
  } catch (err) {
    hideLoader();
    console.error(err);
    alert("Failed to remove users.");
  }
});

// ---------- Copy Selected to Featured Hosts ----------
copyToFeaturedBtn.addEventListener("click", async () => {
  const ids = getCheckedRowIds();
  if (!ids.length) return alert("No users selected.");
  const confirmed = await showConfirmModal("Copy to Featured Hosts", `Copy ${ids.length} user(s)?`);
  if (!confirmed) return;
  showLoader("Copying...");
  try {
    for (const id of ids) {
      const user = usersCache.find(u => u.id === id);
      if (!user) continue;
      await setDoc(doc(db, "featuredHosts", id), {
        ...user,
        featuredHosts: true,
        popupPhoto: user.popupPhoto || "",
        videoUrl: user.videoUrl || "",
        timestamp: Date.now()
      }, { merge: true });
    }
    hideLoader();
    alert(`${ids.length} users copied to Featured Hosts.`);
  } catch (err) {
    hideLoader();
    console.error("Featured copy error:", err);
    alert("Failed to copy users to Featured Hosts.");
  }
});

// ---------- Whitelist ----------
async function loadWhitelist() {
  try {
    whitelistTableBody.innerHTML = "";
    const snap = await getDocs(collection(db, "whitelist"));
    snap.forEach(docSnap => {
      const w = docSnap.data();
      const tr = document.createElement("tr");
      tr.dataset.id = docSnap.id;
      tr.innerHTML = `
        <td><input type="checkbox" class="row-select"/></td>
        <td>${w.email || ""}</td>
        <td>${w.phone || ""}</td>
        <td>${w.subscriptionActive ? "Active" : "Inactive"}</td>
        <td><button class="btn btn-danger small">Remove</button></td>
      `;
      tr.querySelector("button").onclick = async () => {
        const confirmed = await showConfirmModal("Remove", `Remove ${w.email}?`);
        if (!confirmed) return;
        showLoader("Removing...");
        await deleteDoc(doc(db, "whitelist", docSnap.id));
        hideLoader();
        await loadWhitelist();
      };
      whitelistTableBody.appendChild(tr);
    });
  } catch (err) {
    whitelistTableBody.innerHTML = `<tr><td colspan="5">Failed to load whitelist.</td></tr>`;
  }
}