// admin-payfeed.js (full, rewritten for inline editing & features)
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
  if (loaderText) loaderText.textContent = text;
  if (loaderOverlay) loaderOverlay.style.display = "flex";
}
function hideLoader() { if (loaderOverlay) loaderOverlay.style.display = "none"; }

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
    const rdiv = document.createElement("div");
    rdiv.style.display="flex"; rdiv.style.justifyContent="center"; rdiv.style.gap="10px";
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

// ---------- Render Users ----------
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
      <td><input type="number" class="stars-input" value="${u.stars||0}" style="width:60px"/></td>
      <td><input type="number" class="cash-input" value="${u.cash||0}" style="width:60px"/></td>
      <td><input type="checkbox" class="vip-toggle"/></td>
      <td><input type="checkbox" class="admin-toggle"/></td>
      <td><input type="checkbox" class="host-toggle"/></td>
      <td><input type="checkbox" class="sub-toggle"/></td>
      <td><input type="checkbox" class="featured-toggle"/></td>
      <td><input type="text" class="popup-photo" value="${sanitizeCSVCell(u.popupPhoto||"")}" style="width:120px"/></td>
      <td><input type="text" class="video-url" value="${sanitizeCSVCell(u.videoUrl||"")}" style="width:120px"/></td>
      <td></td>
    `;

    tr.querySelector(".vip-toggle").checked = !!u.isVIP;
    tr.querySelector(".admin-toggle").checked = !!u.isAdmin;
    tr.querySelector(".host-toggle").checked = !!u.isHost;
    tr.querySelector(".sub-toggle").checked = !!u.subscriptionActive;
    tr.querySelector(".featured-toggle").checked = !!u.featuredHosts;

    // Save button
    const saveBtn = document.createElement("button");
    saveBtn.className = "btn btn-primary small";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", async ()=>{
      const confirmed = await showConfirmModal("Save User", `Update ${u.email || ""}?`);
      if(!confirmed) return;
      showLoader("Saving...");
      try{
        const stars = parseInt(tr.querySelector(".stars-input").value)||0;
        const cash  = parseInt(tr.querySelector(".cash-input").value)||0;
        const isVIP = tr.querySelector(".vip-toggle").checked;
        const isAdmin = tr.querySelector(".admin-toggle").checked;
        const isHost = tr.querySelector(".host-toggle").checked;
        const subscriptionActive = tr.querySelector(".sub-toggle").checked;
        const featuredHosts = tr.querySelector(".featured-toggle").checked;
        const popupPhoto = tr.querySelector(".popup-photo").value.trim();
        const videoUrl = tr.querySelector(".video-url").value.trim();

        await updateDoc(doc(db,"users",u.id), {
          stars, cash, isVIP, isAdmin, isHost, subscriptionActive, featuredHosts, popupPhoto, videoUrl
        });

        // sync featuredHosts automatically
        if(featuredHosts){
          await setDoc(doc(db,"featuredHosts",u.id), {
            email:u.email, phone:u.phone, popupPhoto, videoUrl,
            addedAt: Date.now()
          });
        } else {
          await deleteDoc(doc(db,"featuredHosts",u.id)).catch(()=>{});
        }

        hideLoader();
        await loadUsers();
        await loadFeatured();
        alert("User updated.");
      }catch(err){
        hideLoader();
        console.error(err);
        alert("Failed to save user.");
      }
    });

    // Remove button
    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-danger small";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async ()=>{
      const confirmed = await showConfirmModal("Remove User", `Remove ${u.email}?`);
      if(!confirmed) return;
      showLoader("Removing...");
      try{
        await deleteDoc(doc(db,"users",u.id));
        await deleteDoc(doc(db,"featuredHosts",u.id)).catch(()=>{});
        hideLoader();
        await loadUsers();
        await loadFeatured();
      }catch(err){
        hideLoader();
        console.error(err);
        alert("Failed to remove user.");
      }
    });

    tr.children[13].append(saveBtn, removeBtn);
    usersTableBody.appendChild(tr);
  });
}

// ---------- Loaders ----------
async function loadUsers(){
  if(!usersTableBody) return;
  try{
    usersTableBody.innerHTML = "";
    const snap = await getDocs(collection(db,"users"));
    usersCache = snap.docs.map(d=>({id:d.id,...d.data()}));
    renderUsers(usersCache);
  }catch(err){
    console.error(err);
    usersTableBody.innerHTML = `<tr><td colspan="14">Failed to load users.</td></tr>`;
  }
}

async function loadWhitelist(){
  if(!whitelistTableBody) return;
  try{
    whitelistTableBody.innerHTML = "";
    const snap = await getDocs(collection(db,"whitelist"));
    snap.forEach(d=>{
      const w = d.data()||{};
      const tr = document.createElement("tr");
      tr.dataset.id=d.id;
      tr.innerHTML=`
        <td><input type="checkbox" class="row-select"/></td>
        <td>${sanitizeCSVCell(w.email||"")}</td>
        <td>${sanitizeCSVCell(w.phone||"")}</td>
        <td>${w.subscriptionActive?"Active":"Inactive"}</td>
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
          hideLoader();
          await loadWhitelist();
        }catch(err){ hideLoader(); console.error(err); alert("Failed."); }
      });
      tr.children[4].appendChild(removeBtn);
      whitelistTableBody.appendChild(tr);
    });
  }catch(err){ console.error(err); whitelistTableBody.innerHTML=`<tr><td colspan="5">Failed to load whitelist.</td></tr>`; }
}

async function loadFeatured(){
  if(!featuredTableBody) return;
  try{
    featuredTableBody.innerHTML="";
    const snap = await getDocs(collection(db,"featuredHosts"));
    snap.forEach(d=>{
      const f=d.data()||{};
      const tr=document.createElement("tr");
      tr.dataset.id=d.id;
      tr.innerHTML=`
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
        const confirmed = await showConfirmModal("Save Featured", `Update ${f.email||""}?`);
        if(!confirmed) return;
        showLoader("Saving...");
        try{
          const popupPhoto = tr.querySelector(".popup-photo").value.trim();
          const videoUrl  = tr.querySelector(".video-url").value.trim();
          await updateDoc(doc(db,"featuredHosts",d.id), { popupPhoto, videoUrl });
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
  }catch(err){ console.error(err); featuredTableBody.innerHTML=`<tr><td colspan="7">Failed to load featured hosts.</td></tr>`; }
}

// ---------- Initial loads ----------
(async function initialLoads(){
  await loadUsers().catch(()=>{});
  await loadWhitelist().catch(()=>{});
  await loadFeatured().catch(()=>{});
})();

// ---------- Copy to Featured ----------
if(copyToFeaturedBtn){
  copyToFeaturedBtn.addEventListener("click", async ()=>{
    const selectedRows = Array.from(usersTableBody.querySelectorAll(".row-select:checked")).map(r=>r.closest("tr"));
    if(!selectedRows.length){ alert("Select users first."); return; }
    showLoader("Copying to featured...");
    try{
      for(const tr of selectedRows){
        const uid = tr.dataset.id;
        const user = usersCache.find(u=>u.id === uid);
        if(!user) continue;

        // Clone all user fields dynamically
        const dataToCopy = { ...user, addedAt: Date.now() }; 
        // Remove fields that shouldn’t be in featuredHosts (optional)
        delete dataToCopy.id;

        await setDoc(doc(db,"featuredHosts",uid), dataToCopy);
        await updateDoc(doc(db,"users",uid), { featuredHosts:true });
      }
      hideLoader(); await loadFeatured(); await loadUsers();
      alert("Copied to featured successfully.");
    }catch(err){ hideLoader(); console.error(err); alert("Copy failed."); }
  });
}

// ---------- CSV exports ----------
if(exportCurrentCsv){
  exportCurrentCsv.addEventListener("click", ()=>{
    if(!usersCache.length){ alert("No data"); return; }
    const rows = [["Email","Phone","ChatId","Stars","Cash","VIP","Admin","Host","SubActive","Featured","Popup","Video"]];
    usersCache.forEach(u=>{
      rows.push([u.email,u.phone,u.chatId,u.stars||0,u.cash||0,u.isVIP||false,u.isAdmin||false,u.isHost||false,u.subscriptionActive||false,u.featuredHosts||false,u.popupPhoto||"",u.videoUrl||""]);
    });
    downloadCSV(mkCSVName("users"),rows);
  });
}
if(exportFeaturedCsv){
  exportFeaturedCsv.addEventListener("click", async ()=>{
    const snap = await getDocs(collection(db,"featuredHosts"));
    const rows=[["Email","Phone","Popup","Video","AddedAt"]];
    snap.forEach(d=>{
      const f=d.data()||{};
      rows.push([f.email,f.phone,f.popupPhoto,f.videoUrl,f.addedAt?new Date(f.addedAt).toLocaleString():""]);
    });
    downloadCSV(mkCSVName("featured"),rows);
  });
}