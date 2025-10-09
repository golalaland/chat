// ================= APP.JS CLEAN WITH SCRAMBLE =================

// ---------- Imports ----------
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, doc, updateDoc, collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, increment, getDocs, deleteDoc, where, getDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDatabase, ref as rtdbRef, set as rtdbSet, onDisconnect, onValue } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// ---------- Firebase config ----------
const firebaseConfig = { 
  apiKey: "...", authDomain: "...", projectId: "...", storageBucket: "...",
  messagingSenderId: "...", appId: "...", databaseURL: "..."
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app);

// ---------- Room & chat ----------
const ROOM_ID = "room5";
const CHAT_COLLECTION = "messages_room5";

// ---------- State ----------
let currentUser = null;
let lastMessagesArray = [];

// ---------- Constants ----------
const BUZZ_COST = 50;
const SEND_COST = 1;

// ---------- Helpers ----------
function formatNumberWithCommas(n){ return new Intl.NumberFormat('en-NG').format(n||0); }
function randomColor(){ const colors = ["#FFD700","#FF69B4","#87CEEB","#90EE90","#FFB6C1","#FFA07A","#8A2BE2","#00BFA6","#F4A460"]; return colors[Math.floor(Math.random()*colors.length)]; }
function showStarPopup(text){ 
  const popup = document.getElementById("starPopup");
  const starText = document.getElementById("starText");
  if(!popup||!starText) return;
  starText.innerText = text;
  popup.style.display = "block";
  setTimeout(()=>{ popup.style.display="none"; }, 1700);
}
function sanitizeKey(key){ return key.replace(/[.#$[\]]/g, ','); }

// ---------- UI refs ----------
let refs = {};

// ---------- Redeem link update ----------
function updateRedeemLink(){ 
  if(refs.redeemBtn && currentUser){ 
    refs.redeemBtn.href = `https://golalaland.github.io/chat/nushop.html?uid=${encodeURIComponent(currentUser.uid)}`;
    refs.redeemBtn.style.display="inline-block"; 
  }
}

// ---------- Presence ----------
function setupPresence(user){ 
  if(!rtdb) return; 
  const pRef = rtdbRef(rtdb, `presence/${ROOM_ID}/${sanitizeKey(user.uid)}`);
  rtdbSet(pRef, {online:true, chatId:user.chatId, email:user.email}).catch(()=>{});
  onDisconnect(pRef).remove().catch(()=>{});
}
if(rtdb){ 
  onValue(rtdbRef(rtdb, `presence/${ROOM_ID}`), snap=>{
    const val = snap.val()||{};
    if(refs.onlineCountEl) refs.onlineCountEl.innerText=`(${Object.keys(val).length} online)`;
  });
}

// ---------- Users color listener ----------
function setupUsersListener(){
  onSnapshot(collection(db,"users"), snap=>{
    refs.userColors = refs.userColors || {};
    snap.forEach(d => refs.userColors[d.id] = d.data()?.usernameColor || "#ffffff");
    if(lastMessagesArray.length) renderMessagesFromArray(lastMessagesArray);
  });
}
setupUsersListener();

// ---------- Render messages ----------
let scrollPending = false;
function renderMessagesFromArray(arr){
  if(!refs.messagesEl) return;
  arr.forEach(item=>{
    if(document.getElementById(item.id)) return;
    const m = item.data;
    const wrapper = document.createElement("div");
    wrapper.className = "msg"; wrapper.id = item.id;

    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = (m.chatId || "Guest")+":";
    meta.style.color = (m.uid && refs.userColors && refs.userColors[m.uid])?refs.userColors[m.uid]:"#ffffff";
    meta.style.marginRight="4px";

    const content = document.createElement("span");
    content.className = m.highlight||m.buzzColor||m.scramble?"buzz-content content":"content";
    content.textContent = " "+(m.content||"");
    if(m.buzzColor) content.style.background = m.buzzColor;
    if(m.highlight||m.scramble){ content.style.color="#000"; content.style.fontWeight="700"; }

    wrapper.appendChild(meta);
    wrapper.appendChild(content);
    refs.messagesEl.appendChild(wrapper);
  });

  if(!scrollPending){
    scrollPending=true;
    requestAnimationFrame(()=>{
      const nearBottom = refs.messagesEl.scrollHeight - refs.messagesEl.scrollTop - refs.messagesEl.clientHeight < 50;
      if(arr.some(msg=>msg.data.uid===currentUser?.uid) || nearBottom) refs.messagesEl.scrollTop = refs.messagesEl.scrollHeight;
      scrollPending=false;
    });
  }
}

// ---------- Messages listener ----------
function attachMessagesListener(){
  const q = query(collection(db,CHAT_COLLECTION), orderBy("timestamp","asc"));
  onSnapshot(q, snapshot=>{
    snapshot.docChanges().forEach(change=>{
      if(change.type==="added"){
        const msgData = change.doc.data();
        lastMessagesArray.push({id:change.doc.id,data:msgData});
        renderMessagesFromArray([{id:change.doc.id,data:msgData}]);
      }
    });
  });
}

// ---------- VIP login ----------
async function loginWhitelist(email,phone){
  try{
    const q=query(collection(db,"whitelist"),where("email","==",email),where("phone","==",phone));
    const snap = await getDocs(q);
    if(snap.empty){ showStarPopup("You’re not on the whitelist."); return false; }

    const uidKey = sanitizeKey(email);
    const userRef = doc(db,"users",uidKey);
    const docSnap = await getDoc(userRef);
    if(!docSnap.exists()){ showStarPopup("User not found."); return false; }
    const data = docSnap.data() || {};

    currentUser = {
      uid: uidKey,
      email: data.email,
      phone: data.phone,
      chatId: data.chatId,
      chatIdLower: data.chatIdLower,
      stars: data.stars||0,
      cash: data.cash||0,
      usernameColor: data.usernameColor||randomColor(),
      isAdmin: data.isAdmin||false,
      isVIP: data.isVIP||false
    };

    localStorage.setItem("vipUser", JSON.stringify({email,phone}));

    afterLogin(); // <-- setup UI & admin buttons
    return true;
  }catch(e){ console.error(e); showStarPopup("Login failed."); return false; }
}

// ---------- SCRAMBLE MODULE ----------
window.currentScramble={letters:"",validWords:[],submissions:{}};
const DICTIONARY=["alert","later","slate","tails","stale","laser","rinse","aisle","inert","tales","lines","least","alter","slant","alien","resin","train","liner","snail","lairs","nails","sentinel"];
function shuffleArray(arr){return arr.sort(()=>Math.random()-0.5);}
function generateScramble(){ 
  const letters = shuffleArray("EARTLSIN".split("")).join(''); 
  const validWords = DICTIONARY.filter(w=> w.split("").every(l=>letters.includes(l)) && w.length>=5); 
  return {letters,validWords}; 
}
async function sendAdminScrambleBuzz(){
  if(!currentUser?.isAdmin) return;
  const {letters,validWords} = generateScramble();
  currentScramble.letters = letters;
  currentScramble.validWords = validWords;
  currentScramble.submissions = {};
  if(refs.scrambleBannerEl&&refs.scrambleLettersEl){ refs.scrambleLettersEl.textContent = letters; refs.scrambleBannerEl.style.display="block"; }
  const content = `🧩 SCRAMBLE ROUND! Letters (5+): ${letters}`;
  const docRef = await addDoc(collection(db,CHAT_COLLECTION), { content, uid:currentUser.uid, chatId:currentUser.chatId, timestamp:serverTimestamp(), highlight:true, buzzColor:"#FFD700", scramble:true });
  renderMessagesFromArray([{id:docRef.id,data:{content,uid:currentUser.uid,chatId:currentUser.chatId,highlight:true,buzzColor:"#FFD700",scramble:true}}]);
  setTimeout(endScrambleRound, 5*60*1000);
}
async function endScrambleRound(){
  const summary = Object.entries(currentScramble.submissions).map(([chatId,words])=>`${chatId}: ${words.join(", ")}`).join("\n")||"No submissions this round!";
  await addDoc(collection(db,CHAT_COLLECTION), { content:`📝 Round Over! Words submitted:\n${summary}`, uid:currentUser.uid, chatId:currentUser.chatId, timestamp:serverTimestamp(), highlight:true, buzzColor:"#FFA500", scramble:true });
  currentScramble.letters=""; currentScramble.validWords=[]; currentScramble.submissions={};
  if(refs.scrambleBannerEl) refs.scrambleBannerEl.style.display="none";
}
async function handlePlayerSubmission(txt){
  if(!currentScramble.letters||!currentScramble.validWords.length) return;
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
  if(refs.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);
  const content = `✅ ${currentUser.chatId} found: ${word}`;
  const docRef = await addDoc(collection(db,CHAT_COLLECTION), { content, uid:currentUser.uid, chatId:currentUser.chatId, timestamp:serverTimestamp(), highlight:true, buzzColor:"#C8E6C9", scramble:true });
  renderMessagesFromArray([{id:docRef.id,data:{content,uid:currentUser.uid,chatId:currentUser.chatId,highlight:true,buzzColor:"#C8E6C9",scramble:true}}]);
  showStarPopup(`✅ Correct! +${rewardStars} stars`);
}

// ---------- Admin Controls Setup ----------
function setupAdminControls() {
  if(!refs.adminScrambleBtn) return;
  refs.adminScrambleBtn.style.display = currentUser?.isAdmin ? "inline-block" : "none";
  refs.adminScrambleBtn.addEventListener("click", async () => {
    if(!currentUser?.isAdmin){
      showStarPopup("Only admins can start a scramble!");
      return;
    }
    await sendAdminScrambleBuzz();
  });
}

// ---------- After login ----------
function afterLogin() {
  updateRedeemLink();
  setupPresence(currentUser);
  attachMessagesListener();
  setupAdminControls();

  if(refs.authBox) refs.authBox.style.display="none";
  if(refs.sendAreaEl) refs.sendAreaEl.style.display="flex";
  if(refs.profileBoxEl) refs.profileBoxEl.style.display="block";
  if(refs.profileNameEl){ 
    refs.profileNameEl.innerText = currentUser.chatId; 
    refs.profileNameEl.style.color = currentUser.usernameColor; 
  }
  if(refs.starCountEl) refs.starCountEl.innerText = formatNumberWithCommas(currentUser.stars);
  if(refs.cashCountEl) refs.cashCountEl.innerText = formatNumberWithCommas(currentUser.cash);
  if(refs.adminControlsEl) refs.adminControlsEl.style.display = currentUser.isAdmin?"flex":"none";
}

// ---------- DOMContentLoaded ----------
window.addEventListener("DOMContentLoaded",()=>{

  refs = {
    authBox:document.getElementById("authBox"),
    messagesEl:document.getElementById("messages"),
    sendAreaEl:document.getElementById("sendArea"),
    messageInputEl:document.getElementById("messageInput"),
    sendBtn:document.getElementById("sendBtn"),
    buzzBtn:document.getElementById("buzzBtn"),
    profileBoxEl:document.getElementById("profileBox"),
    profileNameEl:document.getElementById("profileName"),
    starCountEl:document.getElementById("starCount"),
    cashCountEl:document.getElementById("cashCount"),
    redeemBtn:document.getElementById("redeemBtn"),
    onlineCountEl:document.getElementById("onlineCount"),
    adminControlsEl:document.getElementById("adminControls"),
    adminClearMessagesBtn:document.getElementById("adminClearMessagesBtn"),
    scrambleBannerEl:document.getElementById("scrambleBanner"),
    scrambleLettersEl:document.getElementById("scrambleLetters"),
    scrambleLeaderboardEl:document.getElementById("scrambleLeaderboard"),
    adminScrambleBtn:document.getElementById("adminScrambleBtn")
  };

  // ---------- Login ----------
  const emailInput = document.getElementById("emailInput");
  const phoneInput = document.getElementById("phoneInput");
  const loginBtn = document.getElementById("whitelistLoginBtn");

  if(loginBtn){ 
    loginBtn.addEventListener("click", async ()=>{
      const email=(emailInput.value||"").trim().toLowerCase();
      const phone=(phoneInput.value||"").trim();
      if(!email||!phone){ showStarPopup("Enter your email and phone"); return; }
      await loginWhitelist(email,phone);
    });
  }

  // ---------- Auto-login ----------
  const vipUser = JSON.parse(localStorage.getItem("vipUser"));
  if(vipUser?.email&&vipUser?.phone){ 
    (async()=>{ await loginWhitelist(vipUser.email,vipUser.phone); })(); 
  }

  // ---------- Send & BUZZ ----------
  refs.sendBtn?.addEventListener("click", async () => {
    if(!currentUser) return showStarPopup("Sign in to chat");
    const txt = refs.messageInputEl?.value.trim();
    if(!txt) return showStarPopup("Type a message");

    if(currentScramble.letters){
      await handlePlayerSubmission(txt);
      refs.messageInputEl.value="";
      return;
    }

    const userRef = doc(db,"users",currentUser.uid);
    const snap = await getDoc(userRef);
    if((snap.data()?.stars||0)<SEND_COST) return showStarPopup("Not enough stars");
    await updateDoc(userRef,{stars:increment(-SEND_COST)});
    currentUser.stars -= SEND_COST;
    if(refs.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);

    const docRef = await addDoc(collection(db,CHAT_COLLECTION),{
      content: txt,
      uid: currentUser.uid,
      chatId: currentUser.chatId,
      timestamp: serverTimestamp(),
      highlight:true,
      buzzColor: randomColor()
    });
    refs.messageInputEl.value="";
    renderMessagesFromArray([{id:docRef.id,data:{content:txt,uid:currentUser.uid,chatId:currentUser.chatId,highlight:true,buzzColor:randomColor()}}]);
  });

  refs.buzzBtn?.addEventListener("click", async () => {
    if(!currentUser) return showStarPopup("Sign in to BUZZ");
    const txt = refs.messageInputEl?.value.trim(); 
    if(!txt) return showStarPopup("Type a message to BUZZ 🚨");

    const userRef = doc(db,"users",currentUser.uid); 
    const snap = await getDoc(userRef);
    if((snap.data()?.stars||0)<BUZZ_COST) return showStarPopup("Not enough stars");
    await updateDoc(userRef,{stars:increment(-BUZZ_COST)});
    currentUser.stars -= BUZZ_COST;
    if(refs.starCountEl) refs.starCountEl.textContent = formatNumberWithCommas(currentUser.stars);

    const buzzColor = randomColor();
    const docRef = await addDoc(collection(db,CHAT_COLLECTION),{
      content: txt,
      uid: currentUser.uid,
      chatId: currentUser.chatId,
      timestamp: serverTimestamp(),
      highlight:true,
      buzzColor
    });
    refs.messageInputEl.value=""; 
    showStarPopup("BUZZ sent!");
    renderMessagesFromArray([{id:docRef.id,data:{content:txt,uid:currentUser.uid,chatId:currentUser.chatId,highlight:true,buzzColor}}]);
  });

  // ---------- Admin Clear Messages ----------
  refs.adminClearMessagesBtn?.addEventListener("click", async () => { 
    if(!currentUser?.isAdmin) return; 
    const snap = await getDocs(collection(db,CHAT_COLLECTION)); 
    snap.forEach(docSnap => deleteDoc(doc(db,CHAT_COLLECTION,docSnap.id))); 
  });

});