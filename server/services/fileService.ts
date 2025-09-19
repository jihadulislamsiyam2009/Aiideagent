import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

export interface FileItem {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  lastModified?: Date;
  permissions?: string;
  owner?: string;
}

export interface FileTreeItem extends FileItem {
  children?: FileTreeItem[];
}

export interface FileSearchResult {
  path: string;
  content?: string;
  lineNumber?: number;
  matchedText?: string;
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

  async listFiles(dirPath: string = '.'): Promise<FileItem[]> {
    const fullPath = path.resolve(this.basePath, dirPath);

    try {
      const items = await fs.readdir(fullPath, { withFileTypes: true });
      const fileItems: FileItem[] = [];

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);
        const fullItemPath = path.join(fullPath, item.name);

        let size: number | undefined;
        let lastModified: Date | undefined;
        let permissions: string | undefined;

        try {
          const stats = await fs.stat(fullItemPath);
          size = item.isFile() ? stats.size : undefined;
          lastModified = stats.mtime;
          permissions = (stats.mode & parseInt('777', 8)).toString(8);
        } catch (error) {
          // Skip files we can't stat
          continue;
        }

        fileItems.push({
          name: item.name,
          type: item.isDirectory() ? 'directory' : 'file',
          path: itemPath,
          size,
          lastModified,
          permissions
        });
      }

      return fileItems.sort((a, b) => {
        // Directories first, then files, both alphabetically
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch (error) {
      throw new Error(`Failed to list files: ${error}`);
    }
  }

  async getFileTree(dirPath: string = '.', maxDepth: number = 3): Promise<FileTreeItem> {
    const buildTree = async (currentPath: string, depth: number): Promise<FileTreeItem> => {
      const fullPath = this.resolvePath(currentPath);
      const stats = await fs.stat(fullPath);
      const name = path.basename(currentPath) || path.basename(fullPath);
      const permissions = (stats.mode & parseInt('777', 8)).toString(8);

      const node: FileTreeItem = {
        name,
        type: stats.isDirectory() ? 'directory' : 'file',
        path: currentPath,
        size: stats.size,
        lastModified: stats.mtime,
        permissions
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

  async searchFiles(query: string, dirPath: string = '.', extensions: string[] = []): Promise<FileItem[]> {
    const results: FileItem[] = [];

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
              const itemStats = await fs.stat(fullItemPath);
              results.push({
                name: item,
                path: itemPath,
                type: 'file',
                size: itemStats.size,
                lastModified: itemStats.mtime,
                extension: path.extname(item),
                permissions: (itemStats.mode & parseInt('777', 8)).toString(8)
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

  async appendToFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);

    try {
      await fs.appendFile(fullPath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to append to file: ${error}`);
    }
  }

  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    const fullSourcePath = this.resolvePath(sourcePath);
    const fullDestPath = this.resolvePath(destPath);

    try {
      const destDir = path.dirname(fullDestPath);
      await fs.mkdir(destDir, { recursive: true });
      await fs.copyFile(fullSourcePath, fullDestPath);
    } catch (error) {
      throw new Error(`Failed to copy file: ${error}`);
    }
  }

  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    const fullSourcePath = this.resolvePath(sourcePath);
    const fullDestPath = this.resolvePath(destPath);

    try {
      const destDir = path.dirname(fullDestPath);
      await fs.mkdir(destDir, { recursive: true });
      await fs.rename(fullSourcePath, fullDestPath);
    } catch (error) {
      throw new Error(`Failed to move file: ${error}`);
    }
  }

  async searchInFiles(searchTerm: string, dirPath: string = '.', filePattern: string = '*'): Promise<FileSearchResult[]> {
    const results: FileSearchResult[] = [];
    const fullPath = this.resolvePath(dirPath);

    try {
      await this.searchRecursive(fullPath, searchTerm, filePattern, results, dirPath);
      return results;
    } catch (error) {
      throw new Error(`Search failed: ${error}`);
    }
  }

  private async searchRecursive(
    currentPath: string,
    searchTerm: string,
    filePattern: string,
    results: FileSearchResult[],
    relativePath: string
  ): Promise<void> {
    const items = await fs.readdir(currentPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(currentPath, item.name);
      const relativeItemPath = path.join(relativePath, item.name);

      if (item.isDirectory() && !item.name.startsWith('.')) {
        await this.searchRecursive(itemPath, searchTerm, filePattern, results, relativeItemPath);
      } else if (item.isFile() && this.matchesPattern(item.name, filePattern)) {
        try {
          const content = await fs.readFile(itemPath, 'utf-8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
              results.push({
                path: relativeItemPath,
                content: line.trim(),
                lineNumber: index + 1,
                matchedText: searchTerm
              });
            }
          });
        } catch {
          // Skip files that can't be read as text
        }
      }
    }
  }

  private matchesPattern(filename: string, pattern: string): boolean {
    if (pattern === '*') return true;
    const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '.'));
    return regex.test(filename);
  }

  async getFileStats(filePath: string): Promise<{
    size: number;
    created: Date;
    modified: Date;
    accessed: Date;
    isFile: boolean;
    isDirectory: boolean;
    permissions: string;
  }> {
    const fullPath = this.resolvePath(filePath);

    try {
      const stats = await fs.stat(fullPath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        permissions: (stats.mode & parseInt('777', 8)).toString(8)
      };
    } catch (error) {
      throw new Error(`Failed to get file stats: ${error}`);
    }
  }

  async watchFile(filePath: string, callback: (eventType: string, filename: string) => void): Promise<() => void> {
    const fullPath = this.resolvePath(filePath);

    try {
      const watcher = fs.watch(fullPath, (eventType, filename) => {
        callback(eventType, filename || '');
      });

      return () => watcher.close();
    } catch (error) {
      throw new Error(`Failed to watch file: ${error}`);
    }
  }

  async getDirectorySize(dirPath: string = '.'): Promise<number> {
    const fullPath = this.resolvePath(dirPath);

    try {
      let totalSize = 0;

      const calculateSize = async (currentPath: string): Promise<void> => {
        const items = await fs.readdir(currentPath, { withFileTypes: true });

        for (const item of items) {
          const itemPath = path.join(currentPath, item.name);

          if (item.isFile()) {
            const stats = await fs.stat(itemPath);
            totalSize += stats.size;
          } else if (item.isDirectory() && !item.name.startsWith('.')) {
            await calculateSize(itemPath);
          }
        }
      };

      await calculateSize(fullPath);
      return totalSize;
    } catch (error) {
      throw new Error(`Failed to calculate directory size: ${error}`);
    }
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