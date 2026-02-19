# PR-2 Pipeline (Incremental Changeset)

## 목적
- PR-2 파이프라인을 증분 changeset 기준의 순차 실행으로 고정한다.
- PR-1 변경 금지 원칙을 유지하고, PR-1은 어댑터/브리지로만 연결한다.

## 불변 원칙
- PR-1 직접 수정 금지: `src/pr1/*`, `docs/PR1-*.md`, `scripts/pr1-*.ts`, `src/pr1/types.ts`.
- PR-2는 PR-1 공개 기능(인덱서/청커/리트리버/인용)을 브리지 호출로만 사용한다.
- scope 밖 접근, vault-wide scan, 네트워크 호출은 허용하지 않는다.

## 순차 파이프라인 단계 (증분 changeset 기반)
1. `scope 검증/확정`  
   입력 scope를 정규화하고 루트/포함/제외 경로를 검증해 실행 범위를 확정한다.
2. `변경 감지(인덱서 결과 기반) -> 대상 문서 리스트`  
   인덱서 diff(`added/updated/deleted/moved/unchanged`)를 읽어 실제 처리 대상 문서 집합을 만든다.
3. `chunk 생성/갱신`  
   대상 문서만 chunk를 생성/갱신하고, 삭제/이동 문서의 chunk 매핑을 정리한다.
4. `chunkHash 비교 -> 재임베딩 대상만`  
   이전 chunkHash와 비교해 변경된 chunk만 재임베딩 큐에 넣고, 동일 hash는 재사용한다.
5. `VectorStore upsert + tombstone 처리`  
   재임베딩 결과를 upsert하고, 삭제/이동된 항목은 tombstone으로 비활성화 또는 제거한다.
6. `query 시: query embed -> topK -> citations -> answer`  
   query 임베딩 후 topK 검색을 수행하고, 인용(citations) 검증을 거쳐 답변을 생성한다.
7. `audit 기록(개념 수준)`  
   단계별 입력/출력 개수, 정책 위반 여부, abort 사유, fallback 사용 여부를 감사 로그로 남긴다.

## 상태 및 fallback
- 상태 예시: `READY`, `PARTIAL`, `BLOCKED`, `ABORTED`.
- 임베딩 상태: `ok`, `disabled`, `error`, `partial`.
- fallback 규칙: 임베딩이 불가(`disabled/error/empty`)하면 keyword 검색으로 전환하고, 인용 정책을 동일하게 적용한다.
- 근거 부족(최소 인용 미달) 시 답변은 보류 상태로 반환하고 추가 확인이 필요함을 명시한다.

## Abort 조건
- scope 밖 경로 접근 시도.
- vault-wide scan 시도.
- 네트워크 호출 시도.
- 허용 파일 외 변경 감지 시도(개발/테스트 중).
- path traversal(`..`) 또는 절대 경로 입력 감지.
- PR-1 직접 변경 시도 감지.
