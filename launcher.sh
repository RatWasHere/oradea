#!/bin/bash

HERE="$(dirname "$(readlink -f "${0}")")"

exec "$HERE/oradea.AppImage" "$@" --no-sandbox
