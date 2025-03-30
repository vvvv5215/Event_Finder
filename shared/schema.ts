import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const eventCategories = [
  "All",
  "Music",
  "Food",
  "Arts",
  "Sports",
  "Education",
  "Business",
  "Health"
] as const;

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  address: text("address").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  date: timestamp("date").notNull(),
  endDate: timestamp("end_date"),
  categoryId: text("category_id").notNull(),
  price: integer("price"),
  isFree: boolean("is_free").default(false).notNull(),
  imageUrl: text("image_url"),
  hostId: integer("host_id").notNull(),
  isOnline: boolean("is_online").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  distanceInKilometers: doublePrecision("distance_in_kilometers")
});

export const attendees = pgTable("attendees", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  eventId: integer("event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  name: true,
  avatar: true
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  distanceInKilometers: true
});

export const insertAttendeeSchema = createInsertSchema(attendees).pick({
  userId: true,
  eventId: true
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type InsertAttendee = z.infer<typeof insertAttendeeSchema>;

export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Attendee = typeof attendees.$inferSelect;

export type EventWithAttendees = Event & {
  attendees: number;
  attendeesList: { id: number; name: string; avatar: string }[];
  host: { id: number; name: string; avatar: string };
};

export type CategoryType = typeof eventCategories[number];
