import { events, eventCategories, users, attendees, type User, type InsertUser, type Event, type InsertEvent, type Attendee, type InsertAttendee, type EventWithAttendees } from "@shared/schema";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Event methods
  getEvent(id: number): Promise<EventWithAttendees | undefined>;
  getAllEvents(): Promise<EventWithAttendees[]>;
  getEventsByCategory(categoryId: string): Promise<EventWithAttendees[]>;
  getEventsNearLocation(lat: number, lng: number, distance: number): Promise<EventWithAttendees[]>;
  searchEvents(query: string): Promise<EventWithAttendees[]>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;
  
  // Attendee methods
  getEventAttendees(eventId: number): Promise<Attendee[]>;
  createAttendee(attendee: InsertAttendee): Promise<Attendee>;
  deleteAttendee(userId: number, eventId: number): Promise<boolean>;
  isUserAttending(userId: number, eventId: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private events: Map<number, Event>;
  private attendees: Map<number, Attendee>;
  private userId: number;
  private eventId: number;
  private attendeeId: number;

  constructor() {
    this.users = new Map();
    this.events = new Map();
    this.attendees = new Map();
    this.userId = 1;
    this.eventId = 1;
    this.attendeeId = 1;
    
    // Initialize with sample data
    this.seedData();
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userId++;
    const createdAt = new Date();
    const user: User = { 
      ...insertUser, 
      id, 
      createdAt,
      // Ensure avatar is never undefined to match the User type
      avatar: insertUser.avatar ?? null 
    };
    this.users.set(id, user);
    return user;
  }
  
  // Event methods
  async getEvent(id: number): Promise<EventWithAttendees | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;
    
    const eventAttendees = Array.from(this.attendees.values())
      .filter(a => a.eventId === id);
    
    const host = this.users.get(event.hostId);
    if (!host) return undefined;
    
    const attendeeUsers = eventAttendees.map(a => {
      const user = this.users.get(a.userId);
      return user ? { id: user.id, name: user.name, avatar: user.avatar || '' } : null;
    }).filter(Boolean) as { id: number; name: string; avatar: string }[];
    
    return {
      ...event,
      attendees: eventAttendees.length,
      attendeesList: attendeeUsers,
      host: {
        id: host.id,
        name: host.name,
        avatar: host.avatar || ''
      }
    };
  }

  async getAllEvents(): Promise<EventWithAttendees[]> {
    const events = Array.from(this.events.values());
    return Promise.all(events.map(event => this.getEvent(event.id) as Promise<EventWithAttendees>));
  }

  async getEventsByCategory(categoryId: string): Promise<EventWithAttendees[]> {
    if (categoryId === 'All') {
      return this.getAllEvents();
    }
    
    const events = Array.from(this.events.values())
      .filter(event => event.categoryId === categoryId);
    
    return Promise.all(events.map(event => this.getEvent(event.id) as Promise<EventWithAttendees>));
  }

  async getEventsNearLocation(lat: number, lng: number, distance: number): Promise<EventWithAttendees[]> {
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
    const lowercaseQuery = query.toLowerCase();
    const events = Array.from(this.events.values())
      .filter(event => 
        event.title.toLowerCase().includes(lowercaseQuery) ||
        event.description.toLowerCase().includes(lowercaseQuery) ||
        event.location.toLowerCase().includes(lowercaseQuery)
      );
    
    return Promise.all(events.map(event => this.getEvent(event.id) as Promise<EventWithAttendees>));
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = this.eventId++;
    const createdAt = new Date();
    const event: Event = { 
      ...insertEvent, 
      id, 
      createdAt, 
      distanceInMiles: null,
      // Ensure required fields are never undefined to match the Event type
      endDate: insertEvent.endDate ?? null,
      isOnline: insertEvent.isOnline ?? false,
      price: insertEvent.price ?? null,
      imageUrl: insertEvent.imageUrl ?? null,
      isFree: insertEvent.isFree ?? false
    };
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: number, eventUpdate: Partial<InsertEvent>): Promise<Event | undefined> {
    const event = this.events.get(id);
    if (!event) return undefined;
    
    const updatedEvent = { ...event, ...eventUpdate };
    this.events.set(id, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(id: number): Promise<boolean> {
    return this.events.delete(id);
  }
  
  // Attendee methods
  async getEventAttendees(eventId: number): Promise<Attendee[]> {
    return Array.from(this.attendees.values())
      .filter(attendee => attendee.eventId === eventId);
  }

  async createAttendee(insertAttendee: InsertAttendee): Promise<Attendee> {
    const id = this.attendeeId++;
    const createdAt = new Date();
    const attendee: Attendee = { ...insertAttendee, id, createdAt };
    this.attendees.set(id, attendee);
    return attendee;
  }

  async deleteAttendee(userId: number, eventId: number): Promise<boolean> {
    const attendee = Array.from(this.attendees.values())
      .find(a => a.userId === userId && a.eventId === eventId);
    
    if (!attendee) return false;
    return this.attendees.delete(attendee.id);
  }

  async isUserAttending(userId: number, eventId: number): Promise<boolean> {
    return Array.from(this.attendees.values())
      .some(a => a.userId === userId && a.eventId === eventId);
  }
  
  // Helper method to calculate distance between two points
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8; // Earth's radius in miles
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in miles
    return parseFloat(distance.toFixed(1));
  }
  
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }
  
  // Seed with sample data
  private seedData() {
    // Create sample users
    const user1 = this.createUser({
      username: "johndoe",
      password: "password123",
      email: "john@example.com",
      name: "John Doe",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
    });
    
    const user2 = this.createUser({
      username: "janedoe",
      password: "password123",
      email: "jane@example.com",
      name: "Jane Doe",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
    });
    
    // Create sample events
    const event1Promise = this.createEvent({
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
      hostId: 1,
      isOnline: false
    });
    
    const event2Promise = this.createEvent({
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
      hostId: 2,
      isOnline: false
    });
    
    const event3Promise = this.createEvent({
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
      hostId: 1,
      isOnline: false
    });
    
    const event4Promise = this.createEvent({
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
      hostId: 2,
      isOnline: false
    });
    
    const event5Promise = this.createEvent({
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
      hostId: 1,
      isOnline: false
    });
    
    const event6Promise = this.createEvent({
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
      hostId: 2,
      isOnline: false
    });

    // Handle promises for seed data
    Promise.all([
      user1, user2, 
      event1Promise, event2Promise, event3Promise, 
      event4Promise, event5Promise, event6Promise
    ]).then(([user1Result, user2Result, event1, event2, event3, event4, event5, event6]) => {
      // Add attendees to events
      this.createAttendee({ userId: 1, eventId: 2 });
      this.createAttendee({ userId: 2, eventId: 1 });
      this.createAttendee({ userId: 1, eventId: 3 });
      this.createAttendee({ userId: 2, eventId: 3 });
      this.createAttendee({ userId: 1, eventId: 5 });
      this.createAttendee({ userId: 2, eventId: 4 });
      this.createAttendee({ userId: 1, eventId: 6 });
    });
  }
}

// Use PostgreSQL storage in production, but keep MemStorage for backwards compatibility
import { pgStorage } from './pgStorage';
export const storage = pgStorage;
