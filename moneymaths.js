/* ===============================
   Money Maths Game Script
================================= */

/* ---------- Firebase Imports ---------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, updateDoc, onSnapshot, increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- Firebase Config ---------- */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MSG_ID",
  appId: "YOUR_APP_ID",
  databaseURL: "YOUR_DB_URL"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ---------- Game State ---------- */
let currentUser = null; // Populate this after user login
let currentChallenge = null;
let entriesCount = 0;
const MAX_ENTRIES = 53;
const BUZZ_COST = 5; // stars
const REWARD_STARS = 20;
const REWARD_CASH = 50;
const CHALLENGE_INTERVAL_MS = 5000;
let cooldownTimer = null;

/* ---------- Challenge Generator ---------- */
function generateMathChallenge() {
  const ops = ["+", "-","*"];
  const getRandom = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
  const exprCount = getRandom(5,8);
  let expressions = [];
  for(let i=0;i<exprCount;i++){
    const a=getRandom(1,10), b=getRandom(1,10);
    const op = ops[Math.floor(Math.random()*ops.length)];
    expressions.push(`${a}${op}${b}`);
  }
  const combinedAnswer = expressions.map(exp => eval(exp)).join("");
  return { expressions, combinedAnswer };
}

/* ---------- Display Challenge ---------- */
function displayChallenge() {
  if(!currentChallenge) return;
  const container = document.getElementById("expressions");
  if(!container) return;
  container.innerHTML = currentChallenge.expressions.join(" <br> ");
}

/* ---------- Start New Challenge ---------- */
function nextChallenge() {
  if(entriesCount >= MAX_ENTRIES) return;
  currentChallenge = generateMathChallenge();
  displayChallenge();
}

/* ---------- Buzz Submission ---------- */
async function handleBuzzSubmission() {
  if(!currentUser) return alert("Sign in to play Money Maths!");
  if(entriesCount >= MAX_ENTRIES) return alert("This money has been solved, check in the next session.");
  if((currentUser.stars || 0) < BUZZ_COST) return alert("Not enough stars to buzz!");

  const input = document.getElementById("buzzInput").value.trim();
  if(!input) return alert("Type your answer!");

  entriesCount++;
  currentUser.stars -= BUZZ_COST;

  // Update Firestore stars deduction
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, { stars: increment(-BUZZ_COST) });

  if(input === currentChallenge.combinedAnswer){
    currentUser.stars += REWARD_STARS;
    currentUser.cash = (currentUser.cash || 0) + REWARD_CASH;
    await updateDoc(userRef, {
      stars: increment(REWARD_STARS),
      cash: increment(REWARD_CASH)
    });
    alert(`🎉 Correct! You earned ${REWARD_STARS} ⭐️ and ₦${REWARD_CASH}`);
  } else {
    alert("❌ Wrong answer!");
  }

  document.getElementById("buzzInput").value = "";

  if(entriesCount >= MAX_ENTRIES){
    startCooldown();
  }
}

/* ---------- Cooldown ---------- */
function startCooldown(minutes=10){
  let timer = minutes * 60;
  const countdownEl = document.getElementById("countdown");
  if(!countdownEl) return;

  cooldownEl = countdownEl;
  cooldownEl.style.display = "block";

  cooldownTimer = setInterval(()=>{
    if(timer <=0){
      clearInterval(cooldownTimer);
      entriesCount = 0;
      cooldownEl.style.display = "none";
      nextChallenge();
      return;
    }
    const min = Math.floor(timer/60);
    const sec = timer%60;
    cooldownEl.textContent = `Next session in ${min}:${sec <10?'0'+sec:sec}`;
    timer--;
  },1000);
}

/* ---------- Initialize Game Loop ---------- */
function startGame(){
  nextChallenge();
  setInterval(nextChallenge, CHALLENGE_INTERVAL_MS);

  const buzzBtn = document.getElementById("buzzBtn");
  if(buzzBtn) buzzBtn.addEventListener("click", handleBuzzSubmission);
}

/* ---------- Export User Setup ---------- */
export function setCurrentUser(user){
  currentUser = user;
  startGame();
}