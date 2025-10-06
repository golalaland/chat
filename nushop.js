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

/* ------------------ DOM references ------------------ */
const DOM = {
  username: document.getElementById('username'),
  stars: document.getElementById('stars-count'),
  cash: document.getElementById('cash-count'),
  shopItems: document.getElementById('shop-items'),
  hostTabs: document.getElementById('hostTabs'),
  vipStat: document.getElementById('vip-stat'),
  friendsStat: document.getElementById('friends-stat'),
  badgesStat: document.getElementById('badges-stat'),
  tabContent: document.getElementById('tab-content'),
  ordersContent: document.getElementById('orders-content'),
  ordersList: document.getElementById('orders-list'),
  confirmModal: document.getElementById('confirmModal'),
  confirmTitle: document.getElementById('confirmTitle'),
  confirmText: document.getElementById('confirmText'),
  confirmYes: document.getElementById('confirmYes'),
  confirmNo: document.getElementById('confirmNo'),
  imagePreview: document.getElementById('imagePreview'),
  previewImg: document.getElementById('previewImg'),
  rewardModal: document.getElementById('rewardModal'),
  rewardTitle: document.getElementById('rewardTitle'),
  rewardMessage: document.getElementById('rewardMessage')
};

/* ------------------ Utilities ------------------ */
const formatNumber = n => n ? new Intl.NumberFormat('en-NG').format(Number(n)) : '0';
const parseNumberFromText = text => Number((text || '').replace(/[^\d\-]/g, '')) || 0;

const animateNumber = (el, from, to, duration = 600) => {
  const start = performance.now();
  const step = (ts) => {
    const progress = Math.min((ts - start) / duration, 1);
    const value = Math.floor(from + (to - from) * progress);
    if (el === DOM.stars) el.textContent = `${formatNumber(value)} ⭐️`;
    else if (el === DOM.cash) el.textContent = `₦${formatNumber(value)}`;
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

/* ------------------ Loader ------------------ */
const showLoader = () => document.getElementById('page-loader').classList.remove('hidden');
const hideLoader = () => document.getElementById('page-loader').classList.add('hidden');

/* ------------------ Confetti (lazy load) ------------------ */
const triggerConfetti = () => {
  if (window.__confettiLoaded) return confetti({ particleCount: 90, spread: 65, origin: { y: 0.6 } });
  const s = document.createElement('script');
  s.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
  s.onload = () => { window.__confettiLoaded = true; triggerConfetti(); };
  document.body.appendChild(s);
};

/* ------------------ Modal helpers ------------------ */
let _themedTimeout = null;
const closeModal = () => {
  if (DOM.confirmModal) DOM.confirmModal.style.display = 'none';
  if (DOM.confirmYes) DOM.confirmYes.onclick = null;
  if (DOM.confirmNo) DOM.confirmNo.onclick = null;
  if (DOM.confirmYes) DOM.confirmYes.style.display = '';
  if (DOM.confirmNo) DOM.confirmNo.style.display = '';
  if (_themedTimeout) { clearTimeout(_themedTimeout); _themedTimeout = null; }
};

const showConfirmModal = (title, text, onYes) => {
  if (!DOM.confirmModal) return;
  if (_themedTimeout) { clearTimeout(_themedTimeout); _themedTimeout = null; }
  DOM.confirmTitle.textContent = title;
  DOM.confirmText.textContent = text;
  DOM.confirmYes.style.display = '';
  DOM.confirmNo.style.display = '';
  DOM.confirmModal.style.display = 'flex';
  const cleanup = () => closeModal();
  DOM.confirmYes.onclick = async () => { cleanup(); if (onYes) await onYes(); };
  DOM.confirmNo.onclick = cleanup;
};

const showThemedMessage = (title, message, duration = 2000) => {
  if (!DOM.confirmModal) return;
  DOM.confirmTitle.textContent = title;
  DOM.confirmText.textContent = message;
  DOM.confirmYes.style.display = 'none';
  DOM.confirmNo.style.display = 'none';
  DOM.confirmModal.style.display = 'flex';
  if (_themedTimeout) clearTimeout(_themedTimeout);
  _themedTimeout = setTimeout(() => closeModal(), duration);
};

/* ------------------ Reward modal (invitee + inviter) ------------------ */
function showReward(message, title = "🎉 Reward Unlocked!") {
  if (!DOM.rewardModal) return;
  DOM.rewardTitle.textContent = title;
  DOM.rewardMessage.textContent = message;
  DOM.rewardModal.classList.remove('hidden');
  // Auto-hide after 4.5s
  setTimeout(() => { DOM.rewardModal.classList.add('hidden'); }, 4500);
}

/* ------------------ Image preview ------------------ */
const previewImage = (src) => {
  if (!DOM.imagePreview) return;
  DOM.previewImg.src = src;
  DOM.imagePreview.style.display = 'flex';
};
document.getElementById('closePreview')?.addEventListener('click', () => {
  DOM.previewImg.src = '';
  DOM.imagePreview.style.display = 'none';
});

/* ------------------ Host stats updater ------------------ */
const updateHostStats = async (newUser) => {
  const referrerId = newUser.invitedBy;
  if (!referrerId) return;
  const sanitizedId = String(referrerId).replace(/[.#$[\]]/g, ',');
  const hostRef = doc(db, 'users', sanitizedId);

  try {
    await runTransaction(db, async (t) => {
      const hostSnap = await t.get(hostRef);
      if (!hostSnap.exists()) return;
      const hostData = hostSnap.data() || {};
      const friends = Array.isArray(hostData.hostFriends) ? hostData.hostFriends.slice() : [];
      if (!friends.find(f => f.email === newUser.email)) {
        friends.push({
          email: newUser.email,
          chatId: newUser.chatId || '',
          chatIdLower: (newUser.chatId || '').toLowerCase(),
          isVIP: !!newUser.isVIP,
          isHost: !!newUser.isHost,
          giftShown: false
        });
      }
      const hostVIP = hostData.hostVIP || 0;
      const newVIP = newUser.isVIP ? hostVIP + 1 : hostVIP;
      t.update(hostRef, { hostFriends: friends, hostVIP: newVIP });
    });
  } catch (err) {
    console.error('Failed to update host stats:', err);
  }
};

/* ------------------ Current user state ------------------ */
let currentUser = null;

/* ------------------ Load current user from localStorage and Firestore ------------------ */
const loadCurrentUser = async () => {
  const vipRaw = localStorage.getItem('vipUser');
  const vip = vipRaw ? JSON.parse(vipRaw) : null;

  // reset UI
  if (DOM.username) DOM.username.textContent = '******';
  if (DOM.stars) DOM.stars.textContent = `0 ⭐️`;
  if (DOM.cash) DOM.cash.textContent = `₦0`;

  showLoader();
  await renderShop();
  hideLoader();

  if (!vip?.email) { currentUser = null; if (DOM.hostTabs) DOM.hostTabs.style.display = 'none'; return; }

  const uid = String(vip.email).replace(/[.#$[\]]/g, ',');
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    currentUser = { uid, stars: 0, cash: 0, isHost: false };
    if (DOM.username) DOM.username.textContent = vip.displayName || vip.email || 'Guest';
    if (DOM.hostTabs) DOM.hostTabs.style.display = 'none';
    return;
  }

  currentUser = { uid, ...snap.data() };

  if (DOM.username) DOM.username.textContent = currentUser.chatId || vip.displayName || vip.email || 'Guest';
  if (DOM.stars) DOM.stars.textContent = `${formatNumber(currentUser.stars)} ⭐️`;
  if (DOM.cash) DOM.cash.textContent = `₦${formatNumber(currentUser.cash)}`;
  if (DOM.hostTabs) DOM.hostTabs.style.display = currentUser.isHost ? '' : 'none';
  updateHostPanels();

  // If this user was just invited, ensure host gets stats updated
  if (currentUser) {
    await updateHostStats({
      email: currentUser.email || '',
      chatId: currentUser.chatId || '',
      isVIP: currentUser.isVIP || false,
      isHost: currentUser.isHost || false,
      invitedBy: currentUser.invitedBy || null
    });
  }

  // Subscribe to realtime changes for reward popups + UI updates
  onSnapshot(userRef, async docSnap => {
    const data = docSnap.data();
    if (!data) return;
    currentUser = { uid, ...data };

    // update basic UI
    if (DOM.username) DOM.username.textContent = currentUser.chatId || vip.displayName || vip.email || 'Guest';
    if (DOM.stars) DOM.stars.textContent = `${formatNumber(currentUser.stars)} ⭐️`;
    if (DOM.cash) DOM.cash.textContent = `₦${formatNumber(currentUser.cash)}`;
    if (DOM.hostTabs) DOM.hostTabs.style.display = currentUser.isHost ? '' : 'none';
    updateHostPanels();
    showLoader();
    renderShop().catch(err => console.error(err)).finally(hideLoader);

    // --- Invitee reward: show once to invitee if flagged false
    try {
      if (data.invitedBy && data.inviteeGiftShown !== true) {
        let inviterName = data.invitedBy;
        try {
          const invRef = doc(db, 'users', String(data.invitedBy).replace(/[.#$[\]]/g, ','));
          const invSnap = await getDoc(invRef);
          if (invSnap.exists()) {
            const invData = invSnap.data();
            if (invData.chatId) inviterName = invData.chatId;
            else if (invData.email) inviterName = invData.email.split('@')[0];
          }
        } catch (e) { }

        showReward(`You’ve been gifted +50 stars ⭐️ for joining ${inviterName}’s Tab.`, '⭐ Congratulations!⭐️');
        try { await updateDoc(userRef, { inviteeGiftShown: true }); } catch (e) { console.error('Failed to set inviteeGiftShown', e); }
      }
    } catch (e) { console.error('Invitee reward flow error', e); }

    // --- Inviter reward
    try {
      const friendsArr = Array.isArray(data.hostFriends) ? data.hostFriends : [];
      const pending = friendsArr.find(f => !f.giftShown && f.email);
      if (pending) {
        const friendName = pending.chatId || (pending.email ? pending.email.split('@')[0] : 'Friend');
        showReward(`You’ve been gifted +200 stars ⭐️, ${friendName} just joined your Tab.`, '⭐ Congratulations!⭐️');
        const updated = friendsArr.map(f => f.email === pending.email ? { ...f, giftShown: true } : f);
        try { await updateDoc(userRef, { hostFriends: updated }); } catch (e) { console.error('Failed to mark host friend giftShown', e); }
      }
    } catch (e) { console.error('Inviter reward flow error', e); }
  });
};

/* ------------------ Host panels ------------------ */
const updateHostPanels = () => {
  if (!currentUser?.isHost) {
    if (DOM.hostTabs) DOM.hostTabs.style.display = 'none';
    if (DOM.tabContent) DOM.tabContent.style.display = 'none';
    return;
  }
  if (DOM.hostTabs) DOM.hostTabs.style.display = '';
  if (DOM.tabContent) DOM.tabContent.style.display = '';
  renderTabContent('vip');
};

const renderTabContent = (type) => {
  if (!DOM.tabContent) return;
  DOM.tabContent.innerHTML = '';
  if (!currentUser?.isHost) return;

  if (type === 'vip') {
    const vipCount = currentUser.hostVIP || 0;
    DOM.tabContent.innerHTML = `
      <div class="stat-block" style="margin-bottom:12px;">
        <div class="stat-value" id="vip-stat">${formatNumber(vipCount)}</div>
        <div class="stat-label">VIPs Signed Up</div>
      </div>
    `;
  } 
  else if (type === 'friends') {
    renderFriendsList(DOM.tabContent, currentUser.hostFriends || []);

    const btn = document.createElement('button');
    btn.id = 'inviteFriendsBtn';
    btn.className = 'themed-btn';
    btn.textContent = 'Invite Friends';
    DOM.tabContent.appendChild(btn);

    btn.addEventListener('click', () => {
      const message = `Hey! i'm hosting on xixi live, join my tab and lets win some together,  Sign up using my link: `;
      const link = `https://golalaland.github.io/chat/ref.html?ref=${encodeURIComponent(currentUser.uid)}`;
      const fullText = message + link;

      navigator.clipboard.writeText(fullText)
        .then(() => showThemedMessage('Copied!', 'Invite message copied.', 1500))
        .catch(() => showThemedMessage('Error', 'Failed to copy invite.', 1800));
    });
  }
  else if (type === 'badges') {
    const badgeImg = currentUser.hostBadgeImg || 'https://www.svgrepo.com/show/492657/crown.svg';
    DOM.tabContent.innerHTML = `
      <div class="stat-block">
        <img src="${badgeImg}" style="width:100px;height:100px;">
        <div class="stat-value">${currentUser.hostBadge || 'Gold'}</div>
        <div class="stat-label">Badge Status</div>
      </div>
    `;
  }
};

/* ------------------ Friends rendering ------------------ */
function renderFriendsList(container, friends) {
  container.innerHTML = '';
  if (!friends || friends.length === 0) {
    container.innerHTML = `<div class="muted"><div class="spinner"></div></div>`;
    return;
  }

  const sorted = friends.slice().sort((a, b) => {
    if (a.isVIP && !b.isVIP) return -1;
    if (!a.isVIP && b.isVIP) return 1;
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;
    return 0;
  });

  const list = document.createElement('div');
  list.className = 'friends-list';
  sorted.forEach(f => {
    const name = f.chatId || (f.email ? f.email.split('@')[0] : 'Guest');
    const handle = '@' + (f.chatIdLower || (name.toLowerCase().replace(/\s+/g, '')));
    let iconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#999"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/></svg>`;
    let color = '#444';
    if (f.isVIP) { iconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#c9a033"><path d="M12 .587l3.668 7.431 8.2 1.193-5.934 5.782 1.4 8.172L12 18.896l-7.334 3.85 1.4-8.172L.132 9.211l8.2-1.193L12 .587z"/></svg>`; color = '#c9a033'; }
    else if (f.isHost) { iconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#ff66cc"><path d="M12 2v4l3 2-3 2v4l8-6-8-6zm-2 8l-8 6 8 6v-4l-3-2 3-2v-4z"/></svg>`; color = '#ff66cc'; }

    const card = document.createElement('div');
    card.className = 'friend-card';
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;">
        ${iconSVG}
        <div>
          <div style="font-weight:600;color:${color}">${name}</div>
          <div class="muted">${handle}</div>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  container.appendChild(list);
}

/* ------------------ Shop ------------------ */
async function renderShop() {
  if (!DOM.shopItems) return;
  showLoader();
  DOM.shopItems.innerHTML = '<div style="text-align:center;"><div class="spinner"></div></div>';
  try {
    const shopRef = collection(db, 'shop');
    const snap = await getDocs(shopRef);
    DOM.shopItems.innerHTML = '';
    snap.forEach(docSnap => {
      const item = docSnap.data();
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.innerHTML = `
        <img src="${item.img || 'https://via.placeholder.com/80'}" />
        <div>${item.name}</div>
        <div>⭐ ${formatNumber(item.cost)}</div>
        <button class="buy-btn">Redeem</button>
      `;
      el.querySelector('.buy-btn').addEventListener('click', () => redeemProduct(item));
      DOM.shopItems.appendChild(el);
    });
  } catch (err) {
    console.error(err);
    DOM.shopItems.innerHTML = '<div style="text-align:center;color:red;">Failed to load shop items.</div>';
  } finally {
    hideLoader();
  }
}

/* ------------------ Orders ------------------ */
async function renderMyOrders() {
  if (!DOM.ordersList) return;
  DOM.ordersList.innerHTML = '<div style="text-align:center;"><div class="spinner"></div></div>';
  showLoader();
  try {
    if (!currentUser?.uid) return;
    const ordersRef = collection(db, 'orders');
    const snap = await getDocs(ordersRef);
    const myOrders = snap.docs.map(d => d.data()).filter(o => o.uid === currentUser.uid);
    if (myOrders.length === 0) {
      DOM.ordersList.innerHTML = '<div style="text-align:center;">No orders yet.</div>';
      return;
    }
    DOM.ordersList.innerHTML = '';
    myOrders.forEach(order => {
      const el = document.createElement('div');
      el.className = 'order-item';
      el.textContent = `${order.productName} - ${order.status || 'Pending'}`;
      DOM.ordersList.appendChild(el);
    });
  } catch (err) {
    console.error(err);
    DOM.ordersList.innerHTML = '<div style="text-align:center;color:red;">Failed to load orders.</div>';
  } finally {
    hideLoader();
  }
}

/* ------------------ Redeem product ------------------ */
async function redeemProduct(item) {
  if (!currentUser) return;
  showConfirmModal(`Redeem ${item.name}?`, `It will cost ⭐ ${formatNumber(item.cost)}`, async () => {
    showLoader();
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await runTransaction(db, async (t) => {
        const userSnap = await t.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found.');
        const userData = userSnap.data();
        const stars = userData.stars || 0;
        if (stars < item.cost) throw new Error('Not enough stars.');
        t.update(userRef, { stars: stars - item.cost });
        const ordersRef = collection(db, 'orders');
        const newOrder = {
          uid: currentUser.uid,
          productName: item.name,
          timestamp: serverTimestamp(),
          status: 'Pending'
        };
        await t.set(doc(ordersRef), newOrder);
      });
      showThemedMessage('Success', `You redeemed ${item.name}!`);
      triggerConfetti();
    } catch (err) {
      console.error(err);
      showThemedMessage('Error', err.message || 'Failed to redeem.');
    } finally {
      hideLoader();
    }
  });
}

/* ------------------ Initial load ------------------ */
document.addEventListener('DOMContentLoaded', () => loadCurrentUser());