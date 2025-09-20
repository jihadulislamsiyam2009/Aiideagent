import { 
  users, projects, models, executions, files,
  type User, type InsertUser, type Project, type InsertProject,
  type Model, type InsertModel, type Execution, type InsertExecution,
  type File, type InsertFile
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { nanoid } from "nanoid";

// Conditionally import db to avoid errors when DATABASE_URL is not set
let db: any;
try {
  if (process.env.DATABASE_URL) {
    const dbModule = require("./db");
    db = dbModule.db;
  }
} catch (error) {
  console.warn("Database module failed to load:", error);
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Projects
  getProject(id: string): Promise<Project | undefined>;
  getProjectsByUser(userId: string): Promise<Project[]>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, project: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;

  // Models
  getModel(id: string): Promise<Model | undefined>;
  getModels(): Promise<Model[]>;
  getModelByModelId(modelId: string): Promise<Model | undefined>;
  createModel(model: InsertModel): Promise<Model>;
  updateModel(id: string, model: Partial<InsertModel>): Promise<Model | undefined>;
  deleteModel(id: string): Promise<boolean>;

  // Executions
  getExecution(id: string): Promise<Execution | undefined>;
  getExecutionsByProject(projectId: string): Promise<Execution[]>;
  createExecution(execution: InsertExecution): Promise<Execution>;
  updateExecution(id: string, execution: Partial<InsertExecution>): Promise<Execution | undefined>;

  // Files
  getFile(id: string): Promise<File | undefined>;
  getFilesByProject(projectId: string): Promise<File[]>;
  getFileByPath(projectId: string, path: string): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(id: string, file: Partial<InsertFile>): Promise<File | undefined>;
  deleteFile(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async getProjectsByUser(userId: string): Promise<Project[]> {
    return await db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(insertProject).returning();
    return project;
  }

  async updateProject(id: string, projectUpdate: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db.update(projects)
      .set({ ...projectUpdate, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project || undefined;
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db.delete(projects).where(eq(projects.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Models
  async getModel(id: string): Promise<Model | undefined> {
    const [model] = await db.select().from(models).where(eq(models.id, id));
    return model || undefined;
  }

  async getModels(): Promise<Model[]> {
    return await db.select().from(models).orderBy(desc(models.updatedAt));
  }

  async getModelByModelId(modelId: string): Promise<Model | undefined> {
    const [model] = await db.select().from(models).where(eq(models.modelId, modelId));
    return model || undefined;
  }

  async createModel(insertModel: InsertModel): Promise<Model> {
    const [model] = await db.insert(models).values(insertModel).returning();
    return model;
  }

  async updateModel(id: string, modelUpdate: Partial<InsertModel>): Promise<Model | undefined> {
    const [model] = await db.update(models)
      .set({ ...modelUpdate, updatedAt: new Date() })
      .where(eq(models.id, id))
      .returning();
    return model || undefined;
  }

  async deleteModel(id: string): Promise<boolean> {
    const result = await db.delete(models).where(eq(models.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Executions
  async getExecution(id: string): Promise<Execution | undefined> {
    const [execution] = await db.select().from(executions).where(eq(executions.id, id));
    return execution || undefined;
  }

  async getExecutionsByProject(projectId: string): Promise<Execution[]> {
    return await db.select().from(executions).where(eq(executions.projectId, projectId)).orderBy(desc(executions.startTime));
  }

  async createExecution(insertExecution: InsertExecution): Promise<Execution> {
    const [execution] = await db.insert(executions).values(insertExecution).returning();
    return execution;
  }

  async updateExecution(id: string, executionUpdate: Partial<InsertExecution>): Promise<Execution | undefined> {
    const [execution] = await db.update(executions)
      .set(executionUpdate)
      .where(eq(executions.id, id))
      .returning();
    return execution || undefined;
  }

  // Files
  async getFile(id: string): Promise<File | undefined> {
    const [file] = await db.select().from(files).where(eq(files.id, id));
    return file || undefined;
  }

  async getFilesByProject(projectId: string): Promise<File[]> {
    return await db.select().from(files).where(eq(files.projectId, projectId)).orderBy(files.path);
  }

  async getFileByPath(projectId: string, path: string): Promise<File | undefined> {
    const [file] = await db.select().from(files)
      .where(and(eq(files.projectId, projectId), eq(files.path, path)));
    return file || undefined;
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const [file] = await db.insert(files).values(insertFile).returning();
    return file;
  }

  async updateFile(id: string, fileUpdate: Partial<InsertFile>): Promise<File | undefined> {
    const [file] = await db.update(files)
      .set({ ...fileUpdate, modifiedAt: new Date() })
      .where(eq(files.id, id))
      .returning();
    return file || undefined;
  }

  async deleteFile(id: string): Promise<boolean> {
    const result = await db.delete(files).where(eq(files.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

// In-memory storage implementation for development/fallback
export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private projects = new Map<string, Project>();
  private models = new Map<string, Model>();
  private executions = new Map<string, Execution>();
  private files = new Map<string, File>();

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      id: nanoid(),
      createdAt: new Date(),
      ...insertUser
    };
    this.users.set(user.id, user);
    return user;
  }

  // Projects
  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async getProjectsByUser(userId: string): Promise<Project[]> {
    return Array.from(this.projects.values())
      .filter(p => p.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const project: Project = {
      id: nanoid(),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      description: null,
      githubUrl: null,
      metadata: {},
      ...insertProject
    };
    this.projects.set(project.id, project);
    return project;
  }

  async updateProject(id: string, projectUpdate: Partial<InsertProject>): Promise<Project | undefined> {
    const project = this.projects.get(id);
    if (!project) return undefined;

    const updated = {
      ...project,
      ...projectUpdate,
      updatedAt: new Date()
    };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.projects.delete(id);
  }

  // Models
  async getModel(id: string): Promise<Model | undefined> {
    return this.models.get(id);
  }

  async getModels(): Promise<Model[]> {
    return Array.from(this.models.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getModelByModelId(modelId: string): Promise<Model | undefined> {
    return Array.from(this.models.values()).find(m => m.modelId === modelId);
  }

  async createModel(insertModel: InsertModel): Promise<Model> {
    const model: Model = {
      id: nanoid(),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'downloading',
      size: null,
      parameters: null,
      contextLength: null,
      downloadProgress: 0,
      config: {},
      performance: {},
      ...insertModel
    };
    this.models.set(model.id, model);
    return model;
  }

  async updateModel(id: string, modelUpdate: Partial<InsertModel>): Promise<Model | undefined> {
    const model = this.models.get(id);
    if (!model) return undefined;

    const updated = {
      ...model,
      ...modelUpdate,
      updatedAt: new Date()
    };
    this.models.set(id, updated);
    return updated;
  }

  async deleteModel(id: string): Promise<boolean> {
    return this.models.delete(id);
  }

  // Executions
  async getExecution(id: string): Promise<Execution | undefined> {
    return this.executions.get(id);
  }

  async getExecutionsByProject(projectId: string): Promise<Execution[]> {
    return Array.from(this.executions.values())
      .filter(e => e.projectId === projectId)
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  async createExecution(insertExecution: InsertExecution): Promise<Execution> {
    const execution: Execution = {
      id: nanoid(),
      startTime: new Date(),
      endTime: null,
      status: 'running',
      output: null,
      error: null,
      exitCode: null,
      ...insertExecution
    };
    this.executions.set(execution.id, execution);
    return execution;
  }

  async updateExecution(id: string, executionUpdate: Partial<InsertExecution>): Promise<Execution | undefined> {
    const execution = this.executions.get(id);
    if (!execution) return undefined;

    const updated = {
      ...execution,
      ...executionUpdate,
      updatedAt: new Date()
    };
    this.executions.set(id, updated);
    return updated;
  }

  // Files
  async getFile(id: string): Promise<File | undefined> {
    return this.files.get(id);
  }

  async getFilesByProject(projectId: string): Promise<File[]> {
    return Array.from(this.files.values())
      .filter(f => f.projectId === projectId)
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  async getFileByPath(projectId: string, path: string): Promise<File | undefined> {
    return Array.from(this.files.values())
      .find(f => f.projectId === projectId && f.path === path);
  }

  async createFile(insertFile: InsertFile): Promise<File> {
    const file: File = {
      id: nanoid(),
      modifiedAt: new Date(),
      content: null,
      size: null,
      ...insertFile
    };
    this.files.set(file.id, file);
    return file;
  }

  async updateFile(id: string, fileUpdate: Partial<InsertFile>): Promise<File | undefined> {
    const file = this.files.get(id);
    if (!file) return undefined;

    const updated = {
      ...file,
      ...fileUpdate,
      modifiedAt: new Date()
    };
    this.files.set(id, updated);
    return updated;
  }

  async deleteFile(id: string): Promise<boolean> {
    return this.files.delete(id);
  }
}

// Use in-memory storage if database is not available, otherwise use database storage
function createStorage(): IStorage {
  try {
    if (!process.env.DATABASE_URL) {
      console.log("Using in-memory storage (DATABASE_URL not provided)");
      return new MemStorage();
    }
    console.log("Using database storage");
    return new DatabaseStorage();
  } catch (error) {
    console.warn("Database connection failed, falling back to in-memory storage:", error);
    return new MemStorage();
  }
}

export const storage = createStorage();
