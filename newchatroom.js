// newchatroom.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, increment, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDatabase, ref as rtdbRef, set as rtdbSet, onDisconnect, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ---------- Firebase config ---------- */
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
const rtdb = getDatabase(app);

const ROOM_ID = "room5";
const CHAT_COLLECTION = "messages_room5";

let currentUser = null;
let lastMessagesArray = [];
let starInterval = null;

const BUZZ_COST = 50;
const SEND_COST = 1;

let refs = {};

function generateGuestName() { return "GUEST " + Math.floor(1000 + Math.random() * 9000); }
function formatNumberWithCommas(n) { return new Intl.NumberFormat('en-NG').format(n || 0); }
function randomColor() { 
  const colors = ["#FFD700","#FF69B4","#87CEEB","#90EE90","#FFB6C1","#FFA07A","#8A2BE2","#00BFA6","#F4A460"];
  return colors[Math.floor(Math.random()*colors.length)];
}
function showStarPopup(text) {
  const popup = document.getElementById("starPopup");
  const starText = document.getElementById("starText");
  if (!popup || !starText) return;
  starText.innerText = text;
  popup.style.display = "block";
  setTimeout(() => { popup.style.display = "none"; }, 1700);
}
function sanitizeKey(key) { return key.replace(/[.#$[\]]/g, ','); }

/* ---------- Redeem link update ---------- */
function updateRedeemLink() {
  if (refs.redeemBtn && currentUser) {
    refs.redeemBtn.href = `https://golalaland.github.io/chat/shop.html?uid=${encodeURIComponent(currentUser.uid)}`;
    refs.redeemBtn.style.display = "inline-block";
  }
}

/* ---------- Presence ---------- */
function setupPresence(user){
  if (!rtdb) return;
  const pRef = rtdbRef(rtdb, `presence/${ROOM_ID}/${sanitizeKey(user.uid)}`);
  rtdbSet(pRef, { online:true, chatId:user.chatId, email:user.email }).catch(()=>{});
  onDisconnect(pRef).remove().catch(()=>{});
}
if (rtdb){
  onValue(rtdbRef(rtdb, `presence/${ROOM_ID}`), snap=>{
    const val = snap.val() || {};
    if (refs.onlineCountEl) refs.onlineCountEl.innerText = `(${Object.keys(val).length} online)`;
  });
}

/* ---------- Users color listener ---------- */
function setupUsersListener(){
  onSnapshot(collection(db, "users"), snap=>{
    refs.userColors = refs.userColors || {};
    snap.forEach(d => {
      refs.userColors[d.id] = d.data()?.usernameColor || "#ffffff";
    });
    if (lastMessagesArray.length) renderMessagesFromArray(lastMessagesArray);
  });
}
setupUsersListener();

/* ---------- Render messages with twitch scroll logic ---------- */
function renderMessagesFromArray(arr, isOwnMessage=false){
  if (!refs.messagesEl) return;

  const nearBottom = refs.messagesEl.scrollHeight - refs.messagesEl.scrollTop - refs.messagesEl.clientHeight < 50;

  arr.forEach(item => {
    if (document.getElementById(item.id)) return;
    const m = item.data;
    const wrapper = document.createElement("div");
    wrapper.className = "msg";
    wrapper.id = item.id;

    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = (m.chatId || "Guest") + ":";
    meta.style.color = (m.uid && refs.userColors && refs.userColors[m.uid]) ? refs.userColors[m.uid] : '#ffffff';
    meta.style.marginRight = "4px";

    const content = document.createElement("span");
    content.className = m.highlight || m.buzzColor ? "buzz-content content" : "content";
    content.textContent = " " + (m.content || "");
    if (m.buzzColor) content.style.background = m.buzzColor;
    if (m.highlight) { content.style.color = "#000"; content.style.fontWeight = "700"; }

    wrapper.appendChild(meta);
    wrapper.appendChild(content);
    refs.messagesEl.appendChild(wrapper);
  });

  requestAnimationFrame(() => {
    if (isOwnMessage || nearBottom) refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
  });
}

/* ---------- Messages listener ---------- */
function attachMessagesListener() {
  const q = query(collection(db, CHAT_COLLECTION), orderBy("timestamp", "asc"));
  onSnapshot(q, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const msgData = change.doc.data();
        lastMessagesArray.push({ id: change.doc.id, data: msgData });
        renderMessagesFromArray([{ id: change.doc.id, data: msgData }]);
      }
    });
  });
}

/* ---------- VIP login ---------- */
async function loginWhitelist(email, phone) {
  try {
    const q = query(collection(db, "whitelist"), where("email","==",email), where("phone","==",phone));
    const snap = await getDocs(q);
    if (snap.empty) { alert("You’re not on the whitelist."); return false; }

    const uidKey = sanitizeKey(email);
    const userRef = doc(db, "users", uidKey);
    let docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      const guestName = generateGuestName();
      await setDoc(userRef, {
        chatId: guestName,
        chatIdLower: guestName.toLowerCase(),
        stars: 50,
        starsToday: 0,
        lastStarDate: new Date().toISOString().split("T")[0],
        cash: 0,
        usernameColor: randomColor(),
        isAdmin: false,
        email,
        phone,
        createdAt: new Date()
      });
      showStarPopup("🎉 Your account created with 50 stars!");
      docSnap = await getDoc(userRef);
    }

    const data = docSnap.data() || {};
    currentUser = {
      uid: uidKey,
      email,
      phone,
      chatId: data.chatId || email,
      chatIdLower: data.chatIdLower || (data.chatId || "").toLowerCase(),
      stars: data.stars || 0,
      cash: data.cash || 0,
      usernameColor: data.usernameColor || randomColor(),
      isAdmin: data.isAdmin || false
    };

    updateRedeemLink();
    setupPresence(currentUser);
    attachMessagesListener();
    try { startStarEarning(currentUser.uid); } catch(e){ console.warn("star earning init failed", e); }

    localStorage.setItem("vipUser", JSON.stringify({ email, phone }));

    // Hide sign-in elements
    if(refs.authBox) refs.authBox.style.display = "none";
    const signInText = document.getElementById("signInText");
    if(signInText) signInText.style.display = "none";

    return true;

  } catch(e) { console.error("Login error:", e); alert("Login failed. Try again."); return false; }
}

/* ---------- Stars auto-earning ---------- */
function startStarEarning(uid) {
  if (!uid) return;
  if (starInterval) clearInterval(starInterval);

  const userRef = doc(db, "users", uid);
  let displayedStars = currentUser.stars || 0;
  let animationTimeout = null;

  function updateStarDisplay(target) {
    if (!refs.starCountEl) return;
    const diff = target - displayedStars;
    if (Math.abs(diff) < 1) { displayedStars = target; refs.starCountEl.textContent = formatNumberWithCommas(displayedStars); return; }
    displayedStars += diff * 0.3;
    refs.starCountEl.textContent = formatNumberWithCommas(Math.floor(displayedStars));
    animationTimeout = setTimeout(() => updateStarDisplay(target), 50);
  }

  onSnapshot(userRef, snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    const targetStars = data.stars || 0;
    currentUser.stars = targetStars;

    if (animationTimeout) clearTimeout(animationTimeout);
    updateStarDisplay(targetStars);
  });

  starInterval = setInterval(async () => {
    if (!navigator.onLine) return;
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const today = new Date().toISOString().split("T")[0];

    if (data.lastStarDate !== today) {
      await updateDoc(userRef, { starsToday: 0, lastStarDate: today });
      return;
    }
    if ((data.starsToday || 0) < 250) await updateDoc(userRef, { stars: increment(10), starsToday: increment(10) });
  }, 60000);

  window.addEventListener("beforeunload", () => clearInterval(starInterval));
}

/* ---------- DOMContentLoaded ---------- */
window.addEventListener("DOMContentLoaded", () => {
  refs = {
    authBox: document.getElementById("authBox"),
    emailInput: document.getElementById("emailInput"),
    phoneInput: document.getElementById("phoneInput"),
    loginBtn: document.getElementById("whitelistLoginBtn"),
    messagesEl: document.getElementById("messages"),
    sendAreaEl: document.getElementById("sendArea"),
    messageInputEl: document.getElementById("messageInput"),
    sendBtn: document.getElementById("sendBtn"),
    buzzBtn: document.getElementById("buzzBtn"),
    starCountEl: document.getElementById("starCount"),
    redeemBtn: document.getElementById("redeemBtn")
  };

  // Login button
  refs.loginBtn?.addEventListener("click", async ()=>{
    const email = (refs.emailInput.value||"").trim().toLowerCase();
    const phone = (refs.phoneInput.value||"").trim();
    if(!email || !phone){ alert("Enter your email and phone"); return; }
    await loginWhitelist(email, phone);
    updateRedeemLink();
  });

  // Auto-login session
  const vipUser = JSON.parse(localStorage.getItem("vipUser"));
  if(vipUser?.email && vipUser?.phone) loginWhitelist(vipUser.email, vipUser.phone);

  // Send message
  refs.sendBtn?.addEventListener("click", async ()=>{
    if (!currentUser) return showStarPopup("Sign in to chat");
    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message first");

    const isFree = currentUser.isAdmin;
    if(!isFree && (currentUser.stars||0)<SEND_COST) return showStarPopup("Not enough stars!");
    if(!isFree) { currentUser.stars -= SEND_COST; refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars); await updateDoc(doc(db,"users",currentUser.uid), { stars: increment(-SEND_COST) }); }

    const docRef = await addDoc(collection(db,CHAT_COLLECTION), {
      content: txt, uid: currentUser.uid, chatId: currentUser.chatId,
      timestamp: serverTimestamp(), highlight:false, buzzColor:null
    });
    refs.messageInputEl.value = "";
    renderMessagesFromArray([{ id: docRef.id, data: { content: txt, uid: currentUser.uid, chatId: currentUser.chatId } }], true);
  });

  // Buzz
  refs.buzzBtn?.addEventListener("click", async ()=>{
    if (!currentUser) return showStarPopup("Sign in to BUZZ");
    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message to BUZZ 🚨");

    const userRef = doc(db,"users",currentUser.uid);
    const snap = await getDoc(userRef);
    if ((snap.data()?.stars||0)<BUZZ_COST) return showStarPopup("Not enough stars");

    await updateDoc(userRef, { stars: increment(-BUZZ_COST) });
    const docRef = await addDoc(collection(db,CHAT_COLLECTION), {
      content: txt, uid: currentUser.uid, chatId: currentUser.chatId,
      timestamp: serverTimestamp(), highlight:true, buzzColor: randomColor()
    });
    refs.messageInputEl.value = "";
    showStarPopup("BUZZ sent!");
    renderMessagesFromArray([{ id: docRef.id, data: { content: txt, uid: currentUser.uid, chatId: currentUser.chatId, highlight:true, buzzColor: randomColor() } }], true);
  });

});