// app.js

/* ---------- Imports (Firebase v10) ---------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, increment, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDatabase, ref as rtdbRef, set as rtdbSet, onDisconnect, onValue
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

/* ---------- Room & chat ---------- */
const ROOM_ID = "room5";
const CHAT_COLLECTION = "messages_room5";

/* ---------- State ---------- */
let currentUser = null;
let lastMessagesArray = [];

// ⭐ ADD THIS LINE HERE
let starInterval = null;

/* ---------- Constants ---------- */
const BUZZ_COST = 50;
const SEND_COST = 1;

/* ---------- Helpers ---------- */
function generateGuestName(){ return "GUEST " + Math.floor(1000 + Math.random()*9000); }
function formatNumberWithCommas(n){ return new Intl.NumberFormat('en-NG').format(n || 0); }
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
function sanitizeKey(key){ return key.replace(/[.#$[\]]/g, ','); }

/* ---------- UI refs ---------- */
let refs = {};

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

/* ---------- Render messages ---------- */
function renderMessagesFromArray(arr){
  if (!refs.messagesEl) return;
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
  if(refs.messagesEl) refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
}

/* ---------- Attach messages listener ---------- */
function attachMessagesListener(){
  const q = query(collection(db, CHAT_COLLECTION), orderBy("timestamp", "asc"));
  onSnapshot(q, snapshot => {
    snapshot.docChanges().forEach(change => {
      const m = change.doc.data();
      if (change.type === "added") {
        lastMessagesArray.push({ id: change.doc.id, data: m });
        renderMessagesFromArray([ { id: change.doc.id, data: m } ]);
      }
    });
  });
}

/* ---------- ChatID modal ---------- */
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
        alert("Chat ID must be 3-12 characters"); 
        return; 
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

/* ---------- Login ---------- */
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
        stars: 50, cash:0, usernameColor: randomColor(),
        lastColorDate: new Date().toISOString().split("T")[0],
        isAdmin: false, email, phone, createdAt: new Date()
      });
      showStarPopup("🎉 Your account created with 50 stars!");
      docSnap = await getDoc(userRef);
    }

    const data = docSnap.data() || {};
    currentUser = {
      uid: uidKey,
      email, phone,
      chatId: data.chatId || email,
      chatIdLower: data.chatIdLower || (data.chatId || "").toLowerCase(),
      stars: data.stars || 0,
      cash: data.cash || 0,
      usernameColor: data.usernameColor || randomColor(),
      isAdmin: data.isAdmin || false
    };

    setupPresence(currentUser);
    attachMessagesListener();
startStarEarning(currentUser.uid);
    // Persist session
    localStorage.setItem("vipUser", JSON.stringify({ email, phone }));

    // One-time ChatID modal
    if(currentUser.chatId.startsWith("GUEST")) {
      await promptForChatID(userRef, data);
    }
    
// Hide login fields
const emailAuthWrapper = document.getElementById("emailAuthWrapper");
if (emailAuthWrapper) emailAuthWrapper.style.display = "none";

    // UI updates
    if (refs.authBox) refs.authBox.style.display = "none";
    if (refs.sendAreaEl) refs.sendAreaEl.style.display = "flex";
    if (refs.profileBoxEl) refs.profileBoxEl.style.display = "block";
    if (refs.profileNameEl) { refs.profileNameEl.innerText = currentUser.chatId; refs.profileNameEl.style.color = currentUser.usernameColor; }
    if (refs.starCountEl) refs.starCountEl.innerText = formatNumberWithCommas(currentUser.stars);
    if (refs.cashCountEl) refs.cashCountEl.innerText = formatNumberWithCommas(currentUser.cash);
    if (refs.adminControlsEl) refs.adminControlsEl.style.display = currentUser.isAdmin ? "flex" : "none";

    return true;

  } catch(e){ console.error("login error", e); alert("Login failed"); return false; }
}


/* ---------- Stars auto-earning ---------- */
function startStarEarning(uid) {
  if (!uid) return;

  const userRef = doc(db, "users", uid);

  // Live sync stars + daily reset
  onSnapshot(userRef, snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    const today = new Date().toISOString().split("T")[0];

    // Reset daily stars if new day
    if (data.lastStarDate !== today) {
      updateDoc(userRef, { starsToday: 0, lastStarDate: today }).catch(()=>{});
    }

    // Update UI whenever stars change
    currentUser.stars = data.stars || 0;
    if (refs.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);

    // 🎉 Milestone popup every 1,000 stars
    if (currentUser.stars > 0 && currentUser.stars % 1000 === 0) {
      showStarPopup(`🔥 Congrats! You’ve reached ${formatNumberWithCommas(currentUser.stars)} stars!`);
    }
  });

  // Increment stars every 60s, only if online
  setInterval(async () => {
    if (!navigator.onLine) return; // stop incrementing if offline

    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const today = new Date().toISOString().split("T")[0];
    const starsToday = data.starsToday || 0;

    // Reset daily stars if new day
    if (data.lastStarDate !== today) {
      await updateDoc(userRef, { starsToday: 0, lastStarDate: today });
      return;
    }

    // Add 10 stars if under daily cap
    if (starsToday < 200) {
      await updateDoc(userRef, {
        stars: increment(10),
        starsToday: increment(10),
        lastStarDate: today
      });
    }
  }, 60000); // every 60 seconds
}

  // Start incrementing only when page is visible
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && !intervalId) {
      intervalId = setInterval(updateStars, 60000);
      updateStars(); // immediate first run
    } else if (document.visibilityState === "hidden" && intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  });

  // Also start immediately if page is already visible
  if (document.visibilityState === "visible") {
    intervalId = setInterval(updateStars, 60000);
    updateStars();
  }
}

/* ---------- DOMContentLoaded ---------- */
window.addEventListener("DOMContentLoaded", () => {

  // Map UI refs
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
    chatIDConfirmBtn: document.getElementById("chatIDConfirmBtn")
  };
  if(refs.chatIDInput) refs.chatIDInput.setAttribute("maxlength","12");

  /* ---------- VIP login button ---------- */
  const emailInput = document.getElementById("emailInput");
  const phoneInput = document.getElementById("phoneInput");
  const loginBtn = document.getElementById("whitelistLoginBtn");

  if(loginBtn){
    loginBtn.addEventListener("click", async ()=>{
      const email = (emailInput.value||"").trim().toLowerCase();
      const phone = (phoneInput.value||"").trim();
      if(!email || !phone){ alert("Enter your email and phone to get access"); return; }

      await loginWhitelist(email, phone);
    });
  }

  /* ---------- Auto-login from session ---------- */
  const vipUser = JSON.parse(localStorage.getItem("vipUser"));
  if(vipUser?.email && vipUser?.phone){
    (async ()=>{
      await loginWhitelist(vipUser.email, vipUser.phone);
    })();
  }

  /* ---------- Send & Buzz ---------- */
  refs.sendBtn?.addEventListener("click", async ()=>{
    if (!currentUser) return showStarPopup("Sign in to chat");
    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message first");
    if ((currentUser.stars||0)<SEND_COST) return showStarPopup("Not enough stars to create a BUZZ!");

    currentUser.stars -= SEND_COST;
    refs.starCountEl.textContent = currentUser.stars;

    await updateDoc(doc(db,"users",currentUser.uid), { stars: increment(-SEND_COST) });
    await addDoc(collection(db,CHAT_COLLECTION), {
      content: txt, uid: currentUser.uid, chatId: currentUser.chatId,
      timestamp: serverTimestamp(), highlight:false, buzzColor:null
    });
    refs.messageInputEl.value = "";
  });

  refs.buzzBtn?.addEventListener("click", async ()=>{
    if (!currentUser) return showStarPopup("Sign in to BUZZ");
    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message to BUZZ 🚨");

    const userRef = doc(db,"users",currentUser.uid);
    const snap = await getDoc(userRef);
    if ((snap.data()?.stars||0)<BUZZ_COST) return showStarPopup("Not enough stars");

    await updateDoc(userRef, { stars: increment(-BUZZ_COST) });
    await addDoc(collection(db,CHAT_COLLECTION), {
      content: txt, uid: currentUser.uid, chatId: currentUser.chatId,
      timestamp: serverTimestamp(), highlight:true, buzzColor: randomColor()
    });
    refs.messageInputEl.value = "";
    showStarPopup("BUZZ sent!");
  });

  /* ---------- Hello text rotation ---------- */
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

  /* ---------- Video nav & fade ---------- */
  const videoPlayer = document.getElementById("videoPlayer");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const container = document.querySelector(".video-container");
  const navButtons = [prevBtn,nextBtn].filter(Boolean);

  if(videoPlayer && navButtons.length){
    const videos = [
      "https://res.cloudinary.com/dekxhwh6l/video/upload/v1695/35a6ff0764563d1dcfaaaedac912b2c7_zfzxlw.mp4",
      "https://xixi.b-cdn.net/Petitie%20Bubble%20Butt%20Stripper.mp4",
      "https://xixi.b-cdn.net/Bootylicious%20Ebony%20Queen%20Kona%20Jade%20Twerks%20Teases%20and%20Rides%20POV%20u.mp4"
    ];
    let currentVideoIndex = 0;

    function loadVideo(index){
      if(index<0) index = videos.length-1;
      if(index>=videos.length) index = 0;
      currentVideoIndex=index;
      videoPlayer.src=videos[currentVideoIndex];
      videoPlayer.muted=true;
      videoPlayer.play().catch(()=>console.warn("Autoplay blocked"));
    }

    prevBtn?.addEventListener("click", ()=>loadVideo(currentVideoIndex-1));
    nextBtn?.addEventListener("click", ()=>loadVideo(currentVideoIndex+1));

    videoPlayer.addEventListener("click", ()=>{ videoPlayer.muted = !videoPlayer.muted; });

    let hideTimeout;
    function showButtons(){
      navButtons.forEach(btn=>{ btn.style.opacity="1"; btn.style.pointerEvents="auto"; });
      clearTimeout(hideTimeout);
      hideTimeout=setTimeout(()=>{ navButtons.forEach(btn=>{ btn.style.opacity="0"; btn.style.pointerEvents="none"; }); },3000);
    }
    navButtons.forEach(btn=>{ btn.style.transition="opacity 0.6s"; btn.style.opacity="0"; btn.style.pointerEvents="none"; });
    container?.addEventListener("mouseenter", showButtons);
    container?.addEventListener("mousemove", showButtons);
    container?.addEventListener("mouseleave", ()=>{ navButtons.forEach(btn=>{ btn.style.opacity="0"; btn.style.pointerEvents="none"; }); });
    container?.addEventListener("click", showButtons);

    loadVideo(0);
  }

});
