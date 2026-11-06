import { bindNotificationMessage, issueNotificationAuthorization } from '../src/notification-authorization.js';
import type { Session, SessionEvent } from '../src/session.js';

export function fixtureAppend(session: Session, event: Extract<SessionEvent, { kind: 'message' }>): void {
  const delivery = event.notificationDelivery;
  if (!delivery) throw new Error('Fixture requires a delivery');
  const intent = session.events.find(row => row.kind === 'notification_intent_v2' && row.deliveryId === delivery.deliveryId);
  if (!intent || intent.kind !== 'notification_intent_v2') throw new Error('Fixture requires an intent');
  const token = issueNotificationAuthorization(session, delivery.deliveryId, intent.batch, () => true, () => intent.batch);
  bindNotificationMessage(token, session, event.message);
  session.append(event, token);
}
