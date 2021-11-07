#!/bin/bash

echo Pulling node:current-alpine
DIGEST=$(docker pull node:current-alpine | grep Digest | cut -d ' ' -f 2)
export DIGEST
echo "DIGEST=${DIGEST}"

echo Updating Dockerfile with Digest "${DIGEST}"
cp Dockerfile Dockerfile.bak
perl -pe 's/^FROM node:current-alpine.*$/FROM node:current-alpine\@$ENV{DIGEST} as base/' Dockerfile.bak >Dockerfile
rm Dockerfile.bak

echo Updating npm dependencies
npm outdated
ncu --upgrade
npm --silent install
npm outdated
npm audit
npm audit --fix

echo Changes:
git diff

