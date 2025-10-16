/* ---------- Imports (Firebase v10) ---------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, increment, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDatabase, ref as rtdbRef, set as rtdbSet, onDisconnect, onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

/* ---------- Firebase Config ---------- */
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

/* ---------- Global State ---------- */
const ROOM_ID = "room5";
const CHAT_COLLECTION = "messages_room5";
const BUZZ_COST = 50;
const SEND_COST = 1;

let currentUser = null;
let lastMessagesArray = [];
let starInterval = null;
let refs = {};

/* ---------- Helpers ---------- */
const generateGuestName = () => `GUEST ${Math.floor(1000 + Math.random() * 9000)}`;
const formatNumberWithCommas = n => new Intl.NumberFormat('en-NG').format(n || 0);
const sanitizeKey = key => key.replace(/[.#$[\]]/g, ',');

function randomColor() {
  const palette = ["#FFD700","#FF69B4","#87CEEB","#90EE90","#FFB6C1","#FFA07A","#8A2BE2","#00BFA6","#F4A460"];
  return palette[Math.floor(Math.random() * palette.length)];
}

function showStarPopup(text) {
  const popup = document.getElementById("starPopup");
  const starText = document.getElementById("starText");
  if (!popup || !starText) return;
  starText.innerText = text;
  popup.style.display = "block";
  setTimeout(() => popup.style.display = "none", 1700);
}

/* ---------- Gift Modal ---------- */
/* ----------------------------
   ⭐ GIFT / BALLER ALERT Glow
----------------------------- */
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

  const close = () => (modal.style.display = "none");
  closeBtn.onclick = close;
  modal.onclick = (e) => { if (e.target === modal) close(); };

  // Replace old confirm button with fresh one
  const newConfirmBtn = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

  // Floating stars helper
  const spawnFloatingStars = (msgEl, count = 6) => {
    const rect = msgEl.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
      const star = document.createElement("div");
      star.className = "floating-star";
      const x = (Math.random() - 0.5) * rect.width;
      const y = -Math.random() * 60;
      star.style.setProperty("--x", x + "px");
      star.style.setProperty("--y", y + "px");
      star.style.left = rect.width / 2 + "px";
      star.style.top = rect.height / 2 + "px";
      msgEl.appendChild(star);
      setTimeout(() => star.remove(), 2000 + Math.random() * 500);
    }
  };

  newConfirmBtn.addEventListener("click", async () => {
    const amt = parseInt(amountInput.value);
    if (!amt || amt < 100) return showStarPopup("🔥 Minimum gift is 100 ⭐️");
    if ((currentUser?.stars || 0) < amt) return showStarPopup("Not enough stars 💫");

    const fromRef = doc(db, "users", currentUser.uid);
    const toRef = doc(db, "users", targetUid);
    const glowColor = randomColor();

    const messageData = {
      content: `${currentUser.chatId} gifted ${targetData.chatId} ${amt} ⭐️`,
      uid: "balleralert",
      chatId: "BallerAlert🤩",
      timestamp: serverTimestamp(),
      highlight: true,
      buzzColor: glowColor
    };

    const docRef = await addDoc(collection(db, CHAT_COLLECTION), messageData);
    await Promise.all([
      updateDoc(fromRef, { stars: increment(-amt), starsGifted: increment(amt) }),
      updateDoc(toRef, { stars: increment(amt) })
    ]);

    showStarPopup(`You sent ${amt} ⭐️ to ${targetData.chatId}!`);
    close();
    renderMessagesFromArray([{ id: docRef.id, data: messageData }]);

    const msgEl = document.getElementById(docRef.id);
    if (!msgEl) return;
    const contentEl = msgEl.querySelector(".content") || msgEl;

    // Apply BallerAlert glow
    contentEl.style.setProperty("--pulse-color", glowColor);
    contentEl.classList.add("baller-highlight");
    setTimeout(() => {
      contentEl.classList.remove("baller-highlight");
      contentEl.style.boxShadow = "none";
    }, 21000);

    // Floating stars burst
    let starsInterval = setInterval(() => spawnFloatingStars(contentEl, 5), 300);
    setTimeout(() => clearInterval(starsInterval), 2000);
  });
}

/* ---------- Gift Alert (Floating Popup) ---------- */
function showGiftAlert(text) {
  const alertEl = document.getElementById("giftAlert");
  if (!alertEl) return;

  alertEl.textContent = text;
  alertEl.classList.add("show", "glow");

  createFloatingStars();

  setTimeout(() => alertEl.classList.remove("show", "glow"), 4000);
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

/* ---------- Redeem Link ---------- */
function updateRedeemLink() {
  if (!refs.redeemBtn || !currentUser) return;
  refs.redeemBtn.href = `https://golalaland.github.io/chat/nushop.html?uid=${encodeURIComponent(currentUser.uid)}`;
  refs.redeemBtn.style.display = "inline-block";
}

/* ---------- Presence (Realtime) ---------- */
function setupPresence(user) {
  if (!rtdb) return;
  const pRef = rtdbRef(rtdb, `presence/${ROOM_ID}/${sanitizeKey(user.uid)}`);
  rtdbSet(pRef, { online: true, chatId: user.chatId, email: user.email }).catch(() => {});
  onDisconnect(pRef).remove().catch(() => {});
}

if (rtdb) {
  onValue(rtdbRef(rtdb, `presence/${ROOM_ID}`), snap => {
    const users = snap.val() || {};
    if (refs.onlineCountEl) refs.onlineCountEl.innerText = `(${Object.keys(users).length} online)`;
  });
}

/* ---------- User Colors ---------- */
function setupUsersListener() {
  onSnapshot(collection(db, "users"), snap => {
    refs.userColors = refs.userColors || {};
    snap.forEach(docSnap => {
      refs.userColors[docSnap.id] = docSnap.data()?.usernameColor || "#ffffff";
    });
    if (lastMessagesArray.length) renderMessagesFromArray(lastMessagesArray);
  });
}
setupUsersListener();

/* ---------- Render Messages ---------- */
let scrollPending = false;

function renderMessagesFromArray(messages) {
  if (!refs.messagesEl) return;

  messages.forEach(item => {
    if (document.getElementById(item.id)) return;

    const m = item.data;
    const wrapper = document.createElement("div");
    wrapper.className = "msg";
    wrapper.id = item.id;

    const usernameEl = document.createElement("span");
    usernameEl.className = "meta";
    usernameEl.innerHTML = `<span class="chat-username" data-username="${m.uid}">${m.chatId || "Guest"}</span>:`;
    usernameEl.style.color = (m.uid && refs.userColors?.[m.uid]) ? refs.userColors[m.uid] : "#fff";
    usernameEl.style.marginRight = "4px";

    const contentEl = document.createElement("span");
    contentEl.className = m.highlight || m.buzzColor ? "buzz-content content" : "content";
    contentEl.textContent = " " + (m.content || "");

    if (m.buzzColor) contentEl.style.background = m.buzzColor;
    if (m.highlight) {
      contentEl.style.color = "#000";
      contentEl.style.fontWeight = "700";
    }

    wrapper.append(usernameEl, contentEl);
    refs.messagesEl.appendChild(wrapper);
  });

  // auto-scroll logic
  if (!scrollPending) {
    scrollPending = true;
    requestAnimationFrame(() => {
      const nearBottom = refs.messagesEl.scrollHeight - refs.messagesEl.scrollTop - refs.messagesEl.clientHeight < 50;
      if (messages.some(msg => msg.data.uid === currentUser?.uid) || nearBottom) {
        refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
      }
      scrollPending = false;
    });
  }
}



/* ---------- 🔔 Messages Listener ---------- */
function attachMessagesListener() {
  const q = query(collection(db, CHAT_COLLECTION), orderBy("timestamp", "asc"));

  onSnapshot(q, snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type !== "added") return;

      const msg = change.doc.data();
      const msgId = change.doc.id;

      // Prevent duplicate render
      if (document.getElementById(msgId)) return;

      // Add to memory + render
      lastMessagesArray.push({ id: msgId, data: msg });
      renderMessagesFromArray([{ id: msgId, data: msg }]);

      /* 💝 Detect personalized gift messages */
      if (msg.uid === "system" && msg.highlight && msg.content?.includes("gifted")) {
        const myId = currentUser?.chatId?.toLowerCase();
        if (!myId) return;

        const [sender, , receiver, amount] = msg.content.split(" "); // e.g., Nushi gifted Goll 50
        if (!sender || !receiver || !amount) return;

        if (sender.toLowerCase() === myId) {
          showGiftAlert(`You gifted ${receiver} ${amount} ⭐️`);
        } else if (receiver.toLowerCase() === myId) {
          showGiftAlert(`${sender} gifted you ${amount} ⭐️`);
        }
      }

      // 🌀 Keep scroll for your own messages
      if (refs.messagesEl && msg.uid === currentUser?.uid) {
        refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
      }
    });
  });
}
/* ---------- 👤 User Popup Logic (Optimized & Instant) ---------- */
const userPopup = document.getElementById("userPopup");
const popupContent = userPopup.querySelector(".user-popup-content");
const popupCloseBtn = document.getElementById("popupCloseBtn");
const popupPhoto = userPopup.querySelector(".popup-photo");
const popupUsername = document.getElementById("popupUsername");
const popupGender = document.getElementById("popupGender");
const popupGlow = userPopup.querySelector(".popup-glow");
const popupSocials = document.getElementById("popupSocials");

export async function showUserPopup(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));

    if (!snap.exists()) {
      const starPopup = document.getElementById("starPopup");
      starPopup.style.display = "block";
      starPopup.querySelector("#starText").textContent = "User has not unlocked profile yet!";
      setTimeout(() => starPopup.style.display = "none", 1800);
      return;
    }

    const data = snap.data();

    // Username
    popupUsername.textContent = data.chatId || "Unknown";

    // Typewriter effect for descriptor
    const ageGroup = (data.age >= 30) ? "30s" : "20s";
    const pronoun = data.gender?.toLowerCase() === "male" ? "his" : "her";
    const textLine = `A ${data.naturePick || "sexy"} ${data.gender || "male"} in ${pronoun} ${ageGroup}`;
    popupGender.textContent = "";
    let i = 0;
    function typeWriter() {
      if (i < textLine.length) {
        popupGender.textContent += textLine.charAt(i);
        i++;
        setTimeout(typeWriter, 50);
      }
    }
    typeWriter();

    // Photo
    if (data.photoURL) {
      popupPhoto.innerHTML = `<img src="${data.photoURL}" alt="Profile" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
      popupPhoto.textContent = (data.chatId || "?").slice(0, 2).toUpperCase();
      popupPhoto.style.background = "#222";
    }

    // Fruit emoji
    popupGlow.textContent = data.fruitPick || "🍇";

    // Socials
    popupSocials.innerHTML = "";
    const socialsMap = {
      instagram: "https://cdn-icons-png.flaticon.com/512/2111/2111463.png",
      telegram: "https://cdn-icons-png.flaticon.com/512/2111/2111646.png",
      tiktok: "https://cdn-icons-png.flaticon.com/512/3046/3046122.png",
      whatsapp: "https://cdn-icons-png.flaticon.com/512/733/733585.png"
    };
    Object.keys(socialsMap).forEach(key => {
      if (data[key]) {
        const a = document.createElement("a");
        a.href = data[key].startsWith("http") ? data[key] : `https://${data[key]}`;
        a.target = "_blank";
        a.innerHTML = `<img src="${socialsMap[key]}" alt="${key}">`;
        popupSocials.appendChild(a);
      }
    });

    // 🎁 Gift button
    let giftBtn = popupContent.querySelector(".gift-btn");
    if (!giftBtn) {
      giftBtn = document.createElement("button");
      giftBtn.className = "gift-btn";
      popupContent.appendChild(giftBtn);
    }
    giftBtn.textContent = "Gift Stars ⭐️";
    giftBtn.onclick = () => showGiftModal(uid, data);

    // Show popup
    userPopup.style.display = "flex";
    setTimeout(() => popupContent.classList.add("show"), 20);

  } catch (err) {
    console.error("Error fetching user popup:", err);
  }
}

// Close logic
popupCloseBtn.onclick = () => {
  popupContent.classList.remove("show");
  setTimeout(() => userPopup.style.display = "none", 250);
};
userPopup.onclick = e => {
  if (e.target === userPopup) popupCloseBtn.click();
};

/* ---------- 🪶 Detect Username Tap ---------- */
document.addEventListener("pointerdown", e => {
  const el = e.target.closest(".chat-username");
  if (!el) return;

  const uid = el.dataset.username;
  if (uid && uid !== currentUser?.uid) showUserPopup(uid);

  el.style.transition = "opacity 0.15s";
  el.style.opacity = "0.5";
  setTimeout(() => (el.style.opacity = "1"), 150);
});

/* ---------- 🆔 ChatID Modal ---------- */
async function promptForChatID(userRef, userData) {
  if (!refs.chatIDModal || !refs.chatIDInput || !refs.chatIDConfirmBtn)
    return userData?.chatId || null;

  // Skip if user already set chatId
  if (userData?.chatId && !userData.chatId.startsWith("GUEST"))
    return userData.chatId;

  refs.chatIDInput.value = "";
  refs.chatIDModal.style.display = "flex";
  if (refs.sendAreaEl) refs.sendAreaEl.style.display = "none";

  return new Promise(resolve => {
    refs.chatIDConfirmBtn.onclick = async () => {
      const chosen = refs.chatIDInput.value.trim();
      if (chosen.length < 3 || chosen.length > 12)
        return alert("Chat ID must be 3–12 characters");

      const lower = chosen.toLowerCase();
      const q = query(collection(db, "users"), where("chatIdLower", "==", lower));
      const snap = await getDocs(q);

      let taken = false;
      snap.forEach(docSnap => {
        if (docSnap.id !== userRef.id) taken = true;
      });
      if (taken) return alert("This Chat ID is taken 💬");

      try {
        await updateDoc(userRef, { chatId: chosen, chatIdLower: lower });
        currentUser.chatId = chosen;
        currentUser.chatIdLower = lower;
        refs.chatIDModal.style.display = "none";
        if (refs.sendAreaEl) refs.sendAreaEl.style.display = "flex";
        showStarPopup(`Welcome ${chosen}! 🎉`);
        resolve(chosen);
      } catch (err) {
        console.error(err);
        alert("Failed to save Chat ID");
      }
    };
  });
}
/* ===============================
   🔐 VIP Login (Whitelist Check)
================================= */
async function loginWhitelist(email, phone) {
  const loader = document.getElementById("postLoginLoader");
  try {
    if (loader) loader.style.display = "flex";
    await sleep(50);

    // 🔍 Query whitelist
    const whitelistQuery = query(
      collection(db, "whitelist"),
      where("email", "==", email),
      where("phone", "==", phone)
    );
    const whitelistSnap = await getDocs(whitelistQuery);
    console.log("📋 Whitelist result:", whitelistSnap.docs.map(d => d.data()));

    if (whitelistSnap.empty) {
      return showStarPopup("You’re not on the whitelist. Please check your email and phone format.");
    }

    const uidKey = sanitizeKey(email);
    const userRef = doc(db, "users", uidKey);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return showStarPopup("User not found. Please sign up on the main page first.");
    }

    const data = userSnap.data() || {};

    // 🧍🏽 Set current user details
    currentUser = {
      uid: uidKey,
      email: data.email,
      phone: data.phone,
      chatId: data.chatId,
      chatIdLower: data.chatIdLower,
      stars: data.stars || 0,
      cash: data.cash || 0,
      usernameColor: data.usernameColor || randomColor(),
      isAdmin: !!data.isAdmin,
      isVIP: !!data.isVIP,
      fullName: data.fullName || "",
      gender: data.gender || "",
      subscriptionActive: !!data.subscriptionActive,
      subscriptionCount: data.subscriptionCount || 0,
      lastStarDate: data.lastStarDate || todayDate(),
      starsGifted: data.starsGifted || 0,
      starsToday: data.starsToday || 0,
      hostLink: data.hostLink || null,
      invitedBy: data.invitedBy || null,
      inviteeGiftShown: !!data.inviteeGiftShown,
      isHost: !!data.isHost
    };

    // 🧠 Setup post-login systems
    updateRedeemLink();
    setupPresence(currentUser);
    attachMessagesListener();
    startStarEarning(currentUser.uid);

    localStorage.setItem("vipUser", JSON.stringify({ email, phone }));

    // Prompt guests for a permanent chatID
    if (currentUser.chatId?.startsWith("GUEST")) {
      await promptForChatID(userRef, data);
    }

    // 🎨 Update UI
    showChatUI(currentUser);

    return true;

  } catch (err) {
    console.error("❌ Login error:", err);
    showStarPopup("Login failed. Try again!");
    return false;
  } finally {
    if (loader) loader.style.display = "none";
  }
}

/* ===============================
   💫 Auto Star Earning System
================================= */
function startStarEarning(uid) {
  if (!uid) return;
  if (starInterval) clearInterval(starInterval);

  const userRef = doc(db, "users", uid);
  let displayedStars = currentUser.stars || 0;
  let animationTimeout = null;

  // ✨ Smooth UI update
  const animateStarCount = target => {
    if (!refs.starCountEl) return;
    const diff = target - displayedStars;

    if (Math.abs(diff) < 1) {
      displayedStars = target;
      refs.starCountEl.textContent = formatNumberWithCommas(displayedStars);
      return;
    }

    displayedStars += diff * 0.25; // smoother easing
    refs.starCountEl.textContent = formatNumberWithCommas(Math.floor(displayedStars));
    animationTimeout = setTimeout(() => animateStarCount(target), 40);
  };

  // 🔄 Real-time listener
  onSnapshot(userRef, snap => {
    if (!snap.exists()) return;
    const data = snap.data();
    const targetStars = data.stars || 0;
    currentUser.stars = targetStars;

    if (animationTimeout) clearTimeout(animationTimeout);
    animateStarCount(targetStars);

    // 🎉 Milestone popup
    if (targetStars > 0 && targetStars % 1000 === 0) {
      showStarPopup(`🔥 Congrats! You’ve reached ${formatNumberWithCommas(targetStars)} stars!`);
    }
  });

  // ⏱️ Increment loop
  starInterval = setInterval(async () => {
    if (!navigator.onLine) return;

    const snap = await getDoc(userRef);
    if (!snap.exists()) return;

    const data = snap.data();
    const today = todayDate();

    // Reset daily count
    if (data.lastStarDate !== today) {
      await updateDoc(userRef, { starsToday: 0, lastStarDate: today });
      return;
    }

    // Limit: 250/day
    if ((data.starsToday || 0) < 250) {
      await updateDoc(userRef, {
        stars: increment(10),
        starsToday: increment(10)
      });
    }
  }, 60000);

  // 🧹 Cleanup
  window.addEventListener("beforeunload", () => clearInterval(starInterval));
}

/* ===============================
   🧩 Helper Functions
================================= */
const todayDate = () => new Date().toISOString().split("T")[0];
const sleep = ms => new Promise(res => setTimeout(res, ms));

function showChatUI(user) {
  const { authBox, sendAreaEl, profileBoxEl, profileNameEl, starCountEl, cashCountEl, adminControlsEl } = refs;

  // Hide auth, show chat
  document.getElementById("emailAuthWrapper")?.style?.setProperty("display", "none");
  authBox && (authBox.style.display = "none");
  sendAreaEl && (sendAreaEl.style.display = "flex");
  profileBoxEl && (profileBoxEl.style.display = "block");

  if (profileNameEl) {
    profileNameEl.innerText = user.chatId;
    profileNameEl.style.color = user.usernameColor;
  }

  if (starCountEl) starCountEl.textContent = formatNumberWithCommas(user.stars);
  if (cashCountEl) cashCountEl.textContent = formatNumberWithCommas(user.cash);
  if (adminControlsEl) adminControlsEl.style.display = user.isAdmin ? "flex" : "none";
}


/* =======================================
   🚀 DOMContentLoaded Bootstrap
======================================= */
window.addEventListener("DOMContentLoaded", () => {

  /* ----------------------------
     ⚡ Smooth Loading Bar Helper
  ----------------------------- */
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
      progress += step + Math.random() * 4; // adds organic feel
      loadingBar.style.width = `${Math.min(progress, 100)}%`;

      if (progress >= 100) {
        clearInterval(loadingInterval);
        setTimeout(() => postLoginLoader.style.display = "none", 250);
      }
    }, interval);
  }

  /* ----------------------------
     🧩 Cache DOM References
  ----------------------------- */
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

  if (refs.chatIDInput) refs.chatIDInput.maxLength = 12;

  /* ----------------------------
     🔐 VIP Login Setup
  ----------------------------- */
  const emailInput = document.getElementById("emailInput");
  const phoneInput = document.getElementById("phoneInput");
  const loginBtn = document.getElementById("whitelistLoginBtn");

  async function handleLogin() {
    const email = (emailInput?.value || "").trim().toLowerCase();
    const phone = (phoneInput?.value || "").trim();

    if (!email || !phone) {
      return showStarPopup("Enter your email and phone to get access.");
    }

    showLoadingBar(1000);
    await sleep(50);

    const success = await loginWhitelist(email, phone);
    if (!success) return;

    await sleep(400);
    updateRedeemLink();
  }

  loginBtn?.addEventListener("click", handleLogin);

  /* ----------------------------
     🔁 Auto Login Session
  ----------------------------- */
  const vipUser = JSON.parse(localStorage.getItem("vipUser"));
  if (vipUser?.email && vipUser?.phone) {
    (async () => {
      showLoadingBar(1000);
      await sleep(60);
      const success = await loginWhitelist(vipUser.email, vipUser.phone);
      if (!success) return;
      await sleep(400);
      updateRedeemLink();
    })();
  }

  /* ----------------------------
     💬 Send Message Handler
  ----------------------------- */
  refs.sendBtn?.addEventListener("click", async () => {
    if (!currentUser) return showStarPopup("Sign in to chat.");
    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message first.");
    if ((currentUser.stars || 0) < SEND_COST)
      return showStarPopup("Not enough stars to send message.");

    // Deduct star cost
    currentUser.stars -= SEND_COST;
    refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
    await updateDoc(doc(db, "users", currentUser.uid), { stars: increment(-SEND_COST) });

    // Add to chat
    const newMsg = {
      content: txt,
      uid: currentUser.uid,
      chatId: currentUser.chatId,
      timestamp: serverTimestamp(),
      highlight: false,
      buzzColor: null
    };
    const docRef = await addDoc(collection(db, CHAT_COLLECTION), newMsg);

    // Render immediately (optimistic)
    refs.messageInputEl.value = "";
    renderMessagesFromArray([{ id: docRef.id, data: newMsg }], true);
    scrollToBottom(refs.messagesEl);
  });

  /* ----------------------------
     🚨 BUZZ Message Handler
  ----------------------------- */
  refs.buzzBtn?.addEventListener("click", async () => {
  if (!currentUser) return showStarPopup("Sign in to BUZZ.");
  const txt = refs.messageInputEl?.value.trim();
  if (!txt) return showStarPopup("Type a message to BUZZ 🚨");

  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  const stars = snap.data()?.stars || 0;
  if (stars < BUZZ_COST) return showStarPopup("Not enough stars for BUZZ.");

  await updateDoc(userRef, { stars: increment(-BUZZ_COST) });
  const buzzColor = randomColor();

  const newBuzz = {
    content: txt,
    uid: currentUser.uid,
    chatId: currentUser.chatId,
    timestamp: serverTimestamp(),
    highlight: true,
    buzzColor
  };
  const docRef = await addDoc(collection(db, CHAT_COLLECTION), newBuzz);

  refs.messageInputEl.value = "";
  showStarPopup("BUZZ sent!");
  renderMessagesFromArray([{ id: docRef.id, data: newBuzz }]);
  scrollToBottom(refs.messagesEl);

  // Apply BUZZ glow
  const msgEl = document.getElementById(docRef.id);
  if (!msgEl) return;
  const contentEl = msgEl.querySelector(".content") || msgEl;

  contentEl.style.setProperty("--buzz-color", buzzColor);
  contentEl.classList.add("buzz-highlight");
  setTimeout(() => {
    contentEl.classList.remove("buzz-highlight");
    contentEl.style.boxShadow = "none";
  }, 12000); // same as CSS animation
});

  /* ----------------------------
     👋 Rotating Hello Text
  ----------------------------- */
  const greetings = ["HELLO","HOLA","BONJOUR","CIAO","HALLO","こんにちは","你好","안녕하세요","SALUT","OLÁ","NAMASTE","MERHABA"];
  const helloEl = document.getElementById("helloText");
  let greetIndex = 0;

  setInterval(() => {
    if (!helloEl) return;
    helloEl.style.opacity = "0";

    setTimeout(() => {
      helloEl.innerText = greetings[greetIndex++ % greetings.length];
      helloEl.style.color = randomColor();
      helloEl.style.opacity = "1";
    }, 220);
  }, 1500);

  /* ----------------------------
     🧩 Tiny Helpers
  ----------------------------- */
  const scrollToBottom = el => {
    if (!el) return;
    requestAnimationFrame(() => el.scrollTop = el.scrollHeight);
  };
  const sleep = ms => new Promise(res => setTimeout(res, ms));
});
  /* =======================================
   🎥 Video Navigation & UI Fade Logic
======================================= */
(() => {
  const videoPlayer = document.getElementById("videoPlayer");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const container = document.querySelector(".video-container");
  const navButtons = [prevBtn, nextBtn].filter(Boolean);

  if (!videoPlayer || navButtons.length === 0) return;

  // 🎞️ Video list
  const videos = [
    "https://res.cloudinary.com/dekxhwh6l/video/upload/v1695/35a6ff0764563d1dcfaaaedac912b2c7_zfzxlw.mp4",
    "https://xixi.b-cdn.net/Petitie%20Bubble%20Butt%20Stripper.mp4",
    "https://xixi.b-cdn.net/Bootylicious%20Ebony%20Queen%20Kona%20Jade%20Twerks%20Teases%20and%20Rides%20POV%20u.mp4"
  ];
  let currentVideo = 0;
  let hideTimeout = null;

  /* ----------------------------
     ▶️ Load & Play Video
  ----------------------------- */
  const loadVideo = (index) => {
    if (index < 0) index = videos.length - 1;
    if (index >= videos.length) index = 0;

    currentVideo = index;
    videoPlayer.src = videos[currentVideo];
    videoPlayer.muted = true;

    videoPlayer.play().catch(() => console.warn("Autoplay may be blocked by browser"));
  };

  /* ----------------------------
     🔊 Toggle Mute on Tap
  ----------------------------- */
  videoPlayer.addEventListener("click", () => {
    videoPlayer.muted = !videoPlayer.muted;
    const state = videoPlayer.muted ? "🔇" : "🔊";
    showStarPopup(`Video sound: ${state}`);
  });

  /* ----------------------------
     ⏪⏩ Navigation Buttons
  ----------------------------- */
  prevBtn?.addEventListener("click", () => loadVideo(currentVideo - 1));
  nextBtn?.addEventListener("click", () => loadVideo(currentVideo + 1));

  /* ----------------------------
     👀 Auto Hide/Show Buttons
  ----------------------------- */
  const showButtons = () => {
    navButtons.forEach(btn => {
      btn.style.opacity = "1";
      btn.style.pointerEvents = "auto";
    });
    clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      navButtons.forEach(btn => {
        btn.style.opacity = "0";
        btn.style.pointerEvents = "none";
      });
    }, 3000);
  };

  navButtons.forEach(btn => {
    btn.style.transition = "opacity 0.6s ease";
    btn.style.opacity = "0";
    btn.style.pointerEvents = "none";
  });

  ["mouseenter", "mousemove", "click"].forEach(evt => container?.addEventListener(evt, showButtons));
  container?.addEventListener("mouseleave", () => {
    navButtons.forEach(btn => {
      btn.style.opacity = "0";
      btn.style.pointerEvents = "none";
    });
  });

  // Start with first video
  loadVideo(0);
})();

// URL of your custom star image
const customStarURL = "https://res.cloudinary.com/dekxhwh6l/image/upload/v1760574055/stars_ojgnny.svg";

// Replace stars in text nodes with image
function replaceStarsWithImage(root = document.body) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        if ((node.nodeValue.includes("⭐") || node.nodeValue.includes("⭐️")) && !node.parentNode.dataset.star) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodesToReplace = [];
  while(walker.nextNode()) nodesToReplace.push(walker.currentNode);

  nodesToReplace.forEach(textNode => {
    const parent = textNode.parentNode;
    const fragments = textNode.nodeValue.split(/⭐️?|⭐/);
    fragments.forEach((frag, i) => {
      if(frag) parent.insertBefore(document.createTextNode(frag), textNode);
      if(i < fragments.length - 1) {
        const span = document.createElement("span");
        span.dataset.star = "⭐"; // store original star
        const img = document.createElement("img");
        img.src = customStarURL;
        img.alt = "⭐";
        img.style.width = "16px";
        img.style.height = "16px";
        img.style.display = "inline-block";
        img.style.verticalAlign = "middle";
        span.appendChild(img);
        parent.insertBefore(span, textNode);
      }
    });
    parent.removeChild(textNode);
  });
}

// Function to revert back to original stars
function revertStars(root = document.body) {
  root.querySelectorAll("span[data-star]").forEach(span => {
    const starText = document.createTextNode(span.dataset.star);
    span.parentNode.replaceChild(starText, span);
  });
}

// Run on page load
replaceStarsWithImage();

// Automatically replace stars in new chat messages or dynamic content
const observer = new MutationObserver(mutations => {
  mutations.forEach(m => replaceStarsWithImage(m.target));
});
observer.observe(document.body, { childList: true, subtree: true });

/* =======================================
   🧱 User Popup Close Logic (Mobile + PC)
======================================= */
(() => {
  const popup = document.getElementById("userPopup");
  const closeBtn = document.getElementById("popupClose");

  if (!popup || !closeBtn) return;

  const hidePopup = () => {
    popup.style.display = "none";
    popup.classList.remove("show");
  };

  closeBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    hidePopup();
  });

  popup.addEventListener("pointerdown", (e) => {
    if (e.target === popup) hidePopup();
  });
})();