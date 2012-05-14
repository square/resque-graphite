module.exports = {

  // The source Redis instance.
  "redis-host": "redis.example.com",
  "redis-port": 6379,

  // The namespace for the Resque instance in Redis; the default is "resque:".
  "redis-prefix": "resque:",

  // The target Graphite (Carbon) instance.
  "graphite-host": "carbon.example.com",
  "graphite-port": 2003,

  // The prefix for global metrics (e.g., total workers).
  "graphite-global-prefix": "resque",

  // The prefix and suffix for per-host (e.g., per-host working).
  // Stats are named as `<prefix>hostname<suffix>.<name>`.
  "graphite-host-prefix": "",
  "graphite-host-suffix": ".resque",

  // The polling delay in milliseconds.
  "delay": 10000
};
