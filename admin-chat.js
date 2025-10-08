// admin-chat.js
// NOTE: Simple admin gate implemented by checking user's doc for isAdmin flag.
// For production, use Firebase Auth + security rules or server-side protection.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, query, where, onSnapshot,
  updateDoc, setDoc, deleteDoc, orderBy, addDoc, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Firebase config (same as chatroom) ----------
const firebaseConfig = {
  apiKey: "AIzaSyDbKz4ef_eUDlCukjmnK38sOwueYuzqoao",
  authDomain: "metaverse-1010.firebaseapp.com",
  projectId: "metaverse-1010",
  storageBucket: "metaverse-1010.appspot.com",
  messagingSenderId: "1044064238233",
  appId: "1:1044064238233:web:2fbdfb811cb0a3ba349608",
  measurementId: "G-S77BMC266C",
  databaseURL: "https://metaverse-1010-default-rtdb.firebaseio.com/"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------- Helpers ----------
function sanitizeKey(key) { return key.replace(/[.#$[\]]/g, ','); }
function el(id) { return document.getElementById(id); }
function create(tag, attrs = {}) { const e = document.createElement(tag); Object.entries(attrs).forEach(([k,v])=> e.setAttribute(k,v)); return e; }

// ---------- DOM refs ----------
const adminGate = el('adminGate');
const adminCheckBtn = el('adminCheckBtn');
const adminEmail = el('adminEmail');
const adminGateMsg = el('adminGateMsg');
const adminPanel = el('adminPanel');
const currentAdminEmail = el('currentAdminEmail');
const logoutBtn = el('logoutBtn');

const usersTableBody = document.querySelector('#usersTable tbody');
const messagesTableBody = document.querySelector('#messagesTable tbody');
const whitelistTableBody = document.querySelector('#whitelistTable tbody');

const userSearch = el('userSearch');
const exportCsvBtn = el('exportCsv');

const addWhitelistBtn = el('addWhitelistBtn');
const wlEmail = el('wlEmail');
const wlPhone = el('wlPhone');

const clearChatBtn = el('clearChatBtn');

let CURRENT_ADMIN = null;
let usersCache = {}; // id -> data

// ---------- Admin gate ----------
adminCheckBtn.addEventListener('click', async () => {
  const email = (adminEmail.value || '').trim().toLowerCase();
  if (!email) { adminGateMsg.innerText = 'Enter an admin email'; return; }
  adminGateMsg.innerText = 'Checking...';

  try {
    const uid = sanitizeKey(email);
    const uRef = doc(db, 'users', uid);
    const snap = await getDoc(uRef);

    if (!snap.exists() || !snap.data().isAdmin) {
      adminGateMsg.innerText = 'Not an admin or user not found';
      return;
    }

    CURRENT_ADMIN = { uid, email, ...snap.data() };
    adminGateMsg.innerText = '';
    adminGate.style.display = 'none';
    adminPanel.classList.remove('hidden');
    currentAdminEmail.innerText = CURRENT_ADMIN.email;

    // Start listening after confirmed admin
    startUsersListener();
    startMessagesListener();
    loadWhitelist();

  } catch (err) {
    console.error(err);
    adminGateMsg.innerText = 'Error checking admin';
  }
});

logoutBtn.addEventListener('click', ()=> {
  CURRENT_ADMIN = null;
  adminPanel.classList.add('hidden');
  adminGate.style.display = 'block';
  adminEmail.value = '';
});

// ---------- Users management ----------
async function startUsersListener(){
  // load all users once then listen for updates via polling or manual refresh
  const col = collection(db, 'users');
  const snap = await getDocs(col);
  usersCache = {};
  snap.forEach(d => usersCache[d.id] = d.data());
  renderUsersTable();

  // No realtime on all docs to keep costs low — re-run fetch periodically or add onSnapshot as needed.
}

function renderUsersTable(filter=''){
  usersTableBody.innerHTML = '';
  const rows = Object.entries(usersCache)
    .filter(([id,data]) => {
      if (!filter) return true;
      const f = filter.toLowerCase();
      return (data.email||'').toLowerCase().includes(f) ||
             (data.chatId||'').toLowerCase().includes(f);
    })
    .sort((a,b) => (a[1].email||'').localeCompare(b[1].email||''));

  for (const [id, data] of rows) {
    const tr = document.createElement('tr');

    const emailTd = document.createElement('td');
    emailTd.textContent = data.email || id;

    const chatIdTd = document.createElement('td');
    chatIdTd.textContent = data.chatId || '—';

    const starsTd = document.createElement('td');
    const starsInput = document.createElement('input');
    starsInput.value = data.stars || 0;
    starsInput.style.width = '90px';
    starsInput.className = 'small';
    starsTd.appendChild(starsInput);

    const vipTd = document.createElement('td');
    const vipToggle = document.createElement('input');
    vipToggle.type = 'checkbox'; vipToggle.checked = !!data.isVIP;
    vipTd.appendChild(vipToggle);

    const adminTd = document.createElement('td');
    const adminToggle = document.createElement('input');
    adminToggle.type = 'checkbox'; adminToggle.checked = !!data.isAdmin;
    adminTd.appendChild(adminToggle);

    const actionsTd = document.createElement('td');
    const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save'; saveBtn.className = 'btn btn-primary small';
    const delBtn = document.createElement('button'); delBtn.textContent = 'Delete'; delBtn.className = 'btn btn-danger small';

    actionsTd.appendChild(saveBtn);
    actionsTd.appendChild(delBtn);

    tr.appendChild(emailTd);
    tr.appendChild(chatIdTd);
    tr.appendChild(starsTd);
    tr.appendChild(vipTd);
    tr.appendChild(adminTd);
    tr.appendChild(actionsTd);

    usersTableBody.appendChild(tr);

    // Save handler
    saveBtn.addEventListener('click', async () => {
      const newStars = Number(starsInput.value || 0);
      const newIsVIP = vipToggle.checked;
      const newIsAdmin = adminToggle.checked;
      try {
        await updateDoc(doc(db, 'users', id), { stars: newStars, isVIP: newIsVIP, isAdmin: newIsAdmin });
        usersCache[id].stars = newStars;
        usersCache[id].isVIP = newIsVIP;
        usersCache[id].isAdmin = newIsAdmin;
        alert('Saved');
      } catch (err) { console.error(err); alert('Save failed'); }
    });

    // Delete handler
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Delete user ${data.email || id}? This will remove their user doc.`)) return;
      try {
        await deleteDoc(doc(db, 'users', id));
        delete usersCache[id];
        tr.remove();
      } catch (err) { console.error(err); alert('Delete failed'); }
    });
  }
}

userSearch.addEventListener('input', (e) => renderUsersTable(e.target.value.trim()));

// CSV export
exportCsvBtn.addEventListener('click', () => {
  const rows = [['email','chatId','stars','isVIP','isAdmin']];
  for (const [id, d] of Object.entries(usersCache)) rows.push([d.email||id, d.chatId||'', d.stars||0, d.isVIP||false, d.isAdmin||false]);
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'users.csv'; a.click();
  URL.revokeObjectURL(url);
});

// ---------- Messages moderator ----------
function startMessagesListener(){
  const messagesCol = collection(db, 'messages_room5');
  const q = query(messagesCol, orderBy('timestamp'));
  onSnapshot(q, snap => {
    messagesTableBody.innerHTML = '';
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const tr = document.createElement('tr');
      const chatTd = document.createElement('td'); chatTd.textContent = d.chatId || '—';
      const contentTd = document.createElement('td'); contentTd.textContent = d.content || '';
      const highlightTd = document.createElement('td'); highlightTd.textContent = d.highlight ? 'YES' : '';
      const timeTd = document.createElement('td'); timeTd.textContent = d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleString() : '';
      const actionTd = document.createElement('td');
      const delBtn = document.createElement('button'); delBtn.className = 'btn btn-danger small'; delBtn.textContent = 'Delete';
      actionTd.appendChild(delBtn);

      tr.appendChild(chatTd);
      tr.appendChild(contentTd);
      tr.appendChild(highlightTd);
      tr.appendChild(timeTd);
      tr.appendChild(actionTd);
      messagesTableBody.appendChild(tr);

      delBtn.addEventListener('click', async () => {
        if (!confirm('Delete this message?')) return;
        try {
          await deleteDoc(doc(db, 'messages_room5', docSnap.id));
          tr.remove(); // optimistic
        } catch (err) { console.error(err); alert('Delete failed'); }
      });
    });
  });
}

// Clear chat (delete all docs in messages_room5) — careful!
clearChatBtn.addEventListener('click', async () => {
  if (!confirm('This will delete ALL messages in the room. Confirm?')) return;
  try {
    // fetch all doc ids then delete
    const q = query(collection(db, 'messages_room5'), orderBy('timestamp'));
    const snap = await getDocs(q);
    const batchDeletes = [];
    for (const docSnap of snap.docs) {
      await deleteDoc(doc(db, 'messages_room5', docSnap.id));
    }
    alert('Chat cleared');
  } catch (err) { console.error(err); alert('Clear failed'); }
});

// ---------- Whitelist management ----------
async function loadWhitelist(){
  const snap = await getDocs(collection(db, 'whitelist'));
  whitelistTableBody.innerHTML = '';
  snap.forEach(d => {
    const data = d.data();
    const tr = document.createElement('tr');
    const emailTd = document.createElement('td'); emailTd.textContent = data.email || d.id;
    const phoneTd = document.createElement('td'); phoneTd.textContent = data.phone || '';
    const actionTd = document.createElement('td');
    const delBtn = document.createElement('button'); delBtn.className = 'btn btn-danger small'; delBtn.textContent = 'Remove';
    actionTd.appendChild(delBtn);
    tr.appendChild(emailTd); tr.appendChild(phoneTd); tr.appendChild(actionTd);
    whitelistTableBody.appendChild(tr);

    delBtn.addEventListener('click', async () => {
      if (!confirm(`Remove whitelist: ${data.email}?`)) return;
      try {
        await deleteDoc(doc(db, 'whitelist', d.id));
        tr.remove();
      } catch (err) { console.error(err); alert('Remove failed'); }
    });
  });
}

addWhitelistBtn.addEventListener('click', async () => {
  const email = (wlEmail.value||'').trim().toLowerCase();
  const phone = (wlPhone.value||'').trim();
  if (!email || !phone) return alert('Provide email and phone');
  try {
    const id = sanitizeKey(email);
    await setDoc(doc(db, 'whitelist', id), { email, phone });
    wlEmail.value = ''; wlPhone.value = '';
    await loadWhitelist();
  } catch (err) { console.error(err); alert('Add failed'); }
});

// ---------- Initial small fetch to populate caches if admin already entered ----------
(async ()=>{
  // nothing here — listeners start after admin login
})();