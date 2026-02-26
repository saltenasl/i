import type { ExtractionDebug } from '@repo/api';
import { useState } from 'react';

export const ExtractionDebugActions = ({
  sourceText,
  debug,
}: {
  sourceText: string;
  debug: ExtractionDebug;
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const copyDebugBundle = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            copiedAt: new Date().toISOString(),
            sourceText,
            prompt: debug.prompt,
            rawModelOutput: debug.rawModelOutput,
            validatedExtractionBeforeSegmentation: debug.validatedExtractionBeforeSegmentation,
            finalExtraction: debug.finalExtraction,
            segmentationTrace: debug.segmentationTrace,
            runtime: debug.runtime,
            fallbackUsed: debug.fallbackUsed,
            errors: debug.errors,
          },
          null,
          2,
        ),
      );
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <div>
      <button type="button" data-testid="copy-debug-bundle" onClick={() => void copyDebugBundle()}>
        Copy Debug Bundle
      </button>
      <span data-testid="copy-debug-state" style={{ marginLeft: 8, opacity: 0.8 }}>
        {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : ''}
      </span>
    </div>
  );
};
