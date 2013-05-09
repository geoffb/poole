var fs = require("fs");
var path = require("path");

var log = require("./log");

var readConfig = function (file) {
	var file = path.resolve(file);
	if (fs.existsSync(file)) {
		return JSON.parse(fs.readFileSync(file, "utf-8"));
	}
	return null;
};

var exports = module.exports = {};

exports.read = function (workingFolder) {
	var homeFolder = process.env["HOME"];
	var config = readConfig(homeFolder + "/.poole-config.json");

	for (var key in config) {
		exports[key] = config[key];
	}

	// Project based configuration
	exports.local = {};
	var localConfig = readConfig(workingFolder + "/.poole.json");
	if (!localConfig) {
		log.error("Couldn't find Poole configuration! Are you in the right folder?");
		return false;
	}

	for (var key in localConfig) {
		exports.local[key] = localConfig[key];
	}

	return true;
};

exports.getOpt = function (key, defaultValue) {
	if (exports.opts && exports.opts[key]) {
		return exports.opts[key];
	} else {
		return defaultValue;
	}
};

// Read config right away
var cwd = process.cwd();
if (!exports.read(cwd)) {
	process.exit();
}
