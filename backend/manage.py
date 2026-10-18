#!/usr/bin/env python3
import getpass, sys, time
from app import app, db_conn, valid_user
from werkzeug.security import generate_password_hash

if len(sys.argv)<2 or sys.argv[1]!='create-admin' or len(sys.argv)>3 or (len(sys.argv)==3 and sys.argv[2]!='--role'):
    print('Usage: python manage.py create-admin [--role]'); raise SystemExit(2)
with app.app_context():
    name=input('Username: ').strip()
    if not valid_user(name): raise SystemExit('Invalid username (3-32 characters: letters, digits, _, ., -)')
    p1=getpass.getpass('Password (12+ characters): '); p2=getpass.getpass('Confirm password: ')
    if not 12<=len(p1)<=128 or p1!=p2: raise SystemExit('Passwords must match and be 12-128 characters')
    role=input('Role [admin/owner/developer] (default owner): ').strip() or 'owner'
    if role not in ('admin','owner','developer'): raise SystemExit('Invalid privileged role')
    try:
        db_conn().execute('INSERT INTO users VALUES(?,?,?,?)',(name,generate_password_hash(p1,method='scrypt'),role,time.time())); db_conn().commit()
    except Exception as e: raise SystemExit(f'Could not create account: {e}')
    print(f'Created {role} account {name}')
