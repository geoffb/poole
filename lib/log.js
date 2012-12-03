var colors = require("colors");

var s3ActionColors = {
	"PUT": "green",
	"DELETE": "red"
};

module.exports = {

	info: function (message) {
		console.info("INFO:".blue, message);
	},

	warn: function (message) {
		console.warn("WARN:".yellow, message);
	},

	error: function (message) {
		console.error("ERROR:".red, message);
	},

	output: function (message) {
		console.log(message.grey);
	},

	s3action: function (action, message, statusCode) {
		var color = s3ActionColors[action];
		console.info(action[color], message, String(statusCode).grey);
	}

};
