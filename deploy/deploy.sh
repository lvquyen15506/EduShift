#!/usr/bin/env bash
set -Eeuo pipefail

cd /opt/edushift
tag="${1:-}"
if [[ ! "$tag" =~ ^sha-[0-9a-f]{40}$ ]]; then
  echo "Usage: deploy.sh sha-<40-character-git-sha>" >&2
  exit 2
fi
if [[ ! -f .env ]]; then
  echo "Missing /opt/edushift/.env; copy and fill deploy/.env.example first" >&2
  exit 2
fi

exec 9>.deploy.lock
flock -n 9 || { echo "Another deployment is running" >&2; exit 1; }

previous_tag="$(sed -n 's/^IMAGE_TAG=//p' .env | tail -1)"
export IMAGE_TAG="$tag"
compose=(docker compose --env-file .env -f compose.prod.yml)
"${compose[@]}" config --quiet
"${compose[@]}" pull
"${compose[@]}" up -d --remove-orphans

healthy=false
for _ in {1..45}; do
  if curl -fsS --max-time 3 http://127.0.0.1:8000/api/health >/dev/null \
      && curl -fsS --max-time 3 http://127.0.0.1:3000/ >/dev/null; then
    healthy=true
    break
  fi
  sleep 2
done

if [[ "$healthy" != true ]]; then
  "${compose[@]}" ps >&2
  echo "Deployment health check failed" >&2
  if [[ -n "$previous_tag" && "$previous_tag" != "$tag" ]]; then
    export IMAGE_TAG="$previous_tag"
    "${compose[@]}" up -d --remove-orphans
    echo "Restored previous image tag: $previous_tag" >&2
  fi
  exit 1
fi

if grep -q '^IMAGE_TAG=' .env; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$tag/" .env
else
  printf '\nIMAGE_TAG=%s\n' "$tag" >> .env
fi
echo "EduShift deployed: $tag"
