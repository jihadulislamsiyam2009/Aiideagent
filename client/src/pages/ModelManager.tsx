import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModelCard } from "@/components/ModelCard";
import { 
  Plus, 
  Search, 
  Download, 
  Play, 
  Settings, 
  Brain,
  HardDrive,
  Activity,
  Zap
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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

interface HuggingFaceModel {
  id: string;
  author: string;
  downloads: number;
  likes: number;
  tags: string[];
  pipeline_tag: string;
  description?: string;
}

export default function ModelManager() {
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("ollama");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: models = [] } = useQuery<Model[]>({
    queryKey: ['/api/models'],
    refetchInterval: 5000
  });

  const { data: ollamaModels = [] } = useQuery({
    queryKey: ['/api/models/ollama'],
    enabled: activeTab === 'ollama'
  });

  const { data: hfModels = [] } = useQuery<{ models: HuggingFaceModel[] }>({
    queryKey: ['/api/models/huggingface/popular'],
    enabled: activeTab === 'huggingface'
  });

  const pullModelMutation = useMutation({
    mutationFn: async (modelName: string) => {
      return apiRequest('POST', '/api/models/ollama/pull', { modelName });
    },
    onSuccess: () => {
      toast({
        title: "Download Started",
        description: "Model download has been initiated"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/models'] });
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const downloadHFModelMutation = useMutation({
    mutationFn: async (modelId: string) => {
      return apiRequest('POST', '/api/models/huggingface/download', { modelId });
    },
    onSuccess: () => {
      toast({
        title: "Download Started",
        description: "Model download has been initiated"
      });
      queryClient.invalidateQueries({ queryKey: ['/api/models'] });
    },
    onError: (error: any) => {
      toast({
        title: "Download Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleModelSelect = (model: Model) => {
    setSelectedModel(model);
  };

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

  return (
    <div className="flex h-full" data-testid="model-manager-view">
      {/* Models List */}
      <div className="w-1/3 border-r border-border">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Model Library</h3>
            <Button size="sm" data-testid="button-add-model">
              <Plus size={16} className="mr-1" />
              Add Model
            </Button>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ollama" data-testid="tab-ollama">Ollama</TabsTrigger>
              <TabsTrigger value="huggingface" data-testid="tab-huggingface">Hugging Face</TabsTrigger>
              <TabsTrigger value="custom" data-testid="tab-custom">Custom</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-models"
            />
          </div>
        </div>

        <div className="overflow-y-auto scrollbar-hide" style={{ height: 'calc(100% - 180px)' }}>
          <div className="p-4 space-y-2">
            <TabsContent value="ollama" className="mt-0">
              {models
                .filter(m => m.source === 'ollama')
                .filter(m => !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    isSelected={selectedModel?.id === model.id}
                    onSelect={() => handleModelSelect(model)}
                    onDownload={() => pullModelMutation.mutate(model.modelId)}
                  />
                ))}
              
              {/* Available Ollama Models */}
              <div className="border-t border-border pt-4 mt-4">
                <h4 className="text-sm font-medium mb-2 text-muted-foreground">Available Models</h4>
                <div className="space-y-2">
                  {['llama3.1:8b', 'codellama:7b', 'mistral:7b', 'phi3:3.8b'].map((modelName) => {
                    const isDownloaded = models.some(m => m.modelId === modelName);
                    if (isDownloaded) return null;
                    
                    return (
                      <div 
                        key={modelName}
                        className="p-3 border border-dashed border-border rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                        data-testid={`available-model-${modelName}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{modelName}</h4>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => pullModelMutation.mutate(modelName)}
                            disabled={pullModelMutation.isPending}
                          >
                            <Download size={14} />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">Available for download</p>
                        <div className="flex justify-between text-xs">
                          <span>Size: ~4GB</span>
                          <span className="text-primary">Download</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="huggingface" className="mt-0">
              {(Array.isArray(hfModels) ? [] : hfModels.models || []).map((model: HuggingFaceModel) => (
                <div 
                  key={model.id}
                  className="p-3 border border-border rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                  data-testid={`hf-model-${model.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{model.id}</h4>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => downloadHFModelMutation.mutate(model.id)}
                      disabled={downloadHFModelMutation.isPending}
                    >
                      <Download size={14} />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{model.description || 'No description available'}</p>
                  <div className="flex justify-between text-xs">
                    <span>{model.downloads} downloads</span>
                    <span>{model.likes} likes</span>
                  </div>
                  {model.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {model.tags.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="custom" className="mt-0">
              <div className="text-center py-8 text-muted-foreground">
                <Brain size={48} className="mx-auto mb-4 opacity-20" />
                <p>Custom model support coming soon</p>
              </div>
            </TabsContent>
          </div>
        </div>
      </div>

      {/* Model Details */}
      <div className="flex-1">
        {selectedModel ? (
          <>
            <div className="p-6 border-b border-border">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold mb-2" data-testid="model-name">
                    {selectedModel.name}
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    {selectedModel.source === 'ollama' ? 'Ollama' : 'Hugging Face'} model • {selectedModel.parameters || 'Unknown parameters'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    className="bg-accent hover:bg-accent/90"
                    data-testid="button-start-model"
                  >
                    <Play size={16} className="mr-1" />
                    Start
                  </Button>
                  <Button variant="outline">
                    <Settings size={16} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Model Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive size={16} className="text-muted-foreground" />
                      <h4 className="text-sm font-medium text-muted-foreground">Model Size</h4>
                    </div>
                    <p className="text-lg font-semibold">{formatBytes(selectedModel.size)}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain size={16} className="text-muted-foreground" />
                      <h4 className="text-sm font-medium text-muted-foreground">Parameters</h4>
                    </div>
                    <p className="text-lg font-semibold">{selectedModel.parameters || 'Unknown'}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity size={16} className="text-muted-foreground" />
                      <h4 className="text-sm font-medium text-muted-foreground">Context Length</h4>
                    </div>
                    <p className="text-lg font-semibold">{selectedModel.contextLength || 'Unknown'}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={16} className="text-muted-foreground" />
                      <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(selectedModel.status)}`}></div>
                      <span className="font-semibold capitalize">{selectedModel.status}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Download Progress */}
              {selectedModel.status === 'downloading' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Download Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Downloading {selectedModel.name}...</span>
                        <span>{selectedModel.downloadProgress || 0}%</span>
                      </div>
                      <Progress value={selectedModel.downloadProgress || 0} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Response Time</span>
                        <span className="text-sm font-medium">245ms</span>
                      </div>
                      <Progress value={85} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">Memory Usage</span>
                        <span className="text-sm font-medium">6.2GB</span>
                      </div>
                      <Progress value={78} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">GPU Utilization</span>
                        <span className="text-sm font-medium">92%</span>
                      </div>
                      <Progress value={92} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Temperature</label>
                      <Input type="number" min="0" max="2" step="0.1" defaultValue="0.7" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Max Tokens</label>
                      <Input type="number" defaultValue="2048" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Top P</label>
                      <Input type="number" min="0" max="1" step="0.05" defaultValue="0.9" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Seed</label>
                      <Input type="number" defaultValue="42" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Brain size={64} className="mx-auto mb-4 text-muted-foreground opacity-20" />
              <h3 className="text-lg font-semibold mb-2">Select a Model</h3>
              <p className="text-muted-foreground">Choose a model from the library to view details and configuration</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
