/* ---------------- Sample User Data ---------------- */
let currentUser = {
  uid: 'guest001',
  name: 'GUEST 0000',
  stars: 50,
  cash: 0
};
document.getElementById('profileName').textContent = currentUser.name;
document.getElementById('starCount').textContent = currentUser.stars;
document.getElementById('cashCount').textContent = currentUser.cash;

/* ---------------- DOM References ---------------- */
const joinTrainBtn = document.getElementById('joinTrainBtn');
const starPopup = document.getElementById('starPopup');
const problemBoard = document.getElementById('problemBoard');
const loadingBar = document.getElementById('loadingBar');
const trainEmoji = document.getElementById('trainEmoji');
const dailyPotEl = document.getElementById('dailyPot');

/* ---------------- Config ---------------- */
const starCost = 10;
const numberOfBlocks = 8;
const trainDuration = 39000; // 39 seconds
const cities = ['New York', 'Tokyo', 'Paris', 'London', 'Dubai', 'Sydney', 'Berlin', 'Moscow', 'Rome', 'Toronto'];

/* ---------------- Utility ---------------- */
function showStarPopup(text) {
  starPopup.textContent = text;
  starPopup.style.display = "block";
  setTimeout(() => { starPopup.style.display = "none"; }, 1500);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ---------------- Modal Confirmation ---------------- */
function confirmJoinTrain() {
  const confirmed = confirm(`Joining the train costs ${starCost}⭐. Proceed?`);
  if (!confirmed) return false;
  if (currentUser.stars < starCost) {
    showStarPopup("Not enough stars!");
    return false;
  }
  currentUser.stars -= starCost;
  document.getElementById('starCount').textContent = currentUser.stars;
  return true;
}

/* ---------------- Train Terminal Info ---------------- */
function createTrainTerminalInfo() {
  const terminalDiv = document.createElement('div');
  terminalDiv.style.textAlign = 'center';
  terminalDiv.style.margin = '10px 0';
  terminalDiv.style.color = '#FF8C00';
  terminalDiv.style.fontWeight = '700';
  terminalDiv.innerHTML = `
    Train: Money Express 🚂<br>
    Date & Time: ${new Date().toLocaleString()}<br>
    Destination: ${cities[randomInt(0, cities.length - 1)]}
  `;
  problemBoard.prepend(terminalDiv);
}

/* ---------------- Problem Generation ---------------- */
function generateProblems() {
  problemBoard.innerHTML = ""; // Clear previous
  createTrainTerminalInfo();

  for (let i = 0; i < numberOfBlocks; i++) {
    const a = randomInt(2, 12);
    const b = randomInt(2, 12);
    const input = document.createElement('input');
    input.className = 'problemInput';
    input.dataset.answer = a * b;
    input.placeholder = `${a} x ${b}`;
    input.type = 'text';
    problemBoard.appendChild(input);
  }

  // Re-add Join Train button below blocks
  const joinBtnClone = joinTrainBtn.cloneNode(true);
  joinBtnClone.id = 'joinTrainBtnPlay';
  problemBoard.appendChild(joinBtnClone);

  joinBtnClone.addEventListener('click', () => {
    checkAllAnswers(joinBtnClone);
  });
}

/* ---------------- Answer Check ---------------- */
function checkAllAnswers(btn) {
  const inputs = problemBoard.querySelectorAll('.problemInput');
  let allCorrect = true;
  inputs.forEach(input => {
    const val = parseInt(input.value);
    if (val !== parseInt(input.dataset.answer)) allCorrect = false;
  });

  if (allCorrect) {
    const rewardStars = numberOfBlocks * 5;
    const rewardCash = numberOfBlocks * 50;
    currentUser.stars += rewardStars;
    currentUser.cash += rewardCash;
    document.getElementById('starCount').textContent = currentUser.stars;
    document.getElementById('cashCount').textContent = currentUser.cash;
    showStarPopup(`+${rewardStars}⭐ & ₦${rewardCash}`);
    btn.disabled = true;
  } else {
    showStarPopup("Incorrect answers! Train left without you!");
    btn.disabled = true;
  }
}

/* ---------------- Loading Animation ---------------- */
function animateTrain() {
  loadingBar.style.width = '0%';
  trainEmoji.style.left = '0px';
  const startTime = Date.now();

  const interval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / trainDuration, 1);
    loadingBar.style.width = `${progress * 100}%`;
    trainEmoji.style.left = `${progress * (loadingBar.offsetWidth - 24)}px`;

    if (progress >= 1) {
      clearInterval(interval);
      showStarPopup("Train has left!");
      problemBoard.querySelectorAll('input').forEach(input => input.disabled = true);
      const btn = problemBoard.querySelector('#joinTrainBtnPlay');
      if (btn) btn.disabled = true;
    }
  }, 50);
}

/* ---------------- Daily Reward Toggle ---------------- */
let dailyRewardNaira = true;
dailyPotEl.addEventListener('click', () => {
  dailyRewardNaira = !dailyRewardNaira;
  dailyPotEl.textContent = dailyRewardNaira ? '1000' : '2.5';
  dailyPotEl.parentElement.innerHTML = `Cash Reward Available Today: ${dailyRewardNaira ? '₦' : '$'}<span id="dailyPot">${dailyPotEl.textContent}</span>`;
});

/* ---------------- Join Train Click ---------------- */
joinTrainBtn.addEventListener('click', () => {
  if (!confirmJoinTrain()) return;
  problemBoard.style.display = 'flex';
  generateProblems();
  animateTrain();
  joinTrainBtn.style.display = 'none';
});