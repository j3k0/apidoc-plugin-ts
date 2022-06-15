# apidoc-plugin-ts

A plugin for [apidoc](https://www.npmjs.com/package/apidoc) that injects params like `@apiSuccess` and `@apiParam` from TypeScript interfaces.
Supports extended and nested interfaces.

## Getting started

```javascript
npm install --save-dev apidoc @jchoelt/apidoc-plugin-ts
```

```javascript
yarn add -D apidoc @jchoelt/apidoc-plugin-ts
```

The following custom api-doc params are exposed:
- `@apiParamInterface`
- `@apiQueryInterface`
- `@apiBodyInterface`
- `@apiSuccessInterface`

```javascript
@CUSTOM_PARAM (optional path to definitions file) {INTERFACE_NAME}
 ```

## Example

Given the following interface:

```javascript
// filename: ./employers.ts

export interface Employer {
  /**
   * Employer job title
   */
  jobTitle: string;
  /**
   * Employer personal details
   */
  personalDetails: {
    name: string;
    age: number;
  }
}
```

and the following custom param:

```javascript
@apiSuccessInterface (./employers.ts) {Person}
```

under the hood this would transpile to:

```javascript
@apiSuccess {String} jobTitle Job title
@apiSuccess {Object} personalDetails Employer personal details
@apiSuccess {String} personalDetails.name
@apiSuccess {Number} personalDetails.age
```

*Note if the `Person` interface is defined in the same file then you can drop the path:*

```javascript
@apiSuccessInterface {Person}
```
