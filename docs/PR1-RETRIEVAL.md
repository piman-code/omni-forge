# PR1 Retrieval / Citation / AnswerDraft

## 목표
- `retrieve(scope, query, topK)` 표준 API 추가
- 임베딩 가능 시 벡터 우선 검색, 불가 시 키워드 검색 fallback 보장
- 인용 최소 개수(`minCitations`, 기본 2) 강제
- 근거 부족 시 `답변 보류/추가 질문` 템플릿으로 `AnswerDraft` 반환

## 파일
- `/Users/piman/Documents/AI/obsidian-plugin/omni-forge/src/pr1/types.ts`
- `/Users/piman/Documents/AI/obsidian-plugin/omni-forge/src/pr1/retriever.ts`
- `/Users/piman/Documents/AI/obsidian-plugin/omni-forge/src/pr1/citations.ts`
- `/Users/piman/Documents/AI/obsidian-plugin/omni-forge/src/pr1/answerComposer.ts`

## 타입 준수
- 기존 `src/pr1/types.ts` 계약(`ChunkRef`, `EmbeddingRecord`, `RetrievalHit`, `Citation`, `AnswerDraft`)을 유지했다.
- 신규 구현은 `types.ts`를 직접 수정하지 않고, 모듈 내부 입력 타입만 확장했다.
- `retrieve(...)` 출력은 `RetrievalHit[]`를 반환한다.
- `composeAnswerDraft(...)` 출력은 `AnswerDraft`를 반환한다.

## 검색 정책
1. `scope.embeddingEnabled === true`이고 query/chunk 벡터가 확보되면 코사인 유사도 기반 검색 수행
2. 벡터 결과가 없거나 임베딩 비활성/미지원이면 키워드 검색 수행
3. 키워드 검색은 최소 substring 매칭 + 토큰 커버리지/빈도/위치 가중 점수 사용
4. 결과는 score 내림차순 정렬 후 `topK`만 반환

## 인용/답변 정책
1. `toCitations(hits, { minCitations })`가 기본 `minCitations=2` 적용
2. 인용이 부족하면 `policyResult.violations`에 `INSUFFICIENT_CITATIONS`를 기록
3. `composeAnswerDraft(...)`는 항상 `AnswerDraft.citations`를 포함
4. 부족 시 `answerMarkdown`에 `"답변 보류/추가 질문"` 템플릿을 넣고 `unsupportedClaims`를 채운다

## 스모크 실행
```bash
node /Users/piman/Documents/AI/obsidian-plugin/omni-forge/scripts/pr1-retrieve-smoke.ts
```

## Cloud 정책
- 본 PR1 구현은 로컬 데이터 입력만 처리한다.
- 네트워크 호출을 포함하지 않는다. (Cloud OFF 전제)
