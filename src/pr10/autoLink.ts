export type LinkSignal =
  | "topic"
  | "time"
  | "context"
  | "entity"
  | "causal"
  | "hierarchy";

export type AutoLinkInput = {
  fromPath: string;
  toPath: string;
  // 충족한 조건들(최소 2개 이상이면 제안)
  signals: ReadonlyArray<LinkSignal>;
  // 근거 문장(원문 일부/요약)
  evidenceSentences: ReadonlyArray<string>;
};

export type AutoLinkSuggestion = {
  fromPath: string;
  toPath: string;
  linkType: string;
  evidence: string;
  confidence: number; // 0~100
  needsVerification: boolean;
};

function clamp0to100(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function normalizeText(value: string): string {
  return value.replace(/\s/g, " ").trim();
}

function pickLinkType(signals: ReadonlyArray<LinkSignal>): string {
  // 우선순위 기반으로 대표 유형을 1개 선택(결정적)
  const order: LinkSignal[] = ["causal", "hierarchy", "topic", "context", "entity", "time"];
  for (const s of order) {
    if (signals.includes(s)) {
      switch (s) {
        case "causal":
          return "원인-결과";
        case "hierarchy":
          return "상위/하위 개념";
        case "topic":
          return "동일 주제";
        case "context":
          return "프로젝트/활동 맥락";
        case "entity":
          return "사람/장소/이벤트 중복";
        case "time":
          return "시간적 연관";
      }
    }
  }
  return "기타";
}

function scoreSignals(signals: ReadonlyArray<LinkSignal>): number {
  // 스펙 기준 신호 가중치(가벼운 1단계 버전)
  const weights: Record<LinkSignal, number> = {
    topic: 28,
    time: 10,
    context: 20,
    entity: 18,
    causal: 30,
    hierarchy: 30,
  };

  let sum = 0;
  const uniq = new Set<LinkSignal>();
  for (const s of signals) {
    uniq.add(s);
  }
  for (const s of uniq) {
    sum = weights[s] ?? 0;
  }

  // 신호 개수 보너스(2개 이상일 때만 의미)
  const countBonus = Math.max(0, (uniq.size - 1) * 6);
  return clamp0to100(sum  countBonus);
}

function joinEvidence(sentences: ReadonlyArray<string>): string {
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const s of sentences) {
    const n = normalizeText(String(s ?? ""));
    if (n.length === 0) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    uniq.push(n);
    if (uniq.length >= 3) break; // 과도한 길이 방지(결정적)
  }
  return uniq.length > 0 ? uniq.join(" / ") : "(근거 문장 없음)";
}

export function suggestAutoLink(input: AutoLinkInput): AutoLinkSuggestion | null {
  const fromPath = normalizeText(input.fromPath ?? "");
  const toPath = normalizeText(input.toPath ?? "");
  if (fromPath.length === 0 || toPath.length === 0) return null;
  if (fromPath === toPath) return null;

  const uniqSignals = Array.from(new Set(input.signals ?? []));
  // 스펙: 최소 2개 조건 충족 시 제안
  if (uniqSignals.length < 2) return null;

  const confidence = scoreSignals(uniqSignals);
  const linkType = pickLinkType(uniqSignals);
  const evidence = joinEvidence(input.evidenceSentences ?? []);
  const needsVerification = confidence < 60;

  return {
    fromPath,
    toPath,
    linkType,
    evidence,
    confidence,
    needsVerification,
  };
}

export function formatAutoLinkMarkdown(s: AutoLinkSuggestion): string {
  // Spec v1.2: AutoLink 분석 출력 템플릿
  return [
    "## 🔗 제안 연결",
    `### ${s.fromPath} ↔ ${s.toPath}`,
    `- 유형: ${s.linkType}`,
    `- 근거: ${s.evidence}`,
    `- 신뢰도: ${s.confidence}`,
    `- 검증 필요 여부: ${s.needsVerification ? "예" : "아니오"}`,
  ].join("\n");
}
