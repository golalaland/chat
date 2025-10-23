import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Firebase config ----------
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

// ---------- CONFIG ----------
const INITIAL_POT       = 1_000_000; 
const DEDUCT_PER_WIN    = 1_000;     
const REWARD_TO_USER    = 1_000;     
const STARS_PER_WIN     = 40;        
const NUM_BLOCKS        = 8;
const STAR_COST         = 10;

// ---------- UI Refs ----------
const joinTrainBtn      = document.getElementById('joinTrainBtn');
const confirmModal      = document.getElementById('confirmModal');
const confirmYes        = document.getElementById('confirmYes');
const confirmNo         = document.getElementById('confirmNo');
const loadingContainer  = document.getElementById('loadingContainer');
const loadingBar        = document.getElementById('loadingBar');
const trainEmoji        = document.getElementById('trainEmoji');
const problemBoard      = document.getElementById('problemBoard');
const submitAnswersBtn  = document.getElementById('submitAnswers');
const popupEl           = document.getElementById('popup'); 
const dailyPotEl        = document.getElementById('dailyPot');
const closedOverlay     = document.getElementById('closedOverlay');
const reopenCountdown   = document.getElementById('reopenCountdown');
const confirmText       = document.getElementById('confirmText');

const trainNameEl       = document.getElementById('trainName');
const trainDateEl       = document.getElementById('trainDate');
const trainTimeEl       = document.getElementById('trainTime');
const trainDestinationEl= document.getElementById('trainDestination');

const profileNameEl     = document.getElementById('profileName');
const starCountEl       = document.getElementById('starCount');
const cashCountEl       = document.getElementById('cashCount');

// ---------- STATE ----------
let currentUser = null;
let loadingInterval = null;
let loadingProgress = 0;
let trainActive = false;
let currentProblems = [];

// ---------- SOUND ----------
const SOUND_PATHS = {
  start:  './sounds/train_start.mp3',
  depart: './sounds/train_depart.mp3',
  whistle:'./sounds/train_whistle.mp3',
  ding:   './sounds/cha_ching.mp3',
  error:  './sounds/error_bell.mp3'
};
function playAudio(src, opts = {}) {
  if (!src) return;
  try {
    const a = new Audio(src);
    a.volume = opts.volume ?? 0.8;
    if (opts.loop) a.loop = true;
    a.play().catch(()=>{});
    return a;
  } catch(e){}
}

// ---------- Firestore helpers ----------
async function getUserDoc() {
  if (!currentUser || !currentUser.uid) throw new Error("No currentUser");
  const ref = doc(db, 'moneyTrainUsers', currentUser.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { pot: INITIAL_POT, stars: 50, cash: 0, lastReset: new Date().toISOString().slice(0,10) });
    return { pot: INITIAL_POT, stars: 50, cash: 0, lastReset: new Date().toISOString().slice(0,10) };
  }
  return snap.data();
}

async function updateUserField(field, value) {
  if (!currentUser || !currentUser.uid) return;
  const ref = doc(db, 'moneyTrainUsers', currentUser.uid);
  await updateDoc(ref, { [field]: value });
}

async function updatePot(value) {
  await updateUserField('pot', value);
  dailyPotEl.textContent = value.toLocaleString();
}

// ---------- TERMINAL ----------
const trainNames = ["Money Express","Starliner 9000","Frenzy Rail","Lucky Cargo","Fortune Flyer","Crypto Cruiser","Golden Dash","Midnight Ride"];
const destinations = ["Lagos","Accra","Nairobi","Cape Town","Johannesburg","Abuja","Kigali","London","Dubai","New York"];

function setTrainTerminal(){
  if (trainActive) return;
  const name = trainNames[Math.floor(Math.random()*trainNames.length)];
  const dest = destinations[Math.floor(Math.random()*destinations.length)];
  const date = new Date().toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
  if (trainNameEl) trainNameEl.textContent = name;
  if (trainDateEl) trainDateEl.textContent = date;
  if (trainDestinationEl) trainDestinationEl.textContent = dest;
  if (confirmText) confirmText.textContent = `Join ${name} → ${dest}? Ready to play?`;
}

function updateTrainTime(){
  if (!trainTimeEl) return;
  const now = new Date();
  trainTimeEl.textContent = now.toLocaleTimeString('en-GB',{hour12:false});
}

// ---------- POPUP ----------
let popupTimeout = null;
function showPopup(text, ms=1800){
  if (!popupEl) return;
  popupEl.textContent = text;
  popupEl.style.display = 'block';
  popupEl.style.opacity = '1';
  if (popupTimeout) clearTimeout(popupTimeout);
  popupTimeout = setTimeout(()=>{
    popupEl.style.opacity = '0';
    setTimeout(()=>{ popupEl.style.display = 'none'; }, 300);
  }, ms);
}

// ---------- PROBLEMS ----------
function generateProblems(){
  currentProblems = [];
  problemBoard.innerHTML = '';
  for (let i=0;i<NUM_BLOCKS;i++){
    let a = Math.floor(Math.random()*20)+1;
    let b = Math.floor(Math.random()*20)+1;
    if (a<b) [a,b] = [b,a];
    currentProblems.push({a,b,ans:a+b});
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '6px';
    wrapper.style.margin = '6px';
    const label = document.createElement('div');
    label.textContent = `${a} + ${b}`;
    label.style.fontWeight = '700';
    label.style.fontSize = '12px';
    label.style.color = '#fff';
    const input = document.createElement('input');
    input.type='number'; input.className='problemInput'; input.placeholder='?';
    input.dataset.index = i;
    input.style.width='60px'; input.style.padding='6px';
    input.style.borderRadius='6px'; input.style.border='1px solid rgba(255,255,255,0.12)';
    input.style.background='#0e0e0e'; input.style.color='#fff'; input.style.textAlign='center';
    wrapper.appendChild(label); wrapper.appendChild(input); problemBoard.appendChild(wrapper);
  }
  submitAnswersBtn.style.display='block'; submitAnswersBtn.disabled=true; submitAnswersBtn.style.opacity='0.6';
  const inputs = problemBoard.querySelectorAll('.problemInput');
  function checkFilled(){
    const allFilled = Array.from(inputs).every(i=>i.value.trim()!=='');
    submitAnswersBtn.disabled = !allFilled;
    submitAnswersBtn.style.opacity = allFilled?'1':'0.6';
  }
  inputs.forEach(i=>i.addEventListener('input',checkFilled));
  checkFilled();
}

// ---------- LOADING BAR ----------
function startLoadingBar(){
  loadingContainer.style.display='block'; loadingProgress=0; loadingBar.style.width='0%'; trainEmoji.style.left='0px';
  playAudio(SOUND_PATHS.start,true);
  loadingInterval = setInterval(()=>{
    loadingProgress++;
    const percent=(loadingProgress/39)*100;
    loadingBar.style.width=`${percent}%`;
    trainEmoji.style.left=`calc(${percent}% - 12px)`;
    if(loadingProgress>=39){
      clearInterval(loadingInterval); loadingInterval=null;
      if(trainActive){ trainActive=false; stopLoadingBar(); playAudio(SOUND_PATHS.depart); endTrain(false); }
    }
  },1000);
}
function stopLoadingBar(){ if(loadingInterval){clearInterval(loadingInterval); loadingInterval=null;} loadingContainer.style.display='none'; loadingBar.style.width='0%'; trainEmoji.style.left='0px'; }

// ---------- START/END TRAIN ----------
async function startTrain(){
  const userData = await getUserDoc();
  if(userData.pot<=0){showPopup('🚧 Station closed for today.'); return;}
  if(userData.stars<STAR_COST){showPopup('Not enough stars to join.'); return;}
  await updateUserField('stars', userData.stars-STAR_COST);
  trainActive=true; joinTrainBtn.style.display='none'; generateProblems(); problemBoard.classList.remove('hidden'); submitAnswersBtn.style.display='block';
  submitAnswersBtn.disabled=true; submitAnswersBtn.style.opacity='0.6'; startLoadingBar(); playAudio(SOUND_PATHS.whistle);
}

async function endTrain(success,ticketNumber=null){
  stopLoadingBar();
  problemBoard.classList.add('hidden'); submitAnswersBtn.style.display='none';
  const userData = await getUserDoc();
  if(success){
    const newCash = (userData.cash||0)+REWARD_TO_USER;
    const newStars = (userData.stars||0)+STARS_PER_WIN;
    await updateUserField('cash', newCash);
    await updateUserField('stars', newStars);
    const newPot = Math.max(0,(userData.pot||INITIAL_POT)-DEDUCT_PER_WIN);
    await updatePot(newPot);
    showPopup(`🎫 Ticket #${ticketNumber||'---'} — you earned ₦${REWARD_TO_USER.toLocaleString()}!`,4500);
    if(newPot<=0) handleStationClosed();
  }else{
    showPopup('Train left! You got nothing 😢',2200);
  }
  joinTrainBtn.style.display='block'; joinTrainBtn.disabled=false; joinTrainBtn.style.opacity='1';
}

// ---------- SUBMIT ANSWERS ----------
submitAnswersBtn.addEventListener('click',async()=>{
  if(!trainActive)return;
  const inputs = Array.from(document.querySelectorAll('.problemInput'));
  if(inputs.some(i=>i.value==='')){showPopup("Finish all problems!",2400); playAudio(SOUND_PATHS.error); return;}
  let allCorrect = true;
  inputs.forEach((inp,i)=>{ if(parseInt(inp.value,10)!==currentProblems[i].ans) allCorrect=false; });
  trainActive=false; stopLoadingBar();
  if(allCorrect){ const ticket = inputs.map(i=>String(parseInt(i.value,10))).join(''); await endTrain(true,ticket); }
  else{ showPopup("Some answers are incorrect!",3000); playAudio(SOUND_PATHS.depart); await endTrain(false);}
});

// ---------- JOIN MODAL ----------
joinTrainBtn.addEventListener('click',()=>{ if(joinTrainBtn.disabled)return; confirmModal.style.display='flex'; playAudio(SOUND_PATHS.whistle); });
confirmYes.addEventListener('click',()=>{ confirmModal.style.display='none'; startTrain(); });
confirmNo.addEventListener('click',()=>{ confirmModal.style.display='none'; });

// ---------- MIDNIGHT RESET ----------
async function resetPotIfNeeded(){
  if(!currentUser?.uid) return;
  const ref = doc(db,'moneyTrainUsers',currentUser.uid);
  const snap = await getDoc(ref);
  if(!snap.exists()) return;
  const data = snap.data();
  const today = new Date().toISOString().slice(0,10);
  if(data.lastReset !== today){
    await updateDoc(ref,{pot:INITIAL_POT,lastReset:today});
    dailyPotEl.textContent = INITIAL_POT.toLocaleString();
    showPopup('🔁 Pot reset! Station reopened.',3000);
    if(closedOverlay.classList.contains('hidden')===false){
      closedOverlay.classList.add('hidden'); joinTrainBtn.disabled=false; joinTrainBtn.style.opacity='1';
    }
  }
}

function timeToNextMidnight(){ const now=new Date(); const t=new Date(now); t.setDate(now.getDate()+1); t.setHours(0,0,0,0); return Math.max(0,t-now); }
function formatHMS(ms){ const s=Math.floor(ms/1000); const hh=String(Math.floor(s/3600)).padStart(2,'0'); const mm=String(Math.floor((s%3600)/60)).padStart(2,'0'); const ss=String(s%60).padStart(2,'0'); return `${hh}:${mm}:${ss}`; }

let countdownTimer=null;
async function handleStationClosed(){
  closedOverlay.classList.remove('hidden'); joinTrainBtn.disabled=true; joinTrainBtn.style.opacity='0.5';
  if(countdownTimer) clearInterval(countdownTimer);
  async function tick(){ const ms=timeToNextMidnight(); if(reopenCountdown) reopenCountdown.textContent=formatHMS(ms); if(ms<=0){ clearInterval(countdownTimer); await resetPotIfNeeded(); } }
  tick(); countdownTimer=setInterval(tick,1000); playAudio(SOUND_PATHS.depart);
}

// ---------- INIT ----------
async function init(){
  currentUser = JSON.parse(localStorage.getItem('currentUser')||'null');
  if(!currentUser){ showPopup('Please login first!'); joinTrainBtn.disabled=true; return; }
  const userData = await getUserDoc();
  if(profileNameEl) profileNameEl.textContent=currentUser.displayName||'GUEST 0000';
  if(starCountEl) starCountEl.textContent=userData.stars||'50';
  if(cashCountEl) cashCountEl.textContent=userData.cash||'0';
  setTrainTerminal(); setInterval(setTrainTerminal,60000); setInterval(updateTrainTime,1000); updateTrainTime();
  if(userData.pot<=0) await handleStationClosed();
  else dailyPotEl.textContent=userData.pot.toLocaleString();
  const msToMid=timeToNextMidnight(); setTimeout(resetPotIfNeeded,msToMid+1000); setInterval(resetPotIfNeeded,60000);
}
init();