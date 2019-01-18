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

A rules file is a YAML formatted file (v0.8.x and earlier was a JSON file), containing an object with a `rules` property, which is an array of rule objects.

There is a reserved `require` property (type `string`) at the top level, which can be used for ruleset chaining.

#### Example

```yaml
require: default
rules: 
- name: openapi-tags
  object: openapi
  description: "openapi object should have non-empty tags array"
  truthy: tags
- name: default-and-example-are-redundant
  object: "*"
  description: "don't need to define an example if its exactly the same as your default"
  notEqual: ["default", "example"]
```

Since v0.9.0, Speccy uses [oas-linter], which is part of [oas-kit] by [Mike Ralphson]. 

See the [full list of rule actions][linter-rules] available to be used in your rulesets. 

[linter-rules]: https://mermade.github.io/oas-kit/linter-rules.html
[oas-linter]: https://www.npmjs.com/package/oas-linter
[oas-kit]: https://github.com/Mermade/oas-kit/
[Mike Ralphson]: https://twitter.com/permittedsoc