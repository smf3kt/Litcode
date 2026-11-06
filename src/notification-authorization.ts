import { isDeepStrictEqual } from 'node:util';
import type Anthropic from '@anthropic-ai/sdk';
import type { Session, SessionEvent } from './session.js';

type Intent = Extract<SessionEvent, { kind: 'notification_intent_v2' }>;
export type NotificationAuthorization = object;
type Grant = { session: Session; intent: Intent; batch: Intent['batch']; live: () => boolean;
  currentBatch: () => Intent['batch'] | undefined; message?: Anthropic.MessageParam };
const grants = new WeakMap<NotificationAuthorization, Grant>();

export type HumanSkillAuthorization = object;
type SkillGrant = { session: Session; name: string; args: string; signal: AbortSignal; live: () => boolean };
const skillGrants = new WeakMap<HumanSkillAuthorization, SkillGrant>();

// W121 host rewrite: iye sfn1dbxq [3368429,3370821), VYr [2947575,2947964),
// at htgmc2p1 [38703,39841), UTF-16: no host journal or human capability.
export function issueHumanSkillAuthorization(session: Session, name: string, args: string,
  signal: AbortSignal, live: () => boolean): HumanSkillAuthorization {
  if (signal.aborted || !session.isOpen || session.isJournalFenced || !live()) throw new Error('Human skill authorization invalid');
  const token = {};
  skillGrants.set(token, { session, name, args, signal, live });
  return token;
}

export function consumeHumanSkillAuthorization(token: HumanSkillAuthorization | undefined, session: Session | undefined,
  name: string, args: string, signal: AbortSignal): void {
  const grant = token && skillGrants.get(token);
  if (token) skillGrants.delete(token);
  if (!grant || grant.session !== session || grant.name !== name || grant.args !== args || grant.signal !== signal ||
      signal.aborted || !grant.session.isOpen || grant.session.isJournalFenced || !grant.live())
    throw new Error('Human skill authorization invalid');
}

// W385 host rewrite: ns/Si, sfn1dbxq [226694,227794)/[233465,234179), UTF-16,
// have no durable host delivery or commit authority.
export function issueNotificationAuthorization(session: Session, deliveryId: string, batch: Intent['batch'],
  live: () => boolean, currentBatch: () => Intent['batch'] | undefined): NotificationAuthorization {
  const intents = session.events.filter((row): row is Intent => row.kind === 'notification_intent_v2'
    && row.owner === session.id && row.deliveryId === deliveryId);
  if (!live() || session.isJournalFenced || intents.length !== 1 || !isDeepStrictEqual(intents[0]!.batch, batch))
    throw new Error('Notification batch differs from durable intent');
  const token = {};
  grants.set(token, { session, intent: structuredClone(intents[0]!), batch: structuredClone(batch), live, currentBatch });
  return token;
}

export function bindNotificationMessage(token: NotificationAuthorization, session: Session, message: Anthropic.MessageParam): void {
  const grant = grants.get(token);
  if (!grant || grant.session !== session || grant.message !== undefined) throw new Error('Notification authorization invalid');
  grant.message = structuredClone(message);
}

export function consumeNotificationAuthorization(token: NotificationAuthorization | undefined, session: Session,
  event: Extract<SessionEvent, { kind: 'message' }>): void {
  const grant = token && grants.get(token);
  if (token) grants.delete(token);
  if (!grant || grant.session !== session || !grant.live() || session.isJournalFenced || !grant.message ||
      !isDeepStrictEqual(grant.message, event.message) || !isDeepStrictEqual(grant.batch, grant.currentBatch()) ||
      !isDeepStrictEqual(event.notificationDelivery, { owner: grant.intent.owner, deliveryId: grant.intent.deliveryId }) ||
      !session.events.some(row => isDeepStrictEqual(row, grant.intent)))
    throw new Error('Notification delivery authorization invalid');
}
