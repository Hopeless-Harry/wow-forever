(() => {
  const fetchedAt = document.body.dataset.fetchedAt;
  async function checkForNewLedger() {
    try {
      const response = await fetch("/api/public-data", { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json();
      if (next.fetchedAt && next.fetchedAt !== fetchedAt) window.location.reload();
    } catch {
      // The rendered cache remains usable while the connection is unavailable.
    }
  }
  window.setInterval(checkForNewLedger, 120_000);
})();
