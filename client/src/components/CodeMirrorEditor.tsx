import { useEffect, useRef } from 'react';

interface CodeMirrorEditorProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  readOnly?: boolean;
  theme?: 'dark' | 'light';
}

export function CodeMirrorEditor({ 
  value, 
  language, 
  onChange, 
  onSave, 
  readOnly = false,
  theme = 'dark'
}: CodeMirrorEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<string>(value);

  useEffect(() => {
    contentRef.current = value;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    contentRef.current = newValue;
    onChange(newValue);
  };

  const getLanguageClass = (lang: string): string => {
    const langMap: { [key: string]: string } = {
      'javascript': 'javascript',
      'typescript': 'typescript',
      'python': 'python',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'markdown': 'markdown',
      'shell': 'bash',
      'sql': 'sql'
    };
    return langMap[lang] || 'text';
  };

  // For now, we'll use a simple textarea with syntax highlighting simulation
  // In a real implementation, this would integrate with Monaco Editor or CodeMirror
  return (
    <div 
      ref={editorRef}
      className="h-full relative bg-background text-foreground font-mono"
      data-testid="code-editor"
    >
      <div className="absolute inset-0 flex">
        {/* Line Numbers */}
        <div className="w-12 bg-muted border-r border-border p-2 text-right text-sm text-muted-foreground select-none">
          {value.split('\n').map((_, index) => (
            <div key={index} className="leading-6">
              {index + 1}
            </div>
          ))}
        </div>
        
        {/* Editor Content */}
        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            className={`
              absolute inset-0 w-full h-full p-4 bg-transparent text-foreground font-mono text-sm
              leading-6 resize-none outline-none border-none
              ${readOnly ? 'cursor-default' : 'cursor-text'}
            `}
            readOnly={readOnly}
            spellCheck={false}
            style={{
              tabSize: 2,
              fontFamily: 'var(--font-mono)',
              lineHeight: '1.5'
            }}
            data-testid="editor-textarea"
          />
          
          {/* Syntax Highlighting Overlay (simplified) */}
          <div 
            className="absolute inset-0 p-4 pointer-events-none whitespace-pre-wrap break-words font-mono text-sm leading-6"
            style={{
              fontFamily: 'var(--font-mono)',
              lineHeight: '1.5',
              color: 'transparent'
            }}
          >
            <SyntaxHighlighter content={value} language={language} />
          </div>
        </div>
      </div>
      
      {/* Status Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-card border-t border-border flex items-center justify-between px-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Line {value.substr(0, value.length).split('\n').length}</span>
          <span>Language: {language}</span>
        </div>
        <div className="flex items-center gap-4">
          <span>{readOnly ? 'Read-only' : 'Editing'}</span>
          <span>UTF-8</span>
        </div>
      </div>
    </div>
  );
}

// Simple syntax highlighter component
function SyntaxHighlighter({ content, language }: { content: string; language: string }) {
  const highlightCode = (code: string, lang: string): React.ReactNode => {
    const lines = code.split('\n');
    
    return lines.map((line, lineIndex) => (
      <div key={lineIndex}>
        {highlightLine(line, lang)}
        {lineIndex < lines.length - 1 && '\n'}
      </div>
    ));
  };

  const highlightLine = (line: string, lang: string): React.ReactNode => {
    // Simple keyword highlighting based on language
    const patterns = getLanguagePatterns(lang);
    let highlightedLine = line;
    let segments: React.ReactNode[] = [];
    let lastIndex = 0;

    patterns.forEach((pattern, index) => {
      const regex = new RegExp(pattern.regex, 'g');
      let match;
      
      while ((match = regex.exec(line)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
          segments.push(line.slice(lastIndex, match.index));
        }
        
        // Add highlighted match
        segments.push(
          <span key={`${index}-${match.index}`} className={pattern.className}>
            {match[0]}
          </span>
        );
        
        lastIndex = match.index + match[0].length;
      }
    });

    // Add remaining text
    if (lastIndex < line.length) {
      segments.push(line.slice(lastIndex));
    }

    return segments.length > 0 ? segments : line;
  };

  const getLanguagePatterns = (lang: string) => {
    const commonPatterns = {
      keyword: { regex: '\\b(function|const|let|var|if|else|for|while|class|import|export|return|async|await)\\b', className: 'text-purple-400' },
      string: { regex: '"[^"]*"|\'[^\']*\'|`[^`]*`', className: 'text-green-400' },
      comment: { regex: '//.*$|/\\*[\\s\\S]*?\\*/', className: 'text-gray-500' },
      number: { regex: '\\b\\d+(\\.\\d+)?\\b', className: 'text-yellow-400' }
    };

    const languageSpecific: { [key: string]: any[] } = {
      javascript: [commonPatterns.keyword, commonPatterns.string, commonPatterns.comment, commonPatterns.number],
      typescript: [commonPatterns.keyword, commonPatterns.string, commonPatterns.comment, commonPatterns.number],
      python: [
        { regex: '\\b(def|class|if|else|elif|for|while|import|from|return|try|except|with|as)\\b', className: 'text-purple-400' },
        commonPatterns.string,
        { regex: '#.*$', className: 'text-gray-500' },
        commonPatterns.number
      ],
      html: [
        { regex: '<[^>]+>', className: 'text-blue-400' },
        { regex: '\\b(class|id|src|href)=', className: 'text-purple-400' },
        commonPatterns.string
      ]
    };

    return languageSpecific[lang] || [commonPatterns.keyword, commonPatterns.string, commonPatterns.comment, commonPatterns.number];
  };

  return <>{highlightCode(content, language)}</>;
}
