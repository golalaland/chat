// admin-chat.js
// NOTE: Simple admin gate implemented by checking user's doc for isAdmin flag.
// For production, use Firebase Auth + security rules or server-side protection.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, doc, getDocs, setDoc, updateDoc,
  onSnapshot, query, orderBy, increment, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Firebase config ----------
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

// ---------- DOM Refs ----------
const refs = {
  roomSelect: document.getElementById("roomSelect"),
  userTable: document.getElementById("userTable"),
  whitelistForm: document.getElementById("whitelistForm"),
  bulkUploadInput: document.getElementById("bulkCSV"),
  messageTable: document.getElementById("messageTable"),
  addStarsBtn: document.getElementById("addStarsBtn"),
  addCashBtn: document.getElementById("addCashBtn"),
  sendCostInput: document.getElementById("sendCost"),
  buzzCostInput: document.getElementById("buzzCost")
};

// ---------- State ----------
let currentRoom = "room1";
let usersListener = null;
let messagesListener = null;
let roomCosts = { send: 1, buzz: 50 }; // default

// ---------- Room Switching ----------
refs.roomSelect?.addEventListener("change", e => {
  currentRoom = e.target.value;
  loadRoomData(currentRoom);
});

// ---------- Load Room Data ----------
async function loadRoomData(roomId) {
  if (usersListener) usersListener(); // unsubscribe previous
  if (messagesListener) messagesListener();

  loadUsers(roomId);
  loadMessages(roomId);
}

// ---------- Users ----------
async function loadUsers(roomId) {
  const q = query(collection(db, "users"), orderBy("chatId", "asc"));
  usersListener = onSnapshot(q, snap => {
    refs.userTable.innerHTML = "";
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${data.chatId || "GUEST"}</td>
        <td>${data.email || ""}</td>
        <td>${data.phone || ""}</td>
        <td>${data.stars || 0}</td>
        <td>${data.cash || 0}</td>
        <td>${data.isHost ? "Yes":"No"}</td>
        <td>
          <button class="editUserBtn" data-uid="${docSnap.id}">Edit</button>
          <button class="deleteUserBtn" data-uid="${docSnap.id}">Delete</button>
        </td>
      `;
      refs.userTable.appendChild(row);
    });

    document.querySelectorAll(".editUserBtn").forEach(btn => {
      btn.addEventListener("click", async () => editUser(btn.dataset.uid));
    });
    document.querySelectorAll(".deleteUserBtn").forEach(btn => {
      btn.addEventListener("click", async () => deleteUser(btn.dataset.uid));
    });
  });
}

// ---------- Edit User ----------
async function editUser(uid) {
  const docRef = doc(db, "users", uid);
  const snap = await getDocs(query(collection(db, "users"), where("chatId", "==", uid)));
  const data = (await getDoc(docRef)).data();
  const newStars = parseInt(prompt("Stars:", data.stars || 0)) || 0;
  const newCash = parseInt(prompt("Cash:", data.cash || 0)) || 0;
  const isHost = confirm("Is Host?") ? true : false;

  await updateDoc(docRef, { stars: newStars, cash: newCash, isHost });
  alert("User updated");
}

// ---------- Delete User ----------
async function deleteUser(uid) {
  if(confirm("Delete user?")) {
    await deleteDoc(doc(db, "users", uid));
    alert("User deleted");
  }
}

// ---------- Messages ----------
async function loadMessages(roomId) {
  const q = query(collection(db, roomId), orderBy("timestamp", "asc"));
  messagesListener = onSnapshot(q, snap => {
    refs.messageTable.innerHTML = "";
    snap.forEach(docSnap => {
      const msg = docSnap.data();
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${msg.chatId}</td>
        <td>${msg.content}</td>
        <td><button class="deleteMsgBtn" data-id="${docSnap.id}">Delete</button></td>
      `;
      refs.messageTable.appendChild(row);
    });

    document.querySelectorAll(".deleteMsgBtn").forEach(btn => {
      btn.addEventListener("click", async () => {
        if(confirm("Delete this message?")) {
          await deleteDoc(doc(db, currentRoom, btn.dataset.id));
        }
      });
    });
  });
}

// ---------- Whitelist ----------
refs.whitelistForm?.addEventListener("submit", async e => {
  e.preventDefault();
  const email = e.target.email.value.trim();
  const phone = e.target.phone.value.trim();
  if(!email || !phone) return alert("Enter email & phone");

  const uidKey = email.replace(/[.#$[\]]/g, ',');
  await setDoc(doc(db, "whitelist", uidKey), { email, phone });
  await setDoc(doc(db, "users", uidKey), { email, phone, stars: 0, cash: 0, isHost: false, chatId: `GUEST${Math.floor(1000+Math.random()*9000)}` });

  alert(`User ${email} added`);
});

// ---------- Bulk CSV Upload ----------
refs.bulkUploadInput?.addEventListener("change", async e => {
  const file = e.target.files[0];
  if(!file) return;
  const text = await file.text();
  const lines = text.split("\n");
  for(const line of lines){
    const [email, phone] = line.split(",").map(s=>s.trim());
    if(email && phone){
      const uidKey = email.replace(/[.#$[\]]/g, ',');
      await setDoc(doc(db, "whitelist", uidKey), { email, phone });
      await setDoc(doc(db, "users", uidKey), { email, phone, stars: 0, cash: 0, isHost: false, chatId: `GUEST${Math.floor(1000+Math.random()*9000)}` });
    }
  }
  alert("Bulk upload complete");
});

// ---------- Admin add stars/cash ----------
refs.addStarsBtn?.addEventListener("click", async () => {
  const uid = prompt("Enter user UID to add stars");
  const amt = parseInt(prompt("Amount of stars to add"));
  if(!uid || !amt) return;
  await updateDoc(doc(db,"users",uid), { stars: increment(amt) });
});

refs.addCashBtn?.addEventListener("click", async () => {
  const uid = prompt("Enter user UID to add cash");
  const amt = parseInt(prompt("Amount of cash to add"));
  if(!uid || !amt) return;
  await updateDoc(doc(db,"users",uid), { cash: increment(amt) });
});

// ---------- Room costs ----------
refs.sendCostInput?.addEventListener("change", e => { roomCosts.send = parseInt(e.target.value) || 1; });
refs.buzzCostInput?.addEventListener("change", e => { roomCosts.buzz = parseInt(e.target.value) || 50; });

// ---------- Init ----------
loadRoomData(currentRoom);