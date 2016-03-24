.PHONY: bootstrap test

BIN = ./node_modules/.bin

bootstrap:
	@npm install

test:
	@$(BIN)/standard
	@./node_modules/karma/bin/karma start --single-run=true

watch:
	@./node_modules/karma/bin/karma start
