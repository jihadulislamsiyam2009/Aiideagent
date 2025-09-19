import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ollamaService } from "./services/ollamaService";
import { huggingFaceService } from "./services/huggingFaceService";
import { terminalService } from "./services/terminalService";
import { fileService } from "./services/fileService";
import { projectService } from "./services/projectService";
import { insertModelSchema, insertProjectSchema, insertExecutionSchema } from "@shared/schema";
import { Server as SocketIOServer } from "socket.io";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Models API
  app.get("/api/models", async (req, res) => {
    try {
      const models = await storage.getModels();
      res.json(models);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/models/ollama", async (req, res) => {
    try {
      const models = await ollamaService.listModels();
      res.json(models);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/models/huggingface/popular", async (req, res) => {
    try {
      const { category } = req.query;
      const models = await huggingFaceService.getPopularModels(category as string);
      res.json(models);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Projects API
  app.get("/api/projects", async (req, res) => {
    try {
      // For now, return all projects (in production, filter by user)
      const projects = await storage.getProjectsByUser('demo-user');
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const { name, templateId, description } = req.body;
      
      if (!name || !templateId) {
        return res.status(400).json({ error: "Name and template ID are required" });
      }

      // Create project from template
      const scaffoldResult = await projectService.createProject(name, templateId);
      
      if (!scaffoldResult.success) {
        return res.status(400).json({ error: scaffoldResult.error });
      }

      // Create project record
      const project = await storage.createProject(insertProjectSchema.parse({
        name,
        description: description || '',
        userId: 'demo-user', // In production, get from auth
        type: 'template',
        path: scaffoldResult.projectPath,
        metadata: { templateId }
      }));

      res.json({ project, scaffoldResult });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/projects/templates", async (req, res) => {
    try {
      const templates = projectService.getTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/projects/github/user", async (req, res) => {
    try {
      const repos = await projectService.getUserGitHubRepos();
      res.json(repos);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // File System API
  app.get("/api/files", async (req, res) => {
    try {
      const { path: dirPath = '.' } = req.query;
      const files = await fileService.listFiles(dirPath as string);
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/files/tree", async (req, res) => {
    try {
      const { path: dirPath = '.', depth = 3 } = req.query;
      const tree = await fileService.getFileTree(dirPath as string, parseInt(depth as string));
      res.json(tree);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get("/api/terminal/:sessionId/history", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const history = terminalService.getCommandHistory(sessionId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
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
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // WebSocket handling
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return httpServer;
}
