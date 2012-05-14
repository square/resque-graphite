var util = require("util"),
    redis = require("redis"),
    graphite = require("graphite"),
    queue = require("queue-async"),
    options = require("./resque-graphite-config");

// The basic Resque stats to collection, e.g., resque:stat:failed.
var stats = ["failed", "processed"];

// The source is Redis, and the target is Graphite.
var source,
    target,
    stopping,
    timeout;

start();

// On ^C, shutdown cleanly.
process.on("SIGINT", stop);

function start() {
  util.log("starting redis client");
  source = redis.createClient(options["redis-port"], options["redis-host"]);
  util.log("starting graphite client");
  target = graphite.createClient("plaintext://" + options["graphite-host"] + ":" + options["graphite-port"] + "/");
  loop();
}

function stop() {
  stopping = true;
  clearTimeout(timeout);
  util.log("stopping graphite client");
  target.end();
  util.log("stopping redis client");
  source.end();
}

function restart() {
  source.end();
  target.end();
  if (!stopping) setTimeout(start, 10000);
}

function loop() {
  var metrics = {},
      values = metrics[options["graphite-global-prefix"]] = {},
      q = queue();

  // Get some basic stats (e.g., failed) that can be read directly from Redis.
  q.defer(function(callback) {
    source.mget(stats.map(function(d) { return options["redis-prefix"] + "stat:" + d;}), function(error, results) {
      if (error) return callback(error);
      stats.forEach(function(d, i) { values[d] = +results[i]; });
      callback(null);
    });
  });

  // Count the number of workers, and find the workers that are active.
  // Any active workers are reported both by queue and by host.
  q.defer(function(callback) {
    source.smembers(options["redis-prefix"] + "workers", function(error, workers) {
      if (error) return callback(error);
      values.working = 0;
      values.workers = workers.length;

      // Get the current job (or null) for every worker.
      source.mget(workers.sort().map(function(worker) { return options["redis-prefix"] + "worker:" + worker; }), function(error, jobs) {
        if (error) return callback(error);

        // For each worker, inspect the associated job.
        jobs.forEach(function(job, i) {
          var working = +(job != null);

          // Record per-host metrics.
          var hostName = options["graphite-host-prefix"] + workers[i].split(".")[0] + options["graphite-host-suffix"],
              host = metrics[hostName];
          if (host) ++host.workers, host.working += working;
          else metrics[hostName] = {workers: 1, working: working};

          // If this worker is working, increment the number of working workers
          // for the associated queue. If there are no active workers for the
          // given queue, the working count will be initialized to zero when we
          // count the length of every queue, below.
          if (working) {
            ++values.working;

            // Parse the job description.
            try {
              job = JSON.parse(job);
            } catch (e) {
              return util.log(e);
            }

            // Record per-queue metrics.
            var queue = values[job.queue];
            if (queue) ++queue.working;
            else values[job.queue] = {pending: 0, working: 1};
          }
        });

        callback(null);
      });
    });
  });

  // Count the number of pending jobs in each queue.
  q.defer(function(callback) {
    source.smembers(options["redis-prefix"] + "queues", function(error, names) {
      if (error) return callback(error);
      var q = queue();
      names.forEach(function(name) { q.defer(countQueue, name); });
      q.await(callback);

      // For each queue, count the number of pending jobs.
      function countQueue(name, callback) {
        source.llen(options["redis-prefix"] + "queue:" + name, function(error, length) {
          if (error) return callback(error);
          var queue = values[name];
          if (queue) queue.pending = length;
          else values[name] = {pending: length, working: 0};
          callback(null);
        });
      }
    });
  });

  // Count the number of failing jobs. (Failed jobs that have not be cleared.)
  q.defer(function(callback) {
    source.llen(options["redis-prefix"] + "failed", function(error, result) {
      if (error) return callback(error);
      values.failing = result;
      callback(null);
    });
  });

  // Finally, report everything to Graphite!
  q.await(function(error) {
    if (error) return util.log(error), restart();
    target.write(metrics);
    timeout = setTimeout(loop, options["delay"]);
  });
}
