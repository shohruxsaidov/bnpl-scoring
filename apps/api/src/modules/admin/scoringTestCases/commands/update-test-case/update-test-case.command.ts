import type { ScoringInputs } from "../../../../scoring/engine"
import type { ApprovalOutcome } from "../create-test-case/create-test-case.command"

export interface UpdateTestCaseCommand {
  id: number
  name?: string
  description?: string
  inputs?: ScoringInputs
  expectedOutcome?: ApprovalOutcome
}
