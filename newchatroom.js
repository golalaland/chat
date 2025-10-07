// newchatroom.js
/* ---------- Imports (Firebase v10) ---------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, increment, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDatabase, ref as rtdbRef, set as rtdbSet, onDisconnect, onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ---------- Firebase config (your original values) ---------- */
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

/* ---------- Room & chat ---------- */
const ROOM_ID = "room5";
const CHAT_COLLECTION = "messages_room5";

/* ---------- State ---------- */
let currentUser = null;
let lastMessagesArray = [];
let starInterval = null;

/* ---------- Constants ---------- */
const BUZZ_COST = 50;
const SEND_COST = 1;

/* ---------- Helpers ---------- */
function generateGuestName() { return "GUEST " + Math.floor(1000 + Math.random()*9000); }
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
function escapeHtml(s) {
  return (s+'').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

/* ---------- UI refs (will populate on DOMContentLoaded) ---------- */
let refs = {};

/* ---------- Redeem link update ---------- */
function updateRedeemLink() {
  if (refs.redeemBtn && currentUser) {
    refs.redeemBtn.href = `https://golalaland.github.io/chat/shop.html?uid=${encodeURIComponent(currentUser.uid)}`;
    refs.redeemBtn.style.display = "inline-block";
  }
}

/* ---------- Presence ---------- */
function setupPresence(user){
  if (!rtdb || !user) return;
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

/* ---------- Twitch-style chat scroll helper & badge ---------- */
let userIsNearBottom = true;
function setupChatScrollWatcher(){
  if(!refs.messagesEl) return;
  refs.messagesEl.addEventListener('scroll', ()=>{
    const threshold = 60;
    userIsNearBottom = (refs.messagesEl.scrollHeight - refs.messagesEl.scrollTop - refs.messagesEl.clientHeight) < threshold;
    if (userIsNearBottom) {
      const badge = document.getElementById("newMsgBadge");
      if (badge) badge.style.display = "none";
    }
  });
}
function showNewMessageBadge(){
  let badge = document.getElementById("newMsgBadge");
  if(!badge){
    badge = document.createElement("div");
    badge.id = "newMsgBadge";
    badge.textContent = "New messages ↓";
    Object.assign(badge.style, {
      position: "fixed",
      bottom: "80px",
      right: "12px",
      background: "#ff4081",
      color: "#fff",
      padding: "8px 12px",
      borderRadius: "14px",
      cursor: "pointer",
      fontSize: "13px",
      display: "none",
      zIndex: "9999",
      boxShadow: "0 6px 18px rgba(0,0,0,0.4)"
    });
    document.body.appendChild(badge);
    badge.addEventListener('click', ()=>{
      if (refs.messagesEl) refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
      badge.style.display = "none";
    });
  }
  badge.style.display = "block";
}

/* ---------- Render messages (keeps your original look & integrates badge) ---------- */
let scrollPending = false;
function renderMessagesFromArray(arr){
  if (!refs.messagesEl) return;

  arr.forEach(item => {
    if (document.getElementById(item.id)) return;

    const m = item.data;
    const wrapper = document.createElement("div");
    wrapper.className = "msg";
    wrapper.id = item.id;

    if (m.uid && currentUser && m.uid === currentUser.uid) wrapper.classList.add("me");

    // USERNAME + BADGES
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.style.color = (m.uid && refs.userColors && refs.userColors[m.uid]) ? refs.userColors[m.uid] : '#ffffff';
    meta.style.marginRight = "6px";

    // Username text
    meta.textContent = (m.chatId || "Guest") + ": ";

    // BADGES (check refs.userBadges for this UID)
    if (m.uid && refs.userBadges && refs.userBadges[m.uid]) {
      const badges = refs.userBadges[m.uid]; // { star: true, verified: false, crown: true }

      if (badges.star) {
        const starImg = document.createElement("img");
        starImg.src = "https://cdn-icons-png.flaticon.com/512/1200/1200781.png"; // star
        starImg.style.width = "16px";
        starImg.style.height = "16px";
        starImg.style.marginLeft = "3px";
        meta.appendChild(starImg);
      }
      if (badges.verified) {
        const verifiedImg = document.createElement("img");
        verifiedImg.src = "https://cdn-icons-png.flaticon.com/512/5253/5253968.png"; // verified
        verifiedImg.style.width = "16px";
        verifiedImg.style.height = "16px";
        verifiedImg.style.marginLeft = "3px";
        meta.appendChild(verifiedImg);
      }
      if (badges.crown) {
        const crownImg = document.createElement("img");
        crownImg.src = "https://cdn-icons-png.flaticon.com/512/2545/2545603.png"; // crown
        crownImg.style.width = "16px";
        crownImg.style.height = "16px";
        crownImg.style.marginLeft = "3px";
        meta.appendChild(crownImg);
      }
    }

    // MESSAGE CONTENT
    const content = document.createElement("span");
    content.className = m.highlight || m.buzzColor ? "buzz-content content" : "content";
    content.textContent = " " + (m.content || "");
    if (m.buzzColor) content.style.background = m.buzzColor;
    if (m.highlight) { content.style.color = "#000"; content.style.fontWeight = "700"; }

    wrapper.appendChild(meta);
    wrapper.appendChild(content);
    refs.messagesEl.appendChild(wrapper);
  });

  // Auto-scroll logic with badge
  if (!scrollPending) {
    scrollPending = true;
    requestAnimationFrame(() => {
      const nearBottom = userIsNearBottom;
      if (arr.some(msg => msg.data.uid === currentUser?.uid) || nearBottom) {
        refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
      } else {
        showNewMessageBadge();
      }
      scrollPending = false;
    });
  }
}
/* ---------- Messages listener (keeps your original Firestore logic) ---------- */
function attachMessagesListener() {
  const q = query(collection(db, CHAT_COLLECTION), orderBy("timestamp", "asc"));
  onSnapshot(q, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === "added") {
        const msgData = change.doc.data();
        lastMessagesArray.push({ id: change.doc.id, data: msgData });
        renderMessagesFromArray([{ id: change.doc.id, data: msgData }]);
        // if my message, force scroll
        if (refs.messagesEl && currentUser && msgData.uid === currentUser.uid) {
          refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
        } else {
          // if message by someone else and user scrolled up, optionally play tick
          if (!userIsNearBottom) {
            const buzzAudio = document.getElementById("buzz-sound");
            if (buzzAudio) try { buzzAudio.play().catch(()=>{}); } catch(e){}
          }
        }
      }
    });
  });
}

/* ---------- ChatID modal (unchanged) ---------- */
async function promptForChatID(userRef, userData){
  if(!refs.chatIDModal || !refs.chatIDInput || !refs.chatIDConfirmBtn) return userData?.chatId || null;
  if(userData?.chatId && !userData.chatId.startsWith("GUEST")) return userData.chatId;

  refs.chatIDInput.value = "";
  refs.chatIDModal.style.display = "flex";
  if(refs.sendAreaEl) refs.sendAreaEl.style.display = "none";

  return new Promise(resolve=>{
    refs.chatIDConfirmBtn.onclick = async ()=>{
      const chosenID = refs.chatIDInput.value.trim();
      if(chosenID.length < 3 || chosenID.length > 12){ 
        alert("Chat ID must be 3-12 characters"); return; 
      }
      const normalized = chosenID.toLowerCase();
      try{
        const q = query(collection(db,"users"), where("chatIdLower","==",normalized));
        const snap = await getDocs(q);
        let conflict = false;
        snap.forEach(docSnap => { if(docSnap.id !== userRef.id) conflict = true; });
        if(conflict){ alert("This Chat ID is taken"); return; }
        await updateDoc(userRef, { chatId: chosenID, chatIdLower: normalized });
        currentUser.chatId = chosenID;
        currentUser.chatIdLower = normalized;
      } catch(e){ console.error(e); alert("Failed to save ChatID"); return; }

      refs.chatIDModal.style.display = "none";
      if(refs.sendAreaEl) refs.sendAreaEl.style.display = "flex";
      showStarPopup(`Welcome ${currentUser.chatId}! 🎉`);
      resolve(chosenID);
    };
  });
}

/* ---------- VIP login (whitelist) (unchanged logic, but hide UI after login) ---------- */
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

    // hide hello + sign-in prompt + auth wrappers
    const helloEl = document.getElementById("helloText");
    const roomSubtitleEl = document.getElementById("roomSubtitle");
    const emailAuthWrapper = document.getElementById("emailAuthWrapper");
    if (helloEl) helloEl.style.display = "none";
    if (roomSubtitleEl) roomSubtitleEl.style.display = "none";
    if (refs.authBox) refs.authBox.style.display = "none";
    if (emailAuthWrapper) emailAuthWrapper.style.display = "none";

    if(currentUser.chatId.startsWith("GUEST")) {
      await promptForChatID(userRef, data);
      if (refs.profileNameEl) { refs.profileNameEl.innerText = currentUser.chatId; refs.profileNameEl.style.color = currentUser.usernameColor; }
    }

    if (refs.sendAreaEl) refs.sendAreaEl.style.display = "flex";
    if (refs.profileBoxEl) refs.profileBoxEl.style.display = "block";
    if (refs.profileNameEl) { refs.profileNameEl.innerText = currentUser.chatId; refs.profileNameEl.style.color = currentUser.usernameColor; }
    if (refs.starCountEl) refs.starCountEl.innerText = formatNumberWithCommas(currentUser.stars);
    if (refs.cashCountEl) refs.cashCountEl.innerText = formatNumberWithCommas(currentUser.cash);
    if (refs.adminControlsEl) refs.adminControlsEl.style.display = currentUser.isAdmin ? "flex" : "none";

    return true;

  } catch(e) { console.error("Login error:", e); alert("Login failed. Try again."); return false; }
}

/* ---------- Stars auto-earning (unchanged) ---------- */
function startStarEarning(uid) {
  if (!uid) return;
  if (starInterval) clearInterval(starInterval); // clear existing
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

    if (currentUser.stars > 0 && currentUser.stars % 1000 === 0) {
      showStarPopup(`🔥 Congrats! You’ve reached ${formatNumberWithCommas(currentUser.stars)} stars!`);
    }
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

/* ---------- Video navigation & memory (integrated) ---------- */
function enableVideoPlayer() {
  const videoPlayer = document.getElementById("videoPlayer");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  if (!videoPlayer) return;

  // playlist (use your original urls)
  const videos = [
    "https://res.cloudinary.com/dekxhwh6l/video/upload/v1695/35a6ff0764563d1dcfaaaedac912b2c7_zfzxlw.mp4",
    "https://xixi.b-cdn.net/Petitie%20Bubble%20Butt%20Stripper.mp4",
    "https://xixi.b-cdn.net/Bootylicious%20Ebony%20Queen%20Kona%20Jade%20Twerks%20Teases%20and%20Rides%20POV%20u.mp4"
  ];
  let currentIndex = 0;

  function getVideoKey(url){ return `video-pos:${url}`; }

  // restore position on loadedmetadata
  videoPlayer.addEventListener('loadedmetadata', ()=>{
    try {
      const key = getVideoKey(videoPlayer.src);
      const saved = parseFloat(localStorage.getItem(key) || '0');
      if (!isNaN(saved) && saved > 2 && saved < videoPlayer.duration) {
        videoPlayer.currentTime = saved;
      }
    } catch(e){}
    // attempt play (muted) — browsers allow muted autoplay more reliably
    videoPlayer.play().catch(()=>{});
  });

  // save progress periodically
  let saveThrottle = null;
  videoPlayer.addEventListener('timeupdate', ()=>{
    if (saveThrottle) return;
    saveThrottle = setTimeout(()=>{
      try { localStorage.setItem(getVideoKey(videoPlayer.src), videoPlayer.currentTime); } catch(e){}
      saveThrottle = null;
    }, 1200);
  });
  window.addEventListener('beforeunload', ()=> {
    try { localStorage.setItem(getVideoKey(videoPlayer.src), videoPlayer.currentTime); } catch(e){}
  });

  function loadIndex(i){
    if(i < 0) i = videos.length - 1;
    if(i >= videos.length) i = 0;
    currentIndex = i;
    // Save previous video's time (already saved by timeupdate), then switch
    videoPlayer.muted = true;
    videoPlayer.src = videos[currentIndex];
    // .load() not necessary in <video> with src change, but safe:
    try { videoPlayer.load(); } catch(e){}
    // attempt autoplay
    videoPlayer.play().catch(()=>{});
  }

  prevBtn?.addEventListener('click', ()=> loadIndex(currentIndex - 1));
  nextBtn?.addEventListener('click', ()=> loadIndex(currentIndex + 1));

  // toggle mute on click for manual control
  videoPlayer.addEventListener('click', ()=> { videoPlayer.muted = !videoPlayer.muted; });

  // hover show arrows (basic)
  const container = document.querySelector(".video-container");
  const navButtons = [prevBtn, nextBtn].filter(Boolean);
  if (container && navButtons.length) {
    let hideTimeout;
    function showButtons(){
      navButtons.forEach(btn=>{ btn.style.opacity="1"; btn.style.pointerEvents="auto"; });
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(()=>{ navButtons.forEach(btn=>{ btn.style.opacity="0"; btn.style.pointerEvents="none"; }); }, 3000);
    }
    navButtons.forEach(btn=>{ btn.style.transition="opacity 0.4s"; btn.style.opacity="0"; btn.style.pointerEvents="none"; });
    container.addEventListener("mouseenter", showButtons);
    container.addEventListener("mousemove", showButtons);
    container.addEventListener("mouseleave", ()=>{ navButtons.forEach(btn=>{ btn.style.opacity="0"; btn.style.pointerEvents="none"; }); });
    container.addEventListener("click", showButtons);
  }

  // initial load
  loadIndex(0);
}

/* ---------- DOMContentLoaded: wire up UI event handlers ---------- */
window.addEventListener("DOMContentLoaded", () => {
  // populate refs
  refs = {
    authBox: document.getElementById("authBox"),
    messagesEl: document.getElementById("messages"),
    sendAreaEl: document.getElementById("sendArea"),
    messageInputEl: document.getElementById("messageInput"),
    sendBtn: document.getElementById("sendBtn"),
    buzzBtn: document.getElementById("buzzBtn"),
    profileBoxEl: document.getElementById("profileBox"),
    profileNameEl: document.getElementById("profileName"),
    starCountEl: document.getElementById("starCount"),
    cashCountEl: document.getElementById("cashCount"),
    redeemBtn: document.getElementById("redeemBtn"),
    onlineCountEl: document.getElementById("onlineCount"),
    adminControlsEl: document.getElementById("adminControls"),
    adminClearMessagesBtn: document.getElementById("adminClearMessagesBtn"),
    chatIDModal: document.getElementById("chatIDModal"),
    chatIDInput: document.getElementById("chatIDInput"),
    chatIDConfirmBtn: document.getElementById("chatIDConfirmBtn"),
    userColors: {}
  };

  setupChatScrollWatcher();
  enableAutoLogin();

  // button refs used in other places
  const emailInput = document.getElementById("emailInput");
  const phoneInput = document.getElementById("phoneInput");
  const loginBtn = document.getElementById("whitelistLoginBtn");
  const googleSignInBtn = document.getElementById("googleSignInBtn");
  const guestMsg = document.getElementById("guestMsg");

  // Wire send button (same logic as your earlier code)
  refs.sendBtn?.addEventListener("click", async ()=>{
    if (!currentUser) return showStarPopup("Sign in to chat");
    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message first");
    if ((currentUser.stars||0) < SEND_COST) return showStarPopup("Not enough stars to create a BUZZ!");

    currentUser.stars -= SEND_COST;
    if (refs.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);

    await updateDoc(doc(db,"users",currentUser.uid), { stars: increment(-SEND_COST) });
    const docRef = await addDoc(collection(db,CHAT_COLLECTION), {
      content: txt, uid: currentUser.uid, chatId: currentUser.chatId,
      timestamp: serverTimestamp(), highlight:false, buzzColor:null
    });
    refs.messageInputEl.value = "";

    // Render your own message immediately (optimistic)
    renderMessagesFromArray([{ id: docRef.id, data: { content: txt, uid: currentUser.uid, chatId: currentUser.chatId, timestamp: new Date() } }]);

    // Force scroll after paint
    requestAnimationFrame(() => {
      if (refs.messagesEl) refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
    });
  });

  // BUZZ handler
  refs.buzzBtn?.addEventListener("click", async ()=>{
    if (!currentUser) return showStarPopup("Sign in to BUZZ");
    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message to BUZZ 🚨");

    const userRef = doc(db,"users",currentUser.uid);
    const snap = await getDoc(userRef);
    if ((snap.data()?.stars||0) < BUZZ_COST) return showStarPopup("Not enough stars");

    await updateDoc(userRef, { stars: increment(-BUZZ_COST) });
    // choose a random buzz color for DB and rendering
    const bcolor = randomColor();
    const docRef = await addDoc(collection(db,CHAT_COLLECTION), {
      content: txt, uid: currentUser.uid, chatId: currentUser.chatId,
      timestamp: serverTimestamp(), highlight:true, buzzColor: bcolor
    });
    refs.messageInputEl.value = "";
    showStarPopup("BUZZ sent!");

    // play buzz sound
    const buzzAudio = document.getElementById("buzz-sound");
    if (buzzAudio) try { buzzAudio.currentTime = 0; buzzAudio.play().catch(()=>{}); } catch(e){}

    renderMessagesFromArray([{ id: docRef.id, data: { content: txt, uid: currentUser.uid, chatId: currentUser.chatId, highlight:true, buzzColor: bcolor } }]);

    requestAnimationFrame(() => {
      if (refs.messagesEl) refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
    });
  });

  // VIP login button
  if (loginBtn) {
    loginBtn.addEventListener("click", async ()=>{
      const email = (emailInput.value||"").trim().toLowerCase();
      const phone = (phoneInput.value||"").trim();
      if(!email || !phone){ alert("Enter your email and phone to get access"); return; }

      const success = await loginWhitelist(email, phone);
      if(success) updateRedeemLink();
    });
  }

  // Optional: google sign in hook (not implemented here — placeholder)
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener("click", ()=> {
      alert("Google sign-in placeholder: implement if you want social sign-in.");
    });
  }

  // Hello rotation (unchanged)
  const greetings = ["HELLO","HOLA","BONJOUR","CIAO","HALLO","こんにちは","你好","안녕하세요","SALUT","OLÁ","NAMASTE","MERHABA"];
  let helloIndex = 0;
  const helloEl = document.getElementById("helloText");
  setInterval(()=>{
    if(!helloEl) return;
    helloEl.style.opacity='0';
    setTimeout(()=>{
      helloEl.innerText = greetings[helloIndex++ % greetings.length];
      helloEl.style.color = randomColor();
      helloEl.style.opacity='1';
    },220);
  },1500);

  // Initialize video player (navigation + memory)
  enableVideoPlayer();

  // Setup chat scroll watcher for badge logic
  setupChatScrollWatcher();

  // If send area should be hidden until login, ensure visibility per currentUser
  const vipUser = JSON.parse(localStorage.getItem("vipUser") || 'null');
  if (vipUser?.email && vipUser?.phone) {
    // attempt auto-login via local storage credentials (your login flow)
    (async ()=>{
      const success = await loginWhitelist(vipUser.email, vipUser.phone);
      if (success) updateRedeemLink();
    })();
  }
});

/* ---------- Utility: auto-login helper used above ---------- */
function enableAutoLogin(){
  // just left as a placeholder; real auto-login triggered in DOMContentLoaded
}

/* ---------- Admin: clear messages (if present) ---------- */
async function adminClearMessages(){
  // Optional: you can implement batched delete logic with Firestore writeBatch if desired.
  // Not enabling by default for safety.
}

/* ---------- Final console log ---------- */
console.log("newchatroom.js loaded — chat, video memory, and twitch-scroll active.");