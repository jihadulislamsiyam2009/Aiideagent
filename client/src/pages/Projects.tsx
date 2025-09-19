import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  FolderOpen, 
  GitBranch, 
  Search, 
  Play, 
  Settings, 
  Trash2,
  ExternalLink,
  Star,
  Calendar,
  Users
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string;
  type: 'local' | 'github' | 'template';
  path: string;
  githubUrl?: string;
  status: 'active' | 'archived' | 'error';
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  language: string;
  stargazers_count: number;
  updated_at: string;
}

export default function Projects() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCloneDialog, setShowCloneDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [githubSearchQuery, setGithubSearchQuery] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects']
  });

  const { data: templates = [] } = useQuery<ProjectTemplate[]>({
    queryKey: ['/api/projects/templates']
  });

  const { data: githubRepos = [] } = useQuery<GitHubRepo[]>({
    queryKey: ['/api/projects/github/search', githubSearchQuery],
    enabled: githubSearchQuery.length > 0
  });

  const createProjectMutation = useMutation({
    mutationFn: async ({ name, templateId, description }: { name: string; templateId: string; description: string }) => {
      return apiRequest('POST', '/api/projects', { name, templateId, description });
    },
    onSuccess: () => {
      toast({
        title: "Project Created",
        description: "Project has been created successfully"
      });
      setShowCreateDialog(false);
      setProjectName('');
      setProjectDescription('');
      setSelectedTemplate('');
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

  const cloneProjectMutation = useMutation({
    mutationFn: async ({ repoUrl, name }: { repoUrl: string; name?: string }) => {
      return apiRequest('POST', '/api/projects/clone', { repoUrl, name });
    },
    onSuccess: () => {
      toast({
        title: "Repository Cloned",
        description: "Repository has been cloned successfully"
      });
      setShowCloneDialog(false);
      setCloneUrl('');
      setProjectName('');
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Clone Repository",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleCreateProject = () => {
    if (!projectName || !selectedTemplate) {
      toast({
        title: "Missing Information",
        description: "Please provide project name and select a template",
        variant: "destructive"
      });
      return;
    }

    createProjectMutation.mutate({
      name: projectName,
      templateId: selectedTemplate,
      description: projectDescription
    });
  };

  const handleCloneRepository = () => {
    if (!cloneUrl) {
      toast({
        title: "Missing URL",
        description: "Please provide a repository URL",
        variant: "destructive"
      });
      return;
    }

    cloneProjectMutation.mutate({
      repoUrl: cloneUrl,
      name: projectName || undefined
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-accent';
      case 'archived': return 'bg-muted-foreground';
      case 'error': return 'bg-destructive';
      default: return 'bg-muted-foreground';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'github': return <GitBranch size={16} />;
      case 'template': return <FolderOpen size={16} />;
      default: return <FolderOpen size={16} />;
    }
  };

  const filteredProjects = projects.filter(project =>
    !searchQuery || 
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full p-6 overflow-y-auto scrollbar-hide" data-testid="projects-view">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Projects</h2>
          <p className="text-muted-foreground">Manage your development projects and repositories</p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowCreateDialog(true)}
            data-testid="button-new-project"
          >
            <Plus size={16} className="mr-2" />
            New Project
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => setShowCloneDialog(true)}
            data-testid="button-clone-repo"
          >
            <GitBranch size={16} className="mr-2" />
            Clone Repository
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-projects"
        />
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <Card key={project.id} className="hover:shadow-md transition-shadow" data-testid={`project-${project.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {getTypeIcon(project.type)}
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(project.status)}`}></div>
                  <Badge variant="secondary" className="text-xs">
                    {project.type}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {project.description || 'No description available'}
              </p>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar size={12} />
                  <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                </div>
                
                {project.githubUrl && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ExternalLink size={12} />
                    <a 
                      href={project.githubUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-primary truncate"
                    >
                      {project.githubUrl.replace('https://github.com/', '')}
                    </a>
                  </div>
                )}
                
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1" data-testid={`button-open-${project.id}`}>
                    <Play size={14} className="mr-1" />
                    Open
                  </Button>
                  
                  <Button size="sm" variant="outline" data-testid={`button-settings-${project.id}`}>
                    <Settings size={14} />
                  </Button>
                  
                  <Button size="sm" variant="outline" data-testid={`button-delete-${project.id}`}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredProjects.length === 0 && (
          <div className="col-span-full text-center py-12">
            <FolderOpen size={64} className="mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-lg font-semibold mb-2">No Projects Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'No projects match your search criteria' : 'Create your first project to get started'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus size={16} className="mr-2" />
                Create Project
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create Project Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-create-project">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Project Name</label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Enter project name"
                data-testid="input-project-name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <Input
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Enter project description (optional)"
                data-testid="input-project-description"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Template</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedTemplate === template.id 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:bg-secondary'
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                    data-testid={`template-${template.id}`}
                  >
                    <h4 className="font-medium text-sm">{template.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                    <Badge variant="secondary" className="text-xs mt-2">
                      {template.category}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleCreateProject}
                disabled={createProjectMutation.isPending}
                className="flex-1"
                data-testid="button-create-project"
              >
                {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setShowCreateDialog(false)}
                data-testid="button-cancel-create"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Clone Repository Dialog */}
      <Dialog open={showCloneDialog} onOpenChange={setShowCloneDialog}>
        <DialogContent className="max-w-2xl" data-testid="dialog-clone-repo">
          <DialogHeader>
            <DialogTitle>Clone Repository</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Repository URL</label>
              <Input
                value={cloneUrl}
                onChange={(e) => setCloneUrl(e.target.value)}
                placeholder="https://github.com/username/repository.git"
                data-testid="input-clone-url"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Project Name (Optional)</label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="Leave empty to use repository name"
                data-testid="input-clone-name"
              />
            </div>
            
            {/* GitHub Search */}
            <div>
              <label className="block text-sm font-medium mb-2">Or Search GitHub</label>
              <Input
                value={githubSearchQuery}
                onChange={(e) => setGithubSearchQuery(e.target.value)}
                placeholder="Search GitHub repositories..."
                data-testid="input-github-search"
              />
              
              {githubRepos.length > 0 && (
                <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg">
                  {githubRepos.map((repo) => (
                    <div
                      key={repo.full_name}
                      className="p-3 border-b border-border last:border-b-0 hover:bg-secondary cursor-pointer"
                      onClick={() => {
                        setCloneUrl(repo.clone_url);
                        setProjectName(repo.name);
                        setGithubSearchQuery('');
                      }}
                      data-testid={`github-repo-${repo.name}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-sm">{repo.full_name}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {repo.description || 'No description available'}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {repo.language && <span>{repo.language}</span>}
                            <div className="flex items-center gap-1">
                              <Star size={12} />
                              <span>{repo.stargazers_count}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handleCloneRepository}
                disabled={cloneProjectMutation.isPending}
                className="flex-1"
                data-testid="button-clone-repository"
              >
                {cloneProjectMutation.isPending ? 'Cloning...' : 'Clone Repository'}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setShowCloneDialog(false)}
                data-testid="button-cancel-clone"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
