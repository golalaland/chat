/* ---------------- User Data ---------------- */
let currentUser = {
  uid: 'guest001',
  name: 'GUEST 0000',
  stars: 50,
  cash: 0
};
document.getElementById('profileName').textContent = currentUser.name;
document.getElementById('starCount').textContent = currentUser.stars;
document.getElementById('cashCount').textContent = currentUser.cash;

const STAR_COST = 10;
document.getElementById('starCost').textContent = STAR_COST;

/* ---------------- Elements ---------------- */
const joinTrainBtn = document.getElementById('joinTrainBtn');
const loadingBar = document.getElementById('loadingBar');
const loadingContainer = document.getElementById('loadingContainer');
const problemBoard = document.getElementById('problemBoard');
const problemBlocksEl = document.getElementById('problemBlocks');
const solveBtn = document.getElementById('solveBtn');
const starPopup = document.getElementById('starPopup');
const messagesEl = document.getElementById('messages');

/* ---------------- Helpers ---------------- */
function showStarPopup(text) {
  starPopup.textContent = text;
  starPopup.style.display = "block";
  setTimeout(() => { starPopup.style.display = "none"; }, 1500);
}

function getRandomMathProblem() {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const op = ['+', '-', '*'][Math.floor(Math.random() * 3)];
  let ans;
  if(op === '+') ans = a + b;
  if(op === '-') ans = a - b;
  if(op === '*') ans = a * b;
  return {question: `${a} ${op} ${b}`, answer: ans};
}

/* ---------------- Game State ---------------- */
let problems = [];
let trainStarted = false;
let trainTimer;
let trainDuration = 39000; // 39 seconds
let loadingInterval;

/* ---------------- Start Train ---------------- */
joinTrainBtn.addEventListener('click', () => {
  if(currentUser.stars < STAR_COST){
    showStarPopup("Not enough stars!");
    return;
  }
  currentUser.stars -= STAR_COST;
  document.getElementById('starCount').textContent = currentUser.stars;

  // Generate 8 problems
  problems = [];
  problemBlocksEl.innerHTML = '';
  for(let i=0; i<8; i++){
    const p = getRandomMathProblem();
    problems.push(p);
    const inputHTML = `
      <div style="margin:6px 0;">
        <label>${p.question} = </label>
        <input type="number" class="problemInput" data-index="${i}" />
      </div>`;
    problemBlocksEl.insertAdjacentHTML('beforeend', inputHTML);
  }

  problemBoard.style.display = 'block';
  trainStarted = true;

  // Start loading bar
  let startTime = Date.now();
  loadingInterval = setInterval(()=>{
    let elapsed = Date.now() - startTime;
    let percent = Math.min((elapsed / trainDuration) * 100, 100);
    loadingBar.style.width = percent + '%';
    if(percent >= 100){
      clearInterval(loadingInterval);
      trainStarted = false;
      showStarPopup("🚂 Money Train has left!");
    }
  }, 100);
});

/* ---------------- Solve Button ---------------- */
solveBtn.addEventListener('click', () => {
  if(!trainStarted){
    showStarPopup("Train has left!");
    return;
  }

  const inputs = document.querySelectorAll('.problemInput');
  let allCorrect = true;
  inputs.forEach(input => {
    const idx = parseInt(input.dataset.index);
    const val = parseInt(input.value);
    if(val !== problems[idx].answer) allCorrect = false;
  });

  if(allCorrect){
    const rewardStars = 15;
    const rewardCash = 100;
    currentUser.stars += rewardStars;
    currentUser.cash += rewardCash;
    document.getElementById('starCount').textContent = currentUser.stars;
    document.getElementById('cashCount').textContent = currentUser.cash;
    showStarPopup(`+${rewardStars}⭐ +₦${rewardCash}`);
    // Log success
    const msg = document.createElement('div');
    msg.textContent = `${currentUser.name} completed Money Train! 🚂`;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  } else {
    showStarPopup("❌ Some answers are wrong! Train left!");
  }

  // Reset board
  problemBoard.style.display = 'none';
  loadingBar.style.width = '0%';
  clearInterval(loadingInterval);
  trainStarted = false;
});