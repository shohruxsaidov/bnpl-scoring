import {
  env,
  db,
  logIntegration,
  IntegrationError,
  makePlumClient,
  parsePlumError,
} from '../../service/shared';
import type { DeleteCardCommand } from './delete-card.command';

// Removes a card from Plumgate. A 404 ("card not found / already removed") is
// treated as success so the caller can proceed to delete the local row
export async function deleteCard(params: DeleteCardCommand): Promise<void> {
  const client = makePlumClient();
  const reqParams = { userCardId: params.id };

  const requestTimestamp = new Date();
  try {
    const data = await client.delete('UserCard/deleteUserCard', { searchParams: reqParams }).json();

    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'deleteUserCard',
      methodType: 'DELETE',
      request: reqParams,
      response: data,
      status: 200,
      errorMessage: null,
      requestTimestamp,
      responseTimestamp: new Date(),
    });
  } catch (err) {
    const toThrow = await parsePlumError(err);
    const status = toThrow instanceof IntegrationError ? toThrow.statusCode : null;
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'deleteUserCard',
      methodType: 'DELETE',
      request: reqParams,
      response: toThrow instanceof IntegrationError ? toThrow.body : null,
      status,
      errorMessage: toThrow.message,
      requestTimestamp,
      responseTimestamp: new Date(),
    });
    // Already gone at Plumgate — safe to drop locally.
    if (status === 404) return;
    throw toThrow;
  }
}
