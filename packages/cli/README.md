# seeyourai

**Know exactly what your AI agent context costs — per request, per model.**

Every time an AI agent processes a prompt, it loads your context files (`CLAUDE.md`, linked docs, MCP tool definitions) into the context window. You pay for these tokens on **every single request**, before the agent reads a line of your code.

This is your **context tax**. `seeyourai` shows you what it costs.

## Quick Start

```bash
npx seeyourai
```

That's it. Run it in any project with a `CLAUDE.md`, `AGENTS.md`, or MCP servers configured.

`sya` is available as a short alias: `npx sya`

## What It Does

`seeyourai` scans your project and answers one question: **how much does your context cost per request?**

- **Context file graph** — Maps every file auto-loaded from your CLAUDE.md/AGENTS.md, recursively following links
- **MCP server overhead** — Scans all configured MCP servers (Claude Code, Cursor, Windsurf, Codex, etc.) and estimates their token cost
- **Cost per request** — Shows exact cost across 7 models (Opus, Sonnet, GPT-5, Gemini, etc.)
- **Session cost projections** — Extrapolates to real-world sessions (10, 30, 100 requests)
- **Lint issues** — Validates structure and identifies broken references

## Example Output

```
  seeyourai context

━━ Context Audit ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ok  CLAUDE.md
  ok  AGENTS.md

  MCP Servers  12,400 tokens (3 servers)
    - filesystem                 ~4,200 tokens  12 tools  [user]  (claude-code)
    - github                     ~5,800 tokens  18 tools  [user]  (claude-code)
    - sequential-thinking        ~2,400 tokens   1 tools  [user]  (claude-code)

  Linked Files  8,240 tokens (6 files)
    - CLAUDE.md                                  ~1.2k tok
    - AGENTS.md                                  ~0.8k tok
    - docs/architecture.md                       ~3.1k tok
    - docs/api-reference.md                      ~2.4k tok
    - .claude/settings.md                        ~0.5k tok
    - .claude/user-preferences.md                ~0.2k tok

━━ Cost Per Request ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Your context tax across models:

    Opus 4.6 $0.10/req
    Sonnet 4.6 $0.062/req
    GPT-5.2 $0.041/req
    GPT-5 mini $0.0062/req
    Codex 5.3 $0.0031/req
    Gemini 3.1 Pro $0.0031/req
    Gemini 2.5 Flash $0.00031/req

━━ Session Cost Projections ━━━━━━━━━━━━━━━━━━━━━━━━━

  Based on 20,640 context tokens loaded per request (Sonnet 4.6):

    simple task (10 reqs)            $0.62
    typical session (30 reqs)        $1.86
    complex + subagents (100 reqs)   $6.19

  This is your "context tax" — paid before the agent reads a single line of your code.

━━ Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  No issues found.
  Context tax: 20,640 tokens per request
```

## Usage

```bash
seeyourai                          # Analyze context and show per-request costs
seeyourai context                  # Same as above
seeyourai context --json           # Machine-readable output for CI
seeyourai context --full           # Include dynamic session analysis
```

| Flag | Description |
|------|-------------|
| `--json` | JSON output for CI/scripting |
| `--full` | Include dynamic session analysis (requires trace data) |
| `--session <id>` | Analyze a specific session (implies --full) |
| `--all` | Analyze all stored sessions (implies --full) |
| `--min-tokens <n>` | Minimum file token size to report (default: 100) |
| `--update-baseline` | Write results to seeyourai-baseline.yaml for CI |

## What Gets Scanned

### Context Files
- `CLAUDE.md` and `AGENTS.md` in your project root
- All local files linked from these docs (recursive)
- `.claude/` memory directory

### MCP Servers
Detects servers configured in:
- Claude Code (`~/.claude/settings.json`)
- Claude Desktop
- Cursor (`~/.cursor/mcp.json`)
- Windsurf, Codex, VS Code, Kiro, Amazon Q, Goose, and more
- Project-level configs (`.claude/settings.json`, `.cursor/mcp.json`, etc.)

### Pricing
Cost calculations use bundled pricing data from [LiteLLM](https://github.com/BerriAI/litellm). No API calls are made — everything runs locally.

## CI Integration

Add to your CI pipeline to track context cost over time:

```bash
npx seeyourai --json
```

Or generate a baseline file to commit:

```bash
npx seeyourai --update-baseline
```

## Requirements

- Node.js >= 18
- A project with `CLAUDE.md`, `AGENTS.md`, or MCP server configs

## License

MIT
