import { db } from './db';
import { eq, and, or, sql, asc, desc, like } from 'drizzle-orm';
import { users, events, attendees, type User, type InsertUser, type Event, type InsertEvent, type Attendee, type InsertAttendee, type EventWithAttendees } from "@shared/schema";
import { IStorage } from './storage';

export class PgStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  // Event methods
  async getEvent(id: number): Promise<EventWithAttendees | undefined> {
    const eventResult = await db.select().from(events).where(eq(events.id, id));
    if (!eventResult.length) return undefined;
    
    const event = eventResult[0];
    
    // Get event attendees
    const attendeesList = await this.getFormattedAttendees(id);
    const attendeesCount = attendeesList.length;
    
    // Get host information
    const hostResult = await db.select().from(users).where(eq(users.id, event.hostId));
    if (!hostResult.length) return undefined;
    
    const host = {
      id: hostResult[0].id,
      name: hostResult[0].name,
      avatar: hostResult[0].avatar || ''
    };
    
    return {
      ...event,
      attendees: attendeesCount,
      attendeesList,
      host
    };
  }

  async getAllEvents(): Promise<EventWithAttendees[]> {
    const allEvents = await db.select().from(events);
    
    // Map each event to include attendees and host info
    const eventsWithDetails = await Promise.all(
      allEvents.map(async (event) => {
        const attendeesList = await this.getFormattedAttendees(event.id);
        const hostResult = await db.select().from(users).where(eq(users.id, event.hostId));
        
        const host = hostResult.length > 0 ? {
          id: hostResult[0].id,
          name: hostResult[0].name,
          avatar: hostResult[0].avatar || ''
        } : { id: 0, name: 'Unknown', avatar: '' };
        
        return {
          ...event,
          attendees: attendeesList.length,
          attendeesList,
          host
        };
      })
    );
    
    return eventsWithDetails;
  }

  async getEventsByCategory(categoryId: string): Promise<EventWithAttendees[]> {
    if (categoryId === 'All') {
      return this.getAllEvents();
    }
    
    const categoryEvents = await db.select().from(events).where(eq(events.categoryId, categoryId));
    
    // Map each event to include attendees and host info
    const eventsWithDetails = await Promise.all(
      categoryEvents.map(async (event) => {
        const attendeesList = await this.getFormattedAttendees(event.id);
        const hostResult = await db.select().from(users).where(eq(users.id, event.hostId));
        
        const host = hostResult.length > 0 ? {
          id: hostResult[0].id,
          name: hostResult[0].name,
          avatar: hostResult[0].avatar || ''
        } : { id: 0, name: 'Unknown', avatar: '' };
        
        return {
          ...event,
          attendees: attendeesList.length,
          attendeesList,
          host
        };
      })
    );
    
    return eventsWithDetails;
  }

  async getEventsNearLocation(lat: number, lng: number, distance: number): Promise<EventWithAttendees[]> {
    // Get all events first
    const allEvents = await this.getAllEvents();
    
    // Calculate distance for each event and filter by maximum distance
    return allEvents.map(event => {
      const distanceInMiles = this.calculateDistance(
        lat, lng, 
        event.latitude, event.longitude
      );
      
      return {
        ...event,
        distanceInMiles
      };
    }).filter(event => event.distanceInMiles <= distance)
      .sort((a, b) => (a.distanceInMiles || 0) - (b.distanceInMiles || 0));
  }

  async searchEvents(query: string): Promise<EventWithAttendees[]> {
    const searchPattern = `%${query}%`;
    
    const searchResults = await db.select().from(events).where(
      or(
        like(events.title, searchPattern),
        like(events.description, searchPattern),
        like(events.location, searchPattern)
      )
    );
    
    // Map each event to include attendees and host info
    const eventsWithDetails = await Promise.all(
      searchResults.map(async (event) => {
        const attendeesList = await this.getFormattedAttendees(event.id);
        const hostResult = await db.select().from(users).where(eq(users.id, event.hostId));
        
        const host = hostResult.length > 0 ? {
          id: hostResult[0].id,
          name: hostResult[0].name,
          avatar: hostResult[0].avatar || ''
        } : { id: 0, name: 'Unknown', avatar: '' };
        
        return {
          ...event,
          attendees: attendeesList.length,
          attendeesList,
          host
        };
      })
    );
    
    return eventsWithDetails;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const result = await db.insert(events).values(event).returning();
    return result[0];
  }

  async updateEvent(id: number, eventUpdate: Partial<InsertEvent>): Promise<Event | undefined> {
    const result = await db.update(events)
      .set(eventUpdate)
      .where(eq(events.id, id))
      .returning();
    
    return result[0];
  }

  async deleteEvent(id: number): Promise<boolean> {
    try {
      // Delete associated attendees first
      await db.delete(attendees).where(eq(attendees.eventId, id));
      
      // Delete the event
      const result = await db.delete(events).where(eq(events.id, id)).returning();
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting event:', error);
      return false;
    }
  }

  // Attendee methods
  async getEventAttendees(eventId: number): Promise<Attendee[]> {
    return db.select().from(attendees).where(eq(attendees.eventId, eventId));
  }

  async createAttendee(attendeeData: InsertAttendee): Promise<Attendee> {
    const result = await db.insert(attendees).values(attendeeData).returning();
    return result[0];
  }

  async deleteAttendee(userId: number, eventId: number): Promise<boolean> {
    try {
      const result = await db.delete(attendees)
        .where(
          and(
            eq(attendees.userId, userId),
            eq(attendees.eventId, eventId)
          )
        )
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error('Error deleting attendee:', error);
      return false;
    }
  }

  async isUserAttending(userId: number, eventId: number): Promise<boolean> {
    const result = await db.select().from(attendees)
      .where(
        and(
          eq(attendees.userId, userId),
          eq(attendees.eventId, eventId)
        )
      );
    
    return result.length > 0;
  }

  // Helper methods
  private async getFormattedAttendees(eventId: number) {
    // Get all attendees for this event
    const eventAttendees = await db.select().from(attendees).where(eq(attendees.eventId, eventId));
    
    // Get user details for each attendee
    const attendeeDetails = await Promise.all(
      eventAttendees.map(async (attendee) => {
        const userResult = await db.select().from(users).where(eq(users.id, attendee.userId));
        if (userResult.length === 0) return null;
        
        const user = userResult[0];
        return {
          id: user.id,
          name: user.name,
          avatar: user.avatar || ''
        };
      })
    );
    
    // Filter out null values
    return attendeeDetails.filter((attendee): attendee is { id: number; name: string; avatar: string } => 
      attendee !== null
    );
  }

  // Helper method to calculate distance between two points
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in kilometers
    return parseFloat(distance.toFixed(1));
  }
  
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Seed database with initial data
  async seedDatabase(): Promise<boolean> {
    try {
      // Check if users table is empty
      const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
      
      if (userCount[0].count === 0) {
        console.log('Seeding database with initial data...');
        
        // Create sample users
        const user1 = await this.createUser({
          username: "johndoe",
          password: "password123",
          email: "john@example.com",
          name: "John Doe",
          avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
        });
        
        const user2 = await this.createUser({
          username: "janedoe",
          password: "password123",
          email: "jane@example.com",
          name: "Jane Doe",
          avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
        });
        
        // Create sample events
        const event1 = await this.createEvent({
          title: "Summer Music Festival",
          description: "Join us for a day of amazing music performances in Central Park!",
          location: "Central Park",
          address: "Central Park, New York, NY",
          latitude: 40.785091,
          longitude: -73.968285,
          date: new Date("2023-06-15T14:00:00"),
          endDate: new Date("2023-06-15T22:00:00"),
          categoryId: "Music",
          price: 25,
          isFree: false,
          imageUrl: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&h=500&q=80",
          hostId: user1.id,
          isOnline: false
        });
        
        const event2 = await this.createEvent({
          title: "Annual Tech Conference",
          description: "The biggest tech conference in New York City",
          location: "Javits Center",
          address: "Javits Center, New York, NY",
          latitude: 40.7570877,
          longitude: -74.0028733,
          date: new Date("2023-06-24T09:00:00"),
          endDate: new Date("2023-06-24T18:00:00"),
          categoryId: "Business",
          price: 149,
          isFree: false,
          imageUrl: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&h=500&q=80",
          hostId: user2.id,
          isOnline: false
        });
        
        const event3 = await this.createEvent({
          title: "International Food Festival",
          description: "Taste foods from all around the world",
          location: "Bryant Park",
          address: "Bryant Park, New York, NY",
          latitude: 40.753605,
          longitude: -73.9834889,
          date: new Date("2023-06-18T11:00:00"),
          endDate: new Date("2023-06-18T20:00:00"),
          categoryId: "Food",
          price: 0,
          isFree: true,
          imageUrl: "https://images.unsplash.com/photo-1470753937643-efeb931202a9?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&h=500&q=80",
          hostId: user1.id,
          isOnline: false
        });
        
        const event4 = await this.createEvent({
          title: "Modern Art Exhibition",
          description: "Featuring modern art from local and international artists",
          location: "MoMA",
          address: "MoMA, New York, NY",
          latitude: 40.7614327,
          longitude: -73.9776216,
          date: new Date("2023-06-20T10:00:00"),
          endDate: new Date("2023-06-20T18:00:00"),
          categoryId: "Arts",
          price: 15,
          isFree: false,
          imageUrl: "https://images.unsplash.com/photo-1527525443983-6e60c75fff46?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&h=500&q=80",
          hostId: user2.id,
          isOnline: false
        });
        
        const event5 = await this.createEvent({
          title: "Startup Networking Mixer",
          description: "Connect with other entrepreneurs and startups in NYC",
          location: "WeWork",
          address: "WeWork, New York, NY",
          latitude: 40.7484,
          longitude: -73.9857,
          date: new Date("2023-06-22T18:30:00"),
          endDate: new Date("2023-06-22T21:30:00"),
          categoryId: "Business",
          price: 10,
          isFree: false,
          imageUrl: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&h=500&q=80",
          hostId: user1.id,
          isOnline: false
        });
        
        const event6 = await this.createEvent({
          title: "Sunset Yoga Workshop",
          description: "Relax and unwind with sunset yoga on the High Line",
          location: "The High Line",
          address: "The High Line, New York, NY",
          latitude: 40.7479925,
          longitude: -74.0047649,
          date: new Date("2023-06-16T19:00:00"),
          endDate: new Date("2023-06-16T20:30:00"),
          categoryId: "Health",
          price: 20,
          isFree: false,
          imageUrl: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&h=500&q=80",
          hostId: user2.id,
          isOnline: false
        });
        
        // Add attendees to events
        await this.createAttendee({ userId: user1.id, eventId: event2.id });
        await this.createAttendee({ userId: user2.id, eventId: event1.id });
        await this.createAttendee({ userId: user1.id, eventId: event3.id });
        await this.createAttendee({ userId: user2.id, eventId: event3.id });
        await this.createAttendee({ userId: user1.id, eventId: event5.id });
        await this.createAttendee({ userId: user2.id, eventId: event4.id });
        await this.createAttendee({ userId: user1.id, eventId: event6.id });
        
        console.log('Database seeded successfully');
      } else {
        console.log('Database already has data, skipping seed');
      }
      
      return true;
    } catch (error) {
      console.error('Error seeding database:', error);
      return false;
    }
  }
}

export const pgStorage = new PgStorage();