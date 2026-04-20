module.exports = {
  extends: ["stylelint-config-standard"],
  rules: {
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "tailwind",
          "apply",
          "layer",
          "screen",
          "responsive",
          "component",
          "utility",
          "import"
        ],
      },
    ],
    "selector-pseudo-class-no-unknown": [
      true,
      {
        ignorePseudoClasses: ["first-letter", "first-line"],
      },
    ],
    "function-no-unknown": [
      true,
      {
        ignoreFunctions: ["hsl", "rgb", "rgba"],
      },
    ],
  },
};
