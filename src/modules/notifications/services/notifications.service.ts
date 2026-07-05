import { v4 as uuidv4 } from 'uuid';
import db from '../../../database';
import {
  NotificationEvent,
  NotificationsServiceV1,
} from '../../../platform/contracts/services';

export const notificationsService: NotificationsServiceV1 = {
  async send(eventType: NotificationEvent, recipient: string, payload: Record<string, unknown> = {}) {
    const messageId = uuidv4();
    await db('notifications').insert({
      id: uuidv4(),
      provider_key: 'zavu',
      event_type: eventType,
      recipient,
      status: 'sent',
      payload: JSON.stringify({ ...payload, messageId }),
      external_message_id: messageId,
      created_at: new Date(),
    });
    console.log(`[ZAVU stub] ${eventType} -> ${recipient}`);
    return messageId;
  },
};
