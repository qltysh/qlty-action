# CLAUDE.md

## Pull requests and AI review

Keep a pull request in draft while you iterate, and mark it ready when it's done. Marking it ready, and every push
after that, starts a Claude Code Review, so batch fixes into one push.

Before marking a PR ready, run `/code-review` and fix or answer each 🔴 Important finding. The review rules, which
Claude Code Review on GitHub follows too, are in REVIEW.md:

@REVIEW.md

Never resolve a 🔴 thread you didn't fix. If you disagree with a finding, reply with your reasoning and ask a person to
review.
