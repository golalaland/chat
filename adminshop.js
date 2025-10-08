import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

document.addEventListener("DOMContentLoaded", ()=>{

  // ---------- DOM ----------
  const adminGate = document.getElementById("adminGate");
  const adminPanel = document.getElementById("adminPanel");
  const adminEmailInput = document.getElementById("adminEmail");
  const adminCheckBtn = document.getElementById("adminCheckBtn");
  const adminGateMsg = document.getElementById("adminGateMsg");
  const currentAdminEmailEl = document.getElementById("currentAdminEmail");

  const usersTableBody = document.querySelector("#usersTable tbody");
  const productsTableBody = document.querySelector("#productsTable tbody");
  const userSearch = document.getElementById("userSearch");
  const exportCsvBtn = document.getElementById("exportCsv");
  const logoutBtn = document.getElementById("logoutBtn");

  const loaderOverlay = document.getElementById("loaderOverlay");
  const loaderText = document.getElementById("loaderText");

  // ---------- HELPERS ----------
  const showLoader = (text="Processing...") => { loaderText.textContent=text; loaderOverlay.style.display="flex"; }
  const hideLoader = () => { loaderOverlay.style.display="none"; }
  const downloadCSV = (filename, rows)=>{
    const csvContent = rows.map(r=>r.map(v=>`"${v??''}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = filename; link.click();
  }
  const createToggleCheckbox = (value)=>{ const input=document.createElement("input"); input.type="checkbox"; input.checked=!!value; return input; }
  const showModal = (title, content)=>new Promise(resolve=>{
    const overlay = document.createElement("div"); overlay.className="modalOverlay";
    const card = document.createElement("div"); card.className="modalContent";
    const h = document.createElement("h3"); h.textContent=title; card.appendChild(h);
    const p = document.createElement("p"); p.innerHTML=content; card.appendChild(p);
    const btn = document.createElement("button"); btn.className="btn btn-primary"; btn.textContent="Close";
    btn.onclick=()=>{ overlay.remove(); resolve(); };
    card.appendChild(btn); overlay.appendChild(card); document.body.appendChild(overlay);
  });

  // ---------- ADMIN LOGIN ----------
  let currentAdmin = null;
  const checkAdmin = async (emailRaw)=>{
    const email = String(emailRaw||"").trim().toLowerCase();
    if(!email) return null;
    const snap = await getDocs(query(collection(db,"users"),where("email","==",email)));
    if(snap.empty) return null;
    const d = snap.docs[0].data()||{};
    return d.isAdmin===true ? { email, id:snap.docs[0].id } : null;
  }

  adminCheckBtn.addEventListener("click", async ()=>{
    adminGateMsg.textContent="";
    const emailRaw = (adminEmailInput.value||"").trim();
    if(!emailRaw){ adminGateMsg.textContent="Enter admin email"; return; }
    showLoader("Checking admin...");
    const admin = await checkAdmin(emailRaw);
    hideLoader();
    if(!admin){ adminGateMsg.textContent="Access denied"; return; }
    currentAdmin = admin;
    currentAdminEmailEl.textContent = admin.email;
    adminGate.classList.add("hidden"); adminPanel.classList.remove("hidden");
    await loadUsers(); await loadProducts();
  });

  adminEmailInput.addEventListener("keydown", e=>{ if(e.key==="Enter") adminCheckBtn.click(); });
  logoutBtn.addEventListener("click", ()=>{
    currentAdmin=null;
    adminPanel.classList.add("hidden");
    adminGate.classList.remove("hidden");
    adminEmailInput.value="";
  });

  // ---------- USERS ----------
  let usersCache = [];
  const loadUsers = async ()=>{
    try{
      showLoader("Loading users...");
      usersTableBody.innerHTML="";
      const snap = await getDocs(collection(db,"users"));
      usersCache = snap.docs.map(d=>({id:d.id,...d.data()}));
      renderUsers(usersCache);
      hideLoader();
    }catch(e){ console.error(e); hideLoader(); usersTableBody.innerHTML="<tr><td colspan='8'>Failed to load users.</td></tr>"; }
  }

  const renderUsers = (users)=>{
    usersTableBody.innerHTML="";
    users.forEach(u=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`
        <td>${u.email||""}</td>
        <td>${u.phone||""}</td>
        <td><input type="number" min="0" value="${u.stars||0}" style="width:60px"></td>
        <td><input type="number" min="0" value="${u.cash||0}" style="width:60px"></td>
        <td></td><td></td><td></td>
        <td></td>
      `;
      tr.children[4].appendChild(createToggleCheckbox(u.isVIP));
      tr.children[5].appendChild(createToggleCheckbox(u.isAdmin));
      tr.children[6].appendChild(createToggleCheckbox(u.subscriptionActive));

      const actionsTd=tr.children[7];
      const updateBtn = document.createElement("button"); updateBtn.className="btn btn-primary btn-small"; updateBtn.textContent="Update";
      updateBtn.addEventListener("click", async ()=>{
        showLoader("Updating user...");
        try{
          const updates={
            stars:Number(tr.children[2].querySelector("input").value||0),
            cash:Number(tr.children[3].querySelector("input").value||0),
            isVIP:tr.children[4].querySelector("input").checked,
            isAdmin:tr.children[5].querySelector("input").checked,
            subscriptionActive:tr.children[6].querySelector("input").checked
          };
          await updateDoc(doc(db,"users",u.id), updates);
          hideLoader();
          alert(`${u.email} updated`);
          await loadUsers();
        }catch(e){ hideLoader(); console.error(e); alert("Update failed"); }
      });
      actionsTd.appendChild(updateBtn);
      usersTableBody.appendChild(tr);
    });
  }

  userSearch.addEventListener("input", ()=>{
    const q = (userSearch.value||"").toLowerCase();
    renderUsers(usersCache.filter(u=>(u.email||"").toLowerCase().includes(q)));
  });

  // ---------- PRODUCTS ----------
  let productsCache = [];
  const loadProducts = async ()=>{
    try{
      productsTableBody.innerHTML="";
      const snap = await getDocs(collection(db,"products"));
      productsCache = snap.docs.map(d=>({id:d.id,...d.data()}));
      renderProducts(productsCache);
    }catch(e){ console.error(e); productsTableBody.innerHTML="<tr><td colspan='3'>Failed to load products.</td></tr>"; }
  }

  const renderProducts = (products)=>{
    productsTableBody.innerHTML="";
    products.forEach(p=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`<td><a href="#">${p.name||""}</a></td><td>${p.price||0}</td><td>${p.stars||0}</td>`;
      const link = tr.querySelector("a");
      link.addEventListener("click", async e=>{
        e.preventDefault();
        await showModal(p.name||"Product", `<strong>Description:</strong><br>${p.description||"No description"}`);
      });
      productsTableBody.appendChild(tr);
    });
  }

  // ---------- EXPORT CSV ----------
  exportCsvBtn.addEventListener("click", ()=>{
    const rows=[["email","phone","stars","cash","isVIP","isAdmin","subscriptionActive"]];
    usersCache.forEach(u=>{
      rows.push([u.email||"", u.phone||"", u.stars||0, u.cash||0, !!u.isVIP, !!u.isAdmin, !!u.subscriptionActive]);
    });
    downloadCSV("users_export.csv", rows);
  });

});