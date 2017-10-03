# Specification (Vendor) Extensions

Specification Extension|Vendor|Conversion Performed
|---|---|---|
x-ms-paths|[Microsoft](https://github.com/Azure/autorest/tree/master/docs/extensions)|Treated as an analogue of the `openapi.paths` object
x-ms-skip-url-encoding|[Microsoft](https://github.com/Azure/autorest/tree/master/docs/extensions)|For query parameters, converted to `allowReserved:true`
x-ms-odata|[Microsoft](https://github.com/Azure/autorest/tree/master/docs/extensions)|References to `#/definitions/` are updated to `#/components/schemas`
x-ms-parameterized-host|[Microsoft](https://github.com/Azure/autorest/tree/master/docs/extensions)|Converted into server entry
x-amazon-apigateway-any-method|[Amazon](http://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-swagger-extensions.html)|Treated as an analogue of the `operation Object`
x-servers|[swaggerplusplus](https://github.com/mermade/swaggerplusplus)|At root, path and operation, converted to `servers`
x-anyOf|[swaggerplusplus](https://github.com/mermade/swaggerplusplus)|Within schemas, converted to `anyOf`
x-oneOf|[swaggerplusplus](https://github.com/mermade/swaggerplusplus)|Within schemas, converted to `oneOf`
x-not|[swaggerplusplus](https://github.com/mermade/swaggerplusplus)|Within schemas, converted to `not`
x-required|[swaggerplusplus](https://github.com/mermade/swaggerplusplus)|Within schemas, concatenated with `required`
x-deprecated|[swaggerplusplus](https://github.com/mermade/swaggerplusplus)|Within parameters, converted to `deprecated`
x-links|[swaggerplusplus](https://github.com/mermade/swaggerplusplus)|At root and within responses, converted to `links`/`components/links`
x-callbacks|[swaggerplusplus](https://github.com/mermade/swaggerplusplus)|At root and within operations, converted to `callbacks`/`components/callbacks`
x-example|[apiary](https://help.apiary.io/api_101/swagger-extensions/#x-example)|Within parameters, converted to `example`

See also [APIMatic extensions](https://docs.apimatic.io/advanced/swagger-server-configuration-extensions/)
