// ==========================
// app.js - FULL INTEGRATED VERSION
// Chatroom + BUZZ + Scramble 🧩
// ==========================

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
const ROOM_ID = "room6";
const CHAT_COLLECTION = "messages_room6";

/* ---------- State ---------- */
let currentUser = null;
let lastMessagesArray = [];
let starInterval = null;
let refs = {}; // DOM references

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
    meta.textContent = (m.chatId || "Guest") + ":";
    meta.style.color = (m.uid && refs.userColors && refs.userColors[m.uid]) ? refs.userColors[m.uid] : '#ffffff';
    meta.style.marginRight = "4px";

    const content = document.createElement("span");
    content.className = "content";
    content.textContent = " " + (m.content || "");

    // Scramble messages styling
    if (m.scramble) {
      content.style.fontFamily = "'Courier New', Courier, monospace";
      content.style.fontSize = "1.1em";
      content.style.fontWeight = "700";
      if (m.buzzColor) content.style.background = m.buzzColor;
      content.style.padding = "2px 4px";
      content.style.borderRadius = "4px";
    } else {
      if (m.buzzColor) content.style.background = m.buzzColor;
      if (m.highlight) { content.style.color = "#000"; content.style.fontWeight = "700"; }
    }

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

  window.addEventListener("beforeunload", () => clearInterval(starInterval));
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
    adminControlsEl: document.getElementById("adminControls")
  };

  /* ---------- VIP login (whitelist) ---------- */
  const loginBtn = document.getElementById("whitelistLoginBtn");
  const emailInput = document.getElementById("emailInput");
  const phoneInput = document.getElementById("phoneInput");

  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const email = (emailInput.value || "").trim().toLowerCase();
      const phone = (phoneInput.value || "").trim();
      if (!email || !phone) return showStarPopup("Enter email & phone");

      // VIP login logic here...
      // After login, attach listeners
      attachMessagesListener();
      startStarEarning(currentUser.uid);
    });
  }

  /* ---------- BUZZ Button ---------- */
  refs.buzzBtn?.addEventListener("click", async () => {
    if (!currentUser) return showStarPopup("Sign in to BUZZ");

    const txt = refs.messageInputEl?.value.trim();
    if (!txt) return showStarPopup("Type a message to BUZZ 🚨");

    // Handle scramble submission if active
    if(currentScramble.letters) await handlePlayerSubmission(txt);

    // Deduct stars for normal BUZZ
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
  });

// ---------------- SCRAMBLE BANNER ----------------
refs.scrambleBannerEl = document.getElementById("scrambleBanner");
refs.scrambleLettersEl = document.getElementById("scrambleLetters");

// Show letters when scramble starts
async function sendAdminScrambleBuzz(){
  if(!currentUser?.isAdmin) return;
  const { letters, validWords } = generateScramble();
  currentScramble.letters = letters;
  currentScramble.validWords = validWords;
  currentScramble.submissions = {};

  // Update UI banner
  if(refs.scrambleBannerEl && refs.scrambleLettersEl){
      refs.scrambleLettersEl.textContent = letters;
      refs.scrambleBannerEl.style.display = "block";
  }

  const content = `🧩 SCRAMBLE ROUND! Letters (5+): ${letters}`;
  const docRef = await addDoc(collection(db, CHAT_COLLECTION), {
    content, uid:currentUser.uid, chatId:currentUser.chatId,
    timestamp:serverTimestamp(), highlight:true, buzzColor:"#FFD700", scramble:true
  });
  renderMessagesFromArray([{id:docRef.id,data:{content,uid:currentUser.uid,chatId:currentUser.chatId,highlight:true,buzzColor:"#FFD700",scramble:true}}]);

  setTimeout(endScrambleRound, 5*60*1000); // 5 min round
}

// Hide banner when scramble ends
async function endScrambleRound(){
  if(!currentUser?.isAdmin) return;
  const summary = Object.entries(currentScramble.submissions)
    .map(([chatId, words])=>`${chatId}: ${words.join(", ")}`).join("\n")||"No submissions this round!";

  await addDoc(collection(db,CHAT_COLLECTION),{
    content:`📝 Round Over! Words submitted:\n${summary}`,
    uid:currentUser.uid, chatId:currentUser.chatId,
    timestamp:serverTimestamp(), highlight:true, buzzColor:"#FFA500", scramble:true
  });

  currentScramble.letters = "";
  currentScramble.validWords = [];
  currentScramble.submissions = {};

  // Hide UI banner
  if(refs.scrambleBannerEl){
      refs.scrambleBannerEl.style.display = "none";
  }
}
  // ---------------- SCRAMBLE MODULE ----------------
  window.currentScramble = { letters: "", validWords: [], submissions: {} };
  const DICTIONARY = ["alert","later","slate","tails","stale","laser","rinse","aisle","inert","tales","lines","least","alter","slant","alien","resin","train","liner","snail","lairs","nails","sentinel"];

  function shuffleArray(arr){ return arr.sort(() => Math.random() - 0.5); }

  function generateScramble(){
    const letters = shuffleArray("EARTLSIN".split("")).join('');
    const validWords = DICTIONARY.filter(w=>w.split("").every(l=>letters.includes(l)) && w.length>=5);
    return { letters, validWords };
  }

  async function sendAdminScrambleBuzz(){
    if(!currentUser?.isAdmin) return;
    const { letters, validWords } = generateScramble();
    currentScramble.letters = letters;
    currentScramble.validWords = validWords;
    currentScramble.submissions = {};

    const content = `🧩 SCRAMBLE ROUND! Letters (5+): ${letters}`;
    const docRef = await addDoc(collection(db, CHAT_COLLECTION), {
      content, uid: currentUser.uid, chatId: currentUser.chatId,
      timestamp: serverTimestamp(), highlight:true, buzzColor:"#FFD700", scramble:true
    });
    renderMessagesFromArray([{id:docRef.id,data:{content,uid:currentUser.uid,chatId:currentUser.chatId,highlight:true,buzzColor:"#FFD700",scramble:true}}]);

    setTimeout(endScrambleRound, 5*60*1000);
  }

  async function handlePlayerSubmission(txt){
    if(!currentScramble.letters || !currentScramble.validWords.length) return;
    const word = txt.trim().toLowerCase();
    if(!currentScramble.validWords.includes(word)) return showStarPopup("❌ Invalid word!");

    const allSubmitted = Object.values(currentScramble.submissions).flat();
    if(allSubmitted.includes(word)) return showStarPopup("⚠️ Word already used!");

    currentScramble.submissions[currentUser.chatId] = currentScramble.submissions[currentUser.chatId]||[];
    currentScramble.submissions[currentUser.chatId].push(word);

    const rewardStars = 20;
    const userRef = doc(db,"users",currentUser.uid);
    await updateDoc(userRef,{stars:increment(rewardStars)});
    currentUser.stars += rewardStars;

    const docRef = await addDoc(collection(db,CHAT_COLLECTION),{
      content:`✅ ${currentUser.chatId} found: ${word}`,
      uid:currentUser.uid, chatId:currentUser.chatId,
      timestamp:serverTimestamp(), highlight:true, buzzColor:"#C8E6C9", scramble:true
    });
    renderMessagesFromArray([{id:docRef.id,data:{content:`✅ ${currentUser.chatId} found: ${word}`,uid:currentUser.uid,chatId:currentUser.chatId,highlight:true,buzzColor:"#C8E6C9",scramble:true}}]);

    showStarPopup(`✅ Correct! +${rewardStars} stars`);
    showLeaderboard();
  }

  async function endScrambleRound(){
    if(!currentUser?.isAdmin) return;
    const summary = Object.entries(currentScramble.submissions)
      .map(([chatId, words])=>`${chatId}: ${words.join(", ")}`).join("\n")||"No submissions this round!";

    await addDoc(collection(db,CHAT_COLLECTION),{
      content:`📝 Round Over! Words submitted:\n${summary}`,
      uid:currentUser.uid, chatId:currentUser.chatId,
      timestamp:serverTimestamp(), highlight:true, buzzColor:"#FFA500", scramble:true
    });

    currentScramble.letters=""; currentScramble.validWords=[]; currentScramble.submissions={};
  }

  function showLeaderboard(){
    const leaderboard = Object.entries(currentScramble.submissions)
      .map(([chatId, words])=>({chatId,count:words.length}))
      .sort((a,b)=>b.count-a.count);
    const content = leaderboard.length ? "🏆 Leaderboard:\n"+leaderboard.map(p=>`${p.chatId}: ${p.count}`).join("\n") : "";
    if(!content) return;
    addDoc(collection(db,CHAT_COLLECTION),{
      content, uid:currentUser.uid, chatId:currentUser.chatId,
      timestamp:serverTimestamp(), highlight:true, buzzColor:"#FFD700", scramble:true
    });
  }

  if(currentUser?.isAdmin) setInterval(sendAdminScrambleBuzz, 31*60*1000);

}); // end DOMContentLoaded