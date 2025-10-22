/* ---------------- Sample User Data ---------------- */
let currentUser = {
  uid: 'guest001',
  name: 'GUEST 0000',
  stars: 50, // starting stars
  cash: 0
};

document.getElementById('profileName').textContent = currentUser.name;
document.getElementById('starCount').textContent = currentUser.stars;
document.getElementById('cashCount').textContent = currentUser.cash;

const starPopup = document.getElementById('starPopup');

function showStarPopup(text) {
  starPopup.textContent = text;
  starPopup.style.display = "block";
  setTimeout(()=>{starPopup.style.display="none";},1500);
}

/* ---------------- Variables ---------------- */
const joinBtn = document.getElementById('joinTrainBtn');
const starCost = parseInt(document.getElementById('starCost').textContent);
const problemBoard = document.getElementById('problemBoard');
const problemBlocksEl = document.getElementById('problemBlocks');
const solveBtn = document.getElementById('solveBtn');
const loadingBar = document.getElementById('loadingBar');

let problems = [];
let loadingInterval = null;
let timeElapsed = 0;
const loadingDuration = 39; // seconds
let trainActive = false;

/* ---------------- Utility Functions ---------------- */
function generateProblem() {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const op = Math.random() < 0.5 ? '+' : '-';
  const answer = op === '+' ? a + b : a - b;
  return { question: `${a} ${op} ${b}`, answer };
}

function startLoadingBar() {
  loadingBar.style.width = "0%";
  timeElapsed = 0;

  loadingInterval = setInterval(() => {
    timeElapsed++;
    const percent = (timeElapsed / loadingDuration) * 100;
    loadingBar.style.width = `${percent}%`;

    if(timeElapsed >= loadingDuration) {
      clearInterval(loadingInterval);
      trainActive = false;
      problemBoard.style.display = 'none';
      showStarPopup("🚂 Train has left! No reward!");
    }
  }, 1000);
}

/* ---------------- Join Train ---------------- */
joinBtn.addEventListener('click', () => {
  if(currentUser.stars < starCost) {
    showStarPopup("Not enough stars!");
    return;
  }

  // Deduct stars
  currentUser.stars -= starCost;
  document.getElementById('starCount').textContent = currentUser.stars;

  // Generate 8 problems
  problems = [];
  problemBlocksEl.innerHTML = '';
  for(let i=0;i<8;i++){
    const p = generateProblem();
    problems.push(p);

    const input = document.createElement('input');
    input.className = 'problemInput';
    input.type = 'number';
    input.placeholder = p.question;
    problemBlocksEl.appendChild(input);
  }

  problemBoard.style.display = 'block';
  trainActive = true;
  startLoadingBar();
});

/* ---------------- Solve Button ---------------- */
solveBtn.addEventListener('click', () => {
  if(!trainActive) {
    showStarPopup("Train is gone!");
    return;
  }

  const inputs = document.querySelectorAll('.problemInput');
  let allCorrect = true;

  inputs.forEach((input, i) => {
    if(parseInt(input.value) !== problems[i].answer){
      allCorrect = false;
    }
  });

  if(allCorrect){
    // Reward user
    const earnedStars = 15;
    const earnedCash = 100;
    currentUser.stars += earnedStars;
    currentUser.cash += earnedCash;
    document.getElementById('starCount').textContent = currentUser.stars;
    document.getElementById('cashCount').textContent = currentUser.cash;

    showStarPopup(`+${earnedStars}⭐ +₦${earnedCash}`);
  } else {
    showStarPopup("❌ Some answers are wrong!");
  }

  clearInterval(loadingInterval);
  trainActive = false;
  problemBoard.style.display = 'none';
  loadingBar.style.width = '0%';
});