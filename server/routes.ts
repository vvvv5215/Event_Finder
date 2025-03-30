import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertAttendeeSchema, insertUserSchema, EventWithAttendees } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const newUser = await storage.createUser(userData);
      
      // Don't return the password in the response
      const { password, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      res.status(500).json({ message: "Failed to create user" });
    }
  });
  
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      console.log("Login attempt for:", username);
      
      if (!username || !password) {
        return res.status(400).json({ 
          success: false, 
          message: "Username and password are required" 
        });
      }
      
      // Find the user
      const user = await storage.getUserByUsername(username);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ 
          success: false, 
          message: "Invalid username or password" 
        });
      }
      
      // Don't return the password in the response
      const { password: _, ...userWithoutPassword } = user;
      
      // Set user in session
      req.session.user = user;
      req.session.userId = user.id;
      
      console.log("Login successful for:", username);
      res.json({
        success: true,
        user: userWithoutPassword
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Login failed" 
      });
    }
  });
  
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    // Check if user is in session
    if (!req.session.userId) {
      return res.status(401).json({ 
        success: false,
        message: "Not authenticated" 
      });
    }
    
    try {
      // Get user from database using session userId
      const user = await storage.getUser(req.session.userId);
      
      if (!user) {
        // Clear invalid session
        req.session.destroy((err) => {
          if (err) console.error("Session destruction error:", err);
        });
        
        return res.status(401).json({ 
          success: false,
          message: "User not found" 
        });
      }
      
      // Don't return the password
      const { password, ...userWithoutPassword } = user;
      
      return res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      return res.status(500).json({ 
        success: false,
        message: "Server error" 
      });
    }
  });
  
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ 
          success: false,
          message: "Failed to log out" 
        });
      }
      
      res.json({ 
        success: true,
        message: "Logged out successfully" 
      });
    });
  });
  
  // API routes
  const apiRouter = app.route("/api");

  // Get all events
  app.get("/api/events", async (req: Request, res: Response) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve events" });
    }
  });

  // Get events by category
  app.get("/api/events/category/:categoryId", async (req: Request, res: Response) => {
    try {
      const { categoryId } = req.params;
      const events = await storage.getEventsByCategory(categoryId);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve events by category" });
    }
  });

  // Get events near location
  app.get("/api/events/near", async (req: Request, res: Response) => {
    try {
      const { lat, lng, distance } = req.query;
      
      if (!lat || !lng || !distance) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);
      const distanceInMiles = parseFloat(distance as string);
      
      if (isNaN(latitude) || isNaN(longitude) || isNaN(distanceInMiles)) {
        return res.status(400).json({ message: "Invalid parameters" });
      }
      
      const events = await storage.getEventsNearLocation(latitude, longitude, distanceInMiles);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve nearby events" });
    }
  });

  // Search events
  app.get("/api/events/search", async (req: Request, res: Response) => {
    try {
      const { query } = req.query;
      
      if (!query) {
        return res.status(400).json({ message: "Missing search query" });
      }
      
      const events = await storage.searchEvents(query as string);
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: "Failed to search events" });
    }
  });

  // Get single event
  app.get("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const eventId = parseInt(id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      res.json(event);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve event" });
    }
  });

  // Create event
  app.post("/api/events", async (req: Request, res: Response) => {
    try {
      // Process date fields before validation
      let data = req.body;
      
      // Convert date strings to Date objects
      if (typeof data.date === 'string') {
        data.date = new Date(data.date);
      }
      
      if (typeof data.endDate === 'string') {
        data.endDate = new Date(data.endDate);
      }
      
      const eventData = insertEventSchema.parse(data);
      const newEvent = await storage.createEvent(eventData);
      
      const eventWithDetails = await storage.getEvent(newEvent.id);
      res.status(201).json(eventWithDetails);
    } catch (error) {
      console.error("Event creation error:", error);
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  // Update event
  app.put("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const eventId = parseInt(id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      // Process date fields before validation
      let data = req.body;
      
      // Convert date strings to Date objects
      if (typeof data.date === 'string') {
        data.date = new Date(data.date);
      }
      
      if (typeof data.endDate === 'string') {
        data.endDate = new Date(data.endDate);
      }
      
      // Partial validation of the event update data
      const eventUpdateData = insertEventSchema.partial().parse(data);
      const updatedEvent = await storage.updateEvent(eventId, eventUpdateData);
      
      if (!updatedEvent) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      const eventWithDetails = await storage.getEvent(updatedEvent.id);
      res.json(eventWithDetails);
    } catch (error) {
      console.error("Event update error:", error);
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  // Delete event
  app.delete("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const eventId = parseInt(id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const success = await storage.deleteEvent(eventId);
      
      if (!success) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Get event attendees
  app.get("/api/events/:id/attendees", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const eventId = parseInt(id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const attendees = await storage.getEventAttendees(eventId);
      res.json(attendees);
    } catch (error) {
      res.status(500).json({ message: "Failed to retrieve event attendees" });
    }
  });

  // Register for an event
  app.post("/api/events/:id/attend", async (req: Request, res: Response) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ message: "You must be logged in to register for events" });
      }
      
      const { id } = req.params;
      const eventId = parseInt(id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      // Use the authenticated user's ID from the session
      const userId = req.session.userId;
      
      // Check if user is already attending
      const isAttending = await storage.isUserAttending(userId, eventId);
      
      if (isAttending) {
        return res.status(400).json({ message: "You are already registered for this event" });
      }
      
      // Create attendee
      const newAttendee = await storage.createAttendee({
        userId,
        eventId
      });
      
      const updatedEvent = await storage.getEvent(eventId);
      res.status(201).json(updatedEvent);
    } catch (error) {
      console.error("Event registration error:", error);
      
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      res.status(500).json({ message: "Failed to register for event" });
    }
  });

  // Unregister from an event
  app.delete("/api/events/:id/attend", async (req: Request, res: Response) => {
    try {
      // Check authentication
      if (!req.session.userId) {
        return res.status(401).json({ message: "You must be logged in to cancel registration" });
      }
      
      const { id } = req.params;
      const eventId = parseInt(id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      // Use the authenticated user's ID from the session
      const userId = req.session.userId;
      
      // Check if user is attending
      const isAttending = await storage.isUserAttending(userId, eventId);
      
      if (!isAttending) {
        return res.status(400).json({ message: "You are not registered for this event" });
      }
      
      const success = await storage.deleteAttendee(userId, eventId);
      
      if (!success) {
        return res.status(404).json({ message: "Registration not found" });
      }
      
      const updatedEvent = await storage.getEvent(eventId);
      res.json(updatedEvent);
    } catch (error) {
      console.error("Cancel registration error:", error);
      res.status(500).json({ message: "Failed to cancel registration" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
