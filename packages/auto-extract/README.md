# @repo/auto-extract

`@repo/auto-extract` provides LangExtract-like extraction by spawning a local `llama.cpp` binary and validating strict grounding (`value === text.slice(start, end)`) before returning typed output.

## Usage

```ts
import { extractV2 } from "@repo/auto-extract";

const result = await extractV2("...");
```

On first call, assets are auto-downloaded to:
- `~/.auto-extract/llama`
- `~/.auto-extract/model.gguf`

This POC currently targets macOS Apple Silicon only.
