// ---------- Imports ----------
import { db, currentUser } from './app.js'; // Use app.js db & currentUser
import { doc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ---------- DOM Elements ---------- */
const scrambleBannerEl = document.getElementById("scrambleBanner");
const scrambleLettersEl = document.getElementById("scrambleLetters");
const scrambleInputEl = document.getElementById("scrambleInput");
const scrambleSubmitBtn = document.getElementById("scrambleSubmitBtn");
const adminScrambleBtn = document.getElementById("adminScrambleBtn");

/* ---------- Scramble Constants ---------- */
const SCRAMBLE_DURATION = 120_000; // 2 minutes
const SCRAMBLE_LETTER_COUNT = 7;
const SCRAMBLE_STAR_REWARD = 20;
const lettersPool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/* ---------- State ---------- */
let currentScramble = null;
let scrambleTimeout = null;
let submittedWords = {}; // uid => Set of words

/* ---------- Helper Functions ---------- */
function generateLetters() {
  let letters = [];
  for (let i = 0; i < SCRAMBLE_LETTER_COUNT; i++) {
    letters.push(lettersPool[Math.floor(Math.random() * lettersPool.length)]);
  }
  return letters;
}

function showStarPopup(text) {
  const popup = document.getElementById("starPopup");
  const starText = document.getElementById("starText");
  if (!popup || !starText) return;
  starText.innerText = text;
  popup.style.display = "block";
  setTimeout(() => { popup.style.display = "none"; }, 1700);
}

function validateWord(word) {
  if (!currentScramble) return false;
  word = word.toUpperCase();
  const available = [...currentScramble.letters];
  for (let char of word) {
    const idx = available.indexOf(char);
    if (idx === -1) return false;
    available.splice(idx, 1);
  }
  return true;
}

/* ---------- Scramble Functions ---------- */
function startScramble() {
  if (!currentUser?.isAdmin) return showStarPopup("Only admin can start a scramble");

  const letters = generateLetters();
  currentScramble = { letters, startTime: Date.now() };
  submittedWords = {};

  scrambleBannerEl.style.display = "block";
  scrambleLettersEl.textContent = letters.join(" ");
  scrambleInputEl.value = "";
  scrambleInputEl.disabled = false;
  scrambleSubmitBtn.disabled = false;

  showStarPopup(`Scramble started! Form words using: ${letters.join(" ")}`);

  if (scrambleTimeout) clearTimeout(scrambleTimeout);
  scrambleTimeout = setTimeout(endScramble, SCRAMBLE_DURATION);
}

async function submitScrambleWord() {
  if (!currentUser || !currentScramble) return;
  const word = (scrambleInputEl.value || "").trim().toUpperCase();
  if (!word) return showStarPopup("Type a word to submit!");
  if (!validateWord(word)) return showStarPopup("Invalid word!");

  submittedWords[currentUser.uid] = submittedWords[currentUser.uid] || new Set();
  if (submittedWords[currentUser.uid].has(word)) return showStarPopup("Already submitted!");

  submittedWords[currentUser.uid].add(word);

  // Update Firestore stars
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, { stars: increment(SCRAMBLE_STAR_REWARD) });
  currentUser.stars += SCRAMBLE_STAR_REWARD;

  showStarPopup(`✅ "${word}" accepted! +${SCRAMBLE_STAR_REWARD} stars`);
  scrambleInputEl.value = "";
}

function endScramble() {
  if (!currentScramble) return;
  showStarPopup("⏰ Scramble ended!");
  scrambleBannerEl.style.display = "none";
  scrambleLettersEl.textContent = "";
  scrambleInputEl.disabled = true;
  scrambleSubmitBtn.disabled = true;
  currentScramble = null;
  submittedWords = {};
}

/* ---------- Event Listeners ---------- */
scrambleSubmitBtn?.addEventListener("click", submitScrambleWord);
scrambleInputEl?.addEventListener("keypress", (e) => {
  if (e.key === "Enter") submitScrambleWord();
});
adminScrambleBtn?.addEventListener("click", startScramble);