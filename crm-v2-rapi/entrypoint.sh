#!/bin/sh

if [ -n "$MIGRATE" ]
then
    echo "Waiting for database to be up on $DATABASE_HOST:$DATABASE_PORT ..."
    # Wait for the PgBouncer container to be ready
    while ! nc -z $DATABASE_HOST $DATABASE_PORT; do
        sleep 0.1
    done
    echo "Postgres started"

    echo "Starting Migration..."
    yarn prisma migrate deploy
    echo "Migrations are done. Exiting."
    exit 0
fi

echo "Waiting for pgbouncer to be up on $PSQL_HOST:$PSQL_PORT ..."

# Wait for the PgBouncer container to be ready
while ! nc -z $PSQL_HOST $PSQL_PORT; do
    sleep 0.1
done

echo "PgBouncer started"
echo "ENVIRONMENT: $ENVIRONMENT"

echo "Starting application..."
exec dumb-init "$@"