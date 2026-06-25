// TODO: scoring rebuild — scoring_histories removed. Returns an empty list
// until the new scoring persistence lands. Route + DTO shape preserved so the
// client detail page degrades gracefully instead of breaking.
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
