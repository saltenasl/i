# auto-extract

`auto-extract` provides LangExtract-like extraction by spawning a local `llama.cpp` binary and validating strict grounding (`value === text.slice(start, end)`) before returning typed output.

## Usage

```ts
import { extract } from "auto-extract";

const result = await extract("...");
```

On first call, assets are auto-downloaded to:
- `~/.auto-extract/llama`
- `~/.auto-extract/model.gguf`

This POC currently targets macOS Apple Silicon only.
