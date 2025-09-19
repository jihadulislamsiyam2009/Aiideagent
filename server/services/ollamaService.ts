import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface OllamaModel {
  name: string;
  size: string;
  digest: string;
  details: {
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface ModelDownloadProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export class OllamaService {
  private ollamaUrl: string;
  private isOllamaInstalled: boolean = false;

  constructor() {
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  }

  async checkOllamaInstallation(): Promise<boolean> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/version`);
      this.isOllamaInstalled = response.ok;
      return this.isOllamaInstalled;
    } catch (error) {
      this.isOllamaInstalled = false;
      return false;
    }
  }

  async installOllama(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Installing Ollama...');
      
      // Download and install Ollama
      const installScript = spawn('bash', ['-c', 'curl -fsSL https://ollama.ai/install.sh | sh'], {
        stdio: 'pipe'
      });

      installScript.stdout.on('data', (data) => {
        console.log(`Ollama install: ${data}`);
      });

      installScript.stderr.on('data', (data) => {
        console.error(`Ollama install error: ${data}`);
      });

      installScript.on('close', async (code) => {
        if (code === 0) {
          console.log('Ollama installed successfully');
          await this.startOllamaServer();
          this.isOllamaInstalled = true;
          resolve();
        } else {
          reject(new Error(`Ollama installation failed with code ${code}`));
        }
      });
    });
  }

  async startOllamaServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Starting Ollama server...');
      
      const ollamaProcess = spawn('ollama', ['serve'], {
        detached: true,
        stdio: 'ignore'
      });

      ollamaProcess.unref();
      
      // Wait a bit for the server to start
      setTimeout(async () => {
        const isRunning = await this.checkOllamaInstallation();
        if (isRunning) {
          console.log('Ollama server started successfully');
          resolve();
        } else {
          reject(new Error('Failed to start Ollama server'));
        }
      }, 3000);
    });
  }

  async ensureOllamaReady(): Promise<void> {
    const isInstalled = await this.checkOllamaInstallation();
    if (!isInstalled) {
      await this.installOllama();
    }
  }

  async listModels(): Promise<OllamaModel[]> {
    await this.ensureOllamaReady();
    
    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`);
      }
      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Error listing Ollama models:', error);
      throw error;
    }
  }

  async pullModel(modelName: string, onProgress?: (progress: ModelDownloadProgress) => void): Promise<void> {
    await this.ensureOllamaReady();
    
    return new Promise((resolve, reject) => {
      const pullProcess = spawn('ollama', ['pull', modelName], {
        stdio: 'pipe'
      });

      pullProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`Pull ${modelName}: ${output}`);
        
        if (onProgress) {
          // Parse progress information from output
          const progressMatch = output.match(/(\d+)%/);
          if (progressMatch) {
            const percentage = parseInt(progressMatch[1]);
            onProgress({
              status: 'downloading',
              completed: percentage,
              total: 100
            });
          }
        }
      });

      pullProcess.stderr.on('data', (data) => {
        console.error(`Pull ${modelName} error: ${data}`);
      });

      pullProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`Model ${modelName} pulled successfully`);
          if (onProgress) {
            onProgress({
              status: 'completed',
              completed: 100,
              total: 100
            });
          }
          resolve();
        } else {
          reject(new Error(`Failed to pull model ${modelName}, exit code: ${code}`));
        }
      });
    });
  }

  async removeModel(modelName: string): Promise<void> {
    await this.ensureOllamaReady();
    
    try {
      const { stdout, stderr } = await execAsync(`ollama rm ${modelName}`);
      if (stderr) {
        throw new Error(stderr);
      }
      console.log(`Model ${modelName} removed successfully`);
    } catch (error) {
      console.error(`Error removing model ${modelName}:`, error);
      throw error;
    }
  }

  async generateResponse(modelName: string, prompt: string, options: any = {}): Promise<OllamaResponse> {
    await this.ensureOllamaReady();
    
    try {
      const response = await fetch(`${this.ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          prompt,
          stream: false,
          ...options
        })
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  async getModelInfo(modelName: string): Promise<any> {
    await this.ensureOllamaReady();
    
    try {
      const response = await fetch(`${this.ollamaUrl}/api/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: modelName })
      });

      if (!response.ok) {
        throw new Error(`Failed to get model info: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting model info:', error);
      throw error;
    }
  }
}

export const ollamaService = new OllamaService();
