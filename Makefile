.PHONY: bootstrap test

BIN = ./node_modules/.bin

bootstrap:
	@yarn

test:
	@$(BIN)/standard
	@./node_modules/karma/bin/karma start --single-run=true

watch:
	@./node_modules/karma/bin/karma start

test-incognito:
	@./node_modules/karma/bin/karma start --single-run=true --browsers=SafariPrivate
