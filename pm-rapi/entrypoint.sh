#!/bin/sh

echo "Waiting for pgbouncer to be up on $PSQL_HOST:$PSQL_PORT ..."

# Wait for the PgBouncer container to be ready
while ! nc -z $PSQL_HOST $PSQL_PORT; do
    sleep 0.1
done

echo "PgBouncer started"
echo "ENVIRONMENT: $ENVIRONMENT"

if [ -n "$MIGRATE" ]
then
    echo "Starting Migration..."
    python manage.py migrate
    echo "Migrations are done. Exiting."
    exit 0
elif [ "$ENVIRONMENT" = "prod" ] || [ "$ENVIRONMENT" = "staging" ]
then
    echo "Starting Gunicorn for production/staging..."
    gunicorn p_pm_rapi.wsgi:application --log-level=debug --worker-class gthread --workers 3 --threads 2 --timeout 120 --bind 0.0.0.0:8001
else
    echo "Starting Gunicorn for development..."
    gunicorn p_pm_rapi.wsgi:application --log-level=debug --worker-class gthread --workers 3 --threads 2 --timeout 120 --bind 0.0.0.0:8001
fi