# CLAUDE.md

## Source of Truth

Read `AGENTS.md` at the start of every task. It defines architecture boundaries, testing policy, conventions, and the decision log. Do not duplicate its contents here.

## Worktree Workflow

Worktrees are optional. You may commit directly in the primary repository worktree when preferred.

If using a worktree, create a worktree and branch before starting:

```sh
git worktree add ../i-<branch-name> -b <branch-name>
```

Work entirely within the worktree directory. Commit completed work there.

After finishing, return to the main working directory and clean up (optional):

```sh
git worktree remove ../i-<branch-name>
```

## Key Rules (from AGENTS.md)

These are highlighted for quick reference, not duplicated — `AGENTS.md` is authoritative:

- `pnpm verify` must pass before commit.
- Use `--no-gpg-sign` for commits.
- Commits must be self-contained and complete.
