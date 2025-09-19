import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import os from 'os';

export interface TerminalSession {
  id: string;
  process: ChildProcess;
  cwd: string;
  emitter: EventEmitter;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
}

export interface TerminalCommand {
  command: string;
  timestamp: Date;
  output?: string;
  error?: string;
  exitCode?: number;
}

export class TerminalService {
  private sessions: Map<string, TerminalSession> = new Map();
  private commandHistory: Map<string, TerminalCommand[]> = new Map();

  createSession(sessionId: string, initialCwd: string = process.cwd()): TerminalSession {
    // Clean up existing session if it exists
    this.closeSession(sessionId);

    const emitter = new EventEmitter();
    
    // Determine shell based on OS
    const shell = os.platform() === 'win32' ? 'cmd.exe' : '/bin/bash';
    const shellArgs = os.platform() === 'win32' ? [] : [];

    const childProcess = spawn(shell, shellArgs, {
      cwd: initialCwd,
      stdio: 'pipe',
      env: { ...process.env, TERM: 'xterm-256color' }
    });

    const session: TerminalSession = {
      id: sessionId,
      process: childProcess,
      cwd: initialCwd,
      emitter,
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date()
    };

    // Set up event listeners
    childProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      session.lastActivity = new Date();
      emitter.emit('output', output);
    });

    childProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      session.lastActivity = new Date();
      emitter.emit('error', error);
    });

    childProcess.on('close', (code) => {
      session.isActive = false;
      emitter.emit('exit', code);
    });

    childProcess.on('error', (error) => {
      console.error(`Terminal session ${sessionId} error:`, error);
      session.isActive = false;
      emitter.emit('process-error', error);
    });

    this.sessions.set(sessionId, session);
    this.commandHistory.set(sessionId, []);

    return session;
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): TerminalSession[] {
    return Array.from(this.sessions.values());
  }

  executeCommand(sessionId: string, command: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      throw new Error(`Terminal session ${sessionId} not found or inactive`);
    }

    return new Promise((resolve, reject) => {
      const commandRecord: TerminalCommand = {
        command: command.trim(),
        timestamp: new Date()
      };

      // Add command to history
      const history = this.commandHistory.get(sessionId) || [];
      history.push(commandRecord);
      this.commandHistory.set(sessionId, history);

      session.lastActivity = new Date();

      try {
        // Send command to the shell
        session.process.stdin?.write(command + '\n');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async changeDirectory(sessionId: string, newPath: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.isActive) {
      throw new Error(`Terminal session ${sessionId} not found or inactive`);
    }

    const resolvedPath = path.resolve(session.cwd, newPath);
    
    // Update session CWD
    session.cwd = resolvedPath;
    
    // Send cd command
    await this.executeCommand(sessionId, `cd "${resolvedPath}"`);
  }

  getCommandHistory(sessionId: string): TerminalCommand[] {
    return this.commandHistory.get(sessionId) || [];
  }

  clearHistory(sessionId: string): void {
    this.commandHistory.set(sessionId, []);
  }

  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return false;
    }

    try {
      if (session.isActive && session.process && !session.process.killed) {
        session.process.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (!session.process.killed) {
            session.process.kill('SIGKILL');
          }
        }, 5000);
      }
      
      session.isActive = false;
      session.emitter.removeAllListeners();
      
      this.sessions.delete(sessionId);
      this.commandHistory.delete(sessionId);
      
      return true;
    } catch (error) {
      console.error(`Error closing terminal session ${sessionId}:`, error);
      return false;
    }
  }

  closeAllSessions(): void {
    for (const sessionId of Array.from(this.sessions.keys())) {
      this.closeSession(sessionId);
    }
  }

  // Install commonly needed tools
  async installDependency(sessionId: string, dependency: string, manager: 'npm' | 'pip' | 'apt' = 'npm'): Promise<void> {
    const commands = {
      npm: `npm install ${dependency}`,
      pip: `pip install ${dependency}`,
      apt: `sudo apt-get install -y ${dependency}`
    };

    await this.executeCommand(sessionId, commands[manager]);
  }

  // Run common development tasks
  async runProject(sessionId: string, projectType: string = 'node'): Promise<void> {
    const commands = {
      node: 'npm start',
      python: 'python main.py',
      react: 'npm run dev',
      nextjs: 'npm run dev',
      django: 'python manage.py runserver',
      flask: 'flask run'
    };

    const command = commands[projectType as keyof typeof commands] || 'npm start';
    await this.executeCommand(sessionId, command);
  }

  // System resource monitoring
  async getSystemInfo(sessionId: string): Promise<void> {
    const isWindows = os.platform() === 'win32';
    const commands = [
      isWindows ? 'systeminfo | findstr "Total Physical Memory"' : 'free -h',
      isWindows ? 'wmic cpu get name' : 'lscpu | grep "Model name"',
      isWindows ? 'wmic logicaldisk get size,freespace,caption' : 'df -h'
    ];

    for (const command of commands) {
      await this.executeCommand(sessionId, command);
    }
  }
}

export const terminalService = new TerminalService();
