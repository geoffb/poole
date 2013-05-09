# Poole

Easily push a [Jekyll][1] based static site to an [AWS S3][2] bucket.

## Setup

Install Poole via npm:

```
npm install -g poole
```

This will install Poole globally and allow you to run the program via command line.

## Configuration

### AWS authentication

In order to access your S3 bucket, Poole needs to know your AWS keys and bucket information. This information is provided in the Poole configuration file: `~/.poole-config.json`, which lives in your home directory. This file can contain several different AWS key/secret pairs as well as some options.

Here's a simple example of a Poole config file with AWS auth info:

```json
{
	"auth": {
		"lostdecadegames": {
			"key": "my-aws-key",
			"secret": "my-aws-secret"
		}
	}
}
```

Here we have an AWS key/secret alias called "lostdecadegames". If you have more than one AWS account, you can add more entries here.

Make sure you **DO NOT COMMIT** this file into source control as it contains your **secret AWS information**!

### Misc. Options

Some miscellaneous options can all be specified with the "opts" key of your Poole config file. For example:

```json
{
	"auth": {

	},
	"opts": {
		"maxConcurrency": 10
	}
}
```

The currently supported options are:

* maxConcurrency: Limits the number of concurrent file operations

### Project specific configuration

Each project you wish to push to an S3 bucket must have a `.poole.json` file at its root. Here's an example of a simple Poole project configuration file:

```json
{
	"targets": {
		"production": {
			"auth": "lostdecadegames",
			"bucket": "www.cryptrun.com",
			"region": "us-west-2"
		},
		"stage": {
			"auth": "lostdecadegames",
			"bucket": "stage.www.cryptrun.com",
			"region": "us-west-2"
		}
	},
	"headers": {
		"(jpg|jpeg|png|mp3)$": {
			"Cache-control": "max-age=31536000"
		},
		"(html|htm)$": {
			"Cache-control": "max-age=172800, must-revalidate"
		}
	}
}
```

The `targets` key lists the various S3 buckets where you will be deploying your site. In this example we have "production" and "stage" targets. The `auth` key corresponds to an entry in your `~/.poole-auth.json` file, detailed above.

The `headers` key lists some regex rules and associated headers. Any files matching the rules will have the specified headers set in S3. In this example, `.html` and `.htm` files will have their `max-age` set to 2 days while images don't expire for a year.

## Usage

Simply navigate to your Jekyll based project and run `poole` from the command line:

```bash
cd ~/myWebsite
poole deploy stage
```

In this example, we're telling Poole to deploy the current site to the "stage" target defined in `.poole.json`.

## Why "Poole"?

Poole is the name of [Dr. Jekyll's butler][3].

> Poole is Dr Jekyll's butler who, upon noticing the reclusiveness and changes of his master, goes to Mr Utterson with the fear that his master has been murdered and his murderer, Mr Hyde, is residing in the chambers. Poole serves Jekyll faithfully, and attempts to do a good job and be loyal to his master. Yet events finally drive him into joining forces with Utterson to discover the truth.

## Attribution

Poole was written by Geoff Blair for use by his indie game studio, [Lost Decade Games][4].

[1]: https://github.com/mojombo/jekyll
[2]: http://aws.amazon.com/s3/
[3]: http://en.wikipedia.org/wiki/Strange_Case_of_Dr_Jekyll_and_Mr_Hyde#Poole
[4]: http://www.lostdecadegames.com
