const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const fixtureRoot = path.join(repoRoot, "tests", "fixtures", "pdf-parser");
const manifestPath = path.join(fixtureRoot, "cases.json");
const docsDir = path.join(repoRoot, "docs");
const markdownOutPath = path.join(docsDir, "PDF_PARSER_VALIDATION.md");
const jsonOutPath = path.join(docsDir, "PDF_PARSER_VALIDATION.json");

const THRESHOLDS = {
  charRetentionMin: 0.88,
  hangulCorruptionMax: 0.03,
  paragraphOrderMin: 0.8,
  tableScoreMin: 0.75
};

const VARIANTS = [
  { key: "before-fast", label: "Before/Fast" },
  { key: "after-fast", label: "After/Fast" },
  { key: "before-detailed", label: "Before/Detailed" },
  { key: "after-detailed", label: "After/Detailed" }
];

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collapseForCharMetric(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function buildCharFreqMap(text) {
  const map = new Map();
  for (const ch of text) {
    map.set(ch, (map.get(ch) || 0) + 1);
  }
  return map;
}

function scoreCharRetention(reference, candidate) {
  if (!reference) {
    return 1;
  }
  const refMap = buildCharFreqMap(reference);
  const candMap = buildCharFreqMap(candidate);
  let overlap = 0;
  for (const [ch, refCount] of refMap.entries()) {
    const candCount = candMap.get(ch) || 0;
    overlap += Math.min(refCount, candCount);
  }
  return overlap / Math.max(1, reference.length);
}

function scoreHangulCorruption(candidateRaw) {
  const candidate = collapseForCharMetric(candidateRaw);
  if (!candidate) {
    return 1;
  }
  const replacementCount = (candidate.match(/�/g) || []).length;
  const jamoCount = (candidate.match(/[ㄱ-ㅎㅏ-ㅣᄀ-ᇿ]/g) || []).length;
  const hangulCount = (candidate.match(/[가-힣]/g) || []).length;
  const denominator = Math.max(1, hangulCount + jamoCount);
  const weighted = replacementCount + jamoCount * 0.5;
  return weighted / denominator;
}

function scoreParagraphOrder(referenceRaw, candidateRaw) {
  const stripStructuredLines = (value) =>
    normalizeText(value)
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return true;
        }
        if (trimmed.includes("|")) {
          return false;
        }
        if (/^#{1,6}\s/.test(trimmed)) {
          return false;
        }
        if (/^[-*•]\s/.test(trimmed) || /^\d+[.)]\s/.test(trimmed)) {
          return false;
        }
        return true;
      })
      .join("\n");
  const reference = stripStructuredLines(referenceRaw);
  const candidate = stripStructuredLines(candidateRaw);
  if (!reference) {
    return 1;
  }
  const paragraphs = reference
    .split(/\n{2,}/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 12);
  if (paragraphs.length <= 1) {
    return 1;
  }
  let cursor = 0;
  let hits = 0;
  for (const paragraph of paragraphs) {
    const anchor = paragraph.replace(/\s+/g, " ").slice(0, Math.min(28, paragraph.length));
    const found = candidate.indexOf(anchor, cursor);
    if (found >= 0) {
      hits += 1;
      cursor = found + anchor.length;
    }
  }
  return hits / paragraphs.length;
}

function countPipes(line) {
  return (line.match(/\|/g) || []).length;
}

function parseMarkdownTables(rawText) {
  const lines = normalizeText(rawText).split("\n");
  const tables = [];
  let idx = 0;
  while (idx < lines.length - 1) {
    const line = lines[idx].trim();
    const next = lines[idx + 1].trim();
    const isHeader = line.includes("|") && countPipes(line) >= 2;
    const isSeparator = /^\|?\s*:?-{3,}.*$/.test(next) && next.includes("|");
    if (!isHeader || !isSeparator) {
      idx += 1;
      continue;
    }
    const headerCells = line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const columnCount = headerCells.length;
    let rowCount = 0;
    idx += 2;
    while (idx < lines.length) {
      const bodyLine = lines[idx].trim();
      if (!bodyLine.includes("|")) {
        break;
      }
      const cells = bodyLine
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((item) => item.trim());
      if (cells.length < 2) {
        break;
      }
      rowCount += 1;
      idx += 1;
    }
    tables.push({ cols: columnCount, rows: rowCount });
  }
  return tables;
}

function scoreTablePreservation(referenceRaw, candidateRaw, hasTable) {
  if (!hasTable) {
    return 1;
  }
  const refTables = parseMarkdownTables(referenceRaw);
  const candTables = parseMarkdownTables(candidateRaw);
  if (refTables.length === 0) {
    return 1;
  }
  if (candTables.length === 0) {
    return 0;
  }
  const refRows = refTables.reduce((sum, table) => sum + table.rows, 0);
  const candRows = candTables.reduce((sum, table) => sum + table.rows, 0);
  const refCols = refTables.reduce((sum, table) => sum + table.cols, 0) / refTables.length;
  const candCols = candTables.reduce((sum, table) => sum + table.cols, 0) / candTables.length;
  const rowRecall = Math.min(1, candRows / Math.max(1, refRows));
  const colAccuracy = 1 - Math.min(1, Math.abs(candCols - refCols) / Math.max(1, refCols));
  return rowRecall * 0.6 + colAccuracy * 0.4;
}

function round(value) {
  return Number(value.toFixed(4));
}

function evaluateVariant(referenceText, candidateText, hasTable) {
  const ref = collapseForCharMetric(referenceText);
  const cand = collapseForCharMetric(candidateText);
  const charRetention = scoreCharRetention(ref, cand);
  const hangulCorruption = scoreHangulCorruption(candidateText);
  const paragraphOrder = scoreParagraphOrder(referenceText, candidateText);
  const tableScore = scoreTablePreservation(referenceText, candidateText, hasTable);
  const accepted =
    charRetention >= THRESHOLDS.charRetentionMin &&
    hangulCorruption <= THRESHOLDS.hangulCorruptionMax &&
    paragraphOrder >= THRESHOLDS.paragraphOrderMin &&
    tableScore >= THRESHOLDS.tableScoreMin;
  return {
    charRetention: round(charRetention),
    hangulCorruption: round(hangulCorruption),
    paragraphOrder: round(paragraphOrder),
    tableScore: round(tableScore),
    accepted
  };
}

function mean(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildReport(evaluation) {
  const lines = [];
  lines.push("# PDF Parser Validation");
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push("- Fixture set: 5 cases (Korean text/table/mixed/scanned/HWP->PDF)");
  lines.push("- Variants: before-fast, after-fast, before-detailed, after-detailed");
  lines.push("- Goal: Korean text integrity, table preservation, paragraph order stability");
  lines.push("");
  lines.push("## Acceptance Criteria");
  lines.push("");
  lines.push(`- Character retention >= ${THRESHOLDS.charRetentionMin}`);
  lines.push(`- Hangul corruption ratio <= ${THRESHOLDS.hangulCorruptionMax}`);
  lines.push(`- Paragraph order score >= ${THRESHOLDS.paragraphOrderMin}`);
  lines.push(`- Table preservation score >= ${THRESHOLDS.tableScoreMin} (table cases)`);
  lines.push("");
  lines.push("## Aggregate Metrics");
  lines.push("");
  lines.push("| Variant | Char Retention | Hangul Corruption | Paragraph Order | Table Preservation | Pass Rate |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const item of evaluation.aggregate) {
    lines.push(
      `| ${item.label} | ${item.charRetention.toFixed(3)} | ${item.hangulCorruption.toFixed(3)} | ${item.paragraphOrder.toFixed(3)} | ${item.tableScore.toFixed(3)} | ${(item.passRate * 100).toFixed(1)}% |`
    );
  }
  lines.push("");
  lines.push("## Per-Case Results");
  lines.push("");
  for (const testCase of evaluation.cases) {
    lines.push(`### ${testCase.id} - ${testCase.label}`);
    lines.push("");
    lines.push("| Variant | Char | Hangul Corr. | Paragraph | Table | Pass |");
    lines.push("| --- | ---: | ---: | ---: | ---: | --- |");
    for (const variant of VARIANTS) {
      const metrics = testCase.variants[variant.key];
      lines.push(
        `| ${variant.label} | ${metrics.charRetention.toFixed(3)} | ${metrics.hangulCorruption.toFixed(3)} | ${metrics.paragraphOrder.toFixed(3)} | ${metrics.tableScore.toFixed(3)} | ${metrics.accepted ? "PASS" : "FAIL"} |`
      );
    }
    lines.push("");
  }
  lines.push("## Before/After Delta");
  lines.push("");
  lines.push(`- Fast char retention delta: ${evaluation.delta.fastCharRetention.toFixed(3)}`);
  lines.push(`- Detailed char retention delta: ${evaluation.delta.detailedCharRetention.toFixed(3)}`);
  lines.push(`- Fast table score delta: ${evaluation.delta.fastTableScore.toFixed(3)}`);
  lines.push(`- Detailed table score delta: ${evaluation.delta.detailedTableScore.toFixed(3)}`);
  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("- This report is generated from fixture snapshots (`tests/fixtures/pdf-parser`).");
  lines.push("- Run `node scripts/pdf-parser-validate.js` to regenerate after parser changes.");
  lines.push("- For real-world E2E verification, replace fixture outputs with actual parser outputs from your environment.");
  lines.push("");
  return lines.join("\n");
}

function evaluateAll() {
  const manifest = JSON.parse(readUtf8(manifestPath));
  const cases = [];
  for (const item of manifest.cases || []) {
    const caseRoot = path.join(fixtureRoot, "cases", item.id);
    const referencePath = path.join(caseRoot, "reference.md");
    const referenceText = readUtf8(referencePath);
    const variants = {};
    for (const variant of VARIANTS) {
      const variantPath = path.join(caseRoot, `${variant.key}.md`);
      const candidateText = readUtf8(variantPath);
      variants[variant.key] = evaluateVariant(referenceText, candidateText, Boolean(item.hasTable));
    }
    cases.push({
      id: item.id,
      label: item.label,
      hasTable: Boolean(item.hasTable),
      variants
    });
  }

  const aggregate = VARIANTS.map((variant) => {
    const rows = cases.map((testCase) => testCase.variants[variant.key]);
    return {
      key: variant.key,
      label: variant.label,
      charRetention: mean(rows.map((row) => row.charRetention)),
      hangulCorruption: mean(rows.map((row) => row.hangulCorruption)),
      paragraphOrder: mean(rows.map((row) => row.paragraphOrder)),
      tableScore: mean(rows.map((row) => row.tableScore)),
      passRate: mean(rows.map((row) => (row.accepted ? 1 : 0)))
    };
  });

  const findAggregate = (key) => aggregate.find((item) => item.key === key) || aggregate[0];
  const delta = {
    fastCharRetention: findAggregate("after-fast").charRetention - findAggregate("before-fast").charRetention,
    detailedCharRetention: findAggregate("after-detailed").charRetention - findAggregate("before-detailed").charRetention,
    fastTableScore: findAggregate("after-fast").tableScore - findAggregate("before-fast").tableScore,
    detailedTableScore: findAggregate("after-detailed").tableScore - findAggregate("before-detailed").tableScore
  };

  return { cases, aggregate, delta, thresholds: THRESHOLDS };
}

function main() {
  const evaluation = evaluateAll();
  const markdown = buildReport(evaluation);
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(markdownOutPath, markdown, "utf8");
  fs.writeFileSync(jsonOutPath, JSON.stringify(evaluation, null, 2), "utf8");
  console.log(`Generated: ${path.relative(repoRoot, markdownOutPath)}`);
  console.log(`Generated: ${path.relative(repoRoot, jsonOutPath)}`);
}

main();
