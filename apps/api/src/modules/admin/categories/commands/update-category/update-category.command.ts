export interface UpdateCategoryInput {
  id: number;
  data: Partial<{ name: string; active: boolean }>;
}
