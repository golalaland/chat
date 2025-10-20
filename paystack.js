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
  apiKey: "AIzaSyDbKz4ef_eUDlCukjmnK38sOwueYuzqoao",
  authDomain: "metaverse-1010.firebaseapp.com",
  projectId: "metaverse-1010",
  storageBucket: "metaverse-1010.firebasestorage.app",
  messagingSenderId: "1044064238233",
  appId: "1:1044064238233:web:2fbdfb811cb0a3ba349608",
  measurementId: "G-S77BMC266C",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ------------------ PAYSTACK SUBSCRIPTION FUNCTION ------------------ */
export async function launchSubscription(vipUser) {
  if (!vipUser || !vipUser.email || !vipUser.chatId) {
    alert("Invalid user data. Please sign up again.");
    return;
  }

  const PLAN_CODE = "PLN_grrpmsot7duff3v"; // Your Paystack plan code
  const reference = "SUB_" + vipUser.chatId + "_" + Date.now();

  const handler = PaystackPop.setup({
    key: "pk_test_9446fa6b81888ffce77cc94294530d761aac4ccd",
    email: vipUser.email,
    plan: PLAN_CODE, // ✅ Correct usage
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

      const duration = 169 * 60 * 60 * 1000; // 169 hours ≈ 7 days
      const expiry = new Date(Date.now() + duration);

      try {
        // Firestore-safe document ID for email
        const safeEmail = vipUser.email.replace(/[.#$[\]]/g, ",");

        await updateDoc(doc(db, "users", safeEmail), {
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