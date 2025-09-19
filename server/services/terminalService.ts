import { spawn, ChildProcess, exec } from 'child_process';
import { EventEmitter } from 'events';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

export interface TerminalSession {
  id: string;
  process: ChildProcess | null; // Allow null when process is not running
  cwd: string;
  emitter: EventEmitter;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
  environment?: NodeJS.ProcessEnv; // For custom environment variables
}

export interface TerminalCommand {
  command: string;
  timestamp: Date;
  cwd?: string; // Store CWD at the time of command execution
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
      lastActivity: new Date(),
      environment: { ...process.env, TERM: 'xterm-256color' } // Initialize with current env
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
      session.process = null; // Clear the process reference
      emitter.emit('exit', code);
    });

    childProcess.on('error', (error) => {
      console.error(`Terminal session ${sessionId} error:`, error);
      session.isActive = false;
      session.process = null; // Clear the process reference
      emitter.emit('process-error', error.message);
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

  async executeCommand(sessionId: string, command: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Terminal session not found');
    }

    if (!session.isActive || !session.process) {
      throw new Error('Terminal session is not active or process is not available');
    }

    // Handle built-in commands
    if (await this.handleBuiltinCommand(session, command)) {
      return;
    }

    // Add to command history
    const history = this.commandHistory.get(sessionId) || [];
    history.push({
      command,
      timestamp: new Date(),
      cwd: session.cwd
    });
    this.commandHistory.set(sessionId, history.slice(-100)); // Keep last 100 commands

    session.lastActivity = new Date();

    try {
      // Send command to the shell
      session.process.stdin?.write(command + '\n');
    } catch (error: any) {
      console.error(`Error writing to stdin for session ${sessionId}:`, error);
      session.emitter.emit('error', `Error executing command: ${error.message}\n`);
    }
  }

  async changeDirectory(sessionId: string, newPath: string): Promise<void> {
    const session = this.sessions.get(sessionId);

    if (!session || !session.isActive || !session.process) {
      throw new Error(`Terminal session ${sessionId} not found or inactive`);
    }

    const resolvedPath = path.resolve(session.cwd, newPath);

    try {
      // Check if the path exists and is a directory before changing
      const stats = await fs.stat(resolvedPath);
      if (stats.isDirectory()) {
        session.cwd = resolvedPath;
        // Emit an output message for successful cd
        session.emitter.emit('output', `Changed directory to ${resolvedPath}\n`);
      } else {
        session.emitter.emit('error', `cd: not a directory: ${newPath}\n`);
      }
    } catch (error: any) {
      // Handle errors like "No such file or directory"
      session.emitter.emit('error', `cd: no such file or directory: ${newPath}\n`);
    }
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
          if (session.process && !session.process.killed) {
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

  private async handleBuiltinCommand(session: TerminalSession, command: string): Promise<boolean> {
    const parts = command.trim().split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case 'cd':
        const newPath = args[0] || os.homedir();
        const resolvedPath = path.resolve(session.cwd, newPath);

        try {
          await fs.access(resolvedPath);
          const stats = await fs.stat(resolvedPath);
          if (stats.isDirectory()) {
            session.cwd = resolvedPath;
            session.emitter.emit('output', `Changed directory to ${resolvedPath}\n`);
          } else {
            session.emitter.emit('error', `cd: not a directory: ${newPath}\n`);
          }
        } catch (error) {
          session.emitter.emit('error', `cd: no such file or directory: ${newPath}\n`);
        }
        return true;

      case 'pwd':
        session.emitter.emit('output', `${session.cwd}\n`);
        return true;

      case 'clear':
        session.emitter.emit('clear', '');
        return true;

      case 'echo':
        session.emitter.emit('output', `${args.join(' ')}\n`);
        return true;

      case 'env':
        const envVars = Object.entries(session.environment)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');
        session.emitter.emit('output', `${envVars}\n`);
        return true;

      case 'history':
        const history = this.commandHistory.get(session.id) || [];
        const historyOutput = history
          .map((entry, index) => `${index + 1}  ${entry.command}`)
          .join('\n');
        session.emitter.emit('output', `${historyOutput}\n`);
        return true;

      case 'help':
        const helpText = `
Built-in commands:
  cd <dir>     - Change directory
  pwd          - Print working directory
  clear        - Clear terminal
  echo <text>  - Print text
  env          - Show environment variables
  history      - Show command history
  help         - Show this help
  exit         - Exit terminal session

System commands are also available (ls, cat, grep, etc.)
`;
        session.emitter.emit('output', helpText);
        return true;

      case 'exit':
        this.closeSession(session.id);
        return true;

      default:
        return false;
    }
  }

  async autocomplete(sessionId: string, partialCommand: string): Promise<string[]> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    const suggestions: string[] = [];
    const parts = partialCommand.split(' ');
    const lastPart = parts[parts.length - 1];

    // Command completion
    if (parts.length === 1 && !lastPart.includes('/') && !lastPart.includes('.') && !lastPart.includes('..')) {
      const builtinCommands = ['cd', 'pwd', 'clear', 'echo', 'env', 'history', 'help', 'exit'];
      // Note: System commands might be harder to autocomplete reliably without executing them or having a predefined list.
      // For simplicity, we'll focus on common ones and built-ins.
      const systemCommands = ['ls', 'cat', 'grep', 'find', 'cp', 'mv', 'rm', 'mkdir', 'rmdir', 'npm', 'node', 'git'];

      const allCommands = [...builtinCommands, ...systemCommands];
      suggestions.push(...allCommands.filter(cmd => cmd.startsWith(lastPart)));
    } else {
      // File/directory completion
      try {
        let dirPath = '.';
        let baseName = lastPart;

        if (lastPart.includes('/')) {
          dirPath = path.dirname(lastPart);
          baseName = path.basename(lastPart);
        }

        const fullPath = path.resolve(session.cwd, dirPath);

        const items = await fs.readdir(fullPath, { withFileTypes: true });
        for (const item of items) {
          if (item.name.startsWith(baseName)) {
            const suggestion = path.join(dirPath, item.name);
            suggestions.push(item.isDirectory() ? suggestion + '/' : suggestion);
          }
        }
      } catch (error) {
        // Ignore errors during completion (e.g., directory not found)
        console.warn(`Autocomplete error for path "${partialCommand}":`, error);
      }
    }

    return suggestions.slice(0, 10); // Limit to 10 suggestions
  }
}

export const terminalService = new TerminalService();