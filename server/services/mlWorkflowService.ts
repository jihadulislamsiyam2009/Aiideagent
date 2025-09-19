
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export interface MLDataset {
  id: string;
  name: string;
  type: 'supervised' | 'unsupervised' | 'reinforcement';
  format: 'csv' | 'json' | 'parquet' | 'hdf5' | 'tfrecord';
  size: number;
  features: DatasetFeature[];
  path: string;
  metadata: Record<string, any>;
}

export interface DatasetFeature {
  name: string;
  type: 'numerical' | 'categorical' | 'text' | 'image' | 'audio';
  nullable: boolean;
  unique: boolean;
  statistics?: FeatureStatistics;
}

export interface FeatureStatistics {
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  nullCount?: number;
  uniqueCount?: number;
  categories?: string[];
}

export interface MLModel {
  id: string;
  name: string;
  type: 'classification' | 'regression' | 'clustering' | 'nlp' | 'cv';
  framework: 'tensorflow' | 'pytorch' | 'scikit-learn' | 'xgboost' | 'transformers';
  version: string;
  metrics: ModelMetrics;
  hyperparameters: Record<string, any>;
  status: 'training' | 'completed' | 'failed' | 'deployed';
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1Score?: number;
  rmse?: number;
  mae?: number;
  r2Score?: number;
  loss?: number;
  trainingTime?: number;
}

export interface TrainingConfig {
  modelId: string;
  datasetId: string;
  epochs: number;
  batchSize: number;
  learningRate: number;
  optimizer: string;
  lossFunction: string;
  metrics: string[];
  gpuEnabled: boolean;
  distributedTraining: boolean;
  validationSplit: number;
  earlyStopping: boolean;
  callbacks: TrainingCallback[];
}

export interface TrainingCallback {
  type: 'early_stopping' | 'model_checkpoint' | 'reduce_lr' | 'tensorboard';
  parameters: Record<string, any>;
}

export interface TrainingJob {
  id: string;
  modelId: string;
  config: TrainingConfig;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  logs: string[];
  startTime: Date;
  endTime?: Date;
  gpuUtilization?: number[];
  memoryUsage?: number[];
}

export class MLWorkflowService {
  private datasets: Map<string, MLDataset> = new Map();
  private models: Map<string, MLModel> = new Map();
  private trainingJobs: Map<string, TrainingJob> = new Map();

  async createDataset(config: Omit<MLDataset, 'id'>): Promise<string> {
    const datasetId = `dataset-${Date.now()}`;
    const dataset: MLDataset = { ...config, id: datasetId };
    
    this.datasets.set(datasetId, dataset);
    
    // Analyze dataset and extract statistics
    await this.analyzeDataset(dataset);
    
    return datasetId;
  }

  private async analyzeDataset(dataset: MLDataset): Promise<void> {
    try {
      let analysisScript = '';
      
      switch (dataset.format) {
        case 'csv':
          analysisScript = this.generatePandasAnalysis(dataset);
          break;
        case 'json':
          analysisScript = this.generateJsonAnalysis(dataset);
          break;
        case 'parquet':
          analysisScript = this.generateParquetAnalysis(dataset);
          break;
      }

      if (analysisScript) {
        await this.executePythonScript(analysisScript);
      }
    } catch (error) {
      console.error('Dataset analysis failed:', error);
    }
  }

  private generatePandasAnalysis(dataset: MLDataset): string {
    return `
import pandas as pd
import numpy as np
import json

# Load dataset
df = pd.read_csv('${dataset.path}')

# Basic statistics
stats = {
    'shape': df.shape,
    'memory_usage': df.memory_usage(deep=True).sum(),
    'dtypes': df.dtypes.to_dict(),
    'null_counts': df.isnull().sum().to_dict(),
    'unique_counts': df.nunique().to_dict()
}

# Feature statistics
feature_stats = {}
for column in df.columns:
    if df[column].dtype in ['int64', 'float64']:
        feature_stats[column] = {
            'type': 'numerical',
            'min': float(df[column].min()),
            'max': float(df[column].max()),
            'mean': float(df[column].mean()),
            'std': float(df[column].std()),
            'null_count': int(df[column].isnull().sum()),
            'unique_count': int(df[column].nunique())
        }
    else:
        feature_stats[column] = {
            'type': 'categorical',
            'null_count': int(df[column].isnull().sum()),
            'unique_count': int(df[column].nunique()),
            'categories': df[column].unique().tolist()[:10]  # Top 10 categories
        }

# Save analysis results
results = {
    'dataset_stats': stats,
    'feature_stats': feature_stats
}

with open('dataset_analysis_${dataset.id}.json', 'w') as f:
    json.dump(results, f, default=str)

print("Dataset analysis completed")
`;
  }

  private generateJsonAnalysis(dataset: MLDataset): string {
    return `
import json
import pandas as pd

# Load JSON dataset
with open('${dataset.path}', 'r') as f:
    data = json.load(f)

# Convert to DataFrame for analysis
df = pd.json_normalize(data)

# Perform analysis similar to CSV
print(f"Dataset shape: {df.shape}")
print(f"Memory usage: {df.memory_usage(deep=True).sum()} bytes")
`;
  }

  private generateParquetAnalysis(dataset: MLDataset): string {
    return `
import pandas as pd
import pyarrow.parquet as pq

# Load Parquet dataset
df = pd.read_parquet('${dataset.path}')

# Perform analysis
print(f"Dataset shape: {df.shape}")
print(f"Memory usage: {df.memory_usage(deep=True).sum()} bytes")
`;
  }

  async createModel(config: Omit<MLModel, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const modelId = `model-${Date.now()}`;
    const model: MLModel = {
      ...config,
      id: modelId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.models.set(modelId, model);
    
    // Generate model template based on type and framework
    await this.generateModelTemplate(model);
    
    return modelId;
  }

  private async generateModelTemplate(model: MLModel): Promise<void> {
    const modelDir = path.join(process.cwd(), 'ml-models', model.id);
    await fs.mkdir(modelDir, { recursive: true });

    let template = '';
    
    switch (model.framework) {
      case 'tensorflow':
        template = this.generateTensorFlowTemplate(model);
        break;
      case 'pytorch':
        template = this.generatePyTorchTemplate(model);
        break;
      case 'scikit-learn':
        template = this.generateSklearnTemplate(model);
        break;
      case 'transformers':
        template = this.generateTransformersTemplate(model);
        break;
    }

    await fs.writeFile(path.join(modelDir, 'model.py'), template);
  }

  private generateTensorFlowTemplate(model: MLModel): string {
    return `
import tensorflow as tf
from tensorflow import keras
import numpy as np
import pandas as pd

class ${model.name.replace(/\s+/g, '')}Model:
    def __init__(self):
        self.model = None
        self.history = None
    
    def build_model(self, input_shape, num_classes=None):
        if "${model.type}" == "classification":
            self.model = keras.Sequential([
                keras.layers.Dense(128, activation='relu', input_shape=input_shape),
                keras.layers.Dropout(0.2),
                keras.layers.Dense(64, activation='relu'),
                keras.layers.Dropout(0.2),
                keras.layers.Dense(num_classes or 10, activation='softmax')
            ])
        elif "${model.type}" == "regression":
            self.model = keras.Sequential([
                keras.layers.Dense(128, activation='relu', input_shape=input_shape),
                keras.layers.Dropout(0.2),
                keras.layers.Dense(64, activation='relu'),
                keras.layers.Dropout(0.2),
                keras.layers.Dense(1, activation='linear')
            ])
        
        return self.model
    
    def compile_model(self, optimizer='adam', loss=None, metrics=['accuracy']):
        if loss is None:
            loss = 'sparse_categorical_crossentropy' if "${model.type}" == "classification" else 'mse'
        
        self.model.compile(
            optimizer=optimizer,
            loss=loss,
            metrics=metrics
        )
    
    def train(self, X_train, y_train, X_val=None, y_val=None, epochs=100, batch_size=32):
        callbacks = [
            keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
            keras.callbacks.ReduceLROnPlateau(factor=0.2, patience=5),
            keras.callbacks.ModelCheckpoint('best_model.h5', save_best_only=True)
        ]
        
        validation_data = (X_val, y_val) if X_val is not None else None
        
        self.history = self.model.fit(
            X_train, y_train,
            validation_data=validation_data,
            epochs=epochs,
            batch_size=batch_size,
            callbacks=callbacks,
            verbose=1
        )
        
        return self.history
    
    def evaluate(self, X_test, y_test):
        return self.model.evaluate(X_test, y_test)
    
    def predict(self, X):
        return self.model.predict(X)
    
    def save_model(self, filepath):
        self.model.save(filepath)
    
    def load_model(self, filepath):
        self.model = keras.models.load_model(filepath)

# Example usage
if __name__ == "__main__":
    model = ${model.name.replace(/\s+/g, '')}Model()
    # Add your training code here
`;
  }

  private generatePyTorchTemplate(model: MLModel): string {
    return `
import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
import pandas as pd

class ${model.name.replace(/\s+/g, '')}Model(nn.Module):
    def __init__(self, input_size, hidden_size=128, num_classes=10):
        super(${model.name.replace(/\s+/g, '')}Model, self).__init__()
        
        if "${model.type}" == "classification":
            self.layers = nn.Sequential(
                nn.Linear(input_size, hidden_size),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(hidden_size, hidden_size // 2),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(hidden_size // 2, num_classes),
                nn.Softmax(dim=1)
            )
        elif "${model.type}" == "regression":
            self.layers = nn.Sequential(
                nn.Linear(input_size, hidden_size),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(hidden_size, hidden_size // 2),
                nn.ReLU(),
                nn.Dropout(0.2),
                nn.Linear(hidden_size // 2, 1)
            )
    
    def forward(self, x):
        return self.layers(x)

class Trainer:
    def __init__(self, model, device='cuda' if torch.cuda.is_available() else 'cpu'):
        self.model = model.to(device)
        self.device = device
        self.history = {'train_loss': [], 'val_loss': [], 'train_acc': [], 'val_acc': []}
    
    def train(self, train_loader, val_loader, epochs=100, lr=0.001):
        criterion = nn.CrossEntropyLoss() if "${model.type}" == "classification" else nn.MSELoss()
        optimizer = optim.Adam(self.model.parameters(), lr=lr)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, 'min', patience=5)
        
        for epoch in range(epochs):
            # Training
            self.model.train()
            train_loss = 0.0
            train_correct = 0
            train_total = 0
            
            for batch_X, batch_y in train_loader:
                batch_X, batch_y = batch_X.to(self.device), batch_y.to(self.device)
                
                optimizer.zero_grad()
                outputs = self.model(batch_X)
                loss = criterion(outputs, batch_y)
                loss.backward()
                optimizer.step()
                
                train_loss += loss.item()
                if "${model.type}" == "classification":
                    _, predicted = torch.max(outputs.data, 1)
                    train_total += batch_y.size(0)
                    train_correct += (predicted == batch_y).sum().item()
            
            # Validation
            val_loss, val_acc = self.evaluate(val_loader, criterion)
            
            # Update learning rate
            scheduler.step(val_loss)
            
            # Store history
            self.history['train_loss'].append(train_loss / len(train_loader))
            self.history['val_loss'].append(val_loss)
            if "${model.type}" == "classification":
                self.history['train_acc'].append(train_correct / train_total)
                self.history['val_acc'].append(val_acc)
            
            print(f'Epoch {epoch+1}/{epochs}, Train Loss: {train_loss/len(train_loader):.4f}, Val Loss: {val_loss:.4f}')
    
    def evaluate(self, data_loader, criterion):
        self.model.eval()
        total_loss = 0.0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for batch_X, batch_y in data_loader:
                batch_X, batch_y = batch_X.to(self.device), batch_y.to(self.device)
                outputs = self.model(batch_X)
                loss = criterion(outputs, batch_y)
                total_loss += loss.item()
                
                if "${model.type}" == "classification":
                    _, predicted = torch.max(outputs.data, 1)
                    total += batch_y.size(0)
                    correct += (predicted == batch_y).sum().item()
        
        avg_loss = total_loss / len(data_loader)
        accuracy = correct / total if total > 0 else 0
        return avg_loss, accuracy
    
    def save_model(self, filepath):
        torch.save(self.model.state_dict(), filepath)
    
    def load_model(self, filepath):
        self.model.load_state_dict(torch.load(filepath))

# Example usage
if __name__ == "__main__":
    # Add your training code here
    pass
`;
  }

  private generateSklearnTemplate(model: MLModel): string {
    return `
from sklearn.model_selection import train_test_split, GridSearchCV, cross_val_score
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, mean_squared_error, r2_score
import pandas as pd
import numpy as np
import joblib

class ${model.name.replace(/\s+/g, '')}Model:
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.is_fitted = False
    
    def build_model(self):
        if "${model.type}" == "classification":
            from sklearn.ensemble import RandomForestClassifier
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42
            )
        elif "${model.type}" == "regression":
            from sklearn.ensemble import RandomForestRegressor
            self.model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42
            )
        elif "${model.type}" == "clustering":
            from sklearn.cluster import KMeans
            self.model = KMeans(
                n_clusters=3,
                random_state=42
            )
        
        return self.model
    
    def preprocess_data(self, X, y=None, fit=False):
        if fit:
            X_scaled = self.scaler.fit_transform(X)
            if y is not None and "${model.type}" == "classification":
                y_encoded = self.label_encoder.fit_transform(y)
                return X_scaled, y_encoded
        else:
            X_scaled = self.scaler.transform(X)
            if y is not None and "${model.type}" == "classification":
                y_encoded = self.label_encoder.transform(y)
                return X_scaled, y_encoded
        
        return X_scaled, y
    
    def train(self, X, y=None):
        if self.model is None:
            self.build_model()
        
        X_processed, y_processed = self.preprocess_data(X, y, fit=True)
        
        if "${model.type}" in ["classification", "regression"]:
            self.model.fit(X_processed, y_processed)
        else:  # clustering
            self.model.fit(X_processed)
        
        self.is_fitted = True
        return self.model
    
    def predict(self, X):
        if not self.is_fitted:
            raise ValueError("Model must be fitted before making predictions")
        
        X_processed, _ = self.preprocess_data(X)
        predictions = self.model.predict(X_processed)
        
        if "${model.type}" == "classification":
            # Decode labels back to original form
            return self.label_encoder.inverse_transform(predictions)
        
        return predictions
    
    def evaluate(self, X_test, y_test):
        predictions = self.predict(X_test)
        
        if "${model.type}" == "classification":
            return {
                'accuracy': accuracy_score(y_test, predictions),
                'precision': precision_score(y_test, predictions, average='weighted'),
                'recall': recall_score(y_test, predictions, average='weighted'),
                'f1_score': f1_score(y_test, predictions, average='weighted')
            }
        elif "${model.type}" == "regression":
            return {
                'mse': mean_squared_error(y_test, predictions),
                'rmse': np.sqrt(mean_squared_error(y_test, predictions)),
                'r2_score': r2_score(y_test, predictions)
            }
        
        return {}
    
    def hyperparameter_tuning(self, X, y, param_grid):
        if self.model is None:
            self.build_model()
        
        X_processed, y_processed = self.preprocess_data(X, y, fit=True)
        
        grid_search = GridSearchCV(
            self.model,
            param_grid,
            cv=5,
            scoring='accuracy' if "${model.type}" == "classification" else 'neg_mean_squared_error',
            n_jobs=-1
        )
        
        grid_search.fit(X_processed, y_processed)
        self.model = grid_search.best_estimator_
        
        return grid_search.best_params_, grid_search.best_score_
    
    def save_model(self, filepath):
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'label_encoder': self.label_encoder,
            'is_fitted': self.is_fitted
        }
        joblib.dump(model_data, filepath)
    
    def load_model(self, filepath):
        model_data = joblib.load(filepath)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.label_encoder = model_data['label_encoder']
        self.is_fitted = model_data['is_fitted']

# Example usage
if __name__ == "__main__":
    # Add your training code here
    pass
`;
  }

  private generateTransformersTemplate(model: MLModel): string {
    return `
from transformers import (
    AutoTokenizer, AutoModelForSequenceClassification,
    AutoModelForCausalLM, TrainingArguments, Trainer,
    DataCollatorWithPadding, pipeline
)
from datasets import Dataset
import torch
import numpy as np
import pandas as pd

class ${model.name.replace(/\s+/g, '')}Model:
    def __init__(self, model_name="bert-base-uncased"):
        self.model_name = model_name
        self.tokenizer = None
        self.model = None
        self.trainer = None
    
    def build_model(self, num_labels=2):
        self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
        
        if "${model.type}" == "classification":
            self.model = AutoModelForSequenceClassification.from_pretrained(
                self.model_name,
                num_labels=num_labels
            )
        elif "${model.type}" == "nlp":
            self.model = AutoModelForCausalLM.from_pretrained(self.model_name)
        
        return self.model
    
    def tokenize_data(self, texts, labels=None, max_length=512):
        def tokenize_function(examples):
            return self.tokenizer(
                examples['text'],
                truncation=True,
                padding=True,
                max_length=max_length
            )
        
        data_dict = {'text': texts}
        if labels is not None:
            data_dict['labels'] = labels
        
        dataset = Dataset.from_dict(data_dict)
        tokenized_dataset = dataset.map(tokenize_function, batched=True)
        
        return tokenized_dataset
    
    def train(self, train_texts, train_labels, val_texts=None, val_labels=None, 
              epochs=3, batch_size=16, learning_rate=2e-5):
        
        train_dataset = self.tokenize_data(train_texts, train_labels)
        val_dataset = None
        if val_texts is not None:
            val_dataset = self.tokenize_data(val_texts, val_labels)
        
        training_args = TrainingArguments(
            output_dir='./results',
            num_train_epochs=epochs,
            per_device_train_batch_size=batch_size,
            per_device_eval_batch_size=batch_size,
            warmup_steps=500,
            weight_decay=0.01,
            logging_dir='./logs',
            learning_rate=learning_rate,
            evaluation_strategy="epoch" if val_dataset else "no",
            save_strategy="epoch",
            load_best_model_at_end=True if val_dataset else False,
        )
        
        data_collator = DataCollatorWithPadding(tokenizer=self.tokenizer)
        
        self.trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=train_dataset,
            eval_dataset=val_dataset,
            tokenizer=self.tokenizer,
            data_collator=data_collator,
        )
        
        self.trainer.train()
        return self.trainer
    
    def predict(self, texts):
        if self.trainer is None:
            raise ValueError("Model must be trained before making predictions")
        
        test_dataset = self.tokenize_data(texts)
        predictions = self.trainer.predict(test_dataset)
        
        return np.argmax(predictions.predictions, axis=-1)
    
    def evaluate(self, texts, labels):
        if self.trainer is None:
            raise ValueError("Model must be trained before evaluation")
        
        test_dataset = self.tokenize_data(texts, labels)
        results = self.trainer.evaluate(test_dataset)
        
        return results
    
    def save_model(self, filepath):
        self.model.save_pretrained(filepath)
        self.tokenizer.save_pretrained(filepath)
    
    def load_model(self, filepath):
        self.model = AutoModelForSequenceClassification.from_pretrained(filepath)
        self.tokenizer = AutoTokenizer.from_pretrained(filepath)
    
    def create_pipeline(self, task="text-classification"):
        return pipeline(
            task,
            model=self.model,
            tokenizer=self.tokenizer
        )

# Example usage
if __name__ == "__main__":
    # Add your training code here
    pass
`;
  }

  async startTraining(config: TrainingConfig): Promise<string> {
    const jobId = `job-${Date.now()}`;
    const job: TrainingJob = {
      id: jobId,
      modelId: config.modelId,
      config,
      status: 'running',
      progress: 0,
      logs: [],
      startTime: new Date(),
      gpuUtilization: [],
      memoryUsage: []
    };

    this.trainingJobs.set(jobId, job);

    // Execute training in background
    this.executeTraining(job).catch(error => {
      job.status = 'failed';
      job.logs.push(`Training failed: ${error.message}`);
      job.endTime = new Date();
    });

    return jobId;
  }

  private async executeTraining(job: TrainingJob): Promise<void> {
    const model = this.models.get(job.modelId);
    const dataset = this.datasets.get(job.config.datasetId);
    
    if (!model || !dataset) {
      throw new Error('Model or dataset not found');
    }

    const modelDir = path.join(process.cwd(), 'ml-models', model.id);
    const trainingScript = this.generateTrainingScript(model, dataset, job.config);
    
    const scriptPath = path.join(modelDir, 'train.py');
    await fs.writeFile(scriptPath, trainingScript);

    return new Promise((resolve, reject) => {
      const pythonArgs = ['train.py'];
      if (job.config.gpuEnabled) {
        pythonArgs.unshift('-u'); // Unbuffered output for real-time logs
      }

      const trainingProcess = spawn('python', pythonArgs, {
        cwd: modelDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          CUDA_VISIBLE_DEVICES: job.config.gpuEnabled ? '0' : '',
          PYTHONUNBUFFERED: '1'
        }
      });

      trainingProcess.stdout.on('data', (data) => {
        const output = data.toString();
        job.logs.push(output);
        
        // Extract progress from output
        const progressMatch = output.match(/Epoch (\d+)\/(\d+)/);
        if (progressMatch) {
          const currentEpoch = parseInt(progressMatch[1]);
          const totalEpochs = parseInt(progressMatch[2]);
          job.progress = (currentEpoch / totalEpochs) * 100;
        }
      });

      trainingProcess.stderr.on('data', (data) => {
        const error = data.toString();
        job.logs.push(`ERROR: ${error}`);
      });

      trainingProcess.on('close', (code) => {
        job.endTime = new Date();
        
        if (code === 0) {
          job.status = 'completed';
          job.progress = 100;
          resolve();
        } else {
          job.status = 'failed';
          reject(new Error(`Training process exited with code ${code}`));
        }
      });
    });
  }

  private generateTrainingScript(model: MLModel, dataset: MLDataset, config: TrainingConfig): string {
    return `
import os
import sys
import json
import time
import numpy as np
import pandas as pd
${model.framework === 'tensorflow' ? 'import tensorflow as tf' : ''}
${model.framework === 'pytorch' ? 'import torch' : ''}
${model.framework === 'scikit-learn' ? 'from sklearn.model_selection import train_test_split' : ''}

# Load the model class
from model import ${model.name.replace(/\s+/g, '')}Model

def main():
    print(f"Starting training for model: ${model.name}")
    print(f"Dataset: ${dataset.name}")
    print(f"Framework: ${model.framework}")
    
    # Load dataset
    if "${dataset.format}" == "csv":
        data = pd.read_csv("${dataset.path}")
    elif "${dataset.format}" == "json":
        data = pd.read_json("${dataset.path}")
    elif "${dataset.format}" == "parquet":
        data = pd.read_parquet("${dataset.path}")
    
    print(f"Dataset shape: {data.shape}")
    
    # Initialize model
    model = ${model.name.replace(/\s+/g, '')}Model()
    
    # Training configuration
    config = {
        "epochs": ${config.epochs},
        "batch_size": ${config.batchSize},
        "learning_rate": ${config.learningRate},
        "validation_split": ${config.validationSplit}
    }
    
    print("Training configuration:", config)
    
    # Start training
    start_time = time.time()
    
    try:
        if "${model.framework}" == "tensorflow":
            # TensorFlow training logic
            model.build_model(input_shape=(data.shape[1]-1,))
            model.compile_model(optimizer="${config.optimizer}", metrics=${JSON.stringify(config.metrics)})
            
            # Prepare data (assuming last column is target)
            X = data.iloc[:, :-1].values
            y = data.iloc[:, -1].values
            
            history = model.train(X, y, epochs=config["epochs"], batch_size=config["batch_size"])
            
        elif "${model.framework}" == "pytorch":
            # PyTorch training logic
            from torch.utils.data import DataLoader, TensorDataset
            
            # Prepare data
            X = torch.FloatTensor(data.iloc[:, :-1].values)
            y = torch.LongTensor(data.iloc[:, -1].values)
            
            dataset = TensorDataset(X, y)
            dataloader = DataLoader(dataset, batch_size=config["batch_size"], shuffle=True)
            
            # Initialize model and trainer
            pytorch_model = model.build_model(X.shape[1])
            trainer = model.Trainer(pytorch_model)
            trainer.train(dataloader, None, epochs=config["epochs"])
            
        elif "${model.framework}" == "scikit-learn":
            # Scikit-learn training logic
            X = data.iloc[:, :-1]
            y = data.iloc[:, -1]
            
            model.train(X, y)
        
        training_time = time.time() - start_time
        print(f"Training completed in {training_time:.2f} seconds")
        
        # Save model
        model.save_model("trained_model")
        print("Model saved successfully")
        
        # Save training metrics
        metrics = {
            "training_time": training_time,
            "model_type": "${model.type}",
            "framework": "${model.framework}",
            "status": "completed"
        }
        
        with open("training_metrics.json", "w") as f:
            json.dump(metrics, f)
        
    except Exception as e:
        print(f"Training failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
`;
  }

  private async executePythonScript(script: string): Promise<void> {
    const tempFile = path.join(process.cwd(), `temp_script_${Date.now()}.py`);
    await fs.writeFile(tempFile, script);

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [tempFile], { stdio: 'pipe' });

      pythonProcess.on('close', async (code) => {
        await fs.unlink(tempFile).catch(() => {}); // Clean up temp file
        
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Python script failed with code ${code}`));
        }
      });
    });
  }

  async checkGpuAvailability(): Promise<boolean> {
    try {
      const result = await this.executePythonScript(`
import torch
print("PyTorch CUDA available:", torch.cuda.is_available())
if torch.cuda.is_available():
    print("CUDA devices:", torch.cuda.device_count())
    for i in range(torch.cuda.device_count()):
        print(f"Device {i}: {torch.cuda.get_device_name(i)}")

try:
    import tensorflow as tf
    print("TensorFlow GPUs:", len(tf.config.experimental.list_physical_devices('GPU')))
except:
    print("TensorFlow not available")
`);
      return true;
    } catch {
      return false;
    }
  }

  getTrainingJob(jobId: string): TrainingJob | undefined {
    return this.trainingJobs.get(jobId);
  }

  getModel(modelId: string): MLModel | undefined {
    return this.models.get(modelId);
  }

  getDataset(datasetId: string): MLDataset | undefined {
    return this.datasets.get(datasetId);
  }

  getModels(): MLModel[] {
    return Array.from(this.models.values());
  }

  getDatasets(): MLDataset[] {
    return Array.from(this.datasets.values());
  }

  getTrainingJobs(): TrainingJob[] {
    return Array.from(this.trainingJobs.values());
  }
}

export const mlWorkflowService = new MLWorkflowService();
