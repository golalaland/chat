// admin-payfeed.js (full)
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
const copyToFeaturedBtn = document.getElementById("copyToFeaturedBtn");

const loaderOverlay = document.getElementById("loaderOverlay");
const loaderText = document.getElementById("loaderText");

// ---------- Utilities ----------
function showLoader(text = "Processing...") {
  if (loaderText) loaderText.textContent = text;
  if (loaderOverlay) loaderOverlay.style.display = "flex";
}
function hideLoader() { if (loaderOverlay) loaderOverlay.style.display = "none"; }

function sanitizeCSVCell(s){ return String(s==null ? "" : s).replaceAll('"','').trim(); }

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
    await loadUsers();
    await loadFeatured();
  });
}
if (logoutBtn) logoutBtn.addEventListener("click", ()=>{
  currentAdmin = null;
  if (adminPanel) adminPanel.classList.add("hidden");
  if (adminGate) adminGate.classList.remove("hidden");
  if (adminEmailInput) adminEmailInput.value = "";
});

// ---------- Data caches ----------
let usersCache = [];

// ---------- Loaders ----------
async function loadUsers(){
  if (!usersTableBody) return;
  try{
    usersTableBody.innerHTML = "";
    const snap = await getDocs(collection(db,"users"));
    usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    usersCache.forEach(u => {
      const tr = document.createElement("tr");
      tr.dataset.id = u.id;
      tr.innerHTML = `
        <td><input type="checkbox" class="row-select"/></td>
        <td>${sanitizeCSVCell(u.email||"")}</td>
        <td>${sanitizeCSVCell(u.phone||"")}</td>
        <td>${sanitizeCSVCell(u.fullName||"")}</td>
        <td>${u.isHost ? "Yes" : "No"}</td>
        <td>${u.isVIP ? "Yes" : "No"}</td>
      `;
      usersTableBody.appendChild(tr);
    });
  }catch(err){ console.error(err); usersTableBody.innerHTML = `<tr><td colspan="6" class="muted">Failed to load users.</td></tr>`; }
}

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
  }catch(err){ console.error(err); featuredTableBody.innerHTML = `<tr><td colspan="7" class="muted">Failed to load featured hosts.</td></tr>`; }
}

// ---------- Copy to Featured ----------
if(copyToFeaturedBtn){
  copyToFeaturedBtn.addEventListener("click", async ()=>{
    const selectedCheckboxes = Array.from(usersTableBody.querySelectorAll(".row-select:checked"));
    if(selectedCheckboxes.length === 0){ alert("Select at least one user."); return; }
    const confirmed = await showConfirmModal("Copy to Featured", `Copy ${selectedCheckboxes.length} user(s) to featured hosts?`);
    if(!confirmed) return;
    showLoader("Copying to featured...");
    try{
      for(const checkbox of selectedCheckboxes){
        const tr = checkbox.closest("tr");
        const userId = tr.dataset.id;
        const userData = usersCache.find(u=>u.id===userId);
        if(!userData) continue;
        const copyData = { ...userData, addedAt: Date.now(), featuredHosts: true };
        await setDoc(doc(db,"featuredHosts",userId), copyData, { merge: true });
        await updateDoc(doc(db,"users",userId), { featuredHosts: true }).catch(()=>{});
      }
      hideLoader(); await loadFeatured(); await loadUsers();
      alert("Selected users copied to featured hosts.");
    }catch(err){ hideLoader(); console.error(err); alert("Failed to copy to featured."); }
  });
}

// ---------- Initial Loads ----------
(async function initialLoads(){
  await loadUsers().catch(()=>{});
  await loadFeatured().catch(()=>{});
})();