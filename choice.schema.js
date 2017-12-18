/**
 * Example formatting of a choice structure.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1
 * @license MIT
 */

[
  {
    version: 2,       // control the version used to parse this brick
    address: "hello", // allow referencing to this method outside of it's scope
    classifiers: [    // array of text classifiers
      "hi",
      "hello",
      "whatever"
    ],
    classifier: "yes", // or an existing classifier (system builtins)
    call: "hello",     // or link to another brick
    default: [         // string, one of these options, default: root
      "system",        // default to system commands if children aren't met
      "root",          // default to root level commands -> system, if children aren't met
      "unknown"        // default to "command unknown" handler
    ],
    action: "",        // method to call when conditions are met, return true / false to allow children prcoessing if available
    children: [        // an array of "chilren" options, allowing you to track actions available *after* this action.
      {
        version: 2,    // copy of above object basically
        address: "world", // evaluates to hello.world
      },
      {
        version: 2,
        call: "hello"  // link to another option
      }
    ]
  }
]
