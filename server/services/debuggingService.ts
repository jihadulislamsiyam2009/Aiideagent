
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface DebugSession {
  id: string;
  projectId: string;
  type: 'node' | 'python' | 'browser' | 'remote';
  status: 'starting' | 'active' | 'paused' | 'terminated';
  breakpoints: Breakpoint[];
  watchExpressions: WatchExpression[];
  callStack: CallFrame[];
  variables: Variable[];
  logs: DebugLog[];
}

export interface Breakpoint {
  id: string;
  file: string;
  line: number;
  column?: number;
  condition?: string;
  enabled: boolean;
  hitCount: number;
}

export interface WatchExpression {
  id: string;
  expression: string;
  value?: any;
  error?: string;
}

export interface CallFrame {
  id: string;
  functionName: string;
  file: string;
  line: number;
  column: number;
  variables: Variable[];
}

export interface Variable {
  name: string;
  value: any;
  type: string;
  scope: 'local' | 'global' | 'closure';
  expandable: boolean;
  children?: Variable[];
}

export interface DebugLog {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
}

export interface ErrorAnalysis {
  id: string;
  error: ErrorInfo;
  suggestions: ErrorSuggestion[];
  similarErrors: SimilarError[];
  fixAttempts: FixAttempt[];
  resolution?: ErrorResolution;
}

export interface ErrorInfo {
  type: string;
  message: string;
  stack: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string;
  context: Record<string, any>;
}

export interface ErrorSuggestion {
  id: string;
  type: 'quick-fix' | 'refactor' | 'documentation';
  description: string;
  confidence: number;
  changes?: CodeChange[];
  documentation?: string;
}

export interface CodeChange {
  file: string;
  startLine: number;
  endLine: number;
  oldCode: string;
  newCode: string;
}

export interface SimilarError {
  similarity: number;
  resolution: string;
  frequency: number;
}

export interface FixAttempt {
  id: string;
  timestamp: Date;
  strategy: string;
  changes: CodeChange[];
  result: 'success' | 'failed' | 'partial';
  feedback?: string;
}

export interface ErrorResolution {
  strategy: string;
  appliedChanges: CodeChange[];
  testResults?: TestResult[];
  feedback: string;
}

export interface TestResult {
  passed: boolean;
  description: string;
  error?: string;
}

export class DebuggingService {
  private debugSessions: Map<string, DebugSession> = new Map();
  private errorAnalyses: Map<string, ErrorAnalysis> = new Map();
  private errorDatabase: Map<string, ErrorAnalysis[]> = new Map();

  async startDebugSession(projectId: string, type: DebugSession['type'], config: any): Promise<string> {
    const sessionId = `debug-${Date.now()}`;
    
    const session: DebugSession = {
      id: sessionId,
      projectId,
      type,
      status: 'starting',
      breakpoints: [],
      watchExpressions: [],
      callStack: [],
      variables: [],
      logs: []
    };

    this.debugSessions.set(sessionId, session);

    try {
      await this.initializeDebugger(session, config);
      session.status = 'active';
    } catch (error) {
      session.status = 'terminated';
      throw error;
    }

    return sessionId;
  }

  private async initializeDebugger(session: DebugSession, config: any): Promise<void> {
    const projectPath = path.join(process.cwd(), 'projects', session.projectId);

    switch (session.type) {
      case 'node':
        await this.initializeNodeDebugger(session, projectPath, config);
        break;
      case 'python':
        await this.initializePythonDebugger(session, projectPath, config);
        break;
      case 'browser':
        await this.initializeBrowserDebugger(session, config);
        break;
      case 'remote':
        await this.initializeRemoteDebugger(session, config);
        break;
    }
  }

  private async initializeNodeDebugger(session: DebugSession, projectPath: string, config: any): Promise<void> {
    // Generate debug configuration
    const debugConfig = {
      type: 'node',
      request: 'launch',
      name: `Debug ${session.projectId}`,
      program: config.entryPoint || '${workspaceFolder}/index.js',
      cwd: projectPath,
      env: config.environment || {},
      runtimeArgs: ['--inspect-brk=0.0.0.0:9229'],
      console: 'integratedTerminal',
      restart: true,
      protocol: 'inspector'
    };

    // Save debug configuration
    const vscodeDir = path.join(projectPath, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });
    
    const launchConfig = {
      version: '0.2.0',
      configurations: [debugConfig]
    };

    await fs.writeFile(
      path.join(vscodeDir, 'launch.json'),
      JSON.stringify(launchConfig, null, 2)
    );

    session.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: 'Node.js debugger initialized',
      source: 'debugger'
    });
  }

  private async initializePythonDebugger(session: DebugSession, projectPath: string, config: any): Promise<void> {
    // Install debugpy if not available
    const installDebugpy = spawn('pip', ['install', 'debugpy'], {
      cwd: projectPath,
      stdio: 'pipe'
    });

    await new Promise((resolve, reject) => {
      installDebugpy.on('close', (code) => {
        if (code === 0) resolve(code);
        else reject(new Error(`Failed to install debugpy`));
      });
    });

    // Generate Python debug script
    const debugScript = `
import debugpy
import sys
import os

# Enable debugpy
debugpy.listen(('0.0.0.0', ${config.port || 5678}))
print("Debugger listening on port ${config.port || 5678}")

# Wait for client to attach
if ${config.waitForClient ? 'True' : 'False'}:
    debugpy.wait_for_client()

# Import and run the main module
sys.path.insert(0, os.path.dirname(__file__))

try:
    exec(open('${config.entryPoint || 'main.py'}').read())
except Exception as e:
    print(f"Error running application: {e}")
    import traceback
    traceback.print_exc()
`;

    await fs.writeFile(path.join(projectPath, 'debug_main.py'), debugScript);

    session.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: 'Python debugger initialized',
      source: 'debugger'
    });
  }

  private async initializeBrowserDebugger(session: DebugSession, config: any): Promise<void> {
    // Browser debugging would integrate with Chrome DevTools Protocol
    session.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: 'Browser debugger initialized',
      source: 'debugger'
    });
  }

  private async initializeRemoteDebugger(session: DebugSession, config: any): Promise<void> {
    // Remote debugging configuration
    session.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: `Remote debugger connecting to ${config.host}:${config.port}`,
      source: 'debugger'
    });
  }

  async addBreakpoint(sessionId: string, file: string, line: number, condition?: string): Promise<string> {
    const session = this.debugSessions.get(sessionId);
    if (!session) throw new Error('Debug session not found');

    const breakpointId = `bp-${Date.now()}`;
    const breakpoint: Breakpoint = {
      id: breakpointId,
      file,
      line,
      condition,
      enabled: true,
      hitCount: 0
    };

    session.breakpoints.push(breakpoint);

    session.logs.push({
      timestamp: new Date(),
      level: 'debug',
      message: `Breakpoint added at ${file}:${line}`,
      source: 'debugger'
    });

    return breakpointId;
  }

  async addWatchExpression(sessionId: string, expression: string): Promise<string> {
    const session = this.debugSessions.get(sessionId);
    if (!session) throw new Error('Debug session not found');

    const watchId = `watch-${Date.now()}`;
    const watchExpression: WatchExpression = {
      id: watchId,
      expression
    };

    session.watchExpressions.push(watchExpression);

    // Evaluate expression immediately if session is paused
    if (session.status === 'paused') {
      await this.evaluateWatchExpression(session, watchExpression);
    }

    return watchId;
  }

  private async evaluateWatchExpression(session: DebugSession, watch: WatchExpression): Promise<void> {
    try {
      // This would integrate with the actual debugger protocol
      // For now, we'll simulate evaluation
      watch.value = `<evaluation of ${watch.expression}>`;
    } catch (error) {
      watch.error = error instanceof Error ? error.message : 'Evaluation failed';
    }
  }

  async analyzeError(error: ErrorInfo): Promise<string> {
    const analysisId = `error-${Date.now()}`;
    
    const analysis: ErrorAnalysis = {
      id: analysisId,
      error,
      suggestions: [],
      similarErrors: [],
      fixAttempts: [],
    };

    // Generate suggestions based on error type
    analysis.suggestions = await this.generateErrorSuggestions(error);
    
    // Find similar errors from database
    analysis.similarErrors = await this.findSimilarErrors(error);

    this.errorAnalyses.set(analysisId, analysis);
    
    // Add to error database for learning
    const errorKey = this.generateErrorKey(error);
    const existingErrors = this.errorDatabase.get(errorKey) || [];
    existingErrors.push(analysis);
    this.errorDatabase.set(errorKey, existingErrors);

    return analysisId;
  }

  private async generateErrorSuggestions(error: ErrorInfo): Promise<ErrorSuggestion[]> {
    const suggestions: ErrorSuggestion[] = [];

    // Pattern matching for common errors
    if (error.type.includes('SyntaxError')) {
      suggestions.push(...this.generateSyntaxErrorSuggestions(error));
    } else if (error.type.includes('TypeError')) {
      suggestions.push(...this.generateTypeErrorSuggestions(error));
    } else if (error.type.includes('ReferenceError')) {
      suggestions.push(...this.generateReferenceErrorSuggestions(error));
    } else if (error.type.includes('ImportError') || error.type.includes('ModuleNotFoundError')) {
      suggestions.push(...this.generateImportErrorSuggestions(error));
    }

    return suggestions;
  }

  private generateSyntaxErrorSuggestions(error: ErrorInfo): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [];

    if (error.message.includes('missing') && error.message.includes('parenthesis')) {
      suggestions.push({
        id: 'missing-parenthesis',
        type: 'quick-fix',
        description: 'Add missing parenthesis',
        confidence: 0.9,
        changes: error.file && error.line ? [{
          file: error.file,
          startLine: error.line,
          endLine: error.line,
          oldCode: error.code || '',
          newCode: this.suggestParenthesisFix(error.code || '')
        }] : undefined
      });
    }

    if (error.message.includes('unexpected token')) {
      suggestions.push({
        id: 'unexpected-token',
        type: 'quick-fix',
        description: 'Fix unexpected token',
        confidence: 0.7,
        documentation: 'Check for missing semicolons, commas, or brackets'
      });
    }

    return suggestions;
  }

  private generateTypeErrorSuggestions(error: ErrorInfo): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [];

    if (error.message.includes('is not a function')) {
      suggestions.push({
        id: 'not-a-function',
        type: 'quick-fix',
        description: 'Check if the variable is properly initialized as a function',
        confidence: 0.8,
        documentation: 'This error occurs when trying to call a variable that is not a function'
      });
    }

    if (error.message.includes('Cannot read property')) {
      suggestions.push({
        id: 'null-property',
        type: 'quick-fix',
        description: 'Add null/undefined check before accessing property',
        confidence: 0.85,
        changes: error.file && error.line ? [{
          file: error.file,
          startLine: error.line,
          endLine: error.line,
          oldCode: error.code || '',
          newCode: this.suggestNullCheck(error.code || '', error.message)
        }] : undefined
      });
    }

    return suggestions;
  }

  private generateReferenceErrorSuggestions(error: ErrorInfo): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [];

    if (error.message.includes('is not defined')) {
      const varName = this.extractVariableName(error.message);
      if (varName) {
        suggestions.push({
          id: 'undefined-variable',
          type: 'quick-fix',
          description: `Declare variable '${varName}' or check for typos`,
          confidence: 0.8,
          documentation: `The variable '${varName}' is referenced but not declared`
        });
      }
    }

    return suggestions;
  }

  private generateImportErrorSuggestions(error: ErrorInfo): ErrorSuggestion[] {
    const suggestions: ErrorSuggestion[] = [];

    const moduleName = this.extractModuleName(error.message);
    if (moduleName) {
      suggestions.push({
        id: 'install-module',
        type: 'quick-fix',
        description: `Install missing module: ${moduleName}`,
        confidence: 0.9,
        documentation: `Run: npm install ${moduleName} or pip install ${moduleName}`
      });
    }

    return suggestions;
  }

  private suggestParenthesisFix(code: string): string {
    // Simple heuristic to add missing parenthesis
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    
    if (openParens > closeParens) {
      return code + ')';
    } else if (closeParens > openParens) {
      return '(' + code;
    }
    
    return code;
  }

  private suggestNullCheck(code: string, errorMessage: string): string {
    const propertyMatch = errorMessage.match(/Cannot read property '(.+)' of (.+)/);
    if (propertyMatch) {
      const property = propertyMatch[1];
      const object = propertyMatch[2];
      return code.replace(
        new RegExp(`${object}\\.${property}`, 'g'),
        `${object}?.${property}`
      );
    }
    return code;
  }

  private extractVariableName(message: string): string | null {
    const match = message.match(/'(.+)' is not defined/);
    return match ? match[1] : null;
  }

  private extractModuleName(message: string): string | null {
    const match = message.match(/No module named '(.+)'/);
    return match ? match[1] : null;
  }

  private async findSimilarErrors(error: ErrorInfo): Promise<SimilarError[]> {
    const errorKey = this.generateErrorKey(error);
    const similarErrors: SimilarError[] = [];

    // Search through error database
    for (const [key, analyses] of this.errorDatabase.entries()) {
      if (key !== errorKey) {
        const similarity = this.calculateErrorSimilarity(errorKey, key);
        if (similarity > 0.7) {
          const resolvedAnalyses = analyses.filter(a => a.resolution);
          if (resolvedAnalyses.length > 0) {
            similarErrors.push({
              similarity,
              resolution: resolvedAnalyses[0].resolution!.strategy,
              frequency: resolvedAnalyses.length
            });
          }
        }
      }
    }

    return similarErrors.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  private generateErrorKey(error: ErrorInfo): string {
    return `${error.type}:${error.message.substring(0, 50)}`;
  }

  private calculateErrorSimilarity(key1: string, key2: string): number {
    // Simple similarity calculation using Levenshtein distance
    const distance = this.levenshteinDistance(key1, key2);
    const maxLength = Math.max(key1.length, key2.length);
    return 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  async attemptAutoFix(analysisId: string, suggestionId: string): Promise<string> {
    const analysis = this.errorAnalyses.get(analysisId);
    if (!analysis) throw new Error('Error analysis not found');

    const suggestion = analysis.suggestions.find(s => s.id === suggestionId);
    if (!suggestion) throw new Error('Suggestion not found');

    const fixId = `fix-${Date.now()}`;
    
    const fixAttempt: FixAttempt = {
      id: fixId,
      timestamp: new Date(),
      strategy: suggestion.description,
      changes: suggestion.changes || [],
      result: 'failed'
    };

    analysis.fixAttempts.push(fixAttempt);

    try {
      if (suggestion.changes) {
        // Apply code changes
        for (const change of suggestion.changes) {
          await this.applyCodeChange(change);
        }

        // Test the fix
        const testResults = await this.testFix(analysis.error.file);
        
        if (testResults.every(r => r.passed)) {
          fixAttempt.result = 'success';
          
          analysis.resolution = {
            strategy: suggestion.description,
            appliedChanges: suggestion.changes,
            testResults,
            feedback: 'Fix applied successfully'
          };
        } else {
          fixAttempt.result = 'partial';
          fixAttempt.feedback = 'Fix applied but tests still failing';
        }
      }
    } catch (error) {
      fixAttempt.result = 'failed';
      fixAttempt.feedback = error instanceof Error ? error.message : 'Fix failed';
    }

    return fixId;
  }

  private async applyCodeChange(change: CodeChange): Promise<void> {
    const content = await fs.readFile(change.file, 'utf-8');
    const lines = content.split('\n');
    
    // Replace the specified lines
    for (let i = change.startLine - 1; i < change.endLine; i++) {
      if (i < lines.length) {
        lines[i] = lines[i].replace(change.oldCode, change.newCode);
      }
    }
    
    await fs.writeFile(change.file, lines.join('\n'));
  }

  private async testFix(filePath?: string): Promise<TestResult[]> {
    // Run basic syntax check
    const results: TestResult[] = [];
    
    if (filePath) {
      try {
        const extension = path.extname(filePath);
        
        if (extension === '.js' || extension === '.ts') {
          // Test JavaScript/TypeScript syntax
          await this.testJavaScriptSyntax(filePath);
          results.push({
            passed: true,
            description: 'JavaScript syntax check passed'
          });
        } else if (extension === '.py') {
          // Test Python syntax
          await this.testPythonSyntax(filePath);
          results.push({
            passed: true,
            description: 'Python syntax check passed'
          });
        }
      } catch (error) {
        results.push({
          passed: false,
          description: 'Syntax check failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return results;
  }

  private async testJavaScriptSyntax(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const testProcess = spawn('node', ['-c', filePath], { stdio: 'pipe' });
      
      testProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('JavaScript syntax error'));
        }
      });
    });
  }

  private async testPythonSyntax(filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const testProcess = spawn('python', ['-m', 'py_compile', filePath], { stdio: 'pipe' });
      
      testProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error('Python syntax error'));
        }
      });
    });
  }

  getDebugSession(sessionId: string): DebugSession | undefined {
    return this.debugSessions.get(sessionId);
  }

  getErrorAnalysis(analysisId: string): ErrorAnalysis | undefined {
    return this.errorAnalyses.get(analysisId);
  }

  getAllDebugSessions(): DebugSession[] {
    return Array.from(this.debugSessions.values());
  }

  getAllErrorAnalyses(): ErrorAnalysis[] {
    return Array.from(this.errorAnalyses.values());
  }

  async terminateDebugSession(sessionId: string): Promise<void> {
    const session = this.debugSessions.get(sessionId);
    if (session) {
      session.status = 'terminated';
      session.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: 'Debug session terminated',
        source: 'debugger'
      });
    }
  }
}

export const debuggingService = new DebuggingService();
