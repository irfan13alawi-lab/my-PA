#!/usr/bin/env bash
set -euo pipefail

echo "== IRFAN OS VPS health =="
date
echo
echo "-- service --"
systemctl is-active irfan-os-dashboard || true
systemctl is-enabled irfan-os-dashboard || true
echo
echo "-- memory and swap --"
free -h
swapon --show || true
echo
echo "-- disk --"
df -h / /home
echo
echo "-- listening port --"
ss -ltnp | grep ':18086' || true
echo
echo "-- available Ubuntu updates --"
updates="$(apt list --upgradable 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')"
echo "upgradable packages: ${updates}"
