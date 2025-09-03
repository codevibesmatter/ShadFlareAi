'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo } from 'react';
import { Streamdown } from 'streamdown';
import { CodeBlock, CodeBlockCopyButton } from './code-block';

type ResponseProps = ComponentProps<typeof Streamdown> & {
  enableCodeBlocks?: boolean;
};

export const Response = memo(
  ({ className, enableCodeBlocks = true, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className
      )}
      components={enableCodeBlocks ? {
        code: ({ className, children, ...props }) => {
          // Extract language from className (e.g., "language-javascript" -> "javascript")
          const language = className?.replace(/language-/, '') || 'text';
          
          // For inline code, just render normally
          if (!className?.includes('language-')) {
            return <code className={cn('px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono text-sm', className)} {...props}>{children}</code>;
          }
          
          // For code blocks, use the enhanced CodeBlock component
          const codeContent = typeof children === 'string' ? children : String(children);
          
          return (
            <CodeBlock
              code={codeContent.trim()}
              language={language}
              showLineNumbers={true}
              className="my-4"
            >
              <CodeBlockCopyButton />
            </CodeBlock>
          );
        }
      } : undefined}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = 'Response';
