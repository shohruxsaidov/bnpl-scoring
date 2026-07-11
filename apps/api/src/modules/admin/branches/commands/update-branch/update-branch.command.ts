export interface UpdateBranchCommand {
  id: number;
  name?: string;
  address?: string;
  phone?: string;
  regionId?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  active?: boolean;
}
