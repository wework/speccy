# Externals structure documentation

`options.externals` is an array of Objects containing the following properties:

Name|Type|Description
|---|---|---|
context|String|A JSON Pointer containing the path to the containing property which was resolved
$ref|String|The original `$ref` property
original|Object|The original Swagger 2.0 version of the resolved reference
updated|Object|The OpenAPI 3.0 version of the resolved reference
source|String|The resolved source of the external `$ref`

## Example

````json
[
  {
    "context": "#/paths/~1subscriptions~1{subscriptionId}~1providers~1Microsoft.Commerce~1RateCard/get/x-ms-examples/GetRateCard",
    "$ref": "../examples/GetRatecard.json",
    "source": "https://raw.githubusercontent.com/Azure/azure-rest-api-specs/2fb9a0b3b902335ff0b0033711c234431931ec9d/specification/commerce/resource-manager/Microsoft.Commerce/2015-06-01-preview/examples/GetRatecard.json",
    "original": {
      "title": "Get RateCard",
      "parameters": {
        "subscriptionId": "6d61cc05-8f8f-4916-b1b9-f1d9c25aae27",
        "api-version": "2015-06-01-preview",
        "$filter": "OfferDurableId eq 'MS-AZR-0003P' and Currency eq 'USD' and Locale eq 'en-US' and RegionInfo eq 'US'"
      },
      "responses": {
        "200": {
          "body": {
            "OfferTerms": [],
            "Meters": [
              {
                "EffectiveDate": "2017-09-01T00:00:00Z",
                "IncludedQuantity": 0,
                "MeterCategory": "Test Category",
                "MeterId": "1d7518e5-bc2f-4a93-9057-1b3047856645",
                "MeterName": "Test Meter",
                "MeterRates": {
                  "0": 1.99,
                  "100": 0.99
                },
                "MeterRegion": "US West",
                "MeterSubCategory": "Test Subcategory",
                "MeterTags": [
                  "Third Party"
                ],
                "Unit": "Hours"
              }
            ]
          }
        }
      }
    },
    "updated": {
      "title": "Get RateCard",
      "parameters": {
        "subscriptionId": "6d61cc05-8f8f-4916-b1b9-f1d9c25aae27",
        "api-version": "2015-06-01-preview",
        "$filter": "OfferDurableId eq 'MS-AZR-0003P' and Currency eq 'USD' and Locale eq 'en-US' and RegionInfo eq 'US'"
      },
      "responses": {
        "200": {
          "body": {
            "OfferTerms": [],
            "Meters": [
              {
                "EffectiveDate": "2017-09-01T00:00:00Z",
                "IncludedQuantity": 0,
                "MeterCategory": "Test Category",
                "MeterId": "1d7518e5-bc2f-4a93-9057-1b3047856645",
                "MeterName": "Test Meter",
                "MeterRates": {
                  "0": 1.99,
                  "100": 0.99
                },
                "MeterRegion": "US West",
                "MeterSubCategory": "Test Subcategory",
                "MeterTags": [
                  "Third Party"
                ],
                "Unit": "Hours"
              }
            ]
          }
        }
      }
    }
  }
]
````
