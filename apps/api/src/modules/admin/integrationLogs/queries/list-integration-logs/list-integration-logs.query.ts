export interface ListIntegrationLogsParams {
  from?: Date
  to?: Date
  integration?: string
  result?: "success" | "error"
  limit: number
  offset: number
}
