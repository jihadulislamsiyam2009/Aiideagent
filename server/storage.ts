import { 
  users, projects, models, executions, files,
  type User, type InsertUser, type Project, type InsertProject,
  type Model, type InsertModel, type Execution, type InsertExecution,
  type File, type InsertFile
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

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

export const storage = new DatabaseStorage();
