#!/bin/sh
cat coverage/lcov.info | node node_modules/coveralls/bin/coveralls.js
