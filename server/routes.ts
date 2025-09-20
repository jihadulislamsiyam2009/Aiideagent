import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import { storage } from "./storage";
import { ollamaService } from "./services/ollamaService";
import { huggingFaceService } from "./services/huggingFaceService";
import { terminalService } from "./services/terminalService";
import { fileService } from "./services/fileService";
import { projectService } from "./services/projectService";
import { aiModelProvider } from "./services/aiModelProvider";
import { aiAgentService } from "./services/aiAgentService";
import { insertModelSchema, insertProjectSchema, insertExecutionSchema } from "@shared/schema";
import { 
  searchHuggingFaceSchema, downloadModelSchema, pullOllamaSchema,
  generateTextSchema, generateImageSchema, analyzeImageSchema,
  analyzeProjectSchema, runProjectSchema, browseWebSchema, executeCommandsSchema
} from "@shared/aiSchemas";
import { Server as SocketIOServer } from "socket.io";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Health API
  app.get("/api/health", (req, res) => {
    const storageType = process.env.DATABASE_URL ? 'database' : 'memory';
    res.json({
      status: 'ok',
      storage: storageType,
      timestamp: new Date().toISOString(),
      services: {
        storage: 'active',
        ollama: process.env.OLLAMA_URL ? 'configured' : 'not_configured',
        github: 'available'
      }
    });
  });

  // Dashboard API
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const models = await storage.getModels();
      const activeModels = models.filter(m => m.status === 'running');
      const totalModels = models.length;

      // Mock project and system stats for now
      const stats = {
        models: {
          total: totalModels,
          active: activeModels.length,
          idle: totalModels - activeModels.length
        },
        projects: {
          total: 12, // Will be replaced with real data
          active: 5,
          archived: 7
        },
        system: {
          memoryUsage: 68, // percentage
          totalMemory: "10GB",
          usedMemory: "6.8GB"
        }
      };

      res.json(stats);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/dashboard/activity", async (req, res) => {
    try {
      // Mock activity data - in production, this would come from logs/database
      const activities = [
        {
          id: 1,
          type: "model_download",
          message: "Downloaded llama3.1:8b-instruct-q4_0",
          timestamp: new Date(Date.now() - 2 * 60 * 1000),
          status: "success"
        },
        {
          id: 2,
          type: "project_create",
          message: "Created new project: AI Chat Bot",
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          status: "success"
        },
        {
          id: 3,
          type: "deployment",
          message: "Deployed model to production",
          timestamp: new Date(Date.now() - 60 * 60 * 1000),
          status: "success"
        },
        {
          id: 4,
          type: "sync",
          message: "Synced with Hugging Face repository",
          timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
          status: "success"
        }
      ];

      res.json(activities);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Models API
  app.get("/api/models", async (req, res) => {
    try {
      const models = await storage.getModels();
      res.json(models);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/models/ollama", async (req, res) => {
    try {
      const models = await ollamaService.listModels();
      res.json(models);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/models/ollama/pull", async (req, res) => {
    try {
      const { modelName } = req.body;
      if (!modelName) {
        return res.status(400).json({ error: "Model name is required" });
      }

      // Create model record
      const model = await storage.createModel(insertModelSchema.parse({
        name: modelName,
        source: 'ollama',
        modelId: modelName,
        status: 'downloading'
      }));

      // Start download in background
      ollamaService.pullModel(modelName, async (progress) => {
        await storage.updateModel(model.id, {
          downloadProgress: progress.completed || 0,
          status: progress.status === 'completed' ? 'ready' : 'downloading'
        });

        // Emit progress via WebSocket
        io.emit('model-download-progress', {
          modelId: model.id,
          progress
        });
      }).catch(async (error) => {
        await storage.updateModel(model.id, {
          status: 'error'
        });
        io.emit('model-download-error', {
          modelId: model.id,
          error: error.message
        });
      });

      res.json({ message: "Download started", modelId: model.id });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.delete("/api/models/ollama/:modelName", async (req, res) => {
    try {
      const { modelName } = req.params;
      await ollamaService.removeModel(modelName);

      // Update database
      const model = await storage.getModelByModelId(modelName);
      if (model) {
        await storage.deleteModel(model.id);
      }

      res.json({ message: "Model removed successfully" });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Hugging Face API
  app.get("/api/models/huggingface/search", async (req, res) => {
    try {
      const { query, limit = 20, filter } = req.query;
      if (!query) {
        return res.status(400).json({ error: "Query parameter is required" });
      }

      const results = await huggingFaceService.searchModels(
        query as string,
        parseInt(limit as string),
        filter as string
      );

      res.json(results);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/models/huggingface/popular", async (req, res) => {
    try {
      const { category } = req.query;
      const models = await huggingFaceService.getPopularModels(category as string);
      res.json(models);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/models/huggingface/download", async (req, res) => {
    try {
      const { modelId } = req.body;
      if (!modelId) {
        return res.status(400).json({ error: "Model ID is required" });
      }

      // Create model record
      const model = await storage.createModel(insertModelSchema.parse({
        name: modelId.split('/').pop() || modelId,
        source: 'huggingface',
        modelId,
        status: 'downloading'
      }));

      // Start download in background
      huggingFaceService.downloadModel(modelId, async (progress) => {
        await storage.updateModel(model.id, {
          downloadProgress: progress.progress || 0,
          status: progress.status === 'completed' ? 'ready' : 'downloading'
        });

        io.emit('model-download-progress', {
          modelId: model.id,
          progress
        });
      }).catch(async (error) => {
        await storage.updateModel(model.id, {
          status: 'error'
        });
        io.emit('model-download-error', {
          modelId: model.id,
          error: error.message
        });
      });

      res.json({ message: "Download started", modelId: model.id });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Projects API
  app.get("/api/projects", async (req, res) => {
    try {
      // For now, return all projects (in production, filter by user)
      const projects = await storage.getProjectsByUser('demo-user');
      res.json(projects);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const { name, templateId, description } = req.body;
      
      if (!name || !templateId) {
        return res.status(400).json({ error: "Name and template ID are required" });
      }

      // Create project from template
      const { projectTemplateService } = await import('./services/projectTemplateService');
      const projectPath = path.join(process.cwd(), 'projects', name);
      
      const success = await projectTemplateService.createProjectFromTemplate(templateId, name, projectPath);
      
      if (!success) {
        return res.status(400).json({ error: 'Failed to create project from template' });
      }

      // Create project record
      const project = await storage.createProject(insertProjectSchema.parse({
        name,
        description: description || '',
        userId: 'demo-user', // In production, get from auth
        type: 'template',
        path: projectPath,
        metadata: { templateId }
      }));

      res.json({ 
        project, 
        scaffoldResult: {
          success: true,
          projectPath,
          message: 'Project created successfully'
        }
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/projects/templates", async (req, res) => {
    try {
      const { projectTemplateService } = await import('./services/projectTemplateService');
      const templates = projectTemplateService.getTemplates();
      res.json(templates);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/projects/templates/:templateId", async (req, res) => {
    try {
      const { templateId } = req.params;
      const { projectTemplateService } = await import('./services/projectTemplateService');
      const template = projectTemplateService.getTemplate(templateId);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.json(template);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/projects/clone", async (req, res) => {
    try {
      const { repoUrl, name } = req.body;
      
      if (!repoUrl) {
        return res.status(400).json({ error: "Repository URL is required" });
      }

      const cloneResult = await projectService.cloneGitHubRepo(repoUrl, name);
      
      if (!cloneResult.success) {
        return res.status(400).json({ error: cloneResult.error });
      }

      // Create project record
      const project = await storage.createProject(insertProjectSchema.parse({
        name: name || repoUrl.split('/').pop()?.replace('.git', '') || 'unknown',
        description: `Cloned from ${repoUrl}`,
        userId: 'demo-user',
        type: 'github',
        path: cloneResult.projectPath,
        githubUrl: repoUrl,
        metadata: { clonedFrom: repoUrl }
      }));

      res.json({ project, cloneResult });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/projects/github/search", async (req, res) => {
    try {
      const { query, language } = req.query;
      
      if (!query) {
        return res.status(400).json({ error: "Query parameter is required" });
      }

      const repos = await projectService.searchGitHubRepos(query as string, language as string);
      res.json(repos);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/projects/github/user", async (req, res) => {
    try {
      const repos = await projectService.getUserGitHubRepos();
      res.json(repos);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // File System API
  app.get("/api/files", async (req, res) => {
    try {
      const { path: dirPath = '.' } = req.query;
      const files = await fileService.listFiles(dirPath as string);
      res.json(files);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/files/tree", async (req, res) => {
    try {
      const { path: dirPath = '.', depth = 3 } = req.query;
      const tree = await fileService.getFileTree(dirPath as string, parseInt(depth as string));
      res.json(tree);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/files/content", async (req, res) => {
    try {
      const { path: filePath } = req.query;
      if (!filePath) {
        return res.status(400).json({ error: "File path is required" });
      }

      const content = await fileService.readFile(filePath as string);
      res.json({ content });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/files/content", async (req, res) => {
    try {
      const { path: filePath, content } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: "File path is required" });
      }

      await fileService.writeFile(filePath, content || '');
      res.json({ message: "File saved successfully" });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/files/create", async (req, res) => {
    try {
      const { path: filePath, content = '', type = 'file' } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: "File path is required" });
      }

      if (type === 'directory') {
        await fileService.createDirectory(filePath);
      } else {
        await fileService.createFile(filePath, content);
      }

      res.json({ message: `${type} created successfully` });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/files/search", async (req, res) => {
    try {
      const { searchTerm, path: searchPath = '.', filePattern = '*' } = req.body;
      
      if (!searchTerm) {
        return res.status(400).json({ error: "Search term is required" });
      }

      const results = await fileService.searchInFiles(searchTerm, searchPath, filePattern);
      res.json(results);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/files/copy", async (req, res) => {
    try {
      const { sourcePath, destPath } = req.body;
      
      if (!sourcePath || !destPath) {
        return res.status(400).json({ error: "Source and destination paths are required" });
      }

      await fileService.copyFile(sourcePath, destPath);
      res.json({ message: "File copied successfully" });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/files/move", async (req, res) => {
    try {
      const { sourcePath, destPath } = req.body;
      
      if (!sourcePath || !destPath) {
        return res.status(400).json({ error: "Source and destination paths are required" });
      }

      await fileService.moveFile(sourcePath, destPath);
      res.json({ message: "File moved successfully" });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/files/stats", async (req, res) => {
    try {
      const { path: filePath } = req.query;
      
      if (!filePath) {
        return res.status(400).json({ error: "File path is required" });
      }

      const stats = await fileService.getFileStats(filePath as string);
      res.json(stats);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.delete("/api/files", async (req, res) => {
    try {
      const { path: filePath, type = 'file' } = req.query;
      if (!filePath) {
        return res.status(400).json({ error: "File path is required" });
      }

      if (type === 'directory') {
        await fileService.deleteDirectory(filePath as string);
      } else {
        await fileService.deleteFile(filePath as string);
      }

      res.json({ message: `${type} deleted successfully` });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Terminal API
  app.post("/api/terminal/create", async (req, res) => {
    try {
      const { cwd = process.cwd() } = req.body;
      const sessionId = `terminal-${Date.now()}`;
      const session = terminalService.createSession(sessionId, cwd);

      // Set up WebSocket events for this session
      session.emitter.on('output', (data) => {
        io.emit('terminal-output', { sessionId, data });
      });

      session.emitter.on('error', (data) => {
        io.emit('terminal-error', { sessionId, data });
      });

      session.emitter.on('exit', (code) => {
        io.emit('terminal-exit', { sessionId, code });
      });

      res.json({ sessionId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/terminal/:sessionId/command", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { command } = req.body;

      if (!command) {
        return res.status(400).json({ error: "Command is required" });
      }

      await terminalService.executeCommand(sessionId, command);
      res.json({ message: "Command executed" });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/terminal/:sessionId/history", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const history = terminalService.getCommandHistory(sessionId);
      res.json(history);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/terminal/:sessionId/autocomplete", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { partialCommand } = req.body;

      if (!partialCommand) {
        return res.status(400).json({ error: "Partial command is required" });
      }

      const suggestions = await terminalService.autocomplete(sessionId, partialCommand);
      res.json({ suggestions });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.delete("/api/terminal/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const success = terminalService.closeSession(sessionId);
      
      if (success) {
        res.json({ message: "Terminal session closed" });
      } else {
        res.status(404).json({ error: "Terminal session not found" });
      }
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // API Testing Routes
  app.get("/api/testing/suites", async (req, res) => {
    try {
      const { projectId } = req.query;
      res.json({ message: "API testing suites endpoint" });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/testing/suites", async (req, res) => {
    try {
      const { projectId, endpoints } = req.body;
      const { apiTestingService } = await import('./services/apiTestingService');
      await apiTestingService.createTestSuite(projectId, endpoints);
      res.json({ message: "Test suite created successfully" });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/testing/run", async (req, res) => {
    try {
      const { projectId } = req.body;
      const { apiTestingService } = await import('./services/apiTestingService');
      const results = await apiTestingService.runTests(projectId);
      res.json(results);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Performance Profiling Routes
  app.post("/api/performance/profile", async (req, res) => {
    try {
      const { projectId, duration } = req.body;
      const { performanceService } = await import('./services/performanceService');
      const profileId = await performanceService.startProfiling(projectId, duration);
      res.json({ profileId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/performance/profiles/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { performanceService } = await import('./services/performanceService');
      const profiles = performanceService.getProfiles(projectId);
      res.json(profiles);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/performance/analyze", async (req, res) => {
    try {
      const { projectPath } = req.body;
      const { performanceService } = await import('./services/performanceService');
      const suggestions = await performanceService.analyzeCode(projectPath);
      res.json(suggestions);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // CI/CD Pipeline Routes
  app.get("/api/cicd/pipelines", async (req, res) => {
    try {
      const { cicdService } = await import('./services/cicdService');
      const pipelines = cicdService.getPipelines();
      res.json(pipelines);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/cicd/pipelines", async (req, res) => {
    try {
      const pipelineConfig = req.body;
      const { cicdService } = await import('./services/cicdService');
      await cicdService.createPipeline(pipelineConfig);
      res.json({ message: "Pipeline created successfully" });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/cicd/pipelines/:pipelineId/run", async (req, res) => {
    try {
      const { pipelineId } = req.params;
      const { cicdService } = await import('./services/cicdService');
      const runId = await cicdService.runPipeline(pipelineId);
      res.json({ runId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/cicd/runs/:runId", async (req, res) => {
    try {
      const { runId } = req.params;
      const { cicdService } = await import('./services/cicdService');
      const run = cicdService.getPipelineRun(runId);
      res.json(run);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Mobile Development Routes
  app.get("/api/mobile/projects", async (req, res) => {
    try {
      const { mobileDevService } = await import('./services/mobileDevService');
      const projects = mobileDevService.getProjects();
      res.json(projects);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/mobile/projects", async (req, res) => {
    try {
      const projectConfig = req.body;
      const { mobileDevService } = await import('./services/mobileDevService');
      const projectId = await mobileDevService.createMobileProject(projectConfig);
      res.json({ projectId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/mobile/build", async (req, res) => {
    try {
      const { projectId, platform, buildType } = req.body;
      const { mobileDevService } = await import('./services/mobileDevService');
      const buildId = await mobileDevService.buildProject(projectId, platform, buildType);
      res.json({ buildId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/mobile/devices", async (req, res) => {
    try {
      const { mobileDevService } = await import('./services/mobileDevService');
      const devices = await mobileDevService.getConnectedDevices();
      res.json(devices);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Machine Learning Routes
  app.get("/api/ml/datasets", async (req, res) => {
    try {
      const { mlWorkflowService } = await import('./services/mlWorkflowService');
      const datasets = mlWorkflowService.getDatasets();
      res.json(datasets);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/ml/datasets", async (req, res) => {
    try {
      const datasetConfig = req.body;
      const { mlWorkflowService } = await import('./services/mlWorkflowService');
      const datasetId = await mlWorkflowService.createDataset(datasetConfig);
      res.json({ datasetId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/ml/models", async (req, res) => {
    try {
      const { mlWorkflowService } = await import('./services/mlWorkflowService');
      const models = mlWorkflowService.getModels();
      res.json(models);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/ml/models", async (req, res) => {
    try {
      const modelConfig = req.body;
      const { mlWorkflowService } = await import('./services/mlWorkflowService');
      const modelId = await mlWorkflowService.createModel(modelConfig);
      res.json({ modelId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/ml/train", async (req, res) => {
    try {
      const trainingConfig = req.body;
      const { mlWorkflowService } = await import('./services/mlWorkflowService');
      const jobId = await mlWorkflowService.startTraining(trainingConfig);
      res.json({ jobId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/ml/jobs/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { mlWorkflowService } = await import('./services/mlWorkflowService');
      const job = mlWorkflowService.getTrainingJob(jobId);
      res.json(job);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/ml/gpu-status", async (req, res) => {
    try {
      const { mlWorkflowService } = await import('./services/mlWorkflowService');
      const gpuAvailable = await mlWorkflowService.checkGpuAvailability();
      res.json({ gpuAvailable });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Security Scanning Routes
  app.post("/api/security/scan", async (req, res) => {
    try {
      const { projectId, projectPath } = req.body;
      const { securityService } = await import('./services/securityService');
      const scanId = await securityService.scanProject(projectId, projectPath);
      res.json({ scanId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/security/scans/:scanId", async (req, res) => {
    try {
      const { scanId } = req.params;
      const { securityService } = await import('./services/securityService');
      const result = securityService.getScanResult(scanId);
      if (result) {
        res.json(result);
      } else {
        res.status(404).json({ error: 'Scan not found' });
      }
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/security/scans", async (req, res) => {
    try {
      const { projectId } = req.query;
      const { securityService } = await import('./services/securityService');
      const scans = securityService.getAllScans(projectId as string);
      res.json(scans);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Automated Testing Routes
  app.get("/api/testing/suites/all", async (req, res) => {
    try {
      const { automatedTestingService } = await import('./services/automatedTestingService');
      const suites = automatedTestingService.getAllTestSuites();
      res.json(suites);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/testing/suites/create", async (req, res) => {
    try {
      const suiteConfig = req.body;
      const { automatedTestingService } = await import('./services/automatedTestingService');
      const suiteId = await automatedTestingService.createTestSuite(suiteConfig);
      res.json({ suiteId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/testing/suites/:suiteId/run", async (req, res) => {
    try {
      const { suiteId } = req.params;
      const { automatedTestingService } = await import('./services/automatedTestingService');
      const resultId = await automatedTestingService.runTestSuite(suiteId);
      res.json({ resultId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/testing/results/:suiteId", async (req, res) => {
    try {
      const { suiteId } = req.params;
      const { automatedTestingService } = await import('./services/automatedTestingService');
      const results = automatedTestingService.getTestResults(suiteId);
      res.json(results);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Distributed Training Routes
  app.post("/api/distributed/register-node", async (req, res) => {
    try {
      const nodeConfig = req.body;
      const { distributedTrainingService } = await import('./services/distributedTrainingService');
      const nodeId = await distributedTrainingService.registerNode(nodeConfig);
      res.json({ nodeId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/distributed/training/start", async (req, res) => {
    try {
      const trainingConfig = req.body;
      const { distributedTrainingService } = await import('./services/distributedTrainingService');
      const jobId = await distributedTrainingService.startDistributedTraining(trainingConfig);
      res.json({ jobId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/distributed/jobs/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      const { distributedTrainingService } = await import('./services/distributedTrainingService');
      const job = await distributedTrainingService.getJobStatus(jobId);
      res.json(job);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/distributed/nodes", async (req, res) => {
    try {
      const { distributedTrainingService } = await import('./services/distributedTrainingService');
      const nodes = distributedTrainingService.getAvailableNodes();
      res.json(nodes);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Container Service Routes
  app.post("/api/containers/configs", async (req, res) => {
    try {
      const containerConfig = req.body;
      const { containerService } = await import('./services/containerService');
      const configId = await containerService.createContainerConfig(containerConfig);
      res.json({ configId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/containers/:configId/build", async (req, res) => {
    try {
      const { configId } = req.params;
      const { containerService } = await import('./services/containerService');
      const imageName = await containerService.buildContainer(configId);
      res.json({ imageName });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/containers/:configId/run", async (req, res) => {
    try {
      const { configId } = req.params;
      const { imageName } = req.body;
      const { containerService } = await import('./services/containerService');
      const instanceId = await containerService.runContainer(configId, imageName);
      res.json({ instanceId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/containers/instances", async (req, res) => {
    try {
      const { containerService } = await import('./services/containerService');
      const instances = containerService.getAllContainerInstances();
      res.json(instances);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/k8s/deployments", async (req, res) => {
    try {
      const deploymentConfig = req.body;
      const { containerService } = await import('./services/containerService');
      const deploymentId = await containerService.createKubernetesDeployment(deploymentConfig);
      res.json({ deploymentId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Debugging Service Routes
  app.post("/api/debug/sessions", async (req, res) => {
    try {
      const { projectId, type, config } = req.body;
      const { debuggingService } = await import('./services/debuggingService');
      const sessionId = await debuggingService.startDebugSession(projectId, type, config);
      res.json({ sessionId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/debug/sessions/:sessionId/breakpoints", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { file, line, condition } = req.body;
      const { debuggingService } = await import('./services/debuggingService');
      const breakpointId = await debuggingService.addBreakpoint(sessionId, file, line, condition);
      res.json({ breakpointId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/debug/analyze-error", async (req, res) => {
    try {
      const errorInfo = req.body;
      const { debuggingService } = await import('./services/debuggingService');
      const analysisId = await debuggingService.analyzeError(errorInfo);
      res.json({ analysisId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/debug/analyses/:analysisId/fix", async (req, res) => {
    try {
      const { analysisId } = req.params;
      const { suggestionId } = req.body;
      const { debuggingService } = await import('./services/debuggingService');
      const fixId = await debuggingService.attemptAutoFix(analysisId, suggestionId);
      res.json({ fixId });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/debug/sessions", async (req, res) => {
    try {
      const { debuggingService } = await import('./services/debuggingService');
      const sessions = debuggingService.getAllDebugSessions();
      res.json(sessions);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Browser Service Routes
  app.post("/api/browser/session", async (req, res) => {
    try {
      const sessionId = `browser-${Date.now()}`;
      const { browserService } = await import('./services/browserService');
      const session = await browserService.createBrowserSession(sessionId);
      res.json({ sessionId, success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/browser/:sessionId/navigate", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { url, pageId = 'main' } = req.body;
      const { browserService } = await import('./services/browserService');
      await browserService.navigateToUrl(sessionId, pageId, url);
      res.json({ success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/browser/:sessionId/screenshot", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { pageId = 'main' } = req.body;
      const { browserService } = await import('./services/browserService');
      const screenshot = await browserService.takeScreenshot(sessionId, pageId);
      res.json({ screenshot, success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/browser/:sessionId/extract", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { selector, pageId = 'main' } = req.body;
      const { browserService } = await import('./services/browserService');
      const data = await browserService.extractData(sessionId, pageId, selector);
      res.json({ data, success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/browser/:sessionId/click", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { selector, pageId = 'main' } = req.body;
      const { browserService } = await import('./services/browserService');
      await browserService.clickElement(sessionId, pageId, selector);
      res.json({ success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/browser/:sessionId/type", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { selector, text, pageId = 'main' } = req.body;
      const { browserService } = await import('./services/browserService');
      await browserService.typeText(sessionId, pageId, selector, text);
      res.json({ success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/browser/automation/scripts", async (req, res) => {
    try {
      const { browserService } = await import('./services/browserService');
      const scripts = browserService.getAllAutomationScripts();
      res.json(scripts);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/browser/automation/run", async (req, res) => {
    try {
      const { scriptId, url } = req.body;
      const { browserService } = await import('./services/browserService');
      const runId = await browserService.runAutomationScript(scriptId, url);
      res.json({ runId, success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/browser/data/scraped", async (req, res) => {
    try {
      const { browserService } = await import('./services/browserService');
      const data = browserService.getScrapedData();
      res.json(data);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/browser/:sessionId/tab", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { browserService } = await import('./services/browserService');
      const tabId = await browserService.createNewTab(sessionId);
      res.json({ tabId, success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.delete("/api/browser/:sessionId/tab/:pageId", async (req, res) => {
    try {
      const { sessionId, pageId } = req.params;
      const { browserService } = await import('./services/browserService');
      await browserService.closeTab(sessionId, pageId);
      res.json({ success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.delete("/api/browser/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { browserService } = await import('./services/browserService');
      await browserService.closeBrowserSession(sessionId);
      res.json({ success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // WebSocket handling
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });

    // Terminal events
    socket.on('terminal-input', async (data) => {
      const { sessionId, command } = data;
      try {
        await terminalService.executeCommand(sessionId, command);
      } catch (error: any) {
        socket.emit('terminal-error', { sessionId, error: error.message });
      }
    });

    // Browser events
    socket.on('browser-navigate', async (data) => {
      const { sessionId, url, pageId } = data;
      try {
        const { browserService } = await import('./services/browserService');
        await browserService.navigateToUrl(sessionId, pageId || 'main', url);
        socket.emit('browser-navigation-complete', { sessionId, url, pageId });
      } catch (error: any) {
        socket.emit('browser-error', { sessionId, error: error.message });
      }
    });

    // Debug session events
    socket.on('debug-step', async (data) => {
      socket.emit('debug-update', data);
    });

    // Training progress events
    socket.on('training-progress', async (data) => {
      socket.emit('training-update', data);
    });
  });

  // Enhanced AI Model Management API
  app.get("/api/ai/models", async (req, res) => {
    try {
      const models = aiModelProvider.getAvailableModels();
      res.json(models);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/ai/models/search/huggingface", async (req, res) => {
    try {
      const { query, filter } = searchHuggingFaceSchema.parse(req.body);
      
      const models = await aiModelProvider.searchHuggingFaceModels(query, filter);
      res.json(models);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/ai/models/download/huggingface", async (req, res) => {
    try {
      const { modelId } = downloadModelSchema.parse(req.body);
      
      const downloadId = await aiModelProvider.downloadHuggingFaceModel(modelId);
      res.json({ downloadId, message: "Download started" });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/ai/models/pull/ollama", async (req, res) => {
    try {
      const { modelName } = pullOllamaSchema.parse(req.body);
      
      const pullId = await aiModelProvider.pullOllamaModel(modelName);
      res.json({ pullId, message: "Pull started" });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // AI Generation API
  app.post("/api/ai/generate/text", async (req, res) => {
    try {
      const { prompt, model, options } = generateTextSchema.parse(req.body);
      
      const result = await aiModelProvider.generateText(prompt, model, options);
      res.json(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/ai/generate/image", async (req, res) => {
    try {
      const { prompt, options } = generateImageSchema.parse(req.body);
      
      const result = await aiModelProvider.generateImage(prompt, options);
      res.json(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/ai/analyze/image", async (req, res) => {
    try {
      const { imageData, prompt } = analyzeImageSchema.parse(req.body);
      
      const result = await aiModelProvider.analyzeImage(imageData, prompt);
      res.json(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // AI Agent API
  app.post("/api/ai/agent/analyze-project", async (req, res) => {
    try {
      const { projectPath, githubUrl } = analyzeProjectSchema.parse(req.body);
      
      const analysis = await aiAgentService.analyzeProject(projectPath || '.', githubUrl);
      res.json(analysis);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/ai/agent/run-project", async (req, res) => {
    try {
      const { projectPath, analysis } = runProjectSchema.parse(req.body);
      
      const result = await aiAgentService.runProject(projectPath || '.', analysis);
      res.json(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/ai/agent/browse-web", async (req, res) => {
    try {
      const { url, task } = browseWebSchema.parse(req.body);
      
      const result = await aiAgentService.browseWebWithAI(url, task);
      res.json(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/ai/agent/execute-commands", async (req, res) => {
    try {
      const { commands, workingDir } = executeCommandsSchema.parse(req.body);
      
      const result = await aiAgentService.executeCommandsWithAI(commands, workingDir);
      res.json(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/ai/agent/tasks", async (req, res) => {
    try {
      const activeTasks = aiAgentService.getActiveTasks();
      const history = aiAgentService.getTaskHistory(10);
      res.json({ activeTasks, history });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.get("/api/ai/agent/tasks/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const task = aiAgentService.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json(task);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  app.post("/api/ai/agent/tasks/:taskId/cancel", async (req, res) => {
    try {
      const { taskId } = req.params;
      const cancelled = await aiAgentService.cancelTask(taskId);
      if (!cancelled) {
        return res.status(404).json({ error: "Task not found" });
      }
      res.json({ message: "Task cancelled" });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // Socket.IO setup for real-time communication with proper event bridging
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Bridge AI Model Provider events to Socket.IO
    const onModelProgress = (data: any) => io.emit('model:progress', data);
    const onModelComplete = (data: any) => io.emit('model:complete', data);
    const onModelError = (data: any) => io.emit('model:error', data);
    const onOllamaProgress = (data: any) => io.emit('ollama:progress', data);
    const onOllamaComplete = (data: any) => io.emit('ollama:complete', data);

    aiModelProvider.on('model-download-progress', onModelProgress);
    aiModelProvider.on('model-download-complete', onModelComplete);
    aiModelProvider.on('model-download-error', onModelError);
    aiModelProvider.on('ollama-pull-progress', onOllamaProgress);
    aiModelProvider.on('ollama-pull-complete', onOllamaComplete);

    // Bridge AI Agent Service events to Socket.IO
    const onTaskStarted = (task: any) => io.emit('agent:task-started', task);
    const onStepCompleted = (data: any) => io.emit('agent:step-completed', data);
    const onTaskCompleted = (task: any) => io.emit('agent:task-completed', task);
    const onTaskFailed = (task: any) => io.emit('agent:task-failed', task);
    const onTaskCancelled = (task: any) => io.emit('agent:task-cancelled', task);

    aiAgentService.on('task-started', onTaskStarted);
    aiAgentService.on('step-completed', onStepCompleted);
    aiAgentService.on('task-completed', onTaskCompleted);
    aiAgentService.on('task-failed', onTaskFailed);
    aiAgentService.on('task-cancelled', onTaskCancelled);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      
      // Clean up event listeners to prevent memory leaks
      aiModelProvider.off('model-download-progress', onModelProgress);
      aiModelProvider.off('model-download-complete', onModelComplete);
      aiModelProvider.off('model-download-error', onModelError);
      aiModelProvider.off('ollama-pull-progress', onOllamaProgress);
      aiModelProvider.off('ollama-pull-complete', onOllamaComplete);
      
      aiAgentService.off('task-started', onTaskStarted);
      aiAgentService.off('step-completed', onStepCompleted);
      aiAgentService.off('task-completed', onTaskCompleted);
      aiAgentService.off('task-failed', onTaskFailed);
      aiAgentService.off('task-cancelled', onTaskCancelled);
    });
  });

  return httpServer;
}
