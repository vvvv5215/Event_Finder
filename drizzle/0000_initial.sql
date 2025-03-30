-- Initial schema

CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "avatar" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS "events" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "date" TIMESTAMP NOT NULL,
  "end_date" TIMESTAMP,
  "category_id" TEXT NOT NULL,
  "price" INTEGER,
  "is_free" BOOLEAN DEFAULT FALSE NOT NULL,
  "image_url" TEXT,
  "host_id" INTEGER NOT NULL,
  "is_online" BOOLEAN DEFAULT FALSE NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  "distance_in_miles" DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS "attendees" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "event_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE("user_id", "event_id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "events_category_id_idx" ON "events" ("category_id");
CREATE INDEX IF NOT EXISTS "events_host_id_idx" ON "events" ("host_id");
CREATE INDEX IF NOT EXISTS "attendees_event_id_idx" ON "attendees" ("event_id");
CREATE INDEX IF NOT EXISTS "attendees_user_id_idx" ON "attendees" ("user_id");

-- Add foreign key constraints
ALTER TABLE "events" 
  ADD CONSTRAINT "events_host_id_fkey" 
  FOREIGN KEY ("host_id") REFERENCES "users" ("id") 
  ON DELETE CASCADE;

ALTER TABLE "attendees" 
  ADD CONSTRAINT "attendees_user_id_fkey" 
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") 
  ON DELETE CASCADE;

ALTER TABLE "attendees" 
  ADD CONSTRAINT "attendees_event_id_fkey" 
  FOREIGN KEY ("event_id") REFERENCES "events" ("id") 
  ON DELETE CASCADE;