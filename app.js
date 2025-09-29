// app.js

/* ---------- Imports (Firebase v10) ---------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  increment,
  getDocs,
  writeBatch,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDatabase,
  ref as rtdbRef,
  set as rtdbSet,
  onDisconnect,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

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

/* ---------- Room Collection ---------- */
const ROOM_ID = "room5";
const CHAT_COLLECTION = "messages_room5";

/* ---------- State & constants ---------- */
let currentUser = null;
let userDocUnsub = null;
let messagesUnsub = null;
let usersUnsub = null;
let lastMessagesArray = [];

const BUZZ_COST = 50;
const AUTO_STAR_ADD = 1;
const DAILY_STAR_CAP = 500;
const SEND_COST = 1;

/* ---------- Helpers ---------- */
function generateGuestName(){
  return "GUEST " + Math.floor(1000 + Math.random()*9000);
}
function formatNumberWithCommas(n){
  return new Intl.NumberFormat('en-NG').format(n || 0);
}
function randomColor(){
  const colors = ["#FFD700","#FF69B4","#87CEEB","#90EE90","#FFB6C1","#FFA07A","#8A2BE2","#00BFA6","#F4A460"];
  return colors[Math.floor(Math.random()*colors.length)];
}
function showStarPopup(text){
  const popup = document.getElementById("starPopup");
  const starText = document.getElementById("starText");
  if (!popup || !starText) return;
  starText.innerText = text;
  popup.style.display = "block";
  setTimeout(()=>{ popup.style.display = "none"; }, 1700);
}

/* ---------- UI refs (will be assigned later) ---------- */
let refs = {
  authBox: null,
  messagesEl: null,
  sendAreaEl: null,
  messageInputEl: null,
  sendBtn: null,
  buzzBtn: null,
  profileBoxEl: null,
  profileNameEl: null,
  starCountEl: null,
  cashCountEl: null,
  redeemBtn: null,
  onlineCountEl: null,
  adminControlsEl: null,
  adminClearMessagesBtn: null,
  chatIDModal: null,
  chatIDInput: null,
  chatIDConfirmBtn: null
};

/* ---------- Presence ---------- */
function setupPresence(user){
  try {
    if (!rtdb) return;
    const pRef = rtdbRef(rtdb, `presence/${ROOM_ID}/${user.uid}`);
    rtdbSet(pRef, true).catch(()=>{});
    onDisconnect(pRef).remove().catch(()=>{});
  } catch(e){
    console.warn("presence error", e);
  }
}
if (rtdb){
  onValue(rtdbRef(rtdb, `presence/${ROOM_ID}`), snap=>{
    const val = snap.val() || {};
    if (refs.onlineCountEl) {
      refs.onlineCountEl.innerText = `(${Object.keys(val).length} online)`;
    }
  });
}

/* ---------- User color listener ---------- */
function setupUsersListener(){
  if (usersUnsub) usersUnsub();
  usersUnsub = onSnapshot(collection(db, "users"), snap=>{
    snap.forEach(d => {
      const data = d.data() || {};
      refs.userColors = refs.userColors || {};
      refs.userColors[d.id] = data.usernameColor || "#ffffff";
    });
    if (lastMessagesArray.length) {
      renderMessagesFromArray(lastMessagesArray);
    }
  });
}
setupUsersListener();

/* ---------- Chat ID modal ---------- */
async function promptForChatIDModal(userRef, userData){
  if (!refs.chatIDModal || !refs.chatIDInput || !refs.chatIDConfirmBtn) return userData?.chatId || null;
  if (userData?.chatId) return userData.chatId;
  refs.chatIDInput.value = "";
  refs.chatIDModal.style.display = "flex";
  if (refs.sendAreaEl) refs.sendAreaEl.style.display = "none";
  return new Promise((resolve) => {
    refs.chatIDConfirmBtn.onclick = async () => {
      const chosenID = refs.chatIDInput.value.trim();
      if (chosenID.length < 3 || chosenID.length > 12) {
        alert("Chat ID must be between 3 and 12 characters.");
        return;
      }
      const normalized = chosenID.toLowerCase();
      try {
        const q = query(collection(db, "users"), where("chatIdLower", "==", normalized));
        const snap = await getDocs(q);
        let conflict = false;
        snap.forEach(docSnap => {
          if (docSnap.id !== userRef.id) conflict = true;
        });
        if (conflict) {
          alert("This Chat ID is already taken. Choose another.");
          return;
        }
        await updateDoc(userRef, { chatId: chosenID, chatIdLower: normalized });
      } catch(e){
        console.error("Error saving chat ID:", e);
        alert("Failed to save. Try again.");
        return;
      }
      refs.chatIDModal.style.display = "none";
      if (refs.sendAreaEl) refs.sendAreaEl.style.display = "flex";
      location.reload();
      resolve(chosenID);
    };
  });
}

/* ---------- Hello text rotation ---------- */
const greetings = ["HELLO","HOLA","BONJOUR","CIAO","HALLO","こんにちは","你好","안녕하세요","SALUT","OLÁ","NAMASTE","MERHABA"];
let helloIndex = 0;
const helloEl = document.getElementById("helloText");
let helloInterval = null;
function rotateHello(){
  if (!helloEl) {
    if (helloInterval) clearInterval(helloInterval);
    return;
  }
  if (helloEl.style.display === "none") return;
  helloEl.style.opacity = '0';
  setTimeout(() => {
    helloEl.innerText = greetings[helloIndex++ % greetings.length];
    helloEl.style.color = randomColor();
    helloEl.style.opacity = '1';
  }, 220);
}
rotateHello();
helloInterval = setInterval(rotateHello, 1500);

/* ---------- Render messages ---------- */
function renderMessagesFromArray(arr){
  if (!refs.messagesEl) return;
  refs.messagesEl.innerHTML = "";
  arr.forEach(item => {
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
  refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
}

/* ---------- Attach messages listener ---------- */
function attachMessagesListener(){
  if (messagesUnsub) messagesUnsub();
  const q = query(collection(db, CHAT_COLLECTION), orderBy("timestamp", "asc"));
  messagesUnsub = onSnapshot(q, snapshot => {
    snapshot.docChanges().forEach(change => {
      const m = change.doc.data();
      if (change.type === "added") {
        lastMessagesArray.push({ id: change.doc.id, data: m });
        if (refs.messagesEl) {
          const wrapper = document.createElement("div");
          wrapper.className = "msg";
          wrapper.id = change.doc.id;

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
          refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
        }
      } else if (change.type === "modified") {
        const msgEl = document.getElementById(change.doc.id);
        if (msgEl) {
          const contentEl = msgEl.querySelector(".content");
          contentEl.className = m.highlight || m.buzzColor ? "buzz-content content" : "content";
          contentEl.textContent = " " + (m.content || "");
          contentEl.style.background = m.buzzColor || "";
          contentEl.style.color = m.highlight ? "#000" : "";
          contentEl.style.fontWeight = m.highlight ? "700" : "";
        }
        const idx = lastMessagesArray.findIndex(x => x.id === change.doc.id);
        if (idx >= 0) lastMessagesArray[idx].data = m;
      }
    });
  });
}

/* ---------- Login via whitelist (email + phone) ---------- */
async function loginWhitelist(email, phone) {
  try {
    const q = query(collection(db, "whitelist"), where("email", "==", email), where("phone", "==", phone));
    const snap = await getDocs(q);
    if (snap.empty) {
      alert("You’re not on the whitelist.");
      return false;
    }
    // treat email as UID
    const userRef = doc(db, "users", email);
    let docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
      await setDoc(userRef, {
        chatId: generateGuestName(),
        chatIdLower: generateGuestName().toLowerCase(),
        stars: 50,
        cash: 0,
        usernameColor: randomColor(),
        lastColorDate: new Date().toISOString().split("T")[0],
        isAdmin: false,
        email: email,
        phone: phone,
        createdAt: new Date()
      });
      showStarPopup("🎉 Your account created with 50 stars!");
      docSnap = await getDoc(userRef);
    }
    const userData = docSnap.exists()? docSnap.data() : {};
    currentUser = {
      uid: email,
      chatId: userData.chatId || email,
      chatIdLower: userData.chatIdLower || (userData.chatId || "").toLowerCase(),
      stars: userData.stars || 0,
      cash: userData.cash || 0,
      usernameColor: userData.usernameColor || randomColor(),
      isAdmin: userData.isAdmin || false
    };
    // Setup presence, listeners, etc.
    setupPresence({ uid: currentUser.uid });
    attachMessagesListener();
    // UI updates
    const authBox = document.getElementById("authBox");
    if (authBox) authBox.style.display = "none";
    if (refs.sendAreaEl) refs.sendAreaEl.style.display = "flex";
    if (refs.profileBoxEl) refs.profileBoxEl.style.display = "block";
    if (refs.profileNameEl) {
      refs.profileNameEl.innerText = currentUser.chatId;
      refs.profileNameEl.style.color = currentUser.usernameColor;
    }
    if (refs.starCountEl) refs.starCountEl.innerText = formatNumberWithCommas(currentUser.stars);
    if (refs.cashCountEl) refs.cashCountEl.innerText = formatNumberWithCommas(currentUser.cash);
    // Admin controls
    if (refs.adminControlsEl) {
      if (currentUser.isAdmin) refs.adminControlsEl.style.display = "flex";
      else refs.adminControlsEl.style.display = "none";
    }
    return true;
  } catch(e) {
    console.error("loginWhitelist error", e);
    alert("Login failed, check console.");
    return false;
  }
}

/* ---------- DOMContentLoaded: wire UI & events ---------- */
window.addEventListener("DOMContentLoaded", () => {
  // map DOM refs
  refs.authBox = document.getElementById("authBox");
  refs.messagesEl = document.getElementById("messages");
  refs.sendAreaEl = document.getElementById("sendArea");
  refs.messageInputEl = document.getElementById("messageInput");
  refs.sendBtn = document.getElementById("sendBtn");
  refs.buzzBtn = document.getElementById("buzzBtn");
  refs.profileBoxEl = document.getElementById("profileBox");
  refs.profileNameEl = document.getElementById("profileName");
  refs.starCountEl = document.getElementById("starCount");
  refs.cashCountEl = document.getElementById("cashCount");
  refs.redeemBtn = document.getElementById("redeemBtn");
  refs.onlineCountEl = document.getElementById("onlineCount");
  refs.adminControlsEl = document.getElementById("adminControls");
  refs.adminClearMessagesBtn = document.getElementById("adminClearMessagesBtn");
  refs.chatIDModal = document.getElementById("chatIDModal");
  refs.chatIDInput = document.getElementById("chatIDInput");
  refs.chatIDConfirmBtn = document.getElementById("chatIDConfirmBtn");
  if (refs.chatIDInput) refs.chatIDInput.setAttribute("maxlength","12");

  // Hello animation already started above

  // Send binding
  if (refs.sendBtn) {
    refs.sendBtn.addEventListener("click", async () => {
      if (!currentUser) { showStarPopup("Sign in to chat"); return; }
      const txt = refs.messageInputEl?.value.trim();
      if (!txt) { showStarPopup("Type a message first"); return; }
      if ((currentUser.stars || 0) < SEND_COST) {
        showStarPopup("Not enough stars to send a message"); return;
      }
      try {
        currentUser.stars -= SEND_COST;
        if (refs.starCountEl) refs.starCountEl.textContent = currentUser.stars;
        await updateDoc(doc(db, "users", currentUser.uid), {
          stars: increment(-SEND_COST)
        });
        await addDoc(collection(db, CHAT_COLLECTION), {
          content: txt,
          uid: currentUser.uid,
          chatId: currentUser.chatId,
          timestamp: serverTimestamp(),
          highlight: false,
          buzzColor: null
        });
        if (refs.messageInputEl) refs.messageInputEl.value = "";
      } catch(e) {
        console.error("Send failed", e);
        showStarPopup("Message failed to send");
        currentUser.stars += SEND_COST;
        if (refs.starCountEl) refs.starCountEl.textContent = currentUser.stars;
      }
    });
  }

  // Buzz binding
  if (refs.buzzBtn) {
    refs.buzzBtn.addEventListener("click", async () => {
      if (!currentUser) { showStarPopup("Sign in to BUZZ"); return; }
      const txt = refs.messageInputEl?.value.trim();
      if (!txt) { showStarPopup("Type a message to BUZZ! 🚨"); return; }
      try {
        const userRef = doc(db, "users", currentUser.uid);
        const snap = await getDoc(userRef);
        const data = snap.exists() ? snap.data() : {};
        const curr = data.stars || 0;
        if (curr < BUZZ_COST) {
          showStarPopup("Not enough stars to BUZZ!"); return;
        }
        await updateDoc(userRef, { stars: increment(-BUZZ_COST) });
        const color = randomColor();
        await addDoc(collection(db, CHAT_COLLECTION), {
          content: txt,
          uid: currentUser.uid,
          chatId: currentUser.chatId,
          timestamp: serverTimestamp(),
          highlight: true,
          buzzColor: color
        });
        if (refs.messageInputEl) refs.messageInputEl.value = "";
        // Optionally play a local buzzer sound if hosted
        showStarPopup("BUZZ sent!");
      } catch(e) {
        console.error("buzz failed", e);
        showStarPopup("BUZZ failed");
      }
    });
  }

  // Whitelist login button
  const emailInput = document.getElementById("emailInput");
  const phoneInput = document.getElementById("phoneInput");
  const loginBtn = document.getElementById("whitelistLoginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const email = (emailInput.value || "").trim().toLowerCase();
      const phone = (phoneInput.value || "").trim();
      if (!email || !phone) {
        alert("Enter both email and phone");
        return;
      }
      await loginWhitelist(email, phone);
    });
  }

  // Auto login if stored
  const vipUser = JSON.parse(localStorage.getItem("vipUser"));
  if (vipUser && vipUser.email && vipUser.phone) {
    loginWhitelist(vipUser.email, vipUser.phone);
  }

  // Admin clear messages binding
  if (refs.adminClearMessagesBtn) {
    refs.adminClearMessagesBtn.addEventListener("click", async () => {
      if (!confirm("Clear ALL messages?")) return;
      const snap = await getDocs(collection(db, CHAT_COLLECTION));
      const batch = writeBatch(db);
      snap.forEach(docSnap => {
        batch.delete(doc(db, CHAT_COLLECTION, docSnap.id));
      });
      await batch.commit();
      lastMessagesArray = [];
      if (refs.messagesEl) refs.messagesEl.innerHTML = "";
      showStarPopup("Chat cleared!");
    });
  }

/* ---------- Video navigation (fixed) ---------- */
const videoPlayer = document.getElementById("videoPlayer");
const videos = [
  "https://res.cloudinary.com/dekxhwh6l/video/upload/v1695/35a6ff0764563d1dcfaaaedac912b2c7_zfzxlw.mp4",
  "https://xixi.b-cdn.net/Petitie%20Bubble%20Butt%20Stripper.mp4",
  "https://xixi.b-cdn.net/Bootylicious%20Ebony%20Queen%20Kona%20Jade%20Twerks%20Teases%20and%20Rides%20POV%20u.mp4"];
let currentVideoIndex = 0;

function loadVideo(index) {
  if (!videoPlayer) return;
  if (index < 0) index = videos.length - 1;
  if (index >= videos.length) index = 0;
  currentVideoIndex = index;
  videoPlayer.src = videos[currentVideoIndex];
  videoPlayer.muted = true;
  videoPlayer.play().catch(() => { console.warn("Autoplay blocked"); });
}

// prev/next click
document.getElementById("prev")?.addEventListener("click", () => loadVideo(currentVideoIndex - 1));
document.getElementById("next")?.addEventListener("click", () => loadVideo(currentVideoIndex + 1));

// toggle mute on click
videoPlayer?.addEventListener("click", () => { 
  if(videoPlayer) videoPlayer.muted = !videoPlayer.muted; 
});

loadVideo(0);

// ---------- Auto fade logic ----------
document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("video-container");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  if (!container || !prevBtn || !nextBtn) return;

  // Transition setup
  prevBtn.style.transition = "opacity 0.6s ease";
  nextBtn.style.transition = "opacity 0.6s ease";

  // Show at start
  prevBtn.style.opacity = "1";
  nextBtn.style.opacity = "1";

  let hideTimeout;

  function showButtons() {
    prevBtn.style.opacity = "1";
    nextBtn.style.opacity = "1";
    prevBtn.style.pointerEvents = "auto";
    nextBtn.style.pointerEvents = "auto";

    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      prevBtn.style.opacity = "0";
      nextBtn.style.opacity = "0";
      prevBtn.style.pointerEvents = "none";
      nextBtn.style.pointerEvents = "none";
    }, 3000); // auto-hide after 3s
  }

  // Desktop: show on hover
  container.addEventListener("mouseenter", showButtons);
  container.addEventListener("mousemove", showButtons);
  container.addEventListener("mouseleave", () => {
    prevBtn.style.opacity = "0";
    nextBtn.style.opacity = "0";
  });

  // Mobile: show on tap
  container.addEventListener("click", showButtons);

  // Initial auto-hide
  hideTimeout = setTimeout(() => {
    prevBtn.style.opacity = "0";
    nextBtn.style.opacity = "0";
    prevBtn.style.pointerEvents = "none";
    nextBtn.style.pointerEvents = "none";
  }, 3000);
});
const video = document.getElementById("videoPlayer");
const navButtons = document.querySelectorAll(".arrow");
let fadeTimeout;

// hide nav buttons after 5.3s
function scheduleHideButtons() {
  clearTimeout(fadeTimeout);
  fadeTimeout = setTimeout(() => {
    navButtons.forEach(btn => btn.classList.add("hidden"));
  }, 5300);
}

// show nav buttons immediately when video touched/clicked
function showButtons() {
  navButtons.forEach(btn => btn.classList.remove("hidden"));
  scheduleHideButtons();
}

// Start the cycle when page loads
scheduleHideButtons();

// Listen for clicks/taps on the video
video.addEventListener("click", showButtons);
video.addEventListener("touchstart", showButtons);
