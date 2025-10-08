const removeBtn = document.createElement("button");
removeBtn.className = "btn btn-danger";
removeBtn.textContent = "Remove";

removeBtn.addEventListener("click", async () => {
  const confirmed = await showConfirmModal("Delete user", `Remove ${u.email} from database and whitelist?`);
  if (!confirmed) return;

  showLoader("Removing user...");
  try {
    await deleteDoc(doc(db, "users", u.id));
    await deleteDoc(doc(db, "whitelist", (u.email || "").toLowerCase())).catch(() => {});
    hideLoader();
    await loadUsers();
    await loadWhitelist();
    alert(`${u.email} removed.`);
  } catch (err) {
    hideLoader();
    console.error("remove user error", err);
    alert("Failed to remove user. See console.");
  }
});

tr.children[9].appendChild(removeBtn);