#!/usr/bin/env python3
"""Install a worktree-independent launcher for raw checks in older worktrees."""

from pathlib import Path
import argparse
import shutil

MARKER = "Managed by Chaarlie verification installer"
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--remote", action="store_true", help="also enable the opt-in Hetzner command")
options = parser.parse_args()
commands = [("coding-check", "run.py")]
if options.remote or (Path.home() / ".local/bin/coding-check-remote").exists():
    commands.append(("coding-check-remote", "remote.py"))

for name, filename in commands:
    source = Path(__file__).with_name(filename)
    destination = Path.home() / ".local/share/coding-verification" / filename
    launcher = Path.home() / ".local/bin" / name
    if launcher.exists() and MARKER not in launcher.read_text():
        raise SystemExit(f"Refusing to replace an unrelated launcher: {launcher}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    launcher.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    destination.chmod(0o600)
    launcher.write_text(
        "#!/usr/bin/env python3\n"
        f"# {MARKER}\n"
        "import os, sys\n"
        "from pathlib import Path\n"
        f"runner = Path.home() / '.local/share/coding-verification/{filename}'\n"
        "os.execv(sys.executable, [sys.executable, str(runner), *sys.argv[1:]])\n"
    )
    launcher.chmod(0o700)
    print(f"Installed {launcher}; run it directly or add ~/.local/bin to PATH.")
