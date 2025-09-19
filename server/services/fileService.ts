import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { promisify } from 'util';

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: Date;
  extension?: string;
  isHidden?: boolean;
}

export interface FileTree {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTree[];
  size?: number;
  modified?: Date;
}

export interface FileOperation {
  operation: 'create' | 'update' | 'delete' | 'move' | 'copy';
  source: string;
  destination?: string;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export class FileService {
  private basePath: string;
  private operationLog: FileOperation[] = [];

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  async readFile(filePath: string): Promise<string> {
    try {
      const fullPath = this.resolvePath(filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      this.logOperation({
        operation: 'update',
        source: fullPath,
        timestamp: new Date(),
        success: true
      });
      
      return content;
    } catch (error) {
      this.logOperation({
        operation: 'update',
        source: filePath,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(filePath);
      
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(fullPath, content, 'utf-8');
      
      this.logOperation({
        operation: 'update',
        source: fullPath,
        timestamp: new Date(),
        success: true
      });
    } catch (error) {
      this.logOperation({
        operation: 'update',
        source: filePath,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async createFile(filePath: string, content: string = ''): Promise<void> {
    try {
      const fullPath = this.resolvePath(filePath);
      
      // Check if file already exists
      try {
        await fs.access(fullPath);
        throw new Error('File already exists');
      } catch (error) {
        // File doesn't exist, which is what we want
      }
      
      // Ensure directory exists
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(fullPath, content, 'utf-8');
      
      this.logOperation({
        operation: 'create',
        source: fullPath,
        timestamp: new Date(),
        success: true
      });
    } catch (error) {
      this.logOperation({
        operation: 'create',
        source: filePath,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(filePath);
      await fs.unlink(fullPath);
      
      this.logOperation({
        operation: 'delete',
        source: fullPath,
        timestamp: new Date(),
        success: true
      });
    } catch (error) {
      this.logOperation({
        operation: 'delete',
        source: filePath,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(dirPath);
      await fs.mkdir(fullPath, { recursive: true });
      
      this.logOperation({
        operation: 'create',
        source: fullPath,
        timestamp: new Date(),
        success: true
      });
    } catch (error) {
      this.logOperation({
        operation: 'create',
        source: dirPath,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    try {
      const fullPath = this.resolvePath(dirPath);
      await fs.rm(fullPath, { recursive: true, force: true });
      
      this.logOperation({
        operation: 'delete',
        source: fullPath,
        timestamp: new Date(),
        success: true
      });
    } catch (error) {
      this.logOperation({
        operation: 'delete',
        source: dirPath,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async moveFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      const fullSource = this.resolvePath(sourcePath);
      const fullDestination = this.resolvePath(destinationPath);
      
      // Ensure destination directory exists
      const destDir = path.dirname(fullDestination);
      await fs.mkdir(destDir, { recursive: true });
      
      await fs.rename(fullSource, fullDestination);
      
      this.logOperation({
        operation: 'move',
        source: fullSource,
        destination: fullDestination,
        timestamp: new Date(),
        success: true
      });
    } catch (error) {
      this.logOperation({
        operation: 'move',
        source: sourcePath,
        destination: destinationPath,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async copyFile(sourcePath: string, destinationPath: string): Promise<void> {
    try {
      const fullSource = this.resolvePath(sourcePath);
      const fullDestination = this.resolvePath(destinationPath);
      
      // Ensure destination directory exists
      const destDir = path.dirname(fullDestination);
      await fs.mkdir(destDir, { recursive: true });
      
      await fs.copyFile(fullSource, fullDestination);
      
      this.logOperation({
        operation: 'copy',
        source: fullSource,
        destination: fullDestination,
        timestamp: new Date(),
        success: true
      });
    } catch (error) {
      this.logOperation({
        operation: 'copy',
        source: sourcePath,
        destination: destinationPath,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  async listFiles(dirPath: string = '.'): Promise<FileInfo[]> {
    try {
      const fullPath = this.resolvePath(dirPath);
      const items = await fs.readdir(fullPath);
      const fileInfos: FileInfo[] = [];

      for (const item of items) {
        const itemPath = path.join(fullPath, item);
        const stats = await fs.stat(itemPath);
        
        const fileInfo: FileInfo = {
          name: item,
          path: path.join(dirPath, item),
          type: stats.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime,
          extension: stats.isFile() ? path.extname(item) : undefined,
          isHidden: item.startsWith('.')
        };
        
        fileInfos.push(fileInfo);
      }

      return fileInfos.sort((a, b) => {
        // Directories first, then files
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  async getFileTree(dirPath: string = '.', maxDepth: number = 3): Promise<FileTree> {
    const buildTree = async (currentPath: string, depth: number): Promise<FileTree> => {
      const fullPath = this.resolvePath(currentPath);
      const stats = await fs.stat(fullPath);
      const name = path.basename(currentPath) || path.basename(fullPath);
      
      const node: FileTree = {
        name,
        path: currentPath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime
      };

      if (stats.isDirectory() && depth < maxDepth) {
        try {
          const items = await fs.readdir(fullPath);
          node.children = [];
          
          for (const item of items) {
            // Skip hidden files and common build directories
            if (item.startsWith('.') || ['node_modules', '__pycache__', 'dist', 'build'].includes(item)) {
              continue;
            }
            
            const childPath = path.join(currentPath, item);
            try {
              const child = await buildTree(childPath, depth + 1);
              node.children.push(child);
            } catch (error) {
              // Skip files that can't be accessed
              continue;
            }
          }
          
          node.children.sort((a, b) => {
            if (a.type !== b.type) {
              return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
          });
        } catch (error) {
          // Directory not accessible
        }
      }

      return node;
    };

    return buildTree(dirPath, 0);
  }

  async searchFiles(query: string, dirPath: string = '.', extensions: string[] = []): Promise<FileInfo[]> {
    const results: FileInfo[] = [];
    
    const search = async (currentPath: string) => {
      try {
        const fullPath = this.resolvePath(currentPath);
        const items = await fs.readdir(fullPath);
        
        for (const item of items) {
          if (item.startsWith('.')) continue;
          
          const itemPath = path.join(currentPath, item);
          const fullItemPath = path.join(fullPath, item);
          const stats = await fs.stat(fullItemPath);
          
          if (stats.isDirectory()) {
            // Skip common build directories
            if (['node_modules', '__pycache__', 'dist', 'build'].includes(item)) {
              continue;
            }
            await search(itemPath);
          } else {
            // Check if file matches query and extensions
            const matchesQuery = item.toLowerCase().includes(query.toLowerCase());
            const matchesExtension = extensions.length === 0 || 
              extensions.includes(path.extname(item).toLowerCase());
            
            if (matchesQuery && matchesExtension) {
              results.push({
                name: item,
                path: itemPath,
                type: 'file',
                size: stats.size,
                modified: stats.mtime,
                extension: path.extname(item)
              });
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be accessed
      }
    };

    await search(dirPath);
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getFileContent(filePath: string): Promise<string> {
    return this.readFile(filePath);
  }

  async updateFileContent(filePath: string, content: string): Promise<void> {
    return this.writeFile(filePath, content);
  }

  getOperationLog(): FileOperation[] {
    return [...this.operationLog];
  }

  clearOperationLog(): void {
    this.operationLog = [];
  }

  private resolvePath(filePath: string): string {
    // Prevent directory traversal attacks
    const resolved = path.resolve(this.basePath, filePath);
    if (!resolved.startsWith(this.basePath)) {
      throw new Error('Access denied: Path outside allowed directory');
    }
    return resolved;
  }

  private logOperation(operation: FileOperation): void {
    this.operationLog.push(operation);
    
    // Keep only last 100 operations
    if (this.operationLog.length > 100) {
      this.operationLog = this.operationLog.slice(-100);
    }
  }
}

export const fileService = new FileService();
