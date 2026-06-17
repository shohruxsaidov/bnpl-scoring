import type { ScoringModelData } from "../../../../scoring/engine"

export interface SaveModelCommand {
  scoringModelId: number
  name: string
  version: string
  params: ScoringModelData
  createdBy: number | null
}
