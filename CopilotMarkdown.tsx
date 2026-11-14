import React from 'react';

function renderInline(str: string) {
  return str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, pIdx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={pIdx} className="font-semibold text-[#0B2A5B]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={pIdx}
          className="px-1 py-0.5 rounded bg-[#EAF3FF] font-mono text-[11px] text-[#0B2A5B]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={pIdx}>{part}</React.Fragment>;
  });
}

export function CopilotMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lineIdx} className="h-1" />;

        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          return (
            <h4 key={lineIdx} className="font-bold text-[#0B2A5B] text-xs pt-1">
              {trimmed.replace(/^#{2,3}\s+/, '')}
            </h4>
          );
        }
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
          return (
            <div key={lineIdx} className="flex gap-1.5 ps-1">
              <span className="text-[#1769E0] font-bold">·</span>
              <span>{renderInline(trimmed.slice(2))}</span>
            </div>
          );
        }
        return <p key={lineIdx}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}
