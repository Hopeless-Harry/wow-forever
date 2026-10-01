// Member-supplied text pasted into Discord must not ping anyone or turn into formatting.
// A zero-width space after "@" stops @everyone, @here and <@id> / <@&id> mentions;
// backslashes escape Discord markdown characters. Ordinary names pass through unchanged.
const ZERO_WIDTH_SPACE = "​";

export function discordSafe(text) {
  return String(text ?? "")
    .replace(/[\\*_~`|>[\]]/g, "\\$&")
    .replace(/@/g, `@${ZERO_WIDTH_SPACE}`)
    .replace(/<(?=[@#:])/g, `<${ZERO_WIDTH_SPACE}`);
}
