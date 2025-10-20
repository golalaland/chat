// admin-payfeed.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ------------------ FIREBASE CONFIG ------------------
const firebaseConfig = {
  // your firebase config here
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ------------------ ELEMENTS ------------------
const adminGate = document.getElementById("adminGate");
const adminPanel = document.getElementById("adminPanel");
const adminEmailInput = document.getElementById("adminEmail");
const adminCheckBtn = document.getElementById("adminCheckBtn");
const adminGateMsg = document.getElementById("adminGateMsg");
const currentAdminEmail = document.getElementById("currentAdminEmail");

const usersTableBody = document.querySelector("#usersTable tbody");
const whitelistTableBody = document.querySelector("#whitelistTable tbody");
const featuredTableBody = document.querySelector("#featuredTable tbody");

const loaderOverlay = document.getElementById("loaderOverlay");
const loaderText = document.getElementById("loaderText");

const userSearch = document.getElementById("userSearch");

// ------------------ LOADER ------------------
function showLoader(msg = "Processing...") {
  loaderText.textContent = msg;
  loaderOverlay.style.display = "flex";
}
function hideLoader() {
  loaderOverlay.style.display = "none";
}

// ------------------ ADMIN GATE ------------------
adminCheckBtn.addEventListener("click", async () => {
  const email = adminEmailInput.value.trim().toLowerCase();
  if (!email) return;
  showLoader("Checking admin...");
  try {
    const userDoc = await getDoc(doc(db, "users", email));
    if (userDoc.exists() && userDoc.data().isAdmin) {
      adminGate.style.display = "none";
      adminPanel.classList.remove("hidden");
      currentAdminEmail.textContent = email;
      loadAllData();
    } else {
      adminGateMsg.textContent = "Not an admin";
    }
  } catch (e) {
    console.error(e);
    adminGateMsg.textContent = "Error checking admin";
  } finally {
    hideLoader();
  }
});

// ------------------ LOAD DATA ------------------
async function loadAllData() {
  await Promise.all([loadUsers(), loadWhitelist(), loadFeatured()]);
}

// ------------------ USERS ------------------
async function loadUsers() {
  usersTableBody.innerHTML = "";
  const snapshot = await getDocs(collection(db, "users"));
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    usersTableBody.appendChild(createUserRow(docSnap.id, data));
  });
}

function createUserRow(id, data) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="checkbox" class="userCheckbox"/></td>
    <td>${data.email || ""}</td>
    <td>${data.phone || ""}</td>
    <td>${data.chatId || ""}</td>
    <td><input type="number" class="starsInput" value="${data.stars || 0}" /></td>
    <td><input type="number" class="cashInput" value="${data.cash || 0}" /></td>
    <td><input type="checkbox" class="vipInput" ${data.isVIP ? "checked" : ""} /></td>
    <td><input type="checkbox" class="adminInput" ${data.isAdmin ? "checked" : ""} /></td>
    <td><input type="checkbox" class="hostInput" ${data.isHost ? "checked" : ""} /></td>
    <td><input type="checkbox" class="subInput" ${data.subscriptionActive ? "checked" : ""} /></td>
    <td><input type="checkbox" class="featuredInput" ${data.featuredHosts ? "checked" : ""} /></td>
    <td><input type="text" class="popupPhotoInput" value="${data.popupPhoto || ""}" /></td>
    <td><input type="text" class="videoUrlInput" value="${data.videoUrl || ""}" /></td>
    <td><button class="btn btn-primary saveUserBtn">Save</button></td>
  `;

  tr.querySelector(".saveUserBtn").addEventListener("click", async () => {
    showLoader("Saving user...");
    try {
      await updateDoc(doc(db, "users", id), {
        stars: Number(tr.querySelector(".starsInput").value),
        cash: Number(tr.querySelector(".cashInput").value),
        isVIP: tr.querySelector(".vipInput").checked,
        isAdmin: tr.querySelector(".adminInput").checked,
        isHost: tr.querySelector(".hostInput").checked,
        subscriptionActive: tr.querySelector(".subInput").checked,
        featuredHosts: tr.querySelector(".featuredInput").checked,
        popupPhoto: tr.querySelector(".popupPhotoInput").value,
        videoUrl: tr.querySelector(".videoUrlInput").value
      });
      alert("User saved!");
    } catch (e) {
      console.error(e);
      alert("Error saving user");
    } finally {
      hideLoader();
    }
  });

  return tr;
}

// ------------------ WHITELIST ------------------
async function loadWhitelist() {
  whitelistTableBody.innerHTML = "";
  const snapshot = await getDocs(collection(db, "whitelist"));
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    whitelistTableBody.appendChild(createWhitelistRow(docSnap.id, data));
  });
}

function createWhitelistRow(id, data) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="checkbox" class="wlCheckbox"/></td>
    <td>${data.email || ""}</td>
    <td>${data.phone || ""}</td>
    <td><input type="checkbox" class="wlSubInput" ${data.subscriptionActive ? "checked" : ""} /></td>
    <td><button class="btn btn-primary saveWlBtn">Save</button></td>
  `;
  tr.querySelector(".saveWlBtn").addEventListener("click", async () => {
    showLoader("Saving whitelist...");
    try {
      await updateDoc(doc(db, "whitelist", id), {
        subscriptionActive: tr.querySelector(".wlSubInput").checked
      });
      alert("Whitelist saved!");
    } catch (e) {
      console.error(e);
      alert("Error saving whitelist");
    } finally {
      hideLoader();
    }
  });
  return tr;
}

// ------------------ FEATURED HOSTS ------------------
async function loadFeatured() {
  featuredTableBody.innerHTML = "";
  const snapshot = await getDocs(collection(db, "featuredHosts"));
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    featuredTableBody.appendChild(createFeaturedRow(docSnap.id, data));
  });
}

function createFeaturedRow(id, data) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="checkbox" class="featuredCheckbox"/></td>
    <td>${data.email || ""}</td>
    <td>${data.phone || ""}</td>
    <td><input type="text" class="popupPhotoInput" value="${data.popupPhoto || ""}" /></td>
    <td><input type="text" class="videoUrlInput" value="${data.videoUrl || ""}" /></td>
    <td>${data.addedAt ? new Date(data.addedAt.seconds*1000).toLocaleString() : ""}</td>
    <td><button class="btn btn-primary saveFeaturedBtn">Save</button></td>
  `;
  tr.querySelector(".saveFeaturedBtn").addEventListener("click", async () => {
    showLoader("Saving featured host...");
    try {
      await updateDoc(doc(db, "featuredHosts", id), {
        popupPhoto: tr.querySelector(".popupPhotoInput").value,
        videoUrl: tr.querySelector(".videoUrlInput").value
      });
      alert("Featured host saved!");
    } catch (e) {
      console.error(e);
      alert("Error saving featured host");
    } finally {
      hideLoader();
    }
  });
  return tr;
}

// ------------------ SEARCH ------------------
userSearch.addEventListener("input", async () => {
  const val = userSearch.value.toLowerCase();
  const rows = usersTableBody.querySelectorAll("tr");
  rows.forEach((row) => {
    const email = row.children[1].textContent.toLowerCase();
    const chatId = row.children[3].textContent.toLowerCase();
    row.style.display = email.includes(val) || chatId.includes(val) ? "" : "none";
  });
});