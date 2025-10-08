// admin-payfeed.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc,
  updateDoc, deleteDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- Firebase config ---------- */
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

/* ---------- DOM refs ---------- */
const adminGate = document.getElementById("adminGate");
const adminPanel = document.getElementById("adminPanel");
const adminEmailInput = document.getElementById("adminEmail");
const adminCheckBtn = document.getElementById("adminCheckBtn");
const adminGateMsg = document.getElementById("adminGateMsg");
const currentAdminEmail = document.getElementById("currentAdminEmail");
const logoutBtn = document.getElementById("logoutBtn");

const usersTableBody = document.querySelector("#usersTable tbody");
const whitelistTableBody = document.querySelector("#whitelistTable tbody");

const userSearchInput = document.getElementById("userSearch");
const exportCsvBtn = document.getElementById("exportCsv");

const wlInput = document.getElementById("wlInput");
const injectWhitelistBtn = document.getElementById("injectWhitelistBtn");
const wlCsvFile = document.getElementById("wlCsvFile");
const cleanupLadyCheckbox = document.getElementById("cleanupLady");

/* Modal & loader elements (modal exists in HTML) */
const modalBg = document.getElementById("modalBg");
const modalTitle = document.getElementById("modalTitle");
const modalInput = document.getElementById("modalInput");
const modalConfirm = document.getElementById("modalConfirm");
const modalCancel = document.getElementById("modalCancel");

/* ---------- State ---------- */
let currentAdmin = null;
let usersCache = [];     // array of { id, ...data }
let whitelistCache = []; // array of { id, ...data }

/* ---------- Utilities ---------- */
function sanitizeKey(key = "") { return key.replace(/[.#$[\]]/g, ','); }
function showModal(title = "", defaultValue = "") {
  return new Promise(resolve => {
    modalTitle.innerText = title;
    modalInput.value = defaultValue ?? "";
    modalBg.classList.remove("hidden");
    function cleanup() {
      modalBg.classList.add("hidden");
      modalConfirm.onclick = null;
      modalCancel.onclick = null;
    }
    modalCancel.onclick = () => { cleanup(); resolve(null); };
    modalConfirm.onclick = () => { cleanup(); resolve(modalInput.value); };
  });
}
function showLoaderText(el, text = "Processing...") {
  // small ephemeral loader in button used where needed
  const prev = el.dataset.prevText;
  if (!prev) el.dataset.prevText = el.innerText;
  el.disabled = true;
  el.innerText = text;
}
function hideLoaderText(el) {
  if (el.dataset.prevText) el.innerText = el.dataset.prevText;
  el.disabled = false;
  delete el.dataset.prevText;
}
function downloadCSV(filename, rows) {
  const csv = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ---------- Admin login ---------- */
adminCheckBtn.addEventListener("click", async () => {
  const email = (adminEmailInput.value || "").trim().toLowerCase();
  if (!email) { adminGateMsg.innerText = "Enter admin email"; return; }

  try {
    const q = query(collection(db, "users"), where("email", "==", email), where("isAdmin", "==", true));
    const snap = await getDocs(q);
    if (snap.empty) { adminGateMsg.innerText = "Admin not found or not isAdmin"; return; }
    currentAdmin = { email };
    adminGate.style.display = "none";
    adminPanel.classList.remove("hidden");
    currentAdminEmail.innerText = email;
    adminGateMsg.innerText = "";
    await loadAllUsers();
    await loadWhitelist();
  } catch (err) {
    console.error(err);
    adminGateMsg.innerText = "Error checking admin";
  }
});

/* ---------- Logout ---------- */
logoutBtn?.addEventListener("click", () => {
  currentAdmin = null;
  adminPanel.classList.add("hidden");
  adminGate.style.display = "block";
  adminEmailInput.value = "";
});

/* ---------- Load & Render Users ---------- */
async function loadAllUsers() {
  usersTableBody.innerHTML = "";
  usersCache = [];
  const snap = await getDocs(collection(db, "users"));
  snap.forEach(d => {
    const data = d.data();
    data.id = d.id;
    usersCache.push(data);
  });
  // sort by email
  usersCache.sort((a,b) => (a.email||"").localeCompare(b.email||""));
  renderUsers(usersCache);
}

function renderUsers(list) {
  usersTableBody.innerHTML = "";
  list.forEach(u => {
    const tr = document.createElement("tr");
    tr.dataset.userid = u.id;
    tr.dataset.email = u.email || "";
    tr.dataset.chatid = u.chatId || "";

    // create editable cells
    const emailTd = document.createElement("td"); emailTd.innerText = u.email || ""; tr.appendChild(emailTd);
    const chatTd = document.createElement("td"); chatTd.innerText = u.chatId || ""; tr.appendChild(chatTd);

    // stars input
    const starsInput = document.createElement("input"); starsInput.type = "number"; starsInput.value = u.stars ?? 0; starsInput.min = 0; starsInput.style.width = "80px";
    const starsTd = document.createElement("td"); starsTd.appendChild(starsInput); tr.appendChild(starsTd);

    // cash input
    const cashInput = document.createElement("input"); cashInput.type = "number"; cashInput.value = u.cash ?? 0; cashInput.min = 0; cashInput.style.width = "80px";
    const cashTd = document.createElement("td"); cashTd.appendChild(cashInput); tr.appendChild(cashTd);

    // subscriptionActive toggle
    const subToggle = document.createElement("input"); subToggle.type = "checkbox"; subToggle.checked = !!u.subscriptionActive;
    const subTd = document.createElement("td"); subTd.appendChild(subToggle); tr.appendChild(subTd);

    // isVIP toggle
    const vipToggle = document.createElement("input"); vipToggle.type = "checkbox"; vipToggle.checked = !!u.isVIP;
    const vipTd = document.createElement("td"); vipTd.appendChild(vipToggle); tr.appendChild(vipTd);

    // isAdmin toggle
    const adminToggle = document.createElement("input"); adminToggle.type = "checkbox"; adminToggle.checked = !!u.isAdmin;
    const adminTd = document.createElement("td"); adminTd.appendChild(adminToggle); tr.appendChild(adminTd);

    // isHost toggle
    const hostToggle = document.createElement("input"); hostToggle.type = "checkbox"; hostToggle.checked = !!u.isHost;
    const hostTd = document.createElement("td"); hostTd.appendChild(hostToggle); tr.appendChild(hostTd);

    // Apply button
    const actionTd = document.createElement("td");
    const applyBtn = document.createElement("button"); applyBtn.className = "btn btn-primary small"; applyBtn.innerText = "Apply";
    actionTd.appendChild(applyBtn);
    tr.appendChild(actionTd);

    usersTableBody.appendChild(tr);

    // Apply handler: collect current inputs -> confirm -> write to Firestore with loader
    applyBtn.addEventListener("click", async () => {
      const updated = {
        stars: Number(starsInput.value) || 0,
        cash: Number(cashInput.value) || 0,
        subscriptionActive: !!subToggle.checked,
        isVIP: !!vipToggle.checked,
        isAdmin: !!adminToggle.checked,
        isHost: !!hostToggle.checked
      };

      const summary = `Apply changes to ${u.email}?\n\n` +
        `Stars: ${updated.stars}\nCash: ${updated.cash}\n` +
        `Subscription: ${updated.subscriptionActive}\nisVIP: ${updated.isVIP}\nisAdmin: ${updated.isAdmin}\nisHost: ${updated.isHost}`;

      const confirmVal = await showModal(`Confirm update for ${u.email}`, summary);
      if (confirmVal === null) return; // cancelled

      // show loader on button
      showLoaderText(applyBtn, "Applying...");
      try {
        // update users doc
        await updateDoc(doc(db, "users", u.id), updated);

        // Sync whitelist based on subscriptionActive
        const wlId = sanitizeKey(u.email || "");
        if (updated.subscriptionActive) {
          // upsert whitelist doc
          await setDoc(doc(db, "whitelist", wlId), { email: u.email, phone: u.phone || "", subscriptionActive: true }, { merge: true });
        } else {
          // mark whitelist entry as inactive (don't fully delete users)
          const wlRef = doc(db, "whitelist", wlId);
          const wlSnap = await getDoc(wlRef);
          if (wlSnap.exists()) {
            await updateDoc(wlRef, { subscriptionActive: false });
          }
        }

        // reload to reflect subscriptionCount etc.
        await loadAllUsers();
        await loadWhitelist();
        alert("Update applied ✅");
      } catch (err) {
        console.error(err);
        alert("Update failed — check console");
      } finally {
        hideLoaderText(applyBtn);
      }
    });
  });
}

/* ---------- Search / Filter ---------- */
userSearchInput.addEventListener("input", (e) => {
  const q = (e.target.value || "").trim().toLowerCase();
  document.querySelectorAll("#usersTable tbody tr").forEach(row => {
    const email = (row.dataset.email || "").toLowerCase();
    const chatId = (row.dataset.chatid || "").toLowerCase();
    row.style.display = (email.includes(q) || chatId.includes(q)) ? "" : "none";
  });
});

/* ---------- Load & Render Whitelist ---------- */
async function loadWhitelist() {
  whitelistTableBody.innerHTML = "";
  whitelistCache = [];
  const snap = await getDocs(collection(db, "whitelist"));
  snap.forEach(d => {
    const data = d.data(); data.id = d.id;
    whitelistCache.push(data);

    const tr = document.createElement("tr");
    const emailTd = document.createElement("td"); emailTd.innerText = data.email || ""; tr.appendChild(emailTd);
    const phoneTd = document.createElement("td"); phoneTd.innerText = data.phone || ""; tr.appendChild(phoneTd);
    const subTd = document.createElement("td"); subTd.innerText = data.subscriptionActive ? "YES" : "NO"; tr.appendChild(subTd);

    const actionTd = document.createElement("td");
    const removeBtn = document.createElement("button"); removeBtn.className = "btn btn-danger small"; removeBtn.innerText = "Remove";
    actionTd.appendChild(removeBtn);
    tr.appendChild(actionTd);

    whitelistTableBody.appendChild(tr);

    removeBtn.addEventListener("click", async () => {
      if (!confirm(`Remove ${data.email} from whitelist?`)) return;
      try {
        // set subscriptionActive false in whitelist and toggle user subscriptionActive false
        await updateDoc(doc(db, "whitelist", data.id), { subscriptionActive: false });
        const uSnap = await getDocs(query(collection(db, "users"), where("email", "==", data.email)));
        uSnap.forEach(async ud => {
          await updateDoc(doc(db, "users", ud.id), { subscriptionActive: false });
        });
        await loadWhitelist();
        await loadAllUsers();
      } catch (err) {
        console.error(err);
        alert("Failed to remove from whitelist");
      }
    });
  });
}

/* ---------- Whitelist injection (manual multi-line or CSV file) ---------- */
function parseCSVtext(text) {
  // Accept lines in the forms:
  // email,phone
  // email;phone
  // email
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    // try CSV split by comma first, then semicolon
    let parts = line.split(",");
    if (parts.length === 1) parts = line.split(";");
    const email = (parts[0] || "").trim().toLowerCase();
    const phone = (parts[1] || "").trim();
    if (email) out.push({ email, phone });
  }
  return out;
}

injectWhitelistBtn.addEventListener("click", async () => {
  const raw = (wlInput.value || "").trim();
  const file = wlCsvFile?.files?.[0];
  const cleanupActive = !!cleanupLadyCheckbox.checked;

  if (!raw && !file) return alert("Paste emails or choose CSV file.");

  let batchList = [];

  // if file present, parse file first (CSV file takes precedence)
  if (file) {
    const text = await file.text();
    batchList = parseCSVtext(text);
  } else {
    batchList = parseCSVtext(raw);
  }

  if (!batchList.length) return alert("No valid entries found.");

  // show loader on inject button
  showLoaderText(injectWhitelistBtn, "Injecting...");

  try {
    const seen = new Set();
    for (const entry of batchList) {
      const email = entry.email.toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      const phone = entry.phone || "";

      // upsert whitelist doc (use sanitized email as id)
      const wlId = sanitizeKey(email);
      await setDoc(doc(db, "whitelist", wlId), { email, phone, subscriptionActive: true }, { merge: true });

      // user handling
      const uQ = query(collection(db, "users"), where("email", "==", email));
      const uSnap = await getDocs(uQ);
      if (uSnap.empty) {
        // create user doc with id = sanitized email (consistent with other parts)
        await setDoc(doc(db, "users", wlId), {
          email,
          phone,
          chatId: `GUEST${Math.floor(1000 + Math.random()*9000)}`,
          stars: 0,
          cash: 0,
          subscriptionActive: true,
          subscriptionCount: 1,
          isVIP: false,
          isAdmin: false,
          isHost: false
        });
      } else {
        // existing users: toggle subscriptionActive = true
        for (const ud of uSnap.docs) {
          const existing = ud.data() || {};
          const updates = { subscriptionActive: true };
          if (cleanupActive) {
            // if cleanup is active and the user appears in batch, increment subscriptionCount
            updates.subscriptionCount = (existing.subscriptionCount || 0) + 1;
          }
          await updateDoc(doc(db, "users", ud.id), updates);
        }
      }
    }

    // Cleanup Lady behavior: remove whitelist entries not present in batch when cleanupActive = true
    if (cleanupActive) {
      const batchEmails = new Set(batchList.map(b => sanitizeKey(b.email)));
      const wlSnap = await getDocs(collection(db, "whitelist"));
      for (const wdoc of wlSnap.docs) {
        const id = wdoc.id;
        if (!batchEmails.has(id)) {
          // mark whitelist entry inactive (don't delete users)
          await updateDoc(doc(db, "whitelist", id), { subscriptionActive: false });
          // find users with that email and toggle their subscriptionActive false
          const uSnap = await getDocs(query(collection(db, "users"), where("email", "==", wdoc.id)));
          for (const ud of uSnap.docs) {
            await updateDoc(doc(db, "users", ud.id), { subscriptionActive: false });
          }
        }
      }
    }

    alert("Whitelist injection complete ✅");
  } catch (err) {
    console.error(err);
    alert("Injection failed — check console.");
  } finally {
    hideLoaderText(injectWhitelistBtn);
    // refresh lists
    await loadWhitelist();
    await loadAllUsers();
  }
});

/* ---------- CSV file input quick preview (optional) ---------- */
wlCsvFile?.addEventListener("change", async (e) => {
  // if you want, we could auto preview file contents in wlInput for quick edits
  const f = e.target.files[0];
  if (!f) return;
  try {
    const txt = await f.text();
    // show a short preview (first few lines) in the wlInput for transparency
    const preview = txt.split(/\r?\n/).slice(0, 10).join("\n");
    wlInput.value = preview;
  } catch (err) {
    console.error(err);
  }
});

/* ---------- Export all users (comprehensive fields) ---------- */
exportCsvBtn.addEventListener("click", async () => {
  try {
    const snap = await getDocs(collection(db, "users"));
    const rows = [];
    const keysSet = new Set();
    const docs = [];
    snap.forEach(d => {
      const data = d.data();
      docs.push({ id: d.id, ...data });
      Object.keys(data).forEach(k => keysSet.add(k));
    });
    // ensure some useful order
    const keys = ["email", "chatId", "phone", "stars", "cash", "subscriptionActive", "subscriptionCount", "isVIP", "isAdmin", "isHost", "hostLink", "invitedBy", "usernameColor"];
    // add remaining keys
    const extra = Array.from(keysSet).filter(k => !keys.includes(k));
    const header = keys.concat(extra).filter(Boolean);
    rows.push(header);
    for (const d of docs) {
      rows.push(header.map(h => d[h] ?? ""));
    }
    downloadCSV("users_full_export.csv", rows);
  } catch (err) {
    console.error(err);
    alert("Export failed");
  }
});

/* ---------- Init (hide modal initially) ---------- */
modalBg.classList.add("hidden");

// expose quick loaders for buttons (utility used above)
function showLoaderText(el, text = "Processing...") {
  if (!el) return;
  if (!el.dataset.orig) el.dataset.orig = el.innerText;
  el.disabled = true;
  el.innerText = text;
}
function hideLoaderText(el) {
  if (!el) return;
  if (el.dataset.orig) el.innerText = el.dataset.orig;
  el.disabled = false;
  delete el.dataset.orig;
}