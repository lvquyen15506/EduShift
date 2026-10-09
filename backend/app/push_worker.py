"""Deliver saved student notifications through Expo without blocking API requests."""

from datetime import datetime, timedelta
import logging
import time
import uuid

import httpx
from sqlalchemy import or_

from .database import SessionLocal
from .models import Notification, PushToken

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
logger = logging.getLogger(__name__)


def deliver_once(db, notification_id: uuid.UUID | None = None) -> bool:
    """Send one due notification; return False when the queue is empty."""
    now = datetime.utcnow()
    query = (
        db.query(Notification, PushToken)
        .join(PushToken, PushToken.user_id == Notification.user_id)
        .filter(
            Notification.created_at >= PushToken.registered_at,
            PushToken.registered_at >= now - timedelta(days=30),
            Notification.push_sent_at.is_(None),
            Notification.push_attempts < 5,
            or_(Notification.push_next_attempt_at.is_(None), Notification.push_next_attempt_at <= now),
        )
    )
    if notification_id:
        query = query.filter(Notification.id == notification_id)
    pair = query.order_by(Notification.created_at).with_for_update(skip_locked=True, of=Notification).first()
    if not pair:
        return False
    notification, token = pair
    try:
        response = httpx.post(EXPO_PUSH_URL, json={
            'to': token.token,
            'title': 'EduShift có cập nhật mới',
            'body': 'Mở ứng dụng để xem thông báo mới.',
            'data': {'shift_id': str(notification.shift_id) if notification.shift_id else None},
            'channelId': 'updates',
        }, timeout=10)
        response.raise_for_status()
        payload = response.json()
        ticket = payload.get('data', {}) if isinstance(payload, dict) else {}
        if isinstance(ticket, list):
            ticket = ticket[0] if ticket else {}
        if not isinstance(ticket, dict):
            ticket = {}
        if ticket.get('status') != 'ok':
            details = ticket.get('details') or {}
            reason = details.get('error', 'ExpoPushError') if isinstance(details, dict) else 'ExpoPushError'
            if reason == 'DeviceNotRegistered':
                db.delete(token)
                notification.push_attempts = 5
                db.commit()
                return True
            raise RuntimeError(reason)
        notification.push_sent_at = now
        db.commit()
    except (httpx.HTTPError, ValueError, RuntimeError) as exc:
        notification.push_attempts = (notification.push_attempts or 0) + 1
        notification.push_next_attempt_at = now + timedelta(seconds=min(3600, 30 * 2 ** notification.push_attempts))
        db.commit()
        logger.warning('Expo push attempt %s failed: %s', notification.push_attempts, exc)
    return True


def main():
    logging.basicConfig(level=logging.INFO)
    while True:
        try:
            with SessionLocal() as db:
                worked = deliver_once(db)
        except Exception:
            logger.exception('Push worker iteration failed')
            worked = False
        if not worked:
            time.sleep(5)


if __name__ == '__main__':
    main()
