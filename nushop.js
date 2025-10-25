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

/* ---------------- Spinner Helpers (Code 1 style) ----------------
   Uses the .shop-spinner element already present in your HTML.
   Toggling the 'active' class will smoothly fade spinner in/out
   because your CSS (.shop-spinner/.shop-spinner.active) controls
   visibility & opacity transitions.
------------------------------------------------------------------*/
function showSpinner() {
  const spinner = document.querySelector('.shop-spinner') || document.getElementById('shopSpinner');
  if (spinner) spinner.classList.add('active');
}

function hideSpinner() {
  const spinner = document.querySelector('.shop-spinner') || document.getElementById('shopSpinner');
  if (spinner) spinner.classList.remove('active');
}

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

/* ------------------ Confetti (lazy load) ------------------ */
const triggerConfetti = () => {
  if (window.__confettiLoaded) return confetti({ particleCount: 90, spread: 65, origin: { y: 0.6 } });
  const s = document.createElement('script');
  s.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js";
  s.onload = () => { window.__confettiLoaded = true; triggerConfetti(); };
  document.body.appendChild(s);
};

/* ------------------ Product modal helper ------------------ */
// Open modal with product info
function openProductModal(product) {
  const modal = document.getElementById("productModal");
  const title = document.getElementById("productModalTitle");
  const desc = document.getElementById("productModalDesc");

  if (!modal || !title || !desc) return;

  title.textContent = product?.name || 'Unnamed';
  desc.textContent = product?.description || product?.desc || 'No description available.';

  modal.classList.add('show');
}

// Close modal by clicking outside content
document.getElementById('productModal').addEventListener('click', (e) => {
  const content = e.currentTarget.querySelector('.product-modal-content');
  if (!content.contains(e.target)) {
    e.currentTarget.classList.remove('show');
  }
});

// Example: attach click event to product names dynamically
document.querySelectorAll('.product-card h3').forEach(nameEl => {
  nameEl.addEventListener('click', () => {
    const card = nameEl.closest('.product-card');
    const product = {
      name: card.querySelector('h3').textContent,
      description: card.dataset.desc || 'No description available.'
    };
    openProductModal(product);
  });
});

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
  DOM.rewardMessage.innerHTML = message; // ✅ allow bold tags to render
  DOM.rewardModal.classList.remove('hidden');
  // Auto-hide after 4.5s
  setTimeout(() => {
    DOM.rewardModal.classList.add('hidden');
  }, 4500);
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
  if (!referrerId) return; // no host to update

  const sanitizedId = String(referrerId).replace(/[.#$[\]]/g, ',');
  const hostRef = doc(db, 'users', sanitizedId);

  try {
    await runTransaction(db, async (t) => {
      const hostSnap = await t.get(hostRef);
      if (!hostSnap.exists()) return;

      const hostData = hostSnap.data() || {};
      const friends = Array.isArray(hostData.hostFriends) ? hostData.hostFriends.slice() : [];

      // Check if this user already exists in hostFriends
      const existing = friends.find(f => f.email === newUser.email);

      if (!existing) {
        // Add to hostFriends
        friends.push({
          email: newUser.email,
          chatId: newUser.chatId || '',
          chatIdLower: (newUser.chatId || '').toLowerCase(),
          isVIP: !!newUser.isVIP,
          isHost: !!newUser.isHost,
          giftShown: false
        });
      }

      // Only increment hostVIP if new user is VIP AND not already counted
      let hostVIP = hostData.hostVIP || 0;
      if (newUser.isVIP && !existing) {
        hostVIP += 1;
      }

      t.update(hostRef, { hostFriends: friends, hostVIP });
    });
  } catch (err) {
    console.error('Failed to update host stats:', err);
  }
};

/* ------------------ Current user state ------------------ */
let currentUser = null;

/* ------------------ Load current user from localStorage and Firestore ------------------ */
const loadCurrentUser = async () => {
  showSpinner();

  try {
    // --- Load user from localStorage ---
    const vipRaw = localStorage.getItem('vipUser');
    const hostRaw = localStorage.getItem('hostUser');
    const storedUser = vipRaw ? JSON.parse(vipRaw) : hostRaw ? JSON.parse(hostRaw) : null;

    // --- Reset UI ---
    if (DOM.username) DOM.username.textContent = '******';
    if (DOM.stars) DOM.stars.textContent = `0 ⭐️`;
    if (DOM.cash) DOM.cash.textContent = `₦0`;
    if (DOM.hostTabs) DOM.hostTabs.style.display = 'none';
    await renderShop();

    if (!storedUser?.email) {
      currentUser = null;
      return;
    }

    // --- Get Firestore data ---
    const uid = String(storedUser.email).replace(/[.#$[\]]/g, ',');
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);

    // --- Fallback user if not in Firestore ---
    if (!snap.exists()) {
      currentUser = {
        uid,
        stars: 0,
        cash: 0,
        isHost: false,
        chatId: storedUser.displayName || storedUser.email.split('@')[0]
      };
      if (DOM.username) DOM.username.textContent = currentUser.chatId;
      return;
    }

    currentUser = { uid, ...snap.data() };

    // --- Update UI ---
    if (DOM.username)
      DOM.username.textContent =
        currentUser.chatId ||
        storedUser.displayName ||
        storedUser.email.split('@')[0] ||
        'Guest';
    if (DOM.stars) DOM.stars.textContent = `${formatNumber(currentUser.stars)} ⭐️`;
    if (DOM.cash) DOM.cash.textContent = `₦${formatNumber(currentUser.cash)}`;
    if (DOM.hostTabs) DOM.hostTabs.style.display = currentUser.isHost ? '' : 'none';

    updateHostPanels();

    // --- Only update host stats if first time VIP/Host addition ---
    if (currentUser?.invitedBy && currentUser._firstLoad === undefined) {
      // Mark first load to prevent reload increments
      currentUser._firstLoad = false;

      await updateHostStats({
        email: currentUser.email || '',
        chatId: currentUser.chatId || '',
        vipName: currentUser.chatId || '',
        isVIP: currentUser.isVIP || false,
        isHost: currentUser.isHost || false,
        invitedBy: currentUser.invitedBy
      });
    }

    // --- Setup VIP/Host features ---
    try {
      if (currentUser.isVIP) setupVIPButton();
      else if (currentUser.isHost) setupHostGiftListener();
    } catch (e) {
      console.error('Failed to initialize VIP/Host features:', e);
    }

    // --- Subscribe to realtime updates ---
    onSnapshot(userRef, async (docSnap) => {
      const data = docSnap.data();
      if (!data) return;
      currentUser = { uid, ...data };

      // Update UI live
      if (DOM.username)
        DOM.username.textContent =
          currentUser.chatId ||
          storedUser.displayName ||
          storedUser.email.split('@')[0] ||
          'Guest';
      if (DOM.stars) DOM.stars.textContent = `${formatNumber(currentUser.stars)} ⭐️`;
      if (DOM.cash) DOM.cash.textContent = `₦${formatNumber(currentUser.cash)}`;
      if (DOM.hostTabs) DOM.hostTabs.style.display = currentUser.isHost ? '' : 'none';

      updateHostPanels();
      renderShop().catch(console.error);

      /* --- Invitee reward flow --- */
      try {
        if ((data.invitedBy || data.hostName) && data.inviteeGiftShown !== true) {
          let inviterName = data.hostName || data.invitedBy;
          let inviteeStars = data.inviteeGiftStars;

          try {
            const invRef = doc(db, 'users', String(data.invitedBy).replace(/[.#$[\]]/g, ','));
            const invSnap = await getDoc(invRef);
            if (invSnap.exists()) {
              const invData = invSnap.data();
              inviterName =
                invData.chatId ||
                invData.hostName ||
                (invData.email ? invData.email.split('@')[0] : inviterName);
              inviteeStars = inviteeStars || invData.inviteeGiftStars;
            }
          } catch (err) {
            console.warn('Could not fetch inviter details:', err);
          }

          inviteeStars = inviteeStars || 50;

          showReward(
            `You’ve been gifted <b>+${inviteeStars}⭐️</b> for joining <b>${inviterName}</b>’s VIP Tab.`,
            '⭐ Congratulations! ⭐️'
          );

          await updateDoc(userRef, {
            inviteeGiftShown: true,
            inviteeGiftStars: inviteeStars
          });
        }
      } catch (e) {
        console.error('Invitee reward flow error', e);
      }

      /* --- Inviter reward flow --- */
      try {
        const friendsArr = Array.isArray(data.hostFriends) ? data.hostFriends : [];
        const pending = friendsArr.find(f => !f.giftShown && f.email);

        if (pending) {
          const friendName =
            pending.vipName ||
            pending.chatId ||
            (pending.email ? pending.email.split('@')[0] : 'Friend');

          let inviterStars = pending.giftStars || 200;

          showReward(
            `You’ve been gifted <b>+${inviterStars}⭐️</b>, <b>${friendName}</b> just joined your Tab.`,
            '⭐ Congratulations! ⭐️'
          );

          const updated = friendsArr.map(f =>
            f.email === pending.email ? { ...f, giftShown: true, giftStars: inviterStars } : f
          );

          await updateDoc(userRef, { hostFriends: updated });
        }
      } catch (e) {
        console.error('Inviter reward flow error', e);
      }
    });
  } catch (e) {
    console.error('loadCurrentUser error', e);
  } finally {
    hideSpinner();
  }
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
  } else if (type === 'friends') {
    renderFriendsList(DOM.tabContent, currentUser.hostFriends || []);

    const btn = document.createElement('button');
    btn.id = 'inviteFriendsBtn';
    btn.className = 'themed-btn';
    btn.textContent = 'Invite Friends';
    DOM.tabContent.appendChild(btn);

    btn.addEventListener('click', () => {
      const message = `Hey! I'm hosting on xixi live, join my tab and let’s win together 🎉 Sign up using my link: `;
      const link = `https://golalaland.github.io/chat/ref.html?ref=${encodeURIComponent(currentUser.uid)}`;
      const fullText = message + link;

      navigator.clipboard.writeText(fullText)
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
/* ------------------ Friends rendering ------------------ */
function renderFriendsList(container, friends) {
  container.innerHTML = '';
  if (!friends || friends.length === 0) {
    container.innerHTML = `<div class="muted">No friends yet 😔</div>`;
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
          <div style="font-weight:600;color:${color};">${name}</div>
          <div style="font-size:0.85rem;color:#888;">${handle}</div>
        </div>
      </div>
    `;
    list.appendChild(card);
  });

  container.appendChild(list);
}

/* ------------------ Host tabs click ------------------ */
DOM.hostTabs?.addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const type = btn.dataset.tab;
  renderTabContent(type);
});

/* ------------------ User tabs (Shop/Orders) ------------------ */
const userTabs = document.getElementById('userTabs');
userTabs?.addEventListener('click', e => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  userTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (btn.dataset.tab === 'shop') {
    DOM.shopItems.style.display = 'grid';
    DOM.ordersContent.style.display = 'none';
  } else {
    DOM.shopItems.style.display = 'none';
    DOM.ordersContent.style.display = 'block';
    renderMyOrders();
  }
});

/* ------------------ Orders rendering ------------------ */
const renderMyOrders = async () => {
  const ordersList = DOM.ordersList;
  if (!ordersList) return;
  showSpinner();
  ordersList.innerHTML = '<div style="text-align:center;color:#555;">Loading orders...</div>';
  if (!currentUser) { ordersList.innerHTML = '<div style="text-align:center;color:#555;">Not logged in.</div>'; hideSpinner(); return; }

  try {
    const purchasesRef = collection(db, 'purchases');
    const snap = await getDocs(purchasesRef);
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => o.userId === currentUser.uid);
    if (orders.length === 0) { ordersList.innerHTML = '<div style="text-align:center;color:#555;">No orders yet..hmmmmm! 🤔</div>'; return; }
    orders.sort((a, b) => {
      const ta = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
      const tb = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
      return tb - ta;
    });
    ordersList.innerHTML = '';
    orders.forEach(order => {
      const block = document.createElement('div'); block.className = 'stat-block';
      const dateText = order.timestamp?.toDate ? order.timestamp.toDate().toLocaleString() : '';
      block.innerHTML = `
        <div class="stat-value">${order.productName || 'Unnamed'}</div>
        <div class="stat-label">${order.cost || 0} ⭐${order.cashReward ? ' - ₦' + Number(order.cashReward).toLocaleString() : ''}</div>
        ${dateText ? `<div class="muted">${dateText}</div>` : ''}
      `;
      ordersList.appendChild(block);
    });
  } catch (e) {
    console.error(e);
    ordersList.innerHTML = '<div style="text-align:center;color:#ccc;">Failed to load orders.</div>';
  } finally {
    hideSpinner();
  }
};

/* ------------------ CREATE PRODUCT CARD (Updated for Hosted Paystack) ------------------ */
const createProductCard = (product) => {
  // Skip invisible cards for host/vip restrictions
  if ((product.hostOnly && currentUser?.isVIP) || (product.vipOnly && currentUser?.isHost)) return null;

  const card = document.createElement('div');
  card.className = 'product-card';

  // Image
  const img = document.createElement('img');
  img.src = product.img || 'https://via.placeholder.com/300';
  img.alt = product.name || 'Item';
  img.addEventListener('click', () => previewImage(img.src));

  // Availability badge
  const badge = document.createElement('span');
  badge.className = 'availability-badge';
  const avail = Number(product.available) || 0;
  badge.textContent = avail > 0 ? `${avail} Left` : 'Sold Out';
  if (avail <= 0) badge.style.background = '#666';

  // Title
  const title = document.createElement('h3');
  title.textContent = product.name || 'Unnamed';
  title.style.cursor = 'pointer';
  title.addEventListener('click', () => openProductModal(product));

  // Price (for redeemable products)
  const price = document.createElement('div');
  price.className = 'price';
  price.textContent = `${Number(product.cost) || 0} ⭐`;

  // Button
  let btn = document.createElement('button');

  if (product.subscriberProduct) {
    // Gold gradient "Join" button
    btn.className = 'subscriber-btn';
    btn.textContent = 'Join';
    btn.style.background = 'linear-gradient(90deg, #FFD700, #FFA500)';
    btn.style.color = '#fff';
    btn.style.fontWeight = 'bold';
    btn.style.border = 'none';
    btn.style.borderRadius = '8px';
    btn.style.padding = '0.6rem 1.2rem';
    btn.style.fontSize = '1rem';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 4px 10px rgba(255, 215, 0, 0.5)';
    btn.style.transition = 'transform 0.2s, box-shadow 0.2s';

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px)';
      btn.style.boxShadow = '0 6px 15px rgba(255, 215, 0, 0.7)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0)';
      btn.style.boxShadow = '0 4px 10px rgba(255, 215, 0, 0.5)';
    });

    if (avail <= 0) btn.disabled = true;

    // 🟨 Open Paystack hosted page with prefilled details
    btn.addEventListener('click', () => {
      if (!currentUser) return alert('Please log in first.');
      const email = encodeURIComponent(currentUser.email || '');
      const phone = encodeURIComponent(currentUser.phone || '');
      const planId = product.paystackPlanId?.startsWith('PLN_') ? product.paystackPlanId.slice(4) : product.paystackPlanId;
      const link = `https://paystack.com/pay/${planId}?email=${email}&phone=${phone}`;
      window.open(link, '_blank');
    });

  } else {
    // Regular redeemable product
    btn.className = 'buy-btn';
    btn.textContent = 'Redeem';
    if (
      avail <= 0 ||
      (product.name?.toLowerCase() === 'redeem cash balance' &&
        currentUser &&
        Number(currentUser.cash) <= 0)
    ) {
      btn.disabled = true;
    }
    btn.addEventListener('click', () => redeemProduct(product));
  }

  // Assemble
  card.append(badge, img, title);
  if (!product.subscriberProduct) card.append(price);
  card.append(btn);

  return card;
};

/* ------------------ Redeem product ------------------ */
const redeemProduct = async (product) => {
  if (!currentUser) return showThemedMessage('Not Logged In', 'Please sign in to redeem items.');
  if (currentUser.stars < product.cost) return showThemedMessage('Not Enough Stars', 'You do not have enough stars.');
  if (product.available <= 0) return showThemedMessage('Sold Out', 'This item is no longer available.');
  if (product.name?.toLowerCase() === 'redeem cash balance' && Number(currentUser.cash) <= 0) return showThemedMessage('No Cash', 'You have no cash to redeem');

  showConfirmModal('Confirm Redemption', `Redeem "${product.name}" for ${product.cost} ⭐?`, async () => {
    showSpinner();

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

        // Update user and product
        t.update(userRef, { stars: newStars, cash: newCash });
        t.update(productRef, { available: available - 1 });

        // Record purchase
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
      currentUser.stars = newStars;
      currentUser.cash = newCash;
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
      hideSpinner();
    }
  });
};

/* ------------------ PAYSTACK WRAPPER FOR JOIN BUTTON ------------------ */

// Import your launchSubscription function if using modules
// import { launchSubscription } from './paystack.js';

// Called from subscriber product button
function openPaystackPayment(planId) {
  if (!currentUser) {
    alert('Please log in first to join.');
    return;
  }

  // Optional: you can check planId if you have multiple subscriber products
  // Currently we only have one VIP plan
  launchSubscription(currentUser);
}

/* ------------------ RENDER SHOP ------------------ */
// Render the shop items dynamically
const renderShop = async () => {
  if (!DOM.shopItems) return;
  showSpinner();
  DOM.shopItems.innerHTML = '';

  try {
    const shopSnap = await getDocs(collection(db, 'shopItems'));
    if (shopSnap.empty) {
      DOM.shopItems.innerHTML = '<div style="text-align:center;color:#555;">No items found</div>';
      return;
    }

    let delay = 0;

    shopSnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      const product = {
        id: docSnap.id,
        name: data.name || '',
        img: data.img || '',
        cost: data.cost || 0,
        available: data.available || 0,
        hostOnly: data.hostOnly || false,
        vipOnly: data.vipOnly || false,
        subscriberProduct: data.subscriberProduct || false,
        cashReward: data.cashReward || 0,
        description: data.description || data.desc || '',
        paystackPlanId: data.paystackPlanId || ''
      };

      const card = createProductCard(product);
      if (!card) return; // skip invisible cards

      // Fade-in animation
      card.style.opacity = '0';
      card.style.animation = `fadeInUp 0.35s forwards`;
      card.style.animationDelay = `${delay}s`;
      delay += 0.05;

      DOM.shopItems.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    DOM.shopItems.innerHTML = '<div style="text-align:center;color:#ccc;">Failed to load shop</div>';
  } finally {
    hideSpinner();
  }
};

/* -------------------------------
   🌗 Theme Toggle Script
--------------------------------- */
(function () {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  // Load saved theme
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark');
  } else if (savedTheme === 'light') {
    document.body.classList.add('light-mode-forced');
  } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark');
  }

  // Set correct icon
  btn.textContent = document.body.classList.contains('dark') ? '🌙' : '☀️';

  // Toggle on click
  btn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark');
    document.body.classList.toggle('light-mode-forced', !isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    btn.textContent = isDark ? '🌙' : '☀️';
  });
})();

document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("productModal");
  const modalClose = document.getElementById("closeProductModal");

  // Close button
  modalClose?.addEventListener("click", () => {
    modal?.classList.add("hidden");
  });

  // Close when clicking outside content (modal overlay)
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.add("hidden");
  });

  // Optional: ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') modal?.classList.add('hidden');
  });
});
/* ------------------ SAFE INIT ------------------ */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadCurrentUser(); // 👈🏽 ensures user & listeners are initialized safely
    console.log('✅ User data + listeners initialized');
  } catch (err) {
    console.error('Init error:', err);
  }
});
