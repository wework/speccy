# Browser support

## Webpack v3

Many thanks to @RomanGotsiy for getting these sizes down somewhat.

```shell
$ webpack
$ ls -lh dist
total 1.7M
-rw-r--r-- 1 b2b wheel 1.2M Nov 14 23:39 common.js
-rw-r--r-- 1 b2b wheel  76K Nov 14 23:39 Converter.js
-rw-r--r-- 1 b2b wheel 444K Nov 14 23:39 Validator.js
```

```shell
$ webpack -p
$ ls -lh dist
total 844K
-rw-r--r-- 1 b2b wheel 594K Nov 14 23:36 common.js
-rw-r--r-- 1 b2b wheel  29K Nov 14 23:36 Converter.js
-rw-r--r-- 1 b2b wheel 214K Nov 14 23:36 Validator.js
```

## Browserify

Please see [api-spec-converter](https://github.com/LucyBot-Inc/api-spec-converter/) for setup or to use this [bundle](https://github.com/LucyBot-Inc/api-spec-converter/blob/master/dist/api-spec-converter.js).

Size: 8.45M
