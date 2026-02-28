# PDF Parser Validation

## Scope

- Fixture set: 5 cases (Korean text/table/mixed/scanned/HWP->PDF)
- Variants: before-fast, after-fast, before-detailed, after-detailed
- Goal: Korean text integrity, table preservation, paragraph order stability

## Acceptance Criteria

- Character retention >= 0.88
- Hangul corruption ratio <= 0.03
- Paragraph order score >= 0.8
- Table preservation score >= 0.75 (table cases)

## Aggregate Metrics

| Variant | Char Retention | Hangul Corruption | Paragraph Order | Table Preservation | Pass Rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| Before/Fast | 0.832 | 0.000 | 0.600 | 0.600 | 20.0% |
| After/Fast | 0.995 | 0.000 | 1.000 | 1.000 | 100.0% |
| Before/Detailed | 0.882 | 0.000 | 0.833 | 0.800 | 40.0% |
| After/Detailed | 1.000 | 0.000 | 1.000 | 1.000 | 100.0% |

## Per-Case Results

### ko-text - Korean narrative text

| Variant | Char | Hangul Corr. | Paragraph | Table | Pass |
| --- | ---: | ---: | ---: | ---: | --- |
| Before/Fast | 0.785 | 0.000 | 0.000 | 1.000 | FAIL |
| After/Fast | 1.000 | 0.000 | 1.000 | 1.000 | PASS |
| Before/Detailed | 0.785 | 0.000 | 0.667 | 1.000 | FAIL |
| After/Detailed | 1.000 | 0.000 | 1.000 | 1.000 | PASS |

### ko-table - Korean table-heavy document

| Variant | Char | Hangul Corr. | Paragraph | Table | Pass |
| --- | ---: | ---: | ---: | ---: | --- |
| Before/Fast | 0.643 | 0.000 | 1.000 | 0.000 | FAIL |
| After/Fast | 0.973 | 0.000 | 1.000 | 1.000 | PASS |
| Before/Detailed | 0.643 | 0.000 | 1.000 | 0.000 | FAIL |
| After/Detailed | 1.000 | 0.000 | 1.000 | 1.000 | PASS |

### mixed - Mixed KO/EN/number/symbol

| Variant | Char | Hangul Corr. | Paragraph | Table | Pass |
| --- | ---: | ---: | ---: | ---: | --- |
| Before/Fast | 0.973 | 0.000 | 0.500 | 1.000 | FAIL |
| After/Fast | 1.000 | 0.000 | 1.000 | 1.000 | PASS |
| Before/Detailed | 0.993 | 0.000 | 1.000 | 1.000 | PASS |
| After/Detailed | 1.000 | 0.000 | 1.000 | 1.000 | PASS |

### scanned - Scanned PDF OCR-like sample

| Variant | Char | Hangul Corr. | Paragraph | Table | Pass |
| --- | ---: | ---: | ---: | ---: | --- |
| Before/Fast | 0.952 | 0.000 | 1.000 | 1.000 | PASS |
| After/Fast | 1.000 | 0.000 | 1.000 | 1.000 | PASS |
| Before/Detailed | 1.000 | 0.000 | 1.000 | 1.000 | PASS |
| After/Detailed | 1.000 | 0.000 | 1.000 | 1.000 | PASS |

### hwp-pdf - HWP converted PDF sample

| Variant | Char | Hangul Corr. | Paragraph | Table | Pass |
| --- | ---: | ---: | ---: | ---: | --- |
| Before/Fast | 0.805 | 0.000 | 0.500 | 0.000 | FAIL |
| After/Fast | 1.000 | 0.000 | 1.000 | 1.000 | PASS |
| Before/Detailed | 0.991 | 0.000 | 0.500 | 1.000 | FAIL |
| After/Detailed | 1.000 | 0.000 | 1.000 | 1.000 | PASS |

## Before/After Delta

- Fast char retention delta: 0.163
- Detailed char retention delta: 0.118
- Fast table score delta: 0.400
- Detailed table score delta: 0.200

## Notes

- This report is generated from fixture snapshots (`tests/fixtures/pdf-parser`).
- Run `node scripts/pdf-parser-validate.js` to regenerate after parser changes.
- For real-world E2E verification, replace fixture outputs with actual parser outputs from your environment.
