import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { 
  Brain, 
  FolderOpen, 
  Cpu, 
  Plus, 
  Download, 
  Play, 
  Rocket,
  Circle
} from "lucide-react";

interface DashboardStats {
  models: {
    total: number;
    active: number;
    idle: number;
  };
  projects: {
    total: number;
    active: number;
    archived: number;
  };
  system: {
    memoryUsage: number;
    totalMemory: string;
    usedMemory: string;
  };
}

interface Activity {
  id: number;
  type: string;
  message: string;
  timestamp: Date;
  status: string;
}

export default function Dashboard() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 5000
  });

  const { data: activities } = useQuery<Activity[]>({
    queryKey: ['/api/dashboard/activity'],
    refetchInterval: 10000
  });

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'model_download': return 'bg-accent';
      case 'project_create': return 'bg-primary';
      case 'deployment': return 'bg-yellow-500';
      case 'sync': return 'bg-purple-500';
      default: return 'bg-muted-foreground';
    }
  };

  return (
    <div className="h-full p-6 overflow-y-auto scrollbar-hide" data-testid="dashboard-view">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Quick Stats */}
        <Card data-testid="stats-models">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Active Models</h3>
              <Brain className="text-primary" size={20} />
            </div>
            <div className="text-3xl font-bold mb-2">
              {stats?.models.total || 0}
            </div>
            <div className="text-sm text-muted-foreground">
              {stats?.models.active || 0} running, {stats?.models.idle || 0} idle
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stats-projects">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Projects</h3>
              <FolderOpen className="text-accent" size={20} />
            </div>
            <div className="text-3xl font-bold mb-2">
              {stats?.projects.total || 0}
            </div>
            <div className="text-sm text-muted-foreground">
              {stats?.projects.active || 0} active, {stats?.projects.archived || 0} archived
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stats-gpu">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">GPU Usage</h3>
              <Cpu className="text-yellow-500" size={20} />
            </div>
            <div className="text-3xl font-bold mb-2">
              {stats?.system.memoryUsage || 0}%
            </div>
            <div className="text-sm text-muted-foreground">
              {stats?.system.usedMemory || '0GB'} / {stats?.system.totalMemory || '0GB'} VRAM
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card data-testid="recent-activity">
          <CardHeader className="pb-3">
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activities?.length ? (
              activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${getActivityColor(activity.type)}`}></div>
                  <div className="flex-1">
                    <p className="text-sm">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Circle size={48} className="mx-auto mb-4 opacity-20" />
                <p>No recent activity</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Model Performance */}
        <Card data-testid="model-performance">
          <CardHeader className="pb-3">
            <CardTitle>Model Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">llama3.1:8b</span>
                <span className="text-sm text-muted-foreground">245ms avg</span>
              </div>
              <Progress value={85} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">codellama:7b</span>
                <span className="text-sm text-muted-foreground">180ms avg</span>
              </div>
              <Progress value={92} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">mistral:7b</span>
                <span className="text-sm text-muted-foreground">320ms avg</span>
              </div>
              <Progress value={72} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="xl:col-span-2" data-testid="quick-actions">
          <CardHeader className="pb-3">
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button 
                variant="outline" 
                className="flex flex-col items-center gap-2 p-6 h-auto"
                data-testid="action-new-project"
              >
                <Plus className="text-primary" size={24} />
                <span className="text-sm font-medium">New Project</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="flex flex-col items-center gap-2 p-6 h-auto"
                data-testid="action-download-model"
              >
                <Download className="text-accent" size={24} />
                <span className="text-sm font-medium">Download Model</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="flex flex-col items-center gap-2 p-6 h-auto"
                data-testid="action-run-code"
              >
                <Play className="text-yellow-500" size={24} />
                <span className="text-sm font-medium">Run Code</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="flex flex-col items-center gap-2 p-6 h-auto"
                data-testid="action-deploy"
              >
                <Rocket className="text-purple-500" size={24} />
                <span className="text-sm font-medium">Deploy</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
