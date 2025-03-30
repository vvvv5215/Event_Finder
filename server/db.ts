import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { eq, and, or, sql, asc, desc, like } from 'drizzle-orm';
import * as schema from '@shared/schema';

const { Pool } = pg;

// Create a PostgreSQL connection pool for the default database
const defaultPool = new Pool({
  user: 'postgres',
  password: 'Vishw@nth22',
  host: 'localhost',
  port: 5432,
  database: 'postgres'
});

// Create a PostgreSQL connection pool for our application database
const pool = new Pool({
  user: 'postgres',
  password: 'Vishw@nth22',
  host: 'localhost',
  port: 5432,
  database: 'eventfinder'
});

// Create a Drizzle instance
export const db = drizzle(pool, { schema });

// Function to create database if it doesn't exist
async function createDatabaseIfNotExists() {
  try {
    const client = await defaultPool.connect();
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'eventfinder'"
    );
    
    if (result.rowCount === 0) {
      await client.query('CREATE DATABASE eventfinder');
      console.log('Database created successfully');
    }
    
    client.release();
  } catch (error) {
    console.error('Error creating database:', error);
    throw error;
  }
}

// Function to run migrations
export async function runMigrations() {
  try {
    console.log('Running migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  }
}

// Initialize the database
export async function initDatabase() {
  try {
    // Create database if it doesn't exist
    await createDatabaseIfNotExists();
    
    // Create tables if they don't exist
    await runMigrations();
    return true;
  } catch (error) {
    console.error('Database initialization error:', error);
    return false;
  }
}