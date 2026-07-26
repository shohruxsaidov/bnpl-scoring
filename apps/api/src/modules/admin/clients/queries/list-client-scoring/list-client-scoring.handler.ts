export async function listUserScoring(_id: number): Promise<
  {
    id: string;
    source: 'wizard' | 'self-service';
    decision: string;
    score: number;
    limit: number;
    scoredAt: string;
  }[]
> {
  return [];
}
