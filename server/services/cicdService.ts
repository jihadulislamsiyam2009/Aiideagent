
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export interface PipelineConfig {
  id: string;
  name: string;
  projectId: string;
  stages: PipelineStage[];
  triggers: PipelineTrigger[];
  environment: Record<string, string>;
}

export interface PipelineStage {
  name: string;
  steps: PipelineStep[];
  condition?: string;
  parallel?: boolean;
}

export interface PipelineStep {
  name: string;
  command: string;
  workingDirectory?: string;
  timeout?: number;
  continueOnError?: boolean;
}

export interface PipelineTrigger {
  type: 'push' | 'pull_request' | 'schedule' | 'manual';
  branches?: string[];
  schedule?: string;
}

export interface PipelineRun {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  logs: string[];
  stages: StageResult[];
}

export interface StageResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startTime: Date;
  endTime?: Date;
  steps: StepResult[];
}

export interface StepResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  output: string;
  exitCode?: number;
}

export class CiCdService {
  private pipelines: Map<string, PipelineConfig> = new Map();
  private runs: Map<string, PipelineRun> = new Map();

  async createPipeline(config: PipelineConfig): Promise<void> {
    this.pipelines.set(config.id, config);
    
    // Generate GitHub Actions workflow
    await this.generateGithubActions(config);
    
    // Generate GitLab CI configuration
    await this.generateGitlabCI(config);
    
    // Generate Jenkins pipeline
    await this.generateJenkinsPipeline(config);
  }

  async runPipeline(pipelineId: string, trigger: string = 'manual'): Promise<string> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) throw new Error('Pipeline not found');

    const runId = `run-${Date.now()}`;
    const run: PipelineRun = {
      id: runId,
      pipelineId,
      status: 'running',
      startTime: new Date(),
      logs: [],
      stages: []
    };

    this.runs.set(runId, run);

    try {
      for (const stage of pipeline.stages) {
        const stageResult = await this.executeStage(stage, pipeline, run);
        run.stages.push(stageResult);
        
        if (stageResult.status === 'failed') {
          run.status = 'failed';
          break;
        }
      }
      
      if (run.status === 'running') {
        run.status = 'success';
      }
    } catch (error) {
      run.status = 'failed';
      run.logs.push(`Pipeline failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    run.endTime = new Date();
    return runId;
  }

  private async executeStage(stage: PipelineStage, pipeline: PipelineConfig, run: PipelineRun): Promise<StageResult> {
    const stageResult: StageResult = {
      name: stage.name,
      status: 'running',
      startTime: new Date(),
      steps: []
    };

    run.logs.push(`Starting stage: ${stage.name}`);

    try {
      if (stage.parallel) {
        // Execute steps in parallel
        const stepPromises = stage.steps.map(step => this.executeStep(step, pipeline));
        const stepResults = await Promise.all(stepPromises);
        stageResult.steps = stepResults;
      } else {
        // Execute steps sequentially
        for (const step of stage.steps) {
          const stepResult = await this.executeStep(step, pipeline);
          stageResult.steps.push(stepResult);
          
          if (stepResult.status === 'failed' && !step.continueOnError) {
            stageResult.status = 'failed';
            break;
          }
        }
      }
      
      if (stageResult.status === 'running') {
        stageResult.status = 'success';
      }
    } catch (error) {
      stageResult.status = 'failed';
      run.logs.push(`Stage ${stage.name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    stageResult.endTime = new Date();
    return stageResult;
  }

  private async executeStep(step: PipelineStep, pipeline: PipelineConfig): Promise<StepResult> {
    const stepResult: StepResult = {
      name: step.name,
      status: 'running',
      output: ''
    };

    return new Promise((resolve) => {
      const process = spawn('bash', ['-c', step.command], {
        cwd: step.workingDirectory || process.cwd(),
        env: { ...process.env, ...pipeline.environment },
        stdio: 'pipe'
      });

      let output = '';

      process.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        stepResult.output += chunk;
      });

      process.stderr.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        stepResult.output += chunk;
      });

      process.on('close', (code) => {
        stepResult.exitCode = code || 0;
        stepResult.status = code === 0 ? 'success' : 'failed';
        resolve(stepResult);
      });

      // Handle timeout
      if (step.timeout) {
        setTimeout(() => {
          process.kill('SIGTERM');
          stepResult.status = 'failed';
          stepResult.output += '\nStep timed out';
          resolve(stepResult);
        }, step.timeout);
      }
    });
  }

  private async generateGithubActions(config: PipelineConfig): Promise<void> {
    const workflow = {
      name: config.name,
      on: this.generateGithubTriggers(config.triggers),
      jobs: {
        build: {
          'runs-on': 'ubuntu-latest',
          steps: [
            { name: 'Checkout', uses: 'actions/checkout@v3' },
            { name: 'Setup Node.js', uses: 'actions/setup-node@v3', with: { 'node-version': '18' } },
            ...config.stages.flatMap(stage => 
              stage.steps.map(step => ({
                name: step.name,
                run: step.command,
                'working-directory': step.workingDirectory,
                'continue-on-error': step.continueOnError
              }))
            )
          ]
        }
      }
    };

    const workflowsDir = path.join(process.cwd(), '.github', 'workflows');
    await fs.mkdir(workflowsDir, { recursive: true });
    await fs.writeFile(
      path.join(workflowsDir, `${config.name.toLowerCase().replace(/\s+/g, '-')}.yml`),
      yaml.dump(workflow)
    );
  }

  private generateGithubTriggers(triggers: PipelineTrigger[]): any {
    const githubTriggers: any = {};
    
    for (const trigger of triggers) {
      switch (trigger.type) {
        case 'push':
          githubTriggers.push = trigger.branches ? { branches: trigger.branches } : {};
          break;
        case 'pull_request':
          githubTriggers.pull_request = trigger.branches ? { branches: trigger.branches } : {};
          break;
        case 'schedule':
          githubTriggers.schedule = [{ cron: trigger.schedule }];
          break;
      }
    }
    
    return githubTriggers;
  }

  private async generateGitlabCI(config: PipelineConfig): Promise<void> {
    const gitlabConfig: any = {
      stages: config.stages.map(stage => stage.name)
    };

    for (const stage of config.stages) {
      for (const step of stage.steps) {
        gitlabConfig[`${stage.name}_${step.name}`] = {
          stage: stage.name,
          script: [step.command],
          only: config.triggers.some(t => t.type === 'push') ? ['main'] : undefined
        };
      }
    }

    await fs.writeFile(
      path.join(process.cwd(), '.gitlab-ci.yml'),
      yaml.dump(gitlabConfig)
    );
  }

  private async generateJenkinsPipeline(config: PipelineConfig): Promise<void> {
    const jenkinsfile = `
pipeline {
    agent any
    
    environment {
${Object.entries(config.environment).map(([key, value]) => `        ${key} = '${value}'`).join('\n')}
    }
    
    stages {
${config.stages.map(stage => `
        stage('${stage.name}') {
            steps {
${stage.steps.map(step => `                sh '${step.command}'`).join('\n')}
            }
        }`).join('')}
    }
    
    post {
        always {
            cleanWs()
        }
    }
}`;

    await fs.writeFile(path.join(process.cwd(), 'Jenkinsfile'), jenkinsfile);
  }

  getPipelineRun(runId: string): PipelineRun | undefined {
    return this.runs.get(runId);
  }

  getPipelines(): PipelineConfig[] {
    return Array.from(this.pipelines.values());
  }

  async generateDefaultPipeline(projectType: string): Promise<PipelineConfig> {
    const pipelineTemplates = {
      'react-typescript': {
        stages: [
          {
            name: 'test',
            steps: [
              { name: 'Install dependencies', command: 'npm ci' },
              { name: 'Run tests', command: 'npm test' },
              { name: 'Type check', command: 'npm run type-check' }
            ]
          },
          {
            name: 'build',
            steps: [
              { name: 'Build application', command: 'npm run build' }
            ]
          },
          {
            name: 'deploy',
            steps: [
              { name: 'Deploy to production', command: 'npm run deploy' }
            ]
          }
        ]
      },
      'python-flask': {
        stages: [
          {
            name: 'test',
            steps: [
              { name: 'Install dependencies', command: 'pip install -r requirements.txt' },
              { name: 'Run tests', command: 'python -m pytest' },
              { name: 'Lint code', command: 'flake8 .' }
            ]
          },
          {
            name: 'build',
            steps: [
              { name: 'Build package', command: 'python setup.py build' }
            ]
          }
        ]
      }
    };

    const template = pipelineTemplates[projectType as keyof typeof pipelineTemplates] || pipelineTemplates['react-typescript'];
    
    return {
      id: `pipeline-${Date.now()}`,
      name: `${projectType} Pipeline`,
      projectId: 'default',
      stages: template.stages,
      triggers: [
        { type: 'push', branches: ['main'] },
        { type: 'pull_request' }
      ],
      environment: {}
    };
  }
}

export const cicdService = new CiCdService();
