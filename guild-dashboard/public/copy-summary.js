(() => {
  const button = document.querySelector("[data-copy-summary]");
  const field = document.querySelector("#guild-summary");
  const status = document.querySelector("#copy-status");
  if (!button || !field) return;

  async function copy() {
    let copied = false;
    try {
      await navigator.clipboard.writeText(field.value);
      copied = true;
    } catch {
      field.focus();
      field.select();
      try { copied = document.execCommand("copy"); } catch { copied = false; }
    }
    if (status) status.textContent = copied ? "Copied — paste it into Discord." : "Press Ctrl+C to copy the selected text.";
    button.textContent = copied ? "Copied!" : "Copy for Discord";
    window.setTimeout(() => { button.textContent = "Copy for Discord"; }, 2500);
  }

  button.addEventListener("click", copy);
  field.addEventListener("focus", () => field.select());
})();
