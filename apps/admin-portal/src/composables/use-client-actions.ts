import { useI18n } from 'vue-i18n'
import type { ClientActionRow, ClientActionType } from '@/types'

/**
 * Labels and icons shared by the two surfaces that render a client's action
 * trail — the funnel and the timeline beneath it. They must agree word for word:
 * an admin reads «Скоринг» in the funnel and then looks for the same word in the
 * log, and a second copy of these strings would eventually drift apart.
 */

/** PrimeIcons per action type. The icon is the fastest way to scan a long trail. */
export const ACTION_ICONS: Record<ClientActionType, string> = {
  registration: 'pi-user-plus',
  card_add: 'pi-credit-card',
  card_delete: 'pi-trash',
  scoring: 'pi-chart-line',
  deal_sign_myid: 'pi-id-card',
  deal_sign_otp: 'pi-mobile',
  deal_sign_reject: 'pi-times-circle',
  device_revoke: 'pi-power-off',
  biometric_enroll: 'pi-lock-open',
  biometric_disable: 'pi-lock',
}

export function useClientActionLabels() {
  const { t } = useI18n()

  function actionLabel(action: string): string {
    return t(`clientDetail.action_${action}`, action)
  }

  function actionIcon(action: string): string {
    return ACTION_ICONS[action as ClientActionType] ?? 'pi-circle-fill'
  }

  function actorLabel(row: ClientActionRow): string {
    // An agent's name is the answer to «кто добавил эту карту?», so show it when
    // we have it and fall back to the bare role when we don't (backfilled rows).
    const role = t(`clientDetail.actor_${row.actorType}`, row.actorType)
    if (row.actorType === 'agent' && row.actorName) return `${row.actorName} · ${role}`
    return role
  }

  function sourceText(row: ClientActionRow): string {
    const parts: string[] = []
    if (row.channel) parts.push(t(`clientDetail.actionChannel_${row.channel}`, row.channel))
    if (row.merchantName) parts.push(row.merchantName)
    return parts.join(' · ')
  }

  /**
   * Reject codes come from three vocabularies: the scoring pipeline's (already
   * translated under `scorings.rejectReason`), a couple of our own, and raw vendor
   * codes from Plumgate/MyID that nobody has translated. An untranslated code is
   * rendered VERBATIM on purpose — `plumgate_400` still tells support which vendor
   * refused, where a blank cell or «Неизвестно» would throw away the only thing
   * the row knew.
   */
  function reasonLabel(code: string | null): string {
    if (!code) return '—'
    const own = t(`clientDetail.reason_${code}`, '')
    if (own) return own
    return t(`scorings.rejectReason.${code}`, code)
  }

  return { actionLabel, actionIcon, actorLabel, sourceText, reasonLabel }
}

/**
 * Human gap between two milestones — the funnel's real payload. «+3 дн» between
 * скоринг and подписание is the number that tells support the client hesitated;
 * an exact duration to the second would bury it.
 */
export function formatGap(fromIso: string, toIso: string, t: (k: string, p?: any) => string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const min = Math.round(ms / 60000)
  if (min < 1) return t('clientDetail.gapInstant')
  if (min < 60) return t('clientDetail.gapMinutes', { n: min })
  const hours = Math.round(min / 60)
  if (hours < 24) return t('clientDetail.gapHours', { n: hours })
  const days = Math.round(hours / 24)
  return t('clientDetail.gapDays', { n: days })
}
