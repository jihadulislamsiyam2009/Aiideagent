import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  FolderOpen, 
  FolderClosed, 
  FileText, 
  ChevronRight, 
  ChevronDown,
  Code,
  FileCode,
  Image,
  Archive,
  Settings
} from "lucide-react";

interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: Date;
  extension?: string;
}

interface FileExplorerProps {
  files: FileInfo[];
  onFileSelect: (path: string) => void;
  onDirectoryChange: (path: string) => void;
  currentDirectory: string;
}

export function FileExplorer({ 
  files, 
  onFileSelect, 
  onDirectoryChange, 
  currentDirectory 
}: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const getFileIcon = (fileName: string, isDirectory: boolean, isExpanded?: boolean) => {
    if (isDirectory) {
      return isExpanded ? 
        <FolderOpen size={16} className="text-blue-400" /> : 
        <FolderClosed size={16} className="text-blue-400" />;
    }
    
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
        return <FileCode size={16} className="text-pink-400" />;
      case 'json':
        return <Settings size={16} className="text-yellow-500" />;
      case 'md':
        return <FileText size={16} className="text-blue-300" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return <Image size={16} className="text-purple-400" />;
      case 'zip':
      case 'tar':
      case 'gz':
        return <Archive size={16} className="text-gray-400" />;
      default:
        return <FileText size={16} className="text-gray-400" />;
    }
  };

  const handleItemClick = (file: FileInfo) => {
    if (file.type === 'directory') {
      const newPath = file.path;
      onDirectoryChange(newPath);
      
      // Toggle expansion for visual feedback
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        if (newSet.has(file.path)) {
          newSet.delete(file.path);
        } else {
          newSet.add(file.path);
        }
        return newSet;
      });
    } else {
      onFileSelect(file.path);
    }
  };

  const handleParentDirectory = () => {
    const parentPath = currentDirectory.split('/').slice(0, -1).join('/') || '.';
    onDirectoryChange(parentPath);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  // Sort files: directories first, then files, both alphabetically
  const sortedFiles = [...files].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="h-full flex flex-col" data-testid="file-explorer">
      {/* Navigation */}
      {currentDirectory !== '.' && (
        <div className="p-2 border-b border-border">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleParentDirectory}
            className="w-full justify-start"
            data-testid="button-parent-directory"
          >
            <ChevronRight size={14} className="rotate-180 mr-1" />
            .. (Parent Directory)
          </Button>
        </div>
      )}

      {/* File List */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="p-2 space-y-1">
          {sortedFiles.map((file) => {
            const isExpanded = expandedFolders.has(file.path);
            
            return (
              <div
                key={file.path}
                className="flex items-center gap-2 p-2 hover:bg-secondary rounded cursor-pointer transition-colors group"
                onClick={() => handleItemClick(file)}
                data-testid={`file-item-${file.name}`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {file.type === 'directory' && (
                    <ChevronRight 
                      size={12} 
                      className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                    />
                  )}
                  
                  {getFileIcon(file.name, file.type === 'directory', isExpanded)}
                  
                  <span className="text-sm truncate" title={file.name}>
                    {file.name}
                  </span>
                </div>
                
                {/* File Info */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  {file.type === 'file' && (
                    <>
                      <span>{formatFileSize(file.size)}</span>
                      <span>{formatDate(file.modified)}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {sortedFiles.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Empty directory</p>
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="p-2 border-t border-border text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>{sortedFiles.length} items</span>
          <span>
            {sortedFiles.filter(f => f.type === 'directory').length} folders, {' '}
            {sortedFiles.filter(f => f.type === 'file').length} files
          </span>
        </div>
      </div>
    </div>
  );
}
