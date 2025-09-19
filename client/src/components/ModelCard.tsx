import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  Settings,
  Brain,
  HardDrive,
  Activity
} from "lucide-react";

interface Model {
  id: string;
  name: string;
  source: string;
  modelId: string;
  status: string;
  size?: number;
  parameters?: string;
  contextLength?: number;
  downloadProgress?: number;
  config: any;
  performance: any;
}

interface ModelCardProps {
  model: Model;
  isSelected?: boolean;
  onSelect?: () => void;
  onDownload?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  onDelete?: () => void;
}

export function ModelCard({ 
  model, 
  isSelected = false, 
  onSelect,
  onDownload,
  onStart,
  onStop,
  onDelete 
}: ModelCardProps) {
  const formatBytes = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-accent';
      case 'ready': return 'bg-primary';
      case 'downloading': return 'bg-yellow-500';
      case 'error': return 'bg-destructive';
      default: return 'bg-muted-foreground';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return 'Running';
      case 'ready': return 'Ready';
      case 'downloading': return 'Downloading';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  const isDownloaded = model.status !== 'downloading' && model.status !== 'error';
  const isRunning = model.status === 'running';

  return (
    <Card 
      className={`cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-secondary border-primary' 
          : 'hover:bg-secondary/50'
      }`}
      onClick={onSelect}
      data-testid={`model-card-${model.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Brain size={16} className="text-primary flex-shrink-0" />
            <h4 className="font-medium text-sm truncate" title={model.name}>
              {model.name}
            </h4>
          </div>
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(model.status)}`}></div>
        </div>

        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {model.source === 'ollama' ? 'Ollama' : 'Hugging Face'} • {model.parameters || 'Unknown parameters'}
        </p>

        {/* Model Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
          <div className="flex items-center gap-1">
            <HardDrive size={12} className="text-muted-foreground" />
            <span>{formatBytes(model.size)}</span>
          </div>
          {model.contextLength && (
            <div className="flex items-center gap-1">
              <Activity size={12} className="text-muted-foreground" />
              <span>{model.contextLength}K</span>
            </div>
          )}
        </div>

        {/* Download Progress */}
        {model.status === 'downloading' && (
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span>Downloading...</span>
              <span>{model.downloadProgress || 0}%</span>
            </div>
            <Progress value={model.downloadProgress || 0} className="h-1" />
          </div>
        )}

        {/* Status */}
        <div className="flex items-center justify-between mb-3">
          <Badge 
            variant="secondary" 
            className="text-xs"
          >
            {getStatusText(model.status)}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {model.source}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex gap-1">
          {isDownloaded ? (
            <>
              <Button 
                size="sm" 
                variant={isRunning ? "destructive" : "default"}
                className="flex-1 h-7"
                onClick={(e) => {
                  e.stopPropagation();
                  isRunning ? onStop?.() : onStart?.();
                }}
                data-testid={`button-${isRunning ? 'stop' : 'start'}-${model.id}`}
              >
                {isRunning ? (
                  <>
                    <Pause size={12} className="mr-1" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play size={12} className="mr-1" />
                    Start
                  </>
                )}
              </Button>
              
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  // Show settings
                }}
                data-testid={`button-settings-${model.id}`}
              >
                <Settings size={12} />
              </Button>
              
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0 hover:bg-destructive hover:text-destructive-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
                data-testid={`button-delete-${model.id}`}
              >
                <Trash2 size={12} />
              </Button>
            </>
          ) : (
            <Button 
              size="sm" 
              variant="outline"
              className="flex-1 h-7"
              onClick={(e) => {
                e.stopPropagation();
                onDownload?.();
              }}
              disabled={model.status === 'downloading'}
              data-testid={`button-download-${model.id}`}
            >
              <Download size={12} className="mr-1" />
              {model.status === 'downloading' ? 'Downloading...' : 'Download'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
