/* ---------------- Sample User Data ---------------- */
let currentUser = JSON.parse(localStorage.getItem("vipUser")) || {
  uid: 'guest001',
  name: 'GUEST 0000',
  stars: 0,
  cash: 0
};
document.getElementById('profileName').textContent = currentUser.name;
document.getElementById('starCount').textContent = currentUser.stars;
document.getElementById('cashCount').textContent = currentUser.cash;

/* ---------------- Math Game Logic ---------------- */
const mathProblemEl = document.getElementById("mathProblem");
const problemsMarquee = document.getElementById("problemsMarquee");
const messagesEl = document.getElementById("messages");
const starPopup = document.getElementById("starPopup");

let problems = [];
let maxProblems = 5;
let submittedAnswers = [];

// Generate random math problem
function generateProblem() {
  const operators = ["+", "-", "x"];
  const a = Math.floor(Math.random()*10)+1;
  const b = Math.floor(Math.random()*10)+1;
  const op = operators[Math.floor(Math.random()*operators.length)];
  let answer;
  switch(op){
    case "+": answer = a + b; break;
    case "-": answer = a - b; break;
    case "x": answer = a * b; break;
  }
  return { text:`${a} ${op} ${b}`, answer };
}

// Render problems
function renderProblems() {
  mathProblemEl.innerHTML = "";
  problems = [];
  submittedAnswers = [];
  for(let i=0;i<maxProblems;i++){
    const prob = generateProblem();
    problems.push(prob);
    const input = document.createElement("input");
    input.setAttribute("type","number");
    input.setAttribute("placeholder",prob.text);
    mathProblemEl.appendChild(input);
    submittedAnswers.push(input);
  }
}
renderProblems();

// Star popup animation
function showStarPopup(text){
  starPopup.textContent = text;
  starPopup.style.display="block";
  setTimeout(()=>{starPopup.style.display="none";},1500);
}

// Submit answers
document.getElementById("submitBtn").addEventListener("click",()=>{
  let correctCount = 0;
  submittedAnswers.forEach((input,i)=>{
    if(Number(input.value) === problems[i].answer) correctCount++;
  });

  if(correctCount===0){showStarPopup("No correct!"); return;}

  // Update stars/cash
  const reward = correctCount * 10;
  currentUser.stars += reward;
  currentUser.cash += reward;
  document.getElementById('starCount').textContent = currentUser.stars;
  document.getElementById('cashCount').textContent = currentUser.cash;

  // Add to marquee
  problems.forEach(p=>{
    const span = document.createElement("span");
    span.textContent = p.text+"="+p.answer;
    problemsMarquee.appendChild(span);
  });

  // Add to messages
  const msg = document.createElement('div');
  msg.className = 'msg';
  msg.textContent = currentUser.name + ": Solved "+correctCount+"/"+maxProblems;
  messagesEl.appendChild(msg);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  showStarPopup(`+${reward} ⭐ & ₦${reward}`);

  renderProblems(); // refresh problems
});

// Marquee animation
setInterval(()=>{
  const firstChild = problemsMarquee.firstElementChild;
  if(firstChild) problemsMarquee.appendChild(firstChild);
},2000);

// Rules
document.getElementById('rulesBtn').addEventListener('click',()=>{
  alert("🎮 Brain Join Rules:\n- Solve the math problems.\n- Each correct answer gives 10 stars & cash.\n- Problems refresh every submission.\n- First come, first solved!");
});