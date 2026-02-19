import { retrieveByVector, type RetrievalInput } from "../pr2/retrievalBridge.ts";
import { toEvidenceMarkdownFromHits } from "./qaBridge.ts";

export async function runQA(input: RetrievalInput): Promise<string> {
  const result = await retrieveByVector(input);
  return toEvidenceMarkdownFromHits(result.hits);
}
