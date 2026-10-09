"""Create the first production administrator without demo accounts or fixed passwords."""

import argparse
from getpass import getpass

from email_validator import EmailNotValidError, validate_email
from passlib.context import CryptContext
from sqlalchemy import func, or_

from .database import SessionLocal
from .models import User


def main() -> None:
    parser = argparse.ArgumentParser(description='Create an EduShift administrator')
    parser.add_argument('email', help='Administrator email address')
    parser.add_argument('--username', default='admin')
    args = parser.parse_args()
    try:
        email = validate_email(args.email, check_deliverability=False).normalized.lower()
    except EmailNotValidError as exc:
        parser.error(str(exc))
    password = getpass('New administrator password (at least 12 characters): ')
    if len(password) < 12 or password != getpass('Repeat password: '):
        parser.error('Password is too short or the values do not match')

    with SessionLocal() as db:
        existing = db.query(User).filter(or_(func.lower(User.email) == email, User.username == args.username)).first()
        if existing:
            parser.error('Email or username already exists; no account was changed')
        db.add(User(username=args.username, email=email,
                    password_hash=CryptContext(schemes=['bcrypt']).hash(password), role='ADMIN'))
        db.commit()
    print(f'Administrator created: {email}')


if __name__ == '__main__':
    main()
