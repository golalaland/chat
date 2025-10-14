/* ------------------ PAYSTACK VIP SUBSCRIPTION SCRIPT ------------------ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* ------------------ FIREBASE CONFIG ------------------ */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ------------------ PAYSTACK SUBSCRIPTION FUNCTION ------------------ */
export async function launchSubscription(vipUser) {
  if (!vipUser || !vipUser.email || !vipUser.chatId) {
    alert("Invalid user data. Please sign up again.");
    return;
  }

  // Paystack Plan Code (Create this once on your dashboard)
  const PLAN_CODE = "PLN_yourplanid"; // replace with your Paystack plan code

  // Generate reference
  const reference = "SUB_" + vipUser.chatId + "_" + Date.now();

  const handler = PaystackPop.setup({
    key: "YOUR_PAYSTACK_PUBLIC_KEY", // your live or test public key
    email: vipUser.email,
    plan: PLAN_CODE,
    ref: reference,
    label: vipUser.chatId,
    metadata: {
      custom_fields: [
        {
          display_name: "Chat ID",
          variable_name: "chat_id",
          value: vipUser.chatId,
        },
      ],
    },
    callback: async function (response) {
      console.log("✅ Subscription created:", response);

      const duration = 169 * 60 * 60 * 1000; // 169 hours = ~7 days
      const expiry = new Date(Date.now() + duration);

      try {
        await updateDoc(doc(db, "users", vipUser.email), {
          subscriptionActive: true,
          subscriptionEnd: expiry,
          subscriptionPlanCode: PLAN_CODE,
          subscriptionRef: response.reference,
          updatedAt: serverTimestamp(),
        });

        const updatedUser = {
          ...vipUser,
          subscriptionActive: true,
          subscriptionEnd: expiry,
          subscriptionPlanCode: PLAN_CODE,
        };
        localStorage.setItem("vipUser", JSON.stringify(updatedUser));

        alert("🎉 VIP Subscription Activated!");
        window.location.href = "nushop.html";
      } catch (err) {
        console.error("❌ Firestore update error:", err);
        alert("Payment success, but Firestore update failed. Contact support.");
      }
    },
    onClose: function () {
      alert("Subscription window closed. Try again later.");
    },
  });

  handler.openIframe();
}