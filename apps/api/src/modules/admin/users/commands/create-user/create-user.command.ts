export interface CreateAdminUserCommand {
  email: string
  fullName: string
  password: string
  roleId: number
  createdById: number
}
