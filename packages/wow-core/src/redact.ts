import path from "node:path";

export function redactWowPath(value: string, wtfRoot: string): string {
  const relative = path.relative(wtfRoot, value);
  const segments = relative.split(path.sep);
  const accountIndex = segments.findIndex((segment) => segment.toLowerCase() === "account");
  if (accountIndex >= 0) {
    const labels = ["<account>", "<realm>", "<character>"];
    for (let offset = 1; offset <= 3; offset += 1) {
      const index = accountIndex + offset;
      if (!segments[index] || segments[index]?.toLowerCase() === "savedvariables") break;
      segments[index] = labels[offset - 1]!;
    }
  }
  return segments.join("/");
}

