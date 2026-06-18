export interface CreateEmployeeCommand {
  phone: string;
  password: string;
  fullName: string;
  merchantId: number;
  branchId: number;
  roles: string[];
}
