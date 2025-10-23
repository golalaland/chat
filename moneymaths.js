import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  collection,
  getDocs,
  runTransaction,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ------------------ Firebase ------------------ */
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

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, runTransaction, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ------------------ Firebase ------------------ */
const firebaseConfig = {
  apiKey: "AIzaSyDbKz4ef_eUDlCukjmnK38sOwueYuzqoao",
  authDomain: "metaverse-1010.firebaseapp.com",
  projectId: "metaverse-1010",
  storageBucket: "metaverse-1010.appspot.com",
  messagingSenderId: "1044064238233",
  appId: "1:1044064238233:web:2fbdfb811cb0a3ba349608",
  measurementId: "G-S77BMC266C",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------------- Config ---------------- */
const INITIAL_POT = 1_000_000; 
const DEDUCT_PER_WIN = 1_000;  
const REWARD_TO_USER = 1_000;  
const STARS_PER_WIN = 40;      
const NUM_BLOCKS = 8;
const STAR_COST = 10;          

/* ---------------- UI Refs ---------------- */
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

/* ---------------- Auto-login ---------------- */
const uid = localStorage.getItem('user_uid');
if (!uid) {
  alert("Please login in the chatroom first!");
  window.location.href = '/chatroom-login.html';
  throw new Error("User not logged in");
}

/* ---------------- Sounds ---------------- */
const SOUND_PATHS = {
  start: './sounds/train_start.mp3',
  depart: './sounds/train_depart.mp3',
  whistle: './sounds/train_whistle.mp3',
  ding: './sounds/cha_ching.mp3',
  error: './sounds/error_bell.mp3',
  ambience: './sounds/train_ambience.mp3'
};
function playAudio(src, opts={}) {
  if (!src) return;
  try {
    const a = new Audio(src);
    a.volume = opts.volume ?? 0.8;
    if (opts.loop) a.loop = true;
    a.play().catch(()=>{});
    return a;
  } catch(e){}
}

/* ---------------- State ---------------- */
let loadingInterval=null, loadingProgress=0, trainActive=false;
let currentProblems=[], trainAmbienceLoop=null, popupTimeout=null, countdownTimer=null;

/* ---------------- Firestore references ---------------- */
const userRef = doc(db, 'users', uid);
const potRef  = doc(db, 'moneyTrain', 'global');

/* ---------------- Firestore helpers ---------------- */
async function fetchUser() {
  const snap = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, { name: profileNameEl.textContent||'GUEST 0000', stars:50, cash:0 });
    profileNameEl.textContent='GUEST 0000';
    starCountEl.textContent='50';
    cashCountEl.textContent='0';
  } else {
    const data = snap.data();
    profileNameEl.textContent=data.name||'GUEST 0000';
    starCountEl.textContent=data.stars ?? 50;
    cashCountEl.textContent=data.cash ?? 0;
  }
}

async function fetchPot() {
  const snap = await getDoc(potRef);
  if (!snap.exists()) {
    await setDoc(potRef, { dailyPot: INITIAL_POT, lastResetDay: new Date().toISOString().slice(0,10), halfAlertDate:'' });
    dailyPotEl.textContent = INITIAL_POT.toLocaleString();
    return INITIAL_POT;
  } else {
    const data = snap.data();
    dailyPotEl.textContent = (data.dailyPot ?? INITIAL_POT).toLocaleString();
    return data.dailyPot ?? INITIAL_POT;
  }
}

async function updateUserStats(cashChange=0, starsChange=0) {
  await runTransaction(db, async t=>{
    const snap = await t.get(userRef);
    if (!snap.exists()) {
      t.set(userRef, { name: profileNameEl.textContent, cash: cashChange, stars: starsChange });
    } else {
      const data = snap.data();
      t.update(userRef,{
        cash: (data.cash??0)+cashChange,
        stars: (data.stars??0)+starsChange
      });
    }
  });
}

async function updatePot(delta) {
  await runTransaction(db, async t=>{
    const snap = await t.get(potRef);
    let pot = INITIAL_POT;
    if (!snap.exists()) {
      pot = Math.max(0, INITIAL_POT - delta);
      t.set(potRef, { dailyPot: pot, lastResetDay: new Date().toISOString().slice(0,10), halfAlertDate:'' });
    } else {
      pot = Math.max(0, (snap.data().dailyPot ?? INITIAL_POT) - delta);
      t.update(potRef,{ dailyPot: pot });
      if (pot<=0) handleStationClosed();
    }
    dailyPotEl.textContent = pot.toLocaleString();
  });
}

/* ---------------- Real-time pot updates ---------------- */
onSnapshot(potRef, snap=>{
  if (!snap.exists()) return;
  const pot = snap.data().dailyPot ?? INITIAL_POT;
  dailyPotEl.textContent = pot.toLocaleString();
  if (pot <= 0) handleStationClosed();
});

/* ---------------- Popup ---------------- */
function showPopup(text, ms=1800) {
  if (!popupEl) return;
  popupEl.textContent=text;
  popupEl.style.display='block';
  popupEl.style.opacity='1';
  if (popupTimeout) clearTimeout(popupTimeout);
  popupTimeout = setTimeout(()=>{
    popupEl.style.opacity='0';
    setTimeout(()=>{ popupEl.style.display='none'; },300);
  }, ms);
}

/* ---------------- Terminal ---------------- */
const trainNames=["Money Express","Starliner 9000","Frenzy Rail","Lucky Cargo","Fortune Flyer","Crypto Cruiser","Golden Dash","Midnight Ride"];
const destinations=["Lagos","Accra","Nairobi","Cape Town","Johannesburg","Abuja","Kigali","London","Dubai","New York"];

function setTrainTerminal() {
  if(trainActive) return;
  const name = trainNames[Math.floor(Math.random()*trainNames.length)];
  const dest = destinations[Math.floor(Math.random()*destinations.length)];
  const date = new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
  trainNameEl.textContent=name;
  trainDateEl.textContent=date;
  trainDestinationEl.textContent=dest;
  confirmText.textContent=`Join ${name} → ${dest}? Ready to play?`;
}

function updateTrainTime() {
  const now = new Date();
  trainTimeEl.textContent = now.toLocaleTimeString('en-GB',{hour12:false});
}

/* ---------------- Problems ---------------- */
function generateProblems() {
  currentProblems=[];
  problemBoard.innerHTML='';
  for(let i=0;i<NUM_BLOCKS;i++){
    let a=Math.floor(Math.random()*20)+1;
    let b=Math.floor(Math.random()*20)+1;
    if(a<b)[a,b]=[b,a];
    currentProblems.push({a,b,ans:a+b});

    const wrapper=document.createElement('div');
    wrapper.style.display='flex';
    wrapper.style.flexDirection='column';
    wrapper.style.alignItems='center';
    wrapper.style.gap='6px';
    wrapper.style.margin='6px';

    const label=document.createElement('div');
    label.textContent=`${a} + ${b}`;
    label.style.fontWeight='700';
    label.style.fontSize='12px';
    label.style.color='#fff';

    const input=document.createElement('input');
    input.type='number';
    input.className='problemInput';
    input.inputMode='numeric';
    input.placeholder='?';
    input.style.width='60px';
    input.style.padding='6px';
    input.style.borderRadius='6px';
    input.style.border='1px solid rgba(255,255,255,0.12)';
    input.style.background='#0e0e0e';
    input.style.color='#fff';
    input.style.textAlign='center';
    input.dataset.index=i;

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    problemBoard.appendChild(wrapper);
  }

  submitAnswersBtn.classList.remove('hidden');
  submitAnswersBtn.style.display='block';
  submitAnswersBtn.disabled=false;
  submitAnswersBtn.style.opacity='0.6';

  const inputs=problemBoard.querySelectorAll('.problemInput');
  function checkFilled(){
    const allFilled=Array.from(inputs).every(i=>i.value.trim()!=='');
    submitAnswersBtn.disabled=!allFilled;
    submitAnswersBtn.style.opacity=allFilled?'1':'0.6';
  }
  inputs.forEach(inp=>inp.addEventListener('input',checkFilled));
  checkFilled();
}

/* ---------------- Loading ---------------- */
function startLoadingBar(){
  loadingContainer.style.display='block';
  loadingProgress=0;
  loadingBar.style.width='0%';
  trainEmoji.style.left='0px';
  playAudio(SOUND_PATHS.start,true);
  loadingInterval=setInterval(()=>{
    loadingProgress++;
    const percent=(loadingProgress/39)*100;
    loadingBar.style.width=`${percent}%`;
    trainEmoji.style.left=`calc(${percent}% - 12px)`;
    if(loadingProgress>=39){
      clearInterval(loadingInterval);
      loadingInterval=null;
      if(trainActive){
        trainActive=false;
        stopLoadingBar();
        playAudio(SOUND_PATHS.depart);
        endTrain(false);
      }
    }
  },1000);
}

function stopLoadingBar(){
  if(loadingInterval){ clearInterval(loadingInterval); loadingInterval=null; }
  loadingContainer.style.display='none';
  loadingBar.style.width='0%';
  trainEmoji.style.left='0px';
}

/* ---------------- Station ---------------- */
function timeToNextMidnight(){
  const now=new Date();
  const tomorrow=new Date(now);
  tomorrow.setDate(now.getDate()+1);
  tomorrow.setHours(0,0,0,0);
  return Math.max(0,tomorrow-now);
}

function formatHMS(ms){
  const s=Math.floor(ms/1000);
  const hh=String(Math.floor(s/3600)).padStart(2,'0');
  const mm=String(Math.floor((s%3600)/60)).padStart(2,'0');
  const ss=String(s%60).padStart(2,'0');
  return `${hh}:${mm}:${ss}`;
}

function handleStationClosed(){
  closedOverlay.classList.remove('hidden');
  joinTrainBtn.disabled=true;
  joinTrainBtn.style.opacity='0.5';
  if(countdownTimer) clearInterval(countdownTimer);
  function tick(){
    const ms = timeToNextMidnight();
    if(reopenCountdown) reopenCountdown.textContent=formatHMS(ms);
    if(ms<=0){ clearInterval(countdownTimer); resetPotAndReopen(); }
  }
  tick();
  countdownTimer=setInterval(tick,1000);
  playAudio(SOUND_PATHS.depart);
}

async function resetPotAndReopen(){
  await setDoc(potRef,{dailyPot:INITIAL_POT,lastResetDay:new Date().toISOString().slice(0,10),halfAlertDate:''},{merge:true});
  closedOverlay.classList.add('hidden');
  joinTrainBtn.disabled=false;
  joinTrainBtn.style.opacity='1';
  setTrainTerminal();
  showPopup('🔁 Pot reset! Station reopened.',3000);
}

/* ---------------- Halfway ---------------- */
async function maybeShowHalfwayAlert(){
  const snap=await getDoc(potRef);
  if(!snap.exists()) return;
  const data=snap.data();
  const pot=data.dailyPot ?? INITIAL_POT;
  const half=Math.floor(INITIAL_POT/2);
  const today=new Date().toISOString().slice(0,10);
  if(pot<=half && data.halfAlertDate!==today){
    await setDoc(potRef,{halfAlertDate:today},{merge:true});
    showPopup('⚠️ Halfway mined — pot is running low!',4000);
  }
}

/* ---------------- Start / End Train ---------------- */
async function startTrain(){
  if(trainActive) return;
  const snap=await getDoc(userRef);
  const stars=(snap.exists()?snap.data().stars:50) ?? 50;
  if(stars<STAR_COST){ showPopup('Not enough stars to join.'); return; }
  await updateUserStats(0,-STAR_COST);
  starCountEl.textContent=stars-STAR_COST;
  trainActive=true;
  joinTrainBtn.style.display='none';
  generateProblems();
  problemBoard.classList.remove('hidden');
  submitAnswersBtn.classList.remove('hidden');
  submitAnswersBtn.style.display='block';
  submitAnswersBtn.disabled=false;
  submitAnswersBtn.style.opacity='0.6';
  startLoadingBar();
  playAudio(SOUND_PATHS.whistle);
  if(!trainAmbienceLoop) trainAmbienceLoop=playAudio(SOUND_PATHS.ambience,{loop:true,volume:0.2});
}

async function endTrain(success,ticketNumber=null){
  stopLoadingBar();
  problemBoard.classList.add('hidden');
  submitAnswersBtn.classList.add('hidden');
  submitAnswersBtn.style.display='none';
  if(trainAmbienceLoop){ trainAmbienceLoop.pause(); trainAmbienceLoop=null; }
  trainActive=false;
  joinTrainBtn.style.display='block';
  joinTrainBtn.disabled=false;
  joinTrainBtn.style.opacity='1';
  if(success){
    await updateUserStats(REWARD_TO_USER, STARS_PER_WIN);
    cashCountEl.textContent = (parseInt(cashCountEl.textContent.replace(/,/g,''),10)+REWARD_TO_USER).toLocaleString();
    starCountEl.textContent = (parseInt(starCountEl.textContent.replace(/,/g,''),10)+STARS_PER_WIN).toLocaleString();
    await updatePot(DEDUCT_PER_WIN);
    maybeShowHalfwayAlert();
    showPopup(`🎫 Train secured! You earned ₦${REWARD_TO_USER.toLocaleString()}!`,4500);
    playAudio(SOUND_PATHS.ding);
  } else {
    showPopup('Train left! You got nothing 😢',2200);
    playAudio(SOUND_PATHS.depart);
  }
}

/* ---------------- Submit Answers ---------------- */
submitAnswersBtn.addEventListener('click',async()=>{
  if(!trainActive) return;
  const inputs=Array.from(document.querySelectorAll('.problemInput'));
  if(inputs.some(i=>i.value==='')){
    showPopup("Finish all problems first!",2400);
    playAudio(SOUND_PATHS.error);
    return;
  }
  let allCorrect=true;
  inputs.forEach((inp,i)=>{
    if(parseInt(inp.value,10)!==currentProblems[i].ans) allCorrect=false;
  });
  trainActive=false;
  stopLoadingBar();
  if(allCorrect){
    const ticketNumber=inputs.map(i=>String(parseInt(i.value,10))).join('');
    endTrain(true,ticketNumber);
  } else {
    endTrain(false);
    showPopup("Some answers incorrect — train left!",3000);
    playAudio(SOUND_PATHS.depart);
  }
});

/* ---------------- Join Modal ---------------- */
joinTrainBtn.addEventListener('click',()=>{ 
  if(joinTrainBtn.disabled) return; 
  confirmModal.style.display='flex'; 
  playAudio(SOUND_PATHS.whistle);
});
confirmYes.addEventListener('click',()=>{ confirmModal.style.display='none'; startTrain(); });
confirmNo.addEventListener('click',()=>{ confirmModal.style.display='none'; });

/* ---------------- Init ---------------- */
async function init(){
  await fetchUser();
  await fetchPot();
  setTrainTerminal();
  setInterval(setTrainTerminal,60000);
  setInterval(updateTrainTime,1000);
  updateTrainTime();
  problemBoard.classList.add('hidden');
  submitAnswersBtn.style.display='none';
  setTimeout(resetPotAndReopen,timeToNextMidnight()+1000);
}

init();

/* ---------------- Debug ---------------- */
window.moneyTrainFirestore={startTrain,endTrain,fetchUser,fetchPot,resetPotAndReopen};