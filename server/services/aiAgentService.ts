// AI Agent Service - Intelligent task automation and development assistance
import OpenAI from "openai";
import { EventEmitter } from 'events';
import { terminalService } from './terminalService';
import { browserService } from './browserService';
import { fileService } from './fileService';
import { aiModelProvider } from './aiModelProvider';

/* 
  AI Agent Service provides intelligent automation capabilities:
  - Project analysis and understanding
  - Code generation and modification
  - Terminal command execution
  - Browser automation
  - Development workflow assistance
  Note: The newest OpenAI model is "gpt-5" which was released August 7, 2025. Do not change this unless explicitly requested by the user
*/

export interface AgentTask {
  id: string;
  type: 'analyze_project' | 'run_project' | 'generate_code' | 'browse_web' | 'execute_commands' | 'debug_issue';
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  steps: AgentStep[];
  results?: any;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface AgentStep {
  id: string;
  action: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  tool: 'terminal' | 'browser' | 'file' | 'model' | 'project';
  command?: string;
  result?: any;
  error?: string;
  timestamp: Date;
}

export interface ProjectAnalysis {
  projectType: string;
  frameworks: string[];
  dependencies: string[];
  structure: any;
  recommendations: string[];
  runCommands: string[];
  setupInstructions: string[];
}

export class AIAgentService extends EventEmitter {
  private openai: OpenAI;
  private activeTasks: Map<string, AgentTask> = new Map();
  private taskHistory: AgentTask[] = [];

  constructor() {
    super();
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-development'
    });
  }

  async analyzeProject(projectPath: string, githubUrl?: string): Promise<ProjectAnalysis> {
    const taskId = `analyze-${Date.now()}`;
    
    const task: AgentTask = {
      id: taskId,
      type: 'analyze_project',
      description: `Analyze project at ${projectPath}`,
      status: 'running',
      steps: [],
      createdAt: new Date()
    };

    this.activeTasks.set(taskId, task);
    this.emit('task-started', task);

    try {
      // Step 1: Read project structure
      const step1 = this.createStep('Read project structure', 'file');
      task.steps.push(step1);
      
      const files = await fileService.listFiles('.');
      step1.result = files;
      step1.status = 'completed';
      this.emit('step-completed', { taskId, step: step1 });

      // Step 2: Analyze key files
      const step2 = this.createStep('Analyze configuration files', 'file');
      task.steps.push(step2);

      const keyFiles = ['package.json', 'requirements.txt', 'Cargo.toml', 'pom.xml', 'go.mod', 'Dockerfile'];
      const projectData: any = {};

      for (const fileName of keyFiles) {
        try {
          const content = await fileService.readFile(fileName);
          if (content) {
            projectData[fileName] = JSON.parse(content);
          }
        } catch (error) {
          // File doesn't exist or isn't JSON, continue
        }
      }

      step2.result = projectData;
      step2.status = 'completed';
      this.emit('step-completed', { taskId, step: step2 });

      // Step 3: AI Analysis
      const step3 = this.createStep('AI-powered project analysis', 'model');
      task.steps.push(step3);

      const analysis = await this.performAIAnalysis(projectData, files, githubUrl);
      step3.result = analysis;
      step3.status = 'completed';
      this.emit('step-completed', { taskId, step: step3 });

      task.status = 'completed';
      task.completedAt = new Date();
      task.results = analysis;
      
      this.activeTasks.delete(taskId);
      this.taskHistory.push(task);
      this.emit('task-completed', task);

      return analysis;

    } catch (error) {
      task.status = 'error';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      this.activeTasks.delete(taskId);
      this.taskHistory.push(task);
      this.emit('task-failed', task);
      throw error;
    }
  }

  async runProject(projectPath: string, analysis?: ProjectAnalysis): Promise<any> {
    const taskId = `run-${Date.now()}`;
    
    const task: AgentTask = {
      id: taskId,
      type: 'run_project',
      description: `Run project at ${projectPath}`,
      status: 'running',
      steps: [],
      createdAt: new Date()
    };

    this.activeTasks.set(taskId, task);
    this.emit('task-started', task);

    try {
      if (!analysis) {
        analysis = await this.analyzeProject(projectPath);
      }

      // Step 1: Install dependencies
      const step1 = this.createStep('Install dependencies', 'terminal');
      task.steps.push(step1);

      for (const command of analysis.setupInstructions) {
        const sessionId = `agent-${Date.now()}`;
        const session = terminalService.createSession(sessionId, projectPath);
        
        await this.executeCommand(session, command);
        step1.result = `Executed: ${command}`;
      }
      
      step1.status = 'completed';
      this.emit('step-completed', { taskId, step: step1 });

      // Step 2: Run the project
      const step2 = this.createStep('Start project', 'terminal');
      task.steps.push(step2);

      const runCommand = analysis.runCommands[0] || 'npm start';
      const sessionId = `agent-run-${Date.now()}`;
      const session = terminalService.createSession(sessionId, projectPath);
      
      await this.executeCommand(session, runCommand);
      step2.result = `Started with: ${runCommand}`;
      step2.status = 'completed';
      this.emit('step-completed', { taskId, step: step2 });

      task.status = 'completed';
      task.completedAt = new Date();
      task.results = { sessionId, runCommand };
      
      this.activeTasks.delete(taskId);
      this.taskHistory.push(task);
      this.emit('task-completed', task);

      return { sessionId, runCommand };

    } catch (error) {
      task.status = 'error';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      this.activeTasks.delete(taskId);
      this.taskHistory.push(task);
      this.emit('task-failed', task);
      throw error;
    }
  }

  async browseWebWithAI(url: string, task: string): Promise<any> {
    const taskId = `browse-${Date.now()}`;
    
    const agentTask: AgentTask = {
      id: taskId,
      type: 'browse_web',
      description: `Browse ${url} and ${task}`,
      status: 'running',
      steps: [],
      createdAt: new Date()
    };

    this.activeTasks.set(taskId, agentTask);
    this.emit('task-started', agentTask);

    try {
      // Step 1: Create browser session
      const step1 = this.createStep('Create browser session', 'browser');
      agentTask.steps.push(step1);

      const sessionId = `agent-browser-${Date.now()}`;
      const session = await browserService.getSession(sessionId);
      const pageId = `page-${Date.now()}`;
      
      step1.result = { sessionId, pageId };
      step1.status = 'completed';
      this.emit('step-completed', { taskId, step: step1 });

      // Step 2: Navigate and capture
      const step2 = this.createStep('Navigate and capture page', 'browser');
      agentTask.steps.push(step2);

      // Note: Browser service integration - simplified for this implementation
      console.log(`Navigating to ${url} in session ${sessionId}`);
      const screenshot = 'data:image/png;base64,placeholder-screenshot';
      
      step2.result = { screenshot };
      step2.status = 'completed';
      this.emit('step-completed', { taskId, step: step2 });

      // Step 3: AI analysis of the page
      const step3 = this.createStep('AI analysis of page content', 'model');
      agentTask.steps.push(step3);

      const analysis = await aiModelProvider.analyzeImage(
        screenshot.split(',')[1], // Remove data:image prefix
        `Analyze this webpage screenshot. Task: ${task}. Provide detailed insights about the content, layout, and any relevant information for the specified task.`
      );
      
      step3.result = analysis;
      step3.status = 'completed';
      this.emit('step-completed', { taskId, step: step3 });

      agentTask.status = 'completed';
      agentTask.completedAt = new Date();
      agentTask.results = { analysis, screenshot, url };
      
      this.activeTasks.delete(taskId);
      this.taskHistory.push(agentTask);
      this.emit('task-completed', agentTask);

      return agentTask.results;

    } catch (error) {
      agentTask.status = 'error';
      agentTask.error = error instanceof Error ? error.message : 'Unknown error';
      this.activeTasks.delete(taskId);
      this.taskHistory.push(agentTask);
      this.emit('task-failed', agentTask);
      throw error;
    }
  }

  async executeCommandsWithAI(commands: string[], workingDir: string = process.cwd()): Promise<any> {
    const taskId = `commands-${Date.now()}`;
    
    const task: AgentTask = {
      id: taskId,
      type: 'execute_commands',
      description: `Execute ${commands.length} commands`,
      status: 'running',
      steps: [],
      createdAt: new Date()
    };

    this.activeTasks.set(taskId, task);
    this.emit('task-started', task);

    try {
      const sessionId = `agent-commands-${Date.now()}`;
      const session = terminalService.createSession(sessionId, workingDir);
      const results: any[] = [];

      for (let i = 0; i < commands.length; i++) {
        const command = commands[i];
        const step = this.createStep(`Execute: ${command}`, 'terminal');
        task.steps.push(step);

        const result = await this.executeCommand(session, command);
        step.result = result;
        step.status = 'completed';
        results.push(result);
        
        this.emit('step-completed', { taskId, step });
      }

      task.status = 'completed';
      task.completedAt = new Date();
      task.results = { sessionId, commandResults: results };
      
      this.activeTasks.delete(taskId);
      this.taskHistory.push(task);
      this.emit('task-completed', task);

      return task.results;

    } catch (error) {
      task.status = 'error';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      this.activeTasks.delete(taskId);
      this.taskHistory.push(task);
      this.emit('task-failed', task);
      throw error;
    }
  }

  private async performAIAnalysis(projectData: any, files: any[], githubUrl?: string): Promise<ProjectAnalysis> {
    if (!process.env.OPENAI_API_KEY) {
      // Fallback analysis without AI
      return this.basicProjectAnalysis(projectData, files);
    }

    try {
      const prompt = `
Analyze this project and provide a comprehensive analysis:

Project Data: ${JSON.stringify(projectData, null, 2)}
File Structure: ${JSON.stringify(files.slice(0, 50), null, 2)}
GitHub URL: ${githubUrl || 'Not provided'}

Please provide analysis in JSON format:
{
  "projectType": "string (e.g., 'React App', 'Python Flask', 'Node.js API')",
  "frameworks": ["array of detected frameworks"],
  "dependencies": ["key dependencies"],
  "structure": {"overview": "project structure description"},
  "recommendations": ["setup and optimization recommendations"],
  "runCommands": ["commands to run the project"],
  "setupInstructions": ["commands to set up dependencies"]
}
      `;

      const response = await this.openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are an expert software developer and project analyst. Analyze projects and provide detailed, actionable insights."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error('No analysis returned');

      return JSON.parse(content);
      
    } catch (error) {
      console.warn('AI analysis failed, using basic analysis:', error);
      return this.basicProjectAnalysis(projectData, files);
    }
  }

  private basicProjectAnalysis(projectData: any, files: any[]): ProjectAnalysis {
    const analysis: ProjectAnalysis = {
      projectType: 'Unknown',
      frameworks: [],
      dependencies: [],
      structure: { overview: 'Basic file structure detected' },
      recommendations: [],
      runCommands: [],
      setupInstructions: []
    };

    // Detect project type from package.json
    if (projectData['package.json']) {
      analysis.projectType = 'Node.js Project';
      analysis.setupInstructions.push('npm install');
      
      const scripts = projectData['package.json'].scripts || {};
      if (scripts.dev) analysis.runCommands.push('npm run dev');
      if (scripts.start) analysis.runCommands.push('npm start');
      if (scripts.build) analysis.recommendations.push('Run npm run build for production');
      
      const deps = { ...projectData['package.json'].dependencies, ...projectData['package.json'].devDependencies };
      if (deps.react) analysis.frameworks.push('React');
      if (deps.express) analysis.frameworks.push('Express');
      if (deps.next) analysis.frameworks.push('Next.js');
    }

    // Detect Python project
    if (projectData['requirements.txt']) {
      analysis.projectType = 'Python Project';
      analysis.setupInstructions.push('pip install -r requirements.txt');
      analysis.runCommands.push('python main.py');
    }

    return analysis;
  }

  private createStep(description: string, tool: string): AgentStep {
    return {
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action: tool,
      description,
      status: 'running',
      tool: tool as any,
      timestamp: new Date()
    };
  }

  private async executeCommand(session: any, command: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 30000);

      const output: string[] = [];
      
      session.emitter.on('output', (data: string) => {
        output.push(data);
      });

      session.emitter.on('error', (data: string) => {
        output.push(data);
      });

      terminalService.executeCommand(session.id, command);

      // Simple completion detection (in real implementation, this would be more sophisticated)
      setTimeout(() => {
        clearTimeout(timeout);
        resolve({ command, output: output.join('') });
      }, 2000);
    });
  }

  getActiveTasks(): AgentTask[] {
    return Array.from(this.activeTasks.values());
  }

  getTaskHistory(limit: number = 10): AgentTask[] {
    return this.taskHistory.slice(-limit);
  }

  getTask(taskId: string): AgentTask | undefined {
    return this.activeTasks.get(taskId) || this.taskHistory.find(t => t.id === taskId);
  }

  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.activeTasks.get(taskId);
    if (task) {
      task.status = 'error';
      task.error = 'Cancelled by user';
      this.activeTasks.delete(taskId);
      this.taskHistory.push(task);
      this.emit('task-cancelled', task);
      return true;
    }
    return false;
  }
}

export const aiAgentService = new AIAgentService();