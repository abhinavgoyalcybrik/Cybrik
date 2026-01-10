#!/usr/bin/env bash
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

if [ -n "$DJANGO_SUPERUSER_USERNAME" ]; then
    python manage.py shell -c "
from django.contrib.auth import get_user_model;
User=get_user_model();
User.objects.filter(username='$DJANGO_SUPERUSER_USERNAME').exists() or \
User.objects.create_superuser('$DJANGO_SUPERUSER_USERNAME','$DJANGO_SUPERUSER_EMAIL','$DJANGO_SUPERUSER_PASSWORD')"
fi

exec gunicorn CybricHQ.wsgi:application --bind 0.0.0.0:8000 --workers 3
