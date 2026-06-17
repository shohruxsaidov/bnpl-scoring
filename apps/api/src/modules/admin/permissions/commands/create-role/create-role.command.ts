import type { Platform } from "../../../../../rbac/features"

export interface CreateRoleInput {
  platform: Platform
  key: string
  name: string
}
