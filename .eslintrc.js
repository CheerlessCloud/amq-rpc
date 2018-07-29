module.exports = {
  "root": true,
  "extends": [
    "eslint-config-airbnb-base",
    "plugin:flowtype/recommended"
  ],
  "parser": "babel-eslint",
  "parserOptions": {
    "sourceType": "module",
    "allowImportExportEverywhere": false,
    "codeFrame": false
  },
  "settings": {
    "flowtype": {
      "onlyFilesWithFlowAnnotation": true
    }
  },
  "env": {
    "node": true
  },
  "rules": {
    "flowtype/require-valid-file-annotation": [
      "error",
      "always",
      {
        "annotationStyle": "line"
      }
    ],
    "strict": "error",
    "no-restricted-syntax": "off",
    "max-len": [
      "error",
      100
    ]
  },
  "plugins": [
    "json",
    "flowtype"
  ]
}
