import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

export interface HuggingFaceModel {
  id: string;
  author: string;
  sha: string;
  created_at: string;
  last_modified: string;
  private: boolean;
  gated: boolean;
  downloads: number;
  likes: number;
  tags: string[];
  pipeline_tag: string;
  library_name?: string;
  description?: string;
  model_size?: string;
}

export interface ModelSearchResult {
  models: HuggingFaceModel[];
  total: number;
}

export interface DownloadProgress {
  status: string;
  filename?: string;
  progress?: number;
  total_size?: number;
  downloaded?: number;
}

export class HuggingFaceService {
  private apiUrl: string;
  private modelsDir: string;

  constructor() {
    this.apiUrl = 'https://huggingface.co/api';
    this.modelsDir = process.env.HF_MODELS_DIR || path.join(process.cwd(), 'models', 'huggingface');
  }

  async searchModels(query: string, limit: number = 20, filter?: string): Promise<ModelSearchResult> {
    try {
      const params = new URLSearchParams({
        search: query,
        limit: limit.toString(),
        full: 'true'
      });

      if (filter) {
        params.append('filter', filter);
      }

      const response = await fetch(`${this.apiUrl}/models?${params}`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const models = await response.json();
      
      return {
        models: models.slice(0, limit),
        total: models.length
      };
    } catch (error) {
      console.error('Error searching Hugging Face models:', error);
      throw error;
    }
  }

  async getModelInfo(modelId: string): Promise<HuggingFaceModel> {
    try {
      const response = await fetch(`${this.apiUrl}/models/${modelId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get model info: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting model info:', error);
      throw error;
    }
  }

  async downloadModel(
    modelId: string, 
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string> {
    try {
      // Ensure models directory exists
      await fs.mkdir(this.modelsDir, { recursive: true });
      
      const modelPath = path.join(this.modelsDir, modelId.replace('/', '--'));
      
      return new Promise((resolve, reject) => {
        // Use huggingface-hub Python library for downloading
        const downloadProcess = spawn('python3', [
          '-c', `
import os
import sys
from huggingface_hub import snapshot_download

def progress_callback(info):
    print(f"PROGRESS: {info}")

try:
    model_path = snapshot_download(
        repo_id="${modelId}",
        local_dir="${modelPath}",
        local_dir_use_symlinks=False
    )
    print(f"COMPLETED: {model_path}")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
`
        ], {
          stdio: 'pipe',
          env: { ...process.env, PYTHONPATH: process.env.PYTHONPATH || '' }
        });

        downloadProcess.stdout.on('data', (data) => {
          const output = data.toString().trim();
          console.log(`HF Download ${modelId}: ${output}`);
          
          if (output.startsWith('PROGRESS:') && onProgress) {
            try {
              const progressData = JSON.parse(output.replace('PROGRESS: ', ''));
              onProgress(progressData);
            } catch (e) {
              // Ignore parsing errors for progress updates
            }
          }
          
          if (output.startsWith('COMPLETED:')) {
            const completedPath = output.replace('COMPLETED: ', '');
            resolve(completedPath);
          }
        });

        downloadProcess.stderr.on('data', (data) => {
          const error = data.toString();
          console.error(`HF Download ${modelId} error: ${error}`);
          
          if (error.includes('ERROR:')) {
            reject(new Error(error.replace('ERROR: ', '')));
          }
        });

        downloadProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Download process exited with code ${code}`));
          }
        });
      });
    } catch (error) {
      console.error('Error downloading model:', error);
      throw error;
    }
  }

  async listDownloadedModels(): Promise<string[]> {
    try {
      const modelsExist = await fs.access(this.modelsDir).then(() => true).catch(() => false);
      if (!modelsExist) {
        return [];
      }

      const items = await fs.readdir(this.modelsDir);
      const models: string[] = [];

      for (const item of items) {
        const itemPath = path.join(this.modelsDir, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          // Convert back from filesystem-safe name
          const modelId = item.replace('--', '/');
          models.push(modelId);
        }
      }

      return models;
    } catch (error) {
      console.error('Error listing downloaded models:', error);
      return [];
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    try {
      const modelPath = path.join(this.modelsDir, modelId.replace('/', '--'));
      await fs.rm(modelPath, { recursive: true, force: true });
      console.log(`Model ${modelId} deleted successfully`);
    } catch (error) {
      console.error('Error deleting model:', error);
      throw error;
    }
  }

  async getModelSize(modelId: string): Promise<number> {
    try {
      const modelPath = path.join(this.modelsDir, modelId.replace('/', '--'));
      
      const getSize = async (dirPath: string): Promise<number> => {
        let size = 0;
        try {
          const items = await fs.readdir(dirPath);
          
          for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = await fs.stat(itemPath);
            
            if (stats.isDirectory()) {
              size += await getSize(itemPath);
            } else {
              size += stats.size;
            }
          }
        } catch (error) {
          // Ignore errors for inaccessible files
        }
        
        return size;
      };

      return await getSize(modelPath);
    } catch (error) {
      console.error('Error calculating model size:', error);
      return 0;
    }
  }

  async getPopularModels(category?: string): Promise<HuggingFaceModel[]> {
    try {
      const params = new URLSearchParams({
        limit: '50',
        sort: 'downloads',
        direction: '-1',
        full: 'true'
      });

      if (category) {
        params.append('filter', category);
      }

      const response = await fetch(`${this.apiUrl}/models?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get popular models: ${response.statusText}`);
      }

      const models = await response.json();
      return models.slice(0, 20);
    } catch (error) {
      console.error('Error getting popular models:', error);
      throw error;
    }
  }
}

export const huggingFaceService = new HuggingFaceService();
