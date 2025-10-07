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
let starInterval = null;
let lastMilestone = 0;

/* ---------- Constants ---------- */
const BUZZ_COST = 50;
const SEND_COST = 1;

/* ---------- Helpers ---------- */
function generateGuestName() {
  return "GUEST " + Math.floor(1000 + Math.random() * 9000);
}
function formatNumberWithCommas(n) {
  return new Intl.NumberFormat('en-NG').format(n || 0);
}
function randomColor() {
  const colors = ["#FFD700","#FF69B4","#87CEEB","#90EE90","#FFB6C1","#FFA07A","#8A2BE2","#00BFA6","#F4A460"];
  return colors[Math.floor(Math.random() * colors.length)];
}
function showStarPopup(text) {
  const popup = document.getElementById("starPopup");
  const starText = document.getElementById("starText");
  if (!popup || !starText) return;
  starText.innerText = text;
  popup.style.display = "block";
  setTimeout(() => { popup.style.display = "none"; }, 1700);
}
function sanitizeKey(key) {
  return key.replace(/[.#$[\]]/g, ',');
}

/* ---------- UI refs ---------- */
let refs = {};

/* ---------- Redeem link ---------- */
function updateRedeemLink() {
  if (refs.redeemBtn && currentUser) {
    refs.redeemBtn.href = `https://golalaland.github.io/chat/nushop.html?uid=${encodeURIComponent(currentUser.uid)}`;
    refs.redeemBtn.style.display = "inline-block";
  }
}

/* ---------- Presence ---------- */
function setupPresence(user) {
  if (!rtdb) return;
  const pRef = rtdbRef(rtdb, `presence/${ROOM_ID}/${sanitizeKey(user.uid)}`);
  rtdbSet(pRef, { online:true, chatId:user.chatId, email:user.email }).catch(()=>{});
  onDisconnect(pRef).remove().catch(()=>{});
}
if (rtdb) {
  onValue(rtdbRef(rtdb, `presence/${ROOM_ID}`), snap => {
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
let scrollPending = false;
function renderMessagesFromArray(arr){
  if (!refs.messagesEl) return;

  arr.forEach(item => {
    if (document.getElementById(item.id)) return;
    const m = item.data;
    const wrapper = document.createElement("div");
    wrapper.className = "msg";
    wrapper.id = item.id;

    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = (m.chatId || "Guest") + ":";
    meta.style.color = (m.uid && refs.userColors && refs.userColors[m.uid]) ? refs.userColors[m.uid] : '#fff';
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

  if (!scrollPending) {
    scrollPending = true;
    requestAnimationFrame(() => {
      const nearBottom = refs.messagesEl.scrollHeight - refs.messagesEl.scrollTop - refs.messagesEl.clientHeight < 50;
      if (arr.some(msg => msg.data.uid === currentUser?.uid) || nearBottom) {
        refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
      }
      scrollPending = false;
    });
  }
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

/* ---------- Chat ID modal ---------- */
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
        showStarPopup("Chat ID must be 3–12 characters");
        return;
      }
      const normalized = chosenID.toLowerCase();
      try{
        const q = query(collection(db,"users"), where("chatIdLower","==",normalized));
        const snap = await getDocs(q);
        let conflict = false;
        snap.forEach(docSnap => { if(docSnap.id !== userRef.id) conflict = true; });
        if(conflict){ showStarPopup("This Chat ID is taken"); return; }
        await updateDoc(userRef, { chatId: chosenID, chatIdLower: normalized });
        currentUser.chatId = chosenID;
        currentUser.chatIdLower = normalized;
      } catch(e){ console.error(e); showStarPopup("Failed to save ChatID"); return; }

      refs.chatIDModal.style.display = "none";
      if(refs.sendAreaEl) refs.sendAreaEl.style.display = "flex";
      showStarPopup(`Welcome ${currentUser.chatId}! 🎉`);
      resolve(chosenID);
    };
  });
}

/* ---------- VIP Login ---------- */
async function loginWhitelist(email, phone) {
  const loader = document.getElementById("postLoginLoader");
  try {
    if (loader) loader.style.display = "flex";
    await new Promise(res => setTimeout(res, 50));

    const q = query(collection(db, "whitelist"), where("email", "==", email), where("phone", "==", phone));
    const snap = await getDocs(q);
    if (snap.empty) {
      showStarPopup("You’re not on the whitelist.");
      return false;
    }

    const uidKey = sanitizeKey(email);
    const userRef = doc(db, "users", uidKey);
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
      showStarPopup("User not found. Sign up first.");
      return false;
    }

    const data = docSnap.data();
    currentUser = { ...data, uid: uidKey };
    lastMilestone = Math.floor((currentUser.stars || 0) / 1000) * 1000;

    updateRedeemLink();
    setupPresence(currentUser);
    attachMessagesListener();
    startStarEarning(uidKey);

    localStorage.setItem("vipUser", JSON.stringify({ email, phone }));

    if(currentUser.chatId?.startsWith("GUEST")) await promptForChatID(userRef, data);

    // Hide pre-login UI
    const helloEl = document.getElementById("helloText");
    if (helloEl) helloEl.style.display = "none";
    if (refs.authBox) refs.authBox.style.display = "none";

    // Show chat UI
    if (refs.sendAreaEl) refs.sendAreaEl.style.display = "flex";
    if (refs.profileBoxEl) refs.profileBoxEl.style.display = "block";
    if (refs.profileNameEl) { 
      refs.profileNameEl.innerText = currentUser.chatId; 
      refs.profileNameEl.style.color = currentUser.usernameColor; 
    }
    if (refs.starCountEl) refs.starCountEl.innerText = formatNumberWithCommas(currentUser.stars);
    if (refs.cashCountEl) refs.cashCountEl.innerText = formatNumberWithCommas(currentUser.cash);

    return true;
  } catch(e){
    console.error(e);
    showStarPopup("Login failed.");
    return false;
  } finally {
    if (loader) loader.style.display = "none";
  }
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
    if (Math.abs(diff) < 1) {
      displayedStars = target;
      refs.starCountEl.textContent = formatNumberWithCommas(displayedStars);
      return;
    }
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

    const milestone = Math.floor(targetStars / 1000) * 1000;
    if (milestone > lastMilestone && milestone > 0) {
      lastMilestone = milestone;
      showStarPopup(`🔥 Congrats! ${formatNumberWithCommas(milestone)} stars!`);
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
    if ((data.starsToday || 0) < 250) {
      await updateDoc(userRef, { stars: increment(10), starsToday: increment(10) });
    }
  }, 60000);
}

/* ---------- DOMContentLoaded ---------- */
window.addEventListener("DOMContentLoaded", () => {
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
    chatIDModal: document.getElementById("chatIDModal"),
    chatIDInput: document.getElementById("chatIDInput"),
    chatIDConfirmBtn: document.getElementById("chatIDConfirmBtn")
  };

  if(refs.chatIDInput) refs.chatIDInput.setAttribute("maxlength","12");

  /* ---------- VIP login ---------- */
  const emailInput = document.getElementById("emailInput");
  const phoneInput = document.getElementById("phoneInput");
  const loginBtn = document.getElementById("whitelistLoginBtn");

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const email = (emailInput.value || "").trim().toLowerCase();
      const phone = (phoneInput.value || "").trim();
      if (!email || !phone) return showStarPopup("Enter your email & phone");
      const success = await loginWhitelist(email, phone);
      if (success) updateRedeemLink();
    });
  }

  /* ---------- Auto-login ---------- */
  const vipUser = JSON.parse(localStorage.getItem("vipUser"));
  if (vipUser?.email && vipUser?.phone) {
    (async () => {
      const success = await loginWhitelist(vipUser.email, vipUser.phone);
      if (success) updateRedeemLink();
    })();
  }

  /* ---------- Send ---------- */
  refs.sendBtn?.addEventListener("click", async () => {
    if (!currentUser) return showStarPopup("Sign in to chat");
    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message first");
    if ((currentUser.stars || 0) < SEND_COST) return showStarPopup("Not enough stars");

    currentUser.stars -= SEND_COST;
    refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
    await updateDoc(doc(db, "users", currentUser.uid), { stars: increment(-SEND_COST) });

    const docRef = await addDoc(collection(db, CHAT_COLLECTION), {
      content: txt, uid: currentUser.uid, chatId: currentUser.chatId, timestamp: serverTimestamp()
    });

    refs.messageInputEl.value = "";
    renderMessagesFromArray([{ id: docRef.id, data: { content: txt, uid: currentUser.uid, chatId: currentUser.chatId } }]);
  });

  /* ---------- BUZZ ---------- */
  refs.buzzBtn?.addEventListener("click", async () => {
    if (!currentUser) return showStarPopup("Sign in to BUZZ");
    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message to BUZZ 🚨");

    const userRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(userRef);
    if ((snap.data()?.stars || 0) < BUZZ_COST) return showStarPopup("Not enough stars");

    await updateDoc(userRef, { stars: increment(-BUZZ_COST) });
    const buzzColor = randomColor();
    const docRef = await addDoc(collection(db, CHAT_COLLECTION), {
      content: txt, uid: currentUser.uid, chatId: currentUser.chatId,
      timestamp: serverTimestamp(), highlight: true, buzzColor
    });

    refs.messageInputEl.value = "";
    showStarPopup("BUZZ sent!");
    renderMessagesFromArray([{ id: docRef.id, data: { content: txt, uid: currentUser.uid, chatId: currentUser.chatId, highlight: true, buzzColor } }]);
  });

  /* ---------- Hello text rotation ---------- */
  const greetings = ["HELLO","HOLA","BONJOUR","CIAO","HALLO","こんにちは","你好","안녕하세요","SALUT","OLÁ","NAMASTE","MERHABA"];
  let helloIndex = 0;
  const helloEl = document.getElementById("helloText");
  setInterval(()=>{
    if(!helloEl || currentUser) return;
    helloEl.style.opacity='0';
    setTimeout(()=>{
      helloEl.innerText = greetings[helloIndex++ % greetings.length];
      helloEl.style.color = randomColor();
      helloEl.style.opacity='1';
    },220);
  },1500);
});

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
      currentVideoIndex = index;
      videoPlayer.src = videos[currentVideoIndex];
      videoPlayer.muted = true;
      videoPlayer.play().catch(()=>console.warn("Autoplay blocked"));
    }

    prevBtn?.addEventListener("click", ()=>loadVideo(currentVideoIndex-1));
    nextBtn?.addEventListener("click", ()=>loadVideo(currentVideoIndex+1));
    videoPlayer.addEventListener("click", ()=>{ videoPlayer.muted = !videoPlayer.muted; });

    let hideTimeout;
    function showButtons(){
      navButtons.forEach(btn=>{ btn.style.opacity="1"; btn.style.pointerEvents="auto"; });
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(()=>{ navButtons.forEach(btn=>{ btn.style.opacity="0"; btn.style.pointerEvents="none"; }); }, 3000);
    }

    navButtons.forEach(btn=>{ btn.style.transition="opacity 0.6s"; btn.style.opacity="0"; btn.style.pointerEvents="none"; });
    container?.addEventListener("mouseenter", showButtons);
    container?.addEventListener("mousemove", showButtons);
    container?.addEventListener("mouseleave", ()=>{ navButtons.forEach(btn=>{ btn.style.opacity="0"; btn.style.pointerEvents="none"; }); });
    container?.addEventListener("click", showButtons);

    loadVideo(0);
  }
});