<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Money Train</title>
<link rel="icon" href="data:," />
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
<style>
:root {
  --bg:#000;
  --card:#111;
  --accent:#FF1493;
  --glass: rgba(255,255,255,0.03);
  --text:#fff;
}

html, body {
  margin:0; padding:0;
  height:100%;
  font-family:'Inter', sans-serif;
  background: var(--bg);
  color: var(--text);
  display:flex;
  justify-content:center;
  overflow-x:hidden;
  touch-action: manipulation; /* Prevent zoom on mobile input */
}

#appWrapper {
  width:100%; max-width:480px;
  display:flex; flex-direction:column; height:100%;
  position:relative;
}

/* Header */
#gameHeader {text-align:center; margin-top:10px;}
#welcomeText {font-family:'Press Start 2P', cursive; font-size:12px; color:var(--accent);}
#scrambleText {font-family:'Press Start 2P', cursive; font-size:22px; color:var(--accent); margin-top:2px;}

/* Terminal Info */
#terminalInfo {
  text-align:center;
  margin:6px 0;
  font-size:12px;
  border:1px solid rgba(255,255,255,0.1);
  padding:6px;
  border-radius:8px;
}
.terminal-field {margin:2px 0;}

/* Daily Cash Reward */
#dailyReward {
  display:flex; justify-content:center; gap:8px; align-items:center; margin:6px 0;
}
#toggleCurrency {cursor:pointer; color:var(--accent);}

/* Loading Bar */
#loadingContainer {width:90%; max-width:480px; margin:10px auto; background:#111; border-radius:12px; overflow:hidden;}
#loadingBar {width:0%; height:16px; background:var(--accent);}
#trainEmoji {position:absolute; left:0; top:-8px; font-size:24px;}

/* Problem Blocks */
#problemBoard {text-align:center; margin:8px 0; display:flex; flex-wrap:wrap; justify-content:center; gap:6px;}
.problemInput {width:60px; padding:6px; border-radius:6px; border:1px solid rgba(255,255,255,0.2); background:#0e0e0e; color:#fff; text-align:center; font-weight:700; font-size:14px;}

/* Buttons */
.gameBtn {
  display:block; margin:12px auto;
  padding:10px 18px;
  border-radius:999px;
  background: linear-gradient(90deg,#FF1493,#FF8C00);
  border:none;
  color:var(--accent);
  font-weight:700;
  font-size:16px;
  cursor:pointer;
  animation: flicker 2s infinite alternate;
}
@keyframes flicker {0%{opacity:1;}50%{opacity:0.6;}100%{opacity:1;}}

/* Profile */
.profile {position:fixed; bottom:60px; width:100%; max-width:480px; left:0; display:flex; justify-content:center; z-index:99;}
.profile-card {background:var(--glass); padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.04); display:flex; flex-direction:column; gap:6px; text-align:center;}
.profile-name {font-weight:800; font-size:14px; color:var(--accent);}
.profile-info {font-size:12px; color:#fff;}

/* Star popup */
.star-popup{position:fixed;left:50%;top:20%;transform:translateX(-50%);background:var(--card);padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.05);display:none;z-index:1000;color:var(--accent);font-size:13px;text-align:center;}

/* Modal */
#confirmModal {
  position:fixed; top:0; left:0; width:100%; height:100%;
  background: rgba(0,0,0,0.8);
  display:none; justify-content:center; align-items:center;
  z-index:1000;
}
.modal-content {
  background:var(--card); padding:20px; border-radius:12px; text-align:center;
}
.modalBtn {
  padding:10px 18px; margin:6px; border-radius:999px; border:none; cursor:pointer;
  font-weight:700; color:#fff;
}
.modalBtn.confirm {background:linear-gradient(90deg,#00FF99,#00CCFF);}
.modalBtn.cancel {background:linear-gradient(90deg,#FF1493,#FF8C00);}
</style>
</head>
<body>
<div id="appWrapper">
  <!-- Header -->
  <div id="gameHeader">
    <div id="welcomeText">WELCOME TO</div>
    <div id="scrambleText">MONEY TRAIN 🚂</div>
  </div>

  <!-- Terminal Info -->
  <div id="terminalInfo">
    <div class="terminal-field" id="trainName">Train: ---</div>
    <div class="terminal-field" id="trainDateTime">Date/Time: ---</div>
    <div class="terminal-field" id="trainDestination">Destination: ---</div>
  </div>

  <!-- Daily Reward -->
  <div id="dailyReward">
    <span>Cash Reward Available Today:</span>
    <span id="dailyPot">0</span>
    <span id="toggleCurrency">(₦)</span>
  </div>

  <!-- Loading Bar -->
  <div id="loadingContainer">
    <div id="loadingBar"></div>
    <div id="trainEmoji">🚂</div>
  </div>

  <!-- Problem Blocks -->
  <div id="problemBoard"></div>

  <!-- Buttons -->
  <button id="joinTrainBtn" class="gameBtn">Join Money Train</button>

  <!-- Profile panel -->
  <div class="profile" id="profilePanel">
    <div class="profile-card">
      <div class="profile-name" id="profileName">GUEST 0000</div>
      <div class="profile-info">STARS: <span id="starCount">0</span>⭐</div>
      <div class="profile-info">CASH: ₦<span id="cashCount">0</span></div>
    </div>
  </div>
</div>

<!-- Star popup -->
<div class="star-popup" id="starPopup">+1 ⭐</div>

<!-- Join Confirmation Modal -->
<div id="confirmModal">
  <div class="modal-content">
    <h3>Join the Money Train?</h3>
    <p>This will cost <span id="modalStarCost">10</span>⭐. Are you sure?</p>
    <button class="modalBtn confirm" id="modalConfirmBtn">Yes</button>
    <button class="modalBtn cancel" id="modalCancelBtn">No</button>
  </div>
</div>

<script src="moneymaths.js"></script>
</body>
</html>