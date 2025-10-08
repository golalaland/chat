// admin-payfeed.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc,
  query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- Firebase config (fill yours) ---------- */
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

/* ---------- DOM ---------- */
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

/* ---------- Helpers ---------- */
function showLoader(text = "Processing...") {
  if (loaderText) loaderText.textContent = text;
  if (loaderOverlay) loaderOverlay.style.display = "flex";
}
function hideLoader() {
  if (loaderOverlay) loaderOverlay.style.display = "none";
}
function downloadCSV(filename, rows) {
  const csvContent = rows.map(r => r.map(v => `"${String(v ?? "")}"`).join(",")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}
function createToggleCheckbox(value) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = !!value;
  return input;
}
function showConfirmModal(title, message) {
  return new Promise(resolve => {
    // modal overlay
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      background: "rgba(0,0,0,0.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 3000
    });

    const card = document.createElement("div");
    Object.assign(card.style, {
      background: "#fff",
      padding: "18px",
      borderRadius: "10px",
      minWidth: "300px",
      maxWidth: "90%",
      textAlign: "center",
      boxShadow: "0 8px 30px rgba(0,0,0,0.12)"
    });

    const h = document.createElement("h3");
    h.textContent = title;
    h.style.margin = "0 0 8px";

    const p = document.createElement("p");
    p.textContent = message;
    p.style.margin = "0 0 14px";
    p.style.color = "#333";

    const btnRow = document.createElement("div");
    Object.assign(btnRow.style, { display: "flex", justifyContent: "center", gap: "10px" });

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "btn btn-primary";
    confirmBtn.textContent = "Confirm";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-danger";
    cancelBtn.textContent = "Cancel";

    confirmBtn.onclick = () => { overlay.remove(); resolve(true); };
    cancelBtn.onclick = () => { overlay.remove(); resolve(false); };

    btnRow.appendChild(confirmBtn);
    btnRow.appendChild(cancelBtn);

    card.appendChild(h);
    card.appendChild(p);
    card.appendChild(btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

/* ---------- Admin login (fixed: lowercase + strict boolean check) ---------- */
let currentAdmin = null;

async function checkAdmin(emailRaw) {
  try {
    const email = String(emailRaw || "").trim().toLowerCase();
    if (!email) return null;
    // Query user by email (stored emails should be lowercased in your DB)
    const q = query(collection(db, "users"), where("email", "==", email));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0].data() || {};
    // only accept explicit true
    if (d.isAdmin === true) {
      return { email, id: snap.docs[0].id };
    }
    return null;
  } catch (err) {
    console.error("checkAdmin error", err);
    return null;
  }
}

adminCheckBtn.addEventListener("click", async () => {
  adminGateMsg.textContent = "";
  const raw = (adminEmailInput.value || "").trim();
  if (!raw) { adminGateMsg.textContent = "Enter admin email"; return; }

  const email = raw.toLowerCase();
  showLoader("Checking admin...");
  const admin = await checkAdmin(email);
  hideLoader();
  if (!admin) {
    adminGateMsg.textContent = "Not authorized (make sure admin email exists and has isAdmin: true)";
    return;
  }

  currentAdmin = admin;
  currentAdminEmailEl.textContent = admin.email;
  adminGate.classList.add("hidden");
  adminPanel.classList.remove("hidden");

  await loadUsers();
  await loadWhitelist();
});

/* Optional: allow Enter key to attempt login */
adminEmailInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") adminCheckBtn.click();
});

logoutBtn.addEventListener("click", () => {
  currentAdmin = null;
  adminPanel.classList.add("hidden");
  adminGate.classList.remove("hidden");
  adminEmailInput.value = "";
});

/* ---------- Users list/render ---------- */
let usersCache = [];

async function loadUsers() {
  try {
    usersTableBody.innerHTML = "";
    const snap = await getDocs(collection(db, "users"));
    usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsers(usersCache);
  } catch (err) {
    console.error("loadUsers error", err);
    usersTableBody.innerHTML = `<tr><td colspan="10" class="muted">Failed to load users.</td></tr>`;
  }
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
      <td></td><td></td><td></td>
      <td></td>
      <td><button class="btn btn-primary">Enter</button></td>
    `;

    // toggles columns indexes: 5,6,7,8
    const isVIP = createToggleCheckbox(u.isVIP);
    const isAdminToggle = createToggleCheckbox(u.isAdmin);
    const isHost = createToggleCheckbox(u.isHost);
    const subscriptionActive = createToggleCheckbox(u.subscriptionActive);

    tr.children[5].appendChild(isVIP);
    tr.children[6].appendChild(isAdminToggle);
    tr.children[7].appendChild(isHost);
    tr.children[8].appendChild(subscriptionActive);

    // Enter button action
    const enterBtn = tr.children[9].querySelector("button");
    enterBtn.addEventListener("click", async () => {
      const confirmed = await showConfirmModal("Update user", `Apply changes for ${u.email || "(no email)"}?`);
      if (!confirmed) return;

      showLoader("Updating user...");
      try {
        // read inputs
        const stars = Number(tr.children[3].querySelector("input").value || 0);
        const cash = Number(tr.children[4].querySelector("input").value || 0);

        // prepare update payload
        const updates = {
          stars,
          cash,
          isVIP: !!isVIP.checked,
          isAdmin: !!isAdminToggle.checked,
          isHost: !!isHost.checked,
          subscriptionActive: !!subscriptionActive.checked
        };

        // when turning subscription on, set start time to now
        if (updates.subscriptionActive) {
          updates.subscriptionStartTime = Date.now();
          // increment subscriptionCount if exists else set to 1
          updates.subscriptionCount = (u.subscriptionCount || 0) + 1;
        }

        // update users doc
        await updateDoc(doc(db, "users", u.id), updates);

        // whitelist sync
        const wlRef = doc(db, "whitelist", (u.email || "").toLowerCase());
        if (updates.subscriptionActive) {
          await setDoc(wlRef, {
            email: (u.email || "").toLowerCase(),
            phone: u.phone || "",
            chatId: u.chatId || "",
            subscriptionActive: true,
            subscriptionStartTime: updates.subscriptionStartTime || Date.now()
          }, { merge: true });
        } else {
          // turn off in whitelist (don't delete the doc entirely)
          await updateDoc(wlRef, { subscriptionActive: false }).catch(() => { /* ignore */ });
        }

        hideLoader();
        await loadUsers();
        await loadWhitelist();
        alert("User updated successfully.");
      } catch (err) {
        hideLoader();
        console.error("Enter update error:", err);
        alert("Failed to update user. See console.");
      }
    });

    usersTableBody.appendChild(tr);
  });
}

/* search */
userSearch.addEventListener("input", () => {
  const q = (userSearch.value || "").toLowerCase();
  renderUsers(usersCache.filter(u =>
    (u.email || "").toLowerCase().includes(q) ||
    ((u.chatId || "").toLowerCase().includes(q))
  ));
});

/* export CSV */
exportCsvBtn.addEventListener("click", () => {
  const rows = [["email", "phone", "chatId", "stars", "cash", "isVIP", "isAdmin", "isHost", "subscriptionActive", "subscriptionStartTime", "subscriptionCount"]];
  usersCache.forEach(u => {
    rows.push([
      u.email || "",
      u.phone || "",
      u.chatId || "",
      u.stars || 0,
      u.cash || 0,
      !!u.isVIP,
      !!u.isAdmin,
      !!u.isHost,
      !!u.subscriptionActive,
      u.subscriptionStartTime || "",
      u.subscriptionCount || 0
    ]);
  });
  downloadCSV("users_export.csv", rows);
});

/* ---------- Whitelist load & helpers ---------- */
async function loadWhitelist() {
  whitelistTableBody.innerHTML = "";
  try {
    const snap = await getDocs(collection(db, "whitelist"));
    if (snap.empty) {
      whitelistTableBody.innerHTML = `<tr><td colspan="4" class="muted">No whitelist entries.</td></tr>`;
      return;
    }
    snap.docs.forEach(d => {
      const w = d.data() || {};
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${w.email || ""}</td>
        <td>${w.phone || ""}</td>
        <td>${w.subscriptionActive ? "YES" : "NO"}</td>
        <td><button class="btn btn-danger">Remove</button></td>
      `;
      const btn = tr.querySelector("button");
      btn.addEventListener("click", async () => {
        const confirmed = await showConfirmModal("Remove from whitelist", `Remove ${w.email || ""} from whitelist?`);
        if (!confirmed) return;
        showLoader("Removing from whitelist...");
        try {
          // also update user subscriptionActive => false if user exists
          const emailKey = (w.email || "").toLowerCase();
          // try update users doc with id === emailKey or find by email
          try { await updateDoc(doc(db, "users", emailKey), { subscriptionActive: false }).catch(()=>{}); } catch(e){}
          // remove from whitelist (delete doc)
          await deleteDoc(doc(db, "whitelist", emailKey)).catch(()=>{});
          hideLoader();
          await loadWhitelist();
          await loadUsers();
        } catch (err) {
          hideLoader();
          console.error("remove whitelist error", err);
          alert("Failed to remove from whitelist.");
        }
      });
      whitelistTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error("loadWhitelist error", err);
    whitelistTableBody.innerHTML = `<tr><td colspan="4" class="muted">Failed to load whitelist.</td></tr>`;
  }
}

/* ---------- Helper to find user by triple match (email+phone+chatId) ---------- */
async function findUserByTriple(email, phone, chatId) {
  const e = String(email || "").trim().toLowerCase();
  const p = String(phone || "").trim();
  const c = String(chatId || "").trim();
  if (!e) return null;
  // Use chained where if possible (all equality)
  try {
    const q = query(collection(db, "users"),
      where("email", "==", e),
      where("phone", "==", p),
      where("chatId", "==", c)
    );
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0]; // return DocumentSnapshot
    // If no exact triple match, optionally try fallback: find by email then check fields
    const q2 = query(collection(db, "users"), where("email", "==", e));
    const snap2 = await getDocs(q2);
    for (const ds of snap2.docs) {
      const data = ds.data() || {};
      if ((String(data.phone || "") === p) && (String(data.chatId || "") === c)) return ds;
    }
    return null;
  } catch (err) {
    console.warn("findUserByTriple fallback error, trying email-only search", err);
    const snap = await getDocs(query(collection(db, "users"), where("email", "==", e)));
    return snap.empty ? null : snap.docs[0];
  }
}

/* ---------- Manual whitelist add (email + phone) ---------- */
addWhitelistBtn.addEventListener("click", async () => {
  const emailRaw = (wlEmailInput.value || "").trim();
  const phone = (wlPhoneInput.value || "").trim();
  if (!emailRaw || !phone) return alert("Enter email & phone");
  const email = emailRaw.toLowerCase();

  const confirmed = await showConfirmModal("Add to whitelist", `Add ${email} to whitelist?`);
  if (!confirmed) return;

  showLoader("Adding to whitelist...");
  try {
    // try find by email (manual path doesn't require chatId)
    const snap = await getDocs(query(collection(db, "users"), where("email", "==", email)));
    if (snap.empty) {
      // create new user doc with doc id = email (safe unique id)
      await setDoc(doc(db, "users", email), {
        email,
        phone,
        chatId: "", // unknown
        subscriptionActive: true,
        subscriptionStartTime: Date.now(),
        subscriptionCount: 1
      });
    } else {
      const ds = snap.docs[0];
      const data = ds.data() || {};
      await updateDoc(ds.ref, {
        phone,
        subscriptionActive: true,
        subscriptionStartTime: Date.now(),
        subscriptionCount: (data.subscriptionCount || 0) + 1
      });
    }
    // set whitelist
    await setDoc(doc(db, "whitelist", email), {
      email,
      phone,
      subscriptionActive: true,
      subscriptionStartTime: Date.now()
    }, { merge: true });

    hideLoader();
    await loadWhitelist();
    await loadUsers();
    alert(`${email} added/updated on whitelist.`);
  } catch (err) {
    hideLoader();
    console.error("manual whitelist add error", err);
    alert("Failed to add to whitelist. See console.");
  }
});

/* ---------- CSV batch injection (expects lines: email,phone,chatId) ---------- */
wlCsvUpload.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const proceed = await showConfirmModal("CSV Batch", "Inject CSV batch to whitelist? This will add/update users and update whitelist.");
  if (!proceed) return;

  showLoader("Processing CSV...");
  try {
    const text = await file.text();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
    const batchEmails = []; // used for cleanup lady
    for (const line of lines) {
      const parts = line.split(",").map(p => p.trim());
      // require at least email, phone, chatId (chatId must be present per your instruction)
      const emailRaw = parts[0] || "";
      const phone = parts[1] || "";
      const chatId = parts[2] || "";
      if (!emailRaw || !phone || !chatId) continue;
      const email = emailRaw.toLowerCase();
      batchEmails.push(email);

      // triple-match search
      const userDoc = await findUserByTriple(email, phone, chatId);
      if (!userDoc) {
        // create new user with doc id as email
        await setDoc(doc(db, "users", email), {
          email,
          phone,
          chatId,
          subscriptionActive: true,
          subscriptionStartTime: Date.now(),
          subscriptionCount: 1,
          // you can add default other fields here if desired
        });
      } else {
        // update existing
        const data = userDoc.data() || {};
        await updateDoc(userDoc.ref, {
          phone,
          chatId,
          subscriptionActive: true,
          subscriptionStartTime: Date.now(),
          subscriptionCount: (data.subscriptionCount || 0) + 1
        });
      }

      // update whitelist doc (keyed by email)
      await setDoc(doc(db, "whitelist", email), {
        email,
        phone,
        chatId,
        subscriptionActive: true,
        subscriptionStartTime: Date.now()
      }, { merge: true });
    }

    // Cleanup Lady: remove from whitelist anyone not in this batch (but leave user doc)
    if (cleanUpLadyToggle.checked) {
      const wlSnap = await getDocs(collection(db, "whitelist"));
      for (const wlDoc of wlSnap.docs) {
        const key = (wlDoc.id || "").toLowerCase();
        if (!batchEmails.includes(key)) {
          // toggle off in whitelist and users (keep user doc)
          await updateDoc(doc(db, "whitelist", key), { subscriptionActive: false }).catch(() => { });
          // If there's a user doc with same id, toggle subscriptionActive false there too
          try { await updateDoc(doc(db, "users", key), { subscriptionActive: false }).catch(() => { }); } catch(e){}
        }
      }
    }

    hideLoader();
    await loadWhitelist();
    await loadUsers();
    alert("CSV batch processed.");
  } catch (err) {
    hideLoader();
    console.error("CSV batch error", err);
    alert("Failed to process CSV. See console.");
  } finally {
    // reset file input so same file can be reselected if needed
    wlCsvUpload.value = "";
  }
});

/* ---------- Auto-expiry for subscriptionActive (client-side check) ----------
   Runs every 5 minutes and turns off subscriptionActive if subscriptionStartTime older than DURATION_MS
   NOTE: This is a client-side safety net. For production reliability use a server-side scheduled function.
------------------------------------------------------------------------- */
const SUB_DURATION_HOURS = 169;
const DURATION_MS = SUB_DURATION_HOURS * 60 * 60 * 1000;

setInterval(async () => {
  try {
    showLoader("Checking expirations...");
    const snap = await getDocs(collection(db, "users"));
    for (const ds of snap.docs) {
      const data = ds.data() || {};
      if (data.subscriptionActive && data.subscriptionStartTime) {
        // subscriptionStartTime might be stored as number (Date.now()) or Firestore Timestamp,
        // handle both cases
        let startMs = data.subscriptionStartTime;
        if (startMs && typeof startMs === "object" && startMs.toMillis) {
          startMs = startMs.toMillis();
        }
        startMs = Number(startMs || 0);
        const elapsed = Date.now() - startMs;
        if (elapsed >= DURATION_MS) {
          // expire
          await updateDoc(ds.ref, { subscriptionActive: false }).catch(() => { });
          // update whitelist entry if exists
          if (data.email) {
            await updateDoc(doc(db, "whitelist", String(data.email).toLowerCase()), { subscriptionActive: false }).catch(() => { });
          }
        }
      }
    }
  } catch (err) {
    console.error("auto-expiry check error", err);
  } finally {
    hideLoader();
  }
}, 5 * 60 * 1000); // every 5 minutes

/* ---------- Initial safety: do not auto-run any modal on load ---------- */
/* End of file */