import { useState, useEffect } from "react";
import { FileExplorer } from "@/components/FileExplorer";
import { CodeMirrorEditor } from "@/components/CodeMirrorEditor";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Save, 
  Play, 
  FolderPlus, 
  FilePlus, 
  X,
  Code,
  FileCode
} from "lucide-react";

interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: Date;
  extension?: string;
}

interface OpenFile {
  path: string;
  content: string;
  modified: boolean;
  language: string;
}

export default function CodeEditor() {
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [currentDirectory, setCurrentDirectory] = useState('.');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: files = [] } = useQuery<FileInfo[]>({
    queryKey: ['/api/files', currentDirectory],
    queryFn: async () => {
      const response = await fetch(`/api/files?path=${encodeURIComponent(currentDirectory)}`);
      return response.json();
    }
  });

  const saveFileMutation = useMutation({
    mutationFn: async ({ path, content }: { path: string; content: string }) => {
      return apiRequest('POST', '/api/files/content', { path, content });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "File Saved",
        description: `${variables.path} has been saved successfully`
      });
      
      // Update the file in openFiles to mark as not modified
      setOpenFiles(prev => prev.map(file => 
        file.path === variables.path 
          ? { ...file, modified: false }
          : file
      ));
      
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const createFileMutation = useMutation({
    mutationFn: async ({ path, type }: { path: string; type: 'file' | 'directory' }) => {
      return apiRequest('POST', '/api/files/create', { path, type });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
    }
  });

  const openFile = async (filePath: string) => {
    // Check if file is already open
    const existingFile = openFiles.find(f => f.path === filePath);
    if (existingFile) {
      setActiveFile(filePath);
      return;
    }

    try {
      const response = await fetch(`/api/files/content?path=${encodeURIComponent(filePath)}`);
      const data = await response.json();
      
      const language = getLanguageFromPath(filePath);
      const newFile: OpenFile = {
        path: filePath,
        content: data.content || '',
        modified: false,
        language
      };

      setOpenFiles(prev => [...prev, newFile]);
      setActiveFile(filePath);
    } catch (error) {
      toast({
        title: "Failed to Open File",
        description: "Could not load file content",
        variant: "destructive"
      });
    }
  };

  const closeFile = (filePath: string) => {
    setOpenFiles(prev => prev.filter(f => f.path !== filePath));
    
    if (activeFile === filePath) {
      const remainingFiles = openFiles.filter(f => f.path !== filePath);
      setActiveFile(remainingFiles.length > 0 ? remainingFiles[remainingFiles.length - 1].path : null);
    }
  };

  const updateFileContent = (filePath: string, content: string) => {
    setOpenFiles(prev => prev.map(file => 
      file.path === filePath 
        ? { ...file, content, modified: true }
        : file
    ));
  };

  const saveFile = (filePath: string) => {
    const file = openFiles.find(f => f.path === filePath);
    if (file) {
      saveFileMutation.mutate({ path: filePath, content: file.content });
    }
  };

  const saveActiveFile = () => {
    if (activeFile) {
      saveFile(activeFile);
    }
  };

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'json': 'json',
      'md': 'markdown',
      'yaml': 'yaml',
      'yml': 'yaml',
      'sql': 'sql',
      'sh': 'shell',
      'bash': 'shell'
    };
    return languageMap[ext || ''] || 'text';
  };

  const getFileIcon = (fileName: string, isDirectory: boolean) => {
    if (isDirectory) return <FolderPlus size={16} className="text-yellow-500" />;
    
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
        return <Code size={16} className="text-yellow-400" />;
      case 'ts':
      case 'tsx':
        return <Code size={16} className="text-blue-400" />;
      case 'py':
        return <FileCode size={16} className="text-green-400" />;
      case 'html':
        return <FileCode size={16} className="text-orange-400" />;
      case 'css':
      case 'scss':
        return <FileCode size={16} className="text-blue-400" />;
      default:
        return <FileText size={16} className="text-gray-400" />;
    }
  };

  const activeFileData = openFiles.find(f => f.path === activeFile);

  return (
    <div className="flex h-full" data-testid="code-editor-view">
      {/* File Explorer */}
      <div className="w-64 border-r border-border">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">Explorer</h3>
            <div className="flex gap-1">
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => {
                  const fileName = prompt('Enter file name:');
                  if (fileName) {
                    createFileMutation.mutate({ 
                      path: `${currentDirectory}/${fileName}`, 
                      type: 'file' 
                    });
                  }
                }}
                data-testid="button-new-file"
              >
                <FilePlus size={14} />
              </Button>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => {
                  const dirName = prompt('Enter directory name:');
                  if (dirName) {
                    createFileMutation.mutate({ 
                      path: `${currentDirectory}/${dirName}`, 
                      type: 'directory' 
                    });
                  }
                }}
                data-testid="button-new-folder"
              >
                <FolderPlus size={14} />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground truncate" title={currentDirectory}>
            {currentDirectory}
          </p>
        </div>

        <FileExplorer
          files={files}
          onFileSelect={openFile}
          onDirectoryChange={setCurrentDirectory}
          currentDirectory={currentDirectory}
        />
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col">
        {/* Editor Tabs */}
        {openFiles.length > 0 ? (
          <>
            <div className="flex border-b border-border overflow-x-auto">
              {openFiles.map((file) => (
                <div
                  key={file.path}
                  className={`flex items-center gap-2 px-4 py-2 border-r border-border cursor-pointer transition-colors ${
                    activeFile === file.path 
                      ? 'bg-secondary border-b-2 border-primary' 
                      : 'hover:bg-secondary/50'
                  }`}
                  onClick={() => setActiveFile(file.path)}
                  data-testid={`tab-${file.path}`}
                >
                  {getFileIcon(file.path, false)}
                  <span className="text-sm">
                    {file.path.split('/').pop()}
                    {file.modified && <span className="text-destructive">*</span>}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeFile(file.path);
                    }}
                  >
                    <X size={12} />
                  </Button>
                </div>
              ))}
            </div>

            {/* Editor Toolbar */}
            <div className="flex items-center gap-2 p-2 border-b border-border bg-card">
              <Button 
                size="sm" 
                onClick={saveActiveFile}
                disabled={!activeFileData?.modified || saveFileMutation.isPending}
                data-testid="button-save-file"
              >
                <Save size={14} className="mr-1" />
                Save
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                data-testid="button-run-file"
              >
                <Play size={14} className="mr-1" />
                Run
              </Button>
              {activeFileData && (
                <div className="ml-auto text-xs text-muted-foreground">
                  {activeFileData.language} • {activeFileData.path}
                </div>
              )}
            </div>

            {/* Code Editor */}
            <div className="flex-1">
              {activeFileData && (
                <CodeMirrorEditor
                  value={activeFileData.content}
                  language={activeFileData.language}
                  onChange={(content) => updateFileContent(activeFile!, content)}
                  onSave={() => saveActiveFile()}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Code size={64} className="mx-auto mb-4 text-muted-foreground opacity-20" />
              <h3 className="text-lg font-semibold mb-2">No File Open</h3>
              <p className="text-muted-foreground">Select a file from the explorer to start editing</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
