export interface UpdateEmployeeCommand {
  id: number;
  fullName?: string;
  roles?: string[];
  active?: boolean;
}
