# Poole

Easily push a [Jekyll][1] based static site to an [AWS S3][2] bucket.

## Setup

TODO:



* How to setup
* Requires jekyll to be installed an configured

## Configuration

In order to access your S3 bucket, Poole needs to know your AWS keys and bucket information. This information is provided in a configuration file: `.poole.ini` in the root of your Jekyll based project.

Here's a simple example of a Poole config file:

```ini
key = myKey
secret = mySecret
bucket = bucketName
region = us-west-2
```

## Usage

Simply navigate to your Jekyll based project and run `poole` from the command line:

```bash
cd ~/myWebsite
poole
```

## Why "Poole"?

Poole is the name of [Dr. Jekyll's butler][3].

> Poole is Dr Jekyll's butler who, upon noticing the reclusiveness and changes of his master, goes to Mr Utterson with the fear that his master has been murdered and his murderer, Mr Hyde, is residing in the chambers. Poole serves Jekyll faithfully, and attempts to do a good job and be loyal to his master. Yet events finally drive him into joining forces with Utterson to discover the truth.

## Attribution

Poole was written by Geoff Blair for use by his indie game studio, [Lost Decade Games][4].

[1]: https://github.com/mojombo/jekyll
[2]: http://aws.amazon.com/s3/
[3]: http://en.wikipedia.org/wiki/Strange_Case_of_Dr_Jekyll_and_Mr_Hyde#Poole
[4]: http://www.lostdecadegames.com
