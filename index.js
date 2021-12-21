#!/usr/bin/env node

var fs = require("fs");
var SourceMapConsumer = require("source-map").SourceMapConsumer;
var convert = require("convert-source-map");
var path = require("path");
var minimist = require("minimist");

require("colors");

var argv = minimist(process.argv.slice(2), {
    default: {
        padding: 10
    },
    alias: {
        p: "padding",
        h: "help"
    },
    boolean: [
        "help",
        "path"
    ]
});

if (argv.help) {
    process.stdout.write(fs.readFileSync(__dirname + "/README.md"));
    process.exit(0);
}

var line = 0;
var column = 0;

// remove file:// prefix if any
var file = argv._[0].replace(/^file\:\/\//, "");

var match;
if (match = file.match(/^(.*?)(\:[0-9]+)(\:[0-9]+|$)/)) {
    file = match[1];
    line = parseInt(match[2].slice(1), 10);
    if (match[3]) column = parseInt(match[3].slice(1), 10);
}


var source = fs.readFileSync(file).toString();
var converter;

// --map
if (argv.map) {
    var mapSource = fs.readFileSync(argv.map).toString();
    converter = convert.fromJSON(mapSource);
}

// inline base64 source map
// //# sourceMappingURL=data:application/json;base64,eyJ2....
if (!converter) {
    converter = convert.fromSource(source);
}

// With link to file name
// //# sourceMappingURL=filename.map
if (!converter) {
    converter = convert.fromMapFileSource(source, path.dirname(file));
}

// Just guess
if (!converter) {
    var guessFile = file.replace(/\.js$/, "") + ".map";
    var mapSource = fs.readFileSync(guessFile).toString();
    converter = convert.fromJSON(mapSource);
}

if (!converter || !converter.sourcemap) {
    console.error("Cannot find source map from", file);
    process.exit(1);
}

var smc = new SourceMapConsumer(converter.sourcemap);

var origpos = smc.originalPositionFor({ line: line, column: column });

if (argv.path) {
    process.stdout.write(origpos.source + "\n");
    process.exit(0);
}

try {
    var originalSource = fs.readFileSync(origpos.source).toString();
} catch (err) {
    console.error("Failed to open original source file from", origpos.source, err.code);
}

if (originalSource) {
    var preview = originalSource
        .split("\n")
        .map(function(line, i) {
            var linenum = i + 1;
            var out = linenum + ": " + line;
            if (linenum == origpos.line) out = out.red;
            return out;
        })
        .slice(origpos.line - argv.padding, origpos.line + argv.padding)
        .join("\n")
        ;

    console.log(preview);
    console.log();
}

console.log("file:", origpos.source);
console.log("line:", origpos.line, "column:", origpos.column);
