import type { ScoringInputs, ScoringResult } from "../../../../scoring/engine"

export type ApprovalOutcome = "approved" | "partial" | "denied" | "rejected"

export type PassedResult = Extract<ScoringResult, { rejected: false }>

export interface CreateTestCaseCommand {
  name: string
  description?: string
  inputs: ScoringInputs
  expectedOutcome: ApprovalOutcome
}
