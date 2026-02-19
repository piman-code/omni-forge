import { LinkSignal } from "./autoLink";

function normalize(value: string): string {
  return value.replace(/\s/g, " ").trim().toLowerCase();
}

function splitPath(path: string): string[] {
  return normalize(path).split("/").filter((p) => p.length > 0);
}

function tokenizeFileName(path: string): string[] {
  const parts = splitPath(path);
  const file = parts[parts.length - 1] ?? "";
  const base = file.replace(/\.md$/i, "");
  return base
    .split(/[^a-z0-9가-힣]/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function shareSameFolder(pathA: string, pathB: string): boolean {
  const a = splitPath(pathA);
  const b = splitPath(pathB);
  if (a.length < 2 || b.length < 2) return false;
  const folderA = a.slice(0, -1).join("/");
  const folderB = b.slice(0, -1).join("/");
  return folderA === folderB && folderA.length > 0;
}

function shareKeyword(pathA: string, pathB: string): boolean {
  const tokensA = new Set(tokenizeFileName(pathA));
  const tokensB = tokenizeFileName(pathB);
  for (const t of tokensB) {
    if (tokensA.has(t)) return true;
  }
  return false;
}

function extractYearToken(path: string): string | null {
  const match = normalize(path).match(/\b(20\d{2})\b/);
  return match ? match[1] : null;
}

function shareSameYear(pathA: string, pathB: string): boolean {
  const yearA = extractYearToken(pathA);
  const yearB = extractYearToken(pathB);
  return yearA !== null && yearA === yearB;
}

export function inferSignalsFromPaths(
  pathA: string,
  pathB: string
): LinkSignal[] {
  const signals: LinkSignal[] = [];

  const a = normalize(pathA);
  const b = normalize(pathB);

  if (a.length === 0 || b.length === 0) {
    return signals;
  }

  if (a === b) {
    return signals;
  }

  // 1) 같은 폴더 → 약한 context 신호
  if (shareSameFolder(a, b)) {
    signals.push("context");
  }

  // 2) 파일명 키워드 겹침 → topic/entity 신호
  if (shareKeyword(a, b)) {
    signals.push("topic");
  }

  // 3) 같은 연도 포함 → time 신호
  if (shareSameYear(a, b)) {
    signals.push("time");
  }

  return signals;
}