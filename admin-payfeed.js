// admin-payfeed.js (revamped, optimized, mass-select, featured-host copy, & mass-remove ready with 乂丨乂丨 font)

// ---------- Firebase imports ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc,
  query, where
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

// ---------- Helpers ----------
function showLoader(text = "Processing...") {
  if (loaderText) loaderText.textContent = text;
  loaderOverlay.style.display = "flex";
}
function hideLoader() { loaderOverlay.style.display = "none"; }

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
      minWidth: "300px", maxWidth: "90%", textAlign: "center",
      boxShadow: "0 8px 30px rgba(0,0,0,0.12)"
    });

    const h = document.createElement("h3"); h.textContent = title; h.style.margin = "0 0 8px";
    const p = document.createElement("p"); p.textContent = message; p.style.margin = "0 0 14px"; p.style.color="#333";

    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, {display:"flex",justifyContent:"center",gap:"10px"});
    const confirmBtn = document.createElement("button");
    confirmBtn.className="btn btn-primary"; confirmBtn.textContent="Confirm";
    const cancelBtn = document.createElement("button");
    cancelBtn.className="btn btn-danger"; cancelBtn.textContent="Cancel";

    confirmBtn.onclick = () => { overlay.remove(); resolve(true); };
    cancelBtn.onclick = () => { overlay.remove(); resolve(false); };
    btnRow.appendChild(confirmBtn); btnRow.appendChild(cancelBtn);

    card.appendChild(h); card.appendChild(p); card.appendChild(btnRow);
    overlay.appendChild(card); document.body.appendChild(overlay);
  });
}

// ---------- Admin login ----------
let currentAdmin = null;
async function checkAdmin(emailRaw) {
  const email = String(emailRaw || "").trim().toLowerCase();
  if (!email) return null;
  const snap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
  if (snap.empty) return null;
  const d = snap.docs[0].data() || {};
  return d.isAdmin === true ? { email, id: snap.docs[0].id } : null;
}

adminCheckBtn.addEventListener("click", async () => {
  adminGateMsg.textContent = "";
  const emailRaw = (adminEmailInput.value || "").trim();
  if (!emailRaw) { adminGateMsg.textContent = "Enter admin email"; return; }
  showLoader("Checking admin...");
  const admin = await checkAdmin(emailRaw);
  hideLoader();
  if (!admin) { adminGateMsg.textContent = "Not authorized"; return; }
  currentAdmin = admin;
  currentAdminEmailEl.textContent = admin.email;
  adminGate.classList.add("hidden");
  adminPanel.classList.remove("hidden");
  await loadUsers(); await loadWhitelist();
});
adminEmailInput.addEventListener("keydown", e => { if (e.key === "Enter") adminCheckBtn.click(); });
logoutBtn.addEventListener("click", () => {
  currentAdmin = null;
  adminPanel.classList.add("hidden");
  adminGate.classList.remove("hidden");
  adminEmailInput.value = "";
});

// ---------- Users list/render ----------
let usersCache = [];
async function loadUsers() {
  try {
    usersTableBody.innerHTML = "";
    const snap = await getDocs(collection(db, "users"));
    usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsers(usersCache);
  } catch (e) {
    console.error(e);
    usersTableBody.innerHTML = `<tr><td colspan="12" class="muted">Failed to load users.</td></tr>`;
  }
}

function renderUsers(users) {
  usersTableBody.innerHTML = "";
  users.forEach(u => {
    const tr = document.createElement("tr");
    tr.dataset.id = u.id;
    tr.style.fontFamily = "'乂丨乂丨', monospace";
    tr.innerHTML = `
      <td><input type="checkbox" class="row-select user-select"/></td>
      <td>${u.email || ""}</td>
      <td>${u.phone || ""}</td>
      <td>${u.chatId || ""}</td>
      <td><input type="number" min="0" value="${u.stars || 0}" style="width:60px" /></td>
      <td><input type="number" min="0" value="${u.cash || 0}" style="width:60px" /></td>
      <td></td><td></td><td></td><td></td><td></td>
    `;

    const isVIP = createToggleCheckbox(u.isVIP);
    const isAdminToggle = createToggleCheckbox(u.isAdmin);
    const isHost = createToggleCheckbox(u.isHost);
    const subscriptionActive = createToggleCheckbox(u.subscriptionActive);

    tr.children[6].appendChild(isVIP);
    tr.children[7].appendChild(isAdminToggle);
    tr.children[8].appendChild(isHost);
    tr.children[9].appendChild(subscriptionActive);

    const actionsTd = tr.children[10];
    const actionsDiv = document.createElement("div"); actionsDiv.className = "actions";
    const enterBtn = document.createElement("button"); enterBtn.className = "btn btn-primary"; enterBtn.textContent = "Enter";
    const removeBtn = document.createElement("button"); removeBtn.className = "btn btn-danger"; removeBtn.textContent = "Remove";
    actionsDiv.appendChild(enterBtn); actionsDiv.appendChild(removeBtn); actionsTd.appendChild(actionsDiv);

    // Enter button logic
    enterBtn.addEventListener("click", async () => {
      const confirmed = await showConfirmModal("Update user", `Apply changes for ${u.email || "(no email)"}?`);
      if (!confirmed) return;
      showLoader("Updating user...");
      try {
        const stars = Number(tr.children[4].querySelector("input").value || 0);
        const cash = Number(tr.children[5].querySelector("input").value || 0);
        const updates = {
          stars, cash,
          isVIP: isVIP.checked,
          isAdmin: isAdminToggle.checked,
          isHost: isHost.checked,
          subscriptionActive: subscriptionActive.checked
        };
        if (updates.subscriptionActive) {
          updates.subscriptionStartTime = Date.now();
          updates.subscriptionCount = (u.subscriptionCount || 0) + 1;
        }
        await updateDoc(doc(db, "users", u.id), updates);

        const wlRef = doc(db, "whitelist", (u.email || "").toLowerCase());
        if (updates.subscriptionActive)
          await setDoc(wlRef, {
            email: (u.email || "").toLowerCase(),
            phone: u.phone || "",
            chatId: u.chatId || "",
            subscriptionActive: true,
            subscriptionStartTime: updates.subscriptionStartTime
          }, { merge: true });
        else
          await updateDoc(wlRef, { subscriptionActive: false }).catch(() => {});

        hideLoader(); await loadUsers(); await loadWhitelist();
        alert("User updated successfully.");
      } catch (err) { hideLoader(); console.error(err); alert("Failed to update user. See console."); }
    });

    // Remove button logic
    removeBtn.addEventListener("click", async () => {
      const confirmed = await showConfirmModal("Remove user", `Delete ${u.email || "(no email)"} from database?`);
      if (!confirmed) return;
      showLoader("Removing user...");
      try {
        await deleteDoc(doc(db, "users", u.id)).catch(() => {});
        if (u.email) await deleteDoc(doc(db, "whitelist", u.email.toLowerCase())).catch(() => {});
        hideLoader(); await loadUsers(); await loadWhitelist();
        alert(`${u.email || "(no email)"} removed successfully.`);
      } catch (err) { hideLoader(); console.error("Remove user error:", err); alert("Failed to remove user. See console."); }
    });

    usersTableBody.appendChild(tr);
  });
}

// ---------- Mass Select ----------
const selectAllUsers = document.createElement("input");
selectAllUsers.type = "checkbox"; selectAllUsers.id = "selectAllUsers";
document.querySelector("#usersTable thead tr").insertBefore(selectAllUsers, document.querySelector("#usersTable thead tr").firstChild);

const selectAllWhitelist = document.createElement("input");
selectAllWhitelist.type = "checkbox"; selectAllWhitelist.id = "selectAllWhitelist";
document.querySelector("#whitelistTable thead tr").insertBefore(selectAllWhitelist, document.querySelector("#whitelistTable thead tr").firstChild);

selectAllUsers.addEventListener("change", () => {
  const checked = selectAllUsers.checked;
  document.querySelectorAll("#usersTable tbody input.row-select").forEach(cb => cb.checked = checked);
});
selectAllWhitelist.addEventListener("change", () => {
  const checked = selectAllWhitelist.checked;
  document.querySelectorAll("#whitelistTable tbody input.row-select").forEach(cb => cb.checked = checked);
});

function getCheckedRowIds(tableBody) {
  return Array.from(tableBody.querySelectorAll("tr"))
    .filter(r => r.querySelector("input.row-select")?.checked)
    .map(r => r.dataset.id);
}

// ---------- Mass Remove ----------
massRemoveUsersBtn.addEventListener("click", async () => {
  const ids = getCheckedRowIds(usersTableBody);
  if (!ids.length) return alert("No users selected.");
  const selectedEmails = ids.map(id => usersCache.find(u => u.id === id)?.email);
  const confirmed = await showConfirmModal("Remove Users", `Delete ${ids.length} user(s)?`);
  if (!confirmed) return;
  showLoader("Removing users...");
  try {
    for (let i = 0; i < ids.length; i++) {
      await deleteDoc(doc(db, "users", ids[i])).catch(() => {});
      if (selectedEmails[i]) await deleteDoc(doc(db, "whitelist", selectedEmails[i].toLowerCase())).catch(() => {});
    }
    hideLoader(); await loadUsers(); await loadWhitelist(); selectAllUsers.checked = false;
    alert(`${ids.length} user(s) removed.`);
  } catch (err) { hideLoader(); console.error(err); alert("Failed to remove selected users."); }
});

massRemoveWhitelistBtn.addEventListener("click", async () => {
  const ids = getCheckedRowIds(whitelistTableBody);
  if (!ids.length) return alert("No whitelist entries selected.");
  const confirmed = await showConfirmModal("Remove Whitelist", `Delete ${ids.length} entry(s)?`);
  if (!confirmed) return;
  showLoader("Removing whitelist...");
  try {
    for (const email of ids) {
      await deleteDoc(doc(db, "whitelist", email)).catch(() => {});
    }
    hideLoader(); await loadWhitelist(); selectAllWhitelist.checked = false;
    alert(`${ids.length} whitelist entry(s) removed.`);
  } catch (err) { hideLoader(); console.error(err); alert("Failed to remove selected whitelist entries."); }
});

// ---------- Copy Selected Users to Featured Hosts ----------
if (copyToFeaturedBtn) {
  copyToFeaturedBtn.addEventListener("click", async () => {
    const ids = getCheckedRowIds(usersTableBody);
    if (!ids.length) return alert("No users selected.");
    const confirmed = await showConfirmModal("Feature Hosts", `Add ${ids.length} user(s) to Featured Hosts collection?`);
    if (!confirmed) return;

    showLoader("Copying to Featured Hosts...");
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
      alert(`${ids.length} user(s) copied to Featured Hosts.`);
    } catch (err) {
      hideLoader();
      console.error("Copy to featured hosts error:", err);
      alert("Failed to copy selected users to Featured Hosts.");
    }
  });
}