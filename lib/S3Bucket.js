var fs = require("fs");
var path = require("path");
var crypto = require("crypto");
var knox = require("knox");
var Bagpipe = require("bagpipe");
var wrench = require("wrench");

var config = require("./config");
var log = require("./log");

// Bagpipe is used to throttle file operations
// to avoid the EMFILE errors node will throw
// when attempting to open too many files at once
// TODO: Replace this with async.queue perhaps?
var maxConcurrency = config.getOpt("maxConcurrency", 5);
var bag = new Bagpipe(maxConcurrency);

var hashFile = function (file, callback) {
	var hash = crypto.createHash("md5");
	var stream = fs.ReadStream(file);

	stream.on("data", function (data) {
		hash.update(data);
	});

	stream.on("end", function () {
		var digest = hash.digest("hex");
		callback && callback(digest);
	});
};

var processRemote = function (syncFolder, callback) {
	var finished = function () {
		callback && callback();
	};

	var listCallback = function (err, data) {
		// TODO: Handle errors listing the bucket contents
		var contents = data.Contents;
		var count = 0;

		if (contents.length < 1) {
			finished();
			return;
		}

		for (var i = 0; i < contents.length; ++i) {
			var item = contents[i];
			this._cache[item.Key] = item;
			++count;

			bag.push(processRemoteItem.bind(this), item, syncFolder, function () {
				--count;
				count <= 0 && finished();
			});
		}
	};

	this._client.list(listCallback.bind(this));
};

var processRemoteItem = function (item, syncFolder, callback) {
	var file = path.resolve(syncFolder + "/" + item.Key);
	var finished = function () {
		callback && callback();
	};

	var existsCallback = function (exists) {
		if (exists) {
			// Local file exists
			// Hash contents and compare against remote ETag
			// to determine if the file is "dirty"
			hashFile(file, function (digest) {
				var remoteDigest = item.ETag.replace(/\"/g, "");
				item.dirty = (digest !== remoteDigest);
				finished();
			});
		} else {
			// Local file doesn't exist; delete it from the bucket
			var fileName = "/" + encodeURIComponent(item.Key);
			this._client.deleteFile(fileName, function (err, res) {
				// TODO: Handle file delete errors
				log.s3action("DELETE", item.Key, res.statusCode);
				finished();
			});
		}
	};

	fs.exists(file, existsCallback.bind(this));
};

var processLocal = function (syncFolder, callback) {
	var totalFiles = 0;
	var totalProcessed = 0;
	var allFilesRead = false;

	var readdirCallback = function (err, files) {
		if (!files) {
			allFilesRead = true;
			return;
		}
		totalFiles += files.length;

		for (var i = 0, j = files.length; i < j; ++i) {
			bag.push(processLocalItem.bind(this), files[i], syncFolder, function () {
				++totalProcessed;
				if (totalProcessed >= totalFiles && allFilesRead) {
					callback && callback();
				}
			});
		}
	};

	wrench.readdirRecursive(syncFolder, readdirCallback.bind(this));
};

var processLocalItem = function (file, syncFolder, callback) {
	var fileName = path.resolve(syncFolder + "/" + file);

	var finished = function () {
		callback && callback();
	};

	var statCallback = function (err, stats) {
		if (!stats || !stats.isFile()) {
			finished();
			return;
		}

		var bucketItem = this._cache[file];
		if (!bucketItem || bucketItem.dirty) {

			// Default headers
			// TODO: Perhaps it'd be better not to force public acl
			var headers = {
				"x-amz-acl": "public-read"
			};

			for (var pattern in this._headerRules) {
				if (!file.match(pattern)) { continue; }

				var extraHeaders = this._headerRules[pattern];
				for (var field in extraHeaders) {
					headers[field] = extraHeaders[field];
				}
			}

			// Update file in S3 bucket
			this._client.putFile(syncFolder + "/" + file, "/" + file, headers, function (err, res) {
				log.s3action("PUT", file, res.statusCode);
				finished();
			});
		} else {
			// This file exists in both remote and local, and hasn't changed
			finished();
		}
	};

	fs.stat(fileName, statCallback.bind(this));
};

var S3Bucket = module.exports = function (config, headerRules) {
	// Local cache of remote bucket contents
	// Used for comparing existence and ETag
	this._cache = {};

	// Header regex based rules
	// Specifies arbitrary headers to send with matching paths
	this._headerRules = headerRules;

	// Create knox client which interfaces with S3 for us
	// TODO: Experiment with official AWS node.js lib someday...
	try {
		this._client = new knox.createClient(config);
	} catch (ex) {
		log.warn("Could not create knox client: " + ex.message);
	}
};

S3Bucket.prototype.syncFolder = function (syncFolder, callback) {
	log.info("Syncing: " + syncFolder + " => " + this._client.bucket);

	var onRemoteComplete = function () {
		processLocal.bind(this)(syncFolder, onLocalComplete.bind(this));
	};

	var onLocalComplete = function () {
		callback && callback();
	};

	processRemote.bind(this)(syncFolder, onRemoteComplete.bind(this));
};
