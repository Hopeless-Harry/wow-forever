(() => {
  // Every button with data-copy-target copies the text box with that id and reports in the element named by data-copy-status.
  for (const button of document.querySelectorAll("[data-copy-target]")) {
    const field = document.getElementById(button.dataset.copyTarget);
    const status = button.dataset.copyStatus ? document.getElementById(button.dataset.copyStatus) : null;
    if (!field) continue;
    const label = button.textContent;

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
      button.textContent = copied ? "Copied!" : label;
      window.setTimeout(() => { button.textContent = label; }, 2500);
    }

    button.addEventListener("click", copy);
    field.addEventListener("focus", () => field.select());
  }
})();
