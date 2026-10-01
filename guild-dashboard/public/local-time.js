(() => {
  // Shows server-rendered UTC times in the visitor's own timezone. The UTC text stays as the tooltip and as the fallback.
  const FORMATS = {
    datetime: { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" },
    date: { day: "numeric", month: "short", year: "numeric" }
  };

  for (const element of document.querySelectorAll("[data-local-time]")) {
    const options = FORMATS[element.getAttribute("data-local-time")];
    const when = Date.parse(element.getAttribute("datetime"));
    if (!options || Number.isNaN(when)) continue;
    try {
      const original = element.textContent;
      element.textContent = new Intl.DateTimeFormat(undefined, options).format(new Date(when));
      element.title = original.includes("UTC") ? original : `${original} UTC`;
    } catch {
      // An unsupported locale or option leaves the UTC text in place.
    }
  }
})();
