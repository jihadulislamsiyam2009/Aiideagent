import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Layers3, 
  Search, 
  Download, 
  Play, 
  Star, 
  Code, 
  Database, 
  Globe, 
  Brain,
  Settings,
  Package,
  FileText,
  Rocket
} from "lucide-react";

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  files?: { [path: string]: string };
  dependencies?: string[];
  scripts?: { [name: string]: string };
  instructions?: string;
}

const templateCategories = [
  { id: 'all', name: 'All Templates', icon: <Layers3 size={16} /> },
  { id: 'Frontend', name: 'Frontend', icon: <Globe size={16} /> },
  { id: 'Backend', name: 'Backend', icon: <Database size={16} /> },
  { id: 'Fullstack', name: 'Fullstack', icon: <Code size={16} /> },
  { id: 'Data Science', name: 'Data Science', icon: <Brain size={16} /> },
  { id: 'Mobile', name: 'Mobile', icon: <Package size={16} /> },
];

export default function Templates() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [projectName, setProjectName] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: templates = [] } = useQuery<ProjectTemplate[]>({
    queryKey: ['/api/projects/templates']
  });

  const createProjectMutation = useMutation({
    mutationFn: async ({ name, templateId }: { name: string; templateId: string }) => {
      return apiRequest('POST', '/api/projects', { name, templateId, description: '' });
    },
    onSuccess: () => {
      toast({
        title: "Project Created",
        description: "Project has been created successfully from template"
      });
      setShowCreateDialog(false);
      setProjectName('');
      setSelectedTemplate(null);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Create Project",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleCreateProject = () => {
    if (!projectName || !selectedTemplate) {
      toast({
        title: "Missing Information",
        description: "Please provide a project name",
        variant: "destructive"
      });
      return;
    }

    createProjectMutation.mutate({
      name: projectName,
      templateId: selectedTemplate.id
    });
  };

  const getCategoryIcon = (category: string) => {
    const categoryData = templateCategories.find(c => c.id === category);
    return categoryData?.icon || <FileText size={16} />;
  };

  const getTemplateIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'frontend': return <Globe size={24} className="text-blue-500" />;
      case 'backend': return <Database size={24} className="text-green-500" />;
      case 'fullstack': return <Code size={24} className="text-purple-500" />;
      case 'data science': return <Brain size={24} className="text-orange-500" />;
      case 'mobile': return <Package size={24} className="text-pink-500" />;
      default: return <FileText size={24} className="text-gray-500" />;
    }
  };

  const filteredTemplates = templates.filter(template => {
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesCategory && matchesSearch;
  });

  const getTemplateComplexity = (template: ProjectTemplate): string => {
    const fileCount = Object.keys(template.files || {}).length;
    const depCount = template.dependencies?.length || 0;
    
    if (fileCount <= 3 && depCount <= 3) return 'Beginner';
    if (fileCount <= 8 && depCount <= 8) return 'Intermediate';
    return 'Advanced';
  };

  const getComplexityColor = (complexity: string): string => {
    switch (complexity) {
      case 'Beginner': return 'bg-green-500';
      case 'Intermediate': return 'bg-yellow-500';
      case 'Advanced': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full p-6 overflow-y-auto scrollbar-hide" data-testid="templates-view">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Project Templates</h2>
          <p className="text-muted-foreground">Choose from a variety of pre-configured project templates</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {filteredTemplates.length} templates available
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        {/* Category Filter */}
        <div className="flex flex-wrap gap-2">
          {templateCategories.map((category) => (
            <Button
              key={category.id}
              size="sm"
              variant={selectedCategory === category.id ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.id)}
              className="flex items-center gap-2"
              data-testid={`category-${category.id}`}
            >
              {category.icon}
              <span>{category.name}</span>
            </Button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-templates"
          />
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => {
          const complexity = getTemplateComplexity(template);
          
          return (
            <Card 
              key={template.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedTemplate(template)}
              data-testid={`template-${template.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between mb-3">
                  {getTemplateIcon(template.category)}
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {template.category}
                    </Badge>
                    <div className={`px-2 py-0.5 rounded-full text-xs text-white ${getComplexityColor(complexity)}`}>
                      {complexity}
                    </div>
                  </div>
                </div>
                
                <CardTitle className="text-lg">{template.name}</CardTitle>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  {/* Template Stats */}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{Object.keys(template.files || {}).length} files</span>
                    <span>{template.dependencies?.length || 0} dependencies</span>
                  </div>
                  
                  {/* Tech Stack Preview */}
                  {template.dependencies && template.dependencies.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.dependencies.slice(0, 3).map((dep) => (
                        <Badge key={dep} variant="outline" className="text-xs">
                          {dep.split('@')[0]}
                        </Badge>
                      ))}
                      {template.dependencies.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{template.dependencies.length - 3} more
                        </Badge>
                      )}
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTemplate(template);
                        setShowCreateDialog(true);
                      }}
                      data-testid={`button-use-${template.id}`}
                    >
                      <Rocket size={14} className="mr-1" />
                      Use Template
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTemplate(template);
                      }}
                      data-testid={`button-preview-${template.id}`}
                    >
                      <Play size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredTemplates.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Layers3 size={64} className="mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-lg font-semibold mb-2">No Templates Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery 
                ? 'No templates match your search criteria' 
                : 'No templates available for the selected category'
              }
            </p>
            {searchQuery && (
              <Button 
                variant="outline" 
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Template Preview Dialog */}
      {selectedTemplate && !showCreateDialog && (
        <Dialog 
          open={!!selectedTemplate} 
          onOpenChange={() => setSelectedTemplate(null)}
        >
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-template-preview">
            <DialogHeader>
              <div className="flex items-center gap-3">
                {getTemplateIcon(selectedTemplate.category)}
                <div>
                  <DialogTitle className="text-xl">{selectedTemplate.name}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{selectedTemplate.category}</Badge>
                    <div className={`px-2 py-0.5 rounded-full text-xs text-white ${getComplexityColor(getTemplateComplexity(selectedTemplate))}`}>
                      {getTemplateComplexity(selectedTemplate)}
                    </div>
                  </div>
                </div>
              </div>
            </DialogHeader>
            
            <div className="space-y-6">
              <p className="text-muted-foreground">{selectedTemplate.description}</p>
              
              {/* File Structure */}
              {selectedTemplate.files && Object.keys(selectedTemplate.files).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">File Structure</h4>
                  <div className="bg-secondary rounded-lg p-4 max-h-60 overflow-y-auto">
                    <div className="font-mono text-sm space-y-1">
                      {Object.keys(selectedTemplate.files).map((filePath) => (
                        <div key={filePath} className="flex items-center gap-2">
                          <FileText size={14} className="text-muted-foreground" />
                          <span>{filePath}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Dependencies */}
              {selectedTemplate.dependencies && selectedTemplate.dependencies.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Dependencies</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTemplate.dependencies.map((dep) => (
                      <Badge key={dep} variant="outline">
                        {dep}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Scripts */}
              {selectedTemplate.scripts && Object.keys(selectedTemplate.scripts).length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Available Scripts</h4>
                  <div className="space-y-2">
                    {Object.entries(selectedTemplate.scripts).map(([name, command]) => (
                      <div key={name} className="flex items-center gap-3 p-2 bg-secondary rounded">
                        <code className="text-sm font-semibold">{name}</code>
                        <code className="text-xs text-muted-foreground flex-1">{command}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Instructions */}
              {selectedTemplate.instructions && (
                <div>
                  <h4 className="font-semibold mb-3">Instructions</h4>
                  <div className="bg-secondary rounded-lg p-4">
                    <p className="text-sm whitespace-pre-line">{selectedTemplate.instructions}</p>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={() => setShowCreateDialog(true)}
                  className="flex-1"
                  data-testid="button-create-from-template"
                >
                  <Rocket size={16} className="mr-2" />
                  Create Project from Template
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedTemplate(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Project Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent data-testid="dialog-create-from-template">
          <DialogHeader>
            <DialogTitle>Create Project from Template</DialogTitle>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="p-4 bg-secondary rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  {getTemplateIcon(selectedTemplate.category)}
                  <div>
                    <h4 className="font-semibold">{selectedTemplate.name}</h4>
                    <p className="text-sm text-muted-foreground">{selectedTemplate.category}</p>
                  </div>
                </div>
                <p className="text-sm">{selectedTemplate.description}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Project Name</label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                  data-testid="input-project-name-template"
                />
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleCreateProject}
                  disabled={createProjectMutation.isPending || !projectName}
                  className="flex-1"
                  data-testid="button-confirm-create"
                >
                  {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
