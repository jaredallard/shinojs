#!/usr/bin/env node
try {
    var reporter = require('nodeunit').reporters.default;
} catch(e) {
    console.log("Cannot find nodeunit module.");
    console.log("Have you tried: npm install")
    process.exit();
}

process.chdir(__dirname);
reporter.run(['test']);
