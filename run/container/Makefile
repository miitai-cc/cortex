REGISTRY := miitai-cc
VERSION  ?= latest
PROJECT_ROOT := ../..

.PHONY: all app sso qdrant ai-embedded ai-reranking ai-common postgresql clean

all: app sso qdrant ai-embedded ai-reranking ai-common postgresql

app:
	docker build -t $(REGISTRY)/cortex-app:$(VERSION) -f app/Dockerfile $(PROJECT_ROOT)

sso:
	docker build -t $(REGISTRY)/cortex-sso:$(VERSION) -f sso/keycloak/Dockerfile $(PROJECT_ROOT)

qdrant:
	docker build -t $(REGISTRY)/cortex-qdrant:$(VERSION) -f qdrant/Dockerfile $(PROJECT_ROOT)

ai-embedded:
	docker build -t $(REGISTRY)/cortex-ai-embedded:$(VERSION) -f ai/embedded/Dockerfile $(PROJECT_ROOT)

ai-reranking:
	docker build -t $(REGISTRY)/cortex-ai-reranking:$(VERSION) -f ai/reranking/Dockerfile $(PROJECT_ROOT)

ai-common:
	docker build -t $(REGISTRY)/cortex-ai-common:$(VERSION) -f ai/common/Dockerfile $(PROJECT_ROOT)

postgresql:
	docker build -t $(REGISTRY)/cortex-postgresql:$(VERSION) -f postgresql/Dockerfile $(PROJECT_ROOT)

clean:
	@echo "Removing images..."
	@docker rmi $(REGISTRY)/cortex-app:$(VERSION) 2>/dev/null || true
	@docker rmi $(REGISTRY)/cortex-sso:$(VERSION) 2>/dev/null || true
	@docker rmi $(REGISTRY)/cortex-qdrant:$(VERSION) 2>/dev/null || true
	@docker rmi $(REGISTRY)/cortex-ai-embedded:$(VERSION) 2>/dev/null || true
	@docker rmi $(REGISTRY)/cortex-ai-reranking:$(VERSION) 2>/dev/null || true
	@docker rmi $(REGISTRY)/cortex-ai-common:$(VERSION) 2>/dev/null || true
	@docker rmi $(REGISTRY)/cortex-postgresql:$(VERSION) 2>/dev/null || true
