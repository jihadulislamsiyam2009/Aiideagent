
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { performance } from 'perf_hooks';

export interface PerformanceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkLatency: number;
  responseTime: number;
  throughput: number;
}

export interface ProfileResult {
  id: string;
  projectId: string;
  metrics: PerformanceMetrics;
  recommendations: string[];
  timestamp: Date;
  duration: number;
}

export interface OptimizationSuggestion {
  type: 'code' | 'infrastructure' | 'database' | 'cache';
  severity: 'low' | 'medium' | 'high';
  description: string;
  solution: string;
  estimatedImpact: string;
}

export class PerformanceService {
  private profiles: Map<string, ProfileResult[]> = new Map();
  private monitoringActive: Map<string, boolean> = new Map();

  async startProfiling(projectId: string, duration: number = 60000): Promise<string> {
    const profileId = `profile-${Date.now()}`;
    this.monitoringActive.set(projectId, true);

    const startTime = performance.now();
    const metrics = await this.collectMetrics(projectId, duration);
    const endTime = performance.now();

    const result: ProfileResult = {
      id: profileId,
      projectId,
      metrics,
      recommendations: this.generateRecommendations(metrics),
      timestamp: new Date(),
      duration: endTime - startTime
    };

    const existing = this.profiles.get(projectId) || [];
    existing.push(result);
    this.profiles.set(projectId, existing);

    await this.generateReport(result);
    return profileId;
  }

  async collectMetrics(projectId: string, duration: number): Promise<PerformanceMetrics> {
    const samples: PerformanceMetrics[] = [];
    const interval = 1000; // Sample every second
    const iterations = duration / interval;

    for (let i = 0; i < iterations; i++) {
      if (!this.monitoringActive.get(projectId)) break;

      const sample = await this.getSingleMetricsSample();
      samples.push(sample);
      
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    // Calculate averages
    return {
      cpuUsage: samples.reduce((sum, s) => sum + s.cpuUsage, 0) / samples.length,
      memoryUsage: samples.reduce((sum, s) => sum + s.memoryUsage, 0) / samples.length,
      diskUsage: samples.reduce((sum, s) => sum + s.diskUsage, 0) / samples.length,
      networkLatency: samples.reduce((sum, s) => sum + s.networkLatency, 0) / samples.length,
      responseTime: samples.reduce((sum, s) => sum + s.responseTime, 0) / samples.length,
      throughput: samples.reduce((sum, s) => sum + s.throughput, 0) / samples.length
    };
  }

  private async getSingleMetricsSample(): Promise<PerformanceMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = await this.getCpuUsage();
    
    // Mock network latency test
    const networkStart = performance.now();
    await fetch('https://www.google.com/').catch(() => {});
    const networkLatency = performance.now() - networkStart;

    return {
      cpuUsage,
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      diskUsage: 0, // Would implement with disk usage library
      networkLatency,
      responseTime: Math.random() * 100 + 50, // Mock response time
      throughput: Math.random() * 1000 + 500 // Mock throughput
    };
  }

  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const currentUsage = process.cpuUsage(startUsage);
        const totalUsage = currentUsage.user + currentUsage.system;
        resolve(totalUsage / 1000000); // Convert to percentage
      }, 100);
    });
  }

  private generateRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.cpuUsage > 80) {
      recommendations.push('High CPU usage detected. Consider optimizing algorithms or scaling horizontally.');
    }

    if (metrics.memoryUsage > 85) {
      recommendations.push('High memory usage. Check for memory leaks and optimize data structures.');
    }

    if (metrics.responseTime > 1000) {
      recommendations.push('Slow response times. Consider implementing caching or database optimization.');
    }

    if (metrics.networkLatency > 200) {
      recommendations.push('High network latency. Consider using a CDN or optimizing API calls.');
    }

    return recommendations;
  }

  async analyzeCode(projectPath: string): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    // Analyze JavaScript/TypeScript files
    const jsFiles = await this.findFiles(projectPath, ['.js', '.ts', '.jsx', '.tsx']);
    
    for (const file of jsFiles) {
      const content = await fs.readFile(file, 'utf-8');
      const fileAnalysis = this.analyzeCodeFile(content);
      suggestions.push(...fileAnalysis);
    }

    return suggestions;
  }

  private async findFiles(dir: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory() && !['node_modules', '.git'].includes(item.name)) {
        files.push(...await this.findFiles(fullPath, extensions));
      } else if (item.isFile() && extensions.some(ext => item.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private analyzeCodeFile(content: string): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Check for synchronous operations
    if (content.includes('fs.readFileSync') || content.includes('fs.writeFileSync')) {
      suggestions.push({
        type: 'code',
        severity: 'medium',
        description: 'Synchronous file operations detected',
        solution: 'Replace with asynchronous versions (fs.readFile, fs.writeFile)',
        estimatedImpact: '20-30% performance improvement'
      });
    }

    // Check for console.log in production
    if (content.includes('console.log')) {
      suggestions.push({
        type: 'code',
        severity: 'low',
        description: 'Console.log statements found',
        solution: 'Remove or replace with proper logging library',
        estimatedImpact: '5-10% performance improvement'
      });
    }

    // Check for nested loops
    const nestedLoopPattern = /for\s*\([^}]*for\s*\(/g;
    if (nestedLoopPattern.test(content)) {
      suggestions.push({
        type: 'code',
        severity: 'high',
        description: 'Nested loops detected',
        solution: 'Consider optimizing with better algorithms or data structures',
        estimatedImpact: '50-80% performance improvement'
      });
    }

    return suggestions;
  }

  private async generateReport(result: ProfileResult): Promise<void> {
    const reportDir = path.join(process.cwd(), 'performance-reports');
    await fs.mkdir(reportDir, { recursive: true });

    const report = {
      summary: result,
      detailedMetrics: result.metrics,
      recommendations: result.recommendations,
      generatedAt: new Date().toISOString()
    };

    await fs.writeFile(
      path.join(reportDir, `${result.id}-report.json`),
      JSON.stringify(report, null, 2)
    );
  }

  stopProfiling(projectId: string): void {
    this.monitoringActive.set(projectId, false);
  }

  getProfiles(projectId: string): ProfileResult[] {
    return this.profiles.get(projectId) || [];
  }
}

export const performanceService = new PerformanceService();
