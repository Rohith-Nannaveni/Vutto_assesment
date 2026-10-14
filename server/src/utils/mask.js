// Public display name: "Rahul Sharma" -> "R••• S." Never expose emails or ids to other users.
export function maskName(name) {
  if (!name) return 'Anonymous';
  const parts = String(name).trim().split(/\s+/);
  const first = Array.from(parts[0])[0] ?? '?';
  const last = parts.length > 1 ? ` ${Array.from(parts[parts.length - 1])[0]}.` : '';
  return `${first.toUpperCase()}•••${last}`;
}
