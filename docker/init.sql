-- Create both databases so either docker-compose can be used
SELECT 'CREATE DATABASE driftos_core' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'driftos_core')\gexec
SELECT 'CREATE DATABASE driftos_embed' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'driftos_embed')\gexec

-- Initialize extensions in driftos_core
\c driftos_core
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Initialize extensions in driftos_embed
\c driftos_embed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
