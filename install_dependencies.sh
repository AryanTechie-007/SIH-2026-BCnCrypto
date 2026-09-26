#!/usr/bin/env bash
# Wrapper script to execute dependency installer
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
chmod +x "$DIR/setup/install_dependencies.sh"
bash "$DIR/setup/install_dependencies.sh"
