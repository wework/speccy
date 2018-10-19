---
layout: page
title: Custom Rulesets
permalink: /rules/2-custom-rulesets
---

Let's define some terminology:

- *Rules:* Rules exist to assert certain things are true about a specification file. They exist in rulesets, and have one or more actions
- *Rule Action:* Rule actions are defined in the code, and can be referenced in various combinations to power the logic of a rule
- *Ruleset:* These group up rules (and all of their various actions) into a file, which can be distributed for others to use

### Ruleset file format

A rules file is a JSON formatted file, containing an object with a `rules` property, which is an array of rule objects.

There is a reserved `require` property (type `string`) at the top level, which can be used for ruleset chaining.

#### Example

```json
{
    "require" : "default",
    "rules" : [
        {
            "name": "openapi-tags",
            "object": "openapi",
            "enabled": true,
            "description": "openapi object should have non-empty tags array",
            "truthy": "tags"
        },
        {
            "name": "default-and-example-are-redundant",
            "object": "*",
            "enabled": true,
            "description": "don't need to define an example if its exactly the same as your default",
            "notEqual": ["default", "example"]
        }
    ]
}
```

### Rule object format

|Property|Type|Required|Description|
|---|---|---|---|
|name|string|yes|The name/slug of the rule. Use hyphens. Used as the unique key. You can namespace your rules with any prefix and delimiter you wish, to avoid clashes with other people's and the built-in rules|
|description|string|recommended|An optional description for the rule|
|enabled|boolean|no|Set to `false` to temporarily disable a rule|
|object|string\|array|no|The object(s) to act upon, may be `*` for all objects. E.g. `parameter`|
|truthy|string\|array|no|A property or list of properties which must be truthy (present with a non-false, non-null, non-empty value). Empty arrays are not considered truthy|
|alphabetical|object|reserved|Makes sure values are in alphabetical order. Structure: `{ properties: string, keyedBy: string }`|
|or|array|no|An array of property names, one or more of which must be present|
|maxLength|object|reserved|An object containing a `property` string name, and a `value` (integer). The length of the `property` value must not be longer than `value`|
|notContain|object|no|An object containing a `properties` array and a `value`. None of the `properties` must contain the `value`. Used with strings|
|notEndWith|object|no|An object containing a `property`, an optional `omit` prefix and a `value` string. The given `property` (once `omit` is removed) must not end with the given `value`. Used with strings|
|notEquals|object|no|An array containing a list of property names, which must have different values if present|
|pattern|object|no|An object containing a `property` name, an optional `split` string which is used to split the value being tested into individual components, an optional `omit` string (which is chopped off the front of each component being tested), and a `value` regex property which is used to test all components of the property value being tested|
|properties|integer|no|The exact number of non-extension properties which must be present on the target object|
|skip|string|no|The name of a property in the `options` object. If this property is truthy, then the rule is skipped. E.g. `isCallback` can be used to skip rules for `operation` objects within `callback` objects, while still applying to top-level `operation` objects|
|xor|array|no|An array of property names, only one of which must be present|

<hr>

### Using Custom Rulesets

The `speccy lint` command supports `--rules`, and currently the value needs to be a URL to your custom ruleset file. Local file paths will not work. Pull requests welcome!

<hr>

### Creating Rule Actions

This is a little more tricky, and requires knowledge of JavaScript.

Clone speccy on Github and navigate to `lib/linter.js`. Look for `if (rule.truthy) {` and that's where the rule action checking starts.

Using [should.js](https://shouldjs.github.io/) assertions wrapped with an `ensure` function, you can write any code you like. PR that back to the main speccy repo, and when it's in you can use it for your own rules.
