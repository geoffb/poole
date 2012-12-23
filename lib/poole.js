var exec = require("child_process").exec;
var wrench = require("wrench");

var log = require("./log");
var config = require("./config");
var S3Bucket = require("./S3Bucket");

var cwd = process.cwd();

// Load up configuration
if (!config.read(cwd)) {
	process.exit();
}

var die = function (message) {
	log.error(message);
	process.exit();
};

var build = function (outputFolder, callback) {
	var command = "jekyll --no-auto --no-server " + outputFolder;

	log.info("Building with Jekyll...");
	var child = exec(command, function (err, stdout, stderr) {
		if (err) { die(err.message); }
		if (stderr) { die(stderr); }

		if (stdout) { log.output(stdout); }
		log.info("Jekyll build succeeded");
		callback && callback();
	});
};

var cleanup = function (outputFolder) {
	wrench.rmdirSyncRecursive(outputFolder);
};

module.exports = {

	deploy: function (targetAlias) {

		var target = config.targets[targetAlias];
		if (!target) {
			log.error("Target not found: " + targetAlias);
			return;
		}

		var auth = config.auth[target.auth];

		var outputFolder = "/tmp/poole-" + Date.now();

		build(outputFolder, function () {
			var bucket = new S3Bucket({
				key: auth.key,
				secret: auth.secret,
				bucket: target.bucket,
				region: target.region
			}, config.headers);

			bucket.syncFolder(outputFolder, function () {
				cleanup(outputFolder);
				log.info("Finished!");
			});
		});

	}

};
