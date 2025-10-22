/* ---------------- User Data ---------------- */
let currentUser = {
    uid: 'guest001',
    name: 'GUEST 0000',
    stars: 50,  // Give them some initial stars for demo
    cash: 0
};
document.getElementById('profileName').textContent = currentUser.name;
document.getElementById('starCount').textContent = currentUser.stars;
document.getElementById('cashCount').textContent = currentUser.cash;

/* ---------------- Daily Reward ---------------- */
let dailyReward = 5000; // Default in Naira
let currency = '₦';
const dailyPotEl = document.getElementById('dailyPot');
const toggleCurrencyEl = document.getElementById('toggleCurrency');
dailyPotEl.textContent = `${currency}${dailyReward.toLocaleString()}`;

// Currency toggle
toggleCurrencyEl.addEventListener('click', () => {
    if(currency === '₦'){
        currency = '$';
        dailyReward = (dailyReward / 750); // Example conversion
    } else {
        currency = '₦';
        dailyReward = dailyReward * 750;
    }
    dailyPotEl.textContent = `${currency}${dailyReward.toLocaleString()}`;
    toggleCurrencyEl.textContent = `(${currency})`;
});

/* ---------------- Terminal Info ---------------- */
const trainNames = ['Express Lightning','Silver Comet','Rapid Eagle','Golden Arrow'];
const destinations = ['New York','Tokyo','London','Paris','Dubai','Sydney','Berlin','Toronto'];

function randomChoice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function updateTerminalInfo(){
    document.getElementById('trainName').textContent = 'Train: ' + randomChoice(trainNames);
    document.getElementById('trainDateTime').textContent = 'Date/Time: ' + new Date().toLocaleString();
    document.getElementById('trainDestination').textContent = 'Destination: ' + randomChoice(destinations);
}
updateTerminalInfo();

/* ---------------- Modal Logic ---------------- */
const confirmModal = document.getElementById('confirmModal');
const joinTrainBtn = document.getElementById('joinTrainBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalStarCost = document.getElementById('modalStarCost');
const entryCost = 10; // Cost in stars

joinTrainBtn.addEventListener('click', ()=> {
    if(currentUser.stars < entryCost){
        alert('Not enough stars to join the train!');
        return;
    }
    modalStarCost.textContent = entryCost;
    confirmModal.style.display = 'flex';
});

modalCancelBtn.addEventListener('click', ()=> confirmModal.style.display = 'none');

modalConfirmBtn.addEventListener('click', ()=>{
    confirmModal.style.display = 'none';
    currentUser.stars -= entryCost;
    document.getElementById('starCount').textContent = currentUser.stars;
    startMoneyTrain();
});

/* ---------------- Train / Gameplay ---------------- */
const problemBoard = document.getElementById('problemBoard');
const loadingBar = document.getElementById('loadingBar');
const trainEmoji = document.getElementById('trainEmoji');

let loadingInterval, loadingPercent = 0;
let problems = [];
const numProblems = 8;

// Generate random math problems
function generateProblems(){
    problems = [];
    problemBoard.innerHTML = '';
    for(let i=0;i<numProblems;i++){
        let a = Math.floor(Math.random()*90+10);
        let b = Math.floor(Math.random()*90+10);
        let op = ['+','-','*','/'][Math.floor(Math.random()*4)];
        if(op === '/' && b===0) b=1; // Avoid div by zero
        let problemText = `${a} ${op} ${b}`;
        let correctAnswer = eval(problemText);
        if(op === '/') correctAnswer = Math.floor(correctAnswer);
        problems.push({problemText, correctAnswer});

        const inputEl = document.createElement('input');
        inputEl.type='number';
        inputEl.className='problemInput';
        inputEl.placeholder = problemText;
        inputEl.dataset.answer = correctAnswer;
        problemBoard.appendChild(inputEl);
    }

    // Add Solve button below blocks
    const solveBtn = document.createElement('button');
    solveBtn.className='gameBtn';
    solveBtn.textContent='Solve';
    solveBtn.style.marginTop='16px';
    solveBtn.addEventListener('click', checkAnswers);
    problemBoard.appendChild(solveBtn);
}

// Train loading animation
function startMoneyTrain(){
    joinTrainBtn.disabled=true;
    problemBoard.style.display='flex';
    generateProblems();
    loadingPercent=0;
    loadingBar.style.width='0%';
    trainEmoji.style.left='0px';

    // Play train sound (optional)
    // let audio = new Audio('train-start.mp3'); audio.play();

    loadingInterval = setInterval(()=>{
        loadingPercent += 1/39*100; // complete in 39 seconds
        loadingBar.style.width = `${loadingPercent}%`;
        trainEmoji.style.left = `${loadingPercent*4}px`; // simple left move

        if(loadingPercent>=100){
            clearInterval(loadingInterval);
            checkAnswers(true); // Force evaluation if user didn't finish
        }
    },1000);
}

// Check answers
function checkAnswers(force=false){
    const inputs = document.querySelectorAll('.problemInput');
    let allCorrect=true;
    inputs.forEach(inp=>{
        if(Number(inp.value)!==Number(inp.dataset.answer)){
            allCorrect=false;
        }
    });

    if(allCorrect){
        const starsEarned = 5*numProblems;
        const cashEarned = 50*numProblems;
        currentUser.stars += starsEarned;
        currentUser.cash += cashEarned;
        document.getElementById('starCount').textContent = currentUser.stars;
        document.getElementById('cashCount').textContent = currentUser.cash;
        showStarPopup(`+${starsEarned}⭐ +₦${cashEarned}`);
    } else if(force){
        showStarPopup('Train has left! You got nothing.');
    }

    // Reset train button
    joinTrainBtn.disabled=false;
}

// Star popup
const starPopup = document.getElementById('starPopup');
function showStarPopup(text){
    starPopup.textContent=text;
    starPopup.style.display='block';
    setTimeout(()=>{starPopup.style.display='none';},2000);
}