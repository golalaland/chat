/* ---------------- Sample User Data ---------------- */
let currentUser = {
  name: 'GUEST',
  stars: 200,
  cash: 0
};

document.getElementById('profileName').textContent = currentUser.name;
document.getElementById('starCount').textContent = currentUser.stars;
document.getElementById('cashCount').textContent = currentUser.cash;

const joinTrainBtn = document.getElementById('joinTrainBtn');
const problemBoard = document.getElementById('problemBoard');
const problemBlocks = document.getElementById('problemBlocks');
const solveBtn = document.getElementById('solveBtn');
const loadingBar = document.getElementById('loadingBar');
const starPopup = document.getElementById('starPopup');

let problems = [];
let trainInterval;
let loadingInterval;
const TRAIN_DURATION = 39; // seconds
let trainProgress = 0;

function showStarPopup(text){
    starPopup.textContent = text;
    starPopup.style.display = 'block';
    setTimeout(()=> starPopup.style.display='none', 1500);
}

function generateProblems(){
    problems = [];
    problemBlocks.innerHTML = '';
    for(let i=0;i<8;i++){
        const a = Math.floor(Math.random()*10)+1;
        const b = Math.floor(Math.random()*10)+1;
        const op = Math.random() > 0.5 ? '+' : '-';
        const answer = op === '+' ? a+b : a-b;
        problems.push(answer);

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'problemInput';
        input.dataset.index = i;
        input.placeholder = '?';
        problemBlocks.appendChild(input);
    }
}

function startLoadingBar(){
    let progress = 0;
    const step = 100/(TRAIN_DURATION*10);
    loadingBar.style.width = '0%';
    loadingInterval = setInterval(()=>{
        progress += step;
        if(progress>=100){
            progress=100;
            clearInterval(loadingInterval);
            trainEnd(false);
        }
        loadingBar.style.width = progress+'%';
    },100);
}

// Animate train moving
function startTrainAnimation(){
    const trainEmoji = document.createElement('div');
    trainEmoji.textContent='🚂';
    trainEmoji.style.position='absolute';
    trainEmoji.style.top='50px';
    trainEmoji.style.left='-50px';
    trainEmoji.style.fontSize='30px';
    document.body.appendChild(trainEmoji);

    let pos = -50;
    const speed = window.innerWidth / (TRAIN_DURATION*1000); // px/ms
    trainInterval = setInterval(()=>{
        pos += speed*100; 
        trainEmoji.style.left = pos+'px';
    },100);

    return trainEmoji;
}

function trainEnd(success){
    clearInterval(trainInterval);
    const trainEmojis = document.querySelectorAll('div');
    trainEmojis.forEach(e=>{
        if(e.textContent==='🚂') e.remove();
    });

    if(success){
        showStarPopup(`+10⭐ & ₦100`);
        currentUser.stars +=10;
        currentUser.cash +=100;
    } else {
        showStarPopup(`Train left! You got nothing`);
    }

    document.getElementById('starCount').textContent = currentUser.stars;
    document.getElementById('cashCount').textContent = currentUser.cash;
    problemBoard.style.display='none';
    joinTrainBtn.disabled=false;
}

joinTrainBtn.addEventListener('click',()=>{
    if(currentUser.stars<10){ showStarPopup('Not enough stars'); return;}
    currentUser.stars -=10;
    document.getElementById('starCount').textContent = currentUser.stars;

    joinTrainBtn.disabled=true;
    problemBoard.style.display='block';
    generateProblems();
    startLoadingBar();
    const trainEmoji = startTrainAnimation();
});

solveBtn.addEventListener('click',()=>{
    const inputs = document.querySelectorAll('.problemInput');
    let allCorrect = true;
    inputs.forEach(input=>{
        const idx = input.dataset.index;
        if(Number(input.value)!==problems[idx]){
            allCorrect=false;
        }
    });
    if(allCorrect){
        clearInterval(loadingInterval);
        trainEnd(true);
    } else {
        showStarPopup('Some answers wrong! Keep trying!');
    }
});