# Protocol/Scheme handlers

You can create your own protocol/[scheme](https://www.iana.org/assignments/uri-schemes/uri-schemes.xhtml) 
handlers for external references. You can also override the default `http:`, `https:` and `file:` handlers if necessary.

Examples of custom scheme handlers might be `root:` or `parent:` for accessing the referring
parts of the definition, or a `ssh:` handler for secure retrieval.

## Example

```javascript
const util = require('util');
const converter = require('./index.js');

function cache(base,pointer,fragment,options) {
    if (options.verbose) console.log('Cache handler called',base,pointer,fragment);
    return new Promise(function(res,rej){
        res(...);
    });
}

converter.convertFile('./test.yaml',{
    handlers: { 'cache:': cache },
    resolve: true,
    source: './',
    verbose: true}, function(err,options){
        if (err) console.warn(util.inspect(err))
        else console.log(util.inspect(options.openapi));
    });
```
