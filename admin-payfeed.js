// admin-payfeed.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc,
  onSnapshot, query, where, getDocs, deleteDoc
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

/* ---------- State ---------- */
let currentAdmin = null;
let cleanupActive = false;
let usersList = [];
let whitelistList = [];

/* ---------- DOM ---------- */
const adminGate = document.getElementById("adminGate");
const adminCheckBtn = document.getElementById("adminCheckBtn");
const adminEmailInput = document.getElementById("adminEmail");
const adminGateMsg = document.getElementById("adminGateMsg");
const adminPanel = document.getElementById("adminPanel");
const currentAdminEmail = document.getElementById("currentAdminEmail");
const usersTableBody = document.querySelector("#usersTable tbody");
const whitelistTableBody = document.querySelector("#whitelistTable tbody");
const addWhitelistBtn = document.getElementById("addWhitelistBtn");
const wlEmailInput = document.getElementById("wlEmail");
const wlPhoneInput = document.getElementById("wlPhone");
const csvFileInput = document.getElementById("csvFile");
const massInjectBtn = document.getElementById("massInjectBtn");
const cleanupToggleBtn = document.getElementById("cleanupToggle");
const exportCsvBtn = document.getElementById("exportCsv");
const logoutBtn = document.getElementById("logoutBtn");

/* ---------- Modal ---------- */
const modalBg = document.getElementById("modalBg");
const modalTitle = document.getElementById("modalTitle");
const modalInput = document.getElementById("modalInput");
const modalConfirm = document.getElementById("modalConfirm");
const modalCancel = document.getElementById("modalCancel");

function showModal(title, defaultValue) {
  modalTitle.innerText = title;
  modalInput.value = defaultValue || "";
  modalBg.classList.remove("hidden");
  return new Promise(resolve => {
    modalConfirm.onclick = () => { modalBg.classList.add("hidden"); resolve(modalInput.value); };
    modalCancel.onclick = () => { modalBg.classList.add("hidden"); resolve(null); };
  });
}

/* ---------- Admin login ---------- */
adminCheckBtn.addEventListener("click", async () => {
  const email = adminEmailInput.value.trim().toLowerCase();
  if (!email) return adminGateMsg.innerText = "Enter an email";

  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  if (snap.empty || !snap.docs[0].data().isAdmin) {
    adminGateMsg.innerText = "Not an admin";
    return;
  }

  currentAdmin = snap.docs[0].data();
  adminPanel.classList.remove("hidden");
  adminGate.classList.add("hidden");
  currentAdminEmail.innerText = currentAdmin.email;
  loadUsers();
  loadWhitelist();
});

/* ---------- Logout ---------- */
logoutBtn.addEventListener("click", () => {
  adminPanel.classList.add("hidden");
  adminGate.classList.remove("hidden");
  currentAdmin = null;
});

/* ---------- Load Users ---------- */
async function loadUsers() {
  const usersSnap = await getDocs(collection(db, "users"));
  usersList = [];
  usersTableBody.innerHTML = "";
  usersSnap.forEach(docSnap => {
    const u = docSnap.data();
    u.id = docSnap.id;
    usersList.push(u);
    renderUserRow(u);
  });
}

function renderUserRow(u) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${u.email}</td>
    <td>${u.chatId || ""}</td>
    <td>${u.stars || 0}</td>
    <td>${u.cash || 0}</td>
    <td><input type="checkbox" ${u.isVIP?"checked":""} class="vipToggle"/></td>
    <td><input type="checkbox" ${u.isHost?"checked":""} class="hostToggle"/></td>
    <td><input type="checkbox" ${u.subscriptionActive?"checked":""} class="subToggle"/></td>
    <td>${u.subscriptionCount||0}</td>
    <td class="actions">
      <button class="btn btn-primary addStarsBtn">Stars</button>
      <button class="btn btn-primary addCashBtn">Cash</button>
      <button class="btn btn-danger deleteUserBtn">Remove</button>
    </td>
  `;
  usersTableBody.appendChild(tr);

  const vipToggle = tr.querySelector(".vipToggle");
  vipToggle.addEventListener("change", async () => updateDoc(doc(db,"users",u.id), {isVIP:vipToggle.checked}));

  const hostToggle = tr.querySelector(".hostToggle");
  hostToggle.addEventListener("change", async () => updateDoc(doc(db,"users",u.id), {isHost:hostToggle.checked}));

  const subToggle = tr.querySelector(".subToggle");
  subToggle.addEventListener("change", async () => updateDoc(doc(db,"users",u.id), {subscriptionActive:subToggle.checked}));

  tr.querySelector(".addStarsBtn").addEventListener("click", async () => {
    const val = await showModal(`Add Stars to ${u.email}`, u.stars||0);
    if (val!=null) await updateDoc(doc(db,"users",u.id), {stars:Number(val)});
    loadUsers();
  });
  tr.querySelector(".addCashBtn").addEventListener("click", async () => {
    const val = await showModal(`Add Cash to ${u.email}`, u.cash||0);
    if (val!=null) await updateDoc(doc(db,"users",u.id), {cash:Number(val)});
    loadUsers();
  });
  tr.querySelector(".deleteUserBtn").addEventListener("click", async () => {
    if (confirm(`Remove user ${u.email}?`)) await deleteDoc(doc(db,"users",u.id));
    loadUsers();
  });
}

/* ---------- Whitelist ---------- */
async function loadWhitelist() {
  const snap = await getDocs(collection(db,"whitelist"));
  whitelistList = [];
  whitelistTableBody.innerHTML = "";
  snap.forEach(docSnap=>{
    const w = docSnap.data(); w.id = docSnap.id;
    whitelistList.push(w);
    renderWhitelistRow(w);
  });
}

function renderWhitelistRow(w){
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${w.email}</td>
    <td>${w.phone}</td>
    <td>${w.subscriptionActive?"Yes":"No"}</td>
    <td><button class="btn btn-danger removeWlBtn">Remove</button></td>
  `;
  whitelistTableBody.appendChild(tr);
  tr.querySelector(".removeWlBtn").addEventListener("click", async ()=>{
    await deleteDoc(doc(db,"whitelist",w.id));
    // toggle subscriptionActive off for user
    const usersSnap = await getDocs(query(collection(db,"users"), where("email","==",w.email)));
    usersSnap.forEach(async udoc=>{await updateDoc(doc(db,"users",udoc.id),{subscriptionActive:false});});
    loadWhitelist();
    loadUsers();
  });
}

/* ---------- Manual Add Whitelist ---------- */
addWhitelistBtn.addEventListener("click", async ()=>{
  const email = wlEmailInput.value.trim().toLowerCase();
  const phone = wlPhoneInput.value.trim();
  if (!email || !phone) return alert("Provide email and phone");

  // Add to whitelist collection
  const wlDocRef = doc(db,"whitelist",email);
  await setDoc(wlDocRef, {email,phone,subscriptionActive:true});

  // Add/update user
  const q = query(collection(db,"users"), where("email","==",email));
  const snap = await getDocs(q);
  if (snap.empty){
    await setDoc(doc(db,"users",email), {email,phone,stars:0,cash:0,isVIP:false,isHost:false,subscriptionActive:true,subscriptionCount:1});
  } else {
    snap.forEach(async u=>{await updateDoc(doc(db,"users",u.id), {subscriptionActive:true, subscriptionCount:(u.data().subscriptionCount||0)+1});});
  }

  loadWhitelist();
  loadUsers();
});

/* ---------- Mass CSV Injection ---------- */
massInjectBtn.addEventListener("click", async ()=>{
  const file = csvFileInput.files[0];
  if (!file) return alert("Select CSV");
  const text = await file.text();
  const rows = text.split(/\r?\n/).map(r=>r.split(",")).filter(r=>r[0]);
  const emailsPhones = rows.map(r=>({email:r[0].trim().toLowerCase(), phone:r[1]?.trim()||""}));

  for(const entry of emailsPhones){
    const wlDocRef = doc(db,"whitelist",entry.email);
    await setDoc(wlDocRef, {email:entry.email,phone:entry.phone,subscriptionActive:true});

    const q = query(collection(db,"users"), where("email","==",entry.email));
    const snap = await getDocs(q);
    if(snap.empty){
      await setDoc(doc(db,"users",entry.email), {email:entry.email,phone:entry.phone,stars:0,cash:0,isVIP:false,isHost:false,subscriptionActive:true,subscriptionCount:1});
    } else {
      snap.forEach(async u=>{await updateDoc(doc(db,"users",u.id), {subscriptionActive:true, subscriptionCount:(u.data().subscriptionCount||0)+1});});
    }
  }

  // Cleanup Lady
  if(cleanupActive){
    const whitelistEmails = emailsPhones.map(e=>e.email);
    const snap = await getDocs(collection(db,"whitelist"));
    snap.forEach(async wdoc=>{
      if(!whitelistEmails.includes(wdoc.id)){
        await deleteDoc(doc(db,"whitelist",wdoc.id));
        const uSnap = await getDocs(query(collection(db,"users"), where("email","==",wdoc.id)));
        uSnap.forEach(async u=>{await updateDoc(doc(db,"users",u.id), {subscriptionActive:false});});
      }
    });
  }

  loadWhitelist();
  loadUsers();
});

/* ---------- Clean Up Lady Toggle ---------- */
cleanupToggleBtn.addEventListener("click", ()=>{
  cleanupActive = !cleanupActive;
  cleanupToggleBtn.innerText = `Clean Up Lady 🧼 ${cleanupActive?"ON":"OFF"}`;
});

/* ---------- Export CSV ---------- */
exportCsvBtn.addEventListener("click", async ()=>{
  const snap = await getDocs(collection(db,"users"));
  const all = [];
  snap.forEach(docSnap=>all.push(docSnap.data()));
  if(all.length===0) return alert("No users");

  const headers = Object.keys(all[0]);
  const csvRows = [headers.join(",")];
  all.forEach(u=>{
    csvRows.push(headers.map(h=>u[h]).join(","));
  });

  const blob = new Blob([csvRows.join("\n")], {type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "users.csv";
  a.click();
  URL.revokeObjectURL(url);
});