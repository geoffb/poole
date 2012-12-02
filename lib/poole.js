var fs = require("fs");
var crypto = require("crypto");
var exec = require("child_process").exec;
var colors = require("colors");
var ini = require("ini");
var knox = require("knox");
var wrench = require("wrench");
var Bagpipe = require("bagpipe");

// We use bagpipe in order to throttle the async file system calls
// If you open to many files at once, node will throw EMFILE errors
var bag = new Bagpipe(20);

// Local map of content keys for looking up content details
var bucket = {};

var logError = function (message) {
	console.error("ERROR:".red, message);
};

var logInfo = function (message) {
	console.info(message.grey);
};

var die = function (message) {
	logError(message);
	console.error("ABORT:".red, "Poole aborted due to the errors above");
	process.exit();
};

var configPath = ".poole.ini";
if (!fs.existsSync(configPath)) {
	die("No .poole.ini found!");
}

var config = ini.parse(fs.readFileSync(configPath, "utf-8"));

// We use the know utility for interacting with S3
// TODO: Set config from external source
var client = knox.createClient({
	key: config.key,
	secret: config.secret,
	region: config.region,
	bucket: config.bucket
});

var build = function (outputFolder, callback) {
	var command = "jekyll --no-auto --no-server " + outputFolder;

	console.log("INFO:".blue, "Building with Jekyll...");
	var child = exec(command, function (err, stdout, stderr) {
		if (err) { die(err.message); }
		if (stderr) { die(stderr); }

		if (stdout) { logInfo(stdout); }
		console.info("INFO:".blue, "Jekyll build succeeded");
		callback && callback();
	});
};

var checkBucket = function (outputFolder, callback) {
	var onEnd = function () {
		callback && callback();
	};

	client.list(function (err, data) {
		// TODO: Check for errors
		var contents = data.Contents;
		var count = 0;

		if (contents.length < 1) {
			onEnd();
			return;
		}

		for (var i = 0, j = contents.length; i < j; ++i) {
			var item = contents[i];
			bucket[item.Key] = item;
			++count;
			bag.push(processBucketItem, item, outputFolder, function () {
				--count;
				count <= 0 && onEnd();
			});
		}
	});
};

var processBucketItem = function (item, outputFolder, callback) {
	var file = outputFolder + "/" + item.Key;

	fs.exists(file, function (exists) {
		if (exists) {
			// Hash file contents and compare against stored value
			var hash = crypto.createHash("md5");
			var stream = fs.ReadStream(file);

			stream.on("data", function (data) {
				hash.update(data);
			});

			stream.on("end", function () {
				var local = hash.digest("hex");
				var remote = item.ETag.replace(/"/g, "");
				item.dirty = (local !== remote);
				callback && callback();
			});
		} else {
			// Delete from the bucket
			var fileName = "/" + encodeURIComponent(item.Key);
			client.deleteFile(fileName, function (err, res) {
				// TODO: Handle errors

				console.info("DELETE:".red, item.Key, String(res.statusCode).grey);
				callback && callback();
			});
		}
	});
};

var checkLocal = function (outputFolder, callback) {
	var totalFiles = 0;
	var totalProcessed = 0;
	wrench.readdirRecursive(outputFolder, function (err, files) {
		if (!files) { return; }

		totalFiles += files.length;
		for (var i = 0, j = files.length; i < j; ++i) {
			bag.push(processLocalItem, files[i], outputFolder, function () {
				++totalProcessed;
				if (totalProcessed >= totalFiles) {
					callback && callback();
				}
			});
		}
	});
};

var processLocalItem = function (path, outputFolder, callback) {
	var file = outputFolder + "/" + path;

	fs.stat(file, function (err, stats) {
		if (!stats || !stats.isFile()) {
			callback && callback();
			return;
		}

		var bucketItem = bucket[path];
		if (!bucketItem || bucketItem.dirty) {
			client.putFile(file, "/" + path, {
				"x-amz-acl": "public-read"
			}, function (err, res) {
				console.info("PUT:".green, path, String(res.statusCode).grey);
				callback && callback();
			});
		} else {
			callback && callback();
		}
	});
};

var output = "/tmp/poole-" + Date.now();

build(output, function (success) {
	console.info("INFO:".blue, "Pushing to S3 bucket: " + config.bucket);
	checkBucket(output, function () {
		checkLocal(output, function () {
			wrench.rmdirSyncRecursive(output);
			console.info("INFO:".blue, "Finished!");
		});
	});
});
