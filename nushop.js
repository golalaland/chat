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
  rewardMessage: document.getElementById('rewardMessage'),
  loader: document.getElementById('page-loader')
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
const showLoader = () => DOM.loader?.classList.remove('hidden');
const hideLoader = () => DOM.loader?.classList.add('hidden');

/* ------------------ Confetti ------------------ */
const triggerConfetti = () => {
  if (window.__confettiLoaded) return confetti({ particleCount: 90, spread: 65, origin: { y: 0.6 } });
  const s = document.createElement('script');
  s.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
  s.onload = () => { window.__confettiLoaded = true; triggerConfetti(); };
  document.body.appendChild(s);
};

/* ------------------ Modals ------------------ */
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

/* ------------------ Reward modal ------------------ */
function showReward(message, title = "🎉 Reward Unlocked!") {
  if (!DOM.rewardModal) return;
  DOM.rewardTitle.textContent = title;
  DOM.rewardMessage.textContent = message;
  DOM.rewardModal.classList.remove('hidden');
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

/* ------------------ Host stats ------------------ */
const updateHostStats = async (newUser) => {
  if (!newUser.invitedBy) return;
  const hostRef = doc(db, 'users', String(newUser.invitedBy).replace(/[.#$[\]]/g, ','));
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
  } catch (err) { console.error('Failed to update host stats:', err); }
};

/* ------------------ Current user ------------------ */
let currentUser = null;

/* ------------------ Load user ------------------ */
const loadCurrentUser = async () => {
  const vipRaw = localStorage.getItem('vipUser');
  const vip = vipRaw ? JSON.parse(vipRaw) : null;

  if (DOM.username) DOM.username.textContent = '******';
  if (DOM.stars) DOM.stars.textContent = `0 ⭐️`;
  if (DOM.cash) DOM.cash.textContent = `₦0`;

  await renderShop();

  if (!vip?.email) { currentUser = null; DOM.hostTabs?.style.display = 'none'; return; }

  const uid = String(vip.email).replace(/[.#$[\]]/g, ',');
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    currentUser = { uid, stars: 0, cash: 0, isHost: false };
    DOM.username.textContent = vip.displayName || vip.email || 'Guest';
    DOM.hostTabs?.style.display = 'none';
    return;
  }

  currentUser = { uid, ...snap.data() };
  DOM.username.textContent = currentUser.chatId || vip.displayName || vip.email || 'Guest';
  DOM.stars.textContent = `${formatNumber(currentUser.stars)} ⭐️`;
  DOM.cash.textContent = `₦${formatNumber(currentUser.cash)}`;
  DOM.hostTabs.style.display = currentUser.isHost ? '' : 'none';
  updateHostPanels();

  if (currentUser) {
    await updateHostStats({
      email: currentUser.email || '',
      chatId: currentUser.chatId || '',
      isVIP: currentUser.isVIP || false,
      isHost: currentUser.isHost || false,
      invitedBy: currentUser.invitedBy || null
    });
  }

  onSnapshot(userRef, async docSnap => {
    const data = docSnap.data();
    if (!data) return;
    currentUser = { uid, ...data };

    DOM.username.textContent = currentUser.chatId || vip.displayName || vip.email || 'Guest';
    DOM.stars.textContent = `${formatNumber(currentUser.stars)} ⭐️`;
    DOM.cash.textContent = `₦${formatNumber(currentUser.cash)}`;
    DOM.hostTabs.style.display = currentUser.isHost ? '' : 'none';
    updateHostPanels();
    renderShop().catch(err => console.error(err));

    // Invitee reward
    try {
      if (data.invitedBy && data.inviteeGiftShown !== true) {
        let inviterName = data.invitedBy;
        try {
          const invRef = doc(db, 'users', String(data.invitedBy).replace(/[.#$[\]]/g, ','));
          const invSnap = await getDoc(invRef);
          if (invSnap.exists()) {
            const invData = invSnap.data();
            inviterName = invData.chatId || (invData.email ? invData.email.split('@')[0] : inviterName);
          }
        } catch {}
        showReward(`You’ve been gifted +50 stars ⭐️ for joining ${inviterName}’s Tab.`, '⭐ Congratulations!⭐️');
        try { await updateDoc(userRef, { inviteeGiftShown: true }); } catch (e) { console.error(e); }
      }
    } catch (e) { console.error('Invitee reward flow error', e); }

    // Inviter reward
    try {
      const friendsArr = Array.isArray(data.hostFriends) ? data.hostFriends : [];
      const pending = friendsArr.find(f => !f.giftShown && f.email);
      if (pending) {
        const friendName = pending.chatId || (pending.email ? pending.email.split('@')[0] : 'Friend');
        showReward(`You’ve been gifted +200 stars ⭐️, ${friendName} just joined your Tab.`, '⭐ Congratulations!⭐️');
        const updated = friendsArr.map(f => f.email === pending.email ? { ...f, giftShown: true } : f);
        try { await updateDoc(userRef, { hostFriends: updated }); } catch (e) { console.error(e); }
      }
    } catch (e) { console.error('Inviter reward flow error', e); }
  });
};

/* ------------------ Host panels ------------------ */
const updateHostPanels = () => {
  if (!currentUser?.isHost) { DOM.hostTabs?.style.display = 'none'; DOM.tabContent?.style.display = 'none'; return; }
  DOM.hostTabs.style.display = '';
  DOM.tabContent.style.display = '';
  renderTabContent('vip');
};

const renderTabContent = (type) => {
  if (!DOM.tabContent) return;
  DOM.tabContent.innerHTML = '';
  if (!currentUser?.isHost) return;

  if (type === 'vip') {
    DOM.tabContent.innerHTML = `
      <div class="stat-block" style="margin-bottom:12px;">
        <div class="stat-value" id="vip-stat">${formatNumber(currentUser.hostVIP || 0)}</div>
        <div class="stat-label">VIPs Signed Up</div>
      </div>
    `;
  } else if (type === 'friends') {
    renderFriendsList(DOM.tabContent, currentUser.hostFriends || []);
    const btn = document.createElement('button');
    btn.id = 'inviteFriendsBtn';
    btn.className = 'themed-btn';
    btn.textContent = 'Invite Friends';
    DOM.tabContent.appendChild(btn);

    btn.addEventListener('click', () => {
      const message = `Hey! I'm hosting on xixi live, join my tab and let's win together! Sign up using my link: `;
      const link = `https://golalaland.github.io/chat/ref.html?ref=${encodeURIComponent(currentUser.uid)}`;
      navigator.clipboard.writeText(message + link)
        .then(() => showThemedMessage('Copied!', 'Invite message copied.', 1500))
        .catch(() => showThemedMessage('Error', 'Failed to copy invite.', 1800));
    });
  } else if (type === 'badges') {
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

function renderFriendsList(container, friends) {
  container.innerHTML = '';
  if (!friends || friends.length === 0) { container.innerHTML = `<div class="muted">No friends yet 😔</div>`; return; }
  const sorted = friends.slice().sort((a, b) => {
    if (a.isVIP && !b.isVIP) return -1;
    if (!a.isVIP && b.isVIP) return 1;
    if (a.isHost && !b.isHost) return -1;
    if (!a.isHost && b.isHost) return 1;
    return 0;
  });
  const list = document.createElement('div'); list.className = 'friends-list';
  sorted.forEach(f => {
    const name = f.chatId || (f.email ? f.email.split('@')[0] : 'Guest');
    const handle = '@' + (f.chatIdLower || name.toLowerCase().replace(/\s+/g, ''));
    let iconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#999"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/></svg>`;
    let extra = '';
    if (f.isVIP) extra += '⭐'; if (f.isHost) extra += '👑';
    const el = document.createElement('div'); el.className = 'friend-item';
    el.innerHTML = `${iconSVG} <span class="friend-name">${name}</span> <span class="friend-handle">${handle}</span> ${extra}`;
    list.appendChild(el);
  });
  container.appendChild(list);
}

/* ------------------ Shop ------------------ */
const renderShop = async () => {
  if (!DOM.shopItems) return;
  DOM.shopItems.innerHTML = '';
  const col = collection(db, 'shopItems');
  const snap = await getDocs(col);
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = `
      <div class="item-name">${data.name || ''}</div>
      <div class="item-cost">${data.cost || 0} ⭐️</div>
      <div class="item-available">Available: ${data.available || 0}</div>
      <button class="redeem-btn">Redeem</button>
    `;
    const btn = div.querySelector('.redeem-btn');
    btn.addEventListener('click', () => redeemProduct({ ...data, id: docSnap.id }));
    DOM.shopItems.appendChild(div);
  });
};

/* ------------------ Redeem ------------------ */
const redeemProduct = async (product) => {
  if (!currentUser) return showThemedMessage('Not Logged In', 'Please sign in to redeem items.');
  if (currentUser.stars < product.cost) return showThemedMessage('Not Enough Stars', 'You do not have enough stars.');
  if (product.available <= 0) return showThemedMessage('Sold Out', 'This item is no longer available.');
  if (product.name?.toLowerCase() === 'redeem cash balance' && Number(currentUser.cash) <= 0) return showThemedMessage('No Cash', 'You have no cash to redeem');

  showLoader(); // central spinner ON

  showConfirmModal('Confirm Redemption', `Redeem "${product.name}" for ${product.cost} ⭐?`, async () => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const productRef = doc(db, 'shopItems', String(product.id));
      let newStars = 0, newCash = 0, redeemedCash = 0;

      await runTransaction(db, async (t) => {
        const [uSnap, pSnap] = await Promise.all([t.get(userRef), t.get(productRef)]);
        if (!uSnap.exists()) throw new Error('User not found');
        if (!pSnap.exists()) throw new Error('Product not found');
        const uData = uSnap.data(), pData = pSnap.data();
        const cost = Number(pData.cost) || 0;
        const available = Number(pData.available) || 0;
        if (Number(uData.stars) < cost) throw new Error('Not enough stars');
        if (available <= 0) throw new Error('Out of stock');

        newStars = Number(uData.stars) - cost;
        if (pData.name?.toLowerCase() === 'redeem cash balance') {
          redeemedCash = Number(uData.cash) || 0;
          newCash = 0;
        } else {
          newCash = Number(uData.cash || 0) + Number(pData.cashReward || 0);
        }

        t.update(userRef, { stars: newStars, cash: newCash });
        t.update(productRef, { available: available - 1 });
        const purchasesCol = collection(db, 'purchases');
        t.set(doc(purchasesCol), {
          userId: currentUser.uid,
          email: uData.email || '',
          phone: uData.phone || '',
          productId: String(pData.id),
          productName: pData.name,
          cost,
          cashReward: Number(pData.cashReward || 0),
          redeemedCash,
          timestamp: serverTimestamp()
        });
      });

      const prevStars = parseNumberFromText(DOM.stars.textContent);
      const prevCash = parseNumberFromText(DOM.cash.textContent);
      currentUser.stars = newStars; currentUser.cash = newCash;
      animateNumber(DOM.stars, prevStars, newStars);
      animateNumber(DOM.cash, prevCash, newCash);
      await renderShop();
      triggerConfetti();
      if (redeemedCash > 0) showThemedMessage('Cash Redeemed', `You redeemed ₦${redeemedCash.toLocaleString()}`, 3000);
      else if (Number(product.cashReward) > 0) showThemedMessage('Redemption Success', `"${product.name}" redeemed and received ₦${Number(product.cashReward).toLocaleString()}`, 2500);
      else showThemedMessage('Redemption Success', `"${product.name}" redeemed!`, 2000);
    } catch (e) {
      console.error(e);
      showThemedMessage('Redemption Failed', e.message || 'Try again');
    } finally {
      hideLoader(); // central spinner OFF
    }
  });
};

/* ------------------ Init ------------------ */
loadCurrentUser().catch(console.error);