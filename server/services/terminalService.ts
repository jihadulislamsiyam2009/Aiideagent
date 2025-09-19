
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

export interface TerminalSession {
  id: string;
  process: ChildProcess | null;
  cwd: string;
  emitter: EventEmitter;
  isActive: boolean;
  createdAt: Date;
  lastActivity: Date;
  environment: NodeJS.ProcessEnv;
}

export interface TerminalCommand {
  command: string;
  timestamp: Date;
  cwd: string;
  output?: string;
  error?: string;
  exitCode?: number;
}

export class TerminalService {
  private sessions: Map<string, TerminalSession> = new Map();
  private commandHistory: Map<string, TerminalCommand[]> = new Map();

  createSession(sessionId: string, initialCwd: string = process.cwd()): TerminalSession {
    this.closeSession(sessionId);

    const emitter = new EventEmitter();
    
    // Use bash/zsh on Unix, PowerShell on Windows
    const isWindows = os.platform() === 'win32';
    const shell = isWindows ? 'powershell.exe' : (process.env.SHELL || '/bin/bash');
    const shellArgs = isWindows ? ['-NoProfile', '-ExecutionPolicy', 'Bypass'] : ['-l'];

    const childProcess = spawn(shell, shellArgs, {
      cwd: initialCwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        TERM: 'xterm-256color',
        PS1: '\\[\\033[01;32m\\]\\u@\\h\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]$ ',
        FORCE_COLOR: '1'
      },
      shell: false
    });

    const session: TerminalSession = {
      id: sessionId,
      process: childProcess,
      cwd: initialCwd,
      emitter,
      isActive: true,
      createdAt: new Date(),
      lastActivity: new Date(),
      environment: { ...process.env, TERM: 'xterm-256color' }
    };

    // Set up real-time data streaming
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
      session.process = null;
      emitter.emit('exit', code);
    });

    childProcess.on('error', (error) => {
      console.error(`Terminal session ${sessionId} error:`, error);
      session.isActive = false;
      session.process = null;
      emitter.emit('process-error', error.message);
    });

    // Send initial prompt
    setTimeout(() => {
      emitter.emit('output', `\x1b[32m${os.userInfo().username}@${os.hostname()}\x1b[0m:\x1b[34m${initialCwd}\x1b[0m$ `);
    }, 100);

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
    if (!session || !session.isActive || !session.process) {
      throw new Error('Terminal session not found or inactive');
    }

    // Handle built-in commands first
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
    this.commandHistory.set(sessionId, history.slice(-100));

    session.lastActivity = new Date();

    try {
      // Send command to shell with newline
      session.process.stdin?.write(command + '\n');
    } catch (error: any) {
      console.error(`Error executing command in session ${sessionId}:`, error);
      session.emitter.emit('error', `Error: ${error.message}\n`);
    }
  }

  async changeDirectory(sessionId: string, newPath: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive || !session.process) {
      throw new Error(`Terminal session ${sessionId} not found or inactive`);
    }

    const resolvedPath = path.resolve(session.cwd, newPath);

    try {
      await fs.access(resolvedPath);
      const stats = await fs.stat(resolvedPath);
      if (stats.isDirectory()) {
        session.cwd = resolvedPath;
        session.emitter.emit('output', `\n\x1b[32m${os.userInfo().username}@${os.hostname()}\x1b[0m:\x1b[34m${resolvedPath}\x1b[0m$ `);
      } else {
        session.emitter.emit('error', `cd: not a directory: ${newPath}\n`);
      }
    } catch (error) {
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
    if (!session) return false;

    try {
      if (session.isActive && session.process && !session.process.killed) {
        // Graceful shutdown
        session.process.stdin?.write('exit\n');
        
        setTimeout(() => {
          if (session.process && !session.process.killed) {
            session.process.kill('SIGTERM');
          }
        }, 1000);

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

  async installDependency(sessionId: string, dependency: string, manager: 'npm' | 'pip' | 'apt' = 'npm'): Promise<void> {
    const commands = {
      npm: `npm install ${dependency}`,
      pip: `pip install ${dependency}`,
      apt: `sudo apt-get install -y ${dependency}`
    };

    await this.executeCommand(sessionId, commands[manager]);
  }

  async runProject(sessionId: string, projectType: string = 'node'): Promise<void> {
    const commands = {
      node: 'npm start',
      python: 'python main.py',
      react: 'npm run dev',
      nextjs: 'npm run dev',
      django: 'python manage.py runserver 0.0.0.0:8000',
      flask: 'flask run --host=0.0.0.0 --port=5000'
    };

    const command = commands[projectType as keyof typeof commands] || 'npm start';
    await this.executeCommand(sessionId, command);
  }

  async getSystemInfo(sessionId: string): Promise<void> {
    const isWindows = os.platform() === 'win32';
    const commands = [
      isWindows ? 'systeminfo | findstr "Total Physical Memory"' : 'free -h',
      isWindows ? 'wmic cpu get name' : 'lscpu | grep "Model name"',
      isWindows ? 'wmic logicaldisk get size,freespace,caption' : 'df -h',
      'node --version',
      'npm --version',
      'python --version',
      'git --version'
    ];

    for (const command of commands) {
      await this.executeCommand(sessionId, command);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  private async handleBuiltinCommand(session: TerminalSession, command: string): Promise<boolean> {
    const parts = command.trim().split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case 'cd':
        const newPath = args[0] || os.homedir();
        await this.changeDirectory(session.id, newPath);
        return true;

      case 'pwd':
        session.emitter.emit('output', `${session.cwd}\n\x1b[32m${os.userInfo().username}@${os.hostname()}\x1b[0m:\x1b[34m${session.cwd}\x1b[0m$ `);
        return true;

      case 'clear':
        session.emitter.emit('clear', '');
        setTimeout(() => {
          session.emitter.emit('output', `\x1b[32m${os.userInfo().username}@${os.hostname()}\x1b[0m:\x1b[34m${session.cwd}\x1b[0m$ `);
        }, 50);
        return true;

      case 'echo':
        session.emitter.emit('output', `${args.join(' ')}\n\x1b[32m${os.userInfo().username}@${os.hostname()}\x1b[0m:\x1b[34m${session.cwd}\x1b[0m$ `);
        return true;

      case 'env':
        const envVars = Object.entries(session.environment)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');
        session.emitter.emit('output', `${envVars}\n\x1b[32m${os.userInfo().username}@${os.hostname()}\x1b[0m:\x1b[34m${session.cwd}\x1b[0m$ `);
        return true;

      case 'history':
        const history = this.commandHistory.get(session.id) || [];
        const historyOutput = history
          .map((entry, index) => `${index + 1}  ${entry.command}`)
          .join('\n');
        session.emitter.emit('output', `${historyOutput}\n\x1b[32m${os.userInfo().username}@${os.hostname()}\x1b[0m:\x1b[34m${session.cwd}\x1b[0m$ `);
        return true;

      case 'help':
        const helpText = `
\x1b[1mBuilt-in commands:\x1b[0m
  cd <dir>     - Change directory
  pwd          - Print working directory
  clear        - Clear terminal
  echo <text>  - Print text
  env          - Show environment variables
  history      - Show command history
  help         - Show this help
  exit         - Exit terminal session

\x1b[1mSystem commands are also available:\x1b[0m
  ls, cat, grep, find, cp, mv, rm, mkdir, rmdir, 
  npm, node, python, git, curl, wget, etc.
`;
        session.emitter.emit('output', `${helpText}\n\x1b[32m${os.userInfo().username}@${os.hostname()}\x1b[0m:\x1b[34m${session.cwd}\x1b[0m$ `);
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

    if (parts.length === 1 && !lastPart.includes('/')) {
      const builtinCommands = ['cd', 'pwd', 'clear', 'echo', 'env', 'history', 'help', 'exit'];
      const systemCommands = ['ls', 'cat', 'grep', 'find', 'cp', 'mv', 'rm', 'mkdir', 'rmdir', 'npm', 'node', 'python', 'git', 'curl', 'wget', 'vim', 'nano', 'code'];

      const allCommands = [...builtinCommands, ...systemCommands];
      suggestions.push(...allCommands.filter(cmd => cmd.startsWith(lastPart)));
    } else {
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
        // Ignore errors during completion
      }
    }

    return suggestions.slice(0, 10);
  }

  // Real-time process monitoring
  async getRunningProcesses(sessionId: string): Promise<void> {
    const isWindows = os.platform() === 'win32';
    const command = isWindows ? 'tasklist' : 'ps aux';
    await this.executeCommand(sessionId, command);
  }

  // Network utilities
  async pingHost(sessionId: string, host: string): Promise<void> {
    const isWindows = os.platform() === 'win32';
    const command = isWindows ? `ping -n 4 ${host}` : `ping -c 4 ${host}`;
    await this.executeCommand(sessionId, command);
  }

  // File operations
  async createQuickFile(sessionId: string, filename: string, content: string = ''): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error('Session not found');

    const filePath = path.join(session.cwd, filename);
    try {
      await fs.writeFile(filePath, content);
      session.emitter.emit('output', `Created file: ${filename}\n\x1b[32m${os.userInfo().username}@${os.hostname()}\x1b[0m:\x1b[34m${session.cwd}\x1b[0m$ `);
    } catch (error: any) {
      session.emitter.emit('error', `Error creating file: ${error.message}\n\x1b[32m${os.userInfo().username}@${os.hostname()}\x1b[0m:\x1b[34m${session.cwd}\x1b[0m$ `);
    }
  }
}

export const terminalService = new TerminalService();
