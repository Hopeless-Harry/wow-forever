(() => {
  const box = document.querySelector("[data-launch]");
  const output = document.querySelector("#launch-countdown");
  if (!box || !output) return;
  const launch = Date.parse(box.dataset.launch);
  if (Number.isNaN(launch)) return;

  function tick() {
    const remaining = launch - Date.now();
    if (remaining <= 0) {
      output.textContent = "WoW Forever is live";
      return false;
    }
    const days = Math.floor(remaining / 86_400_000);
    const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
    const minutes = Math.floor((remaining % 3_600_000) / 60_000);
    output.textContent = `${days}d ${hours}h ${minutes}m`;
    return true;
  }

  if (tick()) window.setInterval(tick, 30_000);
})();
