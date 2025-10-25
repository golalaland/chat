/* paystack.js */
export async function launchSubscription(vipUser, db) {
  if (!vipUser || !vipUser.email || !vipUser.chatId) {
    alert("Invalid user data.");
    return;
  }

  if (!window.PaystackPop) {
    alert("Paystack not loaded.");
    return;
  }

  const PLAN_CODE = "PLN_grrpmsot7duff3v";
  const reference = "SUB_" + vipUser.chatId + "_" + Date.now();

  const handler = PaystackPop.setup({
    key: "pk_test_9446fa6b81888ffce77cc94294530d761aac4ccd",
    email: vipUser.email,
    plan: PLAN_CODE,
    ref: reference,
    label: vipUser.chatId,
    metadata: {
      custom_fields: [{ display_name: "Chat ID", variable_name: "chat_id", value: vipUser.chatId }],
    },
    callback: async function (response) {
      try {
        const safeEmail = vipUser.email.replace(/[.#$[\]]/g, ",");
        await updateDoc(doc(db, "users", safeEmail), {
          subscriptionActive: true,
          subscriptionEnd: new Date(Date.now() + 169 * 60 * 60 * 1000),
          subscriptionPlanCode: PLAN_CODE,
          subscriptionRef: response.reference,
          updatedAt: serverTimestamp(),
        });

        const updatedUser = { ...vipUser, subscriptionActive: true };
        localStorage.setItem("vipUser", JSON.stringify(updatedUser));
        alert("🎉 VIP Subscription Activated!");
      } catch (err) {
        console.error("Firestore update error:", err);
        alert("Payment succeeded, but update failed.");
      }
    },
    onClose: function () {
      alert("Subscription window closed.");
    },
  });

  handler.openIframe();
}