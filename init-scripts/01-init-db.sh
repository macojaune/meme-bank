#!/bin/bash
set -e

# This script is executed when the PostgreSQL container is started for the first time
# It creates the database and user if they don't exist

# PostgreSQL executes scripts in alphabetical order, so prefixing with numbers
# ensures proper execution sequence

echo "Creating database and user for MemeBank application..."

# These environment variables are set in the docker-compose.yml file
# and are automatically passed to this script

# Create user if it doesn't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO
    \$\$ 
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolename = 'memebank_user') THEN
            CREATE ROLE memebank_user WITH LOGIN PASSWORD 'memebank_password';
        END IF;
    END
    \$\$;

    ALTER ROLE memebank_user WITH CREATEDB;
    
    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE memebank_dev TO memebank_user;
    
    -- Enable extensions that might be useful
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search
    CREATE EXTENSION IF NOT EXISTS "unaccent"; -- For text normalization
    CREATE EXTENSION IF NOT EXISTS "vectorscale" CASCADE; -- For vector search, CASCADE will also install pgvector
EOSQL

echo "Database initialization completed successfully."