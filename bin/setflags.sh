#!/bin/sh
if [ "$TRAVIS_NODE_VERSION" -eq "7" ] ; then
  export nflags="--harmony"
fi
echo flags: $nflags
