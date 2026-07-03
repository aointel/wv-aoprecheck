import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import { storage, type CallFilters } from "./storage-office";
import { z } from "zod";
import { insertCallSchema, insertUserSchema, insertTeamSchema } from "@shared/schema";
import { sendInvitationEmail } from "./email";
import { UploadedFile } from "express-fileupload";
import { setupAuth, hashPassword } from "./auth";
import { sql } from "drizzle-orm";
import fetch from "node-fetch";
import { recordingCache } from './services/recordingCacheService';

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes and middleware
  setupAuth(app);
  
  // Serve static files from the public directory
  app.use(express.static(path.join(process.cwd(), 'public')));
  app.use('/recordings', express.static(path.join(process.cwd(), 'public', 'recordings')));
  app.use('/installers', express.static(path.join(process.cwd(), 'public', 'installers')));
  
  // Direct download endpoint for ConnectNow app
  app.get('/installers/ConnectNow.exe', (req, res) => {
    const filePath = path.join(process.cwd(), 'public', 'installers', 'ConnectNow.exe');
    console.log('📥 Download request for ConnectNow.exe');
    console.log('   File path:', filePath);
    console.log('   File exists:', fs.existsSync(filePath));
    
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      console.log('   File size:', (stat.size / (1024 * 1024)).toFixed(2), 'MB');
      
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="ConnectNow.exe"');
      res.setHeader('Content-Length', stat.size);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
      fileStream.on('error', (err) => {
        console.error('   Stream error:', err);
        res.status(500).send('Download failed');
      });
    } else {
      console.error('   ❌ File not found!');
      res.status(404).send('Installer not found. Please contact support.');
    }
  });
  
  // Direct route for recordings with debug info
  app.get('/recordings/:id', (req, res) => {
    const recordingId = req.params.id;
    // Remove .mp3 extension if it's already in the ID
    const cleanId = recordingId.replace(/\.mp3$/, '');
    const filePath = path.join(process.cwd(), 'public', 'recordings', `${cleanId}.mp3`);
    
    console.log('Requested recording file:', recordingId);
    console.log('Looking for file at path:', filePath);
    
    if (fs.existsSync(filePath)) {
      console.log('File exists, sending file');
      // Set appropriate headers for audio file
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="recording-${cleanId}.mp3"`);
      res.sendFile(filePath);
    } else {
      console.log('File not found');
      res.status(404).send('Recording not found');
    }
  });

  // Analytics API route
  app.get("/api/analytics", async (req: Request, res: Response) => {
    try {
      // Apply office-based access control for analytics
      const filters: CallFilters = {};
      if (req.user) {
        const user = req.user;
        // Only SUPER_ADMIN can see analytics for all offices
        if (user.role !== 'SUPER_ADMIN' && user.office) {
          filters.office = user.office;
        }
      }

      // Get all calls for analytics (no pagination)
      const allCalls = await storage.getCalls(10000, 0, filters); // Large limit to get all calls
      const totalCalls = allCalls.length;

      // Calculate overview metrics - calls over 120 seconds are considered meaningful/completed
      const completedCalls = allCalls.filter(call => {
        if (!call.callDuration) return false;
        const durationSeconds = parseDuration(call.callDuration);
        return durationSeconds >= 120; // 2 minutes or longer
      }).length;
      const completionRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;

      // Calculate average call duration
      const callsWithDuration = allCalls.filter(call => call.callDuration);
      const avgDurationSeconds = callsWithDuration.length > 0 
        ? callsWithDuration.reduce((sum, call) => {
            const duration = parseDuration(call.callDuration || '0');
            return sum + duration;
          }, 0) / callsWithDuration.length
        : 0;
      const avgCallDuration = formatDuration(avgDurationSeconds);

      // Find top performing agent and office
      const agentCounts = allCalls.reduce((acc, call) => {
        if (call.agentName) {
          acc[call.agentName] = (acc[call.agentName] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      const topAgent = Object.entries(agentCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';

      const officeCounts = allCalls.reduce((acc, call) => {
        if (call.office) {
          acc[call.office] = (acc[call.office] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      const topOffice = Object.entries(officeCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';

      // Generate trends data (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const trends = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayCalls = allCalls.filter(call => {
          const callDate = call.createdAt ? new Date(call.createdAt) : null;
          return callDate && callDate.toISOString().split('T')[0] === dateStr;
        });
        
        const dayCompleted = dayCalls.filter(call => {
          if (!call.callDuration) return false;
          const durationSeconds = parseDuration(call.callDuration);
          return durationSeconds >= 120;
        }).length;
        const dayCompletionRate = dayCalls.length > 0 ? Math.round((dayCompleted / dayCalls.length) * 100) : 0;
        
        trends.push({
          date: dateStr,
          calls: dayCalls.length,
          completed: dayCompleted,
          completionRate: dayCompletionRate
        });
      }

      // Agent performance analysis
      const agentPerformance = Object.entries(agentCounts).map(([agentName, totalCalls]) => {
        const agentCalls = allCalls.filter(call => call.agentName === agentName);
        const completed = agentCalls.filter(call => {
          if (!call.callDuration) return false;
          const durationSeconds = parseDuration(call.callDuration);
          return durationSeconds >= 120;
        }).length;
        const completionRate = Math.round((completed / totalCalls) * 100);
        
        const agentCallsWithDuration = agentCalls.filter(call => call.callDuration);
        const avgDuration = agentCallsWithDuration.length > 0 
          ? agentCallsWithDuration.reduce((sum, call) => {
              return sum + parseDuration(call.callDuration || '0');
            }, 0) / agentCallsWithDuration.length
          : 0;
        
        // Get the most common office for this agent
        const agentOfficeCounts = agentCalls.reduce((acc, call) => {
          if (call.office && call.office.trim()) {
            acc[call.office] = (acc[call.office] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);
        const primaryOffice = Object.entries(agentOfficeCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'No Office';
        
        return {
          agentName,
          office: primaryOffice,
          totalCalls,
          completedCalls: completed,
          completionRate,
          avgDuration: formatDuration(avgDuration)
        };
      }).sort((a, b) => b.totalCalls - a.totalCalls);

      // Office performance analysis
      const officePerformance = Object.entries(officeCounts).map(([office, totalCalls]) => {
        const officeCalls = allCalls.filter(call => call.office === office);
        const completed = officeCalls.filter(call => {
          if (!call.callDuration) return false;
          const durationSeconds = parseDuration(call.callDuration);
          return durationSeconds >= 120;
        }).length;
        const completionRate = Math.round((completed / totalCalls) * 100);
        
        return {
          office,
          totalCalls,
          completedCalls: completed,
          completionRate
        };
      }).sort((a, b) => b.totalCalls - a.totalCalls);

      // Call status distribution
      const statusCounts = allCalls.reduce((acc, call) => {
        acc[call.status] = (acc[call.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const callStatus = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count,
        percentage: Math.round((count / totalCalls) * 100)
      }));

      // Transcription quality metrics
      const withTranscription = allCalls.filter(call => call.transcriptionText && call.transcriptionText.trim().length > 0).length;
      const withoutTranscription = totalCalls - withTranscription;
      const spanishCalls = allCalls.filter(call => 
        call.transcriptionText && (
          call.transcriptionText.includes('Spanish detected') ||
          call.transcriptionText.includes('Español detectado')
        )
      ).length;

      const response = {
        overview: {
          totalCalls,
          completedCalls,
          completionRate,
          avgCallDuration,
          topAgent,
          topOffice
        },
        trends,
        agentPerformance,
        officePerformance,
        callStatus,
        transcriptionQuality: {
          withTranscription,
          withoutTranscription,
          spanishCalls,
          averageCallLength: Math.round(avgDurationSeconds)
        }
      };

      res.json(response);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });

  // Helper functions for duration parsing and formatting
  function parseDuration(duration: string): number {
    if (!duration) return 0;
    
    // Handle formats like "00:02:30" (HH:MM:SS) or "03:23" (MM:SS)
    const parts = duration.split(':');
    if (parts.length === 3) {
      return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    } else if (parts.length === 2) {
      // For MM:SS format, first part is minutes, second is seconds
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else {
      return parseInt(duration) || 0;
    }
  }

  function formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}:${minutes.toString().padStart(2, '0')}:00`;
    }
  }

  // API routes for the CRM
  app.get("/api/calls", async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit) || 10;
      const offset = Number(req.query.offset) || 0;
      
      // Parse sorting parameters
      const sortOptions = {
        column: (req.query.sortBy as string) || 'callDate',
        direction: (req.query.sortDirection as 'asc' | 'desc') || 'desc'
      };
      
      // Parse filter parameters
      const filters: CallFilters = {};
      
      // Apply office-based access control
      if (req.user) {
        const user = req.user;
        console.log("User access control check:", {
          username: user.username,
          role: user.role,
          office: user.office
        });
        // Only SUPER_ADMIN can see all offices; all other users see only their assigned office
        if (user.role !== 'SUPER_ADMIN' && user.office) {
          filters.office = user.office;
          console.log("Applied office filter:", filters.office);
        }
      }
      
      if (req.query.search) filters.search = req.query.search as string;
      if (req.query.phoneSearch) filters.phoneSearch = req.query.phoneSearch as string;
      if (req.query.agentSearch) filters.agentSearch = req.query.agentSearch as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.dateRange) filters.dateRange = req.query.dateRange as string;
      if (req.query.agent) filters.agent = req.query.agent as string;
      if (req.query.premiumMin) filters.premiumMin = parseFloat(req.query.premiumMin as string);
      if (req.query.premiumMax) filters.premiumMax = parseFloat(req.query.premiumMax as string);
      if (req.query.isFlagged) filters.isFlagged = req.query.isFlagged === 'true';
      
      // Allow admin users to filter by office
      if (req.query.office && req.user && (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ADMIN')) {
        filters.office = req.query.office as string;
      }
      
      // Get calls with pagination, filters, and sorting
      console.log("Final filters being applied:", JSON.stringify(filters, null, 2));
      const calls = await storage.getCalls(limit, offset, filters, sortOptions);
      const total = await storage.getTotalCalls(filters);
      console.log(`Found ${calls.length} calls out of ${total} total for user ${req.user?.username}`);
      
      res.json({ calls, total, limit, offset });
    } catch (error) {
      console.error("Error fetching calls:", error);
      res.status(500).json({ message: "Failed to fetch calls" });
    }
  });

  app.get("/api/calls/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const call = await storage.getCallById(id);
      
      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }
      
      res.json(call);
    } catch (error) {
      console.error("Error fetching call:", error);
      res.status(500).json({ message: "Failed to fetch call" });
    }
  });

  app.post("/api/calls", async (req: Request, res: Response) => {
    try {
      const validatedData = insertCallSchema.parse(req.body);
      
      // Check for duplicate HPPRO ID if provided
      if (validatedData.hpproId) {
        const existingCall = await storage.getCallByHpproId(validatedData.hpproId);
        if (existingCall) {
          return res.status(409).json({ 
            message: "Duplicate HPPRO ID", 
            error: `A call with HPPRO ID '${validatedData.hpproId}' already exists` 
          });
        }
      }
      
      const call = await storage.createCall(validatedData);
      
      res.status(201).json(call);
    } catch (error) {
      console.error("Error creating call:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid call data", errors: error.errors });
      }
      // Handle database unique constraint errors
      if (error.message && error.message.includes('duplicate key value violates unique constraint')) {
        if (error.message.includes('hppro_id')) {
          return res.status(409).json({ 
            message: "Duplicate HPPRO ID", 
            error: "A call with this HPPRO ID already exists" 
          });
        }
      }
      res.status(500).json({ message: "Failed to create call" });
    }
  });

  app.patch("/api/calls/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      // Partial validation of the update data
      const schema = insertCallSchema.partial();
      const validatedData = schema.parse(req.body);
      
      // Check for duplicate HPPRO ID if being updated
      if (validatedData.hpproId) {
        const existingCall = await storage.getCallByHpproId(validatedData.hpproId);
        if (existingCall && existingCall.id !== id) {
          return res.status(409).json({ 
            message: "Duplicate HPPRO ID", 
            error: `A call with HPPRO ID '${validatedData.hpproId}' already exists` 
          });
        }
      }
      
      const updatedCall = await storage.updateCall(id, validatedData);
      
      if (!updatedCall) {
        return res.status(404).json({ message: "Call not found" });
      }
      
      res.json(updatedCall);
    } catch (error) {
      console.error("Error updating call:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid call data", errors: error.errors });
      }
      // Handle database unique constraint errors
      if (error.message && error.message.includes('duplicate key value violates unique constraint')) {
        if (error.message.includes('hppro_id')) {
          return res.status(409).json({ 
            message: "Duplicate HPPRO ID", 
            error: "A call with this HPPRO ID already exists" 
          });
        }
      }
      res.status(500).json({ message: "Failed to update call" });
    }
  });

  app.delete("/api/calls/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteCall(id);
      
      if (!success) {
        return res.status(404).json({ message: "Call not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting call:", error);
      res.status(500).json({ message: "Failed to delete call" });
    }
  });

  // Team management routes
  app.get("/api/teams", async (req: Request, res: Response) => {
    try {
      const teams = await storage.getAllTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ message: "Failed to fetch teams" });
    }
  });

  app.get("/api/teams/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid team ID" });
      }
      
      const team = await storage.getTeam(id);
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      res.json(team);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ message: "Failed to fetch team" });
    }
  });

  app.post("/api/teams", async (req: Request, res: Response) => {
    try {
      const validatedData = insertTeamSchema.parse(req.body);
      const team = await storage.createTeam(validatedData);
      res.status(201).json(team);
    } catch (error) {
      console.error("Error creating team:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid team data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create team" });
    }
  });

  app.patch("/api/teams/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid team ID" });
      }
      
      // Partial validation of the update data
      const schema = insertTeamSchema.partial();
      const validatedData = schema.parse(req.body);
      
      const updatedTeam = await storage.updateTeam(id, validatedData);
      
      if (!updatedTeam) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      res.json(updatedTeam);
    } catch (error) {
      console.error("Error updating team:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid team data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update team" });
    }
  });

  app.delete("/api/teams/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid team ID" });
      }
      
      const success = await storage.deleteTeam(id);
      
      if (!success) {
        return res.status(404).json({ message: "Team not found or couldn't be deleted" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(500).json({ message: "Failed to delete team" });
    }
  });

  // Team hierarchy endpoints
  app.get("/api/teams/:id/hierarchy", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid team ID" });
      }
      
      const teamHierarchy = await storage.getTeamHierarchy(id);
      res.json(teamHierarchy);
    } catch (error) {
      console.error("Error fetching team hierarchy:", error);
      res.status(500).json({ message: "Failed to fetch team hierarchy" });
    }
  });

  app.get("/api/teams/:id/members", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid team ID" });
      }
      
      const members = await storage.getUsersByTeam(id);
      res.json(members);
    } catch (error) {
      console.error("Error fetching team members:", error);
      res.status(500).json({ message: "Failed to fetch team members" });
    }
  });

  // User management routes
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      
      // Remove passwords from the response
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(validatedData);
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Error creating user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Partial validation of the update data
      const schema = insertUserSchema.partial();
      const validatedData = schema.parse(req.body);
      
      const updatedUser = await storage.updateUser(id, validatedData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const success = await storage.deleteUser(id);
      
      if (!success) {
        return res.status(404).json({ message: "User not found or couldn't be deleted" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Team membership routes
  app.post("/api/users/:userId/teams/:teamId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const teamId = parseInt(req.params.teamId);
      
      if (isNaN(userId) || isNaN(teamId)) {
        return res.status(400).json({ message: "Invalid user ID or team ID" });
      }
      
      const userTeam = await storage.addUserToTeam(userId, teamId);
      res.status(201).json(userTeam);
    } catch (error) {
      console.error("Error adding user to team:", error);
      res.status(500).json({ message: "Failed to add user to team" });
    }
  });

  app.delete("/api/users/:userId/teams/:teamId", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      const teamId = parseInt(req.params.teamId);
      
      if (isNaN(userId) || isNaN(teamId)) {
        return res.status(400).json({ message: "Invalid user ID or team ID" });
      }
      
      const success = await storage.removeUserFromTeam(userId, teamId);
      
      if (!success) {
        return res.status(404).json({ message: "User-team relationship not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error removing user from team:", error);
      res.status(500).json({ message: "Failed to remove user from team" });
    }
  });

  app.get("/api/users/:userId/teams", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const teams = await storage.getUserTeams(userId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching user teams:", error);
      res.status(500).json({ message: "Failed to fetch user teams" });
    }
  });

  // User-based call access endpoints
  app.get("/api/users/:userId/accessible-calls", async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Parse sorting parameters
      const sortOptions = {
        column: (req.query.sortBy as string) || 'callDate',
        direction: (req.query.sortDirection as 'asc' | 'desc') || 'desc'
      };
      
      const filters: CallFilters = {};
      
      if (req.query.search) filters.search = req.query.search as string;
      if (req.query.phoneSearch) filters.phoneSearch = req.query.phoneSearch as string;
      if (req.query.agentSearch) filters.agentSearch = req.query.agentSearch as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.dateRange) filters.dateRange = req.query.dateRange as string;
      if (req.query.agent) filters.agent = req.query.agent as string;
      if (req.query.isFlagged !== undefined) filters.isFlagged = req.query.isFlagged === 'true';
      if (req.query.premiumMin) filters.premiumMin = parseFloat(req.query.premiumMin as string);
      if (req.query.premiumMax) filters.premiumMax = parseFloat(req.query.premiumMax as string);
      
      const calls = await storage.getAccessibleCallsForUser(userId, limit, offset, filters, sortOptions);
      const total = await storage.getTotalAccessibleCallsForUser(userId, filters);
      
      res.json({
        calls,
        total,
        limit,
        offset,
      });
    } catch (error) {
      console.error("Error fetching accessible calls:", error);
      res.status(500).json({ message: "Failed to fetch accessible calls" });
    }
  });

  // Office management endpoints
  app.get("/api/offices", async (req: Request, res: Response) => {
    try {
      const offices = await storage.getAllOffices();
      res.json(offices);
    } catch (error) {
      console.error("Error fetching offices:", error);
      res.status(500).json({ message: "Failed to fetch offices" });
    }
  });

  app.post("/api/offices", async (req: Request, res: Response) => {
    try {
      const { name, region, managerId } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Office name is required" });
      }
      
      const office = await storage.createOffice({ name, region, managerId });
      res.status(201).json(office);
    } catch (error) {
      console.error("Error creating office:", error);
      res.status(500).json({ message: "Failed to create office" });
    }
  });

  // User Invitation endpoint with office support
  app.post("/api/invitations", async (req: Request, res: Response) => {
    try {
      // Validate request body
      const invitationSchema = z.object({
        inviterId: z.number(),
        email: z.string().email(),
        role: z.string(),
        office: z.string(),
        teamId: z.number().optional()
      });
      
      const { inviterId, email, role, office, teamId } = invitationSchema.parse(req.body);
      
      // Get the inviter and team
      const inviter = await storage.getUser(inviterId);
      const team = await storage.getTeam(teamId);
      
      if (!inviter) {
        return res.status(404).json({ message: "Inviter not found" });
      }
      
      if (!team) {
        return res.status(404).json({ message: "Team not found" });
      }
      
      // Send the invitation email
      const success = await sendInvitationEmail(inviter, email, role, team);
      
      if (!success) {
        return res.status(500).json({ message: "Failed to send invitation email" });
      }
      
      res.status(200).json({ 
        message: "Invitation sent successfully",
        email,
        role,
        teamName: team.name
      });
    } catch (error) {
      console.error("Error sending invitation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid invitation data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });
  
  // Direct user creation endpoint (for testing/development)
  app.post("/api/users/direct", async (req: Request, res: Response) => {
    try {
      // Create a schema for direct user creation with default password
      const directUserSchema = z.object({
        username: z.string().optional(),
        fullName: z.string(),
        email: z.string().email(),
        password: z.string().optional(),
        associateId: z.string().optional(),
        office: z.string().nullable().optional(),
        role: z.enum(["SUPER_ADMIN", "ADMIN", "QUALITY_MANAGER", "PARTNER", "RGA", "MGA", "GA", "SA", "AGENT"]),
        teamId: z.number().nullable().optional(),
        managerId: z.number().nullable().optional()
      });
      
      const userData = directUserSchema.parse(req.body);
      const { fullName, email, role, teamId, managerId, username: providedUsername, associateId, office, password: providedPassword } = userData;
      
      // Check if user with email already exists
      const existingUserByEmail = await storage.getUserByEmail(email);
      
      if (existingUserByEmail) {
        return res.status(400).json({ 
          message: "User already exists", 
          details: "A user with this email already exists" 
        });
      }
      
      // Get the team if teamId is provided (to ensure it exists)
      let team;
      if (teamId) {
        team = await storage.getTeam(teamId);
        if (!team) {
          return res.status(404).json({ message: "Team not found" });
        }
      }
      
      // Use provided password or default
      const defaultPassword = "password";
      const plainPassword = providedPassword || defaultPassword;
      
      // Hash the password before storing
      const hashedPassword = await hashPassword(plainPassword);
      
      // Generate username from email (remove spaces and special characters) or use provided username
      const username = providedUsername || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Create user with provided details
      const newUser = await storage.createUser({
        username,
        fullName,
        email,
        password: hashedPassword,
        associateId,
        office,
        role: role as any, // Type casting due to string role
        teamId,
        managerId: managerId || (team ? team.managerId : null)
      });
      
      // Remove password from response for security
      const { password: _password, ...userWithoutPassword } = newUser;
      
      res.status(201).json({
        message: "User created successfully",
        user: userWithoutPassword
      });
    } catch (error) {
      console.error("Error creating user directly:", error);
      console.error("Request body was:", JSON.stringify(req.body, null, 2));
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid user data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Call sync routes
  app.post("/api/sync/calls", async (req: Request, res: Response) => {
    try {
      const { callSyncService } = await import('./services/callSyncService');
      const result = await callSyncService.pullFromSupabase();
      
      res.status(200).json({
        message: `Call sync completed. Synced: ${result.synced}, Errors: ${result.errors}`,
        result
      });
    } catch (error) {
      console.error('Error syncing calls:', error);
      res.status(500).json({ message: 'Failed to sync calls', error: String(error) });
    }
  });

  app.post("/api/sync/calls/:id", async (req: Request, res: Response) => {
    try {
      const callId = parseInt(req.params.id);
      if (isNaN(callId)) {
        return res.status(400).json({ message: 'Invalid call ID' });
      }
      
      const call = await storage.getCallById(callId);
      if (!call) {
        return res.status(404).json({ message: 'Call not found' });
      }
      
      const { callSyncService } = await import('./services/callSyncService');
      const success = await callSyncService.pushCallToSupabase(call);
      
      if (success) {
        res.status(200).json({ message: 'Call synced successfully', call });
      } else {
        res.status(500).json({ message: 'Failed to sync call to Supabase' });
      }
    } catch (error) {
      console.error('Error syncing single call:', error);
      res.status(500).json({ message: 'Failed to sync call', error: String(error) });
    }
  });

  app.post("/api/sync/create-ttaalk-raw-table", async (_req: Request, res: Response) => {
    try {
      // Use direct SQL to create the ttaalk_raw_data table
      const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ttaalk_raw_data (
        id SERIAL PRIMARY KEY,
        recording_id TEXT NOT NULL UNIQUE,
        date_recorded TEXT NOT NULL,
        time_recorded TEXT NOT NULL,
        phone TEXT NOT NULL,
        name TEXT,
        duration TEXT,
        voicemail TEXT,
        picked_by TEXT,
        sms TEXT,
        clicked TEXT,
        transferred TEXT,
        duration_after_transfer TEXT,
        transfer_delay TEXT,
        transfer_status TEXT,
        persona TEXT,
        client_first_name TEXT,
        agent_last_name TEXT,
        monthly_premium TEXT,
        agent_first_name TEXT,
        client_home_phone TEXT,
        recording_url TEXT,
        processed BOOLEAN NOT NULL DEFAULT FALSE,
        taalkuid TEXT,
        imported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        processed_at TIMESTAMP WITH TIME ZONE,
        notes TEXT
      )`;
      
      // Execute SQL to create the table
      await sql.raw(createTableSQL).execute(storage.db);
      
      // Insert a test record to verify it's working
      const { db } = await import('./db');
      const { ttaalkRawData } = await import('@shared/schema');
      
      const [result] = await db.insert(ttaalkRawData).values({
        recordingId: `setup-record-${Date.now()}`,
        dateRecorded: '05/03/2025',
        timeRecorded: '12:00:00',
        phone: '555-555-5555',
        name: 'Setup Record',
        processed: true,
        taalkUID: `SETUP-${Date.now()}`,
        notes: 'Created via API'
      }).returning({ id: ttaalkRawData.id });
      
      res.status(200).json({
        success: true,
        message: 'TTaalk raw data table created successfully',
        recordId: result.id
      });
    } catch (error) {
      console.error('Error creating TTaalk raw data table:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating TTaalk raw data table',
        error: String(error)
      });
    }
  });
  
  app.get("/api/ttaalk-raw-data", async (req: Request, res: Response) => {
    try {
      // Pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = (page - 1) * limit;
      
      // Import the db directly for more complex queries
      const { db } = await import('./db');
      const { ttaalkRawData } = await import('@shared/schema');
      
      // Query the data with pagination
      const data = await db.select().from(ttaalkRawData).limit(limit).offset(offset);
      
      // Count total records
      const [countResult] = await db.select({ 
        count: sql`count(*)` 
      }).from(ttaalkRawData);
      
      res.status(200).json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total: Number(count),
          pages: Math.ceil(Number(count) / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching TTaalk raw data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch TTaalk raw data',
        error: String(error)
      });
    }
  });
  
  // Webhook endpoint to receive direct call data
  app.post("/api/webhook/call", async (req: Request, res: Response) => {
    try {
      // Verify security token if provided
      const apiKey = req.headers['x-api-key'] || req.query.apiKey;
      const webhookSecret = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
      
      if (apiKey && apiKey !== webhookSecret) {
        return res.status(401).json({
          success: false,
          message: 'Invalid API key'
        });
      }
      
      // Import call webhook service
      const { processCallWebhook, processBatchCallWebhook } = await import('./services/callWebhookService');
      let result;
      
      // Check if this is a single call record or an array of records
      if (Array.isArray(req.body)) {
        console.log(`Webhook received array of ${req.body.length} call records`);
        result = await processBatchCallWebhook(req.body, 'direct-webhook-batch');
      } else if (req.body && typeof req.body === 'object') {
        console.log('Webhook received single call record');
        result = await processCallWebhook(req.body, 'direct-webhook-single');
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid request format. Expected a call record object or array of objects'
        });
      }
      
      res.status(200).json({
        success: true,
        message: `Call webhook processed successfully`,
        processed: result.processed,
        errors: result.errors.length > 0 ? result.errors : []
      });
    } catch (error) {
      console.error('Error processing call webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process call webhook',
        error: String(error)
      });
    }
  });
  
  // Webhook endpoint to receive CSV data (keep for backward compatibility)
  app.post("/api/webhook/csv", async (req: Request, res: Response) => {
    try {
      // Verify security token if provided
      const apiKey = req.headers['x-api-key'] || req.query.apiKey;
      const webhookSecret = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
      
      if (apiKey && apiKey !== webhookSecret) {
        return res.status(401).json({
          success: false,
          message: 'Invalid API key'
        });
      }
      
      let csvData: string;
      
      // Check if this is a file upload
      if (req.files && req.files.csvFile) {
        const csvFile = req.files.csvFile as UploadedFile;
        csvData = csvFile.data.toString('utf8');
        console.log(`Webhook received CSV file upload: ${csvFile.name}, size: ${csvFile.size} bytes`);
      } 
      // Check if this is JSON with a csv field
      else if (req.body && req.body.csv) {
        csvData = req.body.csv;
        console.log('Webhook received CSV data in request body');
      } 
      // Or if it's raw CSV content in the body as string
      else if (typeof req.body === 'string' && req.body.trim().includes(',')) {
        csvData = req.body;
        console.log('Webhook received raw CSV data in body');
      }
      // Handle raw CSV when content-type is text/csv
      else if (req.headers['content-type']?.includes('text/csv') && req.body) {
        // For text/csv content type, Express might not parse the body automatically
        // Buffer from raw request
        let rawBody = '';
        req.on('data', (chunk) => { rawBody += chunk.toString(); });
        
        // Process when request is fully received
        await new Promise<void>((resolve) => {
          req.on('end', () => {
            csvData = rawBody;
            console.log('Webhook received raw CSV data with text/csv content type');
            resolve();
          });
        });

        if (!csvData || !csvData.trim()) {
          return res.status(400).json({
            success: false,
            message: 'Empty CSV data received'
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'No CSV data found in request'
        });
      }
      
      // Import and use the webhook service
      const { processCsvWebhook } = await import('./services/webhookService');
      const result = await processCsvWebhook(csvData, 'webhook-endpoint');
      
      res.status(200).json({
        success: true,
        message: `CSV webhook processed successfully`,
        processed: result.processed,
        errors: result.errors.length > 0 ? result.errors : []
      });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook',
        error: String(error)
      });
    }
  });
  
  app.get("/api/sync/status", async (_req: Request, res: Response) => {
    try {
      const { testSupabaseConnection, checkSupabaseTables } = await import('./supabase');
      const isConnected = await testSupabaseConnection();
      const tableStatus = isConnected ? await checkSupabaseTables() : {};
      
      res.status(200).json({ 
        connected: isConnected,
        tables: tableStatus,
        message: isConnected ? 'Connected to Supabase' : 'Not connected to Supabase'
      });
    } catch (error) {
      console.error('Error checking Supabase connection:', error);
      res.status(500).json({ 
        connected: false, 
        tables: {},
        message: 'Error checking Supabase connection',
        error: String(error)
      });
    }
  });
  
  app.post("/api/sync/import-ttaalk", async (req: Request, res: Response) => {
    try {
      // Check if it's a multipart form with a file
      if (!req.files || !req.files.csvFile) {
        return res.status(400).json({
          success: false,
          message: 'No CSV file uploaded'
        });
      }
      
      const csvFile = req.files.csvFile as UploadedFile | UploadedFile[];
      // Default to false for Supabase sync since we're having permission issues
      const syncToSupabase = req.body.syncToSupabase === 'true' && process.env.SYNC_TTAALK_TO_SUPABASE === 'true';
      
      if (Array.isArray(csvFile)) {
        return res.status(400).json({
          success: false,
          message: 'Please upload only one file'
        });
      }
      
      // Log information about the upload
      console.log(`Processing TTaalk CSV file: ${csvFile.name}, size: ${csvFile.size} bytes`);
      console.log(`Supabase sync enabled: ${syncToSupabase}`);
      
      // Process the file
      const { processUploadedTaalkCSV } = await import('./services/taalkImportService');
      const result = await processUploadedTaalkCSV(
        csvFile.data,
        csvFile.name,
        syncToSupabase
      );
      
      // Start background recording downloads for imported calls
      if (result.imported > 0) {
        console.log(`Starting background download of recordings for ${result.imported} imported calls`);
        // Get all calls imported in the last 5 minutes to cache their recordings
        const recentCalls = await storage.getCalls(1000, 0, {}, { column: 'createdAt', direction: 'desc' });
        const taalkUIDs = recentCalls
          .filter(call => call.taalkUID && call.recordingUrl && 
                  call.createdAt && new Date(call.createdAt).getTime() > Date.now() - 5 * 60 * 1000)
          .map(call => call.taalkUID);
        
        if (taalkUIDs.length > 0) {
          recordingCache.preloadRecordingsForCalls(taalkUIDs).catch(error => {
            console.error('Error preloading recordings from CSV import:', error);
          });
        }
      }
      
      res.status(200).json({
        success: true,
        message: `TTaalk CSV import completed. Imported: ${result.imported}, Synced: ${result.synced}, Errors: ${result.errors.length}`,
        result
      });
    } catch (error) {
      console.error('Error importing TTaalk CSV:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to import TTaalk CSV',
        error: String(error)
      });
    }
  });
  
  app.post("/api/sync/setup-tables", async (req: Request, res: Response) => {
    try {
      // Read the SQL file content
      const sqlFilePath = './supabase-schema.sql';
      const fs = require('fs');
      if (!fs.existsSync(sqlFilePath)) {
        return res.status(404).json({ 
          success: false, 
          message: 'SQL schema file not found'
        });
      }
      
      const schemaSql = fs.readFileSync(sqlFilePath, 'utf8');
      
      // Split the SQL into separate statements
      const statements = schemaSql
        .replace(/--.*\n/g, '') // Remove comments
        .split(';')
        .filter((stmt: string) => stmt.trim().length > 0); // Remove empty statements
      
      // Import supabase client and helper functions
      const { supabase, saveTTaalkRawDataToSupabase } = await import('./supabase');
      
      // Execute each statement using Supabase function
      const results = [];
      let successCount = 0;
      let errorCount = 0;
      
      // Create the ttaalk_raw_data table specifically using the helper function
      try {
        console.log('Attempting to create ttaalk_raw_data table...');
        const ttaalkResult = await saveTTaalkRawDataToSupabase({
          recording_id: `setup-record-${Date.now()}`,
          date_recorded: '05/03/2025',
          time_recorded: '12:00:00',
          phone: '555-555-5555',
          name: 'Setup Record',
          processed: true,
          taalkuid: `SETUP-${Date.now()}`,
          imported_at: new Date().toISOString()
        });
        
        if (ttaalkResult) {
          console.log('Successfully created ttaalk_raw_data table!');
          results.push({ 
            success: true, 
            table: 'ttaalk_raw_data', 
            message: 'Table created successfully'
          });
          successCount++;
        } else {
          console.error('Failed to create ttaalk_raw_data table');
          results.push({ 
            success: false, 
            table: 'ttaalk_raw_data', 
            message: 'Failed to create table'
          });
          errorCount++;
        }
      } catch (ttaalkError) {
        console.error('Error creating ttaalk_raw_data table:', ttaalkError);
        results.push({ 
          success: false, 
          table: 'ttaalk_raw_data', 
          message: `Error: ${String(ttaalkError)}`
        });
        errorCount++;
      }
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i].trim();
        
        try {
          // Use Supabase's PostgreSQL function to execute raw SQL
          const { error } = await supabase.rpc('exec_sql', { query: statement });
          
          if (error) {
            results.push({
              index: i,
              status: 'error',
              message: error.message
            });
            errorCount++;
          } else {
            results.push({
              index: i,
              status: 'success'
            });
            successCount++;
          }
        } catch (err: any) {
          results.push({
            index: i,
            status: 'error',
            message: err.message || String(err)
          });
          errorCount++;
        }
      }
      
      // Return the results
      res.status(errorCount > 0 ? 207 : 200).json({
        success: errorCount === 0,
        total: statements.length,
        successful: successCount,
        failed: errorCount,
        results
      });
    } catch (error) {
      console.error('Error setting up Supabase tables:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error setting up Supabase tables',
        error: String(error)
      });
    }
  });
  
  // Audio proxy route to bypass CORS
  // Download recording API endpoint - fetches and stores recordings locally
  app.all("/api/recordings/download/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      const recordingId = req.params.id;
      
      // Validate recordingId
      if (!recordingId || recordingId.length < 10) {
        return res.status(400).json({ message: 'Invalid recording ID' });
      }
      
      console.log(`Download request for recording ID: ${recordingId}`);
      
      // Look up the call in our database first
      const call = await storage.getCallByTaalkUID(recordingId);
      
      if (!call) {
        return res.status(404).json({
          message: 'Call not found',
          code: 'CALL_NOT_FOUND'
        });
      }
      
      // Check if user has permission to access this call
      const canAccess = await storage.canUserAccessCall(req.user.id, call.id);
      if (!canAccess) {
        return res.status(403).json({
          message: 'Access denied to this recording',
          code: 'ACCESS_DENIED'
        });
      }
      
      // Default database is michaelmandella
      const dbName = req.query.db?.toString() || 'michaelmandella';
      
      // Check if already downloaded
      if (isRecordingDownloaded(recordingId)) {
        console.log(`Recording ${recordingId} already downloaded`);
        const publicUrl = getRecordingPublicUrl(recordingId);
        
        return res.status(200).json({ 
          url: publicUrl, 
          status: 'success',
          message: 'Recording already downloaded'
        });
      }
      
      // Use the TaalkApiService to download the recording
      const publicUrl = await downloadRecording(recordingId, dbName);
      
      if (!publicUrl) {
        return res.status(502).json({ 
          message: "Failed to download recording from TaalkAI", 
          code: 'DOWNLOAD_FAILED'
        });
      }
      
      // Update the call record with the new URL if needed
      if (call.recordingUrl !== publicUrl) {
        await storage.updateCall(call.id, { recordingUrl: publicUrl });
      }
      
      // Return the public URL of the downloaded recording
      res.status(200).json({ 
        url: publicUrl, 
        status: 'success',
        message: 'Recording downloaded successfully'
      });
    } catch (error) {
      console.error("Error downloading recording:", error);
      res.status(500).json({ 
        message: "Failed to download recording", 
        code: 'DOWNLOAD_ERROR',
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });
  
  // Static files are handled by express.static middleware on line ~20
  
  // Helper functions for downloaded recordings
  function isRecordingDownloaded(taalkUID: string): boolean {
    const publicPath = path.resolve('public');
    const filePath = path.join(publicPath, 'recordings', `${taalkUID}.mp3`);
    return fs.existsSync(filePath);
  }
  
  function getRecordingPublicUrl(taalkUID: string): string {
    return `/recordings/${taalkUID}`;
  }

  // New function to download and store recording locally
  async function downloadAndStoreRecording(taalkUID: string): Promise<string | null> {
    try {
      console.log(`Starting local download for recording: ${taalkUID}`);
      
      // Get the call to find the original recording URL
      const call = await storage.getCallByTaalkUID(taalkUID);
      if (!call || !call.recordingUrl) {
        console.log(`No call found or no recording URL for ${taalkUID}`);
        return null;
      }

      const fs = await import('fs');
      const path = await import('path');
      
      // Create recordings directory if it doesn't exist
      const recordingsDir = path.resolve('public/recordings');
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }
      
      const localPath = path.join(recordingsDir, `${taalkUID}.mp3`);
      
      // Use the updated API key for authentication
      const apiKey = process.env.TAALK_API_KEY;
      if (!apiKey) {
        console.error('TAALK_API_KEY not found in environment');
        return null;
      }
      
      // Download the recording from the original URL with proper authentication
      const response = await fetch(call.recordingUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'audio/mpeg, audio/mp3, audio/*, */*'
        }
      });
      
      if (!response.ok) {
        console.log(`Failed to fetch recording from ${call.recordingUrl}: ${response.status}`);
        return null;
      }
      
      // Save to local file
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(localPath, Buffer.from(buffer));
      
      console.log(`Successfully saved recording to ${localPath}`);
      return localPath;
    } catch (error) {
      console.error(`Error downloading recording ${taalkUID}:`, error);
      return null;
    }
  }

  // Route to serve local MP3 files
  app.get("/api/recordings/local/:filename", async (req: Request, res: Response) => {
    try {
      const filename = req.params.filename;
      const taalkUID = filename.replace('.mp3', '');
      
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if user has access to this recording
      const call = await storage.getCallByTaalkUID(taalkUID);
      if (!call) {
        return res.status(404).json({ message: "Recording not found" });
      }

      const canAccess = await storage.canUserAccessCall(req.user.id, call.id);
      if (!canAccess) {
        return res.status(403).json({ message: "Access denied to this recording" });
      }

      const fs = await import('fs');
      const path = await import('path');
      const localPath = path.resolve('public/recordings', filename);
      
      // Check if file exists locally
      if (!fs.existsSync(localPath)) {
        // Try to download it
        await downloadAndStoreRecording(taalkUID);
        
        // Check again
        if (!fs.existsSync(localPath)) {
          return res.status(404).json({ message: "Recording file not available" });
        }
      }
      
      // Serve the file
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      
      const fileStream = fs.createReadStream(localPath);
      fileStream.pipe(res);
      
    } catch (error) {
      console.error("Error serving local recording:", error);
      res.status(500).json({ message: "Error serving recording" });
    }
  });
  
  async function downloadRecording(taalkUID: string, dbName: string): Promise<string | null> {
    try {
      const { createJWT } = await import('./services/taalkApiKeyService');
      const jwt = await createJWT();
      
      if (!jwt) {
        console.error(`Failed to create JWT token for taalkUID ${taalkUID}`);
        return null;
      }
      
      // TaalkAI API URL for the recording
      const apiUrl = `https://api.taalk.ai/api/calls/${taalkUID}/recording?db=${dbName}`;
      const publicPath = path.resolve('public');
      const outputPath = path.join(publicPath, 'recordings', `${taalkUID}.mp3`);
      
      // Create the directory if it doesn't exist
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Make API request with authentication
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`
        }
      });
      
      // Check if request was successful
      if (!response.ok) {
        console.error(`Failed to download recording ${taalkUID}: ${response.status} ${response.statusText}`);
        return null;
      }
      
      // Save recording to file
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(outputPath, Buffer.from(buffer));
      console.log(`Successfully downloaded: ${taalkUID}.mp3`);
      
      return getRecordingPublicUrl(taalkUID);
    } catch (error) {
      console.error(`Error downloading recording ${taalkUID}:`, error);
      return null;
    }
  }

  // Transcription endpoints
  app.post("/api/transcribe/:id", async (req: Request, res: Response) => {
    try {
      // Temporarily disable authentication for complete audio retranscription
      // if (!req.isAuthenticated() && !req.headers['x-internal-batch']) {
      //   return res.status(401).json({
      //     message: 'Authentication required',
      //     code: 'AUTH_REQUIRED'
      //   });
      // }
      
      const taalkUID = req.params.id;
      
      // Check if user has access to this call (skip for internal batch processing)
      const call = await storage.getCallByTaalkUID(taalkUID);
      if (!call) {
        return res.status(404).json({ message: "Call not found" });
      }
      
      if (req.isAuthenticated()) {
        const canAccess = await storage.canUserAccessCall(req.user.id, call.id);
        if (!canAccess) {
          return res.status(403).json({ message: "Access denied to this recording" });
        }
      }
      
      // Import transcription service
      const { transcribeCallRecording } = await import('./services/transcriptionService');
      
      // Perform transcription
      const transcriptionText = await transcribeCallRecording(taalkUID, storage);
      
      if (!transcriptionText) {
        return res.status(500).json({ 
          message: "Failed to transcribe recording",
          code: 'TRANSCRIPTION_FAILED'
        });
      }
      
      res.status(200).json({
        success: true,
        taalkUID,
        transcription: transcriptionText,
        message: 'Transcription completed successfully'
      });
    } catch (error) {
      console.error("Error in transcription endpoint:", error);
      res.status(500).json({
        message: "Internal server error during transcription",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Batch transcription endpoint
  app.post("/api/transcribe/batch", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      const { taalkUIDs } = req.body;
      
      if (!Array.isArray(taalkUIDs) || taalkUIDs.length === 0) {
        return res.status(400).json({
          message: 'Invalid request: taalkUIDs array required'
        });
      }
      
      // Verify access to all calls
      for (const taalkUID of taalkUIDs) {
        const call = await storage.getCallByTaalkUID(taalkUID);
        if (!call) {
          return res.status(404).json({ message: `Call not found: ${taalkUID}` });
        }
        
        const canAccess = await storage.canUserAccessCall(req.user.id, call.id);
        if (!canAccess) {
          return res.status(403).json({ message: `Access denied to call: ${taalkUID}` });
        }
      }
      
      // Import transcription service
      const { batchTranscribeRecordings } = await import('./services/transcriptionService');
      
      // Perform batch transcription
      const results = await batchTranscribeRecordings(taalkUIDs, storage);
      
      res.status(200).json({
        success: true,
        summary: {
          total: taalkUIDs.length,
          successful: results.successful,
          failed: results.failed,
          skipped: results.skipped
        },
        results: results.results,
        message: `Batch transcription completed: ${results.successful} successful, ${results.failed} failed, ${results.skipped} skipped`
      });
    } catch (error) {
      console.error("Error in batch transcription endpoint:", error);
      res.status(500).json({
        message: "Internal server error during batch transcription",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Auto-transcribe all calls with recordings
  app.post("/api/transcribe/auto-all", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      // Get all calls that have recording URLs but no transcription
      const calls = await storage.getCalls({}, 1, 1000); // Get up to 1000 calls
      const callsWithRecordings = calls.calls.filter(call => 
        call.recordingUrl && 
        (!call.transcriptionText || call.transcriptionText.length < 10)
      );
      
      if (callsWithRecordings.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No calls found that need transcription',
          summary: { total: 0, successful: 0, failed: 0, skipped: 0 }
        });
      }
      
      const taalkUIDs = callsWithRecordings.map(call => call.taalkUID);
      
      // Import transcription service
      const { batchTranscribeRecordings } = await import('./services/transcriptionService');
      
      // Start transcription in background
      batchTranscribeRecordings(taalkUIDs, storage).catch(error => {
        console.error('Background transcription error:', error);
      });
      
      res.status(200).json({
        success: true,
        message: `Started automatic transcription for ${taalkUIDs.length} calls`,
        callsToProcess: taalkUIDs.length
      });
      
    } catch (error) {
      console.error("Error in auto-transcribe endpoint:", error);
      res.status(500).json({
        message: "Internal server error during auto-transcription",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.all("/api/proxy/recording/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({
          message: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      const recordingId = req.params.id;
      
      // Look up the call in our database first to get the correct recording URL
      const call = await storage.getCallByTaalkUID(recordingId);
      
      if (!call || !call.recordingUrl) {
        return res.status(404).json({
          message: 'Recording not found',
          code: 'RECORDING_NOT_FOUND'
        });
      }
      
      // Check if user has permission to access this call
      const canAccess = await storage.canUserAccessCall(req.user.id, call.id);
      if (!canAccess) {
        return res.status(403).json({
          message: 'Access denied to this recording',
          code: 'ACCESS_DENIED'
        });
      }
      
      // Check if already downloaded
      if (isRecordingDownloaded(recordingId)) {
        console.log(`Recording ${recordingId} already downloaded, redirecting to static file`);
        return res.redirect(302, getRecordingPublicUrl(recordingId));
      }
      
      // Try to download now
      const dbName = 'michaelmandella';
      const publicUrl = await downloadRecording(recordingId, dbName);
      
      if (publicUrl) {
        console.log(`Successfully downloaded recording ${recordingId}, redirecting to static file`);
        
        // Update the call record with the new URL
        await storage.updateCall(call.id, { recordingUrl: publicUrl });
        
        return res.redirect(302, publicUrl);
      }
      
      // Log the proxy request
      console.log(`Proxying recording request for ID: ${recordingId}`);
      console.log(`Using recording URL: ${call.recordingUrl}`);
      
      // Extract the actual Taalk call ID from the recording URL
      const urlObj = new URL(call.recordingUrl);
      const dbParam = urlObj.searchParams.get('db') || 'michaelmandella';
      
      // Extract the actual Taalk call ID from the path
      const pathParts = urlObj.pathname.split('/');
      const actualTaalkId = pathParts[pathParts.indexOf('calls') + 1];
      
      console.log(`Extracted actual Taalk ID: ${actualTaalkId} from URL: ${call.recordingUrl}`);
      
      try {
        // Try API Key Service - this should be the most reliable method
        console.log(`Attempting to access recording with API key authentication...`);
        const { getRecording } = await import('./services/taalkApiKeyService');
        
        // Get the recording using the actual Taalk ID
        let response = await getRecording(actualTaalkId, dbParam);
        
        // If API key approach fails, try the session-based approach
        if (!response.ok) {
          console.log(`API key approach failed, trying session approach as fallback...`);
          const { getRecordingWithSession } = await import('./services/taalkSessionService');
          response = await getRecordingWithSession(actualTaalkId, dbParam);
          
          // If session approach also fails, try the basic auth approach
          if (!response.ok) {
            console.log(`Session approach failed, trying basic auth as last resort...`);
            const { getRecording: getRecordingBasic } = await import('./services/taalkBasicAuthService');
            response = await getRecordingBasic(actualTaalkId, dbParam);
          }
        }
        
        // Check if any request was successful
        if (!response.ok) {
          console.error(`All TaalkAI authentication approaches failed: ${response.status}`);
          
          // Handle unauthorized responses
          if (response.status === 401 || response.status === 403) {
            return res.status(response.status).json({
              message: `TaalkAI authentication error: All authentication methods failed.`,
              code: 'EXTERNAL_API_AUTH_ERROR',
              status: response.status
            });
          }
          
          // Return error for other failures
          return res.status(response.status).json({
            message: `TaalkAI API error: ${response.statusText}`,
            code: 'EXTERNAL_API_ERROR',
            status: response.status
          });
        }
        
        // Log more information for debugging
        console.log(`TaalkAI API response contentType:`, response.headers.get('content-type'));
        
        // Get the content type from the response
        const contentType = response.headers.get('content-type') || 'audio/mpeg';
        
        // Set appropriate headers for CORS and caching
        res.setHeader('Content-Type', contentType);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        
        try {
          // Stream the audio data to the client
          const buffer = await response.arrayBuffer();
          res.send(Buffer.from(buffer));
        } catch (streamError) {
          console.error("Error streaming audio data:", streamError);
          res.status(500).json({
            message: "Error while streaming audio data",
            error: streamError instanceof Error ? streamError.message : String(streamError)
          });
        }
      } catch (fetchError) {
        console.error("Error fetching audio from TaalkAI:", fetchError);
        res.status(502).json({ 
          message: "Failed to fetch audio from TaalkAI. The external API may be unavailable.",
          code: 'EXTERNAL_API_UNAVAILABLE',
          error: fetchError instanceof Error ? fetchError.message : String(fetchError)
        });
      }
    } catch (error) {
      console.error("Error proxying audio:", error);
      res.status(500).json({ 
        message: "Failed to proxy audio file", 
        code: 'PROXY_ERROR',
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
