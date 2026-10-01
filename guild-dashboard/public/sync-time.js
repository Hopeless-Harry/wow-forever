(() => {
  const element = document.querySelector("[data-sync-time]");
  if (!element) return;
  const syncedAt = Date.parse(element.getAttribute("datetime"));
  if (Number.isNaN(syncedAt)) return;

  function describe(elapsedMs) {
    const minutes = Math.floor(elapsedMs / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    const days = Math.floor(hours / 24);
    return `${days} ${days === 1 ? "day" : "days"} ago`;
  }

  function update() {
    element.textContent = `updated ${describe(Math.max(0, Date.now() - syncedAt))}`;
  }

  update();
  window.setInterval(update, 30_000);
})();
