import type { ConfigurablePipeline } from "../../../../scoring/pipelines/config"

export interface SetPipelineEnabledInput {
  type: ConfigurablePipeline
  enabled: boolean
  /** admin_users.id of the actor — recorded so a kill-switch flip is attributable. */
  actorId: number
}
