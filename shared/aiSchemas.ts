// Zod schemas for AI API validation
import { z } from "zod";

export const searchHuggingFaceSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  filter: z.string().optional()
});

export const downloadModelSchema = z.object({
  modelId: z.string().min(1, "Model ID is required")
});

export const pullOllamaSchema = z.object({
  modelName: z.string().min(1, "Model name is required")
});

export const generateTextSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  model: z.string().optional(),
  options: z.record(z.any()).optional()
});

export const generateImageSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  options: z.object({
    size: z.enum(["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"]).optional(),
    quality: z.enum(["standard", "hd"]).optional()
  }).optional()
});

export const analyzeImageSchema = z.object({
  imageData: z.string().min(1, "Image data is required"),
  prompt: z.string().optional()
});

export const analyzeProjectSchema = z.object({
  projectPath: z.string().optional(),
  githubUrl: z.string().url().optional()
});

export const runProjectSchema = z.object({
  projectPath: z.string().optional(),
  analysis: z.record(z.any()).optional()
});

export const browseWebSchema = z.object({
  url: z.string().url("Valid URL is required"),
  task: z.string().min(1, "Task description is required")
});

export const executeCommandsSchema = z.object({
  commands: z.array(z.string()).min(1, "At least one command is required"),
  workingDir: z.string().optional()
});

export type SearchHuggingFaceRequest = z.infer<typeof searchHuggingFaceSchema>;
export type DownloadModelRequest = z.infer<typeof downloadModelSchema>;
export type PullOllamaRequest = z.infer<typeof pullOllamaSchema>;
export type GenerateTextRequest = z.infer<typeof generateTextSchema>;
export type GenerateImageRequest = z.infer<typeof generateImageSchema>;
export type AnalyzeImageRequest = z.infer<typeof analyzeImageSchema>;
export type AnalyzeProjectRequest = z.infer<typeof analyzeProjectSchema>;
export type RunProjectRequest = z.infer<typeof runProjectSchema>;
export type BrowseWebRequest = z.infer<typeof browseWebSchema>;
export type ExecuteCommandsRequest = z.infer<typeof executeCommandsSchema>;