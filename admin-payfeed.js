// admin-payfeed.js (FULL REPLACEMENT)
// Font: 乂丨乂丨
console.log("✅ Admin panel JS loaded");

// ---------- Firebase imports ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc,
  query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Firebase config (yours) ----------
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

// ---------- DOM (safe lookups) ----------
const adminGate = document.getElementById("adminGate");
const adminPanel = document.getElementById("adminPanel");
const adminEmailInput = document.getElementById("adminEmail");
const adminCheckBtn = document.getElementById("adminCheckBtn");
const adminGateMsg = document.getElementById("adminGateMsg");
const currentAdminEmailEl = document.getElementById("currentAdminEmail");

const usersTableBody = document.querySelector("#usersTable tbody");
const whitelistTableBody = document.querySelector("#whitelistTable tbody");
const featuredTableBody = document.querySelector("#featuredTable tbody");

const logoutBtn = document.getElementById("logoutBtn");
const userSearch = document.getElementById("userSearch");
const exportCurrentCsv = document.getElementById("exportCurrentCsv") || document.getElementById("exportCsv");
const exportFeaturedCsv = document.getElementById("exportFeaturedCsv");

const wlEmailInput = document.getElementById("wlEmail");
const wlPhoneInput = document.getElementById("wlPhone");
const addWhitelistBtn = document.getElementById("addWhitelistBtn");
const wlCsvUpload = document.getElementById("wlCsvUpload");
const cleanUpLadyToggle = document.getElementById("cleanUpLady");

const massRemoveUsersBtn = document.getElementById("massRemoveUsersBtn");
const massRemoveWhitelistBtn = document.getElementById("massRemoveWhitelistBtn");
const massRemoveFeaturedBtn = document.getElementById("massRemoveFeaturedBtn");
const copyToFeaturedBtn = document.getElementById("copyToFeaturedBtn");

const selectAllUsers = document.getElementById("selectAllUsers");
const selectAllWhitelist = document.getElementById("selectAllWhitelist");
const selectAllFeatured = document.getElementById("selectAllFeatured");

const loaderOverlay = document.getElementById("loaderOverlay");
const loaderText = document.getElementById("loaderText");

// Add a dynamic "Move Selected → Whitelist" button into the panel header if not present
let moveToWhitelistBtn = document.getElementById("moveToWhitelistBtn");
if (!moveToWhitelistBtn && adminPanel) {
  moveToWhitelistBtn = document.createElement("button");
  moveToWhitelistBtn.id = "moveToWhitelistBtn";
  moveToWhitelistBtn.className = "btn btn-primary";
  moveToWhitelistBtn.textContent = "Move Selected → Whitelist";
  // try to insert near the other top buttons: put after exportCurrentCsv if available
  const exportBtn = document.getElementById("exportCurrentCsv");
  if (exportBtn && exportBtn.parentNode) exportBtn.parentNode.insertBefore(moveToWhitelistBtn, exportBtn.nextSibling);
  else adminPanel.querySelector("h2")?.appendChild(moveToWhitelistBtn);
}

// ---------- Utilities ----------
function showLoader(text = "Processing...") {
  if (loaderText) loaderText.textContent = text;
  if (loaderOverlay) loaderOverlay.style.display = "flex";
}
function hideLoader() { if (loaderOverlay) loaderOverlay.style.display = "none"; }

function sanitizeCSVCell(s){ return String(s==null ? "" : s).replaceAll('"','').trim(); }

function mkCSVName(prefix){
  const ts = (new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-');
  return `${prefix}_${ts}.csv`;
}
function downloadCSV(filename, rows){
  const csv = rows.map(r => r.map(v => `"${String(v ?? "")}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
function createToggleCheckbox(value){
  const i = document.createElement("input");
  i.type = "checkbox";
  i.checked = !!value;
  i.style.transform = "scale(1.12)";
  return i;
}
function showConfirmModal(title, message){
  return new Promise(resolve=>{
    const overlay = document.createElement("div");
    Object.assign(overlay.style,{position:"fixed",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.5)",zIndex:4000});
    const card = document.createElement("div");
    Object.assign(card.style,{background:"#111",padding:"18px",borderRadius:"10px",color:"#fff",minWidth:"320px",textAlign:"center",fontFamily:"'乂丨乂丨', monospace"});
    const h = document.createElement("h3"); h.textContent = title; h.style.margin="0 0 8px";
    const p = document.createElement("p"); p.textContent = message; p.style.margin="0 0 12px"; p.style.color="#ddd";
    const rdiv = document.createElement("div"); rdiv.style.display="flex"; rdiv.style.justifyContent="center"; rdiv.style.gap="10px";
    const yes = document.createElement("button"); yes.className="btn btn-primary"; yes.textContent="Confirm";
    const no  = document.createElement("button"); no.className="btn btn-danger"; no.textContent="Cancel";
    yes.onclick = ()=>{ overlay.remove(); resolve(true); };
    no.onclick  = ()=>{ overlay.remove(); resolve(false); };
    rdiv.appendChild(yes); rdiv.appendChild(no);
    card.appendChild(h); card.appendChild(p); card.appendChild(rdiv);
    overlay.appendChild(card); document.body.appendChild(overlay);
  });
}

// ---------- Helpers ----------
function getCheckedRowIdsFrom(tbody){
  if(!tbody) return [];
  return Array.from(tbody.querySelectorAll("tr"))
    .filter(r => r.querySelector("input.row-select")?.checked)
    .map(r => r.dataset.id);
}
function rowsSelectedCount(tbody){ return getCheckedRowIdsFrom(tbody).length; }

// ---------- Admin login ----------
let currentAdmin = null;
async function checkAdmin(emailRaw){
  const email = String(emailRaw||"").trim().toLowerCase();
  if(!email) return null;
  const q = query(collection(db,"users"), where("email","==",email));
  const snap = await getDocs(q);
  if(snap.empty) return null;
  const d = snap.docs[0].data()||{};
  return d.isAdmin === true ? { email, id: snap.docs[0].id } : null;
}
if (adminCheckBtn) {
  adminCheckBtn.addEventListener("click", async ()=>{
    if (!adminEmailInput) return;
    adminGateMsg.textContent="";
    const val = adminEmailInput.value.trim();
    if(!val){ adminGateMsg.textContent="Enter admin email"; return; }
    showLoader("Checking admin...");
    const a = await checkAdmin(val);
    hideLoader();
    if(!a){ adminGateMsg.textContent="Not authorized"; return; }
    currentAdmin = a;
    if (currentAdminEmailEl) currentAdminEmailEl.textContent = a.email;
    if (adminGate) adminGate.classList.add("hidden");
    if (adminPanel) adminPanel.classList.remove("hidden");
    await loadUsers(); await loadWhitelist(); await loadFeatured();
  });
}
if (adminEmailInput) adminEmailInput.addEventListener("keydown", e => { if (e.key === "Enter" && adminCheckBtn) adminCheckBtn.click(); });
if (logoutBtn) logoutBtn.addEventListener("click", ()=>{
  currentAdmin = null;
  if (adminPanel) adminPanel.classList.add("hidden");
  if (adminGate) adminGate.classList.remove("hidden");
  if (adminEmailInput) adminEmailInput.value = "";
});

// ---------- Data caches ----------
let usersCache = [];

// ---------- Load / Render Users ----------
async function loadUsers(){
  if (!usersTableBody) return;
  try{
    usersTableBody.innerHTML = "";
    const snap = await getDocs(collection(db,"users"));
    usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderUsers(usersCache);
  }catch(e){
    console.error(e);
    usersTableBody.innerHTML = `<tr><td colspan="14" class="muted">Failed to load users.</td></tr>`;
  }
}

function renderUsers(users){
  if (!usersTableBody) return;
  usersTableBody.innerHTML = "";
  users.forEach(u=>{
    const tr = document.createElement("tr");
    tr.dataset.id = u.id;
    tr.style.fontFamily="'乂丨乂丨', monospace";

    // build a row with editable fields for stars,cash,popupPhoto,videoUrl and checkboxes for flags
    tr.innerHTML = `
      <td><input type="checkbox" class="row-select"/></td>
      <td class="email-cell">${sanitizeCSVCell(u.email||"")}</td>
      <td><input type="text" class="phone-input" value="${sanitizeCSVCell(u.phone||"")}" style="width:120px"/></td>
      <td>${sanitizeCSVCell(u.chatId||"")}</td>
      <td><input type="number" min="0" class="stars-input" value="${Number(u.stars||0)}" style="width:100px"/></td>
      <td><input type="number" min="0" class="cash-input" value="${Number(u.cash||0)}" style="width:100px"/></td>
      <td class="vip-cell"></td>
      <td class="admin-cell"></td>
      <td class="host-cell"></td>
      <td class="sub-cell"></td>
      <td class="feat-cell"><input type="checkbox" class="featured-checkbox" ${u.featuredHosts ? "checked" : ""}></td>
      <td><input type="text" class="popup-photo" value="${sanitizeCSVCell(u.popupPhoto||"")}" style="width:140px"/></td>
      <td><input type="text" class="video-url" value="${sanitizeCSVCell(u.videoUrl||"")}" style="width:160px"/></td>
      <td class="actions-cell"></td>
    `;

    // flags as toggle checkboxes
    const vipToggle = createToggleCheckbox(u.isVIP);
    const adminToggle = createToggleCheckbox(u.isAdmin);
    const hostToggle = createToggleCheckbox(u.isHost);
    const subToggle = createToggleCheckbox(u.subscriptionActive);

    tr.querySelector(".vip-cell").appendChild(vipToggle);
    tr.querySelector(".admin-cell").appendChild(adminToggle);
    tr.querySelector(".host-cell").appendChild(hostToggle);
    tr.querySelector(".sub-cell").appendChild(subToggle);

    // Actions: Save, ToWL, Delete, CopyToFeatured (per-row)
    const actionsTd = tr.querySelector(".actions-cell");
    const saveBtn = document.createElement("button"); saveBtn.className = "btn btn-primary small"; saveBtn.textContent = "Save";
    const toWLBtn = document.createElement("button"); toWLBtn.className = "btn small"; toWLBtn.textContent = "To WL";
    const copyFeatBtn = document.createElement("button"); copyFeatBtn.className = "btn small"; copyFeatBtn.textContent = "To Featured";
    const delBtn  = document.createElement("button"); delBtn.className = "btn btn-danger small"; delBtn.textContent = "Del";

    actionsTd.append(saveBtn, toWLBtn, copyFeatBtn, delBtn);

    // Save handler - collect the editable inputs and toggles, update user doc (merge)
    saveBtn.addEventListener("click", async ()=>{
      const confirmed = await showConfirmModal("Save user", `Save changes for ${u.email || "(no email)"}?`);
      if(!confirmed) return;
      showLoader("Saving user...");
      try{
        const updates = {
          phone: tr.querySelector(".phone-input").value.trim(),
          stars: Number(tr.querySelector(".stars-input").value || 0),
          cash: Number(tr.querySelector(".cash-input").value || 0),
          isVIP: vipToggle.checked,
          isAdmin: adminToggle.checked,
          isHost: hostToggle.checked,
          subscriptionActive: subToggle.checked,
          featuredHosts: tr.querySelector(".featured-checkbox").checked,
          popupPhoto: tr.querySelector(".popup-photo").value.trim(),
          videoUrl: tr.querySelector(".video-url").value.trim(),
          lastUpdated: Date.now()
        };

        // update user doc
        await updateDoc(doc(db,"users", u.id), updates);

        // sync whitelist: if subscriptionActive => ensure whitelist entry exists; else remove it
        const emailKey = (u.email || "").toLowerCase();
        if (updates.subscriptionActive && emailKey) {
          await setDoc(doc(db,"whitelist", emailKey), {
            email: emailKey,
            phone: updates.phone || "",
            subscriptionActive: true,
            subscriptionStartTime: Date.now()
          }, { merge: true });
        } else if (emailKey) {
          await deleteDoc(doc(db,"whitelist", emailKey)).catch(()=>{});
        }

        // sync featuredHosts entry if featuredHosts checked (copy full user dynamically)
        if (updates.featuredHosts) {
          // get latest user from cache (or merge)
          const userObj = usersCache.find(x=>x.id === u.id) || {};
          // merge with live updates we just applied
          const merged = { ...userObj, ...updates, addedAt: Date.now() };
          // remove id field if present (we'll use doc id)
          delete merged.id;
          await setDoc(doc(db,"featuredHosts", u.id), merged, { merge: true });
        } else {
          await deleteDoc(doc(db,"featuredHosts", u.id)).catch(()=>{});
        }

        hideLoader();
        await loadUsers(); await loadWhitelist(); await loadFeatured();
        alert("Saved.");
      }catch(err){
        hideLoader();
        console.error(err);
        alert("Save failed. See console.");
      }
    });

    // per-row "To WL" (single)
    toWLBtn.addEventListener("click", async ()=>{
      const emailKey = (u.email||"").toLowerCase();
      if(!emailKey) return alert("User has no email.");
      const phone = tr.querySelector(".phone-input").value.trim() || (u.phone || "");
      const confirmed = await showConfirmModal("Add to whitelist", `Add ${emailKey} to whitelist?`);
      if(!confirmed) return;
      showLoader("Adding to whitelist...");
      try{
        await setDoc(doc(db,"whitelist", emailKey), {
          email: emailKey,
          phone,
          subscriptionActive: true,
          subscriptionStartTime: Date.now()
        }, { merge: true });

        // ensure user doc updated
        await updateDoc(doc(db,"users", u.id), { subscriptionActive: true, phone }).catch(()=>{});
        hideLoader(); await loadWhitelist(); await loadUsers();
        alert("Added to whitelist.");
      }catch(err){ hideLoader(); console.error(err); alert("Failed to add to whitelist."); }
    });

    // per-row copy to featured (single)
    copyFeatBtn.addEventListener("click", async ()=>{
      const confirmed = await showConfirmModal("Copy to featured", `Copy ${u.email||u.id} to featured hosts (all fields)?`);
      if(!confirmed) return;
      showLoader("Copying to featured...");
      try{
        // grab latest user object from usersCache
        const userObj = usersCache.find(x=>x.id === u.id) || {};
        const toWrite = { ...userObj, addedAt: Date.now() };
        // remove id if present
        delete toWrite.id;
        await setDoc(doc(db,"featuredHosts", u.id), toWrite, { merge: true });
        await updateDoc(doc(db,"users", u.id), { featuredHosts: true }).catch(()=>{});
        hideLoader(); await loadFeatured(); await loadUsers();
        alert("Copied to featured.");
      }catch(err){ hideLoader(); console.error(err); alert("Failed to copy to featured."); }
    });

    // Delete handler
    delBtn.addEventListener("click", async ()=>{
      const confirmed = await showConfirmModal("Delete user", `Delete ${u.email || "(no email)"}?`);
      if(!confirmed) return;
      showLoader("Deleting...");
      try{
        await deleteDoc(doc(db,"users",u.id));
        await deleteDoc(doc(db,"featuredHosts",u.id)).catch(()=>{});
        await deleteDoc(doc(db,"whitelist",(u.email||"").toLowerCase())).catch(()=>{});
        hideLoader();
        await loadUsers(); await loadWhitelist(); await loadFeatured();
        alert("Deleted.");
      }catch(err){
        hideLoader();
        console.error(err);
        alert("Delete failed.");
      }
    });

    usersTableBody.appendChild(tr);
  });
}

// search wiring
if (userSearch) {
  let searchTimeout = null;
  userSearch.addEventListener("input", ()=>{
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(()=>{
      const q = (userSearch.value||"").toLowerCase();
      renderUsers(usersCache.filter(u => (u.email||"").toLowerCase().includes(q) || (u.chatId||"").toLowerCase().includes(q)));
    }, 200);
  });
}

// ---------- Load / Render Whitelist ----------
async function loadWhitelist(){
  if (!whitelistTableBody) return;
  try{
    whitelistTableBody.innerHTML = "";
    const snap = await getDocs(collection(db,"whitelist"));
    snap.forEach(d => {
      const w = d.data() || {};
      const tr = document.createElement("tr");
      tr.dataset.id = d.id;
      tr.innerHTML = `
        <td><input type="checkbox" class="row-select"/></td>
        <td>${sanitizeCSVCell(w.email||"")}</td>
        <td><input type="text" class="wl-phone" value="${sanitizeCSVCell(w.phone||"")}" style="width:120px"/></td>
        <td>${w.subscriptionActive ? "Active" : "Inactive"}</td>
        <td></td>
      `;
      const removeBtn = document.createElement("button");
      removeBtn.className="btn btn-danger small"; removeBtn.textContent="Remove";
      removeBtn.addEventListener("click", async ()=>{
        const confirmed = await showConfirmModal("Remove whitelist", `Remove ${w.email}?`);
        if(!confirmed) return;
        showLoader("Removing...");
        try{
          await deleteDoc(doc(db,"whitelist",d.id));
          hideLoader(); await loadWhitelist();
        }catch(err){ hideLoader(); console.error(err); alert("Failed to remove."); }
      });
      const toUserBtn = document.createElement("button");
      toUserBtn.className = "btn small";
      toUserBtn.textContent = "Ensure user";
      toUserBtn.addEventListener("click", async ()=>{
        // create/update users entry for this email
        const confirmed2 = await showConfirmModal("Ensure user", `Create/Update user for ${w.email}?`);
        if(!confirmed2) return;
        showLoader("Syncing to users...");
        try{
          const emailKey = (w.email||"").toLowerCase();
          // write a basic user doc if missing (merge)
          await setDoc(doc(db,"users", emailKey), { email: emailKey, phone: w.phone||"", subscriptionActive: !!w.subscriptionActive, subscriptionStartTime: Date.now() }, { merge: true });
          hideLoader(); await loadUsers(); await loadWhitelist();
          alert("User created/updated.");
        }catch(err){ hideLoader(); console.error(err); alert("Failed."); }
      });

      tr.children[4].append(removeBtn, toUserBtn);
      whitelistTableBody.appendChild(tr);
    });
  }catch(err){
    console.error(err);
    whitelistTableBody.innerHTML = `<tr><td colspan="5" class="muted">Failed to load whitelist.</td></tr>`;
  }
}

// ---------- Load / Render Featured ----------
async function loadFeatured(){
  if (!featuredTableBody) return;
  try{
    featuredTableBody.innerHTML = "";
    const snap = await getDocs(collection(db,"featuredHosts"));
    snap.forEach(d => {
      const f = d.data() || {};
      const tr = document.createElement("tr");
      tr.dataset.id = d.id;
      tr.innerHTML = `
        <td><input type="checkbox" class="row-select"/></td>
        <td>${sanitizeCSVCell(f.email||"")}</td>
        <td>${sanitizeCSVCell(f.phone||"")}</td>
        <td><input type="text" class="popup-photo" value="${sanitizeCSVCell(f.popupPhoto||"")}" style="width:160px"/></td>
        <td><input type="text" class="video-url" value="${sanitizeCSVCell(f.videoUrl||"")}" style="width:160px"/></td>
        <td>${f.addedAt ? new Date(f.addedAt).toLocaleString() : ""}</td>
        <td></td>
      `;
      // actions
      const saveBtn = document.createElement("button"); saveBtn.className="btn btn-primary small"; saveBtn.textContent="Save";
      const removeBtn = document.createElement("button"); removeBtn.className="btn btn-danger small"; removeBtn.textContent="Remove";
      saveBtn.addEventListener("click", async ()=>{
        const confirmed = await showConfirmModal("Save Featured", `Update featured host ${f.email||""}?`);
        if(!confirmed) return;
        showLoader("Saving...");
        try{
          const popupPhoto = tr.querySelector(".popup-photo").value.trim();
          const videoUrl  = tr.querySelector(".video-url").value.trim();
          await updateDoc(doc(db,"featuredHosts",d.id), { popupPhoto, videoUrl });
          // try to sync to users as well
          await updateDoc(doc(db,"users",d.id), { popupPhoto, videoUrl }).catch(()=>{});
          hideLoader(); await loadFeatured(); await loadUsers();
          alert("Featured updated.");
        }catch(err){ hideLoader(); console.error(err); alert("Save failed."); }
      });
      removeBtn.addEventListener("click", async ()=>{
        const confirmed = await showConfirmModal("Remove Featured", `Remove ${f.email||""} from featured hosts?`);
        if(!confirmed) return;
        showLoader("Removing...");
        try{
          await deleteDoc(doc(db,"featuredHosts",d.id));
          await updateDoc(doc(db,"users",d.id), { featuredHosts: false }).catch(()=>{});
          hideLoader(); await loadFeatured(); await loadUsers();
        }catch(err){ hideLoader(); console.error(err); alert("Remove failed."); }
      });
      tr.children[6].append(saveBtn, removeBtn);
      featuredTableBody.appendChild(tr);
    });
  }catch(err){
    console.error(err);
    featuredTableBody.innerHTML = `<tr><td colspan="7" class="muted">Failed to load featured hosts.</td></tr>`;
  }
}

// ---------- select-all wiring ----------
if (selectAllUsers) selectAllUsers.addEventListener("click", ()=> {
  const state = selectAllUsers.getAttribute("data-checked") !== "1";
  selectAllUsers.setAttribute("data-checked", state ? "1" : "0");
  usersTableBody?.querySelectorAll("input.row-select").forEach(cb=>cb.checked = state);
});
if (selectAllWhitelist) selectAllWhitelist.addEventListener("click", ()=> {
  const state = selectAllWhitelist.getAttribute("data-checked") !== "1";
  selectAllWhitelist.setAttribute("data-checked", state ? "1" : "0");
  whitelistTableBody?.querySelectorAll("input.row-select").forEach(cb=>cb.checked = state);
});
if (selectAllFeatured) selectAllFeatured.addEventListener("click", ()=> {
  const state = selectAllFeatured.getAttribute("data-checked") !== "1";
  selectAllFeatured.setAttribute("data-checked", state ? "1" : "0");
  featuredTableBody?.querySelectorAll("input.row-select").forEach(cb=>cb.checked = state);
});

// ---------- Mass Remove Users ----------
if (massRemoveUsersBtn) massRemoveUsersBtn.addEventListener("click", async ()=>{
  const ids = getCheckedRowIdsFrom(usersTableBody);
  if(!ids.length) return alert("No users selected.");
  const confirmed = await showConfirmModal("Remove Users",`Delete ${ids.length} user(s)?`);
  if(!confirmed) return;
  showLoader("Removing users...");
  try{
    for(const id of ids){
      const user = usersCache.find(u=>u.id===id);
      await deleteDoc(doc(db,"users",id)).catch(()=>{});
      if(user?.email) await deleteDoc(doc(db,"whitelist",user.email.toLowerCase())).catch(()=>{});
      await deleteDoc(doc(db,"featuredHosts",id)).catch(()=>{});
    }
    hideLoader(); await loadUsers(); await loadWhitelist(); await loadFeatured();
    alert(`${ids.length} user(s) removed.`);
  }catch(err){ hideLoader(); console.error(err); alert("Failed to remove selected users."); }
});

// ---------- Move Selected Users to Whitelist (UID-based) ----------
if (moveToWhitelistBtn) moveToWhitelistBtn.addEventListener("click", async ()=>{
  const ids = getCheckedRowIdsFrom(usersTableBody);
  if(!ids.length) return alert("No users selected.");
  
  const confirmed = await showConfirmModal("Move to Whitelist", `Move ${ids.length} user(s) to whitelist?`);
  if(!confirmed) return;

  showLoader("Moving to whitelist...");
  try{
    for(const uid of ids){
      const user = usersCache.find(u => u.id === uid);
      if(!user) continue;
      const email = (user.email || "").toLowerCase();
      if(!email) continue;

      // ✅ Set whitelist entry using UID as doc ID
      await setDoc(doc(db, "whitelist", uid), {
        uid,
        email,
        sanitizedEmail: email.replaceAll('.',','), // optional: for email queries
        phone: user.phone || "",
        subscriptionActive: true,
        subscriptionStartTime: Date.now()
      }, { merge: true });

      // update user doc to mark subscription active
      await updateDoc(doc(db, "users", uid), { subscriptionActive: true }).catch(()=>{});
    }
    hideLoader();
    await loadWhitelist(); 
    await loadUsers();
    alert(`${ids.length} user(s) moved to whitelist.`);
  } catch(err){
    hideLoader();
    console.error(err);
    alert("Failed to move users to whitelist.");
  }
});

// ---------- Per-row "To WL" button (UID-based) ----------
usersTableBody.querySelectorAll("tr").forEach(tr=>{
  const toWLBtn = tr.querySelector(".actions-cell button:nth-child(2)"); // adjust if necessary
  if(!toWLBtn) return;
  toWLBtn.addEventListener("click", async ()=>{
    const uid = tr.dataset.id;
    const user = usersCache.find(u => u.id === uid);
    if(!user) return alert("User not found.");
    const email = (user.email || "").toLowerCase();
    if(!email) return alert("User has no email.");
    const phone = tr.querySelector(".phone-input")?.value?.trim() || user.phone || "";

    const confirmed = await showConfirmModal("Add to whitelist", `Add ${email} to whitelist?`);
    if(!confirmed) return;

    showLoader("Adding to whitelist...");
    try {
      await setDoc(doc(db, "whitelist", uid), {
        uid,
        email,
        sanitizedEmail: email.replaceAll('.',','), // optional
        phone,
        subscriptionActive: true,
        subscriptionStartTime: Date.now()
      }, { merge: true });

      await updateDoc(doc(db,"users", uid), { subscriptionActive: true, phone }).catch(()=>{});
      hideLoader(); await loadWhitelist(); await loadUsers();
      alert("Added to whitelist.");
    } catch(err){
      hideLoader();
      console.error(err);
      alert("Failed to add to whitelist.");
    }
  });
});

// ---------- Mass Remove Whitelist ----------
if (massRemoveWhitelistBtn) massRemoveWhitelistBtn.addEventListener("click", async ()=>{
  const ids = getCheckedRowIdsFrom(whitelistTableBody);
  if(!ids.length) return alert("No whitelist selected.");
  const confirmed = await showConfirmModal("Remove whitelist",`Delete ${ids.length} whitelist entry(s)?`);
  if(!confirmed) return;
  showLoader("Removing whitelist...");
  try{
    for(const id of ids){
      await deleteDoc(doc(db,"whitelist",id)).catch(()=>{});
    }
    hideLoader(); await loadWhitelist();
    alert(`${ids.length} removed.`);
  }catch(err){ hideLoader(); console.error(err); alert("Failed to remove selected whitelist entries."); }
});

// ---------- Mass Remove Featured ----------
if (massRemoveFeaturedBtn) massRemoveFeaturedBtn.addEventListener("click", async ()=>{
  const ids = getCheckedRowIdsFrom(featuredTableBody);
  if(!ids.length) return alert("No featured hosts selected.");
  const confirmed = await showConfirmModal("Remove Featured",`Delete ${ids.length} featured host(s)?`);
  if(!confirmed) return;
  showLoader("Removing featured...");
  try{
    for(const id of ids){
      await deleteDoc(doc(db,"featuredHosts",id)).catch(()=>{});
      await updateDoc(doc(db,"users",id), { featuredHosts: false }).catch(()=>{});
    }
    hideLoader(); await loadFeatured(); await loadUsers();
    alert(`${ids.length} removed.`);
  }catch(err){ hideLoader(); console.error(err); alert("Failed to remove featured entries."); }
});

// ---------- Copy selected users to featuredHosts (mass) - FUTURE-PROOF -->
if (copyToFeaturedBtn) copyToFeaturedBtn.addEventListener("click", async ()=>{
  const ids = getCheckedRowIdsFrom(usersTableBody);
  if(!ids.length) return alert("No users selected.");
  const confirmed = await showConfirmModal("Copy to Featured", `Copy ${ids.length} user(s) to featured hosts (all fields)?`);
  if(!confirmed) return;
  showLoader("Copying to featured...");
  try{
    for(const id of ids){
      const user = usersCache.find(u=>u.id===id);
      if(!user) continue;
      const toWrite = { ...user, addedAt: Date.now() };
      delete toWrite.id;
      await setDoc(doc(db,"featuredHosts", id), toWrite, { merge: true });
      await updateDoc(doc(db,"users", id), { featuredHosts: true }).catch(()=>{});
    }
    hideLoader(); await loadFeatured(); await loadUsers();
    alert(`${ids.length} copied to featured hosts.`);
  }catch(err){ hideLoader(); console.error(err); alert("Failed to copy to featured hosts."); }
});

// ---------- Whitelist add / CSV import ----------
if (addWhitelistBtn) addWhitelistBtn.addEventListener("click", async ()=>{
  const emailRaw = (wlEmailInput?.value||"").trim();
  const phone = (wlPhoneInput?.value||"").trim();
  if(!emailRaw || !phone) return alert("Enter email & phone.");
  const email = emailRaw.toLowerCase();
  const confirmed = await showConfirmModal("Add whitelist", `Add ${email} to whitelist?`);
  if(!confirmed) return;
  showLoader("Adding...");
  try{
    await setDoc(doc(db,"whitelist", email), {
      email, phone, subscriptionActive: true, subscriptionStartTime: Date.now()
    }, { merge: true });
    // create/update user entry (merge)
    const q = query(collection(db,"users"), where("email", "==", email));
    const snap = await getDocs(q);
    if(snap.empty){
      await setDoc(doc(db,"users", email), { email, phone, subscriptionActive:true, subscriptionStartTime: Date.now(), subscriptionCount: 1 }, { merge: true }).catch(()=>{});
    } else {
      const uref = snap.docs[0].ref;
      const data = snap.docs[0].data()||{};
      await updateDoc(uref, { subscriptionActive:true, subscriptionStartTime: Date.now(), subscriptionCount: (data.subscriptionCount||0)+1 }).catch(()=>{});
    }
    hideLoader(); await loadWhitelist(); await loadUsers();
    alert("Added to whitelist.");
  }catch(err){ hideLoader(); console.error(err); alert("Add failed."); }
});

if (wlCsvUpload) wlCsvUpload.addEventListener("change", async (e)=>{
  const file = e.target.files?.[0]; if(!file) return;
  const confirmed = await showConfirmModal("CSV Batch", "Inject CSV to whitelist?");
  if(!confirmed){ wlCsvUpload.value=""; return; }
  showLoader("Processing CSV...");
  try{
    const text = await file.text();
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const processedEmails = [];
    for(const line of lines){
      const parts = line.split(",").map(p => p.replace(/^"(.*)"$/,"$1").trim());
      const emailRaw = parts[0]||"";
      const phone = parts[1]||"";
      if(!emailRaw || !phone) continue;
      const email = emailRaw.toLowerCase();
      processedEmails.push(email);
      await setDoc(doc(db,"whitelist",email), { email, phone, subscriptionActive:true, subscriptionStartTime: Date.now() }, { merge: true });
      const q = query(collection(db,"users"), where("email","==",email));
      const snap = await getDocs(q);
      if(snap.empty){
        await setDoc(doc(db,"users", email), { email, phone, subscriptionActive:true, subscriptionStartTime: Date.now(), subscriptionCount:1 }, { merge: true }).catch(()=>{});
      } else {
        const uref = snap.docs[0].ref;
        const data = snap.docs[0].data()||{};
        await updateDoc(uref, { phone, subscriptionActive:true, subscriptionStartTime: Date.now(), subscriptionCount: (data.subscriptionCount||0)+1 }).catch(()=>{});
      }
    }

    if (cleanUpLadyToggle?.checked){
      const wsnap = await getDocs(collection(db,"whitelist"));
      for(const docSnap of wsnap.docs){
        const key = (docSnap.id||"").toLowerCase();
        if(!processedEmails.includes(key)){
          await deleteDoc(doc(db,"whitelist", key)).catch(()=>{});
          await updateDoc(doc(db,"users", key), { subscriptionActive: false }).catch(()=>{});
        }
      }
    }

    hideLoader(); await loadWhitelist(); await loadUsers();
    alert("CSV processed.");
  }catch(err){ hideLoader(); console.error(err); alert("CSV failed."); }
  finally{ if (wlCsvUpload) wlCsvUpload.value=""; }
});

// ---------- Exports ----------
if (exportCurrentCsv) exportCurrentCsv.addEventListener("click", async ()=>{
  // we no longer have tabs; export users by default
  const rows = [["id","email","phone","chatId","stars","cash","isVIP","isAdmin","isHost","subscriptionActive","featuredHosts","popupPhoto","videoUrl"]];
  usersCache.forEach(u => rows.push([u.id||"", u.email||"", u.phone||"", u.chatId||"", u.stars||0, u.cash||0, !!u.isVIP, !!u.isAdmin, !!u.isHost, !!u.subscriptionActive, !!u.featuredHosts, u.popupPhoto||"", u.videoUrl||""]));
  downloadCSV(mkCSVName("users"), rows);
});

if (exportFeaturedCsv) exportFeaturedCsv.addEventListener("click", async ()=>{
  const rows = [["id","email","phone","popupPhoto","videoUrl","addedAt"]];
  const snap = await getDocs(collection(db,"featuredHosts"));
  snap.forEach(d => { const f = d.data()||{}; rows.push([d.id, f.email||"", f.phone||"", f.popupPhoto||"", f.videoUrl||"", f.addedAt || ""]); });
  downloadCSV(mkCSVName("featuredHosts"), rows);
});

// ---------- initial loads ----------
(async function initialLoads(){
  await loadUsers().catch(()=>{});
  await loadWhitelist().catch(()=>{});
  await loadFeatured().catch(()=>{});
})();
