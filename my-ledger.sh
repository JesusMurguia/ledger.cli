#!/bin/bash
node ./ledger.js  --price-db prices_db \
-f index.ledger "$@"
