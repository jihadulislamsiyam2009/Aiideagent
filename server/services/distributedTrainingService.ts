
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { mlWorkflowService } from './mlWorkflowService';

export interface DistributedTrainingConfig {
  id: string;
  modelId: string;
  datasetId: string;
  strategy: 'data_parallel' | 'model_parallel' | 'hybrid';
  nodes: TrainingNode[];
  communication: 'nccl' | 'mpi' | 'gloo';
  checkpointing: boolean;
  faultTolerance: boolean;
  monitoring: boolean;
}

export interface TrainingNode {
  id: string;
  hostname: string;
  port: number;
  gpus: number;
  rank: number;
  worldSize: number;
  status: 'idle' | 'training' | 'error';
}

export interface DistributedJob {
  id: string;
  config: DistributedTrainingConfig;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  metrics: TrainingMetrics;
  logs: DistributedLog[];
  startTime: Date;
  endTime?: Date;
}

export interface TrainingMetrics {
  loss: number[];
  accuracy?: number[];
  throughput: number;
  gpuUtilization: Record<string, number[]>;
  communicationOverhead: number;
}

export interface DistributedLog {
  nodeId: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error';
  message: string;
}

export class DistributedTrainingService {
  private jobs: Map<string, DistributedJob> = new Map();
  private nodes: Map<string, TrainingNode> = new Map();

  async registerNode(node: Omit<TrainingNode, 'status'>): Promise<string> {
    const nodeWithStatus: TrainingNode = { ...node, status: 'idle' };
    this.nodes.set(node.id, nodeWithStatus);
    
    // Test node connectivity
    await this.testNodeConnection(nodeWithStatus);
    
    return node.id;
  }

  private async testNodeConnection(node: TrainingNode): Promise<void> {
    try {
      // In a real implementation, this would test SSH/network connectivity
      console.log(`Testing connection to node ${node.id} at ${node.hostname}:${node.port}`);
      
      // Mock connection test
      await new Promise(resolve => setTimeout(resolve, 100));
      
      node.status = 'idle';
    } catch (error) {
      node.status = 'error';
      throw new Error(`Failed to connect to node ${node.id}: ${error}`);
    }
  }

  async startDistributedTraining(config: DistributedTrainingConfig): Promise<string> {
    const jobId = `distributed-${Date.now()}`;
    
    const job: DistributedJob = {
      id: jobId,
      config,
      status: 'pending',
      progress: 0,
      metrics: {
        loss: [],
        accuracy: [],
        throughput: 0,
        gpuUtilization: {},
        communicationOverhead: 0
      },
      logs: [],
      startTime: new Date()
    };

    this.jobs.set(jobId, job);

    try {
      // Validate nodes are available
      await this.validateNodes(config.nodes);
      
      // Generate distributed training scripts
      await this.generateDistributedScripts(config);
      
      // Start training on all nodes
      await this.launchDistributedTraining(job);
      
    } catch (error) {
      job.status = 'failed';
      job.logs.push({
        nodeId: 'master',
        timestamp: new Date(),
        level: 'error',
        message: `Failed to start distributed training: ${error}`
      });
    }

    return jobId;
  }

  private async validateNodes(nodes: TrainingNode[]): Promise<void> {
    for (const node of nodes) {
      const registeredNode = this.nodes.get(node.id);
      if (!registeredNode || registeredNode.status !== 'idle') {
        throw new Error(`Node ${node.id} is not available for training`);
      }
    }
  }

  private async generateDistributedScripts(config: DistributedTrainingConfig): Promise<void> {
    const scriptsDir = path.join(process.cwd(), 'distributed-training', config.id);
    await fs.mkdir(scriptsDir, { recursive: true });

    // Generate master script
    const masterScript = this.generateMasterScript(config);
    await fs.writeFile(path.join(scriptsDir, 'master.py'), masterScript);

    // Generate worker script
    const workerScript = this.generateWorkerScript(config);
    await fs.writeFile(path.join(scriptsDir, 'worker.py'), workerScript);

    // Generate launch script
    const launchScript = this.generateLaunchScript(config);
    await fs.writeFile(path.join(scriptsDir, 'launch.sh'), launchScript);
    
    // Make launch script executable
    await fs.chmod(path.join(scriptsDir, 'launch.sh'), 0o755);
  }

  private generateMasterScript(config: DistributedTrainingConfig): string {
    return `
import torch
import torch.distributed as dist
import torch.nn as nn
import torch.optim as optim
from torch.nn.parallel import DistributedDataParallel as DDP
from torch.utils.data.distributed import DistributedSampler
import os
import json
import time
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DistributedTrainer:
    def __init__(self, rank, world_size):
        self.rank = rank
        self.world_size = world_size
        self.device = torch.device(f'cuda:{rank}' if torch.cuda.is_available() else 'cpu')
        
        # Initialize process group
        dist.init_process_group(
            backend='${config.communication}',
            rank=rank,
            world_size=world_size
        )
        
        logger.info(f"Initialized process group - Rank: {rank}, World Size: {world_size}")
    
    def setup_model_and_data(self):
        # Load model configuration
        with open('model_config.json', 'r') as f:
            model_config = json.load(f)
        
        # Initialize model (this would be loaded from your ML service)
        self.model = self._create_model(model_config)
        self.model = self.model.to(self.device)
        
        # Wrap model with DDP
        self.model = DDP(self.model, device_ids=[self.rank] if torch.cuda.is_available() else None)
        
        # Setup data loader with distributed sampler
        self.train_loader, self.val_loader = self._setup_data_loaders()
        
        # Setup optimizer and scheduler
        self.optimizer = optim.AdamW(self.model.parameters(), lr=0.001)
        self.scheduler = optim.lr_scheduler.ReduceLROnPlateau(self.optimizer, 'min')
        
        logger.info("Model and data setup completed")
    
    def _create_model(self, config):
        # This would integrate with your ML workflow service
        # For now, return a simple model
        return nn.Sequential(
            nn.Linear(config.get('input_size', 784), 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, config.get('num_classes', 10))
        )
    
    def _setup_data_loaders(self):
        # Load dataset (this would integrate with your dataset service)
        # Mock implementation for now
        from torch.utils.data import TensorDataset, DataLoader
        
        # Create dummy data
        X = torch.randn(10000, 784)
        y = torch.randint(0, 10, (10000,))
        dataset = TensorDataset(X, y)
        
        # Create distributed sampler
        sampler = DistributedSampler(dataset, rank=self.rank, num_replicas=self.world_size)
        
        train_loader = DataLoader(
            dataset, 
            batch_size=32,
            sampler=sampler,
            pin_memory=True
        )
        
        return train_loader, None
    
    def train_epoch(self, epoch):
        self.model.train()
        total_loss = 0
        num_batches = 0
        
        # Set epoch for distributed sampler
        self.train_loader.sampler.set_epoch(epoch)
        
        for batch_idx, (data, target) in enumerate(self.train_loader):
            data, target = data.to(self.device), target.to(self.device)
            
            self.optimizer.zero_grad()
            output = self.model(data)
            loss = nn.CrossEntropyLoss()(output, target)
            loss.backward()
            
            # Gradient clipping for stability
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            
            self.optimizer.step()
            
            total_loss += loss.item()
            num_batches += 1
            
            if batch_idx % 100 == 0 and self.rank == 0:
                logger.info(f'Epoch {epoch}, Batch {batch_idx}, Loss: {loss.item():.6f}')
                
                # Log metrics
                self._log_metrics({
                    'epoch': epoch,
                    'batch': batch_idx,
                    'loss': loss.item(),
                    'gpu_utilization': self._get_gpu_utilization()
                })
        
        avg_loss = total_loss / num_batches
        
        # All-reduce to get global average loss
        loss_tensor = torch.tensor(avg_loss).to(self.device)
        dist.all_reduce(loss_tensor, op=dist.ReduceOp.SUM)
        global_avg_loss = loss_tensor.item() / self.world_size
        
        return global_avg_loss
    
    def _get_gpu_utilization(self):
        if torch.cuda.is_available():
            return torch.cuda.utilization(self.rank)
        return 0
    
    def _log_metrics(self, metrics):
        # Log metrics to file for monitoring
        with open(f'metrics_rank_{self.rank}.json', 'a') as f:
            metrics['timestamp'] = time.time()
            metrics['rank'] = self.rank
            f.write(json.dumps(metrics) + '\\n')
    
    def save_checkpoint(self, epoch, loss):
        if self.rank == 0:  # Only master saves checkpoints
            checkpoint = {
                'epoch': epoch,
                'model_state_dict': self.model.module.state_dict(),
                'optimizer_state_dict': self.optimizer.state_dict(),
                'loss': loss,
                'world_size': self.world_size
            }
            
            checkpoint_path = f'checkpoint_epoch_{epoch}.pth'
            torch.save(checkpoint, checkpoint_path)
            logger.info(f"Checkpoint saved: {checkpoint_path}")
    
    def train(self, num_epochs=10):
        logger.info(f"Starting distributed training for {num_epochs} epochs")
        
        for epoch in range(num_epochs):
            epoch_loss = self.train_epoch(epoch)
            
            if self.rank == 0:
                logger.info(f"Epoch {epoch} completed - Average Loss: {epoch_loss:.6f}")
                
                # Save checkpoint
                if epoch % 5 == 0:  # Save every 5 epochs
                    self.save_checkpoint(epoch, epoch_loss)
        
        if self.rank == 0:
            logger.info("Distributed training completed")
    
    def cleanup(self):
        dist.destroy_process_group()
        logger.info("Process group destroyed")

def main():
    # Get rank and world size from environment variables
    rank = int(os.environ.get('RANK', 0))
    world_size = int(os.environ.get('WORLD_SIZE', 1))
    
    # Initialize trainer
    trainer = DistributedTrainer(rank, world_size)
    
    try:
        # Setup model and data
        trainer.setup_model_and_data()
        
        # Start training
        trainer.train(num_epochs=50)
        
    except Exception as e:
        logger.error(f"Training failed: {str(e)}")
        raise
    finally:
        trainer.cleanup()

if __name__ == '__main__':
    main()
`;
  }

  private generateWorkerScript(config: DistributedTrainingConfig): string {
    return `
import subprocess
import sys
import os
import json
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def setup_worker_environment():
    """Setup the worker node environment"""
    
    # Set CUDA visible devices
    if 'CUDA_VISIBLE_DEVICES' not in os.environ:
        rank = int(os.environ.get('RANK', 0))
        os.environ['CUDA_VISIBLE_DEVICES'] = str(rank)
    
    # Setup distributed environment variables
    master_addr = os.environ.get('MASTER_ADDR', 'localhost')
    master_port = os.environ.get('MASTER_PORT', '12355')
    
    logger.info(f"Worker setup - Master: {master_addr}:{master_port}")

def monitor_training():
    """Monitor training progress and system metrics"""
    
    metrics_file = f"metrics_rank_{os.environ.get('RANK', 0)}.json"
    
    while True:
        if os.path.exists(metrics_file):
            try:
                with open(metrics_file, 'r') as f:
                    lines = f.readlines()
                    if lines:
                        latest_metrics = json.loads(lines[-1])
                        
                        # Log system metrics
                        logger.info(f"Latest metrics: {latest_metrics}")
                        
            except Exception as e:
                logger.warning(f"Error reading metrics: {e}")
        
        time.sleep(10)

def main():
    setup_worker_environment()
    
    # Start monitoring in background
    import threading
    monitor_thread = threading.Thread(target=monitor_training, daemon=True)
    monitor_thread.start()
    
    # Execute the main training script
    try:
        subprocess.run([sys.executable, 'master.py'], check=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"Training process failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
`;
  }

  private generateLaunchScript(config: DistributedTrainingConfig): string {
    const masterNode = config.nodes.find(n => n.rank === 0);
    if (!masterNode) throw new Error('No master node found');

    return `#!/bin/bash

# Distributed Training Launch Script
# Configuration: ${config.id}

set -e

export MASTER_ADDR=${masterNode.hostname}
export MASTER_PORT=${masterNode.port}
export WORLD_SIZE=${config.nodes.length}
export NCCL_DEBUG=INFO

echo "Starting distributed training..."
echo "Master: $MASTER_ADDR:$MASTER_PORT"
echo "World Size: $WORLD_SIZE"
echo "Strategy: ${config.strategy}"
echo "Communication Backend: ${config.communication}"

# Function to launch training on a node
launch_node() {
    local rank=$1
    local hostname=$2
    local port=$3
    
    echo "Launching rank $rank on $hostname"
    
    if [ "$hostname" = "localhost" ] || [ "$hostname" = "$(hostname)" ]; then
        # Local execution
        RANK=$rank python worker.py &
    else
        # Remote execution via SSH
        ssh $hostname "cd $(pwd) && RANK=$rank MASTER_ADDR=$MASTER_ADDR MASTER_PORT=$MASTER_PORT WORLD_SIZE=$WORLD_SIZE python worker.py" &
    fi
    
    echo "Launched rank $rank (PID: $!)"
}

# Launch all nodes
${config.nodes.map(node => `launch_node ${node.rank} ${node.hostname} ${node.port}`).join('\n')}

echo "All nodes launched. Waiting for completion..."

# Wait for all background processes
wait

echo "Distributed training completed"
`;
  }

  private async launchDistributedTraining(job: DistributedJob): Promise<void> {
    const scriptsDir = path.join(process.cwd(), 'distributed-training', job.config.id);
    
    job.status = 'running';
    job.logs.push({
      nodeId: 'master',
      timestamp: new Date(),
      level: 'info',
      message: 'Starting distributed training'
    });

    return new Promise((resolve, reject) => {
      const launchProcess = spawn('bash', ['launch.sh'], {
        cwd: scriptsDir,
        stdio: 'pipe'
      });

      launchProcess.stdout.on('data', (data) => {
        const message = data.toString();
        job.logs.push({
          nodeId: 'master',
          timestamp: new Date(),
          level: 'info',
          message: message.trim()
        });
        
        // Parse progress from logs
        const progressMatch = message.match(/Epoch (\d+)/);
        if (progressMatch) {
          const epoch = parseInt(progressMatch[1]);
          job.progress = Math.min((epoch / 50) * 100, 100); // Assuming 50 epochs
        }
      });

      launchProcess.stderr.on('data', (data) => {
        const message = data.toString();
        job.logs.push({
          nodeId: 'master',
          timestamp: new Date(),
          level: 'warning',
          message: message.trim()
        });
      });

      launchProcess.on('close', (code) => {
        job.endTime = new Date();
        
        if (code === 0) {
          job.status = 'completed';
          job.progress = 100;
          resolve();
        } else {
          job.status = 'failed';
          job.logs.push({
            nodeId: 'master',
            timestamp: new Date(),
            level: 'error',
            message: `Training failed with exit code ${code}`
          });
          reject(new Error(`Distributed training failed with code ${code}`));
        }
      });

      // Start monitoring metrics
      this.startMetricsMonitoring(job);
    });
  }

  private startMetricsMonitoring(job: DistributedJob): void {
    const interval = setInterval(async () => {
      if (job.status !== 'running') {
        clearInterval(interval);
        return;
      }

      try {
        // Collect metrics from all nodes
        await this.collectDistributedMetrics(job);
      } catch (error) {
        console.error('Error collecting distributed metrics:', error);
      }
    }, 5000);
  }

  private async collectDistributedMetrics(job: DistributedJob): Promise<void> {
    const scriptsDir = path.join(process.cwd(), 'distributed-training', job.config.id);
    
    // Collect metrics from each rank
    for (const node of job.config.nodes) {
      const metricsFile = path.join(scriptsDir, `metrics_rank_${node.rank}.json`);
      
      try {
        const exists = await fs.access(metricsFile).then(() => true).catch(() => false);
        if (exists) {
          const content = await fs.readFile(metricsFile, 'utf-8');
          const lines = content.trim().split('\n').filter(line => line.trim());
          
          if (lines.length > 0) {
            const latestMetrics = JSON.parse(lines[lines.length - 1]);
            
            // Update job metrics
            if (latestMetrics.loss) {
              job.metrics.loss.push(latestMetrics.loss);
            }
            
            if (latestMetrics.gpu_utilization) {
              if (!job.metrics.gpuUtilization[node.id]) {
                job.metrics.gpuUtilization[node.id] = [];
              }
              job.metrics.gpuUtilization[node.id].push(latestMetrics.gpu_utilization);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading metrics for rank ${node.rank}:`, error);
      }
    }
  }

  async getJobStatus(jobId: string): Promise<DistributedJob | undefined> {
    return this.jobs.get(jobId);
  }

  async cancelJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Job not found');

    if (job.status === 'running') {
      // In a real implementation, this would send kill signals to all nodes
      job.status = 'failed';
      job.endTime = new Date();
      
      job.logs.push({
        nodeId: 'master',
        timestamp: new Date(),
        level: 'info',
        message: 'Job cancelled by user'
      });
    }
  }

  getAvailableNodes(): TrainingNode[] {
    return Array.from(this.nodes.values()).filter(node => node.status === 'idle');
  }

  getAllJobs(): DistributedJob[] {
    return Array.from(this.jobs.values());
  }
}

export const distributedTrainingService = new DistributedTrainingService();
