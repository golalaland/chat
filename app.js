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
let starInterval = null;
let starUnsubscribe = null;     // will hold unsubscribe for star listener
let lastMilestone = 0;         // track last milestone popup
let refs = {};                 // DOM refs (set on DOMContentLoaded)

/* ---------- Guard & ready promise ---------- */
let chatroomReadyResolved = false;
let chatroomReadyResolve;
const chatroomReady = new Promise(res => { chatroomReadyResolve = res; });
let chatroomReadyFallbackTimer = null;

/* ---------- Constants ---------- */
const BUZZ_COST = 50;
const SEND_COST = 1;

/* ---------- Helpers ---------- */
function generateGuestName() { return "GUEST " + Math.floor(1000 + Math.random() * 9000); }
function formatNumberWithCommas(n) { return new Intl.NumberFormat('en-NG').format(n || 0); }
function randomColor() {
  const colors = ["#FFD700", "#FF69B4", "#87CEEB", "#90EE90", "#FFB6C1", "#FFA07A", "#8A2BE2", "#00BFA6", "#F4A460"];
  return colors[Math.floor(Math.random() * colors.length)];
}
function showStarPopup(text) {
  const popup = document.getElementById("starPopup");
  const starText = document.getElementById("starText");
  if (!popup || !starText) return;
  starText.innerText = text;
  popup.style.display = "block";
  // simple fade-out
  setTimeout(() => { popup.style.display = "none"; }, 1700);
}
function sanitizeKey(key) { return key.replace(/[.#$[\]]/g, ','); }

function resolveChatroomReadyOnce() {
  if (!chatroomReadyResolved) {
    chatroomReadyResolved = true;
    try { chatroomReadyResolve(); } catch (e) {}
    if (chatroomReadyFallbackTimer) {
      clearTimeout(chatroomReadyFallbackTimer);
      chatroomReadyFallbackTimer = null;
    }
  }
}

/* ---------- Redeem link update ---------- */
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
  rtdbSet(pRef, { online: true, chatId: user.chatId, email: user.email }).catch(() => { });
  onDisconnect(pRef).remove().catch(() => { });
}
if (rtdb) {
  onValue(rtdbRef(rtdb, `presence/${ROOM_ID}`), snap => {
    const val = snap.val() || {};
    if (refs.onlineCountEl) refs.onlineCountEl.innerText = `(${Object.keys(val).length} online)`;
  });
}

/* ---------- Users color listener (will be started after DOM ready) ---------- */
function setupUsersListener() {
  // keep a simple live map of uid -> color
  onSnapshot(collection(db, "users"), snap => {
    refs.userColors = refs.userColors || {};
    snap.forEach(d => {
      refs.userColors[d.id] = d.data()?.usernameColor || "#ffffff";
    });
    if (lastMessagesArray.length) renderMessagesFromArray(lastMessagesArray);
  });
}

/* ---------- Render messages ---------- */
let scrollPending = false;
function renderMessagesFromArray(arr) {
  if (!refs.messagesEl) return;

  arr.forEach(item => {
    if (document.getElementById(item.id)) return;

    const m = item.data || {};
    const wrapper = document.createElement("div");
    wrapper.className = "msg";
    wrapper.id = item.id;

    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = (m.chatId || "Guest") + ":";
    meta.style.color = (m.uid && refs.userColors && refs.userColors[m.uid]) ? refs.userColors[m.uid] : '#ffffff';
    meta.style.marginRight = "4px";

    const content = document.createElement("span");
    content.className = (m.highlight || m.buzzColor) ? "buzz-content content" : "content";
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
      if (arr.some(msg => msg.data && msg.data.uid === currentUser?.uid) || nearBottom) {
        refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
      }
      scrollPending = false;
    });
  }
}

/* ---------- Messages listener ---------- */
function attachMessagesListener() {
  const q = query(collection(db, CHAT_COLLECTION), orderBy("timestamp", "asc"));
  let initialLoaded = false;

  // initial onSnapshot sets up real-time updates
  onSnapshot(q, snapshot => {
    try {
      snapshot.docChanges().forEach(change => {
        if (change.type === "added") {
          const msgData = change.doc.data();
          lastMessagesArray.push({ id: change.doc.id, data: msgData });
          renderMessagesFromArray([{ id: change.doc.id, data: msgData }]);
        }
      });
    } catch (e) {
      console.error("Error processing messages snapshot:", e);
    }

    // Resolve ready once after first paint (two RAFs to ensure DOM painted)
    if (!initialLoaded) {
      initialLoaded = true;
      requestAnimationFrame(() => requestAnimationFrame(resolveChatroomReadyOnce));
    }
  }, (err) => {
    console.error("Messages listener error:", err);
    // if error, still resolve after a short delay so loader doesn't hang forever
    if (!initialLoaded) {
      initialLoaded = true;
      setTimeout(resolveChatroomReadyOnce, 1000);
    }
  });
}

/* ---------- ChatID modal ---------- */
async function promptForChatID(userRef, userData) {
  if (!refs.chatIDModal || !refs.chatIDInput || !refs.chatIDConfirmBtn) return userData?.chatId || null;
  if (userData?.chatId && !userData.chatId.startsWith("GUEST")) return userData.chatId;

  refs.chatIDInput.value = "";
  refs.chatIDModal.style.display = "flex";
  if (refs.sendAreaEl) refs.sendAreaEl.style.display = "none";

  return new Promise(resolve => {
    refs.chatIDConfirmBtn.onclick = async () => {
      const chosenID = refs.chatIDInput.value.trim();
      if (chosenID.length < 3 || chosenID.length > 12) {
        alert("Chat ID must be 3-12 characters"); return;
      }
      const normalized = chosenID.toLowerCase();
      try {
        const q = query(collection(db, "users"), where("chatIdLower", "==", normalized));
        const snap = await getDocs(q);
        let conflict = false;
        snap.forEach(docSnap => { if (docSnap.id !== userRef.id) conflict = true; });
        if (conflict) { alert("This Chat ID is taken"); return; }
        await updateDoc(userRef, { chatId: chosenID, chatIdLower: normalized });
        currentUser.chatId = chosenID;
        currentUser.chatIdLower = normalized;
      } catch (e) { console.error(e); alert("Failed to save ChatID"); return; }

      refs.chatIDModal.style.display = "none";
      if (refs.sendAreaEl) refs.sendAreaEl.style.display = "flex";
      showStarPopup(`Welcome ${currentUser.chatId}! 🎉`);
      resolve(chosenID);
    };
  });
}

/* ---------- VIP login (whitelist) ---------- */
async function loginWhitelist(email, phone) {
  try {
    // tiny debounce
    await new Promise(res => setTimeout(res, 50));

    // Query whitelist
    const q = query(
      collection(db, "whitelist"),
      where("email", "==", email),
      where("phone", "==", phone)
    );
    const snap = await getDocs(q);

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
      chatId: data.chatId || generateGuestName(),
      chatIdLower: data.chatIdLower || (data.chatId || "").toLowerCase(),
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

    // set initial milestone so popup is only for new 1000s
    lastMilestone = Math.floor((currentUser.stars || 0) / 1000) * 1000;

    updateRedeemLink();
    setupPresence(currentUser);
    attachMessagesListener();        // attach messages (will resolve chatroomReady once initial load completes)
    startStarEarning(currentUser.uid);

    localStorage.setItem("vipUser", JSON.stringify({ email, phone }));

    // If user still has guest id, ask for a chat id (this is awaited so loginWhitelist doesn't return until prompt resolves)
    if (currentUser.chatId && currentUser.chatId.startsWith("GUEST")) {
      await promptForChatID(userRef, data);
    }

    // Show chatroom UI
    document.getElementById("emailAuthWrapper")?.style.display = "none";
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

  } catch (e) {
    console.error("Login error:", e);
    showStarPopup("Login failed. Try again!");
    return false;
  }
}

/* ---------- Stars auto-earning ---------- */
function startStarEarning(uid) {
  if (!uid) return;

  // clear existing interval
  if (starInterval) {
    clearInterval(starInterval);
    starInterval = null;
  }
  // detach previous snapshot if any
  if (starUnsubscribe) {
    try { starUnsubscribe(); } catch (e) {}
    starUnsubscribe = null;
  }

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

  // keep the onSnapshot unsubscribe so we can detach if needed
  starUnsubscribe = onSnapshot(userRef, snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    const targetStars = data.stars || 0;
    currentUser.stars = targetStars;

    if (animationTimeout) clearTimeout(animationTimeout);
    updateStarDisplay(targetStars);

    // milestone logic: only once per new 1000
    const newMilestone = Math.floor(targetStars / 1000) * 1000;
    if (newMilestone > lastMilestone && newMilestone > 0) {
      lastMilestone = newMilestone;
      showStarPopup(`🔥 Congrats! You’ve reached ${formatNumberWithCommas(newMilestone)} stars!`);
    }
  }, err => {
    console.error("Star listener error:", err);
  });

  // Auto-increment stars every minute (server writes via updateDoc)
  starInterval = setInterval(async () => {
    if (!navigator.onLine) return;
    try {
      const snap = await getDoc(userRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const today = new Date().toISOString().split("T")[0];

      if (data.lastStarDate !== today) {
        await updateDoc(userRef, { starsToday: 0, lastStarDate: today });
        return;
      }

      if ((data.starsToday || 0) < 250) {
        await updateDoc(userRef, {
          stars: increment(10),
          starsToday: increment(10)
        });
      }
    } catch (e) {
      console.error("Auto-star increment failed:", e);
    }
  }, 60000);

  // cleanup on unload
  window.addEventListener("beforeunload", () => {
    if (starInterval) clearInterval(starInterval);
    if (starUnsubscribe) try { starUnsubscribe(); } catch (e) {}
  });
}

/* ---------- Loading Bar Helper ---------- */
function showLoadingBar() {
  const postLoginLoader = document.getElementById("postLoginLoader");
  const loadingBar = document.getElementById("loadingBar");
  if (!postLoginLoader || !loadingBar) return () => { };

  postLoginLoader.style.display = "flex";
  loadingBar.style.width = "0%";

  let progress = 0;
  const interval = 50;
  const step = 5;
  const loadingInterval = setInterval(() => {
    progress += step + Math.random() * 3;
    if (progress >= 90) progress = 90; // sit at 90% until ready
    loadingBar.style.width = progress + "%";
  }, interval);

  // fallback: if chatroom doesn't resolve in N ms, resolve ready so loader won't hang forever
  chatroomReadyFallbackTimer = setTimeout(() => {
    resolveChatroomReadyOnce();
  }, 10000); // 10s fallback

  return () => {
    clearInterval(loadingInterval);
    if (chatroomReadyFallbackTimer) { clearTimeout(chatroomReadyFallbackTimer); chatroomReadyFallbackTimer = null; }
    loadingBar.style.width = "100%";
    setTimeout(() => { postLoginLoader.style.display = "none"; }, 250);
  };
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
    adminClearMessagesBtn: document.getElementById("adminClearMessagesBtn"),
    chatIDModal: document.getElementById("chatIDModal"),
    chatIDInput: document.getElementById("chatIDInput"),
    chatIDConfirmBtn: document.getElementById("chatIDConfirmBtn")
  };
  if (refs.chatIDInput) refs.chatIDInput.setAttribute("maxlength", "12");

  // start users listener now that DOM refs are available
  setupUsersListener();

  /* ---------- VIP login ---------- */
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

      const stopLoading = showLoadingBar();
      await new Promise(res => setTimeout(res, 50));

      const success = await loginWhitelist(email, phone);
      if (!success) {
        // ensure loader hidden if login failed (loginWhitelist does not touch loader)
        stopLoading();
        return;
      }

      // wait for messages to render before hiding loader — this will also be delayed by ChatID modal
      await chatroomReady;
      stopLoading();
    });
  }

  /* ---------- Auto-login session ---------- */
  const vipUser = JSON.parse(localStorage.getItem("vipUser"));
  if (vipUser?.email && vipUser?.phone) {
    (async () => {
      const stopLoading = showLoadingBar();
      await new Promise(res => setTimeout(res, 50));

      const success = await loginWhitelist(vipUser.email, vipUser.phone);
      if (!success) {
        stopLoading();
        return;
      }

      await chatroomReady;
      stopLoading();
    })();
  }

  /* ---------- Send ---------- */
  refs.sendBtn?.addEventListener("click", async () => {
    if (!currentUser) return showStarPopup("Sign in to chat");

    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message first");

    if ((currentUser.stars || 0) < SEND_COST) return showStarPopup("Not enough stars");

    // optimistic UI update
    currentUser.stars -= SEND_COST;
    if (refs.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);

    refs.messageInputEl.value = "";

    try {
      await updateDoc(doc(db, "users", currentUser.uid), { stars: increment(-SEND_COST) });
      await addDoc(collection(db, CHAT_COLLECTION), {
        content: txt,
        uid: currentUser.uid,
        chatId: currentUser.chatId,
        timestamp: serverTimestamp(),
        highlight: false,
        buzzColor: null
      });
    } catch (e) {
      console.error("Send failed:", e);
      showStarPopup("Failed to send. Try again.");
      // rollback optimistic UI (best-effort)
      currentUser.stars += SEND_COST;
      if (refs.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
    }
  });

  /* ---------- Buzz ---------- */
  refs.buzzBtn?.addEventListener("click", async () => {
    if (!currentUser) return showStarPopup("Sign in first");
    if ((currentUser.stars || 0) < BUZZ_COST) return showStarPopup("Not enough stars");

    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message first");

    // optimistic UI update
    currentUser.stars -= BUZZ_COST;
    if (refs.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);

    refs.messageInputEl.value = "";

    const buzzColor = randomColor();

    try {
      await updateDoc(doc(db, "users", currentUser.uid), { stars: increment(-BUZZ_COST) });
      await addDoc(collection(db, CHAT_COLLECTION), {
        content: txt,
        uid: currentUser.uid,
        chatId: currentUser.chatId,
        timestamp: serverTimestamp(),
        highlight: true,
        buzzColor
      });
      showStarPopup("BUZZ sent!");
    } catch (e) {
      console.error("Buzz failed:", e);
      showStarPopup("Failed to BUZZ. Try again.");
      // rollback
      currentUser.stars += BUZZ_COST;
      if (refs.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
    }
  });

  /* ---------- Hello text rotation (non-blocking) ---------- */
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

  /* ---------- Video nav & fade (non-blocking) ---------- */
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