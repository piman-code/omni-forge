#!/usr/bin/env node

const DEFAULT_DENY_SCOPE_VIOLATION = "DEFAULT_DENY_SCOPE_VIOLATION";
const CONTRACT_INVALID_PATH = "CONTRACT_INVALID_PATH";
const HEADER = "CURRENT_SELECTION";

type ResultCode = "APPLIED" | "REJECTED" | "CANCELED" | "FAILED";

type Scenario = {
  id: string;
  name: string;
  scopeRoots: string[];
  selectionPath: string;
  actionPath: string;
  diff: string;
  strictOk: boolean;
  fuzzyOk: boolean;
  allowFuzzy?: boolean;
  guardOk: boolean;
  guardError?: string;
  decision: "apply" | "cancel";
  expected: {
    result: ResultCode;
    wrote: boolean;
    code?: string;
    canApply?: boolean;
  };
};

type FlowResult = {
  result: ResultCode;
  wrote: boolean;
  code?: string;
  canApply: boolean;
  detail: string;
};

class ScopedVaultHarness {
  private allowRoots: string[];

  constructor(allowRoots: string[]) {
    this.allowRoots = allowRoots.map((root) => this.normalize(root, true));
  }

  private normalize(rawPath: string, isScopeRoot = false): string {
    const source = String(rawPath ?? "").replace(/\\/g, "/").trim();
    if (isScopeRoot && (source === "." || source === "./")) {
      return ".";
    }
    if (!source) {
      throw new Error(`${CONTRACT_INVALID_PATH}: empty path`);
    }
    if (source.includes("\0")) {
      throw new Error(`${CONTRACT_INVALID_PATH}: null byte`);
    }
    if (source.startsWith("/") || /^[A-Za-z]:/.test(source)) {
      throw new Error(`${CONTRACT_INVALID_PATH}: absolute path`);
    }
    const stack: string[] = [];
    for (const part of source.split("/")) {
      if (!part || part === ".") {
        continue;
      }
      if (part === "..") {
        throw new Error(`${CONTRACT_INVALID_PATH}: traversal`);
      }
      stack.push(part);
    }
    if (stack.length === 0) {
      throw new Error(`${CONTRACT_INVALID_PATH}: invalid normalized path`);
    }
    return stack.join("/");
  }

  assertInScope(rawPath: string): string {
    const normalized = this.normalize(rawPath, false);
    const inScope = this.allowRoots.some((root) => root === "." || normalized === root || normalized.startsWith(`${root}/`));
    if (!inScope) {
      throw new Error(`${DEFAULT_DENY_SCOPE_VIOLATION}: outside scope (${normalized})`);
    }
    return normalized;
  }
}

function validateDiffContract(diff: string): { ok: boolean; code?: string; detail?: string } {
  const text = diff.replace(/\r\n/g, "\n").trim();
  if (!text) {
    return { ok: false, code: "CONTRACT_INVALID_DIFF", detail: "empty diff" };
  }
  if (/^```/m.test(text)) {
    return { ok: false, code: "CONTRACT_INVALID_DIFF", detail: "fenced diff not allowed" };
  }
  const lines = text.split("\n");
  if (lines[0].trim() !== HEADER) {
    return { ok: false, code: "CONTRACT_INVALID_DIFF", detail: "missing CURRENT_SELECTION header" };
  }
  const body = lines.slice(1).join("\n").trim();
  if (!body.startsWith("@@")) {
    return { ok: false, code: "CONTRACT_INVALID_DIFF", detail: "missing @@ hunk" };
  }
  if (/^(diff --git|index\s+[0-9a-f]+\.\.[0-9a-f]+|---\s+\S|\+\+\+\s+\S)/mi.test(body)) {
    return { ok: false, code: "CONTRACT_INVALID_DIFF", detail: "path header not allowed" };
  }
  return { ok: true };
}

function runDryRun(strictOk: boolean, fuzzyOk: boolean, allowFuzzy: boolean): { ok: boolean; mode: "strict" | "fuzzy" | "none"; detail: string } {
  if (strictOk) {
    return { ok: true, mode: "strict", detail: "strict ok" };
  }
  if (!allowFuzzy) {
    return { ok: false, mode: "none", detail: "strict failed + fuzzy disabled" };
  }
  if (fuzzyOk) {
    return { ok: true, mode: "fuzzy", detail: "strict failed, fuzzy ok" };
  }
  return { ok: false, mode: "none", detail: "strict/fuzzy failed" };
}

function simulateFlow(s: Scenario): FlowResult {
  try {
    const scoped = new ScopedVaultHarness(s.scopeRoots);
    const normalized = scoped.assertInScope(s.actionPath);
    if (normalized !== s.selectionPath) {
      return {
        result: "REJECTED",
        wrote: false,
        code: DEFAULT_DENY_SCOPE_VIOLATION,
        canApply: false,
        detail: `path mismatch (${normalized} != ${s.selectionPath})`
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      result: "REJECTED",
      wrote: false,
      code: message.includes(DEFAULT_DENY_SCOPE_VIOLATION) ? DEFAULT_DENY_SCOPE_VIOLATION : CONTRACT_INVALID_PATH,
      canApply: false,
      detail: message
    };
  }

  const contract = validateDiffContract(s.diff);
  if (!contract.ok) {
    return {
      result: "REJECTED",
      wrote: false,
      code: contract.code,
      canApply: false,
      detail: contract.detail ?? "contract failed"
    };
  }

  const dryRun = runDryRun(s.strictOk, s.fuzzyOk, Boolean(s.allowFuzzy));
  const guardOk = dryRun.ok && s.guardOk;
  const canApply = dryRun.ok && guardOk;

  if (s.decision === "cancel") {
    return {
      result: "CANCELED",
      wrote: false,
      canApply,
      detail: "cancel at preview"
    };
  }

  if (!canApply) {
    return {
      result: "REJECTED",
      wrote: false,
      canApply,
      code: guardOk ? undefined : "FRONTMATTER_GUARD",
      detail: !dryRun.ok ? dryRun.detail : s.guardError || "guard failed"
    };
  }

  return {
    result: "APPLIED",
    wrote: true,
    canApply,
    detail: "apply success"
  };
}

const VALID_DIFF = `${HEADER}\n@@ -1,1 +1,1 @@\n-old\n+new`;

const scenarios: Scenario[] = [
  {
    id: "S1",
    name: "scope read deny",
    scopeRoots: ["Inbox"],
    selectionPath: "Inbox/note.md",
    actionPath: "Projects/note.md",
    diff: VALID_DIFF,
    strictOk: true,
    fuzzyOk: false,
    guardOk: true,
    decision: "apply",
    expected: { result: "REJECTED", wrote: false, code: DEFAULT_DENY_SCOPE_VIOLATION, canApply: false }
  },
  {
    id: "S2",
    name: "scope write deny",
    scopeRoots: ["Projects/Scoped"],
    selectionPath: "Projects/Scoped/a.md",
    actionPath: "Projects/Other/a.md",
    diff: VALID_DIFF,
    strictOk: true,
    fuzzyOk: false,
    guardOk: true,
    decision: "apply",
    expected: { result: "REJECTED", wrote: false, code: DEFAULT_DENY_SCOPE_VIOLATION, canApply: false }
  },
  {
    id: "S3",
    name: "path traversal reject",
    scopeRoots: ["Projects"],
    selectionPath: "Projects/plan.md",
    actionPath: "../Secrets.md",
    diff: VALID_DIFF,
    strictOk: true,
    fuzzyOk: false,
    guardOk: true,
    decision: "apply",
    expected: { result: "REJECTED", wrote: false, code: CONTRACT_INVALID_PATH, canApply: false }
  },
  {
    id: "S4",
    name: "frontmatter YAML 파손 reject",
    scopeRoots: ["Projects"],
    selectionPath: "Projects/note.md",
    actionPath: "Projects/note.md",
    diff: VALID_DIFF,
    strictOk: true,
    fuzzyOk: false,
    guardOk: false,
    guardError: "FrontmatterGuard blocked: patched frontmatter YAML is invalid.",
    decision: "apply",
    expected: { result: "REJECTED", wrote: false, canApply: false }
  },
  {
    id: "S5",
    name: "frontmatter created 변경 reject",
    scopeRoots: ["Projects"],
    selectionPath: "Projects/note.md",
    actionPath: "Projects/note.md",
    diff: VALID_DIFF,
    strictOk: true,
    fuzzyOk: false,
    guardOk: false,
    guardError: "Selection mode blocks frontmatter edits.",
    decision: "apply",
    expected: { result: "REJECTED", wrote: false, canApply: false }
  },
  {
    id: "S6",
    name: "dry-run conflict -> confirm disabled",
    scopeRoots: ["Projects"],
    selectionPath: "Projects/note.md",
    actionPath: "Projects/note.md",
    diff: VALID_DIFF,
    strictOk: false,
    fuzzyOk: false,
    allowFuzzy: false,
    guardOk: true,
    decision: "apply",
    expected: { result: "REJECTED", wrote: false, canApply: false }
  },
  {
    id: "S7",
    name: "cancel at preview -> no write",
    scopeRoots: ["Projects"],
    selectionPath: "Projects/note.md",
    actionPath: "Projects/note.md",
    diff: VALID_DIFF,
    strictOk: true,
    fuzzyOk: false,
    guardOk: true,
    decision: "cancel",
    expected: { result: "CANCELED", wrote: false, canApply: true }
  },
  {
    id: "S8",
    name: "strict 실패 + fuzzy opt-in 없이 실패",
    scopeRoots: ["Projects"],
    selectionPath: "Projects/note.md",
    actionPath: "Projects/note.md",
    diff: VALID_DIFF,
    strictOk: false,
    fuzzyOk: true,
    allowFuzzy: false,
    guardOk: true,
    decision: "apply",
    expected: { result: "REJECTED", wrote: false, canApply: false }
  }
];

let failed = 0;
console.log("[PR0 Smoke] running 8 scenarios");
for (const scenario of scenarios) {
  const result = simulateFlow(scenario);
  const okResult = result.result === scenario.expected.result;
  const okWrite = result.wrote === scenario.expected.wrote;
  const okCode = scenario.expected.code ? result.code === scenario.expected.code : true;
  const okCanApply = typeof scenario.expected.canApply === "boolean" ? result.canApply === scenario.expected.canApply : true;
  const passed = okResult && okWrite && okCode && okCanApply;
  if (!passed) {
    failed += 1;
  }
  console.log(`${passed ? "PASS" : "FAIL"} ${scenario.id} ${scenario.name}`);
  if (!passed) {
    console.log(`  expected=${JSON.stringify(scenario.expected)} actual=${JSON.stringify(result)}`);
  }
}

if (failed > 0) {
  console.error(`[PR0 Smoke] failed=${failed}`);
  process.exit(1);
}

console.log("[PR0 Smoke] all scenarios passed");
