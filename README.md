<p align="center">
  <h1 align="center">See Your AI</h1>
  <p align="center"><strong>Quality assurance for your AI agent context</strong></p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@seeyourai/cli"><img src="https://img.shields.io/npm/v/@seeyourai/cli.svg" alt="npm version"></a>
  <a href="https://github.com/seeyourai/seeyourai/actions"><img src="https://img.shields.io/github/actions/workflow/status/seeyourai/seeyourai/ci.yml?branch=main" alt="CI status"></a>
  <a href="https://github.com/seeyourai/seeyourai/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License"></a>
</p>

---

Every time an AI agent processes a prompt, it loads your context files (`CLAUDE.md`, linked docs, MCP tool definitions) into the context window. You pay for those tokens on **every single request** -- before the agent reads a line of your code.

`seeyourai` helps you **see**, **measure**, and **optimize** that context tax.

## Install

```bash
npm install -g @seeyourai/cli
```

Or run directly without installing:

```bash
npx seeyourai
```

`sya` is available as a short alias: `npx sya`

## Quickstart (30 seconds)

```bash
# Navigate to any project with CLAUDE.md, AGENTS.md, or MCP servers
cd my-project

# See your context tax
npx seeyourai
```

That's it. No accounts, no API keys, no setup. `seeyourai` scans your project and tells you exactly what your AI agent context costs per request, per model.

## What You Get

```
  sya context

━━ Context Audit ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ok  CLAUDE.md

  MCP Servers  12,400 tokens (3 servers)
    - filesystem                 ~4,200 tokens  12 tools  [user]
    - github                     ~5,800 tokens  18 tools  [user]
    - sequential-thinking        ~2,400 tokens   1 tools  [user]

  Linked Files  8,240 tokens (6 files)
    - CLAUDE.md                                  ~1.2k tok
    - docs/architecture.md                       ~3.1k tok
    - docs/api-reference.md                      ~2.4k tok

━━ Cost Per Request ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    Sonnet 4.6 $0.062/req
    GPT-5.2 $0.041/req
    Gemini 3.1 Pro $0.0031/req

━━ Session Cost Projections ━━━━━━━━━━━━━━━━━━━━━━━━━

    simple task (10 reqs)            $0.62
    typical session (30 reqs)        $1.86
    complex + subagents (100 reqs)   $6.19
```

## Commands

### `seeyourai context` -- Audit your context footprint

The core command. Scans your project and reports token counts, per-request costs across models, and lint issues in your context files.

```bash
seeyourai context              # Static audit (default, zero setup)
seeyourai context --json       # Machine-readable output for CI
```

| Flag | Description |
|------|-------------|
| `--json` | JSON output for CI/scripting |
| `--min-tokens <n>` | Minimum file token size to report (default: 100) |

Running `seeyourai` with no arguments is equivalent to `seeyourai context`.

### `seeyourai eval` -- Run context engineering evals

Define quality assertions for your agent context and run them automatically. Static evals validate structure, token budgets, and references without spawning an agent.

```bash
seeyourai eval init            # Scaffold .seeyourai/evals/ with example evals
seeyourai eval list            # List available eval cases
seeyourai eval run             # Run all evals
seeyourai eval run my-eval     # Run a specific eval
seeyourai eval run --json      # JSON output for CI
```

Example eval definition (`.seeyourai/evals/check-context.yaml`):

```yaml
name: check-context
description: "Verify context files follow project standards"
prompt: |
  Create a new file called hello.txt with the content "Hello from seeyourai eval!"
assertions:
  - type: file_exists
    path: "hello.txt"
    description: "Agent should create hello.txt"
  - type: file_contains
    path: "hello.txt"
    pattern: "Hello"
    description: "File should contain a greeting"
timeout: 60
tags: [example]
```

### `seeyourai mcp` -- Inspect MCP servers and tools

Deep-dive into your MCP tool surface. Shows every configured server and tool with token footprints, grouped by source (Claude Code, Cursor, Windsurf, etc.).

```bash
seeyourai mcp                      # List all MCP servers and tools
seeyourai mcp --live               # Live-ping servers for accurate tool counts
seeyourai mcp --source claude-code # Filter by source
seeyourai mcp --export openapi     # Export tool surface as OpenAPI spec
seeyourai mcp --json               # JSON output
```

## Why Context Quality Matters

AI agents load your context files into every request. A bloated `CLAUDE.md` with dead links, unused MCP servers, or vague instructions doesn't just waste money -- it degrades agent performance. Agents have limited context windows, and every token spent on low-quality context is a token not spent on your actual code.

`seeyourai` gives you visibility into this invisible cost:

- **See** what files and tools load into every agent request
- **Measure** the exact token count and dollar cost across models
- **Optimize** by identifying dead weight, broken references, and unused MCP servers

## What Gets Scanned

### Context files
- `CLAUDE.md` and `AGENTS.md` in your project root
- All local files linked from these docs (recursively)
- `.claude/` memory and settings

### MCP servers
Detects servers configured for:
- Claude Code, Claude Desktop
- Cursor, VS Code, Windsurf
- Codex, Kiro, Amazon Q, Goose
- Project-level and user-level configs

### Pricing
Cost calculations use bundled pricing data. No API calls are made -- everything runs locally.

## Configuration

Create a `syaconfig.json` in your project root to customize behavior:

```json
{
  "preferredProvider": "anthropic",
  "costEstimation": {
    "model": "claude-sonnet-4-6",
    "sessionProfiles": [
      { "name": "quick fix", "requests": 5 },
      { "name": "feature build", "requests": 50 },
      { "name": "full sprint", "requests": 200 }
    ]
  },
  "contextBudget": {
    "maxContextTaxPercent": 20,
    "referenceModel": "claude-sonnet-4-6"
  }
}
```

## CI Integration

Track context cost over time by adding `seeyourai` to your CI pipeline:

```yaml
# .github/workflows/context-audit.yml
- name: Context audit
  run: npx seeyourai context --json
```

## Requirements

- Node.js >= 18
- A project with `CLAUDE.md`, `AGENTS.md`, or MCP server configs

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute.

## License

Apache-2.0 -- see [LICENSE](LICENSE) for details.

---

Built by [See Your AI](https://seeyour.ai) | [Documentation](https://docs.seeyour.ai) | [GitHub](https://github.com/seeyourai/seeyourai)
