#!/usr/bin/env bash
set -euo pipefail

BASE_REF="${BASE_REF:-${GITHUB_BASE_REF:-main}}"
HEAD_REF="${HEAD_REF:-HEAD}"
EVENT_PATH="${GITHUB_EVENT_PATH:-}"
CHANGED_FILES_OVERRIDE="${CHANGED_FILES_OVERRIDE:-}"

if ! git rev-parse --verify "origin/${BASE_REF}" >/dev/null 2>&1; then
  git fetch --no-tags --depth=1 origin "${BASE_REF}:${BASE_REF}" || git fetch --no-tags origin "${BASE_REF}"
fi

if [[ -n "${CHANGED_FILES_OVERRIDE}" ]]; then
  CHANGED_FILES="${CHANGED_FILES_OVERRIDE}"
else
  CHANGED_FILES="$(git diff --name-only "origin/${BASE_REF}...${HEAD_REF}")"
fi

echo "Base ref: ${BASE_REF}"
echo "Head ref: ${HEAD_REF}"
echo "Changed files:" 
printf '%s\n' "${CHANGED_FILES}"

if [[ -n "${EVENT_PATH}" ]] && command -v jq >/dev/null 2>&1; then
  if jq -e '.pull_request.labels[]? | select(.name == "spec-exempt")' "${EVENT_PATH}" >/dev/null; then
    echo "Bypass label 'spec-exempt' detected. Skipping spec guard."
    exit 0
  fi
fi

if [[ -z "${CHANGED_FILES}" ]]; then
  echo "No changed files detected."
  exit 0
fi

is_gated_change=0
while IFS= read -r file; do
  [[ -z "${file}" ]] && continue
  if [[ "${file}" =~ \.postman_collection\.json$ ]] || [[ "${file}" == docs/* ]] || [[ "${file}" == scripts/* ]] || [[ "${file}" == .github/workflows/* ]]; then
    is_gated_change=1
    break
  fi
done <<< "${CHANGED_FILES}"

if [[ "${is_gated_change}" -eq 0 ]]; then
  echo "No guarded path changes found."
  exit 0
fi

has_spec=0
has_plan=0
has_tasks=0

while IFS= read -r file; do
  [[ -z "${file}" ]] && continue
  if [[ "${file}" =~ ^specs/[0-9]{3}-[^/]+/spec\.md$ ]]; then
    has_spec=1
  fi
  if [[ "${file}" =~ ^specs/[0-9]{3}-[^/]+/plan\.md$ ]]; then
    has_plan=1
  fi
  if [[ "${file}" =~ ^specs/[0-9]{3}-[^/]+/tasks\.md$ ]]; then
    has_tasks=1
  fi
done <<< "${CHANGED_FILES}"

if [[ "${has_spec}" -eq 1 && "${has_plan}" -eq 1 && "${has_tasks}" -eq 1 ]]; then
  echo "Spec guard passed (spec.md + plan.md + tasks.md found)."
  exit 0
fi

echo "Spec guard failed."
echo "Major changes require updated spec artifacts in the same PR:"
echo "- specs/<feature>/spec.md"
echo "- specs/<feature>/plan.md"
echo "- specs/<feature>/tasks.md"
echo "To bypass for urgent fixes, add PR label: spec-exempt"
exit 1
