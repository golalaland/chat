// admin-payfeed.js
// Font: 乂丨乂丨
console.log("✅ Admin panel JS loaded");

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
const featuredTableBody = document.querySelector("#featuredTable tbody");

const logoutBtn = document.getElementById("logoutBtn");
const userSearch = document.getElementById("userSearch");
const exportCurrentCsv = document.getElementById("exportCurrentCsv");
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

// ---------- Utilities ----------
function showLoader(text = "Processing...") {
  if(loaderText) loaderText.textContent = text;
  if(loaderOverlay) loaderOverlay.style.display = "flex";
}
function hideLoader(){ if(loaderOverlay) loaderOverlay.style.display = "none"; }

function sanitizeCSVCell(s){ return String(s==null ? "" : s).replaceAll('"','').trim(); }
function mkCSVName(prefix){ return `${prefix}_${(new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-')}.csv`; }
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

if(adminCheckBtn){
  adminCheckBtn.addEventListener("click", async ()=>{
    if(!adminEmailInput) return;
    adminGateMsg.textContent="";
    const val = adminEmailInput.value.trim();
    if(!val){ adminGateMsg.textContent="Enter admin email"; return; }
    showLoader("Checking admin...");
    const a = await checkAdmin(val);
    hideLoader();
    if(!a){ adminGateMsg.textContent="Not authorized"; return; }
    currentAdmin = a;
    if(currentAdminEmailEl) currentAdminEmailEl.textContent = a.email;
    if(adminGate) adminGate.classList.add("hidden");
    if(adminPanel) adminPanel.classList.remove("hidden");
    await loadUsers(); await loadWhitelist(); await loadFeatured();
  });
}
if(adminEmailInput) adminEmailInput.addEventListener("keydown", e => { if(e.key==="Enter" && adminCheckBtn) adminCheckBtn.click(); });
if(logoutBtn) logoutBtn.addEventListener("click", ()=>{
  currentAdmin = null;
  if(adminPanel) adminPanel.classList.add("hidden");
  if(adminGate) adminGate.classList.remove("hidden");
  if(adminEmailInput) adminEmailInput.value = "";
});

// ---------- Data caches ----------
let usersCache = [];

// ---------- Users loader ----------
async function loadUsers(){
  if(!usersTableBody) return;
  try{
    usersTableBody.innerHTML = "";
    const snap = await getDocs(collection(db,"users"));
    usersCache = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    renderUsers(usersCache);
  }catch(e){
    console.error(e);
    usersTableBody.innerHTML = `<tr><td colspan="14" class="muted">Failed to load users.</td></tr>`;
  }
}

// ---------- Users render ----------
function renderUsers(users){
  if(!usersTableBody) return;
  usersTableBody.innerHTML = "";
  users.forEach(u=>{
    const tr = document.createElement("tr");
    tr.dataset.id = u.id;
    tr.innerHTML = `
      <td><input type="checkbox" class="row-select"/></td>
      <td>${sanitizeCSVCell(u.email||"")}</td>
      <td>${sanitizeCSVCell(u.phone||"")}</td>
      <td>${sanitizeCSVCell(u.chatId||"")}</td>
      <td>${u.stars||0}</td>
      <td>${u.cash||0}</td>
      <td>${u.isVIP?"Yes":"No"}</td>
      <td>${u.isAdmin?"Yes":"No"}</td>
      <td>${u.isHost?"Yes":"No"}</td>
      <td>${u.subscriptionActive?"Active":"Inactive"}</td>
      <td>${u.featuredHosts?"Yes":"No"}</td>
      <td>${u.popupPhoto||""}</td>
      <td>${u.videoUrl||""}</td>
      <td>
        <button class="btn btn-primary small edit-user-btn">Edit</button>
        <button class="btn btn-danger small remove-user-btn">Remove</button>
        <br/>
        <input type="number" min="1" class="add-stars-input" placeholder="Stars" style="width:60px;margin-top:4px"/>
        <button class="btn btn-primary small add-stars-btn">Add</button>
      </td>
    `;
    usersTableBody.appendChild(tr);
  });

  // Add stars logic
  usersTableBody.querySelectorAll(".add-stars-btn").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const tr = btn.closest("tr");
      const userId = tr.dataset.id;
      const input = tr.querySelector(".add-stars-input");
      const starsToAdd = parseInt(input.value);
      if(!starsToAdd || starsToAdd<=0){ alert("Enter valid number"); return; }

      showLoader("Adding stars...");
      try{
        const userRef = doc(db,"users",userId);
        await updateDoc(userRef,{ stars:(parseInt(tr.children[4].textContent)||0)+starsToAdd });
        hideLoader();
        await loadUsers();
        alert(`Added ${starsToAdd} stars`);
      }catch(err){ hideLoader(); console.error(err); alert("Failed to add stars"); }
    });
  });
}

// ---------- Featured loader ----------
async function loadFeatured(){
  if(!featuredTableBody) return;
  try{
    featuredTableBody.innerHTML = "";
    const snap = await getDocs(collection(db,"featuredHosts"));
    snap.forEach(d=>{
      const f = d.data()||{};
      const tr = document.createElement("tr");
      tr.dataset.id = d.id;
      tr.innerHTML = `
        <td><input type="checkbox" class="row-select"/></td>
        <td>${sanitizeCSVCell(f.email||"")}</td>
        <td>${sanitizeCSVCell(f.phone||"")}</td>
        <td><input type="text" class="popup-photo" value="${sanitizeCSVCell(f.popupPhoto||"")}" style="width:160px"/></td>
        <td><input type="text" class="video-url" value="${sanitizeCSVCell(f.videoUrl||"")}" style="width:160px"/></td>
        <td>${f.addedAt?new Date(f.addedAt).toLocaleString():""}</td>
        <td></td>
      `;
      const saveBtn = document.createElement("button"); saveBtn.className="btn btn-primary small"; saveBtn.textContent="Save";
      const removeBtn = document.createElement("button"); removeBtn.className="btn btn-danger small"; removeBtn.textContent="Remove";
      saveBtn.addEventListener("click", async ()=>{
        const confirmed = await showConfirmModal("Save Featured", `Update featured host ${f.email||""}?`);
        if(!confirmed) return;
        showLoader("Saving...");
        try{
          const popupPhoto = tr.querySelector(".popup-photo").value.trim();
          const videoUrl  = tr.querySelector(".video-url").value.trim();
          await updateDoc(doc(db,"featuredHosts",d.id),{popupPhoto,videoUrl});
          await updateDoc(doc(db,"users",d.id),{popupPhoto,videoUrl}).catch(()=>{});
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
          await updateDoc(doc(db,"users",d.id),{featuredHosts:false}).catch(()=>{});
          hideLoader(); await loadFeatured(); await loadUsers();
        }catch(err){ hideLoader(); console.error(err); alert("Remove failed."); }
      });
      tr.children[6].append(saveBtn,removeBtn);
      featuredTableBody.appendChild(tr);
    });
  }catch(err){
    console.error(err);
    featuredTableBody.innerHTML = `<tr><td colspan="7" class="muted">Failed to load featured hosts.</td></tr>`;
  }
}

// ---------- Initial load ----------
(async function initialLoads(){
  await loadUsers().catch(()=>{});
  await loadFeatured().catch(()=>{});
})();