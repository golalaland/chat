/* ---------- Imports (Firebase v10) ---------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp,
  onSnapshot
  , query, orderBy, increment, getDocs, where
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

async function showGiftModal(targetUid, targetData) {
  const modal = document.getElementById("giftModal");
  const titleEl = document.getElementById("giftModalTitle");
  const amountInput = document.getElementById("giftAmountInput");
  const confirmBtn = document.getElementById("giftConfirmBtn");
  const closeBtn = document.getElementById("giftModalClose");

  if (!modal || !titleEl || !amountInput || !confirmBtn) return;
  titleEl.textContent = `Gift ${targetData.chatId} stars ⭐️`;
  amountInput.value = "";

  modal.style.display = "flex";

  const close = () => modal.style.display = "none";
  closeBtn.onclick = close;
  modal.onclick = e => { if (e.target === modal) close(); };

  confirmBtn.onclick = async () => {
    const amt = parseInt(amountInput.value);
    if (!amt || amt <= 0) return alert("Enter a valid amount");
    if ((currentUser?.stars || 0) < amt) return showStarPopup("Not enough stars 💫");

    const fromRef = doc(db, "users", currentUser.uid);
    const toRef = doc(db, "users", targetUid);

    await updateDoc(fromRef, { stars: increment(-amt), starsGifted: increment(amt) });
    await updateDoc(toRef, { stars: increment(amt) });

    // Optional: Send a system chat message visible to both
    await addDoc(collection(db, CHAT_COLLECTION), {
  content: `${currentUser.chatId} gifted ${targetData.chatId} ${amt} ⭐️`,
  uid: "balleralert",
  chatId: "BallerAlert🤩",
  timestamp: serverTimestamp(),
  highlight: true,
  buzzColor: "#FFD700"
});

    showStarPopup(`You sent ${amt} ⭐️ to ${targetData.chatId}!`);
    close();
  };
}

/* ---------- Gift Alert (Live Floating Popup) ---------- */
function showGiftAlert(text) {
  const alertEl = document.getElementById("giftAlert");
  if (!alertEl) return;
  alertEl.textContent = text;
  alertEl.classList.add("show");

  createFloatingStars();

  setTimeout(() => alertEl.classList.remove("show"), 4000);
}

function createFloatingStars() {
  for (let i = 0; i < 6; i++) {
    const star = document.createElement("div");
    star.textContent = "⭐️";
    star.className = "floating-star";
    document.body.appendChild(star);
    star.style.left = `${50 + (Math.random() * 100 - 50)}%`;
    star.style.top = "45%";
    star.style.fontSize = `${16 + Math.random() * 16}px`;
    setTimeout(() => star.remove(), 2000);
  }
}
/* ---------- UI refs ---------- */
let refs = {};

/* ---------- Redeem link update ---------- */
function updateRedeemLink() {
  if (refs.redeemBtn && currentUser) {
    refs.redeemBtn.href = `https://golalaland.github.io/chat/nushop.html?uid=${encodeURIComponent(currentUser.uid)}`;
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
   meta.innerHTML = `<span class="chat-username" data-username="${m.uid}">${m.chatId || "Guest"}</span>:`;
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

        /* 💝 Detect private gift message (sender + receiver only, personalized) */
        if (
          msgData.uid === "system" &&
          msgData.highlight &&
          msgData.content.includes("gifted")
        ) {
          const myChatId = currentUser?.chatId?.toLowerCase();
          const content = msgData.content.toLowerCase();

          // Find both sender & receiver usernames
          const [sender, , receiver, amount] = msgData.content.split(" ");
          // Example: ["Nushi", "gifted", "Goll", "50"]

          if (!myChatId) return;

          if (sender.toLowerCase() === myChatId) {
            // 🫶 You are the sender
            showGiftAlert(`You gifted ${receiver} ${amount} ⭐️`);
          } else if (receiver.toLowerCase() === myChatId) {
            // 💝 You are the receiver
            showGiftAlert(`${sender} gifted you ${amount} ⭐️`);
          }
        }

        // 🌀 Keep scroll for your own messages
        if (refs.messagesEl && currentUser && msgData.uid === currentUser.uid) {
          refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
        }
      }
    });
  });
}
/* ---------- User Popup Logic ---------- */
async function showUserPopup(uidKey) {
  const popup = document.getElementById("userPopup");
  const popupContent = popup.querySelector(".user-popup-content");
  const popupUsername = document.getElementById("popupUsername");
  const popupGender = document.getElementById("popupGender");
  const socialsEl = document.getElementById("popupSocials");
  const closeBtn = document.getElementById("popupCloseBtn");
  const photoEl = popup.querySelector(".popup-photo");

  const userRef = doc(db, "users", uidKey);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return alert("User not found");

  const data = snap.data();

  // Username
  popupUsername.textContent = data.chatId || "Unknown";
  popupUsername.style.color = data.usernameColor || "#fff";

  // Gender / Age
 const age = parseInt(data.age || 0);
let ageGroup = "20s";
if (!isNaN(age) && age >= 30) ageGroup = "30s";
popupGender.textContent = `A ${data.gender || "user"} in their ${ageGroup}`;

  // Profile photo
  if (data.photoURL) {
    photoEl.innerHTML = `<img src="${data.photoURL}" alt="Profile">`;
  } else {
    const initials = (data.chatId || "U").slice(0,2).toUpperCase();
    photoEl.textContent = initials;
    photoEl.style.background = data.usernameColor || "#333";
  }

  // Social icons (only show if user has value)
  const socials = [
    { field: "instagram", icon: "https://cdn-icons-png.flaticon.com/512/174/174855.png" },
    { field: "telegram", icon: "https://cdn-icons-png.flaticon.com/512/2111/2111646.png" },
    { field: "tiktok", icon: "https://cdn-icons-png.flaticon.com/512/3046/3046122.png" },
    { field: "whatsapp", icon: "https://cdn-icons-png.flaticon.com/512/733/733585.png" }
  ];

  socialsEl.innerHTML = "";
  socials.forEach(s => {
    const val = data[s.field] || "";
    if (!val) return; // skip empty
    const a = document.createElement("a");
    a.href = val.startsWith("http") ? val : "#";
    a.target = "_blank";
    a.innerHTML = `<img src="${s.icon}" alt="${s.field}" style="width:28px;height:28px;border-radius:6px;">`;
    socialsEl.appendChild(a);
  });
// Gift button
const oldGiftBtn = popupContent.querySelector(".gift-btn");
if (oldGiftBtn) oldGiftBtn.remove();

const giftBtn = document.createElement("button");
giftBtn.className = "gift-btn";
giftBtn.textContent = `🎁 Gift ${data.chatId} stars ⭐️`;

// ✨ Style (safe inline)
giftBtn.style.background = "linear-gradient(135deg,#ffb300,#ff0080,#00c6ff)";
giftBtn.style.color = "#fff";
giftBtn.style.fontWeight = "600";
giftBtn.style.padding = "10px 20px";
giftBtn.style.border = "none";
giftBtn.style.borderRadius = "10px";
giftBtn.style.boxShadow = "0 0 10px rgba(255,255,255,0.5)";
giftBtn.style.cursor = "pointer";
giftBtn.style.transition = "all 0.3s ease";
giftBtn.onpointerenter = () => giftBtn.style.transform = "scale(1.05)";
giftBtn.onpointerleave = () => giftBtn.style.transform = "scale(1)";
giftBtn.onpointerdown = () => showGiftModal(uidKey, data);

popupContent.appendChild(giftBtn);



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

/* ---------- VIP login (whitelist) ---------- */
async function loginWhitelist(email, phone) {
  const loader = document.getElementById("postLoginLoader");
  try {
    if (loader) loader.style.display = "flex";
    await new Promise(res => setTimeout(res, 50));

    // Query whitelist
    const q = query(
      collection(db, "whitelist"),
      where("email", "==", email),
      where("phone", "==", phone)
    );
    const snap = await getDocs(q);
    console.log("Whitelist query result:", snap.docs.map(d => d.data())); // debug

    if (snap.empty) {
      showStarPopup("You’re not on the whitelist. Check your email and phone format.");
      return false;
    }

    const uidKey = sanitizeKey(email);
    const userRef = doc(db, "users", uidKey);
    const docSnap = await getDoc(userRef);

    if (!docSnap.exists()) {
      showStarPopup("User not found. Please sign up on the main page first.");
      return false;
    }

    const data = docSnap.data() || {};
    currentUser = {
      uid: uidKey,
      email: data.email,
      phone: data.phone,
      chatId: data.chatId,
      chatIdLower: data.chatIdLower,
      stars: data.stars || 0,
      cash: data.cash || 0,
      usernameColor: data.usernameColor || randomColor(),
      isAdmin: data.isAdmin || false,
      isVIP: data.isVIP || false,
      fullName: data.fullName,
      gender: data.gender,
      subscriptionActive: data.subscriptionActive || false,
      subscriptionCount: data.subscriptionCount || 0,
      lastStarDate: data.lastStarDate || new Date().toISOString().split("T")[0],
      starsGifted: data.starsGifted || 0,
      starsToday: data.starsToday || 0,
      hostLink: data.hostLink || null,
      invitedBy: data.invitedBy || null,
      inviteeGiftShown: data.inviteeGiftShown || false,
      isHost: data.isHost || false
    };

    updateRedeemLink();
    setupPresence(currentUser);
    attachMessagesListener();
    startStarEarning(currentUser.uid);

    localStorage.setItem("vipUser", JSON.stringify({ email, phone }));

    if(currentUser.chatId.startsWith("GUEST")) await promptForChatID(userRef, data);

    // Hide login UI & show chatroom
    const emailAuthWrapper = document.getElementById("emailAuthWrapper");
    if (emailAuthWrapper) emailAuthWrapper.style.display = "none";
    if (refs.authBox) refs.authBox.style.display = "none";
    if (refs.sendAreaEl) refs.sendAreaEl.style.display = "flex";
    if (refs.profileBoxEl) refs.profileBoxEl.style.display = "block";
    if (refs.profileNameEl) { 
      refs.profileNameEl.innerText = currentUser.chatId; 
      refs.profileNameEl.style.color = currentUser.usernameColor; 
    }
    if (refs.starCountEl) refs.starCountEl.innerText = formatNumberWithCommas(currentUser.stars);
    if (refs.cashCountEl) refs.cashCountEl.innerText = formatNumberWithCommas(currentUser.cash);
    if (refs.adminControlsEl) refs.adminControlsEl.style.display = currentUser.isAdmin ? "flex" : "none";

    return true;

  } catch(e) {
    console.error("Login error:", e);
    showStarPopup("Login failed. Try again!");
    return false;
  } finally {
    if (loader) loader.style.display = "none";
  }
}

/* ---------- Stars auto-earning (cleaned) ---------- */
function startStarEarning(uid) {
  if (!uid) return;
  if (starInterval) clearInterval(starInterval); // clear previous interval

  const userRef = doc(db, "users", uid);
  let displayedStars = currentUser.stars || 0;
  let animationTimeout = null;

  // Smoothly animate star count in the UI
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

  // Listen for real-time Firestore updates
  onSnapshot(userRef, snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    const targetStars = data.stars || 0;
    currentUser.stars = targetStars;

    if (animationTimeout) clearTimeout(animationTimeout);
    updateStarDisplay(targetStars);

    // Optional milestone popup every 1000 stars
    if (currentUser.stars > 0 && currentUser.stars % 1000 === 0) {
      showStarPopup(`🔥 Congrats! You’ve reached ${formatNumberWithCommas(currentUser.stars)} stars!`);
    }
  });

  // Auto-increment stars every minute (max 250 stars per day)
  starInterval = setInterval(async () => {
    if (!navigator.onLine) return;

    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const today = new Date().toISOString().split("T")[0];

    // Reset daily earned stars if new day
    if (data.lastStarDate !== today) {
      await updateDoc(userRef, { starsToday: 0, lastStarDate: today });
      return;
    }

    // Only increment if under daily cap
    if ((data.starsToday || 0) < 250) {
      await updateDoc(userRef, { 
        stars: increment(10), 
        starsToday: increment(10) 
      });
    }
  }, 60000);

  // Clean up on page unload
  window.addEventListener("beforeunload", () => clearInterval(starInterval));
}


/* ---------- DOMContentLoaded ---------- */
window.addEventListener("DOMContentLoaded", () => {
  
/* ---------- Detect username tap ---------- */
document.addEventListener("pointerdown", e => {
  const el = e.target.closest(".chat-username");
  if (!el) return;
  const uid = el.dataset.username;
  if (uid && uid !== currentUser?.uid) showUserPopup(uid);

  // Small visual feedback (tapped highlight)
  el.style.transition = "opacity 0.15s";
  el.style.opacity = "0.5";
  setTimeout(() => (el.style.opacity = "1"), 150);
});

/* ---------- Loading Bar Helper ---------- */
function showLoadingBar(duration = 1000) {
  const postLoginLoader = document.getElementById("postLoginLoader");
  const loadingBar = document.getElementById("loadingBar");
  if (!postLoginLoader || !loadingBar) return;

  postLoginLoader.style.display = "flex";
  loadingBar.style.width = "0%";

  let progress = 0;
  const interval = 50;
  const step = 100 / (duration / interval);

  const loadingInterval = setInterval(() => {
    progress += step + Math.random() * 5; // slight randomness for realism
    if (progress >= 100) progress = 100;
    loadingBar.style.width = progress + "%";
    if (progress >= 100) {
      clearInterval(loadingInterval);
      setTimeout(() => {
        postLoginLoader.style.display = "none";
      }, 300);
    }
  }, interval);
}

  // Cache DOM elements
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

 /* ---------- VIP login (whitelist) ---------- */
const emailInput = document.getElementById("emailInput");
const phoneInput = document.getElementById("phoneInput");
const loginBtn = document.getElementById("whitelistLoginBtn");

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = (emailInput.value || "").trim().toLowerCase();
    const phone = (phoneInput.value || "").trim();

    if (!email || !phone) {
      showStarPopup("Enter your email and phone to get access");
      return;
    }

    showLoadingBar(1000); // show smooth loading bar during login
    await new Promise(res => setTimeout(res, 50));

    const success = await loginWhitelist(email, phone);

    if (!success) return; // showStarPopup handled inside loginWhitelist

    await new Promise(res => setTimeout(res, 500)); // slight post-login delay

    updateRedeemLink(); // update chatroom UI after login
  });
}

/* ---------- Auto-login session ---------- */
const vipUser = JSON.parse(localStorage.getItem("vipUser"));
if (vipUser?.email && vipUser?.phone) {
  (async () => {
    showLoadingBar(1000);
    await new Promise(res => setTimeout(res, 50));

    const success = await loginWhitelist(vipUser.email, vipUser.phone);

    if (!success) return;

    await new Promise(res => setTimeout(res, 500));

    updateRedeemLink();
  })();
}

/* ---------- Send & BUZZ ---------- */
refs.sendBtn?.addEventListener("click", async () => {
  if (!currentUser) return showStarPopup("Sign in to chat");

  const txt = refs.messageInputEl?.value.trim();
  if (!txt) return showStarPopup("Type a message first");

  if ((currentUser.stars || 0) < SEND_COST) return showStarPopup("Not enough stars to create a BUZZ!");

  currentUser.stars -= SEND_COST;
  refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
  await updateDoc(doc(db, "users", currentUser.uid), { stars: increment(-SEND_COST) });

  const docRef = await addDoc(collection(db, CHAT_COLLECTION), {
    content: txt,
    uid: currentUser.uid,
    chatId: currentUser.chatId,
    timestamp: serverTimestamp(),
    highlight: false,
    buzzColor: null
  });

  refs.messageInputEl.value = "";
  renderMessagesFromArray([{ id: docRef.id, data: { content: txt, uid: currentUser.uid, chatId: currentUser.chatId } }], true);

  requestAnimationFrame(() => {
    if (refs.messagesEl) refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
  });
});

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
    content: txt,
    uid: currentUser.uid,
    chatId: currentUser.chatId,
    timestamp: serverTimestamp(),
    highlight: true,
    buzzColor
  });

  refs.messageInputEl.value = "";
  showStarPopup("BUZZ sent!");
  renderMessagesFromArray([{ 
    id: docRef.id, 
    data: { content: txt, uid: currentUser.uid, chatId: currentUser.chatId, highlight: true, buzzColor } 
  }]);

  requestAnimationFrame(() => {
    if (refs.messagesEl) refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
  });
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
// Popup close logic (works on mobile too)
const popup = document.getElementById("userPopup");
const closeBtn = document.getElementById("popupClose");

if (popup && closeBtn) {
  // Close when clicking the X
  closeBtn.addEventListener("pointerdown", e => {
    e.stopPropagation();
    popup.style.display = "none";
  });

  // Close when tapping outside the popup card
  popup.addEventListener("pointerdown", e => {
    if (e.target === popup) {
      popup.style.display = "none";
    }
  });
}
