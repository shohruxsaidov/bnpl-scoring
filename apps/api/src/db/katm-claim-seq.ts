import { pgSequence } from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// KATM Claim ID sequence (ADR-0025). One shared sequence feeds katm_claim_id
// on both deal_sessions and scoring_sessions — KATM's pClaimId is String(20),
// so the session UUIDs cannot be used.
// ---------------------------------------------------------------------------
export const katmClaimSeq = pgSequence('katm_claim_seq', { startWith: 1000 });
