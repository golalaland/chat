/* ---------- Imports (Firebase v10) ---------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc,
  serverTimestamp, onSnapshot, query, orderBy, increment, getDocs, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getDatabase, ref as rtdbRef, set as rtdbSet, onDisconnect, onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

/* ---------- Initialize Firebase ---------- */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

/* ---------- Auth State Watcher ---------- */
let currentUser = null;

onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    console.log("✅ Logged in as:", user.uid);
    localStorage.setItem("userId", user.uid);
  } else {
    console.warn("⚠️ No logged-in user found");
    currentUser = null;
    localStorage.removeItem("userId");
  }
});

/* ---------- Helper: Get current user ID ---------- */
export function getCurrentUserId() {
  return currentUser ? currentUser.uid : localStorage.getItem("userId");
}
window.currentUser = currentUser;

/* ---------- Exports for other scripts ---------- */
export { app, db, rtdb, auth };

/* ---------- Global State ---------- */
const ROOM_ID = "room5";
const CHAT_COLLECTION = "messages_room5";
const BUZZ_COST = 50;
const SEND_COST = 1;

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

/* ---------- Gift Modal---------- */
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

  // 💾 Load previously shown gift IDs from localStorage
  const shownGiftAlerts = new Set(JSON.parse(localStorage.getItem("shownGiftAlerts") || "[]"));

  // 💾 Save helper
  function saveShownGift(id) {
    shownGiftAlerts.add(id);
    localStorage.setItem("shownGiftAlerts", JSON.stringify([...shownGiftAlerts]));
  }

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
if (msg.highlight && msg.content?.includes("gifted")) {
  const myId = currentUser?.chatId?.toLowerCase();
  if (!myId) return;

  const parts = msg.content.split(" ");
  const sender = parts[0];
  const receiver = parts[2];
  const amount = parts[3];

  if (!sender || !receiver || !amount) return;

  // 🎯 Only receiver sees it once
  if (receiver.toLowerCase() === myId) {
    if (shownGiftAlerts.has(msgId)) return; // skip if seen before

    showGiftAlert(`${sender} gifted you ${amount} stars ⭐️`);
    saveShownGift(msgId);
  }

  // ❌ Remove any extra popups for gifting since showGiftAlert already covers it
  // (No need to trigger showStarPopup or similar)
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

/* ===============================
   🧠 UI Updates After Auth
================================= */
function updateUIAfterAuth(user) {
  const subtitle = document.getElementById("roomSubtitle");
  const helloText = document.getElementById("helloText");
  const roomDescText = document.querySelector(".room-desc .text");
  const hostsBtn = document.getElementById("openHostsBtn");

  if (user) {
    // Hide intro texts and show host button
    if (subtitle) subtitle.style.display = "none";
    if (helloText) helloText.style.display = "none";
    if (roomDescText) roomDescText.style.display = "none";
    if (hostsBtn) hostsBtn.style.display = "block";
  } else {
    // Restore intro texts and hide host button
    if (subtitle) subtitle.style.display = "block";
    if (helloText) helloText.style.display = "block";
    if (roomDescText) roomDescText.style.display = "block";
    if (hostsBtn) hostsBtn.style.display = "none";
  }
}

/* ===============================
   💬 Show Chat UI After Login
================================= */
function showChatUI(user) {
  const { authBox, sendAreaEl, profileBoxEl, profileNameEl, starCountEl, cashCountEl, adminControlsEl } = refs;

  // Hide login/auth elements
  document.getElementById("emailAuthWrapper")?.style?.setProperty("display", "none");
  document.getElementById("googleSignInBtn")?.style?.setProperty("display", "none");
  document.getElementById("vipAccessBtn")?.style?.setProperty("display", "none");

  // Show chat interface
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

  // 🔹 Apply additional UI updates (hide intro, show hosts)
  updateUIAfterAuth(user);
}

/* ===============================
   🚪 Hide Chat UI On Logout
================================= */
function hideChatUI() {
  const { authBox, sendAreaEl, profileBoxEl, adminControlsEl } = refs;

  authBox && (authBox.style.display = "block");
  sendAreaEl && (sendAreaEl.style.display = "none");
  profileBoxEl && (profileBoxEl.style.display = "none");
  if (adminControlsEl) adminControlsEl.style.display = "none";

  // 🔹 Restore intro UI (subtitle, hello text, etc.)
  updateUIAfterAuth(null);
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
  /* =====================================
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

// URL of your custom star SVG
const customStarURL = "https://res.cloudinary.com/dekxhwh6l/image/upload/v1760596116/starssvg_k3hmsu.svg";

// Replace stars in text nodes with SVG + floating stars
function replaceStarsWithSVG(root = document.body) {
  if (!root) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: node => {
        if (node.nodeValue.includes("⭐") || node.nodeValue.includes("⭐️")) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );

  const nodesToReplace = [];
  while (walker.nextNode()) nodesToReplace.push(walker.currentNode);

  nodesToReplace.forEach(textNode => {
    const parent = textNode.parentNode;
    if (!parent) return;

    const fragments = textNode.nodeValue.split(/⭐️?|⭐/);

    fragments.forEach((frag, i) => {
      if (frag) parent.insertBefore(document.createTextNode(frag), textNode);

      if (i < fragments.length - 1) {
        // Inline star
        const span = document.createElement("span");
        span.style.display = "inline-flex";
        span.style.alignItems = "center";
        span.style.position = "relative";

        const inlineStar = document.createElement("img");
        inlineStar.src = customStarURL;
        inlineStar.alt = "⭐";
        inlineStar.style.width = "1.2em";
        inlineStar.style.height = "1.2em";
        inlineStar.style.display = "inline-block";
        inlineStar.style.verticalAlign = "text-bottom";
        inlineStar.style.transform = "translateY(0.15em) scale(1.2)";

        span.appendChild(inlineStar);
        parent.insertBefore(span, textNode);

        // Floating star (same for BallerAlert)
        const floatingStar = document.createElement("img");
        floatingStar.src = customStarURL;
        floatingStar.alt = "⭐";
        floatingStar.style.width = "40px";
        floatingStar.style.height = "40px";
        floatingStar.style.position = "absolute";
        floatingStar.style.pointerEvents = "none";
        floatingStar.style.zIndex = "9999";

        // Get bounding rect relative to viewport + scroll
        const rect = inlineStar.getBoundingClientRect();
        floatingStar.style.top = `${rect.top + rect.height / 2 + window.scrollY}px`;
        floatingStar.style.left = `${rect.left + rect.width / 2 + window.scrollX}px`;
        floatingStar.style.transform = "translate(-50%, -50%) scale(0)";

        document.body.appendChild(floatingStar);

        floatingStar.animate([
          { transform: "translate(-50%, -50%) scale(0)", opacity: 0 },
          { transform: "translate(-50%, -50%) scale(1.2)", opacity: 1 },
          { transform: "translate(-50%, -50%) scale(1)", opacity: 1 }
        ], { duration: 600, easing: "ease-out" });

        setTimeout(() => floatingStar.remove(), 1500);
      }
    });

    parent.removeChild(textNode);
  });
}

// Observe dynamic content including BallerAlert
const observer = new MutationObserver(mutations => {
  mutations.forEach(m => {
    m.addedNodes.forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) replaceStarsWithSVG(node.parentNode);
      else if (node.nodeType === Node.ELEMENT_NODE) replaceStarsWithSVG(node);
    });
  });
});
observer.observe(document.body, { childList: true, subtree: true });

// Initial run
replaceStarsWithSVG();
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

/* ---------- DOM Elements ---------- */
const openBtn = document.getElementById("openHostsBtn");
const modal = document.getElementById("featuredHostsModal");
const closeModal = document.querySelector(".featured-close");
const videoFrame = document.getElementById("featuredHostVideo");
const usernameEl = document.getElementById("featuredHostUsername");
const detailsEl = document.getElementById("featuredHostDetails");
const hostListEl = document.getElementById("featuredHostList");
const giftBtn = document.getElementById("featuredGiftBtn");
const giftSlider = document.getElementById("giftSlider");
const giftAmountEl = document.getElementById("giftAmount");
const prevBtn = document.getElementById("prevHost");
const nextBtn = document.getElementById("nextHost");
const socialIconsContainer = document.getElementById("socialIcons"); // make sure you add this div in modal

let hosts = [];
let currentIndex = 0;

/* ---------- Social SVGs ---------- */
const icons = {
  whatsapp: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#25D366" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 2.12.626 4.084 1.707 5.733L2 22l4.414-1.707A9.955 9.955 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm5.44 14.28l-1.793.472c-.237.062-.483-.022-.635-.214l-.952-1.152a.502.502 0 0 0-.472-.19c-.36.04-1.146-.438-2.326-1.643-1.068-1.083-1.42-1.815-1.49-2.03-.07-.216-.004-.313.194-.44l1.392-1.05c.183-.138.204-.258.142-.445l-.626-1.79c-.072-.206-.192-.33-.42-.33h-2.058c-.205 0-.41.104-.593.29C7.755 6.59 6 9.04 6 12.001 6 16.42 9.582 20 14 20c2.96 0 5.41-1.755 6.17-4.21.185-.346.082-.564-.73-.51z"/></svg>`,
  telegram: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#0088cc" viewBox="0 0 24 24"><path d="M12 0C5.372 0 0 5.372 0 12c0 5.093 3.163 9.417 7.589 11.135.554.101.756-.24.756-.534 0-.263-.01-1.142-.015-2.067-3.088.671-3.738-1.49-3.738-1.49-.505-1.283-1.233-1.625-1.233-1.625-1.009-.69.077-.676.077-.676 1.115.078 1.7 1.147 1.7 1.147.993 1.7 2.604 1.21 3.24.925.102-.72.387-1.21.705-1.487-2.465-.28-5.054-1.232-5.054-5.482 0-1.211.433-2.198 1.144-2.973-.114-.282-.496-1.415.107-2.95 0 0 .933-.3 3.06 1.138a10.73 10.73 0 0 1 2.787-.375c.947.004 1.9.128 2.787.375 2.126-1.438 3.058-1.138 3.058-1.138.606 1.535.224 2.668.11 2.95.712.775 1.143 1.762 1.143 2.973 0 4.26-2.593 5.197-5.064 5.471.397.342.75 1.018.75 2.052 0 1.482-.013 2.678-.013 3.043 0 .296.2.64.763.532C20.841 21.416 24 17.092 24 12c0-6.628-5.372-12-12-12z"/></svg>`,
  instagram: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#C13584" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.849.07 1.366.062 2.633.344 3.608 1.32.975.976 1.257 2.242 1.32 3.608.058 1.265.07 1.645.07 4.849s-.012 3.584-.07 4.849c-.062 1.366-.345 2.633-1.32 3.608-.976.975-2.242 1.257-3.608 1.32-1.265.058-1.645.07-4.849.07s-3.584-.012-4.849-.07c-1.366-.062-2.633-.345-3.608-1.32-.975-.976-1.257-2.242-1.32-3.608-.058-1.265-.07-1.645-.07-4.849s.012-3.584.07-4.849c.062-1.366.345-2.633 1.32-3.608.976-.975 2.242-1.257 3.608-1.32C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.012 7.052.07 5.73.127 4.602.387 3.678 1.31 2.754 2.234 2.494 3.362 2.437 4.684.012 8.332 0 8.741 0 12c0 3.259.012 3.668.07 4.948.057 1.322.317 2.45 1.24 3.374.924.924 2.052 1.184 3.374 1.24C8.332 23.988 8.741 24 12 24s3.668-.012 4.948-.07c1.322-.057 2.45-.317 3.374-1.24.924-.924 1.184-2.052 1.24-3.374C23.988 15.668 24 15.259 24 12s-.012-3.668-.07-4.948c-.057-1.322-.317-2.45-1.24-3.374-.924-.924-2.052-1.184-3.374-1.24C15.668.012 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a3.999 3.999 0 1 1 0-7.998 3.999 3.999 0 0 1 0 7.998zm6.406-11.845a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z"/></svg>`,
  tiktok: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#000000" viewBox="0 0 24 24"><path d="M12 0C5.372 0 0 5.372 0 12c0 5.302 3.438 9.8 8.205 11.387.6.111.82-.261.82-.577 0-.285-.011-1.041-.017-2.044-3.338.726-4.042-1.609-4.042-1.609-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.604-2.665-.305-5.466-1.332-5.466-5.931 0-1.31.469-2.381 1.236-3.222-.123-.304-.536-1.527.117-3.176 0 0 1.008-.322 3.301 1.23a11.52 11.52 0 0 1 3.003-.404c1.019.005 2.046.138 3.003.404 2.291-1.552 3.297-1.23 3.297-1.23.655 1.649.242 2.872.119 3.176.77.841 1.235 1.912 1.235 3.222 0 4.609-2.804 5.624-5.475 5.922.429.369.812 1.096.812 2.209 0 1.594-.015 2.88-.015 3.272 0 .319.217.694.825.576C20.565 21.796 24 17.297 24 12c0-6.628-5.372-12-12-12z"/></svg>`
};

/* ---------- Fetch + Listen to featuredHosts + users merge ---------- */
async function fetchFeaturedHosts() {
  try {
    const q = collection(db, "featuredHosts");
    onSnapshot(q, async snapshot => {
      const tempHosts = [];

      for (const docSnap of snapshot.docs) {
        const hostData = { id: docSnap.id, ...docSnap.data() };
        let merged = { ...hostData };

        if (hostData.userId || hostData.chatId) {
          try {
            const userRef = doc(db, "users", hostData.userId || hostData.chatId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              merged = { ...merged, ...userSnap.data() };
            }
          } catch (err) {
            console.warn("⚠️ Could not fetch user for host:", hostData.userId || hostData.chatId, err);
          }
        }

        tempHosts.push(merged);
      }

      hosts = tempHosts;

      if (!hosts.length) {
        console.warn("⚠️ No featured hosts found.");
        return;
      }

      console.log("✅ Loaded hosts:", hosts.length);
      renderHostAvatars();
      loadHost(currentIndex >= hosts.length ? 0 : currentIndex);
    });
  } catch (err) {
    console.error("❌ Error fetching hosts:", err);
  }
}

/* ---------- Render Avatars ---------- */
function renderHostAvatars() {
  hostListEl.innerHTML = "";
  hosts.forEach((host, idx) => {
    const img = document.createElement("img");
    img.src = host.popupPhoto || "";
    img.alt = host.chatId || "Host";
    img.classList.add("featured-avatar");
    if (idx === currentIndex) img.classList.add("active");

    img.addEventListener("click", () => {
      loadHost(idx);
    });

    hostListEl.appendChild(img);
  });
}

/* ---------- Load Host ---------- */
function loadHost(idx) {
  const host = hosts[idx];
  if (!host) return;

  currentIndex = idx;

  // 🎥 Load video
  videoFrame.src = host.videoUrl || "";
  console.log("🎬 Loading host:", host.chatId || host.id);

  // 🧍 Username
  usernameEl.textContent = host.chatId || "Unknown Host";

  // 💬 Description
  const gender = (host.gender || "person").toLowerCase();
  const pronoun = gender === "male" ? "his" : "her";
  const ageGroup = !host.age ? "20s" : host.age >= 30 ? "30s" : "20s";
  const flair = gender === "male" ? "😎" : "💋";
  detailsEl.textContent = `A ${host.naturePick || "cool"} ${gender} in ${pronoun} ${ageGroup} ${flair}`;

  // Highlight avatar
  hostListEl.querySelectorAll("img").forEach((img, i) => {
    img.classList.toggle("active", i === idx);
  });

  // Reset slider
  giftSlider.value = 1;
  giftAmountEl.textContent = "1";

  // ---------- Socials ----------
  renderHostSocials(host);
}

/* ---------- Render Socials ---------- */
function renderHostSocials(host) {
  socialIconsContainer.innerHTML = ''; // clear old

  if (host.whatsapp) {
    const a = document.createElement('a');
    a.href = `https://wa.me/${host.whatsapp}?text=${encodeURIComponent(`Hi ${host.chatId}, I’m VIPName on XiXi live & I’d like to get to know you 😊`)}`;
    a.target = '_blank';
    a.innerHTML = icons.whatsapp;
    socialIconsContainer.appendChild(a);
  }

  if (host.telegram) {
    const a = document.createElement('a');
    a.href = `https://t.me/${host.telegram}?text=${encodeURIComponent(`Hi ${host.chatId}, I’m VIPName on XiXi live & I’d like to get to know you 😊`)}`;
    a.target = '_blank';
    a.innerHTML = icons.telegram;
    socialIconsContainer.appendChild(a);
  }

  if (host.instagram) {
    const a = document.createElement('a');
    a.href = host.instagram;
    a.target = '_blank';
    a.innerHTML = icons.instagram;
    socialIconsContainer.appendChild(a);
  }

  if (host.tiktok) {
    const a = document.createElement('a');
    a.href = host.tiktok;
    a.target = '_blank';
    a.innerHTML = icons.tiktok;
    socialIconsContainer.appendChild(a);
  }
}

/* ---------- Gift slider ---------- */
giftSlider.addEventListener("input", () => {
  giftAmountEl.textContent = giftSlider.value;
});

/* ---------- Send gift ---------- */
giftBtn.addEventListener("click", async () => {
  try {
    const host = hosts[currentIndex];
    if (!host?.id) {
      console.warn("⚠️ No host selected or host.id missing");
      showGiftAlert("⚠️ No host selected.");
      return;
    }

    if (!currentUser) {
      console.warn("⚠️ You must be logged in to send stars");
      showGiftAlert("Please log in to send stars ⭐");
      return;
    }

    const giftStars = parseInt(giftSlider.value, 10);
    if (isNaN(giftStars) || giftStars <= 0) {
      showGiftAlert("Invalid star amount ❌");
      return;
    }

    const senderRef = doc(db, "users", currentUser.uid);
    const senderSnap = await getDoc(senderRef);
    if (!senderSnap.exists()) {
      showGiftAlert("Your user record doesn’t exist ⚠️");
      return;
    }

    const senderData = senderSnap.data();
    const currentStars = senderData.stars || 0;

    if (currentStars < giftStars) {
      showGiftAlert(`You only have ${currentStars} ⭐ — not enough to send ${giftStars}.`);
      return;
    }

    const hostRef = doc(db, "featuredHosts", host.id);
    await Promise.all([
      updateDoc(senderRef, { stars: increment(-giftStars) }),
      updateDoc(hostRef, { stars: increment(giftStars), starsGifted: increment(giftStars) })
    ]);

    console.log(`✅ Sent ${giftStars} stars ⭐ to ${host.chatId}`);
    showGiftAlert(`You sent ${giftStars} stars ⭐ to ${host.chatId}!`);
  } catch (err) {
    console.error("Gift sending failed:", err);
    showGiftAlert("⚠️ Something went wrong sending your stars.");
  }
});

/* ---------- Navigation ---------- */
prevBtn.addEventListener("click", e => {
  e.preventDefault();
  loadHost((currentIndex - 1 + hosts.length) % hosts.length);
});

nextBtn.addEventListener("click", e => {
  e.preventDefault();
  loadHost((currentIndex + 1) % hosts.length);
});

/* ---------- Modal control ---------- */
openBtn.addEventListener("click", () => {
  modal.style.display = "flex";
  modal.style.justifyContent = "center";
  modal.style.alignItems = "center";
  console.log("📺 Modal opened");
});

closeModal.addEventListener("click", () => {
  modal.style.display = "none";
  console.log("❎ Modal closed");
});

window.addEventListener("click", e => {
  if (e.target === modal) {
    modal.style.display = "none";
    console.log("🪟 Modal dismissed");
  }
});

/* ---------- Init ---------- */
fetchFeaturedHosts();