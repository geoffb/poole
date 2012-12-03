var fs = require("fs");
var crypto = require("crypto");
var exec = require("child_process").exec;
var colors = require("colors");
var ini = require("ini");
var knox = require("knox");
var wrench = require("wrench");
var Bagpipe = require("bagpipe");

var log = require("./log");

// We use bagpipe in order to throttle the async file system calls
// If you open to many files at once, node will throw EMFILE errors
var bag = new Bagpipe(20);

// Local map of content keys for looking up content details
var bucket = {};

var die = function (message) {
	log.error(message);
	process.exit();
};

var configPath = ".poole.ini";
if (!fs.existsSync(configPath)) {
	die("No .poole.ini found!");
}

var config = ini.parse(fs.readFileSync(configPath, "utf-8"));

var headersConfigPath = ".poole-headers.json";
var headersConfig = {};
if (fs.existsSync(headersConfigPath)) {
	headersConfig = JSON.parse(fs.readFileSync(headersConfigPath, "utf-8"));
}

// We use the know utility for interacting with S3
try {
	var client = knox.createClient({
		key: config.key,
		secret: config.secret,
		region: config.region,
		bucket: config.bucket
	});
} catch (ex) {
	die(ex.message);
}

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

var checkBucket = function (outputFolder, callback) {
	var onEnd = function () {
		callback && callback();
	};

	client.list(function (err, data) {
		if (err) {
			log.error(err.message);
			return;
		}


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

				log.s3action("DELETE", item.Key, res.statusCode);
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

			var headers = {
				"x-amz-acl": "public-read"
			};

			for (var pattern in headersConfig) {
				if (!path.match(pattern)) { continue; }

				var extraHeaders = headersConfig[pattern];
				for (var field in extraHeaders) {
					headers[field] = extraHeaders[field];
				}
			}

			client.putFile(file, "/" + path, headers, function (err, res) {
				log.s3action("PUT", path, res.statusCode);
				callback && callback();
			});
		} else {
			callback && callback();
		}
	});
};

var output = "/tmp/poole-" + Date.now();

build(output, function (success) {
	log.info("Pushing to S3 bucket: " + config.bucket);

	checkBucket(output, function () {
		checkLocal(output, function () {
			wrench.rmdirSyncRecursive(output);
			log.info("Finished!");
		});
	});
});
