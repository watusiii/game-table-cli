# GitHub in a Game Table room

## How a room uses GitHub
- A room can be connected to one GitHub repo by its owner.
- Edits save to a branch of the room's own, named `table/<room-slug>-<id6>`. They never go straight to `main`.
- Saving happens a few seconds after typing stops. Saved versions can be restored from HISTORY.
- **PROPOSE** opens GitHub's pull request page from the room's branch into `main`. `main` only changes when someone on GitHub accepts it.
- A secret scanner runs before anything is pushed. Never put keys, tokens, or passwords in a file anyway.

## What an AI helper may do
- Read and edit files, and create files. Those edits save to the room's branch like anyone else's.
- It may NOT delete files, connect or disconnect a repo, change roles or settings, or merge anything.
- Do not run `git` or `gh` against the room's repo yourself. The room server owns that clone. Work through the files commands.

## Good habits
1. Read before you write (`cat`), and change as little as you can. People are typing in the same file.
2. Keep commits meaningful: the room saves for you, so there is nothing to commit by hand.
3. Propose, don't push. Point a human at the PROPOSE link when a set of changes is ready.

## Official GitHub skills (optional, installed per person)
GitHub publishes agent skills in the `github/awesome-copilot` repo, and the GitHub CLI can install them:

```
gh skill search <word>
gh skill install github/awesome-copilot <skill-name> --agent claude-code --scope user
```

Skills that fit this app: `git-commit`, `github-issues`, `conventional-commit`, `conventional-branch`.
A skill is instructions your AI will follow. Read its SKILL.md before installing it, the same way you would review code.
These install on your own computer. Nothing in the room installs them for you.
