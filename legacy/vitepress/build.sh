#!/bin/sh
set -eu

if [ ! -e /workspace/node_modules ]; then
  ln -s /toolchain/node_modules /workspace/node_modules
fi

exec /toolchain/node_modules/.bin/vitepress build /workspace "$@"

