// admin-payfeed.js (FULL FIXED & OPTIMIZED)

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
  if (loaderText) loaderText.textContent = text;
  if (loaderOverlay) loaderOverlay.style.display = "flex";
}
function hideLoader() { if (loaderOverlay) loaderOverlay.style.display = "none"; }
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
    const overlay = document.createElement("div");
    Object.assign(overlay.style, { position: "fixed", inset: "0", background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 });
    const card = document.createElement("div");
    Object.assign(card.style, { background: "#fff", padding: "18px", borderRadius: "10px", minWidth: "300px", maxWidth: "90%", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.12)" });
    const h = document.createElement("h3"); h.textContent = title; h.style.margin = "0 0 8px";
    const p = document.createElement("p"); p.textContent = message; p.style.margin = "0 0 14px"; p.style.color="#333";
    const btnRow = document.createElement("div"); Object.assign(btnRow.style,{display:"flex",justifyContent:"center",gap:"10px"});
    const confirmBtn = document.createElement("button"); confirmBtn.className="btn btn-primary"; confirmBtn.textContent="Confirm";
    const cancelBtn = document.createElement("button"); cancelBtn.className="btn btn-danger"; cancelBtn.textContent="Cancel";
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
  const email = String(emailRaw||"").trim().toLowerCase();
  if(!email) return null;
  try {
    const snap = await getDocs(query(collection(db,"users"),where("email","==",email)));
    if(snap.empty) return null;
    const d = snap.docs[0].data()||{};
    return d.isAdmin===true ? { email, id:snap.docs[0].id } : null;
  } catch(e) { console.error("checkAdmin error:", e); return null; }
}
adminCheckBtn.addEventListener("click", async () => {
  adminGateMsg.textContent="";
  const emailRaw = (adminEmailInput.value||"").trim();
  if(!emailRaw){ adminGateMsg.textContent="Enter admin email"; return; }
  showLoader("Checking admin...");
  const admin = await checkAdmin(emailRaw);
  hideLoader();
  if(!admin){ adminGateMsg.textContent="Not authorized"; return; }
  currentAdmin=admin;
  currentAdminEmailEl.textContent=admin.email;
  adminGate.classList.add("hidden"); adminPanel.classList.remove("hidden");
  await loadUsers(); await loadWhitelist();
});
adminEmailInput.addEventListener("keydown", e => { if(e.key==="Enter") adminCheckBtn.click(); });
logoutBtn.addEventListener("click", () => { currentAdmin=null; adminPanel.classList.add("hidden"); adminGate.classList.remove("hidden"); adminEmailInput.value=""; });

// ---------- Users rendering ----------
let usersCache = [];
async function loadUsers() {
  try {
    usersTableBody.innerHTML="";
    const snap = await getDocs(collection(db,"users"));
    usersCache = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderUsers(usersCache);
  } catch(e){ console.error(e); usersTableBody.innerHTML=`<tr><td colspan="10" class="muted">Failed to load users.</td></tr>`; }
}
function renderUsers(users){
  usersTableBody.innerHTML="";
  users.forEach(u=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.email||""}</td><td>${u.phone||""}</td><td>${u.chatId||""}</td>
      <td><input type="number" min="0" value="${u.stars||0}" style="width:60px"/></td>
      <td><input type="number" min="0" value="${u.cash||0}" style="width:60px"/></td>
      <td></td><td></td><td></td><td></td><td></td>
    `;
    const isVIP = createToggleCheckbox(u.isVIP);
    const isAdminToggle = createToggleCheckbox(u.isAdmin);
    const isHost = createToggleCheckbox(u.isHost);
    const subscriptionActive = createToggleCheckbox(u.subscriptionActive);
    tr.children[5].appendChild(isVIP); tr.children[6].appendChild(isAdminToggle);
    tr.children[7].appendChild(isHost); tr.children[8].appendChild(subscriptionActive);

    const actionsTd = tr.children[9];
    const actionsDiv = document.createElement("div"); actionsDiv.className="actions";
    const enterBtn = document.createElement("button"); enterBtn.className="btn btn-primary"; enterBtn.textContent="Enter";
    const removeBtn = document.createElement("button"); removeBtn.className="btn btn-danger"; removeBtn.textContent="Remove";
    actionsDiv.appendChild(enterBtn); actionsDiv.appendChild(removeBtn); actionsTd.appendChild(actionsDiv);

    // Enter
    enterBtn.addEventListener("click", async ()=>{
      const confirmed = await showConfirmModal("Update user", `Apply changes for ${u.email||"(no email)"}?`);
      if(!confirmed) return;
      showLoader("Updating user...");
      try {
        const stars = Number(tr.children[3].querySelector("input").value||0);
        const cash = Number(tr.children[4].querySelector("input").value||0);
        const updates = {stars,cash,isVIP:isVIP.checked,isAdmin:isAdminToggle.checked,isHost:isHost.checked,subscriptionActive:subscriptionActive.checked};
        if(updates.subscriptionActive){ updates.subscriptionStartTime = Date.now(); updates.subscriptionCount = (u.subscriptionCount||0)+1; }
        const emailKey = (u.email||"").toLowerCase();
        await setDoc(doc(db,"users",emailKey),{...u,...updates},{merge:true});
        if(updates.subscriptionActive){
          await setDoc(doc(db,"whitelist",emailKey),{email:emailKey,phone:u.phone||"",chatId:u.chatId||"",subscriptionActive:true,subscriptionStartTime:updates.subscriptionStartTime},{merge:true});
        } else { await updateDoc(doc(db,"whitelist",emailKey),{subscriptionActive:false}).catch(()=>{}); }
        hideLoader(); await loadUsers(); await loadWhitelist(); alert("User updated successfully.");
      } catch(err){ hideLoader(); console.error(err); alert("Failed to update user."); }
    });

    // Remove
    removeBtn.addEventListener("click", async ()=>{
      const confirmed = await showConfirmModal("Remove user", `Delete ${u.email||"(no email)"} from database?`);
      if(!confirmed) return;
      showLoader("Removing user...");
      try {
        const emailKey = (u.email||"").toLowerCase();
        await deleteDoc(doc(db,"users",emailKey)).catch(()=>{});
        await deleteDoc(doc(db,"whitelist",emailKey)).catch(()=>{});
        hideLoader(); await loadUsers(); await loadWhitelist(); alert(`${u.email||"(no email)"} removed successfully.`);
      } catch(err){ hideLoader(); console.error(err); alert("Failed to remove user."); }
    });

    usersTableBody.appendChild(tr);
  });
}

// ---------- Search ----------
userSearch.addEventListener("input", ()=>{
  const q=(userSearch.value||"").toLowerCase();
  renderUsers(usersCache.filter(u=>(u.email||"").toLowerCase().includes(q)||(u.chatId||"").toLowerCase().includes(q)));
});

// ---------- Whitelist rendering ----------
async function loadWhitelist(){
  try{
    whitelistTableBody.innerHTML="";
    const snap = await getDocs(collection(db,"whitelist"));
    snap.docs.forEach(w=>{
      const d=w.data()||{};
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${d.email||""}</td><td>${d.phone||""}</td><td>${d.subscriptionActive?"Active":"Inactive"}</td><td></td>`;
      const actionTd = tr.children[3];
      const removeBtn = document.createElement("button"); removeBtn.className="btn btn-danger small"; removeBtn.textContent="Remove";
      removeBtn.addEventListener("click", async ()=>{
        const confirmed = await showConfirmModal("Remove from whitelist", `Delete ${d.email||"(no email)"}?`);
        if(!confirmed) return;
        showLoader("Removing...");
        try { await deleteDoc(doc(db,"whitelist",d.email.toLowerCase())).catch(()=>{}); await updateDoc(doc(db,"users",d.email.toLowerCase()),{subscriptionActive:false}).catch(()=>{}); hideLoader(); await loadWhitelist(); await loadUsers(); } catch(e){ hideLoader(); console.error(e); alert("Failed."); }
      });
      actionTd.appendChild(removeBtn); whitelistTableBody.appendChild(tr);
    });
  } catch(e){ console.error(e); whitelistTableBody.innerHTML=`<tr><td colspan="4" class="muted">Failed to load whitelist.</td></tr>`; }
}

// ---------- Manual whitelist add ----------
addWhitelistBtn.addEventListener("click", async ()=>{
  const emailRaw = (wlEmailInput.value||"").trim(); const phone=(wlPhoneInput.value||"").trim();
  if(!emailRaw||!phone) return alert("Enter email & phone");
  const email = emailRaw.toLowerCase();
  const confirmed = await showConfirmModal("Add to whitelist", `Add ${email}?`);
  if(!confirmed) return;
  showLoader("Adding...");
  try{
    await setDoc(doc(db,"users",email),{email,phone,chatId:"",subscriptionActive:true,subscriptionStartTime:Date.now(),subscriptionCount:1},{merge:true});
    await setDoc(doc(db,"whitelist",email),{email,phone,subscriptionActive:true,subscriptionStartTime:Date.now()},{merge:true});
    hideLoader(); await loadUsers(); await loadWhitelist(); alert(`${email} added.`);
  } catch(e){ hideLoader(); console.error(e); alert("Failed to add."); }
});

// ---------- CSV batch injection ----------
wlCsvUpload.addEventListener("change", async e=>{
  const file=e.target.files?.[0]; if(!file) return;
  const confirmed = await showConfirmModal("CSV Batch","Inject CSV batch to whitelist?");
  if(!confirmed) return;
  showLoader("Processing CSV...");
  try{
    const text = await file.text();
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l);
    const batchEmails=[];
    for(const line of lines){
      const [emailRaw,phone,chatId] = line.split(",").map(s=>s.replace(/^"(.*)"$/,"$1").trim());
      if(!emailRaw||!phone||!chatId) continue;
      const email=emailRaw.toLowerCase(); batchEmails.push(email);
      await setDoc(doc(db,"users",email),{email,phone,chatId,subscriptionActive:true,subscriptionStartTime:Date.now(),subscriptionCount:1},{merge:true});
      await setDoc(doc(db,"whitelist",email),{email,phone,chatId,subscriptionActive:true,subscriptionStartTime:Date.now()},{merge:true});
    }
    if(cleanUpLadyToggle.checked){
      const wlSnap = await getDocs(collection(db,"whitelist"));
      for(const wlDoc of wlSnap.docs){
        const key=(wlDoc.id||"").toLowerCase();
        if(!batchEmails.includes(key)){
          await updateDoc(doc(db,"users",key),{subscriptionActive:false}).catch(()=>{});
          await deleteDoc(doc(db,"whitelist",key)).catch(()=>{});
        }
      }
    }
    hideLoader(); await loadUsers(); await loadWhitelist(); alert("CSV batch processed.");
  } catch(e){ hideLoader(); console.error(e); alert("CSV processing failed."); }
  finally{ wlCsvUpload.value=""; }
});

// ---------- Export CSV ----------
exportCsvBtn.addEventListener("click", ()=>{
  const rows=[["email","phone","chatId","stars","cash","isVIP","isAdmin","isHost","subscriptionActive","subscriptionStartTime","subscriptionCount"]];
  usersCache.forEach(u=>rows.push([u.email||"",u.phone||"",u.chatId||"",u.stars||0,u.cash||0,!!u.isVIP,!!u.isAdmin,!!u.isHost,!!u.subscriptionActive,u.subscriptionStartTime||"",u.subscriptionCount||0]));
  downloadCSV("users_export.csv",rows);
});