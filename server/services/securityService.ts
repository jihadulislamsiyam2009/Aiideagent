
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface Vulnerability {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'dependency' | 'code' | 'configuration' | 'secrets';
  title: string;
  description: string;
  file?: string;
  line?: number;
  cve?: string;
  cvss?: number;
  recommendation: string;
  fixable: boolean;
}

export interface SecurityScanResult {
  id: string;
  projectId: string;
  timestamp: Date;
  status: 'completed' | 'failed' | 'running';
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  vulnerabilities: Vulnerability[];
  duration: number;
}

export interface SecretScanResult {
  file: string;
  line: number;
  type: string;
  value: string;
  entropy: number;
  verified: boolean;
}

export interface ComplianceCheck {
  rule: string;
  status: 'pass' | 'fail' | 'warning';
  description: string;
  file?: string;
  line?: number;
}

export class SecurityService {
  private scanResults: Map<string, SecurityScanResult> = new Map();

  async scanProject(projectId: string, projectPath: string): Promise<string> {
    const scanId = `scan-${Date.now()}`;
    const startTime = Date.now();
    
    const result: SecurityScanResult = {
      id: scanId,
      projectId,
      timestamp: new Date(),
      status: 'running',
      summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0 },
      vulnerabilities: [],
      duration: 0
    };

    this.scanResults.set(scanId, result);

    try {
      // Run multiple security scans
      const [
        dependencyVulns,
        codeVulns,
        secretVulns,
        configVulns
      ] = await Promise.all([
        this.scanDependencies(projectPath),
        this.scanCode(projectPath),
        this.scanSecrets(projectPath),
        this.scanConfiguration(projectPath)
      ]);

      result.vulnerabilities = [
        ...dependencyVulns,
        ...codeVulns,
        ...secretVulns,
        ...configVulns
      ];

      // Calculate summary
      result.summary.total = result.vulnerabilities.length;
      result.vulnerabilities.forEach(vuln => {
        result.summary[vuln.severity]++;
      });

      result.status = 'completed';
      result.duration = Date.now() - startTime;

      // Generate security report
      await this.generateSecurityReport(result);

    } catch (error) {
      result.status = 'failed';
      result.vulnerabilities.push({
        id: 'scan-error',
        severity: 'high',
        type: 'configuration',
        title: 'Security Scan Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        recommendation: 'Review scan configuration and try again',
        fixable: false
      });
    }

    return scanId;
  }

  private async scanDependencies(projectPath: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    try {
      // Check for package.json
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonExists = await fs.access(packageJsonPath).then(() => true).catch(() => false);

      if (packageJsonExists) {
        const nodeVulns = await this.scanNodeDependencies(projectPath);
        vulnerabilities.push(...nodeVulns);
      }

      // Check for requirements.txt
      const requirementsPath = path.join(projectPath, 'requirements.txt');
      const requirementsExists = await fs.access(requirementsPath).then(() => true).catch(() => false);

      if (requirementsExists) {
        const pythonVulns = await this.scanPythonDependencies(projectPath);
        vulnerabilities.push(...pythonVulns);
      }

    } catch (error) {
      console.error('Dependency scan failed:', error);
    }

    return vulnerabilities;
  }

  private async scanNodeDependencies(projectPath: string): Promise<Vulnerability[]> {
    return new Promise((resolve) => {
      const auditProcess = spawn('npm', ['audit', '--json'], {
        cwd: projectPath,
        stdio: 'pipe'
      });

      let output = '';

      auditProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      auditProcess.on('close', () => {
        try {
          const auditResult = JSON.parse(output);
          const vulnerabilities: Vulnerability[] = [];

          if (auditResult.vulnerabilities) {
            for (const [name, vuln] of Object.entries(auditResult.vulnerabilities as any)) {
              vulnerabilities.push({
                id: `npm-${name}-${Date.now()}`,
                severity: vuln.severity || 'medium',
                type: 'dependency',
                title: `Vulnerable dependency: ${name}`,
                description: vuln.title || 'No description available',
                cve: vuln.cve?.[0],
                cvss: vuln.cvss?.score,
                recommendation: `Update ${name} to version ${vuln.fixAvailable?.version || 'latest'}`,
                fixable: !!vuln.fixAvailable
              });
            }
          }

          resolve(vulnerabilities);
        } catch {
          resolve([]);
        }
      });
    });
  }

  private async scanPythonDependencies(projectPath: string): Promise<Vulnerability[]> {
    return new Promise((resolve) => {
      const safetyProcess = spawn('python', ['-m', 'pip', 'install', 'safety'], {
        cwd: projectPath,
        stdio: 'pipe'
      });

      safetyProcess.on('close', () => {
        const checkProcess = spawn('safety', ['check', '--json'], {
          cwd: projectPath,
          stdio: 'pipe'
        });

        let output = '';

        checkProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        checkProcess.on('close', () => {
          try {
            const safetyResult = JSON.parse(output);
            const vulnerabilities: Vulnerability[] = [];

            for (const vuln of safetyResult) {
              vulnerabilities.push({
                id: `python-${vuln.package}-${Date.now()}`,
                severity: 'high',
                type: 'dependency',
                title: `Vulnerable Python package: ${vuln.package}`,
                description: vuln.advisory,
                recommendation: `Update ${vuln.package} to version ${vuln.spec}`,
                fixable: true
              });
            }

            resolve(vulnerabilities);
          } catch {
            resolve([]);
          }
        });
      });
    });
  }

  private async scanCode(projectPath: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    try {
      // Find code files
      const codeFiles = await this.findCodeFiles(projectPath);

      for (const file of codeFiles) {
        const content = await fs.readFile(file, 'utf-8');
        const fileVulns = this.analyzeCodeFile(file, content);
        vulnerabilities.push(...fileVulns);
      }
    } catch (error) {
      console.error('Code scan failed:', error);
    }

    return vulnerabilities;
  }

  private async findCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.php', '.rb'];

    const items = await fs.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);

      if (item.isDirectory() && !['node_modules', '.git', '__pycache__'].includes(item.name)) {
        files.push(...await this.findCodeFiles(fullPath));
      } else if (item.isFile() && codeExtensions.some(ext => item.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private analyzeCodeFile(filePath: string, content: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for SQL injection vulnerabilities
      if (this.isSqlInjectionVulnerable(line)) {
        vulnerabilities.push({
          id: `sql-injection-${filePath}-${lineNumber}`,
          severity: 'high',
          type: 'code',
          title: 'Potential SQL Injection',
          description: 'SQL query construction using string concatenation',
          file: filePath,
          line: lineNumber,
          recommendation: 'Use parameterized queries or prepared statements',
          fixable: true
        });
      }

      // Check for XSS vulnerabilities
      if (this.isXssVulnerable(line)) {
        vulnerabilities.push({
          id: `xss-${filePath}-${lineNumber}`,
          severity: 'medium',
          type: 'code',
          title: 'Potential XSS Vulnerability',
          description: 'Unescaped user input in HTML output',
          file: filePath,
          line: lineNumber,
          recommendation: 'Sanitize user input before rendering',
          fixable: true
        });
      }

      // Check for weak crypto
      if (this.isWeakCrypto(line)) {
        vulnerabilities.push({
          id: `weak-crypto-${filePath}-${lineNumber}`,
          severity: 'medium',
          type: 'code',
          title: 'Weak Cryptographic Algorithm',
          description: 'Use of deprecated or weak cryptographic functions',
          file: filePath,
          line: lineNumber,
          recommendation: 'Use strong cryptographic algorithms (AES, RSA 2048+)',
          fixable: true
        });
      }

      // Check for hardcoded passwords
      if (this.hasHardcodedPassword(line)) {
        vulnerabilities.push({
          id: `hardcoded-password-${filePath}-${lineNumber}`,
          severity: 'critical',
          type: 'secrets',
          title: 'Hardcoded Password',
          description: 'Password or secret key hardcoded in source code',
          file: filePath,
          line: lineNumber,
          recommendation: 'Move secrets to environment variables or secure vault',
          fixable: true
        });
      }
    }

    return vulnerabilities;
  }

  private isSqlInjectionVulnerable(line: string): boolean {
    const patterns = [
      /query\s*\+\s*['"]/i,
      /execute\s*\(\s*['"]/i,
      /\$\{.*\}.*SELECT/i,
      /f".*SELECT.*\{/i
    ];
    return patterns.some(pattern => pattern.test(line));
  }

  private isXssVulnerable(line: string): boolean {
    const patterns = [
      /innerHTML\s*=\s*[^'"].*\+/i,
      /document\.write\s*\(\s*[^'"].*\+/i,
      /\$\{.*\}.*<script/i,
      /dangerouslySetInnerHTML/i
    ];
    return patterns.some(pattern => pattern.test(line));
  }

  private isWeakCrypto(line: string): boolean {
    const patterns = [
      /md5\s*\(/i,
      /sha1\s*\(/i,
      /des\s*\(/i,
      /rc4\s*\(/i,
      /Math\.random\(\)/i
    ];
    return patterns.some(pattern => pattern.test(line));
  }

  private hasHardcodedPassword(line: string): boolean {
    const patterns = [
      /password\s*[:=]\s*['"]/i,
      /api[_-]?key\s*[:=]\s*['"]/i,
      /secret\s*[:=]\s*['"]/i,
      /token\s*[:=]\s*['"]/i
    ];
    return patterns.some(pattern => pattern.test(line));
  }

  private async scanSecrets(projectPath: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    try {
      const files = await this.findCodeFiles(projectPath);

      for (const file of files) {
        const content = await fs.readFile(file, 'utf-8');
        const secrets = this.detectSecrets(file, content);

        for (const secret of secrets) {
          vulnerabilities.push({
            id: `secret-${file}-${secret.line}`,
            severity: 'high',
            type: 'secrets',
            title: `Potential ${secret.type} exposed`,
            description: `High entropy string detected: ${secret.value.substring(0, 20)}...`,
            file: secret.file,
            line: secret.line,
            recommendation: 'Move secrets to environment variables or secure storage',
            fixable: true
          });
        }
      }
    } catch (error) {
      console.error('Secret scan failed:', error);
    }

    return vulnerabilities;
  }

  private detectSecrets(filePath: string, content: string): SecretScanResult[] {
    const secrets: SecretScanResult[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for high entropy strings
      const strings = line.match(/['"][A-Za-z0-9+/=]{20,}['"]/g) || [];

      for (const str of strings) {
        const cleaned = str.slice(1, -1); // Remove quotes
        const entropy = this.calculateEntropy(cleaned);

        if (entropy > 4.5) {
          secrets.push({
            file: filePath,
            line: lineNumber,
            type: this.classifySecret(cleaned),
            value: cleaned,
            entropy,
            verified: false
          });
        }
      }
    }

    return secrets;
  }

  private calculateEntropy(str: string): number {
    const freq: { [key: string]: number } = {};
    
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }

    let entropy = 0;
    const len = str.length;

    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  private classifySecret(str: string): string {
    if (/^[A-Za-z0-9+/=]+$/.test(str) && str.length % 4 === 0) {
      return 'Base64-encoded secret';
    }
    if (/^[A-Fa-f0-9]+$/.test(str) && str.length >= 32) {
      return 'Hexadecimal secret';
    }
    if (/^sk-[A-Za-z0-9]+$/.test(str)) {
      return 'OpenAI API Key';
    }
    if (/^ghp_[A-Za-z0-9]+$/.test(str)) {
      return 'GitHub Personal Access Token';
    }
    return 'High entropy string';
  }

  private async scanConfiguration(projectPath: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    try {
      // Check Docker configuration
      const dockerfilePath = path.join(projectPath, 'Dockerfile');
      const dockerfileExists = await fs.access(dockerfilePath).then(() => true).catch(() => false);

      if (dockerfileExists) {
        const dockerVulns = await this.scanDockerfile(dockerfilePath);
        vulnerabilities.push(...dockerVulns);
      }

      // Check NGINX configuration
      const nginxConfigs = await this.findFiles(projectPath, ['.conf']);
      for (const config of nginxConfigs) {
        if (config.includes('nginx')) {
          const nginxVulns = await this.scanNginxConfig(config);
          vulnerabilities.push(...nginxVulns);
        }
      }

    } catch (error) {
      console.error('Configuration scan failed:', error);
    }

    return vulnerabilities;
  }

  private async scanDockerfile(dockerfilePath: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    try {
      const content = await fs.readFile(dockerfilePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineNumber = i + 1;

        // Check for running as root
        if (line.startsWith('USER root') || (!content.includes('USER ') && line.startsWith('RUN'))) {
          vulnerabilities.push({
            id: `docker-root-${lineNumber}`,
            severity: 'medium',
            type: 'configuration',
            title: 'Container running as root',
            description: 'Container may be running with root privileges',
            file: dockerfilePath,
            line: lineNumber,
            recommendation: 'Create and use a non-root user',
            fixable: true
          });
        }

        // Check for latest tag
        if (line.includes(':latest')) {
          vulnerabilities.push({
            id: `docker-latest-${lineNumber}`,
            severity: 'low',
            type: 'configuration',
            title: 'Using latest tag',
            description: 'Using :latest tag can lead to unpredictable builds',
            file: dockerfilePath,
            line: lineNumber,
            recommendation: 'Pin to specific version tags',
            fixable: true
          });
        }
      }
    } catch (error) {
      console.error('Dockerfile scan failed:', error);
    }

    return vulnerabilities;
  }

  private async scanNginxConfig(configPath: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const lineNumber = i + 1;

        // Check for server_tokens
        if (line.includes('server_tokens') && line.includes('on')) {
          vulnerabilities.push({
            id: `nginx-tokens-${lineNumber}`,
            severity: 'low',
            type: 'configuration',
            title: 'Server tokens enabled',
            description: 'NGINX version information is exposed',
            file: configPath,
            line: lineNumber,
            recommendation: 'Set server_tokens off;',
            fixable: true
          });
        }

        // Check for missing security headers
        if (line.includes('location') && !content.includes('X-Content-Type-Options')) {
          vulnerabilities.push({
            id: `nginx-headers-${lineNumber}`,
            severity: 'medium',
            type: 'configuration',
            title: 'Missing security headers',
            description: 'Security headers not configured',
            file: configPath,
            line: lineNumber,
            recommendation: 'Add security headers (X-Content-Type-Options, X-Frame-Options, etc.)',
            fixable: true
          });
        }
      }
    } catch (error) {
      console.error('NGINX config scan failed:', error);
    }

    return vulnerabilities;
  }

  private async findFiles(dir: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];

    try {
      const items = await fs.readdir(dir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dir, item.name);

        if (item.isDirectory() && !['node_modules', '.git'].includes(item.name)) {
          files.push(...await this.findFiles(fullPath, extensions));
        } else if (item.isFile() && extensions.some(ext => item.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error('Error finding files:', error);
    }

    return files;
  }

  private async generateSecurityReport(result: SecurityScanResult): Promise<void> {
    const reportsDir = path.join(process.cwd(), 'security-reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const report = {
      id: result.id,
      projectId: result.projectId,
      timestamp: result.timestamp,
      summary: result.summary,
      vulnerabilities: result.vulnerabilities,
      recommendations: this.generateRecommendations(result),
      compliance: this.checkCompliance(result)
    };

    await fs.writeFile(
      path.join(reportsDir, `${result.id}-security-report.json`),
      JSON.stringify(report, null, 2)
    );
  }

  private generateRecommendations(result: SecurityScanResult): string[] {
    const recommendations: string[] = [];

    if (result.summary.critical > 0) {
      recommendations.push('Address critical vulnerabilities immediately');
    }

    if (result.summary.high > 0) {
      recommendations.push('Plan to fix high severity issues within 7 days');
    }

    const secretVulns = result.vulnerabilities.filter(v => v.type === 'secrets');
    if (secretVulns.length > 0) {
      recommendations.push('Implement secrets management solution');
    }

    const depVulns = result.vulnerabilities.filter(v => v.type === 'dependency');
    if (depVulns.length > 0) {
      recommendations.push('Update dependencies regularly and use automated scanning');
    }

    return recommendations;
  }

  private checkCompliance(result: SecurityScanResult): ComplianceCheck[] {
    const checks: ComplianceCheck[] = [];

    // OWASP Top 10 checks
    const hasXss = result.vulnerabilities.some(v => v.title.includes('XSS'));
    checks.push({
      rule: 'OWASP A03:2021 - Injection',
      status: hasXss ? 'fail' : 'pass',
      description: 'Cross-site scripting vulnerabilities'
    });

    const hasSqlInj = result.vulnerabilities.some(v => v.title.includes('SQL Injection'));
    checks.push({
      rule: 'OWASP A03:2021 - Injection',
      status: hasSqlInj ? 'fail' : 'pass',
      description: 'SQL injection vulnerabilities'
    });

    const hasSecrets = result.vulnerabilities.some(v => v.type === 'secrets');
    checks.push({
      rule: 'OWASP A02:2021 - Cryptographic Failures',
      status: hasSecrets ? 'fail' : 'pass',
      description: 'Exposed secrets and weak cryptography'
    });

    return checks;
  }

  getScanResult(scanId: string): SecurityScanResult | undefined {
    return this.scanResults.get(scanId);
  }

  getAllScans(projectId?: string): SecurityScanResult[] {
    const results = Array.from(this.scanResults.values());
    return projectId ? results.filter(r => r.projectId === projectId) : results;
  }
}

export const securityService = new SecurityService();
