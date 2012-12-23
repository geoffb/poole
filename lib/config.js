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

module.exports = {

	read: function (workingFolder) {
		// Keystore for various AWS accounts
		var homeFolder = process.env["HOME"];
		this.auth = readConfig(homeFolder + "/.poole-auth.json");

		// Project based configuration
		var localConfig = readConfig(workingFolder + "/.poole.json");
		if (!localConfig) {
			log.error("Couldn't find Poole configuration! Are you in the right folder?");
			return false;
		}

		for (var key in localConfig) {
			this[key] = localConfig[key];
		}

		return true;
	}

};
