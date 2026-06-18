// Re-export from service handler — kept for mock.ts which cannot be touched.
export type {
  PlumCardResponse,
  PlumCard,
  PlumAddCardResult,
  PlumScoreResult,
} from './service/service.handler';

export {
  listCards,
  addCard,
  confirmCard,
  scoreCard,
} from './service/service.handler';
