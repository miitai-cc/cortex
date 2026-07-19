#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

VERSION="${VERSION:-latest}"

usage() {
    echo "Usage: $0 <target> [VERSION]"
    echo ""
    echo "Targets:"
    echo "  all          Build all images"
    echo "  app          cortex-app"
    echo "  sso          cortex-sso (keycloak)"
    echo "  qdrant       cortex-qdrant"
    echo "  ai-embedded  cortex-ai-embedded"
    echo "  ai-reranking cortex-ai-reranking"
    echo "  ai-common    cortex-ai-common"
    echo "  postgresql   cortex-postgresql"
    echo "  clean        Remove all images"
    echo ""
    echo "Examples:"
    echo "  $0 all"
    echo "  $0 app v1.0.0"
    echo "  $0 ai-embedded latest"
}

if [ $# -lt 1 ]; then
    usage
    exit 1
fi

TARGET="$1"
if [ $# -ge 2 ]; then
    VERSION="$2"
fi

make VERSION="$VERSION" "$TARGET"
